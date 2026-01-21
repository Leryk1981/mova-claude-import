#!/usr/bin/env node
/**
 * MOVA Guard - Validation and protection hooks
 * Adapted for plugin architecture with ${CLAUDE_PLUGIN_ROOT} support
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const CONTROL_FILE = path.join(PROJECT_DIR, 'mova', 'control_v0.json');

const args = new Set(process.argv.slice(2));
const taskIndex = process.argv.indexOf('--task');
const task = taskIndex >= 0 ? process.argv[taskIndex + 1] : undefined;

function loadControlConfig() {
  try {
    if (fs.existsSync(CONTROL_FILE)) {
      return JSON.parse(fs.readFileSync(CONTROL_FILE, 'utf8'));
    }
  } catch (e) {
    // Silently fail, return null
  }
  return null;
}

function block(message) {
  process.stderr.write(JSON.stringify({ block: true, message }));
  process.exit(2);
}

function feedback(message, suppressOutput = true) {
  process.stdout.write(JSON.stringify({ feedback: message, suppressOutput }));
}

function tailLines(text, count) {
  const lines = text.split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - count)).join('\n');
}

function runCommand(cmd, cmdArgs) {
  const result = spawnSync(cmd, cmdArgs, { encoding: 'utf8', cwd: PROJECT_DIR });
  return {
    code: result.status ?? 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  };
}

function guardMainBranch() {
  const res = runCommand('git', ['branch', '--show-current']);
  const branch = (res.stdout || '').trim();
  if (branch === 'main' || branch === 'master') {
    block('Cannot edit files on main/master branch. Create a feature branch first.');
  }
}

function guardDangerousBash() {
  const input = process.env.CLAUDE_TOOL_INPUT || '';
  const config = loadControlConfig();

  // Default dangerous patterns
  const defaultPatterns = [
    /rm\s+-rf\s+[\/~]/i,
    /sudo\s+/i,
    /curl\s+[^|]+\|\s*sh/i,
    /wget\s+[^|]+\|\s*sh/i,
    /mkfs\./i,
    /dd\s+if=/i,
    /chmod\s+777/i,
    /chown\s+root/i,
    />\s*\/etc\//i,
    /\beval\s*\(/i
  ];

  // Check against guardrail rules if available
  if (config?.guardrail_rules) {
    for (const rule of config.guardrail_rules) {
      if (rule.target?.tool === 'Bash' && rule.target?.pattern && rule.effect === 'deny') {
        const pattern = new RegExp(rule.target.pattern, 'i');
        if (pattern.test(input)) {
          block(`Guardrail [${rule.rule_id}]: ${rule.description || 'Blocked by policy'}`);
        }
      }
    }
  }

  // Check default patterns
  for (const pattern of defaultPatterns) {
    if (pattern.test(input)) {
      block('Potentially dangerous command blocked by MOVA guard.');
    }
  }
}

function evaluateGuardrailRules() {
  const config = loadControlConfig();
  if (!config?.guardrail_rules) return;

  const toolName = process.env.CLAUDE_TOOL_NAME || '';
  const input = process.env.CLAUDE_TOOL_INPUT || '';
  const filePath = process.env.CLAUDE_TOOL_INPUT_FILE_PATH || '';

  for (const rule of config.guardrail_rules) {
    if (!rule.enabled && rule.enabled !== undefined) continue;

    let matches = false;

    // Check tool pattern
    if (rule.target?.tool) {
      const toolPattern = new RegExp(rule.target.tool, 'i');
      if (toolPattern.test(toolName)) {
        if (rule.target?.pattern) {
          const inputPattern = new RegExp(rule.target.pattern, 'i');
          matches = inputPattern.test(input);
        } else {
          matches = true;
        }
      }
    }

    // Check path glob
    if (rule.target?.path_glob && filePath) {
      const glob = rule.target.path_glob
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\./g, '\\.');
      const pathPattern = new RegExp(glob, 'i');
      matches = matches || pathPattern.test(filePath);
    }

    if (matches) {
      const actions = rule.on_violation || [];

      if (actions.includes('block') || rule.effect === 'deny') {
        block(`Guardrail [${rule.rule_id}]: ${rule.description || 'Blocked'}`);
      }

      if (actions.includes('warn') || rule.effect === 'warn') {
        feedback(`[MOVA] Warning: ${rule.description || rule.rule_id}`, false);
      }

      if (actions.includes('log') || rule.effect === 'log_only') {
        // Logging is handled by mova-observe
      }
    }
  }
}

function postFormat() {
  const file = process.env.CLAUDE_TOOL_INPUT_FILE_PATH || '';
  if (!/\.(js|jsx|ts|tsx|json|md|css|scss)$/i.test(file)) return;

  // Check if prettier exists
  try {
    const res = runCommand('npx', ['prettier', '--write', file]);
    if (res.code === 0) {
      feedback('[MOVA] post-format: applied');
    }
  } catch {
    // Prettier not available, skip
  }
}

function postTest() {
  const file = process.env.CLAUDE_TOOL_INPUT_FILE_PATH || '';
  if (!/\.(test|spec)\.(js|jsx|ts|tsx)$/i.test(file)) return;

  const config = loadControlConfig();
  if (config?.policy?.skip_post_test) return;

  try {
    const res = runCommand('npm', ['test', '--', '--findRelatedTests', file, '--passWithNoTests']);
    if (res.stdout) {
      process.stdout.write(tailLines(res.stdout, 30));
    }
    if (res.code !== 0) {
      feedback('[MOVA] post-test: failed', false);
    } else {
      feedback('[MOVA] post-test: passed');
    }
  } catch {
    // Test runner not available
  }
}

function main() {
  switch (task) {
    case 'pre-main':
      guardMainBranch();
      break;
    case 'pre-bash':
      guardDangerousBash();
      break;
    case 'evaluate-rules':
      evaluateGuardrailRules();
      break;
    case 'post-format':
      postFormat();
      break;
    case 'post-test':
      postTest();
      break;
    default:
      if (args.has('--help')) {
        console.log('Usage: mova-guard.js --task <pre-main|pre-bash|evaluate-rules|post-format|post-test>');
      }
  }
}

main();
