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

test("strict input policy denies local settings and stops rebuild", async () => {
  const out = path.join(process.cwd(), ".tmp_test_strict");
  await fs.rm(out, { recursive: true, force: true });
  await fs.mkdir(out, { recursive: true });

  const proj = path.join(process.cwd(), "fixtures", "neg", "strict_denied_local");
  let exitCode = 0;
  try {
    await execFileP("node", ["dist/cli.js", "--project", proj, "--out", out, "--strict"]);
  } catch (err) {
    exitCode = err?.code ?? 1;
  }

  assert.equal(exitCode, 2);

  const reportPath = path.join(out, "mova", "claude_import", "v0", "input_policy_report_v0.json");
  await assertExists(reportPath);
  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  assert.equal(report.ok, false);

  let claudeExists = true;
  try {
    await fs.stat(path.join(out, "CLAUDE.md"));
  } catch {
    claudeExists = false;
  }
  assert.equal(claudeExists, false);
});
