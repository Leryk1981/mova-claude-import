# Архитектурные рекомендации для MOVA Plugin

## Обзор

Рекомендации основаны на:
- Спецификации MOVA 4.1.1
- Best practices Anthropic 2025-2026
- Анализе текущей реализации проекта

---

## 1. Безопасность (Security Layer)

### 1.1 Формализация Security Events

**Текущее состояние**: Базовая редакция sensitive данных в `mova-observe.js`.

**Рекомендация**: Внедрить полноценную систему Security Events по MOVA 4.1.1.

| Тип события | Реагирование | Применение |
|-------------|--------------|------------|
| `instruction_profile_invalid` | block + alert | Невалидный control_v0.json |
| `prompt_injection_suspected` | warn + log | Подозрительные паттерны в промптах |
| `forbidden_tool_requested` | block + log | Попытка вызова запрещённого инструмента |
| `rate_limit_exceeded` | fallback + log | Превышение лимитов API |
| `sensitive_data_access_suspected` | block + alert | Доступ к секретам/credentials |

**Архитектура**:
```
UserPrompt/ToolUse
       ↓
[Security Classifier] → security_event_type
       ↓
[Policy Evaluator] → effect: allow|deny|warn|log_only
       ↓
[Action Dispatcher] → log|alert|block|fallback
       ↓
[Episode Writer] → security_event_episode
```

### 1.2 Severity Levels для Guardrails

**Текущее состояние**: Бинарные allow/deny правила.

**Рекомендация**: Добавить severity и on_violation actions:

```json
{
  "rule_id": "block-rm-rf",
  "effect": "deny",
  "severity": "critical",
  "on_violation": ["block_request", "alert_owner", "log"]
}
```

**Уровни severity**:
- `info` — логирование без действий
- `low` — warn + continue
- `medium` — require confirmation
- `high` — block + notify
- `critical` — block + alert + escalate

### 1.3 Sandboxing Integration

**Рекомендация**: Использовать sandbox-режим Claude Code как первую линию защиты.

**Конфигурация в control_v0.json**:
```json
{
  "security": {
    "sandbox_mode": "strict",
    "allowed_directories": ["${PROJECT_DIR}"],
    "network_policy": "internal_only"
  }
}
```

**Преимущества**:
- Снижение запросов разрешений на 84%
- OS-level изоляция (bubblewrap/seatbelt)
- Совместимость с MOVA guardrails

---

## 2. Наблюдаемость (Observability Layer)

### 2.1 Полная структура Episode по MOVA 4.1.1

**Текущее состояние**: Упрощённый формат в `events.jsonl`.

**Рекомендация**: Привести к `ds.mova_episode_core_v1`:

```json
{
  "episode_id": "ep_20260121_abc123",
  "episode_type": "execution",
  "mova_version": "4.1.1",
  "recorded_at": "2026-01-21T10:30:00Z",
  "executor": {
    "executor_id": "claude-opus-4.5",
    "role": "agent",
    "executor_kind": "AI model"
  },
  "result_status": "completed",
  "result_summary": "File edited successfully",
  "result_details": {
    "duration_ms": 1234,
    "tokens_used": 500,
    "tool_name": "Edit"
  },
  "meta_episode": {
    "correlation_id": "session_xyz",
    "parent_episode_id": null,
    "trace_id": "trace_123"
  }
}
```

### 2.2 OpenTelemetry Integration

**Рекомендация**: Добавить OTEL экспорт для enterprise совместимости.

**Архитектура**:
```
[mova-observe.js]
       ↓
[Episode Writer] → .mova/episodes/
       ↓
[OTEL Exporter] → Honeycomb/Datadog/Prometheus
```

**Метрики для экспорта**:
| Метрика | Тип | Описание |
|---------|-----|----------|
| `mova.episode.duration` | histogram | Время выполнения |
| `mova.episode.count` | counter | Количество эпизодов |
| `mova.security.events` | counter | Security события по типу |
| `mova.tool.usage` | counter | Использование инструментов |
| `mova.error.rate` | gauge | Процент ошибок |

