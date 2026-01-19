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

test("control prefill is deterministic", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test_control_prefill");
  const proj = path.join(process.cwd(), "fixtures", "pos", "control_basic_project");
  const out1 = path.join(tmp, "out1");
  const out2 = path.join(tmp, "out2");
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(out1, { recursive: true });
  await fs.mkdir(out2, { recursive: true });

  await execFileP("node", ["dist/cli.js", "control", "prefill", "--project", proj, "--out", out1]);
  await execFileP("node", ["dist/cli.js", "control", "prefill", "--project", proj, "--out", out2]);

  const profile1 = await readFile(path.join(out1, "claude_control_profile_v0.json"));
  const profile2 = await readFile(path.join(out2, "claude_control_profile_v0.json"));

  assert.equal(profile1, profile2);
});
