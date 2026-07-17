# Daily Startup Scout — Build Spec

Automated daily agent (Claude Agent SDK, TypeScript) that finds freshly-funded startups, scores fit, categorizes each top company into a skill track (Mobile / Web / GenAI), and sends one personalized outreach email per company via Telegram.

## Stack
- **Runtime:** Node 22, TypeScript via `tsx` (`npm start` → `npx tsx --env-file=.env src/agent.ts`). ESM.
- **Agent SDK:** `@anthropic-ai/claude-agent-sdk` — orchestrator runs each stage via `runStage()`.
- **Data:** `cheerio` (scraping), `zod` (schemas), Exa MCP (http) for web enrichment.

## Architecture: orchestrator + 3 subagents

Each stage is a self-contained `query()` call with schema-validated JSON handoffs (no prose between stages).

| Subagent | Steps | Tools | Returns |
|---|---|---|---|
| `funding-researcher` | 1+2 | `get_recent_funding`, `get_gallery_funding`, `get_india_funding`, Exa | `Candidate[]` |
| `fit-strategist` | 3+4 | Exa, WebFetch | `ScoredStartup[]` |
| `outreach-designer` | 5 | Exa, WebFetch | `Outreach` (one instance per top-5 startup, parallel) — categorizes into Mobile/Web/GenAI, returns the ~20% personalized slots + the company's HQ location/timezone |

**Orchestrator-only steps:**
- Step 4.5: `fetchContactedIndex()` (`src/lib/contactedSheet.ts`) — reads the Google Sheet of already-contacted companies LIVE each run (Sheets REST API + API key, no library) and drops any scored startup already in it (matched by name OR root domain) BEFORE the top-5 slice, so the top 5 are always the highest-fit companies not yet contacted. Filters before slicing so the top-5 stays full when the leader is already contacted. Sheet failure degrades to "contact everyone" (never throws).
- Step 6: `computeRanking()` — `rank = fitScore × expectedLearning` (code, not LLM).
- Step 7: `computeSendWindow()` (best send time from HQ timezone) + `renderOutreach()` fills the fixed skill template (code, not LLM) → write `report.md` → send ONE Telegram message per company, sequentially, best-first, via `sendTelegramMessage()`.

## Email templates (`src/config/emailTemplates.ts`)
Three FIXED templates, one per skill track (Mobile / Web / GenAI), each with the SAME skeleton (subject `Interested in building with {company}` + greeting + observation sentence + projects paragraph + closing + signature). Only three text pieces differ per track — `focus`, `projects`, `closing` — held in the editable `EMAIL_TEMPLATES` config table. Each email is ~80% fixed and ~20% personalized: just the `founderGreeting` and a ≤120-char company `hook` (observation). The 120-char cap is enforced in code (`capObservation`). Rendering is deterministic (`renderOutreach`), so the fixed body never drifts or hallucinates. Framing is **skill-fit + existing project proof** — no new demo build is promised (a demo is cheap for a designer but slow for a developer).

## Tools (`src/tools/`)

| Server | Tool | Purpose |
|---|---|---|
| `funding-feeds` | `get_recent_funding` | RSS sweep → compact JSON |
| `startups-gallery` | `get_gallery_funding` | Scrapes startups.gallery/news |
| `ipo-platform` | `get_india_funding` | Scrapes ipoplatform.com (India) |
| `ranking-tools` | `rank_opportunities` | Step 6 math |

## Key rules
1. **Structured handoffs** — every stage returns zod-validated JSON, never prose.
2. **One startup per outreach-designer** — avoids 5× context bloat.
3. **Sector filter in funding-researcher** — drops crypto/web3, gaming, hardware, legacy-enterprise early.
4. **Anti-hallucination** — emit `"not_found"` (rendered as `TBD`) unless value came from real Exa/WebFetch result. No fabricated founder names or URLs; founder greeting falls back to "there".
5. **Fixed body in code** — the 80% email body is filled by `renderOutreach`, not an LLM, so it can't drift; the agent only supplies personalized slots.
6. **Write-then-send** — combined `report.md` written before any Telegram send; artifact survives transport failure. One company per message, sent sequentially; a single send failure does not stop the rest.
7. **Robustness** — `maxTurns` on every subagent, `.filter(Boolean)` on parallel results, graceful Exa degradation.
8. **Cross-run dedup** — already-contacted companies (tracked in a Google Sheet, read live each run) are excluded before top-5 selection; a Sheets outage degrades to "contact everyone" rather than sinking the run.

## Output
One Telegram message per top-5 company: an 80%-fixed / 20%-personalized outreach email chosen by skill track, prefixed with a metadata header (rank · funding · fit score · best send time). All messages written to `report.md` (joined by `---`), then sent one at a time, best-first.

## Status
- [x] 5 deterministic tools
- [x] Orchestrator + 3 subagents with schemas
- [x] Three fixed skill-track email templates (Mobile / Web / GenAI)
- [x] Telegram send (`src/lib/telegram.ts`) — one message per company
- [x] Google Sheets lead store (`src/lib/contactedSheet.ts`) — live cross-run dedup
- [ ] Daily cron trigger

## Conventions
- Heavy fetching in tools → return compact JSON.
- Least-privilege tools per subagent.
- `.env` holds `BOT_TOKEN`, `CHAT_ID`, `SHEETS_API_KEY`, `SHEET_ID`, AWS creds (gitignored).
