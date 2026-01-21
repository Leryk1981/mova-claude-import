import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

test("preset_manager applies development preset", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test_preset_manager");
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(path.join(tmp, ".claude", "presets"), { recursive: true });
  await fs.mkdir(path.join(tmp, "mova"), { recursive: true });
  await fs.mkdir(path.join(tmp, "services"), { recursive: true });

  await fs.copyFile(path.join(".claude", "presets", "base.preset_v0.json"), path.join(tmp, ".claude", "presets", "base.preset_v0.json"));
  await fs.copyFile(path.join(".claude", "presets", "development.preset_v0.json"), path.join(tmp, ".claude", "presets", "development.preset_v0.json"));
  await fs.copyFile(path.join(".claude", "presets", "production.preset_v0.json"), path.join(tmp, ".claude", "presets", "production.preset_v0.json"));
  await fs.copyFile(path.join("mova", "control_v0.json"), path.join(tmp, "mova", "control_v0.json"));
  await fs.copyFile(path.join("services", "env_resolver.js"), path.join(tmp, "services", "env_resolver.js"));
  await fs.copyFile(path.join("services", "preset_manager.js"), path.join(tmp, "services", "preset_manager.js"));

  const { stdout } = await execFileP("node", ["services/preset_manager.js", "list"], { cwd: tmp });
  assert.ok(stdout.includes("base"));

  await execFileP("node", ["services/preset_manager.js", "apply", "development"], { cwd: tmp });
  const control = JSON.parse(await fs.readFile(path.join(tmp, "mova", "control_v0.json"), "utf8"));
  assert.ok(control.policy?.permissions?.allow?.includes("*"));
});