### 2.3 Correlation и Tracing

**Рекомендация**: Добавить сквозную трассировку сессий.

```
Session Start
    │
    ├─→ correlation_id = session_{uuid}
    │
    ├─→ Episode 1 (parent=null)
    │      └─→ Episode 1.1 (parent=Episode 1)
    │
    ├─→ Episode 2 (parent=null)
    │
    └─→ Session End (finalize summary)
```

**Добавить в `mova-observe.js`**:
- `MOVA_CORRELATION_ID` — сквозной ID сессии
- `parent_episode_id` — для вложенных операций

---

## 3. Контроль (Validation Layer)

### 3.1 Instruction Profile по MOVA 4.1.1

**Текущее состояние**: `claude_control_profile_v0` — кастомная схема.

**Рекомендация**: Синхронизировать с `ds.instruction_profile_core_v1`:

```json
{
  "profile_id": "mova_claude_control_v1",
  "profile_version": "1.0.0",
  "security_model_version": "mova_security_default_v1",
  "status": "active",
  "applies_to": {
    "executor_kinds": ["AI model"],
    "roles": ["agent"],
    "tags": ["claude-code"]
  },
  "guardrail_rules": [...]
}
```

### 3.2 Human-in-the-Loop Integration

**Рекомендация**: Добавить явные точки эскалации.

**Критерии эскалации**:
| Критерий | Действие |
|----------|----------|
| `severity >= high` | Требовать подтверждение |
| `confidence < 0.7` | Предложить варианты |
| `destructive_operation` | Показать preview + confirm |
| `external_api_call` | Логировать + rate limit |

**Конфигурация**:
```json
{
  "human_in_the_loop": {
    "escalation_threshold": "high",
    "auto_approve": ["Read", "Glob", "Grep"],
    "always_confirm": ["Bash.*rm", "Write.*secret"]
  }
}
```

### 3.3 Text Channel Separation

**Рекомендация**: Разделить каналы по MOVA 4.1.1.

| Канал | Применение | Пример |
|-------|------------|--------|
| `human_facing_ui` | Вывод пользователю | "Файл успешно изменён" |
| `model_instruction` | Системные инструкции | Содержимое SKILL.md |
| `system_log` | Технические логи | Episode JSON |

**Преимущества**:
- Чёткое разделение ответственности
- Защита от prompt injection через UI
- Audit-friendly логирование

---

## 4. Улучшения UX

### 4.1 Progressive Disclosure

**Рекомендация**: Уровни детализации для разных пользователей.

| Уровень | Команда | Вывод |
|---------|---------|-------|
| Minimal | `/mova:status` | 🟢 MOVA active, 3 events |
| Standard | `/mova:metrics` | Таблица метрик |
| Verbose | `/mova:debug` | Полные эпизоды + traces |

### 4.2 Preset Wizard

**Рекомендация**: Интерактивный выбор пресета при инициализации.

```
/mova:init

? Select security level:
  ○ Development (full access, verbose logging)
  ○ Staging (sandboxed, moderate logging)
  ● Production (restricted, audit logging)

? Enable dashboard?
  ○ Yes (port 2773)
  ● No

Creating mova/control_v0.json with production preset...
```

### 4.3 Inline Feedback

**Рекомендация**: Показывать MOVA статус в контексте.

```
You: Edit the config file

[MOVA] pre-main ✓ | pre-bash ○ | guard ✓

Claude: I'll edit the file...

[MOVA] post-format ✓ | post-test ✓ | observe ✓
       Duration: 1.2s | Tokens: 450
```

---

## 5. Audit и Compliance

### 5.1 Compliance-Ready Episodes

**Рекомендация**: Структура для enterprise audit.

```json
{
  "episode_id": "...",
  "compliance": {
    "data_classification": "internal",
    "retention_days": 180,
    "exportable": true,
    "redacted_fields": ["api_key", "token"]
  }
}
```

### 5.2 Retention Policy

