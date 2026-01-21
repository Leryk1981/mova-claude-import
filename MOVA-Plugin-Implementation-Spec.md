# MOVA Plugin: Полная спецификация имплементации

**Версия**: 1.0.0
**Статус**: Ready for Implementation
**Дата**: 2026-01-21

---

## Содержание

1. [Цели и scope](#1-цели-и-scope)
2. [Целевая архитектура](#2-целевая-архитектура)
3. [Структура плагина](#3-структура-плагина)
4. [Security Layer](#4-security-layer)
5. [Observability Layer](#5-observability-layer)
6. [Validation Layer](#6-validation-layer)
7. [Slash-команды](#7-slash-команды)
8. [Конфигурация хуков](#8-конфигурация-хуков)
9. [Пресеты и наследование](#9-пресеты-и-наследование)
10. [UX и интерфейс](#10-ux-и-интерфейс)
11. [Audit и Compliance](#11-audit-и-compliance)
12. [План имплементации](#12-план-имплементации)
13. [Acceptance Criteria](#13-acceptance-criteria)

---

## 1. Цели и scope

### 1.1 Основная цель

Перенести слой MOVA (Monitoring, Observing, Validating Agent) из встроенного компонента в **npm-пакет плагина** Claude Code с полным соответствием спецификации MOVA 4.1.1 и best practices Anthropic 2025-2026.

### 1.2 Ключевые deliverables

| Deliverable | Описание |
|-------------|----------|
| npm-пакет `@mova/claude-plugin` | Публикуемый плагин |
| 10+ slash-команд `/mova:*` | Управление MOVA |
| Security Events System | 6 типов событий безопасности |
| Episode Structure v4.1.1 | Полная структура по спецификации |
| OTEL Integration | Enterprise observability |
| 3 пресета | base, development, production |

### 1.3 Out of scope

- MCP серверы через плагин (roadmap)
- GUI dashboard (только WebSocket API)
- Миграция существующих .mova/episodes

---

## 2. Целевая архитектура

### 2.1 Layered Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                  Claude Code Sandbox                         │
│                   (OS-level isolation)                       │
├─────────────────────────────────────────────────────────────┤
│                 MOVA Permission Policy                       │
│            allow/deny rules + on_unknown handling            │
├─────────────────────────────────────────────────────────────┤
│                 MOVA Guardrail Rules                         │
│         severity levels + on_violation actions               │
├─────────────────────────────────────────────────────────────┤
│                MOVA Security Events                          │
│      6 event types + 4 action types + classification         │
├─────────────────────────────────────────────────────────────┤
│                 Episode Audit Trail                          │
│     MOVA 4.1.1 structure + OTEL export + compliance          │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Event Flow

```
┌──────────────┐
│ User Prompt  │
└──────┬───────┘
       ↓
┌──────────────┐     ┌─────────────────────────┐
│ Skill Eval   │────→│ Load SKILL.md           │
└──────┬───────┘     │ Match by keywords       │
       ↓             └─────────────────────────┘
┌──────────────┐     ┌─────────────────────────┐
│ Security     │────→│ Classify event type     │
│ Classifier   │     │ Check injection patterns│
└──────┬───────┘     └─────────────────────────┘
       ↓
┌──────────────┐     ┌─────────────────────────┐
│ Pre-ToolUse  │────→│ Evaluate guardrails     │
│ Guard        │     │ Apply severity rules    │
└──────┬───────┘     │ Execute actions         │
       │             └─────────────────────────┘
       ↓ allow/block
┌──────────────┐
│ Tool Execute │
└──────┬───────┘
       ↓
┌──────────────┐     ┌─────────────────────────┐
│ Post-ToolUse │────→│ Format (prettier)       │
│ Guard        │     │ Test (affected files)   │
└──────┬───────┘     └─────────────────────────┘
       ↓
┌──────────────┐     ┌─────────────────────────┐
│ Observe      │────→│ Write Episode (JSONL)   │
│              │     │ Export OTEL metrics     │
└──────────────┘     │ Update session summary  │
                     └─────────────────────────┘
```

### 2.3 Configuration Inheritance

```
┌─────────────────────────────┐
│  Plugin Defaults            │  ← @mova/claude-plugin/config/defaults.json
│  (immutable base)           │
└─────────────┬───────────────┘
              ↓ merge (deep)
┌─────────────────────────────┐
│  Preset                     │  ← presets/{base|development|production}.json
│  ($inherit support)         │
└─────────────┬───────────────┘
              ↓ merge (deep)
┌─────────────────────────────┐
│  Project control_v0.json    │  ← ${PROJECT_DIR}/mova/control_v0.json
│  (user overrides)           │
└─────────────┬───────────────┘
              ↓ merge (shallow)
┌─────────────────────────────┐
│  Environment Variables      │  ← MOVA_*, CLAUDE_*
│  (runtime overrides)        │
└─────────────────────────────┘
```

---

## 3. Структура плагина

```
@mova/claude-plugin/
├── .claude-plugin/
│   └── plugin.json                 # Манифест плагина
│
├── commands/                       # Slash-команды → /mova:*
│   ├── init.md                    # /mova:init [--preset <name>]
│   ├── status.md                  # /mova:status
│   ├── context.md                 # /mova:context
│   ├── lint.md                    # /mova:lint [--fix]
│   ├── metrics.md                 # /mova:metrics [--format json|table]
│   ├── dashboard.md               # /mova:dashboard [start|stop|status]
│   ├── debug.md                   # /mova:debug [--tail <n>]
│   ├── start.md                   # /mova:start
│   ├── finish.md                  # /mova:finish
│   └── preset/
│       ├── list.md                # /mova:preset:list
│       ├── apply.md               # /mova:preset:apply <name>
│       └── info.md                # /mova:preset:info <name>
│
├── agents/
│   └── code-reviewer.md           # Субагент ревью кода
│
├── skills/
│   ├── mova-layer-v0/
│   │   └── SKILL.md
│   ├── testing-patterns/
│   │   └── SKILL.md
│   ├── systematic-debugging/
│   │   └── SKILL.md
│   ├── security-basics/
│   │   └── SKILL.md
│   └── git-workflow/
│       └── SKILL.md
│
├── hooks/
│   └── hooks.json                 # Конфигурация хуков плагина
│
├── scripts/
│   ├── mova-guard.js              # Валидация операций
│   ├── mova-observe.js            # Сбор событий
│   ├── mova-security.js           # Security classifier (NEW)
│   └── skill-eval.js              # Оценка компетенций
│
├── services/
│   ├── env_resolver.js            # Разрешение переменных
│   ├── preset_manager.js          # Управление пресетами
│   ├── episode_writer.js          # Запись эпизодов v4.1.1 (UPDATED)
│   ├── episode_metrics_collector.js
│   ├── otel_exporter.js           # OpenTelemetry экспорт (NEW)
│   ├── dashboard_server.js
│   └── hot_reloader.js
│
├── presets/
│   ├── base.preset.json
│   ├── development.preset.json
│   └── production.preset.json
│
├── rules/
│   ├── code-style.md
│   └── security.md
│
├── config/
│   ├── defaults.json              # Базовые настройки плагина
│   ├── skill-rules.json           # Правила оценки скилов
│   ├── security-events.json       # Каталог security events (NEW)
│   └── control-template.json      # Шаблон control_v0.json
│
├── schemas/
│   ├── episode_v1.schema.json     # JSON Schema для эпизодов
│   ├── security_event.schema.json # JSON Schema для security events
│   └── control_v1.schema.json     # JSON Schema для control
│
├── package.json
├── index.js                       # Entry point для программного использования
└── README.md
```

---

## 4. Security Layer

### 4.1 Security Events System

**Файл**: `config/security-events.json`

```json
{
  "$schema": "https://mova.dev/schemas/security_event_catalog_v1.json",
  "version": "1.0.0",
  "event_types": {
    "instruction_profile_invalid": {
      "description": "Control profile missing, invalid, or incompatible",
      "default_severity": "high",
      "default_actions": ["block", "alert"]
    },
    "prompt_injection_suspected": {
      "description": "Suspicious patterns detected in user prompt",
      "default_severity": "medium",
      "default_actions": ["warn", "log"]
    },
    "forbidden_tool_requested": {
      "description": "Attempt to use denied tool",
      "default_severity": "high",
      "default_actions": ["block", "log"]
    },
    "rate_limit_exceeded": {
      "description": "API or operation rate limit exceeded",
      "default_severity": "low",
      "default_actions": ["fallback", "log"]
    },
    "sensitive_data_access_suspected": {
      "description": "Attempt to access secrets or credentials",
      "default_severity": "critical",
      "default_actions": ["block", "alert"]
    },
    "guardrail_violation": {
      "description": "Guardrail rule triggered",
      "default_severity": "varies",
      "default_actions": ["varies"]
    }
  },
  "action_types": {
    "log": "Document for audit without blocking",
    "warn": "Log and show warning to user",
    "alert": "Notify administrators",
    "block": "Prevent the action",
    "fallback": "Switch to restricted mode"
  }
}
```

### 4.2 Security Classifier Script

**Файл**: `scripts/mova-security.js`

```javascript
// Интерфейс
// Input: JSON via stdin { event_type, tool_name, input, context }
// Output: JSON { security_event_type, severity, actions, confidence }

const PATTERNS = {
  prompt_injection: [
    /ignore\s+(previous|above|all)\s+instructions/i,
    /you\s+are\s+now\s+/i,
    /disregard\s+(your|the)\s+(rules|instructions)/i,
    /\[SYSTEM\]/i,
    /\{\{.*\}\}/  // template injection
  ],
  sensitive_access: [
    /\.(env|pem|key|secret|credential)/i,
    /password|api[_-]?key|token|secret/i,
    /\/etc\/(passwd|shadow)/,
    /~\/\.ssh\//
  ]
};

function classify(input) {
  // Returns: { event_type, severity, confidence }
}
```

### 4.3 Guardrail Rules Schema

**Файл**: `schemas/guardrail_rule.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["rule_id", "effect", "severity"],
  "properties": {
    "rule_id": { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
    "description": { "type": "string" },
    "effect": { "enum": ["allow", "deny", "warn", "log_only", "transform"] },
    "target": {
      "type": "object",
      "properties": {
        "tool": { "type": "string" },
        "pattern": { "type": "string" },
        "path_glob": { "type": "string" }
      }
    },
    "severity": { "enum": ["info", "low", "medium", "high", "critical"] },
    "on_violation": {
      "type": "array",
      "items": { "enum": ["log", "warn", "alert", "block", "require_confirmation"] }
    },
    "enabled": { "type": "boolean", "default": true }
  }
}
```

### 4.4 Пример Guardrail Rules

```json
{
  "guardrail_rules": [
    {
      "rule_id": "block-rm-rf",
      "description": "Block recursive force delete",
      "effect": "deny",
      "target": { "tool": "Bash", "pattern": "rm\\s+-rf" },
      "severity": "critical",
      "on_violation": ["block", "alert", "log"]
    },
    {
      "rule_id": "warn-sudo",
      "description": "Warn on sudo usage",
      "effect": "warn",
      "target": { "tool": "Bash", "pattern": "^sudo\\s+" },
      "severity": "high",
      "on_violation": ["warn", "require_confirmation", "log"]
    },
    {
      "rule_id": "protect-secrets",
      "description": "Block access to secret files",
      "effect": "deny",
      "target": { "path_glob": "**/*.{env,pem,key}" },
      "severity": "critical",
      "on_violation": ["block", "alert"]
    },
    {
      "rule_id": "log-external-requests",
      "description": "Log all external HTTP requests",
      "effect": "log_only",
      "target": { "tool": "Bash", "pattern": "curl|wget|fetch" },
      "severity": "info",
      "on_violation": ["log"]
    }
  ]
}
```

### 4.5 Human-in-the-Loop Configuration

```json
{
  "human_in_the_loop": {
    "escalation_threshold": "high",
    "auto_approve": ["Read", "Glob", "Grep", "WebSearch"],
    "always_confirm": [
      { "tool": "Bash", "pattern": "rm|mv|chmod|chown" },
      { "tool": "Write", "path_glob": "**/.env*" },
      { "tool": "Edit", "path_glob": "**/secret*" }
    ],
    "confirmation_timeout_ms": 60000
  }
}
```

---

## 5. Observability Layer

### 5.1 Episode Structure (MOVA 4.1.1)

**Файл**: `schemas/episode_v1.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["episode_id", "episode_type", "mova_version", "recorded_at", "executor", "result_status", "result_summary"],
  "properties": {
    "episode_id": {
      "type": "string",
      "pattern": "^ep_[0-9]{8}_[a-z0-9]{6}$"
    },
    "episode_type": {
      "enum": ["execution", "plan", "security_event", "other"]
    },
    "mova_version": {
      "type": "string",
      "const": "4.1.1"
    },
    "recorded_at": {
      "type": "string",
      "format": "date-time"
    },
    "started_at": {
      "type": "string",
      "format": "date-time"
    },
    "finished_at": {
      "type": "string",
      "format": "date-time"
    },
    "executor": {
      "type": "object",
      "required": ["executor_id"],
      "properties": {
        "executor_id": { "type": "string" },
        "role": { "enum": ["agent", "reviewer", "router", "user"] },
        "executor_kind": { "enum": ["human", "AI model", "service", "tool", "hybrid"] }
      }
    },
    "result_status": {
      "enum": ["pending", "in_progress", "completed", "failed", "partial", "cancelled", "skipped"]
    },
    "result_summary": { "type": "string" },
    "result_details": {
      "type": "object",
      "properties": {
        "duration_ms": { "type": "integer" },
        "tokens_used": { "type": "integer" },
        "tool_name": { "type": "string" },
        "exit_code": { "type": "integer" },
        "files_affected": { "type": "array", "items": { "type": "string" } }
      }
    },
    "meta_episode": {
      "type": "object",
      "properties": {
        "correlation_id": { "type": "string" },
        "parent_episode_id": { "type": ["string", "null"] },
        "trace_id": { "type": "string" },
        "session_id": { "type": "string" }
      }
    },
    "security_event": {
      "type": "object",
      "properties": {
        "event_type": { "type": "string" },
        "severity": { "type": "string" },
        "actions_taken": { "type": "array", "items": { "type": "string" } },
        "detection_confidence": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    },
    "compliance": {
      "type": "object",
      "properties": {
        "data_classification": { "enum": ["public", "internal", "confidential", "restricted"] },
        "retention_days": { "type": "integer" },
        "exportable": { "type": "boolean" },
        "redacted_fields": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

### 5.2 Episode Writer Service

**Файл**: `services/episode_writer.js`

```javascript
// Интерфейс
class EpisodeWriter {
  constructor(options) {
    this.episodesDir = options.episodesDir; // ${PROJECT_DIR}/.mova/episodes
    this.correlationId = options.correlationId || generateCorrelationId();
    this.sessionId = options.sessionId;
  }

  async writeEpisode(episode) {
    // 1. Validate against schema
    // 2. Add meta_episode fields
    // 3. Append to session JSONL
    // 4. Update session summary
    // 5. Trigger OTEL export if enabled
  }

  async writeSecurityEvent(event) {
    // Write as episode_type: "security_event"
  }

  async finalize() {
    // Write session summary.json
  }
}
```

### 5.3 Correlation и Tracing

```
Session Start (SessionStart hook)
    │
    ├─→ Generate: MOVA_CORRELATION_ID = session_{uuid}
    │   Generate: MOVA_SESSION_ID = sess_{timestamp}_{random}
    │
    ├─→ Episode 1: execution
    │   ├─→ episode_id = ep_{date}_{random}
    │   ├─→ parent_episode_id = null
    │   └─→ correlation_id = session_{uuid}
    │
    ├─→ Episode 1.1: security_event (nested)
    │   ├─→ parent_episode_id = Episode 1.episode_id
    │   └─→ correlation_id = session_{uuid}
    │
    ├─→ Episode 2: execution
    │   └─→ parent_episode_id = null
    │
    └─→ Session End (Stop hook)
        └─→ Write summary.json with aggregated metrics
```

### 5.4 OpenTelemetry Exporter

**Файл**: `services/otel_exporter.js`

```javascript
// Метрики для экспорта
const METRICS = {
  'mova.episode.duration': { type: 'histogram', unit: 'ms' },
  'mova.episode.count': { type: 'counter', labels: ['episode_type', 'result_status'] },
  'mova.security.events': { type: 'counter', labels: ['event_type', 'severity'] },
  'mova.tool.usage': { type: 'counter', labels: ['tool_name'] },
  'mova.error.rate': { type: 'gauge' },
  'mova.tokens.used': { type: 'counter' }
};

// Конфигурация через environment
// OTEL_EXPORTER_OTLP_ENDPOINT
// OTEL_METRICS_EXPORTER = otlp | prometheus | console
// OTEL_SERVICE_NAME = mova-plugin
```

### 5.5 Session Structure

```
.mova/
├── episodes/
│   ├── index.jsonl                    # Global index of all sessions
│   ├── sess_20260121_abc123/
│   │   ├── events.jsonl               # All episodes (line-delimited JSON)
│   │   └── summary.json               # Aggregated session metrics
│   └── sess_20260121_def456/
│       ├── events.jsonl
│       └── summary.json
└── backups/
    └── control_v0_20260121_120000.json
```

---

## 6. Validation Layer

### 6.1 Instruction Profile (MOVA 4.1.1 compatible)

**Файл**: `config/control-template.json`

```json
{
  "$schema": "https://mova.dev/schemas/control_v1.schema.json",
  "profile_id": "mova_claude_control_v1",
  "profile_version": "1.0.0",
  "mova_version": "4.1.1",
  "security_model_version": "mova_security_default_v1",
  "status": "active",

  "applies_to": {
    "executor_kinds": ["AI model"],
    "roles": ["agent"],
    "tags": ["claude-code"]
  },

  "policy": {
    "permissions": {
      "allow": ["Read", "Glob", "Grep"],
      "deny": [],
      "on_conflict": "deny_wins",
      "on_unknown": "report_only"
    }
  },

  "guardrail_rules": [],

  "human_in_the_loop": {
    "escalation_threshold": "high",
    "auto_approve": [],
    "always_confirm": []
  },

  "observability": {
    "enabled": true,
    "episodes_dir": ".mova/episodes",
    "otel_enabled": false
  },

  "monitoring": {
    "enabled": false,
    "port": 2773
  },

  "retention": {
    "episodes_days": 90,
    "security_events_days": 365,
    "auto_cleanup": true
  }
}
```

### 6.2 Text Channel Separation

| Канал | Назначение | Видим человеку | Видим модели |
|-------|------------|----------------|--------------|
| `human_facing_ui` | UI сообщения | ✓ | ✗ |
| `model_instruction` | SKILL.md, prompts | ✗ | ✓ |
| `system_log` | Episodes, logs | ✗ | ✗ |

**Применение в коде**:
```javascript
// SKILL.md content → channel: model_instruction
// Hook output to user → channel: human_facing_ui
// Episode JSON → channel: system_log
```

---

## 7. Slash-команды

### 7.1 Полный список команд

| Команда | Аргументы | Описание |
|---------|-----------|----------|
| `/mova:init` | `[--preset <name>]` | Инициализация MOVA в проекте |
| `/mova:status` | — | Краткий статус (minimal) |
| `/mova:context` | — | Контекст проекта (standard) |
| `/mova:lint` | `[--fix]` | Структурная валидация |
| `/mova:metrics` | `[--format json\|table]` | Метрики наблюдения |
| `/mova:dashboard` | `[start\|stop\|status]` | Управление дашбордом |
| `/mova:debug` | `[--tail <n>]` | Полные эпизоды (verbose) |
| `/mova:start` | — | Начало сессии |
| `/mova:finish` | — | Завершение сессии |
| `/mova:preset:list` | — | Список пресетов |
| `/mova:preset:apply` | `<name>` | Применить пресет |
| `/mova:preset:info` | `<name>` | Информация о пресете |

### 7.2 Команда /mova:init

**Файл**: `commands/init.md`

```markdown
---
description: Initialize MOVA in current project
argument-hint: "[--preset <name>]"
allowed-tools:
  - Read
  - Write
  - Bash
---

Initialize MOVA structure in the current project.

## Steps:
1. Check if mova/control_v0.json exists
2. If exists, ask user: overwrite or merge?
3. Create directory structure:
   - mova/control_v0.json (from template)
   - .mova/episodes/
4. Apply preset if specified (default: base)
5. Add MOVA_CONTROL_ENTRY marker to CLAUDE.md if not present

## Interactive Preset Selection (if no --preset):

Ask user to select:
- Development: full access, verbose logging, dashboard enabled
- Staging: sandboxed, moderate logging
- Production: restricted, audit logging, OTEL enabled

## Arguments:
- $1: --preset flag
- $2: preset name (base|development|production)

## Output:
- Summary of created files
- Active configuration overview
- Next steps hint
```

### 7.3 Команда /mova:status

**Файл**: `commands/status.md`

```markdown
---
description: Show MOVA status (minimal output)
allowed-tools:
  - Read
---

Show minimal MOVA status for current project.

## Output format:
```
MOVA: [active|inactive|error]
Profile: [profile_id] v[version]
Session: [session_id] | [n] events | [duration]
Security: [n] events ([critical]/[high]/[medium]/[low])
```

## Example:
```
MOVA: active
Profile: mova_claude_control_v1 v1.0.0
Session: sess_20260121_abc | 15 events | 5m 23s
Security: 2 events (0/1/1/0)
```
```

### 7.4 Команда /mova:metrics

**Файл**: `commands/metrics.md`

```markdown
---
description: Show MOVA observability metrics
argument-hint: "[--format json|table]"
allowed-tools:
  - Read
  - Bash
---

Display aggregated metrics from .mova/episodes/

Execute: node ${CLAUDE_PLUGIN_ROOT}/services/episode_metrics_collector.js --format $1

## Metrics shown:
- Total episodes / by type
- Total events / error rate
- Tool usage distribution
- Performance stats (avg/p95/max duration)
- Security events by severity
- Session history (last 5)

## Formats:
- table (default): Human-readable table
- json: Machine-readable JSON
```

---

## 8. Конфигурация хуков

### 8.1 hooks.json

**Файл**: `hooks/hooks.json`

```json
{
  "description": "MOVA control hooks for monitoring, observing, and validating",
  "hooks": {
    "SessionStart": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/mova-observe.js --init",
            "timeout": 5000
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/mova-security.js --check prompt",
            "timeout": 5000
          },
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/skill-eval.js",
            "timeout": 5000
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/mova-guard.js --task pre-main",
            "timeout": 5000
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/mova-guard.js --task pre-bash",
            "timeout": 5000
          },
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/mova-security.js --check tool",
            "timeout": 5000
          }
        ]
      },
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/mova-guard.js --task evaluate-rules",
            "timeout": 5000
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/mova-guard.js --task post-format",
            "timeout": 30000
          },
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/mova-guard.js --task post-test",
            "timeout": 90000
          }
        ]
      },
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/mova-observe.js",
            "timeout": 5000
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/mova-observe.js --finalize",
            "timeout": 10000
          }
        ]
      }
    ]
  }
}
```

### 8.2 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_PLUGIN_ROOT` | (auto) | Путь к директории плагина |
| `CLAUDE_PROJECT_DIR` | (auto) | Путь к проекту пользователя |
| `MOVA_CORRELATION_ID` | (generated) | ID текущей сессии |
| `MOVA_DEBUG` | false | Verbose logging |
| `MOVA_OTEL_ENABLED` | false | Enable OTEL export |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | OTLP endpoint URL |

