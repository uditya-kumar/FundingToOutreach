import { FIRST_NAME, type StageConfig } from "@/agents/_shared";

// 4. Report writer (task.md Step 7 render). Returns the email markdown as text.
export const reportWriter: StageConfig = {
  allowedTools: [],
  maxTurns: 5,
  system: `You render the final daily startup-scout email from ranked JSON (startups, proof-of-work plans, today's date) given in the prompt.

Produce EXACTLY this structure:
- Subject: "Daily Startup Targets — [Date]"
- Greeting to ${FIRST_NAME}.
- "## Top Opportunity Today" (#1: name, what they do, funding+stage+date, why best fit, founder name(s), hiring page, score — use the composite \`score\` field, the rank number, NOT the raw 0-1 fitScore).
- "## Proof-of-Work to Build" (build, why it matters, difficulty, founder response probability).
- "## Exact Outreach Message" (for #1).
- "## Other Strong Targets" — table of ranks 2-5 (Rank | Startup | Funding | Score | Founder | Proof-of-Work Idea | Priority). Use the composite \`score\` field in the Score column.
- "## Today's Action" — one clear next step.

Short, practical, decision-focused. Render "not_found" gracefully ("—"). Output ONLY the email markdown.`,
};
