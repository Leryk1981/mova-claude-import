import fs from "node:fs/promises";
import path from "node:path";
import { anthropicProfileV0RequiredFiles } from "./anthropic_profile_v0.js";
import { stableStringify } from "./stable_json.js";

export type LintIssue = {
  code: string;
  message: string;
  path?: string;
};

export type LintReportV0 = {
  profile_version: "v0";
  ok: boolean;
  issues: LintIssue[];
  summary: string;
};

type LintOptions = {
  outRoot: string;
  emitProfile: boolean;
  mcpExpected: boolean;
};

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function listFilesRec(dir: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop()!;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(current, e.name);
      if (e.isDirectory()) stack.push(abs);
      else if (e.isFile()) out.push(abs);
    }
  }
  return out;
}

function extractFrontmatterName(body: string): string | null {
  const match = body.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) return null;
  const lines = match[1].split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^name:\s*(.+)\s*$/);
    if (m) return m[1].trim();
  }
  return null;
}

export async function lintV0(opts: LintOptions): Promise<LintReportV0> {
  const issues: LintIssue[] = [];
  const required = [
    ...(opts.emitProfile ? anthropicProfileV0RequiredFiles : []),
    "mova/claude_import/v0/import_manifest.json",
    "mova/claude_import/v0/redaction_report.json",
    "mova/claude_import/v0/contracts/instruction_profile_v0.json",
    "mova/claude_import/v0/contracts/skills_catalog_v0.json",
    "mova/claude_import/v0/contracts/mcp_servers_v0.json",
    "mova/claude_import/v0/episode_import_run.json",
  ];

  if (opts.mcpExpected && opts.emitProfile) {
    required.push(".mcp.json");
  }

  for (const rel of required) {
    const abs = path.join(opts.outRoot, rel);
    if (!(await exists(abs))) {
      issues.push({ code: "missing_file", message: "Required file is missing.", path: rel });
    }
  }

  const settingsLocal = path.join(opts.outRoot, ".claude", "settings.local.json");
  if (await exists(settingsLocal)) {
    issues.push({ code: "settings_local_present", message: "settings.local.json must not be written.", path: ".claude/settings.local.json" });
  }

  const skillsRoot = path.join(opts.outRoot, ".claude", "skills");
  if (await exists(skillsRoot)) {
    const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(skillsRoot, e.name);
      if (e.isFile()) {
        issues.push({ code: "skill_root_file", message: "Files are not allowed directly under .claude/skills.", path: `.claude/skills/${e.name}` });
        continue;
      }
      if (e.isDirectory()) {
        const skillMd = path.join(abs, "SKILL.md");
        if (!(await exists(skillMd))) {
          issues.push({ code: "missing_skill_md", message: "Skill directory is missing SKILL.md.", path: `.claude/skills/${e.name}/SKILL.md` });
        }
      }
    }
  }

  const skillNameCounts = new Map<string, number>();
  if (await exists(skillsRoot)) {
    const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const skillMd = path.join(skillsRoot, e.name, "SKILL.md");
      if (!(await exists(skillMd))) continue;
      const body = await fs.readFile(skillMd, "utf8");
      const name = extractFrontmatterName(body);
      if (!name) continue;
      skillNameCounts.set(name, (skillNameCounts.get(name) ?? 0) + 1);
    }
  }
  for (const [name, count] of skillNameCounts.entries()) {
    if (count > 1) {
      issues.push({ code: "duplicate_skill_name", message: `Duplicate skill name in frontmatter: ${name}`, path: ".claude/skills" });
    }
  }

  const jsonFiles = (await exists(opts.outRoot)) ? (await listFilesRec(opts.outRoot)).filter((p) => p.toLowerCase().endsWith(".json")) : [];
  for (const abs of jsonFiles) {
    if (abs.endsWith(`${path.sep}lint_report_v0.json`)) continue;
    const rel = path.relative(opts.outRoot, abs).replace(/\\/g, "/");
    const raw = await fs.readFile(abs, "utf8");
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      issues.push({ code: "invalid_json", message: "JSON file failed to parse.", path: rel });
      continue;
    }
    const normalized = stableStringify(parsed) + "\n";
    if (raw !== normalized) {
      issues.push({ code: "json_not_normalized", message: "JSON file is not normalized (sorted keys, 2 spaces, newline).", path: rel });
    }
  }

  const ok = issues.length === 0;
  const summary = ok ? "lint_v0: ok" : `lint_v0: ${issues.length} issue(s)`;
  return {
    profile_version: "v0",
    ok,
    issues,
    summary,
  };
}
