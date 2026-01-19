import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

type ControlContractsV0 = {
  claude_control_profile: any;
  claude_control_mapping: any;
  claude_control_vocab: any;
  claude_control_precedence: any;
};

async function loadJson(relPath: string) {
  const url = new URL(`../${relPath}`, import.meta.url);
  const abs = fileURLToPath(url);
  const raw = await fs.readFile(abs, "utf8");
  return JSON.parse(raw);
}

export async function loadControlContractsV0(): Promise<ControlContractsV0> {
  const base = "schemas/claude_control/v0";
  return {
    claude_control_profile: await loadJson(`${base}/ds/ds.claude_control_profile_v0.json`),
    claude_control_mapping: await loadJson(`${base}/ds/ds.claude_control_mapping_v0.json`),
    claude_control_vocab: await loadJson(`${base}/global/global.claude_control_vocab_v0.json`),
    claude_control_precedence: await loadJson(`${base}/global/global.claude_control_precedence_v0.json`),
  };
}
