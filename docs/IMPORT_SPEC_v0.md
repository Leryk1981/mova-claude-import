# mova-claude-import v0 (free)

## Inputs (scanned)
- CLAUDE.md
- .claude/skills/**/*.md
- .mcp.json
Excluded by default:
- CLAUDE.local.md and *.local.*
- user settings (~/.claude/*) unless explicitly enabled

## Outputs (written)
- mova/claude_import/v0/runs/<run_id>/import_manifest.json
- mova/claude_import/v0/runs/<run_id>/redaction_report.json
- mova/claude_import/v0/episodes/* (execution episode)
- mova/claude_import/v0/runs/latest.json
- mova/claude_import/v0/runs/<run_id>/sources/... (redacted source files)
- mova/claude_import/v0/runs/<run_id>/contracts/... (generated contracts)

## Determinism
run_id = sha256(sorted(file_path + sha256(file_content)))[:16]

## Contracts (generated)
- instruction_profile_v0.json
- skills_catalog_v0.json
- mcp_servers_v0.json

## Plugin wrapper
Example Claude Code plugin is provided under:
- plugin/mova-import/.claude-plugin/
- plugin/mova-import/commands/import.md
