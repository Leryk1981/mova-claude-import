import fs from "node:fs/promises";
import path from "node:path";
import { stableStringify } from "./stable_json.js";
import { stableSha256 } from "./redaction.js";
import { buildMovaControlEntryV0, MOVA_CONTROL_ENTRY_MARKER } from "./mova_overlay_v0.js";

type CheckResult = {
  run_id: string;
  plan_path: string;
  summary_path: string;
};

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p: string) {
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

async function writeJson(p: string, obj: any) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, stableStringify(obj) + "\n", "utf8");
}

function computeRunId(parts: string[]): string {
  return stableSha256(parts.join("|")).slice(0, 16);
}

export async function controlCheckV0(projectDir: string, profilePath: string, outDir: string): Promise<CheckResult> {
  const profile = await readJson(profilePath);
  const claudePath = path.join(projectDir, "CLAUDE.md");
  const mcpPath = path.join(projectDir, ".mcp.json");

  const claudeExists = await exists(claudePath);
  const mcpExists = await exists(mcpPath);
  const marker = profile?.anthropic?.claude_md?.marker ?? MOVA_CONTROL_ENTRY_MARKER;

  const runId = computeRunId([profilePath, claudeExists ? "claude" : "", mcpExists ? "mcp" : "", marker]);
  const runBase = path.join(outDir, "mova", "claude_control", "v0", "runs", runId);

  const overlayParams = {
    contractsDir: "mova/claude_import/v0/contracts/",
    artifactsDir: "mova/claude_import/v0/",
    instructionProfileFile: "instruction_profile_v0.json",
    skillsCatalogFile: "skills_catalog_v0.json",
    mcpServersFile: "mcp_servers_v0.json",
    lintReportFile: "lint_report_v0.json",
    qualityReportFile: "quality_report_v0.json",
    exportManifestFile: "export_manifest_v0.json",
  };

  const actions = [];
  if (profile?.anthropic?.claude_md?.inject_control_entry) {
    actions.push({
      target: "CLAUDE.md",
      action: "insert_or_update_control_entry",
      marker,
    });
  }
  if (profile?.anthropic?.mcp?.servers && mcpExists) {
    actions.push({
      target: ".mcp.json",
      action: "merge_servers",
      summary: "merge profile servers with project mcp.json",
    });
  }

  const plan = {
    profile_version: "v0",
    run_id: runId,
    project_dir: projectDir,
    profile_path: profilePath,
    actions,
  };

  const summary = {
    run_id: runId,
    outcome_code: "PREVIEW",
    actions_count: actions.length,
    control_entry_preview: profile?.anthropic?.claude_md?.inject_control_entry
      ? buildMovaControlEntryV0(overlayParams)
      : null,
  };

  const planPath = path.join(runBase, "control_plan_v0.json");
  const summaryPath = path.join(runBase, "control_summary_v0.json");
  await writeJson(planPath, plan);
  await writeJson(summaryPath, summary);

  return { run_id: runId, plan_path: planPath, summary_path: summaryPath };
}
