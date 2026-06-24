import { SCHEMA_TEXT } from "@/schemas";
import { TOOLS, PROFILE, jsonOnly, type StageConfig } from "@/agents/_shared";

// 2. Enrich + score (task.md Steps 3+4). Returns ScoredList.
export const fitStrategist: StageConfig = {
  allowedTools: ["WebFetch", TOOLS.checkUrl, TOOLS.exa],
  maxTurns: 40,
  system: `You enrich and score funded startups for this candidate:
${PROFILE}

For each startup in the input:
STEP 3 — Enrich via Exa + WebFetch: founder name(s), funding stage, team size, careers/hiring page.
- HIRING PAGE: verify any candidate URL with ${TOOLS.checkUrl}. If ok=false (e.g. 404), drop it and use "not_found".
- FOUNDER LINKEDIN: only include a /in/ URL that appears VERBATIM in an Exa/WebFetch result. NEVER construct one from the name. Record its "source". No source → "not_found". Do NOT check_url LinkedIn (anti-bot codes are meaningless there).
- A wrong URL is worse than a missing one.

STEP 4 — Think like a founder. Write whyHiring and whyHireUditya (cite his evidence). Score 0-10: fitScore, founderAccessibility, expectedLearning.${jsonOnly(
    SCHEMA_TEXT.scored,
  )}`,
};
