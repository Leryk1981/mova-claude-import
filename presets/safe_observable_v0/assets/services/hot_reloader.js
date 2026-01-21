#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { loadConfigWithEnv } from "./env_resolver.js";

const CONTROL_FILE = path.resolve("mova", "control_v0.json");
const MANIFEST_FILE = path.resolve("mova", "version_manifest_v0.json");
const BACKUP_ROOT = path.resolve(".mova", "backups");

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function sha256File(filePath) {
  const buf = await fs.readFile(filePath);
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  return { hash, size: buf.length, last_modified: new Date().toISOString() };
}

function resolveTrackedPath(baseDir, entry) {
  return path.resolve(process.cwd(), entry);
}

export async function initializeHashes() {
  const manifest = await readJson(MANIFEST_FILE);
  for (const [key, meta] of Object.entries(manifest.integrity.components)) {
    const target = resolveTrackedPath(path.dirname(MANIFEST_FILE), key);
    try {
      const info = await sha256File(target);
      meta.hash = info.hash;
      meta.size = info.size;
      meta.last_modified = info.last_modified;
    } catch {
      meta.hash = "";
      meta.size = 0;
      meta.last_modified = "";
    }
  }
  await writeJson(MANIFEST_FILE, manifest);
  return manifest;
}

export async function validateIntegrity() {
  const manifest = await readJson(MANIFEST_FILE);
  const failures = [];
  for (const [key, meta] of Object.entries(manifest.integrity.components)) {
    const target = resolveTrackedPath(path.dirname(MANIFEST_FILE), key);
    try {
      const info = await sha256File(target);
      if (meta.hash && info.hash !== meta.hash) {
        failures.push({ key, expected: meta.hash, actual: info.hash });
      }
    } catch (error) {
      if (meta.required) failures.push({ key, error: "missing" });
    }
  }
  return { ok: failures.length === 0, failures };
}

export async function createBackup(name) {
  const manifest = await readJson(MANIFEST_FILE);
  const stamp = name ?? `backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const backupDir = path.join(BACKUP_ROOT, stamp);
  await fs.mkdir(backupDir, { recursive: true });
  await writeJson(path.join(backupDir, "manifest.json"), manifest);
  await fs.mkdir(path.join(backupDir, "services"), { recursive: true });

  for (const [key] of Object.entries(manifest.integrity.components)) {
    const source = resolveTrackedPath(path.dirname(MANIFEST_FILE), key);
    const dest = path.join(backupDir, key);
    try {
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(source, dest);
    } catch {
      // ignore missing optional files
    }
  }
  await fs.copyFile(CONTROL_FILE, path.join(backupDir, "mova", "control_v0.json"));
  return backupDir;
}

export async function restoreBackup(name) {
  const backupDir = path.join(BACKUP_ROOT, name);
  const manifestPath = path.join(backupDir, "manifest.json");
  const manifest = await readJson(manifestPath);
  for (const [key] of Object.entries(manifest.integrity.components)) {
    const source = path.join(backupDir, key);
    const dest = resolveTrackedPath(path.dirname(MANIFEST_FILE), key);
    try {
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(source, dest);
    } catch {
      // ignore missing optional files
    }
  }
  const controlBackup = path.join(backupDir, "mova", "control_v0.json");
  try {
    await fs.copyFile(controlBackup, CONTROL_FILE);
  } catch {
    // ignore
  }
}

export async function listBackups() {
  try {
    const entries = await fs.readdir(BACKUP_ROOT, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function loadVersioningConfig() {
  try {
    const { resolved } = await loadConfigWithEnv(CONTROL_FILE, { validateTypes: true });
    return resolved.versioning ?? {};
  } catch {
    return {};
  }
}

async function cmdValidate() {
  const res = await validateIntegrity();
  if (!res.ok) {
    process.stderr.write(JSON.stringify(res, null, 2));
    process.exit(2);
  }
  process.stdout.write("ok\n");
}

async function cmdBackup(name) {
  const config = await loadVersioningConfig();
  if (config.enabled === false) {
    process.stdout.write("versioning: disabled\n");
    return;
  }
  const dir = await createBackup(name);
  process.stdout.write(`${dir}\n`);
}

async function cmdRestore(name) {
  await restoreBackup(name);
  process.stdout.write("ok\n");
}

async function cmdList() {
  const backups = await listBackups();
  process.stdout.write(backups.join("\n") + "\n");
}

async function cmdInitHashes() {
  await initializeHashes();
  process.stdout.write("ok\n");
}

async function cmdCheckUpdates() {
  process.stdout.write("update check: not implemented\n");
}

async function runTests() {
  await initializeHashes();
  const validation = await validateIntegrity();
  if (!validation.ok) throw new Error("integrity validation failed");
  process.stdout.write("hot_reloader tests: ok\n");
}

async function main() {
  const [command, name] = process.argv.slice(2);
  if (command === "validate") return cmdValidate();
  if (command === "backup") return cmdBackup(name);
  if (command === "restore" && name) return cmdRestore(name);
  if (command === "list") return cmdList();
  if (command === "init-hashes") return cmdInitHashes();
  if (command === "check-updates") return cmdCheckUpdates();
  if (command === "test") return runTests();
  process.stderr.write(
    "Usage: node services/hot_reloader.js <validate|backup|restore|list|init-hashes|check-updates|test> [name]\n"
  );
  process.exit(1);
}

if (process.argv[1]?.endsWith("hot_reloader.js")) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
