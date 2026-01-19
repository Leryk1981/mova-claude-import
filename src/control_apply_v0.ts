import fs from "node:fs/promises";
import path from "node:path";
import { stableStringify } from "./stable_json.js";
import { stableSha256 } from "./redaction.js";
import { buildMovaControlEntryV0, MOVA_CONTROL_ENTRY_MARKER } from "./mova_overlay_v0.js";

type ApplyResult = {
  run_id: string;
  report_path: string;
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

function updateClaude(content: string, marker: string, block: string): string {
  if (content.includes(marker)) {
    const idx = content.indexOf(marker);
    const after = content.slice(idx);
    const split = after.split("\n\n");
    split[0] = block.trimEnd();
    return content.slice(0, idx) + split.join("\n\n");
  }
  return `${block}\n${content}`;
}

export async function controlApplyV0(
  projectDir: string,
  profilePath: string,
  outDir: string,
  mode?: string
): Promise<ApplyResult> {
  const profile = await readJson(profilePath);
  const applyMode = mode ?? profile?.apply?.default_apply_mode ?? "preview";

  const claudePath = path.join(projectDir, "CLAUDE.md");
  const mcpPath = path.join(projectDir, ".mcp.json");
  const claudeExists = await exists(claudePath);
  const mcpExists = await exists(mcpPath);
  const marker = profile?.anthropic?.claude_md?.marker ?? MOVA_CONTROL_ENTRY_MARKER;

  const runId = computeRunId([profilePath, claudeExists ? "claude" : "", mcpExists ? "mcp" : "", marker, applyMode]);
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
  const controlEntry = buildMovaControlEntryV0(overlayParams);

  const applied = { claude_md: false, mcp_json: false, settings: false };
  if (applyMode === "apply") {
    if (profile?.anthropic?.claude_md?.inject_control_entry && claudeExists) {
      const raw = await fs.readFile(claudePath, "utf8");
      const updated = updateClaude(raw, marker, controlEntry);
      await fs.writeFile(claudePath, updated, "utf8");
      applied.claude_md = true;
    }
    if (profile?.anthropic?.mcp?.servers && mcpExists) {
      const mcp = await readJson(mcpPath);
      const merged = { ...mcp, servers: profile.anthropic.mcp.servers };
      await fs.writeFile(mcpPath, stableStringify(merged) + "\n", "utf8");
      applied.mcp_json = true;
    }
  }

  const report = {
    profile_version: "v0",
    run_id: runId,
    project_dir: projectDir,
    profile_path: profilePath,
    mode: applyMode,
    outcome_code: applyMode === "apply" ? "APPLIED" : "PREVIEW",
    applied,
  };

  const reportPath = path.join(runBase, "control_apply_report_v0.json");
  await writeJson(reportPath, report);

  return { run_id: runId, report_path: reportPath };
}
