import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

test("hot_reloader CLI test passes", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test_hot_reloader");
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(path.join(tmp, "mova"), { recursive: true });
  await fs.mkdir(path.join(tmp, "services"), { recursive: true });
  await fs.mkdir(path.join(tmp, ".claude", "hooks"), { recursive: true });
  await fs.mkdir(path.join(tmp, ".claude", "presets"), { recursive: true });

  await fs.copyFile(path.join("mova", "control_v0.json"), path.join(tmp, "mova", "control_v0.json"));
  await fs.copyFile(path.join("mova", "version_manifest_v0.json"), path.join(tmp, "mova", "version_manifest_v0.json"));

  const serviceFiles = [
    "env_resolver.js",
    "preset_manager.js",
    "episode_metrics_collector.js",
    "dashboard_server.js",
    "hot_reloader.js",
  ];
  for (const file of serviceFiles) {
    await fs.copyFile(path.join("services", file), path.join(tmp, "services", file));
  }

  await fs.copyFile(path.join(".claude", "hooks", "mova-guard.js"), path.join(tmp, ".claude", "hooks", "mova-guard.js"));
  await fs.copyFile(path.join(".claude", "hooks", "mova-observe.js"), path.join(tmp, ".claude", "hooks", "mova-observe.js"));
  await fs.copyFile(path.join(".claude", "presets", "base.preset_v0.json"), path.join(tmp, ".claude", "presets", "base.preset_v0.json"));
  await fs.copyFile(path.join(".claude", "presets", "development.preset_v0.json"), path.join(tmp, ".claude", "presets", "development.preset_v0.json"));
  await fs.copyFile(path.join(".claude", "presets", "production.preset_v0.json"), path.join(tmp, ".claude", "presets", "production.preset_v0.json"));

  const { stdout } = await execFileP("node", ["services/hot_reloader.js", "test"], { cwd: tmp });
  assert.ok(stdout.includes("hot_reloader tests: ok"));
});
