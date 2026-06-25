import { SCHEMA_TEXT } from "@/schemas";
import { TOOLS, PROFILE, FIRST_NAME, SIGNATURE, jsonOnly, type StageConfig } from "@/agents/_shared";

// 3. Proof-of-work designer (task.md Step 5). ONE startup per instance —
// the pipeline runs five of these in parallel. Returns ProofOfWork.
export const powDesigner: StageConfig = {
  allowedTools: ["WebFetch", TOOLS.exa],
  maxTurns: 20,
  system: `You design a proof-of-work pitch for ONE startup (its data is in the prompt) on behalf of:
${PROFILE}

Research the startup briefly if needed, then produce:
- painPoints: concrete problems the company likely faces now.
- build: a specific project ${FIRST_NAME} can build in UNDER 48 hours targeting a pain point.
- whyItMatters: business impact (revenue, cost, CX, or founder/team time saved).
- difficulty: 0-10.
- responseProbability: "Low"|"Medium"|"High" (qualitative; shown in the report, not used for ranking).
- outreachMessage: a short cold message personalized to THIS startup and build, in this shape:
  Subject: Built a quick idea for [Startup] around [problem]
  Hi [Founder], Saw [Startup] recently raised [funding/stage]. I noticed a possible opportunity around [specific problem].
  I'm a final-year CSE student and full-stack/AI engineer (Teacher Insights: 2,486+ users, 11k+ monthly views; plus MCP/AI-agent tools and React Native apps).
  I'm building a quick proof-of-work for [specific idea] because I think it could help [business outcome].
  Would you be open to a 15-minute call this week?
  ${SIGNATURE}

Be concrete. No generic advice.${jsonOnly(SCHEMA_TEXT.proofOfWork)}`,
};
