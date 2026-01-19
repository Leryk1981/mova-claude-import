# Operator Guide v0

## Контрольные поверхности Claude Code

Основные точки контроля, которые всегда существуют в эталонном профиле:

- `CLAUDE.md` (маркер `<!-- MOVA_CONTROL_ENTRY_V0 -->`)
- `.claude/settings.json`
- `.claude/settings.local.example.json`
- `.claude/commands/`
- `.claude/agents/`
- `.claude/output-styles/`
- `.claude/hooks/`
- `.mcp.json`

## Как MOVA слой добавляет наблюдаемость

- Импорт и проверки пишут отчёты в `mova/claude_import/v0/`.
- Control‑команды пишут планы/отчёты в `mova/claude_control/v0/runs/<run_id>/`.
- Канон control‑схем: `schemas/claude_control/v0/{ds,env,global}`.

## Control команды

- `control prefill` — создаёт профиль `claude_control_profile_v0.json` и `prefill_report_v0.json`.
- `control check` — строит план, ничего не меняет.
- `control apply` — применяет изменения при `--mode apply`, иначе preview.

## Жёсткие режимы (для автоматизации)

`--strict` предназначен для CI/проверок: при запрещённых входах он останавливает процесс и возвращает код 2.
Для пользовательских сценариев по умолчанию применяется мягкий режим (preview + отчёт).

## Коды завершения CLI

- `0` — успех или preview‑план построен.
- `1` — неожиданный runtime‑сбой.
- `2` — автоматизация остановлена политикой контроля (strict/CI).
