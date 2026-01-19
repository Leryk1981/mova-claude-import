import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import yazl from "yazl";

type ExportZipResult = {
  zipAbsPath: string;
  zipRelPath: string;
  zipSha256: string;
  files: string[];
};

const FIXED_MTIME = new Date(Date.UTC(2000, 0, 1, 0, 0, 0));

function shouldExclude(rel: string): boolean {
  const parts = rel.split("/");
  for (const part of parts) {
    if (part === "node_modules" || part === "dist" || part === "artifacts") return true;
    if (part.startsWith(".tmp")) return true;
  }
  return false;
}

async function listFilesRec(dir: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop()!;
    const entries = await fsp.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(current, e.name);
      if (e.isDirectory()) stack.push(abs);
      else if (e.isFile()) out.push(abs);
    }
  }
  return out;
}

function normalizeRelPath(root: string, abs: string): string {
  return path.relative(root, abs).replace(/\\/g, "/");
}

async function sha256File(p: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(p);
    stream.on("error", reject);
    stream.on("data", (d) => hash.update(d));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function writeZip(absPath: string, files: Array<{ abs: string; rel: string }>) {
  await fsp.mkdir(path.dirname(absPath), { recursive: true });
  const zipfile = new yazl.ZipFile();
  for (const f of files) {
    zipfile.addFile(f.abs, f.rel, { mtime: FIXED_MTIME, mode: 0o100644 });
  }
  const outStream = fs.createWriteStream(absPath);
  const done = new Promise<void>((resolve, reject) => {
    outStream.on("close", resolve);
    outStream.on("error", reject);
  });
  zipfile.outputStream.pipe(outStream);
  zipfile.end();
  await done;
}

export async function createExportZipV0(outRoot: string, zipName?: string): Promise<ExportZipResult> {
  const name = zipName && zipName.trim().length ? zipName.trim() : "export.zip";
  const zipAbsPath = path.isAbsolute(name) ? name : path.join(outRoot, name);
  const zipRelPath = normalizeRelPath(outRoot, zipAbsPath);
  const absFiles = await listFilesRec(outRoot);
  const files = absFiles
    .map((abs) => ({ abs, rel: normalizeRelPath(outRoot, abs) }))
    .filter((f) => !shouldExclude(f.rel))
    .filter((f) => f.rel !== zipRelPath)
    .filter((f) => f.rel !== "mova/claude_import/v0/export_manifest_v0.json")
    .sort((a, b) => a.rel.localeCompare(b.rel));

  await writeZip(zipAbsPath, files);
  const zipSha256 = await sha256File(zipAbsPath);
  return {
    zipAbsPath,
    zipRelPath,
    zipSha256,
    files: files.map((f) => f.rel),
  };
}
