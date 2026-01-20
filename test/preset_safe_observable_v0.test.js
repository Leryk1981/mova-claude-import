import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

function hasHookCommand(hooks, needle) {
  if (!Array.isArray(hooks)) return false;
  for (const entry of hooks) {
    for (const hook of entry?.hooks ?? []) {
      if (typeof hook?.command === "string" && hook.command.includes(needle)) return true;
    }
  }
  return false;
}

test("preset list includes safe_observable_v0", async () => {
  const { stdout } = await execFileP("node", ["dist/cli.js", "preset", "list"]);
  assert.ok(stdout.split(/\r?\n/).includes("safe_observable_v0"));
});

test("preset overlay applies assets and hooks", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test_preset");
  const proj = path.join(tmp, "proj");
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(tmp, { recursive: true });

  await execFileP("node", ["dist/cli.js", "init", "--out", proj]);
  await execFileP("node", [
    "dist/cli.js",
    "control",
    "apply",
    "--preset",
    "safe_observable_v0",
    "--project",
    proj,
    "--mode",
    "overlay",
    "--out",
    proj,
  ]);

  await fs.stat(path.join(proj, ".claude", "hooks", "skill-eval.js"));
  await fs.stat(path.join(proj, ".claude", "commands", "start.md"));
  await fs.stat(path.join(proj, ".claude", "skills", "testing-patterns", "SKILL.md"));
  await fs.stat(path.join(proj, ".claude", "hooks", "mova-observe.js"));

  const settings = JSON.parse(await fs.readFile(path.join(proj, ".claude", "settings.json"), "utf8"));
  assert.ok(hasHookCommand(settings?.hooks?.PostToolUse, "mova-observe.js"));
  assert.ok(hasHookCommand(settings?.hooks?.PostToolUse, "--event PostToolUse"));
  assert.ok(hasHookCommand(settings?.hooks?.UserPromptSubmit, "skill-eval.js"));
});
