import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type PresetInfo = {
  name: string;
  root: string;
  control_path: string;
  assets_root: string;
};

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

export function getPresetsRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgRoot = path.resolve(here, "..");
  return path.join(pkgRoot, "presets");
}

export async function listPresets(): Promise<string[]> {
  const root = getPresetsRoot();
  if (!(await exists(root))) return [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  const names: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const controlPath = path.join(root, entry.name, "control_v0.json");
    if (await exists(controlPath)) names.push(entry.name);
  }
  return names.sort();
}

export async function resolvePreset(name: string): Promise<PresetInfo | null> {
  const root = getPresetsRoot();
  const presetRoot = path.join(root, name);
  const controlPath = path.join(presetRoot, "control_v0.json");
  const assetsRoot = path.join(presetRoot, "assets");
  if (!(await exists(controlPath))) return null;
  return {
    name,
    root: presetRoot,
    control_path: controlPath,
    assets_root: assetsRoot,
  };
}

export async function readPresetControlRaw(name: string): Promise<string | null> {
  const preset = await resolvePreset(name);
  if (!preset) return null;
  return await fs.readFile(preset.control_path, "utf8");
}
