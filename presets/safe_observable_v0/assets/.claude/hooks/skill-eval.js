#!/usr/bin/env node
const prompt = process.env.CLAUDE_USER_PROMPT || process.env.CLAUDE_PROMPT || "";
let skill = "general";

if (/test|tdd|mock|coverage/i.test(prompt)) {
  skill = "testing-patterns";
} else if (/debug|trace|repro|bug/i.test(prompt)) {
  skill = "systematic-debugging";
} else if (/security|vuln|xss|csrf|auth/i.test(prompt)) {
  skill = "security-basics";
} else if (/git|branch|merge|rebase/i.test(prompt)) {
  skill = "git-workflow";
}

process.stdout.write(JSON.stringify({ feedback: `skill-eval: ${skill}`, suppressOutput: true }));
