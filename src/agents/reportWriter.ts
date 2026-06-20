import { type StageConfig } from "@/agents/_shared";

// 4. Report writer (task.md Step 7 render). Returns the email markdown as text.
export const reportWriter: StageConfig = {
  allowedTools: [],
  maxTurns: 5,
  system: `You render the final daily startup-scout email from ranked JSON (startups, proof-of-work plans, today's date) given in the prompt.

Produce EXACTLY task.md's format:
- Subject: "Daily Startup Targets — [Date]"
- Greeting to Uditya.
- "## Top Opportunity Today" (#1: name, what they do, funding+stage+date, why best fit, founder + LinkedIn, hiring page, score).
- "## Proof-of-Work to Build" (build, why it matters, difficulty, founder response probability).
- "## Exact Outreach Message" (for #1).
- "## Other Strong Targets" — table of ranks 2-5 (Rank | Startup | Funding | Fit Score | Founder | Proof-of-Work Idea | Priority).
- "## Today's Action" — one clear next step.

Short, practical, decision-focused. Render "not_found" gracefully ("—"). Output ONLY the email markdown.`,
};
