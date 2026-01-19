# mova-claude-import

Deterministic import/rebuild tool for producing a clean Anthropic/Claude profile with MOVA artifacts.

## Quickstart

### Existing Anthropic/Claude project -> controlled output

```
npx mova-claude-import --project <in> --out <out> --zip --strict
```

Output:
- `<out>/` clean Claude package
- `<out>/mova/claude_import/v0/...` contracts/reports
- `<out>/export.zip` plus `export_manifest_v0.json`

Control layer contracts live under `schemas/claude_control/v0/` (ds/env/global).

### Init a new project scaffold

```
npx mova-claude-import init --out <dir> --zip
```

## Flags (short list)

- `--strict`
- `--include-local`
- `--zip` / `--zip-name`
- `--no-emit-profile`
- `--no-emit-overlay`

## References

- `docs/COMPATIBILITY_MATRIX.md`
- `docs/MOVA_SPEC_BINDINGS.md`
