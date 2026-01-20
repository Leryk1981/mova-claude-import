import fs from "node:fs/promises";
import path from "node:path";
import { stableStringify } from "./stable_json.js";
import { stableSha256 } from "./redaction.js";
import { buildMovaControlEntryV0, MOVA_CONTROL_ENTRY_MARKER } from "./mova_overlay_v0.js";
import { ensureClaudeControlSurfacesV0 } from "./claude_profile_scaffold_v0.js";
import { controlToMcpJson, controlToSettingsV0, normalizeControlV0 } from "./control_v0.js";
import { validateControlV0Schema } from "./control_v0_schema.js";

type ApplyResult = {
  run_id: string;
  report_path: string;
  exit_code?: number;
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
  await ensureClaudeControlSurfacesV0(projectDir);
  const profile = await readJson(profilePath);
  const isControlV0 = profile?.version === "control_v0";
  const control = isControlV0 ? normalizeControlV0(profile).control : null;
  if (isControlV0) {
    const validation = await validateControlV0Schema(profile);
    if (!validation.ok) {
      const runId = computeRunId([profilePath, "invalid_schema"]);
      const runBase = path.join(outDir, "mova", "claude_control", "v0", "runs", runId);
      const reportPath = path.join(runBase, "control_apply_report_v0.json");
      const report = {
        profile_version: "v0",
        run_id: runId,
        project_dir: projectDir,
        profile_path: profilePath,
        mode: mode ?? "preview",
        outcome_code: "INVALID_SCHEMA",
        errors: validation.errors ?? [],
      };
      await writeJson(reportPath, report);
      return { run_id: runId, report_path: reportPath, exit_code: 2 };
    }
  }
  const applyMode = mode ?? (isControlV0 && control?.policy?.mode === "report_only" ? "preview" : profile?.apply?.default_apply_mode) ?? "preview";

  const claudePath = path.join(projectDir, "CLAUDE.md");
  const mcpPath = path.join(projectDir, ".mcp.json");
  const claudeExists = await exists(claudePath);
  const mcpExists = await exists(mcpPath);
  const marker = control?.claude_md?.marker ?? profile?.anthropic?.claude_md?.marker ?? MOVA_CONTROL_ENTRY_MARKER;

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

  const applied = { claude_md: false, mcp_json: false, settings: false, assets: false, lsp: false };
  if (applyMode === "apply") {
    if ((control?.claude_md?.inject_control_entry ?? profile?.anthropic?.claude_md?.inject_control_entry) && claudeExists) {
      const raw = await fs.readFile(claudePath, "utf8");
      const updated = updateClaude(raw, marker, controlEntry);
      await fs.writeFile(claudePath, updated, "utf8");
      applied.claude_md = true;
    }
    if (control) {
      await writeJson(path.join(projectDir, ".claude", "settings.json"), controlToSettingsV0(control));
      await writeJson(path.join(projectDir, ".mcp.json"), controlToMcpJson(control));
      applied.settings = true;
      applied.mcp_json = true;

      const assets = [
        ...control.assets.skills,
        ...control.assets.agents,
        ...control.assets.commands,
        ...control.assets.rules,
        ...control.assets.hooks,
        ...control.assets.workflows,
        ...control.assets.docs,
        ...control.assets.dotfiles,
        ...control.assets.schemas,
      ];
      for (const asset of assets) {
        const target = path.join(projectDir, asset.path);
        const sourceRel = asset.source_path ?? asset.path;
        const source = path.join(projectDir, sourceRel);
        try {
          await fs.stat(source);
        } catch {
          continue;
        }
        await fs.mkdir(path.dirname(target), { recursive: true });
        if (source !== target) {
          await fs.copyFile(source, target);
        }
      }
      applied.assets = assets.length > 0;

      if (control.lsp.managed && Array.isArray(control.lsp.enabled_plugins)) {
        const lspPath = path.join(projectDir, control.lsp.config_path);
        await writeJson(lspPath, { enabled_plugins: control.lsp.enabled_plugins });
        applied.lsp = true;
      }
    } else if (profile?.anthropic?.mcp?.servers && mcpExists) {
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
