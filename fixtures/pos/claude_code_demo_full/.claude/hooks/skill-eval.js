#!/usr/bin/env node
const prompt = process.env.CLAUDE_USER_PROMPT || process.env.CLAUDE_PROMPT || "";
let skill = "general";

if (/graphql/i.test(prompt)) {
  skill = "graphql-schema";
} else if (/test/i.test(prompt)) {
  skill = "testing-patterns";
} else if (/react|ui/i.test(prompt)) {
  skill = "react-ui-patterns";
}

process.stdout.write(JSON.stringify({ feedback: `skill-eval: ${skill}`, suppressOutput: true }));
