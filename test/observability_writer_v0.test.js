import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

test("observability writer logs events without secrets", async () => {
  const tmp = path.join(process.cwd(), ".tmp_test_observability");
  const proj = path.join(tmp, "proj");
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(tmp, { recursive: true });

  await execFileP("node", ["dist/cli.js", "init", "--out", proj]);
  await execFileP("node", [
    "dist/cli.js",
    "control",
    "apply",
    "--project",
    proj,
    "--profile",
    path.join(proj, "mova", "control_v0.json"),
    "--mode",
    "apply",
    "--out",
    proj,
  ]);

  const scriptPath = path.join(proj, ".claude", "hooks", "mova-observe.js");
  await fs.stat(scriptPath);

  await execFileP("node", [scriptPath, "--event", "PostToolUse"], {
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: proj,
      CLAUDE_TOOL_NAME: "Bash",
      CLAUDE_TOOL_STDOUT: "TOKEN=supersecret\nPLACEHOLDER=${TOKEN}\n",
      CLAUDE_TOOL_STDERR: "sk-abcdef123456\n",
    },
  });

  const episodesRoot = path.join(proj, ".mova", "episodes");
  const runDirs = await fs.readdir(episodesRoot, { withFileTypes: true });
  const runDir = runDirs.find((d) => d.isDirectory())?.name;
  assert.ok(runDir, "expected run directory");

  const eventsPath = path.join(episodesRoot, runDir, "events.jsonl");
  const summaryPath = path.join(episodesRoot, runDir, "summary.json");
  const events = (await fs.readFile(eventsPath, "utf8")).trim().split(/\r?\n/);
  assert.ok(events.length >= 1);
  const event = JSON.parse(events[0]);
  assert.equal(event.event_type, "PostToolUse");
  assert.ok(!JSON.stringify(event).includes("supersecret"));

  const summary = JSON.parse(await fs.readFile(summaryPath, "utf8"));
  assert.equal(summary.run_id, runDir);
});
