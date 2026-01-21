#!/usr/bin/env node
/**
 * MOVA Guard - Validation and protection hooks
 * Adapted for plugin architecture with ${CLAUDE_PLUGIN_ROOT} support
 * Phase 2: Enhanced with severity levels and security event recording
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const CONTROL_FILE = path.join(PROJECT_DIR, 'mova', 'control_v0.json');
const SECURITY_EVENTS_PATH = path.join(PLUGIN_ROOT, 'config', 'security-events.json');

const args = new Set(process.argv.slice(2));
const taskIndex = process.argv.indexOf('--task');
const task = taskIndex >= 0 ? process.argv[taskIndex + 1] : undefined;

// Severity levels with priorities
const SEVERITY_PRIORITY = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

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

function loadSecurityEvents() {
  try {
    if (fs.existsSync(SECURITY_EVENTS_PATH)) {
      return JSON.parse(fs.readFileSync(SECURITY_EVENTS_PATH, 'utf8'));
    }
  } catch {}
  return null;
}

function block(message, severity = 'high', ruleId = null) {
  // Record security event before blocking
  recordSecurityEvent('guardrail_violation', severity, ['block'], message, ruleId);
  process.stderr.write(JSON.stringify({ block: true, message }));
  process.exit(2);
}

function feedback(message, suppressOutput = true) {
  process.stdout.write(JSON.stringify({ feedback: message, suppressOutput }));
}

function warn(message, severity = 'medium', ruleId = null) {
  recordSecurityEvent('guardrail_violation', severity, ['warn', 'log'], message, ruleId);
  feedback(`[MOVA] ⚠ ${message}`, false);
}

function recordSecurityEvent(eventType, severity, actions, details, ruleId = null) {
  const episodesDir = path.join(PROJECT_DIR, '.mova', 'episodes');
  const currentSessionPath = path.join(episodesDir, '.current_session_id');

  if (!fs.existsSync(currentSessionPath)) return;

  try {
    const sessionId = fs.readFileSync(currentSessionPath, 'utf8').trim();
    const sessionDir = path.join(episodesDir, sessionId);

    if (!fs.existsSync(sessionDir)) return;

    const episode = {
      episode_id: `ep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      episode_type: 'security_event',
      mova_version: '4.1.1',
      recorded_at: new Date().toISOString(),
      executor: {
        executor_id: 'mova-guard',
        role: 'validator',
        executor_kind: 'service'
      },
      result_status: actions.includes('block') ? 'failed' : 'completed',
      result_summary: details,
      security_event: {
        event_type: eventType,
        severity: severity,
        actions_taken: actions,
        detection_confidence: 1.0,
        rule_id: ruleId
      }
    };

    fs.appendFileSync(
      path.join(sessionDir, 'events.jsonl'),
      JSON.stringify(episode) + '\n',
      'utf8'
    );
  } catch {
    // Silently fail - don't block on logging errors
  }
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
    block(
      'Cannot edit files on main/master branch. Create a feature branch first.',
      'high',
      'block-main-branch'
    );
  }
}

function guardDangerousBash() {
  const input = process.env.CLAUDE_TOOL_INPUT || '';
  const config = loadControlConfig();

  // Default dangerous patterns with severity
  const defaultPatterns = [
    { pattern: /rm\s+-rf\s+[\/~]/i, severity: 'critical', id: 'block-rm-rf-root' },
    { pattern: /sudo\s+/i, severity: 'high', id: 'block-sudo' },
    { pattern: /curl\s+[^|]+\|\s*sh/i, severity: 'critical', id: 'block-pipe-to-shell' },
    { pattern: /wget\s+[^|]+\|\s*sh/i, severity: 'critical', id: 'block-pipe-to-shell' },
    { pattern: /mkfs\./i, severity: 'critical', id: 'block-mkfs' },
    { pattern: /dd\s+if=/i, severity: 'critical', id: 'block-dd' },
    { pattern: /chmod\s+777/i, severity: 'high', id: 'block-chmod-777' },
    { pattern: /chown\s+root/i, severity: 'high', id: 'block-chown-root' },
    { pattern: />\s*\/etc\//i, severity: 'critical', id: 'block-write-etc' },
    { pattern: /\beval\s*\(/i, severity: 'high', id: 'block-eval' }
  ];

  // Check against guardrail rules if available (higher priority)
  if (config?.guardrail_rules) {
    for (const rule of config.guardrail_rules) {
      if (rule.enabled === false) continue;
      if (rule.target?.tool === 'Bash' && rule.target?.pattern) {
        const pattern = new RegExp(rule.target.pattern, 'i');
        if (pattern.test(input)) {
          const severity = rule.severity || 'high';
          const actions = rule.on_violation || [];

          if (rule.effect === 'deny' || actions.includes('block')) {
            block(
              `Guardrail [${rule.rule_id}]: ${rule.description || 'Blocked by policy'}`,
              severity,
              rule.rule_id
            );
          } else if (rule.effect === 'warn' || actions.includes('warn')) {
            warn(rule.description || rule.rule_id, severity, rule.rule_id);
          }
        }
      }
    }
  }

  // Check default patterns
  for (const { pattern, severity, id } of defaultPatterns) {
    if (pattern.test(input)) {
      block(
        'Potentially dangerous command blocked by MOVA guard.',
        severity,
        id
      );
    }
  }
}

function evaluateGuardrailRules() {
  const config = loadControlConfig();
  if (!config?.guardrail_rules) return;

  const toolName = process.env.CLAUDE_TOOL_NAME || '';
  const input = process.env.CLAUDE_TOOL_INPUT || '';
  const filePath = process.env.CLAUDE_TOOL_INPUT_FILE_PATH || '';

  // Collect all violations and sort by severity
  const violations = [];

  for (const rule of config.guardrail_rules) {
    if (rule.enabled === false) continue;

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
      violations.push(rule);
    }
  }

  // Sort by severity (highest first)
  violations.sort((a, b) => {
    return (SEVERITY_PRIORITY[b.severity] || 0) - (SEVERITY_PRIORITY[a.severity] || 0);
  });

  // Process violations
  for (const rule of violations) {
    const severity = rule.severity || 'medium';
    const actions = rule.on_violation || [];

    if (actions.includes('block') || rule.effect === 'deny') {
      block(
        `Guardrail [${rule.rule_id}]: ${rule.description || 'Blocked'}`,
        severity,
        rule.rule_id
      );
    }

    if (actions.includes('warn') || rule.effect === 'warn') {
      warn(rule.description || rule.rule_id, severity, rule.rule_id);
    }

    if (actions.includes('log') || rule.effect === 'log_only') {
      recordSecurityEvent(
        'guardrail_violation',
        severity,
        ['log'],
        rule.description || rule.rule_id,
        rule.rule_id
      );
    }

    if (actions.includes('require_confirmation')) {
      // Log that confirmation was required
      recordSecurityEvent(
        'guardrail_violation',
        severity,
        ['require_confirmation'],
        `Confirmation required: ${rule.description || rule.rule_id}`,
        rule.rule_id
      );
      feedback(`[MOVA] Confirmation required: ${rule.description || rule.rule_id}`, false);
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
