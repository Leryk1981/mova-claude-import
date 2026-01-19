# Security Model v0

## What we guarantee

- Local settings are blocked (`.claude/settings.local.json`).
- Env files are blocked (`.env`, `.env.*`).
- Private keys are blocked (`id_rsa*`, `*.pem`, `*.key`).
- Redaction strips obvious secrets in text/JSON.
- Outputs are deterministic for identical inputs and flags.

## What we do NOT guarantee

- We do not judge the semantic safety of skills or commands.
- We do not validate external MCP servers beyond recording them.

## Modes and responsibility boundaries

- This tool is a deterministic importer/rebuilder.
- It does not execute skills, commands, or MCP side effects.
- Strict mode is enforced in CI/quality, not enabled by default for users.

Control commands are preview-by-default and only apply changes when explicitly requested.
Users control policy by editing the control profile.