---

## 9. Пресеты и наследование

### 9.1 base.preset.json

```json
{
  "$preset": "base",
  "description": "Minimal safe configuration",
  "policy": {
    "permissions": {
      "allow": ["Read", "Glob", "Grep"],
      "deny": [],
      "on_conflict": "deny_wins",
      "on_unknown": "report_only"
    }
  },
  "guardrail_rules": [
    {
      "rule_id": "block-rm-rf",
      "effect": "deny",
      "target": { "tool": "Bash", "pattern": "rm\\s+-rf" },
      "severity": "critical",
      "on_violation": ["block", "log"]
    }
  ],
  "observability": {
    "enabled": true,
    "otel_enabled": false
  },
  "retention": {
    "episodes_days": 30,
    "auto_cleanup": true
  }
}
```

### 9.2 development.preset.json

```json
{
  "$preset": "development",
  "$inherit": "base",
  "description": "Full development access with verbose logging",
  "policy": {
    "permissions": {
      "allow": ["Bash", "Read", "Edit", "Write", "Glob", "Grep", "WebSearch", "WebFetch"],
      "on_unknown": "allow"
    }
  },
  "guardrail_rules": [
    {
      "rule_id": "warn-sudo",
      "effect": "warn",
      "target": { "tool": "Bash", "pattern": "^sudo" },
      "severity": "medium",
      "on_violation": ["warn", "log"]
    }
  ],
  "human_in_the_loop": {
    "escalation_threshold": "critical",
    "auto_approve": ["Read", "Glob", "Grep", "Edit", "Write"]
  },
  "monitoring": {
    "enabled": true,
    "port": 2773
  },
  "environs": {
    "MOVA_DEBUG": true
  }
}
```

