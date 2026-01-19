import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const TARGET_DEPS = ["@leryk1981/mova-spec", "@leryk1981/mova-core-engine"];

async function listFilesRec(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(current, e.name);
      if (e.isDirectory()) stack.push(abs);
      else if (e.isFile()) out.push(abs);
    }
  }
  return out;
}

function sha256Strings(items) {
  const h = crypto.createHash("sha256");
  for (const item of items) h.update(item);
  return h.digest("hex").slice(0, 16);
}

function importMatches(content, dep) {
  const variants = [dep, `${dep}/package.json`];
  return variants.some((variant) => {
    const esc = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const importRe = new RegExp(`from\\s+["']${esc}["']|import\\s+["']${esc}["']`, "g");
    const requireRe = new RegExp(`require\\(\\s*["']${esc}["']\\s*\\)`, "g");
    const resolveRe = new RegExp(`require\\.resolve\\(\\s*["']${esc}["']\\s*\\)`, "g");
    return importRe.test(content) || requireRe.test(content) || resolveRe.test(content);
  });
}

function usageHintsCoreEngine(content) {
  return /EvidenceWriter|EpisodeWriter|PolicyEngine/.test(content);
}

function usageHintsSpec(content) {
  const hasSpec = /mova-spec/.test(content);
  const hasResolver = /createRequire|require\.resolve|import\.meta\.resolve/.test(content);
  const hasSchemas = /schemas/.test(content);
  return hasSpec && (hasResolver || hasSchemas);
}

async function main() {
  const repoRoot = process.cwd();
  const pkg = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

  const srcRoot = path.join(repoRoot, "src");
  const files = (await listFilesRec(srcRoot)).filter((p) => p.endsWith(".ts"));
  files.sort();

  const fileContents = [];
  const contentByFile = new Map();
  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
    contentByFile.set(rel, content);
    fileContents.push(`${rel}\n${content}\n`);
  }
  const runId = sha256Strings(fileContents);

  const foundImports = {};
  const foundUsageHints = {};
  const recommendations = [];

  for (const dep of TARGET_DEPS) {
    const importFiles = [];
    const usageFiles = [];
    for (const [rel, content] of contentByFile.entries()) {
      if (importMatches(content, dep)) importFiles.push(rel);
      if (dep.endsWith("mova-core-engine") && usageHintsCoreEngine(content)) usageFiles.push(rel);
      if (dep.endsWith("mova-spec") && usageHintsSpec(content)) usageFiles.push(rel);
    }
    importFiles.sort();
    usageFiles.sort();
    foundImports[dep] = importFiles;
    foundUsageHints[dep] = usageFiles;

    if (deps[dep] && importFiles.length === 0) {
      recommendations.push(`Add import usage for ${dep}.`);
    }
    if (deps[dep] && usageFiles.length === 0) {
      recommendations.push(`Add real usage hints for ${dep}.`);
    }
    if (!deps[dep]) {
      recommendations.push(`Add ${dep} to dependencies.`);
    }
  }

  const ok =
    TARGET_DEPS.every((dep) => deps[dep]) &&
    TARGET_DEPS.every((dep) => foundImports[dep].length > 0) &&
    TARGET_DEPS.every((dep) => foundUsageHints[dep].length > 0);

  const report = {
    ok,
    found_imports: foundImports,
    found_usage_hints: foundUsageHints,
    recommendations,
  };

  const outDir = path.join(repoRoot, "artifacts", "deps_audit", runId);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, "deps_audit_report_v0.json"),
    JSON.stringify(report, null, 2) + "\n",
    "utf8"
  );

  process.exit(ok ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
