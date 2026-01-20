import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

test("control apply writes marker and report", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test_control_apply");
  const proj = path.join(tmp, "proj");
  const out = path.join(tmp, "out");
  const profile = path.join(process.cwd(), "fixtures", "pos", "control_profile_filled", "claude_control_profile_v0.json");
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(proj, { recursive: true });
  await fs.writeFile(path.join(proj, "CLAUDE.md"), "Hello\n", "utf8");
  await fs.writeFile(path.join(proj, ".mcp.json"), "{\"mcpServers\":{}}", "utf8");

  await execFileP("node", [
    "dist/cli.js",
    "control",
    "apply",
    "--project",
    proj,
    "--profile",
    profile,
    "--mode",
    "apply",
    "--out",
    out,
  ]);

  const claude = await fs.readFile(path.join(proj, "CLAUDE.md"), "utf8");
  assert.ok(claude.includes("MOVA_CONTROL_ENTRY_V0"));

  const runsDir = path.join(out, "mova", "claude_control", "v0", "runs");
  const entries = await fs.readdir(runsDir);
  assert.ok(entries.length > 0);
});

