import fs from "node:fs/promises";
import path from "node:path";

type RunSummary = {
  run_id?: string;
  started_at?: string;
  last_event_at?: string;
  counts?: Record<string, number>;
};

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p: string) {
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

function sumCounts(summary: RunSummary | null): number {
  if (!summary?.counts) return 0;
  return Object.values(summary.counts).reduce((acc, value) => acc + Number(value || 0), 0);
}

export async function listObservabilityRuns(projectDir: string) {
  const root = path.join(projectDir, ".mova", "episodes");
  if (!(await exists(root))) return [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const runId = entry.name;
    const summaryPath = path.join(root, runId, "summary.json");
    const summary = (await exists(summaryPath)) ? ((await readJson(summaryPath)) as RunSummary) : null;
    const lastEventAt = summary?.last_event_at ?? null;
    runs.push({
      run_id: runId,
      last_event_at: lastEventAt,
      started_at: summary?.started_at ?? null,
      events: sumCounts(summary),
    });
  }
  runs.sort((a, b) => String(b.last_event_at ?? "").localeCompare(String(a.last_event_at ?? "")));
  return runs;
}

export async function tailObservabilityEvents(projectDir: string, runId: string, limit = 20) {
  const eventsPath = path.join(projectDir, ".mova", "episodes", runId, "events.jsonl");
  if (!(await exists(eventsPath))) return [];
  const raw = await fs.readFile(eventsPath, "utf8");
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  return lines.slice(-limit);
}

export async function readObservabilitySummary(projectDir: string, runId: string) {
  const summaryPath = path.join(projectDir, ".mova", "episodes", runId, "summary.json");
  if (!(await exists(summaryPath))) return null;
  return await readJson(summaryPath);
}
