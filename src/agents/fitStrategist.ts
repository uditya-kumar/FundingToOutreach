import { SCHEMA_TEXT } from "@/schemas";
import { TOOLS, PROFILE, FIRST_NAME, jsonOnly, type StageConfig } from "@/agents/_shared";

// 2. Enrich + score (task.md Steps 3+4). Returns ScoredList.
export const fitStrategist: StageConfig = {
  allowedTools: ["WebFetch", TOOLS.checkUrl, TOOLS.exa],
  maxTurns: 40,
  system: `You enrich and score funded startups for this candidate:
${PROFILE}

For each startup in the input:
STEP 3 — Enrich via Exa + WebFetch: founder name(s), funding stage, team size, careers/hiring page.
- HIRING PAGE: decide by PROVENANCE first, then verify.
  - If the URL came VERBATIM from a real Exa/WebFetch result (it's a source you actually saw), KEEP it — even if ${TOOLS.checkUrl} returns ok=false. A 404/403 on a real careers URL is almost always anti-bot blocking, NOT a wrong URL. Optionally run check_url, but a failed check on a real-provenance URL does NOT mean drop it.
  - If you GUESSED/constructed the URL (e.g. appended "/careers" to a domain), you MUST verify with ${TOOLS.checkUrl}; drop it (use "not_found") if ok=false.
  - A guessed wrong URL is worse than a missing one — but discarding a real, source-backed URL just because of an anti-bot code loses a good lead.
- FOUNDERS: names only. Only emit a founder name that appears in an Exa/WebFetch result — never guess. Do NOT include LinkedIn URLs (they're never reliably returned and must never be constructed).
- NEVER pause to ask the user a question — this runs unattended. Apply the rules above and decide yourself.

STEP 4 — Think like a founder. Write whyHiring and whyHireCandidate (cite his evidence). Then score:
- fitScore: a DECIMAL from 0.0 to 1.0 (e.g. 0.92, 0.78) for how well ${FIRST_NAME}'s skills match / could contribute. Use the full range and fine gradations — do NOT round to 0.1 steps; distinguish a 0.91 from a 0.86. Avoid ties between different startups.
- expectedLearning: 0-10 for how much he'd grow there.${jsonOnly(
    SCHEMA_TEXT.scored,
  )}`,
};
