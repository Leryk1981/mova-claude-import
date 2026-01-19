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

test("init v0 creates profile scaffold and optional zip", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test_init");
  const out = path.join(tmp, "out");
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(out, { recursive: true });

  await execFileP("node", ["dist/cli.js", "init", "--out", out, "--zip"]);

  await assertExists(path.join(out, "CLAUDE.md"));
  await assertExists(path.join(out, ".claude", "settings.json"));
  await assertExists(path.join(out, ".claude", "skills", "mova-layer-v0", "SKILL.md"));

  const initManifestPath = path.join(out, "mova", "claude_import", "v0", "init_manifest_v0.json");
  const initManifest = JSON.parse(await fs.readFile(initManifestPath, "utf8"));
  assert.equal(initManifest.profile_version, "v0");
  assert.ok(initManifest.zip_sha256);
  assert.ok(initManifest.zip_rel_path);

  await assertExists(path.join(out, initManifest.zip_rel_path));
});
