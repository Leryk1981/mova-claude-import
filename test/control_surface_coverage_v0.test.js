import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runControlSurfaceCoverageV0 } from "../dist/control_surface_coverage_v0.js";

const execFileP = promisify(execFile);

test("control surface coverage reaches 100%", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test_surface_coverage");
  const proj = path.join(tmp, "proj");
  const out = path.join(tmp, "out");
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(tmp, { recursive: true });

  const fixture = path.join(process.cwd(), "fixtures", "pos", "claude_code_demo_full");
  await fs.cp(fixture, proj, { recursive: true });

  await execFileP("node", ["dist/cli.js", "control", "prefill", "--project", proj, "--out", out]);

  const showcaseRoot = process.env.SHOWCASE_ROOT || fixture;
  const controlPath = path.join(out, "mova", "control_v0.json");
  const exclusionsPath = path.join(process.cwd(), "control_surface_exclusions_v0.json");
  const reportPath = path.join(tmp, "control_surface_coverage_report_v0.json");

  const report = await runControlSurfaceCoverageV0({
    showcaseRoot,
    controlPath,
    exclusionsPath,
    reportPath,
  });

  assert.equal(report.coverage_percent, 100);
});
