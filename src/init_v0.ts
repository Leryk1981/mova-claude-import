import fs from "node:fs/promises";
import path from "node:path";
import { getAnthropicProfileV0Files } from "./anthropic_profile_v0.js";
import { stableStringify } from "./stable_json.js";
import { createExportZipV0 } from "./export_zip_v0.js";
import { writeCleanClaudeProfileScaffoldV0 } from "./claude_profile_scaffold_v0.js";
import { defaultControlV0 } from "./control_v0.js";

type InitResult = {
  createdFiles: string[];
  zipRelPath?: string;
  zipSha256?: string;
};

async function writeTextFile(absPath: string, content: string) {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, "utf8");
}

async function writeJsonFile(absPath: string, obj: any) {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, stableStringify(obj) + "\n", "utf8");
}

export async function initProfileV0(outRoot: string, emitZip: boolean): Promise<InitResult> {
  const createdFiles: string[] = [];
  await writeCleanClaudeProfileScaffoldV0(outRoot);
  const profileFiles = getAnthropicProfileV0Files();
  for (const [rel, content] of Object.entries(profileFiles)) {
    if (rel === "CLAUDE.md" || rel === ".claude/settings.json") continue;
    await writeTextFile(path.join(outRoot, rel), content);
    createdFiles.push(rel);
  }

  const controlRel = path.join("mova", "control_v0.json").replace(/\\/g, "/");
  await writeJsonFile(path.join(outRoot, controlRel), defaultControlV0());
  createdFiles.push(controlRel);

  const movaBase = path.join(outRoot, "mova", "claude_import", "v0");
  const initManifestRel = path.join("mova", "claude_import", "v0", "init_manifest_v0.json").replace(/\\/g, "/");

  let zipRelPath: string | undefined;
  let zipSha256: string | undefined;
  if (emitZip) {
    const exportZip = await createExportZipV0(outRoot);
    zipRelPath = exportZip.zipRelPath;
    zipSha256 = exportZip.zipSha256;
  }

  const initManifest = {
    profile_version: "v0",
    created_files: createdFiles.slice().sort(),
    zip_rel_path: zipRelPath ?? null,
    zip_sha256: zipSha256 ?? null,
  };
  await writeJsonFile(path.join(outRoot, initManifestRel), initManifest);
  createdFiles.push(initManifestRel);

  return {
    createdFiles,
    zipRelPath,
    zipSha256,
  };
}
