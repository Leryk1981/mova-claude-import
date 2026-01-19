# mova-claude-import

Детерминированный генератор и контролёр структуры Claude Code‑проекта с наблюдаемостью MOVA.

## Что делает инструмент

- создаёт полный “эталонный” скелет Claude Code‑проекта;
- импортирует существующий проект в чистую структуру;
- добавляет слой контроля и отчёты без “магии” и без LLM.

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
    claude_import/v0/...
    claude_control/v0/runs/...
```

## Быстрый старт

### У меня уже есть папка Claude Code‑проекта

```
npx mova-claude-import --project <in> --out <out> --zip
```

Дальше добавьте контрольный профиль и проверьте план:

```
npx mova-claude-import control prefill --project <in> --out <out>
npx mova-claude-import control check --project <in> --profile <out>/claude_control_profile_v0.json
```

### Я хочу создать эталонный профиль с нуля (init)

```
npx mova-claude-import init --out <dir> --zip
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

Канон схем control‑слоя: `schemas/claude_control/v0/{ds,env,global}`.

## Где смотреть отчёты/доказательства

- `mova/claude_import/v0/*` — отчёты импорта и контроля качества
- `mova/claude_control/v0/runs/*` — планы/отчёты control‑команд

## Для автоматизации

Подробности по `--strict`, кодам завершения и CI‑проверкам — в `docs/OPERATOR_GUIDE_v0.md`.

## Ссылки

- `docs/COMPATIBILITY_MATRIX.md`
- `docs/MOVA_SPEC_BINDINGS.md`
