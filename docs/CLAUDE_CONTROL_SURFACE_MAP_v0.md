# Claude Control Surface Map v0

## Как было в Claude Code

Основные файлы контроля:

- `CLAUDE.md` — project memory и правила.
- `.claude/settings.json` — hooks, permissions, plugins, MCP toggles.
- `.mcp.json` — MCP servers и env placeholders.
- `.claude/skills/` — навыки.
- `.claude/agents/` — агенты.
- `.claude/commands/` — команды.
- `.claude/rules/` — правила.
- `.claude/hooks/` — hook scripts и skill rules.
- `.github/workflows/` — CI сценарии.

## Как стало с MOVA control

Один источник истины: `mova/control_v0.json`.

Из него генерируются:

- `CLAUDE.md` (MOVA Control Entry block по маркеру)
- `.claude/settings.json`
- `.mcp.json`
- раскладка assets (skills/agents/commands/hooks/rules/workflows/docs/dotfiles/schemas)

## Карта: control_v0 -> поверхность

| control_v0 поле | Выход/эффект |
| --- | --- |
| `claude_md.inject_control_entry` + `marker` | блок MOVA в `CLAUDE.md` |
| `settings.*` | `.claude/settings.json` |
| `mcp.*` | `.mcp.json` |
| `policy.hooks.*` | hooks в `.claude/settings.json` |
| `policy.permissions.*` | permissions в `.claude/settings.json` |
| `policy.plugins.*` | plugins в `.claude/settings.json` |
| `lsp.*` | `.claude/settings.json` + опциональный lsp-файл |
| `assets.skills` | `.claude/skills/**` |
| `assets.agents` | `.claude/agents/**` |
| `assets.commands` | `.claude/commands/**` |
| `assets.rules` | `.claude/rules/**` |
| `assets.hooks` | `.claude/hooks/**` |
| `assets.docs` | `.claude/settings.md`, `.claude/skills/README.md` |
| `assets.dotfiles` | `.claude/.gitignore` |
| `assets.schemas` | `.claude/hooks/*.schema.json` |
| `assets.workflows` | `.github/workflows/**` |
| `observability.*` | hooks в `.claude/settings.json` + артефакты в `.mova/episodes/**` |

## Что реально блокирует, а что наблюдает

- Блокировка: `hooks.PreToolUse` с явным `block: true` и exit 2.
- Наблюдение: `PostToolUse`, `UserPromptSubmit`, `Stop` — без hard-stop, по умолчанию `report_only`.
- Наблюдаемость MOVA пишет события в `.mova/episodes/**` и не блокирует работу.

## Managed vs unmanaged LSP

- `lsp.managed: true` — `control apply` пишет файл по `lsp.config_path`.
- `lsp.managed: false` — файл считается внешним и не трогается.

## Drift и как чинить

Если `control check` сообщает drift:

1) `control prefill` (если нужно переснять)
2) Правка `mova/control_v0.json`
3) `control apply --mode apply`
4) `control check` до зелёного статуса

## Исключения поверхности

Если есть сознательно неуправляемые файлы, они перечисляются в `control_surface_exclusions_v0.json` с причиной.

## Как включать/выключать строгость

- `policy.mode` по умолчанию `report_only`.
- Для жёсткого режима включайте блокирующие PreToolUse и задавайте строгую политику в `permissions` и `hooks`.
- Детали CI/strict поведения — в `docs/OPERATOR_GUIDE_v0.md`.

Примечание по permissions: в `.claude/settings.json` используется `permissions.defaultMode` с режимами Claude Code (`acceptEdits`, `plan`, `bypassPermissions`, `default`, `delegate`, `dontAsk`). В `control_v0` это маппится из `policy.permissions.on_unknown`.
