#!/usr/bin/env node
import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { watch } from "node:fs";
import { EpisodeMetricsCollector } from "./episode_metrics_collector.js";
import { loadConfigWithEnv } from "./env_resolver.js";

const CONTROL_FILE = path.resolve("mova", "control_v0.json");
const EPISODES_DIR = path.resolve(".mova", "episodes");

function buildHtml() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>MOVA Dashboard</title>
  <style>
    body{font-family:Arial,sans-serif;margin:20px;background:#f6f6f6;color:#222}
    header{display:flex;justify-content:space-between;align-items:center}
    .card{background:#fff;border-radius:8px;padding:16px;margin:12px 0;box-shadow:0 2px 6px rgba(0,0,0,0.08)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
    .ok{color:#0a7}
    .warn{color:#c60}
    .bad{color:#b00}
  </style>
</head>
<body>
  <header>
    <h1>MOVA Observability</h1>
    <button onclick="refresh()">Refresh</button>
  </header>
  <div id="status" class="card">Connecting...</div>
  <div id="metrics" class="grid"></div>
  <script>
    let socket;
    function render(data){
      const status = document.getElementById('status');
      status.innerText = 'Last updated: ' + data.lastUpdated;
      const cards = [];
      cards.push({title:'Episodes', value:data.totalEpisodes});
      cards.push({title:'Events', value:data.totalEvents});
      cards.push({title:'Error rate', value:data.errorRate + '%', cls: data.errorRate > 5 ? 'bad' : 'ok'});
      cards.push({title:'Avg duration', value: Math.round(data.performanceStats.avgEventDuration) + 'ms'});
      const container = document.getElementById('metrics');
      container.innerHTML = '';
      for (const card of cards){
        const div = document.createElement('div');
        div.className = 'card ' + (card.cls || '');
        div.innerHTML = '<strong>' + card.title + '</strong><div>' + card.value + '</div>';
        container.appendChild(div);
      }
    }
    function refresh(){ fetch('/api/metrics').then(r=>r.json()).then(render); }
    function connect(){
      socket = new WebSocket('ws://' + location.host + '/');
      socket.onmessage = (event)=>{ render(JSON.parse(event.data)); };
      socket.onopen = ()=>{ document.getElementById('status').innerText = 'Connected'; };
      socket.onclose = ()=>{ document.getElementById('status').innerText = 'Disconnected'; setTimeout(connect, 2000); };
    }
    connect();
    refresh();
  </script>
</body>
</html>`;
}

function createWebSocketAccept(key) {
  return crypto
    .createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11", "binary")
    .digest("base64");
}

function sendWebSocketMessage(socket, data) {
  const payload = Buffer.from(data);
  const length = payload.length;
  if (length < 126) {
    const frame = Buffer.alloc(length + 2);
    frame[0] = 0x81;
    frame[1] = length;
    payload.copy(frame, 2);
    socket.write(frame);
    return;
  }
  if (length < 65536) {
    const frame = Buffer.alloc(length + 4);
    frame[0] = 0x81;
    frame[1] = 126;
    frame.writeUInt16BE(length, 2);
    payload.copy(frame, 4);
    socket.write(frame);
    return;
  }
  const frame = Buffer.alloc(length + 10);
  frame[0] = 0x81;
  frame[1] = 127;
  frame.writeBigUInt64BE(BigInt(length), 2);
  payload.copy(frame, 10);
  socket.write(frame);
}

async function loadMonitoringConfig() {
  try {
    const { resolved } = await loadConfigWithEnv(CONTROL_FILE, { validateTypes: true });
    return resolved.monitoring ?? {};
  } catch {
    return {};
  }
}

async function startServer() {
  const monitoring = await loadMonitoringConfig();
  if (!monitoring.enabled) {
    process.stdout.write("dashboard: disabled\n");
    return;
  }
  const port = Number(monitoring.port ?? 2773);
  const updateInterval = Number(monitoring.update_interval ?? 30000);
  const collector = new EpisodeMetricsCollector(EPISODES_DIR);
  const sockets = new Set();

  const broadcast = async () => {
    const metrics = await collector.collect();
    const payload = JSON.stringify(metrics);
    for (const socket of sockets) {
      sendWebSocketMessage(socket, payload);
    }
  };

  const server = http.createServer(async (req, res) => {
    if (req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(buildHtml());
      return;
    }
    if (req.url === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ ok: true, ts: new Date().toISOString() }));
      return;
    }
    if (req.url === "/api/metrics") {
      const metrics = await collector.collect();
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(metrics));
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  });

  server.on("upgrade", async (req, socket) => {
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }
    const accept = createWebSocketAccept(key);
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  const interval = setInterval(async () => {
    await broadcast();
  }, updateInterval);

  let watcher;
  try {
    await fs.mkdir(EPISODES_DIR, { recursive: true });
    watcher = watch(EPISODES_DIR, { recursive: true }, () => broadcast());
  } catch {
    watcher = null;
  }

  server.listen(port, () => {
    process.stdout.write(`dashboard: http://localhost:${port}\n`);
  });

  const shutdown = () => {
    clearInterval(interval);
    if (watcher) watcher.close();
    server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function cmdHealth() {
  const metrics = await new EpisodeMetricsCollector(EPISODES_DIR).collect();
  process.stdout.write(JSON.stringify({ ok: true, metrics }, null, 2));
}

async function runTests() {
  const metrics = await new EpisodeMetricsCollector(EPISODES_DIR).collect();
  if (!metrics) throw new Error("metrics failed");
  process.stdout.write("dashboard_server tests: ok\n");
}

async function main() {
  const [command] = process.argv.slice(2);
  if (command === "start") return startServer();
  if (command === "health") return cmdHealth();
  if (command === "test") return runTests();
  process.stderr.write("Usage: node services/dashboard_server.js <start|health|test>\n");
  process.exit(1);
}

if (process.argv[1]?.endsWith("dashboard_server.js")) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
