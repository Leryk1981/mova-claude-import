# ТЗ: Миграция MOVA в npm-пакет плагина Claude Code

## 1. Цель

Перенести слой MOVA (Monitoring, Observing, Validating Agent) из встроенного компонента в отдельный **npm-пакет плагина** с манифестом `.claude-plugin/plugin.json`.

## 2. Целевая структура плагина

```
@mova/claude-plugin/
├── .claude-plugin/
│   └── plugin.json              # Манифест плагина
├── commands/                    # Slash-команды → /mova:*
│   ├── context.md              # /mova:context
│   ├── lint.md                 # /mova:lint
│   ├── start.md                # /mova:start
│   ├── finish.md               # /mova:finish
│   ├── metrics.md              # /mova:metrics
│   ├── dashboard.md            # /mova:dashboard
│   └── preset/
│       ├── list.md             # /mova:preset:list
│       ├── apply.md            # /mova:preset:apply
│       └── info.md             # /mova:preset:info
├── agents/
│   └── code-reviewer.md        # Субагент ревью кода
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
├── hooks/
│   └── hooks.json              # Конфигурация хуков
├── scripts/
│   ├── mova-guard.js           # Валидация операций
│   ├── mova-observe.js         # Сбор событий
│   └── skill-eval.js           # Оценка компетенций
├── services/
│   ├── env_resolver.js         # Разрешение переменных
│   ├── preset_manager.js       # Управление пресетами
│   ├── episode_metrics_collector.js
│   ├── dashboard_server.js
│   └── hot_reloader.js
├── presets/
│   ├── base.preset_v0.json
│   ├── development.preset_v0.json
│   └── production.preset_v0.json
├── rules/
│   ├── code-style.md
│   └── security.md
├── config/
│   ├── skill-rules.json
│   └── default-control.json    # Шаблон control_v0.json
├── package.json
└── README.md
```

## 3. Манифест plugin.json

```json
{
  "name": "mova",
  "version": "0.2.0",
  "description": "MOVA - Monitoring, Observing, Validating Agent layer for Claude Code",
  "author": {
    "name": "MOVA Team"
  },
  "repository": "https://github.com/mova/claude-plugin",
  "license": "MIT",
  "engines": {
    "claude-code": ">=1.0.0",
    "node": ">=18.0.0"
  },
  "keywords": ["monitoring", "observability", "validation", "guard", "hooks"]
}
```

## 4. Конфигурация хуков (hooks/hooks.json)

```json
{
  "description": "MOVA control hooks for monitoring, observing, and validating",
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": ".*",
        "hooks": [
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
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

## 5. Slash-команды

### 5.1 /mova:context (commands/context.md)

```markdown
---
description: Show MOVA project context and summary
allowed-tools:
  - Read
---

Read and summarize the MOVA configuration from ${CLAUDE_PROJECT_DIR}/mova/control_v0.json.
Include active presets, enabled hooks, and observability status.
```

### 5.2 /mova:lint (commands/lint.md)

```markdown
---
description: Run MOVA structural validation
argument-hint: "[--fix]"
allowed-tools:
  - Read
  - Bash
---

Run MOVA structural checks on the project.
If --fix is passed, attempt to auto-fix issues.
Report results from mova/claude_import/v0/lint_report_v0.json.
```

### 5.3 /mova:metrics (commands/metrics.md)

```markdown
---
description: Show MOVA observability metrics
allowed-tools:
  - Read
  - Bash
---

Execute: node ${CLAUDE_PLUGIN_ROOT}/services/episode_metrics_collector.js
Display aggregated metrics from .mova/episodes/
```

### 5.4 /mova:dashboard (commands/dashboard.md)

```markdown
---
description: Start/stop MOVA monitoring dashboard
argument-hint: "[start|stop|status]"
allowed-tools:
  - Bash
---

Control the MOVA WebSocket dashboard server.
Default port: 2773
Execute: node ${CLAUDE_PLUGIN_ROOT}/services/dashboard_server.js $1
```

### 5.5 /mova:preset:apply (commands/preset/apply.md)

```markdown
---
description: Apply a MOVA configuration preset
argument-hint: "<preset-name>"
allowed-tools:
  - Read
  - Write
  - Bash
---

Apply the specified preset to mova/control_v0.json.
Available presets: base, development, production
Execute: node ${CLAUDE_PLUGIN_ROOT}/services/preset_manager.js apply $1
```

## 6. Адаптация скриптов

### 6.1 Изменения в скриптах хуков

Все скрипты должны использовать переменные окружения плагина:

```javascript
// scripts/mova-guard.js
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || __dirname.replace('/scripts', '');
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// Пути к конфигам
const controlPath = path.join(PROJECT_DIR, 'mova/control_v0.json');
const presetsDir = path.join(PLUGIN_ROOT, 'presets');
const rulesPath = path.join(PLUGIN_ROOT, 'config/skill-rules.json');
```

### 6.2 Эпизоды наблюдения

Данные наблюдения сохраняются в проекте пользователя:

```javascript
// scripts/mova-observe.js
const episodesDir = path.join(PROJECT_DIR, '.mova/episodes');
```

## 7. Инициализация проекта

### 7.1 Команда /mova:init (commands/init.md)

```markdown
---
description: Initialize MOVA in current project
argument-hint: "[--preset <name>]"
allowed-tools:
  - Read
  - Write
  - Bash
