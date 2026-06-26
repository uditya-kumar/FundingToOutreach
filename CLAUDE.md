# Daily Startup Scout — Build Spec

Automated daily agent (Claude Agent SDK, TypeScript) that finds freshly-funded startups, scores fit, designs proof-of-work projects, and sends a ranked report via Telegram.

## Stack
- **Runtime:** Node 22, TypeScript via `tsx` (`npm start` → `npx tsx --env-file=.env src/agent.ts`). ESM.
- **Agent SDK:** `@anthropic-ai/claude-agent-sdk` — orchestrator runs each stage via `runStage()` / `runStageText()`.
- **Data:** `cheerio` (scraping), `zod` (schemas), Exa MCP (http) for web enrichment.

## Architecture: orchestrator + 4 subagents

Each stage is a self-contained `query()` call with schema-validated JSON handoffs (no prose between stages).

| Subagent | Steps | Tools | Returns |
|---|---|---|---|
| `funding-researcher` | 1+2 | `get_recent_funding`, `get_gallery_funding`, `get_india_funding`, Exa | `Candidate[]` |
| `fit-strategist` | 3+4 | Exa, `check_url` | `ScoredStartup[]` |
| `pow-designer` | 5 | Exa | `ProofOfWork` (one instance per top-5 startup, parallel) |
| `sendMessageAgent` | 7 | (none) | Telegram message markdown (frozen template with length budgets) |

**Orchestrator-only steps:**
- Step 6: `computeRanking()` — `rank = fitScore × expectedLearning` (code, not LLM).
- Step 7: write `report.md` → send via `sendTelegramMessage()`.

## Tools (`src/tools/`)

| Server | Tool | Purpose |
|---|---|---|
| `funding-feeds` | `get_recent_funding` | RSS sweep → compact JSON |
| `startups-gallery` | `get_gallery_funding` | Scrapes startups.gallery/news |
| `ipo-platform` | `get_india_funding` | Scrapes ipoplatform.com (India) |
| `link-tools` | `check_url` | HTTP liveness for public URLs |
| `ranking-tools` | `rank_opportunities` | Step 6 math |

## Key rules
1. **Structured handoffs** — every stage returns zod-validated JSON, never prose.
2. **One startup per pow-designer** — avoids 5× context bloat.
3. **Sector filter in funding-researcher** — drops crypto/web3, gaming, hardware, legacy-enterprise early.
4. **Anti-hallucination** — emit `"not_found"` (rendered as `TBD`) unless value came from real Exa/WebFetch result. No fabricated founder names or URLs.
5. **Write-then-send** — `report.md` written before Telegram send; artifact survives transport failure.
6. **Robustness** — `maxTurns` on every subagent, `.filter(Boolean)` on parallel results, graceful Exa degradation.

## Output
Telegram message follows frozen template with per-placeholder length budgets (3,400–3,900 chars, ≤4,096 hard ceiling). Written to `report.md`, then sent via `sendTelegramMessage()`.

## Status
- [x] 5 deterministic tools
- [x] Orchestrator + 4 subagents with schemas
- [x] Telegram send (`src/lib/telegram.ts`)
- [ ] Daily cron trigger
- [ ] SQL lead store (cross-run dedup)

## Conventions
- Heavy fetching in tools → return compact JSON.
- Least-privilege tools per subagent.
- `.env` holds `BOT_TOKEN`, `CHAT_ID`, AWS creds (gitignored).
