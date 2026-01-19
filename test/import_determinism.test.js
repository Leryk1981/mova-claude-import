import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

test("import is deterministic for same inputs", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test");
  const proj = path.join(tmp, "proj");
  const out = path.join(tmp, "out");
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(path.join(proj, ".claude", "skills"), { recursive: true });

  await fs.writeFile(path.join(proj, "CLAUDE.md"), "Hello\n", "utf8");
  await fs.writeFile(path.join(proj, ".mcp.json"), "{\"servers\":[]}", "utf8");
  await fs.writeFile(path.join(proj, ".claude", "skills", "a.md"), "# skill\n", "utf8");

  await execFileP("node", ["dist/cli.js", "--project", proj, "--out", out]);
  const latest1 = JSON.parse(await fs.readFile(path.join(out, "mova", "claude_import", "v0", "runs", "latest.json"), "utf8"));
  const manifest1 = await fs.readFile(path.join(out, "mova", "claude_import", "v0", "runs", latest1.run_id, "import_manifest.json"), "utf8");

  await execFileP("node", ["dist/cli.js", "--project", proj, "--out", out]);
  const latest2 = JSON.parse(await fs.readFile(path.join(out, "mova", "claude_import", "v0", "runs", "latest.json"), "utf8"));
  const manifest2 = await fs.readFile(path.join(out, "mova", "claude_import", "v0", "runs", latest2.run_id, "import_manifest.json"), "utf8");

  assert.equal(latest1.run_id, latest2.run_id);
  assert.equal(manifest1, manifest2);

  // ensure we do NOT copy source contents into sources/ in v0
  const sourcesDir = path.join(out, "mova", "claude_import", "v0", "runs", latest1.run_id, "sources");
  let sourcesExists = true;
  try { await fs.stat(sourcesDir); } catch { sourcesExists = false; }
  assert.equal(sourcesExists, false);
});
