type OverlayParams = {
  contractsDir: string;
  artifactsDir: string;
  instructionProfileFile: string;
  skillsCatalogFile: string;
  mcpServersFile: string;
  lintReportFile: string;
  qualityReportFile: string;
  exportManifestFile: string;
};

export const MOVA_CONTROL_ENTRY_MARKER = "<!-- MOVA_CONTROL_ENTRY_V0 -->";

export function buildMovaOverlayV0(params: OverlayParams): Record<string, string> {
  const contractsDir = params.contractsDir;
  const artifactsDir = params.artifactsDir;
  const instruction = `${contractsDir}${params.instructionProfileFile}`;
  const skills = `${contractsDir}${params.skillsCatalogFile}`;
  const mcp = `${contractsDir}${params.mcpServersFile}`;
  const lint = `${artifactsDir}${params.lintReportFile}`;
  const quality = `${artifactsDir}${params.qualityReportFile}`;
  const exportManifest = `${artifactsDir}${params.exportManifestFile}`;

  return {
    ".claude/commands/mova_context.md": [
      "# mova_context",
      "",
      "Use MOVA contracts as source of truth:",
      `- ${instruction}`,
      `- ${skills}`,
      `- ${mcp}`,
      "",
      "Then use CLAUDE.md and MOVA.md as narrative guides.",
      "",
    ].join("\n"),
    ".claude/commands/mova_proof.md": [
      "# mova_proof",
      "",
      "Proof/evidence files:",
      `- ${lint}`,
      `- ${quality}`,
      `- ${exportManifest}`,
      "",
    ].join("\n"),
    ".claude/skills/mova-control-v0/SKILL.md": [
      "---",
      "name: mova-control-v0",
      "version: v0",
      "---",
      "",
      "# mova-control-v0",
      "",
      "Rules:",
      "- Use MOVA contracts first.",
      "- Use evidence files for verification.",
      "- Do not invent missing data.",
      "",
    ].join("\n"),
  };
}

export function buildMovaControlEntryV0(params: OverlayParams): string {
  const contractsDir = params.contractsDir;
  const artifactsDir = params.artifactsDir;
  return [
    MOVA_CONTROL_ENTRY_MARKER,
    "## MOVA Control Entry (v0)",
    "",
    "Source of truth (do this first):",
    `- ${contractsDir}${params.instructionProfileFile}`,
    `- ${contractsDir}${params.skillsCatalogFile}`,
    `- ${contractsDir}${params.mcpServersFile}`,
    "",
    "Proof / evidence:",
    `- ${artifactsDir}${params.qualityReportFile}`,
    `- ${artifactsDir}${params.exportManifestFile}`,
    "",
  ].join("\n");
}
