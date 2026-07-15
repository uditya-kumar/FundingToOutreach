// Handoff schemas — the typed JSON each subagent must return (Rule 1).
// Subagents are instructed to emit ONLY a JSON object matching these shapes,
// so handoffs are compact and lossless (no prose, no dropped url/date fields).
//
// These zod schemas double as the single source of truth: the SCHEMA_TEXT
// strings below are embedded verbatim into subagent prompts.
import { z } from "zod";

// ── funding-researcher → orchestrator (Steps 1+2) ──────────────────────────
export const Candidate = z.object({
  name: z.string(),
  oneLiner: z.string(),
  fundingAmount: z.string(), // e.g. "$18 Mn" or "not_found"
  stage: z.string(), // e.g. "Seed", "Series A", or "not_found"
  date: z.string(), // funding announcement date
  source: z.string(), // feed/site name
  url: z.string(), // article URL
  sector: z.string(), // matched edge sector
});
export const CandidateList = z.object({ candidates: z.array(Candidate) });

// ── fit-strategist → orchestrator (Steps 3+4) ──────────────────────────────
// Founder NAMES only. LinkedIn /in/ URLs are effectively never returned by
// Exa/WebFetch and must never be constructed from a name, so we don't carry a
// linkedin field at all — names are sufficient for outreach personalization.
export const Founder = z.object({
  name: z.string(),
});
export const ScoredStartup = z.object({
  name: z.string(),
  oneLiner: z.string(),
  fundingAmount: z.string(),
  stage: z.string(),
  date: z.string(),
  url: z.string(),
  founders: z.array(Founder),
  hiringPage: z.string(), // HTTP-verified URL, or "not_found"
  teamSize: z.string(), // or "not_found"
  whyHiring: z.string(),
  whyHireCandidate: z.string(),
  fitScore: z.number().min(0).max(1), // DECIMAL 0-1 (fine-grained, so ties don't force discovery-order tie-breaks)
  expectedLearning: z.number().min(0).max(10),
});
export const ScoredList = z.object({ startups: z.array(ScoredStartup) });

// ── outreach-designer → orchestrator (Step 5, one per startup) ─────────────
// Categorizes the startup into ONE skill track and returns ONLY the ~20%
// personalized slots. The 80% fixed email copy lives in config/emailTemplates
// and is filled deterministically by renderOutreach (no LLM), so the fixed body
// never drifts or hallucinates run-to-run.
export const Outreach = z.object({
  name: z.string(),
  category: z.enum(["Mobile", "Web", "GenAI"]), // which skill track this company fits
  founderGreeting: z.string(), // founder first name, or "there"
  hook: z.string(), // ≤120-char company observation clause (capped in render)
  companyUrl: z.string(), // company website/homepage, or "not_found" (never fabricated)
  // Company HQ location + IANA timezone so the orchestrator can compute the
  // ideal send time (aim for the recipient's ~9 AM). Never fabricated: emit
  // "not_found" unless a real source states the HQ location.
  hqLocation: z.string(), // e.g. "Paris, France" or "not_found"
  hqTimezone: z.string(), // IANA zone e.g. "Europe/Paris", or "not_found"
});

// ── Tool RETURN schemas (validate the tool→agent handover) ─────────────────
// get_recent_funding → array of compact feed items
export const FeedItem = z.object({
  source: z.string(),
  title: z.string(),
  url: z.string(),
  date: z.string(),
});
export const FeedItemList = z.array(FeedItem);

// rank_opportunities → ranked opportunities with computed score
export const RankedOpportunity = z.object({
  rank: z.number(),
  name: z.string(),
  fitScore: z.number(),
  expectedLearning: z.number(),
  score: z.number(),
});
export const RankedList = z.array(RankedOpportunity);

// save_report → write outcome
export const SaveResult = z.union([
  z.object({ ok: z.literal(true), path: z.string(), bytes: z.number() }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

// ── Orchestrator final result (validated via query outputFormat) ───────────
export const RunSummary = z.object({
  date: z.string(),
  reportPath: z.string(),
  candidatesFound: z.number(),
  topOpportunity: z.string(),
  topScore: z.number(),
  ranked: z.array(z.object({ rank: z.number(), name: z.string(), score: z.number() })),
});

// ── Compact schema descriptions embedded into prompts ──────────────────────
export const SCHEMA_TEXT = {
  candidates: `{"candidates":[{"name":string,"oneLiner":string,"fundingAmount":string,"stage":string,"date":string,"source":string,"url":string,"sector":string}]}`,
  scored: `{"startups":[{"name":string,"oneLiner":string,"fundingAmount":string,"stage":string,"date":string,"url":string,"founders":[{"name":string}],"hiringPage":string|"not_found","teamSize":string|"not_found","whyHiring":string,"whyHireCandidate":string,"fitScore":number(0.0-1.0 decimal),"expectedLearning":number(0-10)}]}`,
  // Single-startup form of `scored` — the fit-strategist runs ONE instance per
  // candidate in parallel (mirrors outreach-designer), so each returns one object.
  scoredOne: `{"name":string,"oneLiner":string,"fundingAmount":string,"stage":string,"date":string,"url":string,"founders":[{"name":string}],"hiringPage":string|"not_found","teamSize":string|"not_found","whyHiring":string,"whyHireCandidate":string,"fitScore":number(0.0-1.0 decimal),"expectedLearning":number(0-10)}`,
  outreach: `{"name":string,"category":"Mobile"|"Web"|"GenAI","founderGreeting":string,"hook":string,"companyUrl":string|"not_found","hqLocation":string|"not_found","hqTimezone":string(IANA e.g. "Europe/Paris")|"not_found"}`,
};
