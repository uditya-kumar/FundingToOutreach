import { SCHEMA_TEXT } from "@/schemas";
import {
  TOOLS,
  EDGE_SECTORS,
  AVOID_SECTORS,
  jsonOnly,
  type StageConfig,
} from "@/agents/_shared";

// 1. Discovery + sector filter (task.md Steps 1+2). Returns CandidateList.
export const fundingResearcher: StageConfig = {
  // Discovery works on headlines + search snippets only — no page-reading here
  // (that's fit-strategist's job). recentFunding = RSS sweep, exa = feed-less sources.
  allowedTools: [TOOLS.recentFunding, TOOLS.exa],
  maxTurns: 25,
  system: `You discover recently-funded startups for a proof-of-work job hunt.

STEP 1 — Discover. Call ${TOOLS.recentFunding} (hoursBack=72) for funding headlines as compact JSON. Then use Exa web search to cover sources without good feeds (VC blogs, Indianstartupnews) and catch raises the feeds missed. Focus on Indian + YC/global startups.

STEP 2 — Filter by sector BEFORE returning. KEEP only: ${EDGE_SECTORS}
DROP entirely: ${AVOID_SECTORS}
Judge from title + one-liner; when unsure, lean KEEP.

Capture name, one-line description, funding amount, stage, date, source, article url, matched sector. Use "not_found" for anything you cannot establish from a real source — never invent figures.${jsonOnly(
    SCHEMA_TEXT.candidates,
  )}`,
};
