const fs = require(\'fs');  
  
// Create cli.ts  
fs.writeFileSync(\'src/cli.ts\', \`import { runImport } from \"./run_import.js\";  
  
function getArg(name: string): string | undefined {  
  const idx = process.argv.indexOf(name);  
  if (idx === -1) return undefined;  
  return process.argv[idx + 1];  
}  
function hasFlag(name: string): boolean {  
  return process.argv.includes(name);  
}  
function usage(exitCode = 0) {  
  console.log([  
    \"mova-claude-import ^(v0^)\",  
    \"\",  
    \"Usage:\",  
    \"  mova-claude-import --project ^<dir^> [--out ^<dir^>] [--dry-run] [--strict] [--include-local] [--include-user-settings]\",  
    \"\",  
    \"Notes:\",  
    \"  - CLAUDE.local.md and *.local.* are excluded unless --include-local\",  
    \"  - user-level settings are excluded unless --include-user-settings\",  
  ].join(\"\\\\n\"));  
  process.exit(exitCode);  
}  
  
if (hasFlag(\"--help\") || hasFlag(\"-h\")) usage(0);  
if (hasFlag(\"--version\") || hasFlag(\"-v\")) {  
  console.log(\"0.0.0\");  
  process.exit(0);  
}  
  
const project = getArg(\"--project\");  
if (!project) usage(2);  
  
const out = getArg(\"--out\") || project;  
  
const res = await runImport{  
  projectDir: project,  
  outDir: out,  
  includeLocal: hasFlag(\"--include-local\"),  
  includeUserSettings: hasFlag(\"--include-user-settings\"),  
  dryRun: hasFlag(\"--dry-run\"),  
  strict: hasFlag(\"--strict\")  
});  
  
process.stdout.write(JSON.stringify(res, null, 2) + \"\\\\n\");  
process.exit(res.ok ? 0 : 1);  
\`);  
  
console.log(\'cli.ts created successfully.'); 
