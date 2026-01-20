import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

async function readExportManifest(outDir) {
  const p = path.join(outDir, "mova", "claude_import", "v0", "export_manifest_v0.json");
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

test("zip export is deterministic across runs", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test_zip");
  const proj = path.join(tmp, "proj");
  const out1 = path.join(tmp, "out1");
  const out2 = path.join(tmp, "out2");
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(path.join(proj, ".claude", "skills"), { recursive: true });

  await fs.writeFile(path.join(proj, "CLAUDE.md"), "Hello\n", "utf8");
  await fs.writeFile(path.join(proj, ".mcp.json"), "{\"mcpServers\":{}}", "utf8");
  await fs.writeFile(path.join(proj, ".claude", "skills", "a.md"), "# skill\n", "utf8");

  await execFileP("node", ["dist/cli.js", "--project", proj, "--out", out1, "--zip"]);
  await execFileP("node", ["dist/cli.js", "--project", proj, "--out", out2, "--zip"]);

  const manifest1 = await readExportManifest(out1);
  const manifest2 = await readExportManifest(out2);

  assert.equal(manifest1.zip_sha256, manifest2.zip_sha256);

  const zip1 = path.join(out1, manifest1.zip_rel_path);
  await fs.stat(zip1);

  assert.ok(manifest1.files.includes("CLAUDE.md"));
  assert.ok(manifest1.files.includes(".claude/settings.json"));
});

