import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function exists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function run(cmd, args, cwd) {
  await execFileP(cmd, args, { cwd });
}

async function main() {
  const repoRoot = process.cwd();
  const demoRoot = path.join(repoRoot, ".tmp_demo");
  const proj = path.join(demoRoot, "proj");
  const out = path.join(demoRoot, "out");

  await fs.rm(demoRoot, { recursive: true, force: true });
  await fs.mkdir(demoRoot, { recursive: true });

  const nodeCmd = process.platform === "win32" ? "node.exe" : "node";
  const cli = path.join(repoRoot, "dist", "cli.js");

  await run(nodeCmd, [cli, "init", "--out", proj], repoRoot);
  await run(nodeCmd, [cli, "control", "prefill", "--project", proj, "--out", proj], repoRoot);

  const exampleProfile = path.join(repoRoot, "examples", "control_profile_min.json");
  const profilePath = path.join(proj, "claude_control_profile_v0.json");
  const exampleRaw = await fs.readFile(exampleProfile, "utf8");
  await fs.writeFile(profilePath, exampleRaw, "utf8");

  await run(nodeCmd, [cli, "control", "check", "--project", proj, "--profile", profilePath, "--out", proj], repoRoot);
  await run(nodeCmd, [cli, "control", "apply", "--project", proj, "--profile", profilePath, "--out", proj, "--mode", "apply"], repoRoot);
  await run(nodeCmd, [cli, "--project", proj, "--out", out, "--zip", "--strict=false"], repoRoot);

  const runsDir = path.join(proj, "mova", "claude_control", "v0", "runs");
  const runDirs = (await exists(runsDir)) ? await fs.readdir(runsDir) : [];
  runDirs.sort();
  let latestCheckSource = "";
  let latestApplySource = "";
  for (const dir of runDirs) {
    const check = path.join(runsDir, dir, "control_summary_v0.json");
    const apply = path.join(runsDir, dir, "control_apply_report_v0.json");
    if (await exists(check)) latestCheckSource = check;
    if (await exists(apply)) latestApplySource = apply;
  }
  const latestCheck = path.join(runsDir, "latest_check_summary.json");
  const latestApply = path.join(runsDir, "latest_apply_report.json");
  if (latestCheckSource) await fs.writeFile(latestCheck, await fs.readFile(latestCheckSource));
  if (latestApplySource) await fs.writeFile(latestApply, await fs.readFile(latestApplySource));

  const runId = sha256([proj, out, exampleRaw].join("|")).slice(0, 16);
  const artifactsDir = path.join(repoRoot, "artifacts", "demo_v0", runId);
  await fs.mkdir(artifactsDir, { recursive: true });

  const exportManifest = path.join(out, "mova", "claude_import", "v0", "export_manifest_v0.json");
  let zipPath = "";
  if (await exists(exportManifest)) {
    const exportObj = JSON.parse(await fs.readFile(exportManifest, "utf8"));
    if (exportObj?.zip_rel_path) {
      zipPath = path.join(out, exportObj.zip_rel_path);
    }
  }
  const controlRunsDir = path.join(proj, "mova", "claude_control", "v0", "runs");
  const report = {
    input_project: proj,
    output_path: out,
    zip_path: zipPath,
    refs: {
      manifest: path.join(out, "mova", "claude_import", "v0", "import_manifest.json"),
      export_manifest: exportManifest,
      control_runs_dir: controlRunsDir,
      control_check_summary: path.join(controlRunsDir, "latest_check_summary.json"),
      control_apply_report: path.join(controlRunsDir, "latest_apply_report.json"),
    },
  };

  await fs.writeFile(path.join(artifactsDir, "demo_report_v0.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
