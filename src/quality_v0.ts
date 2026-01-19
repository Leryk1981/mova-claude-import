import fs from "node:fs/promises";
import path from "node:path";
import { runImport } from "./run_import.js";
import { stableStringify } from "./stable_json.js";

type QualityCaseReport = {
  profile_version: "v0";
  suite: "pos" | "neg";
  case_id: string;
  run_id: string;
  ok: boolean;
  failures: string[];
  checks: {
    lint_ok: boolean;
    redaction_hits: number;
    settings_local_input: boolean;
    skill_structure_ok: boolean;
    skill_structure_issues: string[];
    export_manifest_present: boolean;
    zip_present: boolean;
    export_files_count_match: boolean;
  };
};

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p: string): Promise<any> {
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

async function writeJson(p: string, obj: any) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, stableStringify(obj) + "\n", "utf8");
}

async function checkSkillStructure(projectDir: string): Promise<{ ok: boolean; issues: string[] }> {
  const issues: string[] = [];
  const skillsRoot = path.join(projectDir, ".claude", "skills");
  if (!(await exists(skillsRoot))) return { ok: true, issues };
  const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  for (const entry of entries) {
    const rel = `.claude/skills/${entry.name}`;
    if (entry.isFile()) {
      issues.push(`skill_root_file:${rel}`);
      continue;
    }
    if (entry.isDirectory()) {
      const skillMd = path.join(skillsRoot, entry.name, "SKILL.md");
      if (!(await exists(skillMd))) {
        issues.push(`missing_skill_md:${rel}/SKILL.md`);
      }
    }
  }
  return { ok: issues.length === 0, issues };
}

async function runCase(suite: "pos" | "neg", caseId: string, fixturesRoot: string) {
  const repoRoot = process.cwd();
  const projectDir = path.join(fixturesRoot, caseId);
  const outRoot = path.join(repoRoot, ".tmp_test", "quality", suite, caseId, "out");
  await fs.rm(outRoot, { recursive: true, force: true });
  await fs.mkdir(outRoot, { recursive: true });

  const result = await runImport({
    projectDir,
    outDir: outRoot,
    includeLocal: false,
    includeUserSettings: false,
    dryRun: false,
    strict: false,
    emitProfile: true,
    emitOverlay: true,
    emitZip: true,
    zipName: "export.zip",
  });

  const movaBase = path.join(outRoot, "mova", "claude_import", "v0");
  const manifestPath = path.join(movaBase, "import_manifest.json");
  const lintPath = path.join(movaBase, "lint_report_v0.json");
  const redactionPath = path.join(movaBase, "redaction_report.json");
  const exportManifestPath = path.join(movaBase, "export_manifest_v0.json");

  const failures: string[] = [];

  const lintReport = await readJson(lintPath);
  const redactionReport = await readJson(redactionPath);
  const exportManifestExists = await exists(exportManifestPath);
  const exportManifest = exportManifestExists ? await readJson(exportManifestPath) : null;

  const settingsLocalInput = await exists(path.join(projectDir, ".claude", "settings.local.json"));
  const skillStructure = await checkSkillStructure(projectDir);

  const zipRelPath = exportManifest?.zip_rel_path;
  const zipPresent = typeof zipRelPath === "string" && (await exists(path.join(outRoot, zipRelPath)));
  const exportFilesCountMatch =
    typeof exportManifest?.files_count === "number" &&
    Array.isArray(exportManifest?.files) &&
    exportManifest.files_count === exportManifest.files.length;

  if (!(await exists(manifestPath))) failures.push("missing_import_manifest");
  if (!lintReport?.ok) failures.push("lint_not_ok");
  if (Array.isArray(redactionReport?.hits) && redactionReport.hits.length > 0) failures.push("redaction_hits_present");
  if (settingsLocalInput) failures.push("settings_local_input_present");
  if (!skillStructure.ok) failures.push("skill_structure_invalid");
  if (!exportManifestExists) failures.push("missing_export_manifest");
  if (!zipPresent) failures.push("zip_missing");
  if (!exportFilesCountMatch) failures.push("export_files_count_mismatch");

  const ok = failures.length === 0;
  const report: QualityCaseReport = {
    profile_version: "v0",
    suite,
    case_id: caseId,
    run_id: result.run_id,
    ok,
    failures,
    checks: {
      lint_ok: Boolean(lintReport?.ok),
      redaction_hits: Array.isArray(redactionReport?.hits) ? redactionReport.hits.length : 0,
      settings_local_input: settingsLocalInput,
      skill_structure_ok: skillStructure.ok,
      skill_structure_issues: skillStructure.issues,
      export_manifest_present: exportManifestExists,
      zip_present: zipPresent,
      export_files_count_match: exportFilesCountMatch,
    },
  };

  const reportPath = path.join(repoRoot, "artifacts", "quality_v0", result.run_id, "quality_report_v0.json");
  await writeJson(reportPath, report);

  return report;
}

async function main() {
  const suiteArg = getArg("--suite") ?? "pos";
  if (suiteArg !== "pos" && suiteArg !== "neg") {
    console.error(`Unknown suite: ${suiteArg}`);
    process.exit(2);
  }
  const suite = suiteArg as "pos" | "neg";
  const fixturesRoot = path.join(process.cwd(), "fixtures", suite);
  const entries = await fs.readdir(fixturesRoot, { withFileTypes: true });
  const cases = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  if (!cases.length) {
    console.error(`No fixtures found in ${fixturesRoot}`);
    process.exit(2);
  }

  const reports: QualityCaseReport[] = [];
  for (const caseId of cases) {
    reports.push(await runCase(suite, caseId, fixturesRoot));
  }

  const failed = reports.filter((r) => !r.ok);
  const passed = reports.filter((r) => r.ok);

  let ok = true;
  if (suite === "pos") {
    ok = failed.length === 0;
  } else {
    ok = passed.length === 0;
  }

  console.log(
    [
      `quality_v0 suite=${suite}`,
      `cases=${reports.length}`,
      `passed=${passed.length}`,
      `failed=${failed.length}`,
      `ok=${ok}`,
    ].join(" ")
  );

  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
