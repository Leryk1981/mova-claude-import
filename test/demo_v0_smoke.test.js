import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

async function exists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

test("demo v0 produces report and referenced files", async () => {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  await execFileP(npmCmd, ["run", "demo"], { cwd: process.cwd(), shell: true });

  const demoRoot = path.join(process.cwd(), "artifacts", "demo_v0");
  const dirs = await fs.readdir(demoRoot);
  assert.ok(dirs.length > 0);
  dirs.sort();
  const reportPath = path.join(demoRoot, dirs[dirs.length - 1], "demo_report_v0.json");
  assert.ok(await exists(reportPath));

  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  assert.ok(await exists(report.output_path));
  assert.ok(await exists(report.refs.manifest));
  assert.ok(await exists(report.refs.export_manifest));
  assert.ok(await exists(report.refs.control_runs_dir));
  assert.ok(await exists(report.refs.control_check_summary));
  assert.ok(await exists(report.refs.control_apply_report));
});
