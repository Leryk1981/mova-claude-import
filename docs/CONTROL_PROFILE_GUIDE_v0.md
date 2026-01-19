# Control Profile Guide v0

## Что это за файл

`claude_control_profile_v0.json` — единая панель управления политиками и поведением
Claude Code + MOVA наблюдаемости.

## Минимально необходимые поля

- `kind`, `id`, `version`, `mode`, `title`
- `anthropic.permissions`
- `anthropic.mcp`
- `anthropic.claude_md`
- `mova.overlay`
- `mova.observability`
- `apply.default_apply_mode`

## Как выбрать пример

| Профиль | Когда использовать |
| --- | --- |
| min | Быстрый старт, только базовые поля |
| standard | Рекомендуемый набор, полный контроль без жёсткости |
| strict | Более жёсткие allow‑списки, но всё ещё report‑only |

См. примеры в `examples/`.

## Apply‑flow

1) `control prefill` — создать профиль
2) отредактировать профиль
3) `control check` — получить план
4) `control apply` — применить при `--mode apply`

## Где смотреть отчёты

- `prefill_report_v0.json` — что было найдено при prefill
- `mova/claude_control/v0/runs/<run_id>/control_plan_v0.json`
- `mova/claude_control/v0/runs/<run_id>/control_summary_v0.json`
- `mova/claude_control/v0/runs/<run_id>/control_apply_report_v0.json`
