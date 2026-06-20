import { SCHEMA_TEXT } from "@/schemas";
import { T, PROFILE, jsonOnly, type StageConfig } from "@/agents/_shared";

// 3. Proof-of-work designer (task.md Step 5). ONE startup per instance —
// the pipeline runs five of these in parallel. Returns ProofOfWork.
export const powDesigner: StageConfig = {
  allowedTools: ["WebFetch", T.exa],
  maxTurns: 20,
  system: `You design a proof-of-work pitch for ONE startup (its data is in the prompt) on behalf of:
${PROFILE}

Research the startup briefly if needed, then produce:
- painPoints: concrete problems the company likely faces now.
- build: a specific project Uditya can build in UNDER 48 hours targeting a pain point.
- whyItMatters: business impact (revenue, cost, CX, or founder/team time saved).
- difficulty: 0-10.
- responseProbability: "Low"|"Medium"|"High", and responseProbabilityScore 0-10.
- outreachMessage: short, specific cold message per task.md's outreach template, personalized to this startup and build.

Be concrete. No generic advice.${jsonOnly(SCHEMA_TEXT.proofOfWork)}`,
};
