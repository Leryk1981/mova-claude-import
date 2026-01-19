import fs from "node:fs/promises";
import path from "node:path";
import { stableStringify } from "./stable_json.js";
import { loadControlContractsV0 } from "./control_contracts_v0.js";

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

  let mcpServers: any = {};
  let mcpFound = false;
  if (await exists(mcpPath)) {
    const parsed = await readJson(mcpPath);
    if (Array.isArray(parsed?.servers)) {
      mcpServers = { servers: parsed.servers };
    } else if (parsed?.servers && typeof parsed.servers === "object") {
      mcpServers = { servers: parsed.servers };
    }
    mcpFound = true;
  }

  if (template?.anthropic?.mcp) {
    template.anthropic.mcp.servers = mcpServers.servers ?? {};
  }

  const profilePath = path.join(outDir, "claude_control_profile_v0.json");
  const reportPath = path.join(outDir, "prefill_report_v0.json");

  const report = {
    profile_version: "v0",
    project_dir: projectDir,
    profile_path: profilePath,
    found: {
      mcp_json: mcpFound,
      settings_json: await exists(settingsPath),
      settings_local_json: await exists(settingsLocalPath),
    },
    applied: {
      mcp_servers: mcpFound,
    },
  };

  await writeJson(profilePath, template);
  await writeJson(reportPath, report);

  return { profile_path: profilePath, report_path: reportPath };
}
