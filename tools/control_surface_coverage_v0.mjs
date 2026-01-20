import { runControlSurfaceCoverageV0 } from "../dist/control_surface_coverage_v0.js";

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
};

const showcaseRoot = getArg("--showcase");
const controlPath = getArg("--control");
const exclusionsPath = getArg("--exclusions");
const reportPath = getArg("--report");

if (!showcaseRoot || !controlPath || !exclusionsPath || !reportPath) {
  console.error("Usage: node tools/control_surface_coverage_v0.mjs --showcase <dir> --control <file> --exclusions <file> --report <file>");
  process.exit(2);
}

const report = await runControlSurfaceCoverageV0({
  showcaseRoot,
  controlPath,
  exclusionsPath,
  reportPath,
});

process.stdout.write(JSON.stringify(report, null, 2) + "\n");
