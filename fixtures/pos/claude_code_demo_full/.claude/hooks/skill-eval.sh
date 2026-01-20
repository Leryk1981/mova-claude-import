#!/usr/bin/env bash
set -euo pipefail

prompt="${CLAUDE_USER_PROMPT:-${CLAUDE_PROMPT:-}}"
skill="general"

if echo "$prompt" | grep -qi "graphql"; then
  skill="graphql-schema"
elif echo "$prompt" | grep -qi "test"; then
  skill="testing-patterns"
elif echo "$prompt" | grep -qi "react\\|ui"; then
  skill="react-ui-patterns"
fi

echo "{\"feedback\": \"skill-eval: ${skill}\", \"suppressOutput\": true}"
