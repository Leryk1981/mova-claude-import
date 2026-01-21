# mova-claude-import

Детерминированный генератор и контролёр структуры Claude Code‑проекта с наблюдаемостью MOVA.

## Что делает инструмент

- создаёт полный “эталонный” скелет Claude Code‑проекта;
- импортирует существующий проект в чистую структуру;
- добавляет слой контроля, наблюдаемости и отчёты без “магии” и без LLM.

## Что было → что стало

Было: разрозненные файлы, нет единой точки контроля, нечего “применять”.

Стало (минимальный срез):

```
.\project\
  CLAUDE.md
  .claude/
    settings.json
    settings.local.example.json
    commands/
    agents/
    output-styles/
    hooks/
  .mcp.json
  mova/
    control_v0.json
    claude_import/v0/...
    claude_control/v0/runs/...
```

## Быстрый старт

## Где размещать файлы проекта

Claude Code читает инструкции из корня репозитория. После генерации профиля (init/preset) поместите в корень:

- `CLAUDE.md`
- `.claude/` (settings, commands, agents, hooks, rules, skills)
- `.mcp.json`
- `mova/` (control_v0.json и отчеты)

Если preset/профиль был создан в отдельной папке (например, `out`), просто перенесите эти файлы и папки в корень целевого репозитория без изменения относительных путей.

Если перенести эти папки не в корень, Claude Code и `mova-claude-import` не найдут настройки.

### Recommended flow (control_v0)

```
mkdir .\claude_profile -Force
npx -y mova-claude-import@latest init --out .\claude_profile
npx -y mova-claude-import@latest control prefill --project .\claude_profile --out .\prefill_out
npx -y mova-claude-import@latest control apply --project .\claude_profile --profile .\claude_profile\mova\control_v0.json --mode apply
npx -y mova-claude-import@latest control check --project .\claude_profile --profile .\claude_profile\mova\control_v0.json
```

### У меня уже есть папка Claude Code‑проекта

```
npx -y mova-claude-import@latest --project .\claude_profile --out .\out --zip
```

### Quick start (existing Claude folder + preset)

```
npx -y mova-claude-import@latest preset list
npx -y mova-claude-import@latest control apply --preset safe_observable_v0 --project . --mode overlay
```

### Unification services (opt-in)

```
node services/env_resolver.js resolve mova/control_v0.json
node services/preset_manager.js list
DASHBOARD_ENABLED=true node services/dashboard_server.js start
HOT_RELOAD_ENABLED=true node services/hot_reloader.js backup my-backup
```

Дальше используйте единый контрольный файл и выполните rebuild/import:

```
.\out\mova\control_v0.json
npx -y mova-claude-import@latest --project .\claude_project --out .\out --zip
```

### Я хочу создать эталонный профиль с нуля (init)

```
npx -y mova-claude-import@latest init --out .\claude_profile --zip
```

Заполните единый контрольный файл:

```
.\claude_profile\mova\control_v0.json
```

Затем выполните rebuild/import:

```
npx -y mova-claude-import@latest --project .\claude_profile --out .\out --zip
```

### Контроль (preview по умолчанию)

```
npx -y mova-claude-import@latest control apply --project .\claude_profile --profile .\prefill_out\claude_control_profile_v0.json --mode apply
```

## Демо (60 секунд)

```
npm run demo
```

## Где настраивается контроль

Файл профиля: `claude_control_profile_v0.json` (создаётся через `control prefill`).
Руководство: `docs/CONTROL_PROFILE_GUIDE_v0.md`.
Примеры: `examples/control_profile_min.json`, `examples/control_profile_standard.json`, `examples/control_profile_strict.json`.

Единый контрольный файл для rebuild/import: `mova/control_v0.json`.
Schema: `schemas/mova.control_v0.schema.json`.

Канон схем control‑слоя: `schemas/claude_control/v0/{ds,env,global}`.

## Где смотреть отчёты/доказательства

- `mova/claude_import/v0/*` — отчёты импорта и контроля качества
- `mova/claude_control/v0/runs/*` — планы/отчёты control‑команд
- `.mova/episodes/index.jsonl` — индекс наблюдаемости
- `.mova/episodes/run_.../summary.json` — краткая сводка последнего прогона

## Наблюдаемость (Observability Writer)

Writer включается из `mova/control_v0.json` и через hooks пишет эпизоды:

- события в `.mova/episodes/run_.../events.jsonl`
- сводка в `.mova/episodes/run_.../summary.json`
- индекс прогонов в `.mova/episodes/index.jsonl`

Отключить можно через `observability.enable=false` в `mova/control_v0.json`.

Минимальные команды:

```
npx -y mova-claude-import@latest observe list --project .\claude_profile
$run = (Get-ChildItem .\claude_profile\.mova\episodes -Directory | Sort-Object Name -Descending | Select-Object -First 1).Name
npx -y mova-claude-import@latest observe tail --project .\claude_profile --run $run
npx -y mova-claude-import@latest observe summary --project .\claude_profile --run $run
```

## Для автоматизации

Подробности по `--strict`, кодам завершения и CI‑проверкам — в `docs/OPERATOR_GUIDE_v0.md`.

## Preset: safe_observable_v0

Что делает:
- включает observability writer и hooks
- добавляет guardrails на опасные команды и изменения в `main`
- добавляет start/finish команды и базовые skills
- включает skill-eval hook и правила

Что не делает:
- не включает MCP (по умолчанию пусто)
- не трогает секреты или локальные креды

## Ссылки

- `docs/COMPATIBILITY_MATRIX.md`
- `docs/MOVA_SPEC_BINDINGS.md`
