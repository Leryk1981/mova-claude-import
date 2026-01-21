import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stableStringify } from "./stable_json.js";
import { MOVA_CONTROL_ENTRY_MARKER } from "./mova_overlay_v0.js";

type ScaffoldFile = { rel: string; content: string };

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function writeFile(absPath: string, content: string) {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, "utf8");
}

async function loadPackageFile(rel: string): Promise<string | null> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = path.resolve(here, "..");
  const abs = path.join(pkgRoot, rel);
  try {
    return await fs.readFile(abs, "utf8");
  } catch {
    return null;
  }
}

async function scaffoldFiles(): Promise<ScaffoldFile[]> {
  const settings = {
    includeCoAuthoredBy: true,
    permissions: {
      allow: [],
      deny: [],
      defaultMode: "ask",
    },
    hooks: {
      PreToolUse: [],
      PostToolUse: [],
      UserPromptSubmit: [],
      Stop: [],
    },
  };

  const files: ScaffoldFile[] = [
    {
      rel: "CLAUDE.md",
      content: [
        MOVA_CONTROL_ENTRY_MARKER,
        "## MOVA Control Entry (v0)",
        "",
        "This is the canonical control entry marker for Claude Code.",
        "",
      ].join("\n"),
    },
    {
      rel: ".claude/settings.json",
      content: stableStringify(settings) + "\n",
    },
    {
      rel: ".claude/settings.local.example.json",
      content: stableStringify({
        note: "Local settings are not committed; use this as a template.",
      }) + "\n",
    },
    {
      rel: ".claude/commands/example_command.md",
      content: ["# example_command", "", "Write a brief project summary.", ""].join("\n"),
    },
    {
      rel: ".claude/agents/example_agent.md",
      content: ["# example_agent", "", "Role: reviewer", ""].join("\n"),
    },
    {
      rel: ".claude/output-styles/example_style.md",
      content: ["# example_style", "", "Style: concise, bullet-first.", ""].join("\n"),
    },
    {
      rel: ".mcp.json",
      content: stableStringify({ mcpServers: {} }) + "\n",
    },
    {
      rel: "MOVA.md",
      content: ["# MOVA", "", "Notes and operator instructions.", ""].join("\n"),
    },
  ];

  const serviceFiles = [
    "services/env_resolver.js",
    "services/preset_manager.js",
    "services/episode_metrics_collector.js",
    "services/dashboard_server.js",
    "services/hot_reloader.js",
  ];
  for (const rel of serviceFiles) {
    const content = await loadPackageFile(rel);
    if (content) files.push({ rel, content });
  }

  const presetFiles = [
    ".claude/presets/base.preset_v0.json",
    ".claude/presets/development.preset_v0.json",
    ".claude/presets/production.preset_v0.json",
  ];
  for (const rel of presetFiles) {
    const content = await loadPackageFile(rel);
    if (content) files.push({ rel, content });
  }

  const hookFiles = [
    ".claude/hooks/example_hook.js",
    ".claude/hooks/mova-guard.js",
    ".claude/hooks/mova-observe.js",
    ".claude/hooks/skill-eval.js",
    ".claude/hooks/skill-rules.json",
  ];
  for (const rel of hookFiles) {
    const content = await loadPackageFile(rel);
    if (content) files.push({ rel, content });
  }

  const manifestContent = await loadPackageFile("mova/version_manifest_v0.json");
  if (manifestContent) files.push({ rel: "mova/version_manifest_v0.json", content: manifestContent });

  return files;
}

export async function writeCleanClaudeProfileScaffoldV0(outDir: string) {
  const files = await scaffoldFiles();
  for (const f of files) {
    await writeFile(path.join(outDir, f.rel), f.content);
  }
}

export async function ensureClaudeControlSurfacesV0(projectDir: string) {
  const files = await scaffoldFiles();
  for (const f of files) {
    const abs = path.join(projectDir, f.rel);
    if (!(await exists(abs))) {
      await writeFile(abs, f.content);
    }
  }
}
