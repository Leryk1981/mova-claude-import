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

test("init creates full scaffold surfaces", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test_scaffold");
  const out = path.join(tmp, "out");
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(out, { recursive: true });

  await execFileP("node", ["dist/cli.js", "init", "--out", out]);

  await assertExists(path.join(out, "CLAUDE.md"));
  await assertExists(path.join(out, ".claude", "settings.json"));
  await assertExists(path.join(out, ".claude", "settings.local.example.json"));
  await assertExists(path.join(out, ".claude", "commands", "example_command.md"));
  await assertExists(path.join(out, ".claude", "agents", "example_agent.md"));
  await assertExists(path.join(out, ".claude", "output-styles", "example_style.md"));
  await assertExists(path.join(out, ".claude", "hooks", "example_hook.js"));
  await assertExists(path.join(out, ".claude", "hooks", "mova-guard.js"));
  await assertExists(path.join(out, ".claude", "hooks", "mova-observe.js"));
  await assertExists(path.join(out, "services", "env_resolver.js"));
  await assertExists(path.join(out, ".claude", "presets", "base.preset_v0.json"));
  await assertExists(path.join(out, ".mcp.json"));
  await assertExists(path.join(out, "mova", "control_v0.json"));
});

test("control apply creates missing surfaces without erasing content", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test_scaffold_apply");
  const proj = path.join(tmp, "proj");
  const out = path.join(tmp, "out");
  const profile = path.join(process.cwd(), "fixtures", "pos", "control_profile_filled", "claude_control_profile_v0.json");
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(proj, { recursive: true });
  await fs.writeFile(path.join(proj, "CLAUDE.md"), "Custom\n", "utf8");

  await execFileP("node", [
    "dist/cli.js",
    "control",
    "apply",
    "--project",
    proj,
    "--profile",
    profile,
    "--mode",
    "apply",
    "--out",
    out,
  ]);

  const claude = await fs.readFile(path.join(proj, "CLAUDE.md"), "utf8");
  assert.ok(claude.includes("Custom"));
  assert.ok(claude.includes("MOVA_CONTROL_ENTRY_V0"));
  await assertExists(path.join(proj, ".claude", "settings.json"));
  await assertExists(path.join(proj, ".claude", "commands", "example_command.md"));
});
