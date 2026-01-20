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
<project>/
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

### Recommended flow (control_v0)

```
npx mova-claude-import init --out <dir>
npx mova-claude-import control prefill --project <dir> --out <dir>
npx mova-claude-import control apply --project <dir> --profile <dir>/mova/control_v0.json --mode apply
npx mova-claude-import control check --project <dir> --profile <dir>/mova/control_v0.json
```

### У меня уже есть папка Claude Code‑проекта

```
npx mova-claude-import --project <in> --out <out> --zip
```

### Quick start (existing Claude folder + preset)

```
npx -y mova-claude-import@<version> preset list
npx -y mova-claude-import@<version> control apply --preset safe_observable_v0 --project . --mode overlay
```

Дальше используйте единый контрольный файл и выполните rebuild/import:

```
<out>/mova/control_v0.json
npx mova-claude-import --project <in> --out <out> --zip
```

### Я хочу создать эталонный профиль с нуля (init)

```
npx mova-claude-import init --out <dir> --zip
```

Заполните единый контрольный файл:

```
<dir>/mova/control_v0.json
```

Затем выполните rebuild/import:

```
npx mova-claude-import --project <dir> --out <out> --zip
```

### Контроль (preview по умолчанию)

```
npx mova-claude-import control apply --project <in> --profile <out>/claude_control_profile_v0.json --mode apply
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
- `.mova/episodes/<run_id>/summary.json` — краткая сводка последнего прогона

## Наблюдаемость (Observability Writer)

Writer включается из `mova/control_v0.json` и через hooks пишет эпизоды:

- события в `.mova/episodes/<run_id>/events.jsonl`
- сводка в `.mova/episodes/<run_id>/summary.json`
- индекс прогонов в `.mova/episodes/index.jsonl`

Отключить можно через `observability.enable=false` в `mova/control_v0.json`.

Минимальные команды:

```
npx mova-claude-import observe list --project <dir>
npx mova-claude-import observe tail --project <dir> --run <id>
npx mova-claude-import observe summary --project <dir> --run <id>
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
