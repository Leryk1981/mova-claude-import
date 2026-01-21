#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const taskIndex = process.argv.indexOf("--task");
const task = taskIndex >= 0 ? process.argv[taskIndex + 1] : undefined;

const CONTROL_FILE = path.resolve("mova", "control_v0.json");

async function loadControlConfig() {
  if (!process.env.MOVA_ENV_RESOLVE) return null;
  try {
    const { loadConfigWithEnv } = await import("../../services/env_resolver.js");
    return await loadConfigWithEnv(CONTROL_FILE, { validateTypes: true, maskSensitive: true });
  } catch {
    return null;
  }
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
  return lines.slice(Math.max(0, lines.length - count)).join("\n");
}

function runCommand(cmd, cmdArgs) {
  const result = spawnSync(cmd, cmdArgs, { encoding: "utf8" });
  return {
    code: result.status ?? 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function guardMainBranch() {
  const res = runCommand("git", ["branch", "--show-current"]);
  const branch = (res.stdout || "").trim();
  if (branch === "main") {
    block("Cannot edit files on main branch. Create a feature branch first.");
  }
}

function guardDangerousBash() {
  const input = process.env.CLAUDE_TOOL_INPUT || "";
  const pattern = /(rm\s+-rf|sudo|curl\s+[^|]+\|\s*sh|wget\s+[^|]+\|\s*sh|mkfs\.|dd\s+if=|chmod\s+777|chown\s+root|\.env|id_rsa|\.pem)/i;
  if (pattern.test(input)) {
    block("Potentially dangerous command blocked.");
  }
}

function postFormat() {
  const file = process.env.CLAUDE_TOOL_INPUT_FILE_PATH || "";
  if (!/\.(js|jsx|ts|tsx)$/i.test(file)) return;
  const res = runCommand("npx", ["prettier", "--write", file]);
  if (res.code !== 0) {
    process.stderr.write(JSON.stringify({ feedback: "Formatting failed." }));
    process.exit(1);
  }
  feedback("Formatting applied.");
}

function postTest() {
  const file = process.env.CLAUDE_TOOL_INPUT_FILE_PATH || "";
  if (!/\.test\.(js|jsx|ts|tsx)$/i.test(file)) return;
  const res = runCommand("npm", ["test", "--", "--findRelatedTests", file, "--passWithNoTests"]);
  if (res.stdout) {
    process.stdout.write(tailLines(res.stdout, 30));
  }
}

async function main() {
  switch (task) {
    case "pre-main":
      await loadControlConfig();
      guardMainBranch();
      break;
    case "pre-bash":
      await loadControlConfig();
      guardDangerousBash();
      break;
    case "post-format":
      await loadControlConfig();
      postFormat();
      break;
    case "post-test":
      await loadControlConfig();
      postTest();
      break;
    default:
      if (args.has("--help")) {
        process.stdout.write("Usage: mova-guard.js --task <pre-main|pre-bash|post-format|post-test>\n");
      }
  }
}

if (process.argv[1]?.endsWith("mova-guard.js")) {
  main().catch(() => process.exit(1));
}
