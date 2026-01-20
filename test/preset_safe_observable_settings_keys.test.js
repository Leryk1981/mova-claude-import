import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const ALLOWED_TOP_LEVEL = new Set([
  "permissions",
  "hooks",
  "env",
  "mcp",
  "includeCoAuthoredBy",
  "enabledPlugins",
  "extraKnownMarketplaces",
]);

test("preset settings.json only uses Anthropic top-level keys", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test_preset_settings");
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

  const settingsPath = path.join(proj, ".claude", "settings.json");
  const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
  for (const key of Object.keys(settings)) {
    assert.ok(ALLOWED_TOP_LEVEL.has(key), `unexpected top-level key: ${key}`);
  }
  assert.ok(!("claude_md" in settings));
  assert.ok(!("profile_version" in settings));
  assert.ok(!("plugins" in settings));
});
