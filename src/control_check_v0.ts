import fs from "node:fs/promises";
import path from "node:path";
import { stableStringify } from "./stable_json.js";
import { stableSha256 } from "./redaction.js";
import { buildMovaControlEntryV0, MOVA_CONTROL_ENTRY_MARKER } from "./mova_overlay_v0.js";
import { controlToMcpJson, controlToSettingsV0, normalizeControlV0 } from "./control_v0.js";
import { validateControlV0Schema } from "./control_v0_schema.js";

type CheckResult = {
  run_id: string;
  plan_path: string;
  summary_path: string;
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

function normalizeJson(obj: any): string {
  return stableStringify(obj);
}

function isPlaceholder(value: string): boolean {
  return /^\$\{[A-Z0-9_]+(?::-?[^}]+)?\}$/.test(value.trim());
}

function validateMcpEnvValues(servers: any): Array<{ server: string; key: string; value: string }> {
  if (!servers || typeof servers !== "object") return [];
  const issues: Array<{ server: string; key: string; value: string }> = [];
  const entries = Array.isArray(servers)
    ? servers.map((server, idx) => [server?.name ?? `index_${idx}`, server])
    : Object.entries(servers);
  for (const [name, server] of entries) {
    if (!server || typeof server !== "object") continue;
    const env = (server as any).env;
    if (!env || typeof env !== "object") continue;
    for (const [key, value] of Object.entries(env)) {
      if (typeof value !== "string") continue;
      if (!value.includes("${")) continue;
      if (!isPlaceholder(value)) {
        issues.push({ server: String(name), key, value });
      }
    }
  }
  return issues;
}

export async function controlCheckV0(projectDir: string, profilePath: string, outDir: string): Promise<CheckResult> {
  const profile = await readJson(profilePath);
  const claudePath = path.join(projectDir, "CLAUDE.md");
  const mcpPath = path.join(projectDir, ".mcp.json");
  const settingsPath = path.join(projectDir, ".claude", "settings.json");

  const claudeExists = await exists(claudePath);
  const mcpExists = await exists(mcpPath);
  const settingsExists = await exists(settingsPath);
  const isControlV0 = profile?.version === "control_v0";
  const marker = isControlV0
    ? profile?.claude_md?.marker ?? MOVA_CONTROL_ENTRY_MARKER
    : profile?.anthropic?.claude_md?.marker ?? MOVA_CONTROL_ENTRY_MARKER;

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

  if (!isControlV0) {
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

  const schemaValidation = await validateControlV0Schema(profile);
  const control = normalizeControlV0(profile).control;
  const planPath = path.join(runBase, "control_plan_v0.json");
  const summaryPath = path.join(runBase, "control_summary_v0.json");

  if (!schemaValidation.ok) {
    const summary = {
      run_id: runId,
      outcome_code: "INVALID_SCHEMA",
      errors: schemaValidation.errors ?? [],
    };
    await writeJson(planPath, { profile_version: "v0", run_id: runId, project_dir: projectDir, profile_path: profilePath, actions: [] });
    await writeJson(summaryPath, summary);
    return { run_id: runId, plan_path: planPath, summary_path: summaryPath, exit_code: 2 };
  }

  const mcpJsonExpected = controlToMcpJson(control);
  const settingsExpected = controlToSettingsV0(control);
  const missing: string[] = [];
  const drift: Array<{ path: string; expected: string; actual: string }> = [];

  if (!claudeExists) missing.push("CLAUDE.md");
  if (!settingsExists) missing.push(".claude/settings.json");
  if (!mcpExists) missing.push(".mcp.json");

  if (claudeExists && control.claude_md.inject_control_entry) {
    const claude = await fs.readFile(claudePath, "utf8");
    if (!claude.includes(control.claude_md.marker)) {
      drift.push({ path: "CLAUDE.md", expected: `marker:${control.claude_md.marker}`, actual: "missing_marker" });
    }
  }

  if (settingsExists) {
    const actual = normalizeJson(await readJson(settingsPath));
    const expected = normalizeJson(settingsExpected);
    if (actual !== expected) {
      drift.push({ path: ".claude/settings.json", expected, actual });
    }
  }

  if (mcpExists) {
    const actual = normalizeJson(await readJson(mcpPath));
    const expected = normalizeJson(mcpJsonExpected);
    if (actual !== expected) {
      drift.push({ path: ".mcp.json", expected, actual });
    }
  }

  if (control.lsp.managed) {
    const lspPath = control.lsp.config_path;
    const abs = path.join(projectDir, lspPath);
    if (!(await exists(abs))) {
      missing.push(lspPath);
    } else {
      const actual = normalizeJson(await readJson(abs));
      const expected = normalizeJson({ enabled_plugins: control.lsp.enabled_plugins });
      if (actual !== expected) {
        drift.push({ path: lspPath, expected, actual });
      }
    }
  }

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
    const abs = path.join(projectDir, asset.path);
    if (!(await exists(abs))) {
      missing.push(asset.path);
    }
  }

  const envIssues = validateMcpEnvValues(control.mcp.servers);

  let outcome = "OK";
  let exitCode = 0;
  if (envIssues.length > 0) {
    outcome = "INVALID_CONTROL";
    exitCode = 2;
  } else if (missing.length > 0) {
    outcome = "MISSING_REQUIRED_FILES";
    exitCode = 4;
  } else if (drift.length > 0) {
    outcome = "DRIFT";
    exitCode = 3;
  }

  const plan = {
    profile_version: "v0",
    run_id: runId,
    project_dir: projectDir,
    profile_path: profilePath,
    actions: [
      {
        target: "CLAUDE.md",
        action: "ensure_control_entry",
        marker: control.claude_md.marker,
      },
      {
        target: ".claude/settings.json",
        action: "overwrite",
      },
      {
        target: ".mcp.json",
        action: "overwrite",
      },
    ],
  };

  const summary = {
    run_id: runId,
    outcome_code: outcome,
    exit_code: exitCode,
    missing,
    drift_count: drift.length,
    invalid_mcp_env: envIssues,
    control_entry_preview: control.claude_md.inject_control_entry ? buildMovaControlEntryV0(overlayParams) : null,
  };

  const reportPath = path.join(runBase, "control_check_report_v0.json");
  await writeJson(planPath, plan);
  await writeJson(summaryPath, summary);
  await writeJson(reportPath, { summary, drift, missing, invalid_mcp_env: envIssues });

  return { run_id: runId, plan_path: planPath, summary_path: summaryPath, exit_code: exitCode };
}
