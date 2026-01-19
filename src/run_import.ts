import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import type { ImportOptions, ImportResult } from "./index.js";
import { redactText, redactJson, RedactionHit } from "./redaction.js";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { getAnthropicProfileV0Files } from "./anthropic_profile_v0.js";
import { lintV0, type LintReportV0 } from "./lint_v0.js";
import { stableStringify } from "./stable_json.js";
import { createExportZipV0 } from "./export_zip_v0.js";
import { buildMovaOverlayV0, buildMovaControlEntryV0, MOVA_CONTROL_ENTRY_MARKER } from "./mova_overlay_v0.js";
import { scanInputPolicyV0 } from "./input_policy_v0.js";

type Found = {
  claudeMdPath?: string;
  mcpJsonPath?: string;
  skillFiles: string[];
  skipped: Array<{ path: string; reason: string }>;
};

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function sha256File(p: string): Promise<string> {
  const buf = await fs.readFile(p);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function readToolVersion(): Promise<string> {
  try {
    const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
    const raw = await fs.readFile(pkgPath, "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed.version === "string" ? parsed.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function isLocalExcluded(rel: string, includeLocal: boolean): boolean {
  if (includeLocal) return false;
  const base = path.basename(rel);
  if (base === "CLAUDE.local.md") return true;
  if (base.includes(".local.")) return true;
  return false;
}

async function scanProject(opts: ImportOptions): Promise<Found> {
  const projectDir = path.resolve(opts.projectDir);
  const skipped: Found["skipped"] = [];
  const found: Found = { skillFiles: [], skipped };

  const claudeMd = path.join(projectDir, "CLAUDE.md");
  if (await exists(claudeMd)) found.claudeMdPath = claudeMd;

  const mcpJson = path.join(projectDir, ".mcp.json");
  if (await exists(mcpJson)) found.mcpJsonPath = mcpJson;

  const skillsRoot = path.join(projectDir, ".claude", "skills");
  if (await exists(skillsRoot)) {
    const stack = [skillsRoot];
    while (stack.length) {
      const dir = stack.pop()!;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const abs = path.join(dir, e.name);
        const rel = path.relative(projectDir, abs).replace(/\\/g, "/");
        if (isLocalExcluded(rel, opts.includeLocal)) {
          skipped.push({ path: rel, reason: "excluded_by_default_local" });
          continue;
        }
        if (e.isDirectory()) stack.push(abs);
        else if (e.isFile() && e.name.toLowerCase().endsWith(".md"))
          found.skillFiles.push(abs);
      }
    }
  }

  // placeholder for user settings exclusion
  if (!opts.includeUserSettings) {
    skipped.push({ path: "~/.claude/*", reason: "excluded_by_default_user_settings" });
  }

  found.skillFiles.sort((a, b) => a.localeCompare(b));
  return found;
}

function computeRunId(hashes: string[]): string {
  const h = crypto.createHash("sha256");
  for (const x of hashes.sort()) h.update(x);
  return h.digest("hex").slice(0, 16);
}

function normalizeSkillDir(rel: string): string {
  const base = rel.replace(/\\/g, "/").replace(/\.md$/i, "");
  const withoutRoot = base.replace(/^\.claude\/skills\//, "");
  return withoutRoot.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

async function writeJsonFile(absPath: string, obj: any) {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, stableStringify(obj) + "\n", "utf8");
}

async function writeTextFile(absPath: string, content: string) {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, "utf8");
}

/** Load a JSON file and redact it */
async function loadAndRedactJson(p: string) {
  const raw = await fs.readFile(p, "utf8");
  const parsed = JSON.parse(raw);
  const { redacted, hits } = redactJson(parsed);
  return { raw, parsed, redacted, hits };
}

export async function runImport(opts: ImportOptions): Promise<ImportResult> {
  const projectDir = path.resolve(opts.projectDir);
  const outRoot = path.resolve(opts.outDir);
  const inputPolicy = await scanInputPolicyV0(projectDir, {
    strict: opts.strict,
    include_local: opts.includeLocal,
  });
  const found = await scanProject(opts);

  const inputs: Array<{ rel: string; sha256: string }> = [];
  const redactionHits: RedactionHit[] = [];

  /** Process a text file – redact and record */
  async function processTextFile(rel: string, absPath: string) {
    const raw = await fs.readFile(absPath, "utf8");
    const { redacted, hits } = redactText(raw);
    inputs.push({ rel, sha256: await sha256File(absPath) });
    redactionHits.push(...hits);
    return redacted;
  }

  // CLAUDE.md
  let claudeMdRedacted = "";
  if (found.claudeMdPath) {
    claudeMdRedacted = await processTextFile("CLAUDE.md", found.claudeMdPath);
  }

  // .mcp.json
  let mcpJsonRedacted = "";
  let mcpJsonParsed: any | undefined;
  if (found.mcpJsonPath) {
    const { parsed, redacted, hits } = await loadAndRedactJson(found.mcpJsonPath);
    mcpJsonParsed = parsed;
    mcpJsonRedacted = stableStringify(redacted);
    redactionHits.push(...hits);
    inputs.push({
      rel: ".mcp.json",
      sha256: await sha256File(found.mcpJsonPath),
    });
  }

  // skill files
  const skillRedactedMap: Record<string, string> = {};
  for (const f of found.skillFiles) {
    const rel = path.relative(projectDir, f).replace(/\\/g, "/");
    const redacted = await processTextFile(rel, f);
    skillRedactedMap[rel] = redacted;
  }

  const runId = computeRunId(inputs.map((x) => `${x.rel}:${x.sha256}`));

  const movaBase = path.join(outRoot, "mova", "claude_import", "v0");
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
  const normalizedSkills = Object.entries(skillRedactedMap).map(([rel, body]) => ({
    rel,
    body,
    normDir: normalizeSkillDir(rel),
    title: path.basename(rel, ".md"),
  }));

  if (!opts.dryRun) {
    const toolVersion = await readToolVersion();
    const versionInfo = {
      tool_name: "mova-claude-import",
      tool_version: toolVersion,
      profile_version: "anthropic_profile_v0",
      overlay_version: "mova_control_overlay_v0",
      input_policy_version: "input_policy_v0",
      lint_version: "lint_v0",
      quality_version: "quality_v0",
      export_zip_version: "export_zip_v0",
    };
    await writeJsonFile(path.join(movaBase, "VERSION.json"), versionInfo);
    await writeJsonFile(path.join(movaBase, "input_policy_report_v0.json"), inputPolicy);
  }

  if (opts.strict && !inputPolicy.ok) {
    const deniedRunId = computeRunId(
      inputPolicy.denied.map((d) => `${d.path}:${d.kind}:${d.reason}`).sort()
    );
    if (!opts.dryRun) {
      const manifest = {
        tool: "mova-claude-import",
        version: "v0",
        run_id: deniedRunId,
        project_dir: projectDir,
        emit_profile: opts.emitProfile,
        inputs: [],
        imported: {
          claude_md: false,
          mcp_json: false,
          skills_count: 0,
        },
        skipped: found.skipped,
        input_policy_ok: false,
      };
      const episode = {
        episode_id: deniedRunId,
        recorded_at: "1970-01-01T00:00:00.000Z",
        episode_type: "claude_import_run_v0",
        run_id: deniedRunId,
        ok: false,
        result_core: {
          imported: manifest.imported,
          inputs_count: 0,
          validation: null,
        },
        failure: {
          reason: "input_policy_denied",
          denied_count: inputPolicy.denied.length,
        },
      };
      await writeJsonFile(path.join(movaBase, "import_manifest.json"), manifest);
      await writeJsonFile(path.join(movaBase, "episode_import_run.json"), episode);
    }
    return {
      ok: false,
      exit_code: 2,
      run_id: deniedRunId,
      out_dir: outRoot,
      imported: { claude_md: false, mcp_json: false, skills_count: 0 },
      skipped: found.skipped,
      lint_summary: "lint_v0: skipped",
    };
  }

  if (!opts.dryRun && opts.emitProfile) {
    const profileFiles = getAnthropicProfileV0Files();
    if (opts.emitOverlay) {
      const controlEntry = buildMovaControlEntryV0(overlayParams);
      const claude = profileFiles["CLAUDE.md"] ?? "";
      if (!claude.includes(MOVA_CONTROL_ENTRY_MARKER)) {
        profileFiles["CLAUDE.md"] = `${controlEntry}\n${claude}`;
      }
      Object.assign(profileFiles, buildMovaOverlayV0(overlayParams));
    }
    for (const [rel, content] of Object.entries(profileFiles)) {
      await writeTextFile(path.join(outRoot, rel), content);
    }
    if (mcpJsonParsed) {
      await writeJsonFile(path.join(outRoot, ".mcp.json"), mcpJsonParsed);
    }
    for (const skill of normalizedSkills) {
      const outRel = path.join(".claude", "skills", skill.normDir, "SKILL.md");
      await writeTextFile(path.join(outRoot, outRel), skill.body);
    }
  }

  // Build contracts
  const instructionProfile = {
    profile_version: "v0",
    claude_md: claudeMdRedacted,
    anchors: {
      mova_entry: "MOVA.md",
      normalized_project: ".",
    },
  };

  const skillsCatalog = {
    profile_version: "v0",
    skills: normalizedSkills.map((skill) => ({
      skill_id: skill.normDir,
      rel_dir: `.claude/skills/${skill.normDir}`,
      title: skill.title,
      skill_md: skill.body,
    })),
  };

  const mcpServers = {
    profile_version: "v0",
    servers: Array.isArray(mcpJsonParsed?.servers) ? mcpJsonParsed?.servers : [],
  };

  if (!opts.dryRun) {
    await writeJsonFile(path.join(movaBase, "contracts", "instruction_profile_v0.json"), instructionProfile);
    await writeJsonFile(path.join(movaBase, "contracts", "skills_catalog_v0.json"), skillsCatalog);
    await writeJsonFile(path.join(movaBase, "contracts", "mcp_servers_v0.json"), mcpServers);
  }

  // Validation with Ajv
  const ajv = new (Ajv as any)({ allErrors: true, strict: true, validateSchema: false });
  (addFormats as any)(ajv);
  const schemaPath = (name: string) => fileURLToPath(new URL(`../schemas/${name}`, import.meta.url));
  const schemas = {
    instruction_profile: JSON.parse(
      await fs.readFile(schemaPath("ds.claude_import.instruction_profile_v0.schema.json"), "utf8")
    ),
    skills_catalog: JSON.parse(
      await fs.readFile(schemaPath("ds.claude_import.skills_catalog_v0.schema.json"), "utf8")
    ),
    mcp_servers: JSON.parse(
      await fs.readFile(schemaPath("ds.claude_import.mcp_servers_v0.schema.json"), "utf8")
    ),
  };
  const validateInstruction = ajv.compile(schemas.instruction_profile);
  const validateSkills = ajv.compile(schemas.skills_catalog);
  const validateMcp = ajv.compile(schemas.mcp_servers);

  const validationReport = {
    instruction_profile: validateInstruction(instructionProfile),
    skills_catalog: validateSkills(skillsCatalog),
    mcp_servers: validateMcp(mcpServers),
    errors: {
      instruction_profile: validateInstruction.errors,
      skills_catalog: validateSkills.errors,
      mcp_servers: validateMcp.errors,
    },
  };

  const manifest = {
    tool: "mova-claude-import",
    version: "v0",
    run_id: runId,
    project_dir: projectDir,
    emit_profile: opts.emitProfile,
    inputs: inputs.sort((a, b) => a.rel.localeCompare(b.rel)),
    imported: {
      claude_md: Boolean(found.claudeMdPath),
      mcp_json: Boolean(found.mcpJsonPath),
      skills_count: normalizedSkills.length,
    },
    skipped: found.skipped,
    input_policy_ok: inputPolicy.ok,
  };
  const redactionReport = {
    hits: redactionHits,
    note: "Only presence/len recorded, values omitted.",
  };

  const episode = {
    episode_id: runId,
    recorded_at: "1970-01-01T00:00:00.000Z",
    episode_type: "claude_import_run_v0",
    run_id: runId,
    ok: true,
    result_core: {
      imported: manifest.imported,
      inputs_count: manifest.inputs.length,
      validation: validationReport,
    },
  };

  if (!opts.dryRun) {
    await writeJsonFile(path.join(movaBase, "import_manifest.json"), manifest);
    await writeJsonFile(path.join(movaBase, "redaction_report.json"), redactionReport);
    await writeJsonFile(path.join(movaBase, "episode_import_run.json"), episode);
  }

  let lintReport: LintReportV0 = {
    profile_version: "v0" as const,
    ok: true,
    issues: [],
    summary: "lint_v0: ok",
  };
  if (!opts.dryRun) {
    lintReport = await lintV0({
      outRoot,
      emitProfile: opts.emitProfile,
      mcpExpected: Boolean(found.mcpJsonPath),
    });
    await writeJsonFile(path.join(movaBase, "lint_report_v0.json"), lintReport);
  }

  if (!opts.dryRun && opts.emitZip) {
    const exportZip = await createExportZipV0(outRoot, opts.zipName);
    const exportManifest = {
      profile_version: "v0",
      zip_rel_path: exportZip.zipRelPath,
      zip_sha256: exportZip.zipSha256,
      files_count: exportZip.files.length,
      files: exportZip.files,
    };
    await writeJsonFile(path.join(movaBase, "export_manifest_v0.json"), exportManifest);
  }

  return {
    ok: true,
    run_id: runId,
    out_dir: outRoot,
    imported: manifest.imported,
    skipped: found.skipped,
    lint_summary: lintReport.summary,
  };
}
