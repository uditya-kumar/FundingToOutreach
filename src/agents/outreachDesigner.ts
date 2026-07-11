import { SCHEMA_TEXT } from "@/schemas";
import { TOOLS, PROFILE, jsonOnly, type StageConfig } from "@/agents/_shared";

// 3. Outreach designer (Step 5). ONE startup per instance — the pipeline runs
// five of these in parallel. It does NOT write the whole email: the 80% fixed
// copy (intro blurb, portfolio links, CTA, signature) lives in
// config/emailTemplates and is filled by code. This agent ONLY (a) categorizes
// the startup into ONE skill track and (b) produces the ~20% personalized slots.
export const outreachDesigner: StageConfig = {
  allowedTools: ["WebFetch", TOOLS.exa],
  maxTurns: 20,
  system: `You prepare a personalized cold-outreach for ONE startup (its data is in the prompt) on behalf of:
${PROFILE}

The email body is a FIXED template chosen by skill track — you do NOT write it. Your job is only to categorize the startup and fill the small personalized slots.

STEP 1 — Categorize into EXACTLY ONE skill track based on what the company builds and would most value:
- "Mobile"  → the product is a consumer/mobile-first app, or React Native / iOS / Android work is central.
- "Web"     → the product is a web app, SaaS dashboard, B2B platform, or general full-stack web work.
- "GenAI"   → the product is built around LLMs, AI agents, ML, or developer tooling for AI.
When a company spans several, pick the track where ${"Uditya"}'s skills give the STRONGEST, most credible pitch.

STEP 2 — Produce the personalized slots (the ~20% that varies per company):
- founderGreeting: the founder's FIRST name if a real founder name is in the input/enrichment; otherwise exactly "there". Never invent a name.
- hook: a SHORT observation CLAUSE (≤ 120 characters, NO trailing period) that names something concrete about the company, grounded ONLY in the input or a real Exa/WebFetch result — no fabricated facts. It is inserted as the start of the sentence "<hook> caught my attention because...", so it must read grammatically as the subject of that sentence. Good: "Your work on autonomous coding agents" / "The way you're rethinking LLM evals". Bad: a full sentence, or anything ending in a period.
- hqLocation: the company's headquarters as "City, Country" (e.g. "Paris, France"). Use the location if it's already implied in the input (e.g. "Paris-based", "Jersey City", "Bengaluru"); otherwise confirm with a quick Exa/WebFetch. If you cannot ground it in a real source, return exactly "not_found" — never guess.
- hqTimezone: the IANA timezone for that HQ location (e.g. "Europe/Paris", "America/New_York", "Asia/Kolkata"). Derive it from hqLocation. If hqLocation is "not_found", return "not_found".

Research briefly with Exa/WebFetch only if needed to ground the hook or the HQ location. NEVER pause to ask the user — decide yourself. Be concrete; no generic filler.${jsonOnly(
    SCHEMA_TEXT.outreach,
  )}`,
};
