---
description: Show MOVA status (minimal output)
allowed-tools:
  - Read
---

Show minimal MOVA status for current project.

## Check:
1. Read mova/control_v0.json for profile info
2. Read .mova/episodes/index.jsonl for session info
3. Count security events from current session

## Output format:
```
MOVA: [active|inactive|error]
Profile: [profile_id] v[version]
Session: [session_id] | [n] events | [duration]
Security: [n] events ([critical]/[high]/[medium]/[low])
```

## Example:
```
MOVA: active
Profile: mova_claude_control_v1 v1.0.0
Session: sess_20260121_abc | 15 events | 5m 23s
Security: 2 events (0/1/1/0)
```
