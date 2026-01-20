#!/usr/bin/env bash
set -euo pipefail

prompt="${CLAUDE_USER_PROMPT:-${CLAUDE_PROMPT:-}}"
skill="general"

if echo "$prompt" | grep -qi "test\\|tdd\\|mock\\|coverage"; then
  skill="testing-patterns"
elif echo "$prompt" | grep -qi "debug\\|trace\\|repro\\|bug"; then
  skill="systematic-debugging"
elif echo "$prompt" | grep -qi "security\\|vuln\\|xss\\|csrf\\|auth"; then
  skill="security-basics"
elif echo "$prompt" | grep -qi "git\\|branch\\|merge\\|rebase"; then
  skill="git-workflow"
fi

echo "{\"feedback\": \"skill-eval: ${skill}\", \"suppressOutput\": true}"
