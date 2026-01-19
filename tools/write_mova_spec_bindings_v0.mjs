import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const CHECK_MODE = process.argv.includes("--check");
const REPO_ROOT = process.cwd();
const BINDINGS_PATH = path.join(REPO_ROOT, "src", "mova_spec_bindings_v0.ts");
const OUT_MD = path.join(REPO_ROOT, "docs", "MOVA_SPEC_BINDINGS.md");
const OUT_JSON = path.join(REPO_ROOT, "docs", "MOVA_SPEC_BINDINGS.json");

function parseBindings(source) {
  const ids = {};
  const re = /(\w+_id)\s*:\s*["']([^"']+)["']/g;
  let match;
  while ((match = re.exec(source))) {
    ids[match[1]] = match[2];
  }
  return ids;
}

async function listSchemas(specRoot) {
  const schemasRoot = path.join(specRoot, "schemas");
  const out = [];
  const stack = [schemasRoot];
  while (stack.length) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(current, e.name);
      if (e.isDirectory()) stack.push(abs);
      else if (e.isFile() && e.name.endsWith(".json")) out.push(abs);
    }
  }
  return out;
}

async function main() {
  const require = createRequire(import.meta.url);
  const specPkgPath = require.resolve("@leryk1981/mova-spec/package.json");
  const specRoot = path.dirname(specPkgPath);
  const specPkg = JSON.parse(await fs.readFile(specPkgPath, "utf8"));
  const specVersion = specPkg.version ?? "unknown";

  const bindingsSource = await fs.readFile(BINDINGS_PATH, "utf8");
  const bindings = parseBindings(bindingsSource);
  const categories = [
    ["instruction_profile", "instruction_profile_id"],
    ["mcp_servers", "mcp_servers_id"],
    ["core_schema", "core_schema_id"],
  ];

  const selected = {};
  for (const [label, key] of categories) {
    const id = bindings[key];
    if (!id) {
      console.error(`Missing binding key: ${key}`);
      process.exit(2);
    }
    selected[label] = id;
  }

  const schemaFiles = await listSchemas(specRoot);
  const idToPath = new Map();
  for (const file of schemaFiles) {
    const raw = await fs.readFile(file, "utf8");
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.$id) {
        const rel = path.relative(specRoot, file).replace(/\\/g, "/");
        idToPath.set(parsed.$id, rel);
      }
    } catch {
      // ignore invalid schema files
    }
  }

  const rows = categories.map(([label]) => {
    const id = selected[label];
    const filePath = idToPath.get(id) ?? "UNRESOLVED";
    return { category: label, schema_id: id, file_path: filePath };
  });

  const jsonOut = {
    spec_version: specVersion,
    bindings: rows,
    selection_rule: "Bound to MOVA_SPEC_BINDINGS_V0 used by run_import.ts",
  };

  const mdLines = [
    "# MOVA Spec Bindings v0",
    "",
    `Spec version: ${specVersion}`,
    "",
    "| Category | Chosen schema $id | File path |",
    "| --- | --- | --- |",
    ...rows.map((r) => `| ${r.category} | ${r.schema_id} | ${r.file_path} |`),
    "",
    "Selection rule: Bound to `MOVA_SPEC_BINDINGS_V0` used by `src/run_import.ts`.",
    "",
  ];

  if (CHECK_MODE) {
    const currentMd = await fs.readFile(OUT_MD, "utf8");
    const currentJson = await fs.readFile(OUT_JSON, "utf8");
    const nextMd = mdLines.join("\n");
    const nextJson = JSON.stringify(jsonOut, null, 2) + "\n";
    if (currentMd !== nextMd || currentJson !== nextJson) {
      console.error("Bindings docs are out of date.");
      process.exit(2);
    }
    process.exit(0);
  }

  await fs.mkdir(path.dirname(OUT_MD), { recursive: true });
  await fs.writeFile(OUT_MD, mdLines.join("\n"), "utf8");
  await fs.writeFile(OUT_JSON, JSON.stringify(jsonOut, null, 2) + "\n", "utf8");
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
