import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeys(value[key]);
    }
    return out;
  }
  return value;
}

async function normalizeJson(p) {
  const raw = await fs.readFile(p, "utf8");
  const parsed = JSON.parse(raw);
  return JSON.stringify(sortKeys(parsed), null, 2);
}

test("control demo full roundtrip is deterministic", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test_full_roundtrip");
  const fixture = path.join(process.cwd(), "fixtures", "pos", "claude_code_demo_full");
  const proj = path.join(tmp, "proj");
  const out1 = path.join(tmp, "out1");
  const out2 = path.join(tmp, "out2");
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(tmp, { recursive: true });
  await fs.cp(fixture, proj, { recursive: true });

  await execFileP("node", ["dist/cli.js", "control", "prefill", "--project", proj, "--out", out1]);
  await execFileP("node", ["dist/cli.js", "control", "prefill", "--project", proj, "--out", out2]);

  const control1 = await normalizeJson(path.join(out1, "mova", "control_v0.json"));
  const control2 = await normalizeJson(path.join(out2, "mova", "control_v0.json"));
  assert.equal(control1, control2);

  await execFileP("node", [
    "dist/cli.js",
    "control",
    "apply",
    "--project",
    proj,
    "--profile",
    path.join(out1, "mova", "control_v0.json"),
    "--mode",
    "apply",
    "--out",
    out1,
  ]);

  const control = JSON.parse(await fs.readFile(path.join(out1, "mova", "control_v0.json"), "utf8"));
  const { controlToSettingsV0 } = await import("../dist/control_v0.js");
  const expectedSettingsPath = path.join(out1, "mova", "control_v0_settings_expected.json");
  await fs.writeFile(expectedSettingsPath, JSON.stringify(controlToSettingsV0(control), null, 2));
  const settingsExpected = await normalizeJson(expectedSettingsPath);
  const settingsOut = await normalizeJson(path.join(proj, ".claude", "settings.json"));
  assert.equal(settingsOut, settingsExpected);

  const mcpOut = await normalizeJson(path.join(proj, ".mcp.json"));
  const mcpExpected = await normalizeJson(path.join(fixture, ".mcp.json"));
  assert.equal(mcpOut, mcpExpected);

  const claude = await fs.readFile(path.join(proj, "CLAUDE.md"), "utf8");
  assert.ok(claude.includes("MOVA_CONTROL_ENTRY_V0"));

  await execFileP("node", [
    "dist/cli.js",
    "control",
    "apply",
    "--project",
    proj,
    "--profile",
    path.join(out1, "mova", "control_v0.json"),
    "--mode",
    "apply",
    "--out",
    out1,
  ]);

  const settingsOut2 = await normalizeJson(path.join(proj, ".claude", "settings.json"));
  const mcpOut2 = await normalizeJson(path.join(proj, ".mcp.json"));
  assert.equal(settingsOut, settingsOut2);
  assert.equal(mcpOut, mcpOut2);
});
