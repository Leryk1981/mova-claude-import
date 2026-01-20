import fs from "node:fs/promises";
import path from "node:path";
import { getAnthropicProfileV0Files } from "./anthropic_profile_v0.js";
import { stableStringify } from "./stable_json.js";
import { createExportZipV0 } from "./export_zip_v0.js";
import { writeCleanClaudeProfileScaffoldV0 } from "./claude_profile_scaffold_v0.js";
import { defaultControlV0, type ControlV0 } from "./control_v0.js";

type InitResult = {
  createdFiles: string[];
  zipRelPath?: string;
  zipSha256?: string;
};

type InitOptions = {
  controlOverride?: ControlV0;
  assetsRoot?: string;
};

async function writeTextFile(absPath: string, content: string) {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, "utf8");
}

async function writeJsonFile(absPath: string, obj: any) {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, stableStringify(obj) + "\n", "utf8");
}

async function copyPresetAssets(control: ControlV0, assetsRoot: string, outRoot: string): Promise<string[]> {
  const created: string[] = [];
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
    const sourceRel = asset.source_path ?? asset.path;
    const source = path.isAbsolute(sourceRel) ? sourceRel : path.join(assetsRoot, sourceRel);
    const target = path.join(outRoot, asset.path);
    try {
      await fs.stat(source);
    } catch {
      continue;
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    if (source !== target) {
      await fs.copyFile(source, target);
    }
    created.push(asset.path.replace(/\\/g, "/"));
  }
  return created.sort();
}

export async function initProfileV0(outRoot: string, emitZip: boolean, options?: InitOptions): Promise<InitResult> {
  const createdFiles: string[] = [];
  await writeCleanClaudeProfileScaffoldV0(outRoot);
  const profileFiles = getAnthropicProfileV0Files();
  for (const [rel, content] of Object.entries(profileFiles)) {
    if (rel === "CLAUDE.md" || rel === ".claude/settings.json") continue;
    await writeTextFile(path.join(outRoot, rel), content);
    createdFiles.push(rel);
  }

  const controlRel = path.join("mova", "control_v0.json").replace(/\\/g, "/");
  const control = options?.controlOverride ?? defaultControlV0();
  await writeJsonFile(path.join(outRoot, controlRel), control);
  createdFiles.push(controlRel);

  if (options?.assetsRoot) {
    const assetFiles = await copyPresetAssets(control, options.assetsRoot, outRoot);
    createdFiles.push(...assetFiles);
  }

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
