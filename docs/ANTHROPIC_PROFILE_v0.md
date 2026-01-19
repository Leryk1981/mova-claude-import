# Anthropic Profile v0 (Source of Truth)

This document defines the deterministic output layout produced by the Anthropic
profile v0 rebuild.

Output root (<OUT>/):

```
<OUT>/
  CLAUDE.md
  MOVA.md
  .mcp.json                    (only if present in input)
  .claude/
    settings.json
    commands/
      mova_context.md
      mova_lint.md
    skills/
      mova-layer-v0/
        SKILL.md
      <imported skills...>/    (normalized)
  mova/
    claude_import/v0/
      import_manifest.json
      redaction_report.json
      lint_report_v0.json
      contracts/
        instruction_profile_v0.json
        skills_catalog_v0.json
        mcp_servers_v0.json
      episode_import_run.json
```

Notes:
- The output is fully deterministic (no timestamps, random IDs, or run-specific
  folders).
- Source inputs are not copied into the output project; only normalized profile
  artifacts and contracts are emitted.
