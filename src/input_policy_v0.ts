import fs from "node:fs/promises";
import path from "node:path";

export type InputPolicyKind =
  | "claude_settings_local"
  | "local_file"
  | "env_file"
  | "private_key_like"
  | "other";

export type InputPolicyEntry = {
  path: string;
  kind: InputPolicyKind;
};

export type InputPolicyDenied = InputPolicyEntry & {
  reason: string;
};

export type InputPolicyReportV0 = {
  policy_version: "v0";
  found: InputPolicyEntry[];
  denied: InputPolicyDenied[];
  allowed: InputPolicyEntry[];
  opts: { strict: boolean; include_local: boolean };
  ok: boolean;
  exit_code_recommended: 0 | 2;
};

type ScanOpts = { strict: boolean; include_local: boolean };

async function listFilesRec(dir: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop()!;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(current, e.name);
      if (e.isDirectory()) stack.push(abs);
      else if (e.isFile()) out.push(abs);
    }
  }
  return out;
}

function classify(relPath: string): InputPolicyKind {
  const rel = relPath.replace(/\\/g, "/");
  const base = path.posix.basename(rel);
  if (rel.endsWith("/.claude/settings.local.json") || base === "settings.local.json") {
    return "claude_settings_local";
  }
  if (base === "CLAUDE.local.md" || base.includes(".local.")) {
    return "local_file";
  }
  if (base === ".env" || base.startsWith(".env.")) {
    return "env_file";
  }
  if (base.startsWith("id_rsa") || base.endsWith(".pem") || base.endsWith(".key")) {
    return "private_key_like";
  }
  return "other";
}

export async function scanInputPolicyV0(projectRoot: string, opts: ScanOpts): Promise<InputPolicyReportV0> {
  const absFiles = await listFilesRec(projectRoot);
  const found: InputPolicyEntry[] = [];
  const denied: InputPolicyDenied[] = [];
  const allowed: InputPolicyEntry[] = [];

  for (const abs of absFiles) {
    const rel = path.relative(projectRoot, abs).replace(/\\/g, "/");
    const kind = classify(rel);
    const entry = { path: rel, kind };
    found.push(entry);

    if (kind === "env_file") {
      denied.push({ ...entry, reason: "env_files_not_allowed" });
    } else if (kind === "private_key_like") {
      denied.push({ ...entry, reason: "private_keys_not_allowed" });
    } else if (kind === "claude_settings_local") {
      denied.push({ ...entry, reason: "settings_local_not_allowed" });
    } else if (kind === "local_file") {
      if (opts.include_local) allowed.push(entry);
      else denied.push({ ...entry, reason: "local_files_not_allowed" });
    } else {
      allowed.push(entry);
    }
  }

  const ok = denied.length === 0;
  const exit_code_recommended: 0 | 2 = !ok && opts.strict ? 2 : 0;

  return {
    policy_version: "v0",
    found,
    denied,
    allowed,
    opts,
    ok,
    exit_code_recommended,
  };
}
