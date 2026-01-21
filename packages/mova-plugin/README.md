# MOVA Plugin for Claude Code

Monitoring, Observing, Validating Agent layer for Claude Code.

## Installation

```bash
# From npm
claude plugin add @mova/claude-plugin

# Local development
claude --plugin-dir ./packages/mova-plugin
```

## Quick Start

```bash
# Initialize MOVA in your project
/mova:init

# Check status
/mova:status

# View context
/mova:context
```

## Commands

| Command | Description |
|---------|-------------|
| `/mova:init` | Initialize MOVA with interactive wizard |
| `/mova:status` | Show MOVA status |
| `/mova:context` | Display current context and profile |
| `/mova:lint` | Validate MOVA configuration |
| `/mova:metrics` | Show metrics and statistics |
| `/mova:dashboard` | Control monitoring dashboard |
| `/mova:debug` | Debug MOVA configuration |
| `/mova:start` | Start a new MOVA session |
| `/mova:finish` | Finalize current session |
| `/mova:export` | Export data (JSONL, CSV) |
| `/mova:retention` | Manage retention and cleanup |
| `/mova:preset:list` | List available presets |
| `/mova:preset:apply` | Apply a preset |
| `/mova:preset:info` | Show preset details |

## Presets

| Preset | Description |
|--------|-------------|
| `development` | Full access, verbose logging, dashboard enabled |
| `staging` | Sandboxed, moderate logging, some confirmations |
| `production` | Restricted, audit logging, OTEL export |

## Configuration

MOVA stores configuration in `mova/control_v0.json`:

```json
{
  "profile_id": "mova_claude_control_v1",
  "version": "1.0.0",
  "environment": "development",
  "observability": {
    "enabled": true,
    "log_level": "info"
  },
  "human_in_the_loop": {
    "escalation_threshold": "high"
  }
}
```

## Directory Structure

```
project/
├── mova/
│   └── control_v0.json      # MOVA configuration
└── .mova/
    ├── episodes/            # Session episodes
    │   ├── sess_YYYYMMDD_xxx/
    │   │   ├── events.jsonl
    │   │   └── summary.json
    │   └── .current_session_id
    ├── backups/             # Configuration backups
    └── archives/            # Archived sessions
```

## Security Events

MOVA detects and logs security events:

- `instruction_profile_invalid` - Invalid profile configuration
- `prompt_injection_suspected` - Potential prompt injection
- `forbidden_tool_requested` - Blocked tool usage
- `rate_limit_exceeded` - Rate limit violation
- `sensitive_data_access_suspected` - Sensitive data access
- `guardrail_violation` - Guardrail rule triggered

## Human-in-the-Loop

Configure confirmation requirements:

```json
{
  "human_in_the_loop": {
    "escalation_threshold": "medium",
    "auto_approve": ["Read", "Glob", "Grep"],
    "always_confirm": ["rm", "git push --force"],
    "confirmation_timeout_ms": 300000
  }
}
```

## OpenTelemetry Export

Enable OTEL metrics export:

```json
{
  "observability": {
    "otel_enabled": true,
    "otel_endpoint": "http://localhost:4318/v1/metrics"
  }
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLAUDE_PLUGIN_ROOT` | Plugin installation directory |
| `CLAUDE_PROJECT_DIR` | Current project directory |
| `MOVA_LOG_LEVEL` | Override log level |
| `MOVA_DASHBOARD_PORT` | Dashboard WebSocket port |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP endpoint |

## Testing

```bash
# Test plugin locally
claude --plugin-dir ./packages/mova-plugin

# Verify commands
/mova:status
/mova:lint

# Check hook events in logs
```

## License

MIT
