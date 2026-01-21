---
description: Initialize MOVA in current project
argument-hint: "[--preset <name>]"
allowed-tools:
  - Read
  - Write
  - Bash
---

Initialize MOVA structure in the current project.

## Steps:
1. Check if mova/control_v0.json exists
2. If exists, ask user: overwrite or merge?
3. Create directory structure:
   - mova/control_v0.json (from template)
   - .mova/episodes/
4. Apply preset if specified (default: base)
5. Add MOVA_CONTROL_ENTRY marker to CLAUDE.md if not present

## Interactive Preset Selection (if no --preset):

Ask user to select:
- Development: full access, verbose logging, dashboard enabled
- Staging: sandboxed, moderate logging
- Production: restricted, audit logging, OTEL enabled

## Arguments:
- $1: --preset flag (optional)
- $2: preset name (base|development|production)

## Execution:

```bash
node ${CLAUDE_PLUGIN_ROOT}/services/preset_manager.js init $ARGUMENTS
```

## Output:
- Summary of created files
- Active configuration overview
- Next steps hint
