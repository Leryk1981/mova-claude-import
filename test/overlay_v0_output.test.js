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

test("overlay v0 files are emitted and CLAUDE entry exists", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test_overlay");
  const proj = path.join(tmp, "proj");
  const out = path.join(tmp, "out");
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(path.join(proj, ".claude", "skills"), { recursive: true });

  await fs.writeFile(path.join(proj, "CLAUDE.md"), "Hello\n", "utf8");
  await fs.writeFile(path.join(proj, ".mcp.json"), "{\"mcpServers\":{}}", "utf8");
  await fs.writeFile(path.join(proj, ".claude", "skills", "a.md"), "# skill\n", "utf8");

  await execFileP("node", ["dist/cli.js", "--project", proj, "--out", out]);

  await assertExists(path.join(out, ".claude", "commands", "mova_context.md"));
  await assertExists(path.join(out, ".claude", "commands", "mova_proof.md"));
  await assertExists(path.join(out, ".claude", "skills", "mova-control-v0", "SKILL.md"));

  const claudePath = path.join(out, "CLAUDE.md");
  const claude = await fs.readFile(claudePath, "utf8");
  assert.ok(claude.includes("MOVA_CONTROL_ENTRY_V0"));
});

