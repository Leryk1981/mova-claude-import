#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

export class EpisodeMetricsCollector {
  constructor(episodesDir) {
    this.episodesDir = episodesDir;
  }

  async listEpisodeDirs() {
    try {
      const entries = await fs.readdir(this.episodesDir, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(this.episodesDir, entry.name));
    } catch {
      return [];
    }
  }

  async readJsonl(filePath) {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      return raw
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  async collect() {
    const episodes = await this.listEpisodeDirs();
    let totalEvents = 0;
    let errorCount = 0;
    const toolUsage = {};
    let totalDuration = 0;
    let maxDuration = 0;

    for (const episode of episodes) {
      const eventsPath = path.join(episode, "events.jsonl");
      const events = await this.readJsonl(eventsPath);
      totalEvents += events.length;
      for (const event of events) {
        if (event.ok === false) errorCount += 1;
        if (event.tool_name) toolUsage[event.tool_name] = (toolUsage[event.tool_name] ?? 0) + 1;
        const duration = Number(event?.durations?.total_ms ?? event?.durations?.ms ?? 0);
        if (Number.isFinite(duration) && duration > 0) {
          totalDuration += duration;
          maxDuration = Math.max(maxDuration, duration);
        }
      }
    }

    const avgEventDuration = totalEvents > 0 ? totalDuration / totalEvents : 0;
    const errorRate = totalEvents > 0 ? Number(((errorCount / totalEvents) * 100).toFixed(2)) : 0;

    return {
      totalEpisodes: episodes.length,
      totalEvents,
      errorCount,
      errorRate,
      toolUsage,
      performanceStats: {
        avgEventDuration,
        maxEventDuration: maxDuration,
        totalDuration,
      },
      lastUpdated: new Date().toISOString(),
    };
  }
}

if (process.argv[1]?.endsWith("episode_metrics_collector.js")) {
  process.stderr.write("Usage: import EpisodeMetricsCollector from this module.\n");
  process.exit(1);
}
