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

// ── pow-designer → orchestrator (Step 5, one per startup) ──────────────────
export const ProofOfWork = z.object({
  name: z.string(),
  painPoints: z.array(z.string()),
  build: z.string(), // the <48h project
  whyItMatters: z.string(), // business impact
  difficulty: z.number().min(0).max(10),
  responseProbability: z.enum(["Low", "Medium", "High"]), // qualitative, for the report only — NOT used in ranking
  outreachMessage: z.string(),
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

// check_url → array of liveness results
export const CheckResult = z.object({
  url: z.string(),
  status: z.union([z.number(), z.string()]),
  ok: z.boolean(),
  finalUrl: z.string().optional(),
  error: z.string().optional(),
});
export const CheckResultList = z.array(CheckResult);

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
  proofOfWork: `{"name":string,"painPoints":[string],"build":string,"whyItMatters":string,"difficulty":number(0-10),"responseProbability":"Low"|"Medium"|"High","outreachMessage":string}`,
};