### 9.3 production.preset.json

```json
{
  "$preset": "production",
  "$inherit": "base",
  "description": "Locked-down production with audit logging",
  "policy": {
    "permissions": {
      "allow": ["Read", "Glob", "Grep"],
      "deny": ["Bash.*rm", "Bash.*sudo", "Write.*\\.env"],
      "on_conflict": "deny_wins",
      "on_unknown": "deny"
    }
  },
  "guardrail_rules": [
    {
      "rule_id": "block-all-destructive",
      "effect": "deny",
      "target": { "tool": "Bash", "pattern": "rm|mv|chmod|chown|kill" },
      "severity": "high",
      "on_violation": ["block", "alert", "log"]
    },
    {
      "rule_id": "protect-all-secrets",
      "effect": "deny",
      "target": { "path_glob": "**/*.{env,pem,key,secret}" },
      "severity": "critical",
      "on_violation": ["block", "alert"]
    }
  ],
  "human_in_the_loop": {
    "escalation_threshold": "medium",
    "always_confirm": [
      { "tool": "Edit" },
      { "tool": "Write" },
      { "tool": "Bash" }
    ]
  },
  "observability": {
    "enabled": true,
    "otel_enabled": true
  },
  "retention": {
    "episodes_days": 365,
    "security_events_days": 730,
    "auto_cleanup": false
  }
}
```

