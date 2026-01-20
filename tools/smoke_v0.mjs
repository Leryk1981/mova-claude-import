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

await fs.rm(tmp, { recursive: true, force: true });
process.stdout.write("smoke: ok\n");
