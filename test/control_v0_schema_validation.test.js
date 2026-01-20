import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

test("control check validates schema and fails on invalid control", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test_control_schema");
  const proj = path.join(tmp, "proj");
  const out = path.join(tmp, "out");
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(tmp, { recursive: true });

  const fixture = path.join(process.cwd(), "fixtures", "pos", "claude_code_demo_full");
  await fs.cp(fixture, proj, { recursive: true });

  await execFileP("node", ["dist/cli.js", "control", "prefill", "--project", proj, "--out", out]);
  await execFileP("node", [
    "dist/cli.js",
    "control",
    "apply",
    "--project",
    proj,
    "--profile",
    path.join(out, "mova", "control_v0.json"),
    "--mode",
    "apply",
    "--out",
    out,
  ]);

  await execFileP("node", [
    "dist/cli.js",
    "control",
    "check",
    "--project",
    proj,
    "--profile",
    path.join(out, "mova", "control_v0.json"),
    "--out",
    out,
  ]);

  const invalidControlPath = path.join(tmp, "invalid_control.json");
  const invalid = JSON.parse(await fs.readFile(path.join(out, "mova", "control_v0.json"), "utf8"));
  invalid.policy.mode = 123;
  await fs.writeFile(invalidControlPath, JSON.stringify(invalid, null, 2));

  let code = 0;
  try {
    await execFileP("node", [
      "dist/cli.js",
      "control",
      "check",
      "--project",
      proj,
      "--profile",
      invalidControlPath,
      "--out",
      out,
    ]);
  } catch (err) {
    code = err?.code ?? 1;
  }
  assert.equal(code, 2);
});
