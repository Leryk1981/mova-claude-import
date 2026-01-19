import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

async function assertExists(p) {
  try {
    await fs.stat(p);
  } catch {
    assert.fail(`Expected file to exist: ${p}`);
  }
}

test("profile v0 output includes required files", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test_profile");
  const proj = path.join(tmp, "proj");
  const out = path.join(tmp, "out");
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(path.join(proj, ".claude", "skills"), { recursive: true });

  await fs.writeFile(path.join(proj, "CLAUDE.md"), "Hello\n", "utf8");
  await fs.writeFile(path.join(proj, ".mcp.json"), "{\"servers\":[]}", "utf8");
  await fs.writeFile(path.join(proj, ".claude", "skills", "a.md"), "# skill\n", "utf8");

  await execFileP("node", ["dist/cli.js", "--project", proj, "--out", out]);

  await assertExists(path.join(out, "CLAUDE.md"));
  await assertExists(path.join(out, "MOVA.md"));
  await assertExists(path.join(out, ".claude", "settings.json"));
  await assertExists(path.join(out, ".claude", "commands", "mova_context.md"));
  await assertExists(path.join(out, ".claude", "commands", "mova_lint.md"));
  await assertExists(path.join(out, ".claude", "skills", "mova-layer-v0", "SKILL.md"));
  await assertExists(path.join(out, "mova", "claude_import", "v0", "lint_report_v0.json"));
  const versionPath = path.join(out, "mova", "claude_import", "v0", "VERSION.json");
  await assertExists(versionPath);
  const version = JSON.parse(await fs.readFile(versionPath, "utf8"));
  assert.equal(version.tool_name, "mova-claude-import");
  assert.ok(version.tool_version);
  assert.equal(version.profile_version, "anthropic_profile_v0");
});