---

Initialize MOVA structure in ${CLAUDE_PROJECT_DIR}:
1. Create mova/control_v0.json from template
2. Create .mova/episodes/ directory
3. Apply preset if specified (default: base)
4. Add MOVA_CONTROL_ENTRY marker to CLAUDE.md
```

### 7.2 Шаблон control_v0.json

Файл `config/default-control.json` содержит минимальную конфигурацию:

```json
{
  "$schema": "https://mova.dev/schemas/control_v0.schema.json",
  "version": "0.2.0",
  "observability": {
    "enabled": true,
    "episodes_dir": ".mova/episodes"
  },
  "monitoring": {
    "enabled": false,
    "port": 2773
  },
  "versioning": {
    "backup_on_change": true
  }
}
```

## 8. package.json плагина

```json
{
  "name": "@mova/claude-plugin",
  "version": "0.2.0",
  "description": "MOVA - Monitoring, Observing, Validating Agent plugin for Claude Code",
  "main": "index.js",
  "bin": {
    "mova-guard": "./scripts/mova-guard.js",
    "mova-observe": "./scripts/mova-observe.js",
    "mova-dashboard": "./services/dashboard_server.js"
  },
  "files": [
    ".claude-plugin/",
    "commands/",
    "agents/",
    "skills/",
    "hooks/",
    "scripts/",
    "services/",
    "presets/",
    "rules/",
    "config/"
  ],
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "claude-code-plugin",
    "mova",
    "monitoring",
    "observability",
    "validation"
  ],
  "author": "MOVA Team",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/mova/claude-plugin"
  }
}
```

## 9. Установка и использование

### 9.1 Установка из npm

```bash
claude plugin add @mova/claude-plugin
```

### 9.2 Установка из репозитория

```bash
claude --plugin-dir /path/to/mova-plugin
```

### 9.3 Доступные команды после установки

| Команда | Описание |
|---------|----------|
| `/mova:init` | Инициализация MOVA в проекте |
| `/mova:context` | Показать контекст проекта |
| `/mova:lint` | Структурная валидация |
| `/mova:metrics` | Метрики наблюдения |
| `/mova:dashboard` | Управление дашбордом |
| `/mova:preset:list` | Список пресетов |
| `/mova:preset:apply` | Применить пресет |
| `/mova:preset:info` | Информация о пресете |
| `/mova:start` | Начало сессии |
| `/mova:finish` | Завершение сессии |

## 10. План миграции

### Этап 1: Подготовка структуры

1. Создать директорию `packages/mova-plugin/`
2. Создать `.claude-plugin/plugin.json`
3. Перенести `commands/` из `.claude/commands/`
4. Добавить namespace `mova:` к командам

### Этап 2: Адаптация хуков

1. Создать `hooks/hooks.json`
2. Перенести скрипты в `scripts/`
3. Заменить абсолютные пути на `${CLAUDE_PLUGIN_ROOT}`
4. Добавить fallback для `${CLAUDE_PROJECT_DIR}`

### Этап 3: Перенос сервисов

1. Перенести `services/` без изменений
2. Обновить пути к конфигам
3. Добавить CLI интерфейс для каждого сервиса

### Этап 4: Skills и Agents

1. Перенести `skills/` из `.claude/skills/`
2. Перенести `agents/` из `.claude/agents/`
3. Обновить ссылки в SKILL.md файлах

### Этап 5: Тестирование

1. Локальное тестирование: `claude --plugin-dir ./packages/mova-plugin`
2. Проверка всех slash-команд
3. Проверка хуков на всех событиях
4. Валидация эпизодов наблюдения

### Этап 6: Публикация

1. Настроить `package.json`
2. Добавить README.md с документацией
3. Опубликовать: `npm publish --access public`

## 11. Обратная совместимость

Для проектов с существующей интеграцией MOVA:

1. Плагин детектирует `mova/control_v0.json` и использует его
2. Существующие `.mova/episodes/` сохраняются
3. Хуки из `control_v0.json` объединяются с хуками плагина
4. Приоритет: project hooks > plugin hooks

## 12. Ограничения

1. Skills не получают namespace — остаются глобальными
2. Rules из плагина требуют ручного включения в проект
3. MCP серверы через плагин пока не поддерживаются (roadmap)
