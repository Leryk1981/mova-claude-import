import fs from "node:fs/promises";
import path from "node:path";
import { stableStringify } from "./stable_json.js";
import { loadControlContractsV0 } from "./control_contracts_v0.js";
import { controlFromSettingsV0, normalizeControlV0 } from "./control_v0.js";

type PrefillResult = {
  profile_path: string;
  report_path: string;
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

async function readJson(p: string) {
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

async function writeJson(p: string, obj: any) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, stableStringify(obj) + "\n", "utf8");
}

export async function controlPrefillV0(projectDir: string, outDir: string): Promise<PrefillResult> {
  const contracts = await loadControlContractsV0();
  const template = JSON.parse(JSON.stringify(contracts.claude_control_profile));
  const mcpPath = path.join(projectDir, ".mcp.json");
  const settingsPath = path.join(projectDir, ".claude", "settings.json");
  const settingsLocalPath = path.join(projectDir, ".claude", "settings.local.json");

  let mcpParsed: any | undefined;
  let mcpFound = false;
  if (await exists(mcpPath)) {
    mcpParsed = await readJson(mcpPath);
    mcpFound = true;
  }

  if (template?.anthropic?.mcp) {
    const servers = mcpParsed?.mcpServers ?? mcpParsed?.servers ?? {};
    template.anthropic.mcp.servers = servers;
  }

  let settingsParsed: any | undefined;
  if (await exists(settingsPath)) {
    settingsParsed = await readJson(settingsPath);
  }

  const controlDerived = controlFromSettingsV0(settingsParsed, mcpParsed);
  const control = normalizeControlV0(controlDerived.control).control;

  const skills: Array<{ path: string; mode: "copy_through"; source_path: string }> = [];
  const skillsRoot = path.join(projectDir, ".claude", "skills");
  if (await exists(skillsRoot)) {
    const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const rel = `.claude/skills/${entry.name}/SKILL.md`;
      const abs = path.join(skillsRoot, entry.name, "SKILL.md");
      if (await exists(abs)) {
        skills.push({ path: rel, mode: "copy_through", source_path: rel });
      }
    }
  }

  const assetDirs = [
    { key: "agents", root: path.join(projectDir, ".claude", "agents"), prefix: ".claude/agents" },
    { key: "commands", root: path.join(projectDir, ".claude", "commands"), prefix: ".claude/commands" },
    { key: "rules", root: path.join(projectDir, ".claude", "rules"), prefix: ".claude/rules" },
    { key: "hooks", root: path.join(projectDir, ".claude", "hooks"), prefix: ".claude/hooks" },
  ] as const;

  const assetMap: Record<string, Array<{ path: string; mode: "copy_through"; source_path: string }>> = {
    agents: [],
    commands: [],
    rules: [],
    hooks: [],
    workflows: [],
    docs: [],
    dotfiles: [],
    schemas: [],
  };

  for (const dir of assetDirs) {
    if (!(await exists(dir.root))) continue;
    const files = await listFilesRec(dir.root);
    for (const abs of files) {
      const rel = path.relative(projectDir, abs).replace(/\\/g, "/");
      assetMap[dir.key].push({ path: rel, mode: "copy_through", source_path: rel });
    }
  }

  const docsCandidates = [
    path.join(projectDir, ".claude", "settings.md"),
    path.join(projectDir, ".claude", "skills", "README.md"),
  ];
  for (const abs of docsCandidates) {
    if (await exists(abs)) {
      const rel = path.relative(projectDir, abs).replace(/\\/g, "/");
      assetMap.docs.push({ path: rel, mode: "copy_through", source_path: rel });
    }
  }

  const dotfileCandidates = [path.join(projectDir, ".claude", ".gitignore")];
  for (const abs of dotfileCandidates) {
    if (await exists(abs)) {
      const rel = path.relative(projectDir, abs).replace(/\\/g, "/");
      assetMap.dotfiles.push({ path: rel, mode: "copy_through", source_path: rel });
    }
  }

  const schemasRoot = path.join(projectDir, ".claude");
  if (await exists(schemasRoot)) {
    const files = await listFilesRec(schemasRoot);
    for (const abs of files) {
      if (!abs.endsWith(".schema.json")) continue;
      const rel = path.relative(projectDir, abs).replace(/\\/g, "/");
      assetMap.schemas.push({ path: rel, mode: "copy_through", source_path: rel });
    }
  }

  const workflowsRoot = path.join(projectDir, ".github", "workflows");
  if (await exists(workflowsRoot)) {
    const files = await listFilesRec(workflowsRoot);
    for (const abs of files) {
      const rel = path.relative(projectDir, abs).replace(/\\/g, "/");
      assetMap.workflows.push({ path: rel, mode: "copy_through", source_path: rel });
    }
  }

  control.assets.skills = skills.sort((a, b) => a.path.localeCompare(b.path));
  control.assets.agents = assetMap.agents.sort((a, b) => a.path.localeCompare(b.path));
  control.assets.commands = assetMap.commands.sort((a, b) => a.path.localeCompare(b.path));
  control.assets.rules = assetMap.rules.sort((a, b) => a.path.localeCompare(b.path));
  control.assets.hooks = assetMap.hooks.sort((a, b) => a.path.localeCompare(b.path));
  control.assets.workflows = assetMap.workflows.sort((a, b) => a.path.localeCompare(b.path));
  control.assets.docs = assetMap.docs.sort((a, b) => a.path.localeCompare(b.path));
  control.assets.dotfiles = assetMap.dotfiles.sort((a, b) => a.path.localeCompare(b.path));
  control.assets.schemas = assetMap.schemas.sort((a, b) => a.path.localeCompare(b.path));

  const hasSkillEval = control.assets.hooks.some((h) => h.path.endsWith("skill-eval.sh") || h.path.endsWith("skill-eval.js"));
  if (hasSkillEval) {
    control.skill_eval.enable = true;
  }

  const profilePath = path.join(outDir, "claude_control_profile_v0.json");
  const reportPath = path.join(outDir, "prefill_report_v0.json");
  const controlPath = path.join(outDir, "mova", "control_v0.json");

  const report = {
    profile_version: "v0",
    project_dir: projectDir,
    profile_path: profilePath,
    control_path: controlPath,
    found: {
      mcp_json: mcpFound,
      settings_json: await exists(settingsPath),
      settings_local_json: await exists(settingsLocalPath),
    },
    applied: {
      mcp_servers: mcpFound,
      assets: {
        skills: control.assets.skills.length,
        agents: control.assets.agents.length,
        commands: control.assets.commands.length,
        rules: control.assets.rules.length,
        hooks: control.assets.hooks.length,
        workflows: control.assets.workflows.length,
        docs: control.assets.docs.length,
        dotfiles: control.assets.dotfiles.length,
        schemas: control.assets.schemas.length,
      },
    },
  };

  await writeJson(profilePath, template);
  await writeJson(controlPath, control);
  await writeJson(reportPath, report);

  return { profile_path: profilePath, report_path: reportPath };
}
