import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const tmp = path.join(process.cwd(), ".tmp_smoke");
const out = path.join(tmp, "out");

await fs.rm(tmp, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });

await execFileP("node", ["dist/cli.js", "init", "--out", out]);
await execFileP("node", [
  "dist/cli.js",
  "control",
  "apply",
  "--preset",
  "safe_observable_v0",
  "--project",
  out,
  "--mode",
  "overlay",
  "--out",
  out,
]);

await fs.stat(path.join(out, ".claude", "hooks", "skill-eval.js"));
await fs.stat(path.join(out, ".claude", "commands", "start.md"));
await fs.stat(path.join(out, ".claude", "hooks", "mova-observe.js"));

await fs.rm(tmp, { recursive: true, force: true });
process.stdout.write("smoke: ok\n");
