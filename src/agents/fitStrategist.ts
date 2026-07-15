import { SCHEMA_TEXT } from "@/schemas";
import { TOOLS, PROFILE, FIRST_NAME, jsonOnly, type StageConfig } from "@/agents/_shared";

// 2. Enrich + score (task.md Steps 3+4). ONE candidate per instance — the
// pipeline runs these in parallel (mirrors outreach-designer), so each returns a
// single ScoredStartup object rather than a ScoredList.
export const fitStrategist: StageConfig = {
  allowedTools: ["WebFetch", TOOLS.exa],
  // Research-only stage — no shell, no local files, no user prompts. Remove
  // these from context (allowedTools doesn't gate under bypassPermissions).
  //   - Bash: no shell needed; was burning turns on no-op commands.
  //   - Read: pure waste here — the candidate arrives in the prompt and
  //     enrichment is web-only, yet agents kept reading CLAUDE.md instead.
  //   - AskUserQuestion: this runs UNATTENDED, so a question can never be
  //     answered; agents were firing empty/placeholder questions and burning
  //     turns. The prompt already forbids it, but a prompt isn't a gate.
  //   - Agent: a fit-strategist's whole job is "research ONE company → return
  //     JSON." It must never spawn subagents. Left open, agents fired no-op
  //     Agent calls ("no-op", "respond with 'done'") to burn idle turns.
  //   - Skill: irrelevant to single-company enrichment; agents fired junk
  //     Skill calls ("none", "skill-creator", "code-review") to burn idle turns.
  //   - Grep/Glob: local-filesystem search — useless for web-only enrichment;
  //     agents fired junk searches (Grep "CLAUDE.md", Glob "*") to burn turns.
  //   - TaskCreate/TaskList: task-tracking has no place in a one-shot research
  //     stage; agents used them as idle filler until they hit the turn cap.
  // disallowedTools is applied at the query() level in runStage, so this also
  // blocks any sub-agent the fit-strategist spawns.
  disallowedTools: [
    "Bash",
    "Read",
    "AskUserQuestion",
    "Agent",
    "Skill",
    "Grep",
    "Glob",
    "TaskCreate",
    "TaskList",
  ],
  // Per-startup budget. One candidate, web-only enrichment — this is plenty.
  maxTurns: 30,
  system: `You enrich and score ONE funded startup (its data is in the prompt) for this candidate:
${PROFILE}

STEP 3 — Enrich via Exa + WebFetch: founder name(s), funding stage, team size, careers/hiring page.
- HIRING PAGE: decide by PROVENANCE.
  - Only emit a hiring/careers URL that came VERBATIM from a real Exa/WebFetch result (a source you actually saw). KEEP it as-is.
  - NEVER guess or construct a URL (e.g. appending "/careers" to a domain). If you didn't see the URL in a real result, use "not_found".
  - A guessed/constructed URL is worse than a missing one — when unsure, use "not_found".
- FOUNDERS: names only. Only emit a founder name that appears in an Exa/WebFetch result — never guess. Do NOT include LinkedIn URLs (they're never reliably returned and must never be constructed).
- NEVER pause to ask the user a question — this runs unattended. Apply the rules above and decide yourself.

STEP 4 — Think like a founder. Write whyHiring and whyHireCandidate (cite his evidence). Then score:
- fitScore: a DECIMAL from 0.0 to 1.0 (e.g. 0.92, 0.78) for how well ${FIRST_NAME}'s skills match / could contribute. Use the full range and fine gradations — do NOT round to 0.1 steps; distinguish a 0.91 from a 0.86. Avoid ties between different startups.
- expectedLearning: 0-10 for how much he'd grow there.

STOP CONDITION — the moment you have the enrichment fields and both scores, IMMEDIATELY output the final JSON and end your turn. Do NOT keep searching for confirmation you already have; anything already grounded in the input requires ZERO tool calls.${jsonOnly(
    SCHEMA_TEXT.scoredOne,
  )}`,
};
