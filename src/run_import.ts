import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { EvidenceWriter, EpisodeWriter } from "@leryk1981/mova-core-engine";
import type { ImportOptions, ImportResult } from "./index.js";
import { redactText, redactJson, stableSha256, RedactionHit } from "./redaction.js";
import Ajv from "ajv";
import addFormats from "ajv-formats";

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

/** Helper to write a JSON contract */
async function writeContract(base: string, runId: string, name: string, obj: any) {
  const outPath = path.join(base, "runs", runId, "contracts", name);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

/** Load a JSON file and redact it */
async function loadAndRedactJson(p: string) {
  const raw = await fs.readFile(p, "utf8");
  const parsed = JSON.parse(raw);
  const { redacted, hits } = redactJson(parsed);
  return { redacted, hits };
}

export async function runImport(opts: ImportOptions): Promise<ImportResult> {
  const projectDir = path.resolve(opts.projectDir);
  const outDir = path.resolve(opts.outDir);
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
  if (found.mcpJsonPath) {
    const { redacted, hits } = await loadAndRedactJson(found.mcpJsonPath);
    mcpJsonRedacted = JSON.stringify(redacted, null, 2);
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

  const baseRun = path.join(outDir, "mova", "claude_import", "v0");
  const runBase = path.join(baseRun, "runs", runId);

  // Build contracts
  const instructionProfile = {
    kind: "instruction_profile_v0",
    profile_id: "default",
    source: {
      path: "CLAUDE.md",
      sha256: inputs.find((i) => i.rel === "CLAUDE.md")?.sha256 ?? "",
    },
    instructions_markdown_redacted: claudeMdRedacted,
  };

  const skillsCatalog = {
    kind: "skills_catalog_v0",
    skills: Object.entries(skillRedactedMap).map(([rel, body]) => ({
      skill_id: path.basename(rel, ".md"),
      title: path.basename(rel, ".md"),
      source: { path: rel, sha256: inputs.find((i) => i.rel === rel)!.sha256 },
      body_markdown_redacted: body,
    })),
  };

  const mcpServers = {
    kind: "mcp_servers_v0",
    servers: [],
  };

  if (!opts.dryRun) {
    await writeContract(baseRun, runId, "instruction_profile_v0.json", instructionProfile);
    await writeContract(baseRun, runId, "skills_catalog_v0.json", skillsCatalog);
    await writeContract(baseRun, runId, "mcp_servers_v0.json", mcpServers);
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

  // Evidence / Episode
  const evidence = new EvidenceWriter(runBase);
  const episodeWriter = new EpisodeWriter(evidence);
  const manifest = {
    tool: "mova-claude-import",
    version: "v0",
    run_id: runId,
    project_dir: projectDir,
    inputs: inputs.sort((a, b) => a.rel.localeCompare(b.rel)),
    imported: {
      claude_md: Boolean(found.claudeMdPath),
      mcp_json: Boolean(found.mcpJsonPath),
      skills_count: found.skillFiles.length,
    },
    skipped: found.skipped,
  };
  const redactionReport = {
    hits: redactionHits,
    note: "Only presence/len recorded, values omitted.",
  };

  const episode = {
    episode_id: crypto.randomUUID(),
    recorded_at: new Date().toISOString(),
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
    await fs.mkdir(runBase, { recursive: true });
    await evidence.writeArtifact(runBase, "import_manifest.json", manifest);
    await evidence.writeArtifact(runBase, "redaction_report.json", redactionReport);
    await episodeWriter.writeExecutionEpisode(`claude_import_${runId}`, runId, episode);
    // latest pointer
    await fs.mkdir(path.join(baseRun, "runs"), { recursive: true });
    await fs.writeFile(
      path.join(baseRun, "runs", "latest.json"),
      JSON.stringify({ run_id: runId }, null, 2) + "\n",
      "utf8"
    );
  }

  return {
    ok: true,
    run_id: runId,
    out_dir: runBase,
    imported: manifest.imported,
    skipped: found.skipped,
  };
}
