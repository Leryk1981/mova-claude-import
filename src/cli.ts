import { runImport } from "./run_import.js";
import { initProfileV0 } from "./init_v0.js";

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}
function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}
function usage(exitCode = 0) {
  console.log([
    "mova-claude-import (v0)",
    "",
    "Usage:",
    "  mova-claude-import --project <dir> [--out <dir>] [--dry-run] [--strict] [--include-local] [--include-user-settings] [--no-emit-profile] [--no-emit-overlay] [--zip] [--zip-name <name>]",
    "  mova-claude-import init --out <dir> [--zip]",
    "",
    "Notes:",
    "  - CLAUDE.local.md and *.local.* are excluded unless --include-local",
    "  - user-level settings are excluded unless --include-user-settings",
    "  - profile emission is enabled by default; use --no-emit-profile to skip",
    "  - overlay emission is enabled by default; use --no-emit-overlay to skip",
    "  - zip export is disabled by default; use --zip to enable",
    "  - init creates a clean Anthropic profile v0 scaffold",
  ].join("\n"));
  process.exit(exitCode);
}

if (hasFlag("--help") || hasFlag("-h")) usage(0);
if (hasFlag("--version") || hasFlag("-v")) {
  console.log("0.0.0");
  process.exit(0);
}

const subcommand = process.argv[2];
if (subcommand === "init") {
  const out = getArg("--out");
  if (!out) {
    usage(2);
    process.exit(2);
  }
  const emitZip = hasFlag("--zip");
  initProfileV0(out, emitZip)
    .then((res) => {
      process.stdout.write(JSON.stringify(res, null, 2) + "\n");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else {
  const project = getArg("--project");
  if (!project) {
    usage(2);
    process.exit(2);
  }

  const out = getArg("--out") || project;
  const emitProfile = !hasFlag("--no-emit-profile");
  const emitOverlay = !hasFlag("--no-emit-overlay");
  const emitZip = hasFlag("--zip");
  const zipName = getArg("--zip-name");

  runImport({
    projectDir: project,
    outDir: out,
    includeLocal: hasFlag("--include-local"),
    includeUserSettings: hasFlag("--include-user-settings"),
    dryRun: hasFlag("--dry-run"),
    strict: hasFlag("--strict"),
    emitProfile,
    emitOverlay,
    emitZip,
    zipName,
  }).then((res) => {
    process.stdout.write(JSON.stringify(res, null, 2) + "\n");
    process.exit(res.ok ? 0 : 1);
  });
}
