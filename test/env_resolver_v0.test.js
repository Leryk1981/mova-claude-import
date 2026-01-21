import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

test("env_resolver CLI test passes", async () => {
  const { stdout } = await execFileP("node", ["services/env_resolver.js", "test"]);
  assert.ok(stdout.includes("env_resolver tests: ok"));
});
