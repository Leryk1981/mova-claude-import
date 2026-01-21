#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { resolveEnvironmentConfig } from "./env_resolver.js";

const PRESET_DIR = path.resolve(".claude", "presets");
const CONTROL_FILE = path.resolve("mova", "control_v0.json");

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function mergeArrays(base, incoming) {
  if (!isObject(incoming) || !incoming.$mode) return incoming;
  const items = Array.isArray(incoming.items) ? incoming.items : [];
  if (incoming.$mode === "append") return [...(base ?? []), ...items];
  if (incoming.$mode === "union") {
    const seen = new Set((base ?? []).map((item) => JSON.stringify(item)));
    const merged = [...(base ?? [])];
    for (const item of items) {
      const key = JSON.stringify(item);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
    return merged;
  }
  if (incoming.$mode === "replace") return items;
  return items;
}

function mergeValues(base, incoming) {
  if (Array.isArray(base) || Array.isArray(incoming)) {
    return mergeArrays(base, incoming);
  }
  if (isObject(base) && isObject(incoming)) {
    const out = { ...base };
    for (const [key, value] of Object.entries(incoming)) {
      out[key] = mergeValues(out[key], value);
    }
    return out;
  }
  return incoming;
}

export async function loadPreset(name) {
  const filePath = path.join(PRESET_DIR, `${name}.preset_v0.json`);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function resolvePreset(name, stack = []) {
  if (stack.includes(name)) {
    throw new Error(`Preset inheritance cycle: ${[...stack, name].join(" -> ")}`);
  }
  const preset = await loadPreset(name);
  let resolved = preset;
  if (preset.$inherit) {
    const base = await resolvePreset(preset.$inherit, [...stack, name]);
    const { $inherit, ...rest } = preset;
    resolved = mergeValues(base, rest);
  }
  return resolved;
}

export async function listPresets() {
  const entries = await fs.readdir(PRESET_DIR);
  return entries.filter((name) => name.endsWith(".preset_v0.json")).map((name) => name.replace(".preset_v0.json", ""));
}

export async function validatePreset(preset) {
  if (!isObject(preset)) throw new Error("Preset must be an object");
  if (preset.$inherit && typeof preset.$inherit !== "string") throw new Error("$inherit must be a string");
  if (preset.description && typeof preset.description !== "string") throw new Error("description must be a string");
  return true;
}

export async function applyPreset(name, options = {}) {
  const controlPath = options.controlPath ?? CONTROL_FILE;
  const controlRaw = await fs.readFile(controlPath, "utf8");
  const control = JSON.parse(controlRaw);
  const preset = await resolvePreset(name);
  await validatePreset(preset);
  const merged = mergeValues(control, preset);
  const resolved = options.resolveEnv ? resolveEnvironmentConfig(merged, { validateTypes: true }) : merged;
  await fs.writeFile(controlPath, JSON.stringify(resolved, null, 2) + "\n", "utf8");
  return controlPath;
}

export async function createPreset(name, sections, options = {}) {
  const controlRaw = await fs.readFile(CONTROL_FILE, "utf8");
  const control = JSON.parse(controlRaw);
  const preset = { description: options.description ?? "", $inherit: options.inherit ?? undefined };
  for (const section of sections) {
    if (control[section] !== undefined) preset[section] = control[section];
  }
  const filePath = path.join(PRESET_DIR, `${name}.preset_v0.json`);
  await fs.writeFile(filePath, JSON.stringify(preset, null, 2) + "\n", "utf8");
  return filePath;
}

async function cmdList() {
  const presets = await listPresets();
  process.stdout.write(presets.join("\n") + "\n");
}

async function cmdInfo(name) {
  const preset = await resolvePreset(name);
  process.stdout.write(JSON.stringify(preset, null, 2));
}

async function cmdApply(name) {
  await applyPreset(name, { resolveEnv: true });
  process.stdout.write("ok\n");
}

async function cmdValidate(name) {
  const preset = await resolvePreset(name);
  await validatePreset(preset);
  process.stdout.write("ok\n");
}

async function cmdCreate(args) {
  const name = args[0];
  const sections = args.slice(1).filter((arg) => !arg.startsWith("--"));
  const inheritArg = args.find((arg) => arg.startsWith("--inherit="));
  const inherit = inheritArg ? inheritArg.split("=")[1] : undefined;
  const pathOut = await createPreset(name, sections, { inherit });
  process.stdout.write(`${pathOut}\n`);
}

async function runTests() {
  const presets = await listPresets();
  if (!presets.includes("base")) throw new Error("base preset missing");
  const resolved = await resolvePreset("production");
  if (!resolved.policy?.permissions) throw new Error("preset merge failed");
  process.stdout.write("preset_manager tests: ok\n");
}

async function main() {
  const [command, name, ...rest] = process.argv.slice(2);
  if (command === "list") return cmdList();
  if (command === "info" && name) return cmdInfo(name);
  if (command === "apply" && name) return cmdApply(name);
  if (command === "validate" && name) return cmdValidate(name);
  if (command === "create" && name) return cmdCreate([name, ...rest]);
  if (command === "test") return runTests();
  process.stderr.write(
    "Usage: node services/preset_manager.js <list|info|apply|validate|create|test> [name] [sections...] [--inherit=base]\n"
  );
  process.exit(1);
}

if (process.argv[1]?.endsWith("preset_manager.js")) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
