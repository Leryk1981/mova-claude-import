import { runImport } from "./run_import.js";
import { initProfileV0 } from "./init_v0.js";
import { controlPrefillV0 } from "./control_prefill_v0.js";
import { controlCheckV0 } from "./control_check_v0.js";
import { controlApplyV0 } from "./control_apply_v0.js";
import { listObservabilityRuns, readObservabilitySummary, tailObservabilityEvents } from "./observe_v0.js";
import { listPresets, readPresetControlRaw, resolvePreset } from "./presets_v0.js";

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
    "  mova-claude-import init --out <dir> [--zip] [--preset <name>]",
    "  mova-claude-import control prefill --project <dir> --out <dir> [--include-local]",
    "  mova-claude-import control check --project <dir> --profile <file>",
    "  mova-claude-import control apply --project <dir> --profile <file> [--mode preview|apply|overlay] [--preset <name>]",
    "  mova-claude-import preset list",
    "  mova-claude-import preset show <name>",
    "  mova-claude-import observe list --project <dir>",
    "  mova-claude-import observe tail --project <dir> --run <id> [--limit <n>]",
    "  mova-claude-import observe summary --project <dir> --run <id>",
    "",
    "Notes:",
    "  - CLAUDE.local.md and *.local.* are excluded unless --include-local",
    "  - user-level settings are excluded unless --include-user-settings",
    "  - profile emission is enabled by default; use --no-emit-profile to skip",
    "  - overlay emission is enabled by default; use --no-emit-overlay to skip",
    "  - zip export is disabled by default; use --zip to enable",
    "  - init creates a clean Anthropic profile v0 scaffold",
    "  - init --preset uses preset control_v0.json + assets",
    "  - control commands run in preview by default",
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
  const presetName = getArg("--preset");
  if (presetName) {
    resolvePreset(presetName)
      .then(async (preset) => {
        if (!preset) {
          console.error(`Preset not found: ${presetName}`);
          process.exit(2);
        }
        const raw = await readPresetControlRaw(presetName);
        const control = raw ? JSON.parse(raw) : null;
        if (!control) {
          console.error(`Preset control missing: ${presetName}`);
          process.exit(2);
        }
        return initProfileV0(out, emitZip, { controlOverride: control, assetsRoot: preset.assets_root });
      })
      .then((res) => {
        process.stdout.write(JSON.stringify(res, null, 2) + "\n");
        process.exit(0);
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else {
    initProfileV0(out, emitZip)
      .then((res) => {
        process.stdout.write(JSON.stringify(res, null, 2) + "\n");
        process.exit(0);
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  }
} else if (subcommand === "control") {
  const action = process.argv[3];
  const project = getArg("--project");
  if (!project) {
    usage(2);
    process.exit(2);
  }
  if (action === "prefill") {
    const out = getArg("--out");
    if (!out) {
      usage(2);
      process.exit(2);
    }
    controlPrefillV0(project, out)
      .then((res) => {
        console.log([
          "control prefill: ok",
          `profile: ${res.profile_path}`,
          `report: ${res.report_path}`,
        ].join("\n"));
        process.exit(0);
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else if (action === "check") {
    const profile = getArg("--profile");
    if (!profile) {
      usage(2);
      process.exit(2);
    }
    const out = getArg("--out") || project;
    controlCheckV0(project, profile, out)
      .then((res) => {
        console.log([
          res.exit_code && res.exit_code !== 0 ? "control check: issues" : "control check: ok",
          `plan: ${res.plan_path}`,
          `summary: ${res.summary_path}`,
          res.exit_code ? `exit_code: ${res.exit_code}` : null,
        ].filter(Boolean).join("\n"));
        if (typeof res.exit_code === "number") process.exit(res.exit_code);
        process.exit(0);
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else if (action === "apply") {
    const out = getArg("--out") || project;
    const mode = getArg("--mode");
    const presetName = getArg("--preset");
    if (presetName) {
      resolvePreset(presetName)
        .then(async (preset) => {
          if (!preset) {
            console.error(`Preset not found: ${presetName}`);
            process.exit(2);
          }
          return controlApplyV0(project, preset.control_path, out, mode, {
            assetSourceRoot: preset.assets_root,
          });
        })
        .then((res) => {
          console.log([
            res.exit_code && res.exit_code !== 0 ? "control apply: issues" : "control apply: ok",
            `report: ${res.report_path}`,
            res.exit_code ? `exit_code: ${res.exit_code}` : null,
          ].filter(Boolean).join("\n"));
          if (typeof res.exit_code === "number") process.exit(res.exit_code);
          process.exit(0);
        })
        .catch((err) => {
          console.error(err);
          process.exit(1);
        });
    } else {
      const profile = getArg("--profile");
      if (!profile) {
        usage(2);
        process.exit(2);
      }
      controlApplyV0(project, profile, out, mode)
        .then((res) => {
          console.log([
            res.exit_code && res.exit_code !== 0 ? "control apply: issues" : "control apply: ok",
            `report: ${res.report_path}`,
            res.exit_code ? `exit_code: ${res.exit_code}` : null,
          ].filter(Boolean).join("\n"));
          if (typeof res.exit_code === "number") process.exit(res.exit_code);
          process.exit(0);
        })
        .catch((err) => {
          console.error(err);
          process.exit(1);
        });
    }
  } else {
    usage(2);
    process.exit(2);
  }
} else if (subcommand === "preset") {
  const action = process.argv[3];
  if (action === "list") {
    listPresets()
      .then((presets) => {
        for (const name of presets) {
          console.log(name);
        }
        process.exit(0);
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else if (action === "show") {
    const name = process.argv[4];
    if (!name) {
      usage(2);
      process.exit(2);
    }
    readPresetControlRaw(name)
      .then((raw) => {
        if (!raw) {
          console.error(`Preset not found: ${name}`);
          process.exit(2);
        }
        process.stdout.write(raw + "\n");
        process.exit(0);
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else {
    usage(2);
    process.exit(2);
  }
} else if (subcommand === "observe") {
  const action = process.argv[3];
  const project = getArg("--project");
  if (!project) {
    usage(2);
    process.exit(2);
  }
  if (action === "list") {
    listObservabilityRuns(project)
      .then((runs) => {
        if (!runs.length) {
          console.log("observe list: no runs");
          process.exit(0);
        }
        for (const run of runs) {
          console.log(JSON.stringify(run));
        }
        process.exit(0);
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else if (action === "tail") {
    const runId = getArg("--run");
    if (!runId) {
      usage(2);
      process.exit(2);
    }
    const limitRaw = getArg("--limit");
    const limit = limitRaw ? Number(limitRaw) : 20;
    tailObservabilityEvents(project, runId, Number.isFinite(limit) ? limit : 20)
      .then((lines) => {
        if (!lines.length) {
          console.log("observe tail: no events");
          process.exit(0);
        }
        for (const line of lines) {
          console.log(line);
        }
        process.exit(0);
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else if (action === "summary") {
    const runId = getArg("--run");
    if (!runId) {
      usage(2);
      process.exit(2);
    }
    readObservabilitySummary(project, runId)
      .then((summary) => {
        if (!summary) {
          console.log("observe summary: not found");
          process.exit(0);
        }
        process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
        process.exit(0);
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else {
    usage(2);
    process.exit(2);
  }
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
    if (typeof res.exit_code === "number") process.exit(res.exit_code);
    process.exit(res.ok ? 0 : 1);
  });
}