---

## 10. UX и интерфейс

### 10.1 Progressive Disclosure

| Уровень | Команда | Информация |
|---------|---------|------------|
| Minimal | `/mova:status` | 1 строка: статус, profile, events count |
| Standard | `/mova:context` | Таблица: config, hooks, permissions |
| Standard | `/mova:metrics` | Таблица: metrics, tool usage, performance |
| Verbose | `/mova:debug` | Full: episodes JSONL, traces, raw data |

### 10.2 Inline Feedback (Hook Output)

```
[MOVA] Session started | correlation: sess_abc123
[MOVA] Skill matched: security-basics (0.85)
[MOVA] pre-bash ✓ | guard ✓
[MOVA] ⚠ guardrail: warn-sudo triggered (medium)
[MOVA] post-format ✓ | post-test ✓
[MOVA] Episode recorded: ep_20260121_def456
[MOVA] Session ended | 12 events | 3m 45s | 0 security issues
```

### 10.3 Preset Wizard (Interactive Init)

```
/mova:init

MOVA Initialization

? Select security preset:
  ❯ Development - Full access, verbose logging
    Staging - Sandboxed, moderate logging
    Production - Restricted, audit logging

? Enable real-time dashboard? (y/N)

? Enable OpenTelemetry export? (y/N)

Creating configuration...
✓ mova/control_v0.json created
✓ .mova/episodes/ directory created
✓ CLAUDE.md marker added

MOVA initialized with 'development' preset.
Run /mova:status to verify.
```

