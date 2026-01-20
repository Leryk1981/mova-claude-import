import fs from "node:fs/promises";
import path from "node:path";
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

function scaffoldFiles(): ScaffoldFile[] {
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

  return [
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
      rel: ".claude/hooks/example_hook.js",
      content: ["#!/usr/bin/env node", "process.stdout.write(\"hook: dry check\");"].join("\n") + "\n",
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
}

export async function writeCleanClaudeProfileScaffoldV0(outDir: string) {
  const files = scaffoldFiles();
  for (const f of files) {
    await writeFile(path.join(outDir, f.rel), f.content);
  }
}

export async function ensureClaudeControlSurfacesV0(projectDir: string) {
  const files = scaffoldFiles();
  for (const f of files) {
    const abs = path.join(projectDir, f.rel);
    if (!(await exists(abs))) {
      await writeFile(abs, f.content);
    }
  }
}
