import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

async function readFile(p) {
  return fs.readFile(p, "utf8");
}

test("control check does not modify project files", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test_control_check");
  const proj = path.join(tmp, "proj");
  const out = path.join(tmp, "out");
  const profile = path.join(process.cwd(), "fixtures", "pos", "control_profile_filled", "claude_control_profile_v0.json");
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(proj, { recursive: true });
  await fs.writeFile(path.join(proj, "CLAUDE.md"), "Hello\n", "utf8");
  await fs.writeFile(path.join(proj, ".mcp.json"), "{\"mcpServers\":{}}", "utf8");

  const claudeBefore = await readFile(path.join(proj, "CLAUDE.md"));
  const mcpBefore = await readFile(path.join(proj, ".mcp.json"));

  await execFileP("node", ["dist/cli.js", "control", "check", "--project", proj, "--profile", profile, "--out", out]);

  const claudeAfter = await readFile(path.join(proj, "CLAUDE.md"));
  const mcpAfter = await readFile(path.join(proj, ".mcp.json"));

  assert.equal(claudeBefore, claudeAfter);
  assert.equal(mcpBefore, mcpAfter);

  const runsDir = path.join(out, "mova", "claude_control", "v0", "runs");
  const entries = await fs.readdir(runsDir);
  assert.ok(entries.length > 0);
});