---

## 11. Audit и Compliance

### 11.1 Compliance-Ready Episode Fields

```json
{
  "compliance": {
    "data_classification": "internal",
    "retention_days": 180,
    "exportable": true,
    "redacted_fields": ["api_key", "token", "password"],
    "audit_required": true
  }
}
```

### 11.2 Retention Policy Settings

```json
{
  "retention": {
    "episodes_days": 90,
    "security_events_days": 365,
    "metrics_days": 30,
    "auto_cleanup": true,
    "cleanup_schedule": "daily",
    "archive_before_delete": true,
    "archive_format": "gzip"
  }
}
```

### 11.3 Export Formats

| Формат | Команда | Применение |
|--------|---------|------------|
| JSONL | `/mova:debug --format jsonl` | Machine analysis |
| CSV | `/mova:metrics --format csv` | Spreadsheet |
| OTEL | auto (if enabled) | Enterprise platforms |

---

## 12. План имплементации

### Phase 1: Foundation (P0)

**Срок**: Sprint 1

| Задача | Файлы | Описание |
|--------|-------|----------|
| 1.1 | `.claude-plugin/plugin.json` | Создать манифест плагина |
| 1.2 | `commands/*.md` | Перенести и адаптировать команды |
| 1.3 | `hooks/hooks.json` | Создать конфигурацию хуков |
| 1.4 | `scripts/*.js` | Адаптировать пути к `${CLAUDE_PLUGIN_ROOT}` |
| 1.5 | `config/defaults.json` | Базовые настройки плагина |
| 1.6 | `package.json` | npm package configuration |

