import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

async function listFilesRec(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(current, e.name);
      if (e.isDirectory()) stack.push(abs);
      else if (e.isFile()) out.push(abs);
    }
  }
  return out;
}

async function readOutputSnapshot(root) {
  const files = await listFilesRec(root);
  const snapshot = {};
  for (const abs of files) {
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    snapshot[rel] = await fs.readFile(abs, "utf8");
  }
  return JSON.stringify(snapshot, Object.keys(snapshot).sort(), 2);
}

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
  const snapshot1 = await readOutputSnapshot(out);

  await execFileP("node", ["dist/cli.js", "--project", proj, "--out", out]);
  const snapshot2 = await readOutputSnapshot(out);

  assert.equal(snapshot1, snapshot2);
});
