import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

test("dashboard_server CLI test passes", async () => {
  const { stdout } = await execFileP("node", ["services/dashboard_server.js", "test"]);
  assert.ok(stdout.includes("dashboard_server tests: ok"));
});
