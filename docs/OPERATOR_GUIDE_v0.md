# Operator Guide v0

## Purpose

Turn "chaos -> order" by rebuilding a clean Anthropic profile with deterministic MOVA artifacts.

## Inputs Read

- `CLAUDE.md`
- `.claude/**`
- `.mcp.json`

Not read:
- `.claude/settings.local.json`
- `**/*.local.*` and `CLAUDE.local.md` (unless `--include-local`)
- `.env` / `.env.*`
- private keys (`id_rsa*`, `*.pem`, `*.key`)

## Input Policy Gate

- `--strict`: denies forbidden inputs and exits with code 2.
- `--include-local`: allows `**/*.local.*` but still denies settings.local.json.

See `mova/claude_import/v0/input_policy_report_v0.json` for details.

## Output Layout (high level)

```
<out>/
  CLAUDE.md
  MOVA.md
  .claude/
  mova/claude_import/v0/
```

## Source of Truth

- Contracts: `mova/claude_import/v0/contracts/*.json`
- Reports: `mova/claude_import/v0/*.json`
- Anchor: `mova/claude_import/v0/VERSION.json`

Canonical control layer schemas live under `schemas/claude_control/v0/` (ds/env/global).

## How to Verify Proof

```
npm run quality
npm run quality:neg
```

Verify `export_manifest_v0.json.zip_sha256` against the actual zip.

## Troubleshooting

- Exit code 2: strict input policy deny
- Check `mova/claude_import/v0/input_policy_report_v0.json`

## Control commands

- `control prefill`: create/update `claude_control_profile_v0.json` plus `prefill_report_v0.json`
- `control check`: preview-only plan and summary in `mova/claude_control/v0/runs/<run_id>/`
- `control apply`: apply changes (default preview) with report in `mova/claude_control/v0/runs/<run_id>/`
