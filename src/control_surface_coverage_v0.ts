import fs from "node:fs/promises";
import path from "node:path";
import { stableStringify } from "./stable_json.js";
import { normalizeControlV0 } from "./control_v0.js";

type CoverageExclusion = {
  pattern: string;
  reason: string;
};

type CoverageReport = {
  profile_version: "v0";
  showcase_root: string;
  control_path: string;
  total_surface_files: number;
  excluded: Array<{ pattern: string; reason: string; matches: number }>;
  covered_count: number;
  coverage_percent: number;
  missing: string[];
  covered: string[];
};

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

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
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(abs);
      else if (entry.isFile()) out.push(abs);
    }
  }
  return out;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regex = escaped.replace(/\\\*\\\*/g, ".*").replace(/\\\*/g, "[^/]*");
  return new RegExp(`^${regex}$`);
}

function applyExclusions(files: string[], exclusions: CoverageExclusion[]) {
  const excludedMatches: Array<{ pattern: string; reason: string; matches: number }> = [];
  const keep = new Set(files);
  for (const ex of exclusions) {
    const regex = globToRegex(ex.pattern);
    let matches = 0;
    for (const file of files) {
      if (regex.test(file)) {
        if (keep.delete(file)) matches++;
      }
    }
    excludedMatches.push({ pattern: ex.pattern, reason: ex.reason, matches });
  }
  return { remaining: Array.from(keep).sort(), excludedMatches };
}

async function readJson(p: string) {
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

export async function runControlSurfaceCoverageV0(params: {
  showcaseRoot: string;
  controlPath: string;
  exclusionsPath: string;
  reportPath: string;
}): Promise<CoverageReport> {
  const showcaseRoot = path.resolve(params.showcaseRoot);
  const controlPath = path.resolve(params.controlPath);
  const exclusionsPath = path.resolve(params.exclusionsPath);
  const reportPath = path.resolve(params.reportPath);

  const roots = [
    path.join(showcaseRoot, "CLAUDE.md"),
    path.join(showcaseRoot, ".mcp.json"),
    path.join(showcaseRoot, ".claude"),
    path.join(showcaseRoot, ".github", "workflows"),
  ];

  const surfaceFiles: string[] = [];
  for (const root of roots) {
    if (!(await exists(root))) continue;
    const stat = await fs.stat(root);
    if (stat.isFile()) {
      surfaceFiles.push(root);
    } else if (stat.isDirectory()) {
      const files = await listFilesRec(root);
      surfaceFiles.push(...files);
    }
  }

  const surfaceRel = surfaceFiles.map((p) => toPosix(path.relative(showcaseRoot, p))).sort();

  const controlRaw = await readJson(controlPath);
  const control = normalizeControlV0(controlRaw).control;

  const covered = new Set<string>([
    "CLAUDE.md",
    ".mcp.json",
    ".claude/settings.json",
  ]);

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
    covered.add(toPosix(asset.path));
  }

  if (control.lsp.managed) {
    covered.add(toPosix(control.lsp.config_path));
  }

  const exclusions = (await readJson(exclusionsPath))?.exclusions ?? [];
  const { remaining, excludedMatches } = applyExclusions(surfaceRel, exclusions);

  const missing = remaining.filter((p) => !covered.has(p));
  const coveredList = remaining.filter((p) => covered.has(p));

  const total = remaining.length;
  const coveredCount = coveredList.length;
  const coveragePercent = total === 0 ? 100 : Math.round((coveredCount / total) * 100);

  const report: CoverageReport = {
    profile_version: "v0",
    showcase_root: showcaseRoot,
    control_path: controlPath,
    total_surface_files: total,
    excluded: excludedMatches,
    covered_count: coveredCount,
    coverage_percent: coveragePercent,
    missing,
    covered: coveredList,
  };

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, stableStringify(report) + "\n", "utf8");

  return report;
}