### Phase 2: Security Hardening (P0)

**Срок**: Sprint 2

| Задача | Файлы | Описание |
|--------|-------|----------|
| 2.1 | `scripts/mova-security.js` | Security classifier (NEW) |
| 2.2 | `config/security-events.json` | Каталог 6 типов событий |
| 2.3 | `scripts/mova-guard.js` | Добавить severity + on_violation |
| 2.4 | `schemas/guardrail_rule.schema.json` | JSON Schema для правил |
| 2.5 | Update presets | Добавить guardrail_rules |

### Phase 3: Observability Enhancement (P1)

**Срок**: Sprint 3

| Задача | Файлы | Описание |
|--------|-------|----------|
| 3.1 | `services/episode_writer.js` | Структура MOVA 4.1.1 |
| 3.2 | `schemas/episode_v1.schema.json` | JSON Schema для эпизодов |
| 3.3 | `scripts/mova-observe.js` | Correlation + tracing |
| 3.4 | `services/otel_exporter.js` | OpenTelemetry экспорт (NEW) |
| 3.5 | `commands/debug.md` | Verbose output команда |

### Phase 4: Human-in-the-Loop (P1)

**Срок**: Sprint 4

| Задача | Файлы | Описание |
|--------|-------|----------|
| 4.1 | `scripts/mova-guard.js` | Confirmation logic |
| 4.2 | Update presets | human_in_the_loop config |
| 4.3 | Hook output | Inline feedback messages |