**Рекомендация**: Конфигурируемая политика хранения.

```json
{
  "retention": {
    "episodes_days": 90,
    "security_events_days": 365,
    "metrics_days": 30,
    "auto_cleanup": true
  }
}
```

### 5.3 Export Formats

**Рекомендация**: Поддержка стандартных форматов.

| Формат | Применение |
|--------|------------|
| JSONL | Машинный анализ |
| CSV | Spreadsheet анализ |
| OTEL | Enterprise observability |
| SIEM | Security tools (Splunk, etc.) |

---

## 6. Архитектурные паттерны

### 6.1 Layered Security Model

```
┌─────────────────────────────────────────┐
│           Claude Code Sandbox           │ ← OS-level isolation
├─────────────────────────────────────────┤
│         MOVA Permission Policy          │ ← allow/deny rules
├─────────────────────────────────────────┤
│         MOVA Guardrail Rules            │ ← severity + actions
├─────────────────────────────────────────┤
│         MOVA Security Events            │ ← detection + response
├─────────────────────────────────────────┤
│         Episode Audit Trail             │ ← compliance logging
└─────────────────────────────────────────┘
```

### 6.2 Event Flow

```
┌──────────────┐
│ User Prompt  │
└──────┬───────┘
       ↓
┌──────────────┐     ┌─────────────────┐
│ Skill Eval   │────→│ Load SKILL.md   │
└──────┬───────┘     └─────────────────┘
       ↓
┌──────────────┐     ┌─────────────────┐
│ Pre-ToolUse  │────→│ Security Check  │
└──────┬───────┘     │ - instruction   │
       │             │ - injection     │
       ↓ block?      │ - forbidden     │
       ↓             └─────────────────┘
┌──────────────┐
│ Tool Execute │
└──────┬───────┘
       ↓
┌──────────────┐     ┌─────────────────┐
│ Post-ToolUse │────→│ Format + Test   │
└──────┬───────┘     └─────────────────┘
       ↓
┌──────────────┐     ┌─────────────────┐
│ Observe      │────→│ Write Episode   │
└──────────────┘     │ + OTEL Export   │
                     └─────────────────┘
```

### 6.3 Configuration Inheritance

```
┌────────────────────────┐
│ MOVA Defaults (plugin) │
└──────────┬─────────────┘
           ↓ merge
┌────────────────────────┐
│ Preset (base/dev/prod) │
└──────────┬─────────────┘
           ↓ merge
┌────────────────────────┐
│ Project control_v0     │
└──────────┬─────────────┘
           ↓ merge
┌────────────────────────┐
│ Environment Variables  │
└────────────────────────┘
```

---

## 7. Migration Path

### Phase 1: Security Hardening
1. Добавить severity levels к guardrails
2. Реализовать 6 типов security events
3. Интегрировать с Claude Code sandbox

### Phase 2: Observability Enhancement
1. Привести episodes к MOVA 4.1.1
2. Добавить correlation/tracing
3. Реализовать OTEL экспорт

### Phase 3: UX Improvements
1. Добавить preset wizard
2. Реализовать progressive disclosure
3. Inline feedback в Claude Code

### Phase 4: Compliance Features
1. Retention policies
2. Export formats
3. SIEM integration

---

## 8. Приоритеты реализации

| Рекомендация | Приоритет | Сложность | Влияние |
|--------------|-----------|-----------|---------|
| Security Events (6 типов) | P0 | Средняя | Высокое |
| Severity + on_violation | P0 | Низкая | Высокое |
| Episode структура MOVA 4.1.1 | P1 | Средняя | Среднее |
| Correlation/Tracing | P1 | Средняя | Среднее |
| OTEL Export | P2 | Высокая | Среднее |
| Human-in-the-Loop | P1 | Средняя | Высокое |
| Text Channel Separation | P2 | Низкая | Низкое |
| Preset Wizard | P2 | Низкая | Среднее |
| Retention Policies | P3 | Низкая | Среднее |
| SIEM Export | P3 | Высокая | Низкое |
