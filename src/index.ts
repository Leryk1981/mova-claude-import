export type ImportOptions = {
  projectDir: string;
  outDir: string;
  includeLocal: boolean;
  includeUserSettings: boolean;
  dryRun: boolean;
  strict: boolean;
  emitProfile: boolean;
  emitZip: boolean;
  zipName?: string;
};

export type ImportResult = {
  ok: boolean;
  run_id: string;
  out_dir: string;
  imported: {
    claude_md: boolean;
    mcp_json: boolean;
    skills_count: number;
  };
  skipped: Array<{ path: string; reason: string }>;
  lint_summary: string;
};

export { runImport } from "./run_import.js";