### Phase 5: UX & Compliance (P2)

**Срок**: Sprint 5

| Задача | Файлы | Описание |
|--------|-------|----------|
| 5.1 | `commands/init.md` | Interactive preset wizard |
| 5.2 | `commands/status.md` | Minimal output |
| 5.3 | Retention logic | Cleanup service |
| 5.4 | Export formats | CSV, JSONL export |

### Phase 6: Testing & Release (P2)

**Срок**: Sprint 6

| Задача | Описание |
|--------|----------|
| 6.1 | Local testing: `claude --plugin-dir ./` |
| 6.2 | Test all slash-commands |
| 6.3 | Test all hooks on all events |
| 6.4 | Validate episode structure |
| 6.5 | README.md documentation |
| 6.6 | npm publish |

---

## 13. Acceptance Criteria

### 13.1 Functional Requirements

| ID | Requirement | Verification |
|----|-------------|--------------|
| F1 | Plugin installs via `claude plugin add` | Manual test |
| F2 | All 12 slash-commands work | Manual test each |
| F3 | Hooks fire on all events | Log verification |
| F4 | Security events logged correctly | Schema validation |
| F5 | Episodes match MOVA 4.1.1 schema | JSON Schema validation |
| F6 | Presets apply correctly | Diff verification |
| F7 | OTEL metrics export (when enabled) | Backend verification |

### 13.2 Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NF1 | Hook execution time | < 5s (except post-test) |
| NF2 | Episode write time | < 100ms |
| NF3 | Plugin load time | < 2s |
| NF4 | Memory usage | < 50MB |

### 13.3 Backward Compatibility

| ID | Requirement |
|----|-------------|
| BC1 | Detect existing `mova/control_v0.json` |
| BC2 | Preserve existing `.mova/episodes/` |
| BC3 | Merge project hooks with plugin hooks |
| BC4 | Support `$inherit` in existing presets |

### 13.4 Definition of Done

- [ ] All F* requirements pass
- [ ] All NF* requirements meet targets
- [ ] All BC* requirements verified
- [ ] README.md complete
- [ ] CHANGELOG.md updated
- [ ] npm package published
- [ ] GitHub release created
