<div align="center">

<h1>🛰️ Funding&nbsp;→&nbsp;Outreach</h1>

<p><strong>From a startup's funding news to a proof-of-work outreach plan — automatically, every day.</strong></p>

<p><em>An autonomous daily agent that finds freshly-funded startups, scores fit, designs proof-of-work projects, and emails you a ranked report.</em></p>

<p>
  <img alt="Node" src="https://img.shields.io/badge/Node-22-339933?logo=node.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-ESM-3178C6?logo=typescript&logoColor=white">
  <img alt="Claude Agent SDK" src="https://img.shields.io/badge/Claude_Agent_SDK-0.3-D97757">
</p>

</div>

---

## What it does

Each day the agent runs a 7-step pipeline: discovers startups that announced funding in the last 72h, filters to sectors where the user has an edge, enriches + scores founder accessibility, designs a sub-48h proof-of-work per startup, ranks them, and renders a decision-focused email to [`report.md`](./report.md).

> **Ranking** = `expectedLearning × hiringProbability × founderAccessibility` — computed in code, not by the LLM, so it's reproducible.

## Architecture

An **orchestrator** (`query()` loop) drives four least-privilege subagents. **Every handoff is a schema-validated JSON object, never prose** — typed, compact, lossless.

| Subagent | What it does | Returns |
|---|---|---|
| `funding-researcher` | Sweeps ~9 funding sources for last-72h raises and filters to edge sectors | `Candidate[]` — name, url, date, sector |
| `fit-strategist` | Enriches founders/links/team size and scores fit /10 | `ScoredStartup[]` — + founders, links, score |
| `pow-designer` | Designs a sub-48h proof-of-work per startup (5 in parallel) | `ProofOfWork` — one per startup |
| `report-writer` | Renders the ranked daily email | writes `report.md` |

Ranking (Step 6) and the gated send (Step 7) stay in the orchestrator. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the rationale and sequence diagram.

## Deterministic tools — `src/tools/`

Heavy/dirty work lives in tools so raw data never pollutes the context window.

- **`get_recent_funding`** — fetches 8 RSS feeds in parallel → windows by date → keyword-filters → dedupes → returns ~12 KB compact JSON.
- **`check_url`** — HTTP liveness check for public hiring/careers pages.
- **`rank_opportunities`** — Step 6 ranking math.
- **`save_report`** — writes `report.md` before any send.

## Quick start

```bash
npm install
cp .env.example .env      # add AWS Bedrock / Anthropic credentials
npm start                 # runs the pipeline → writes report.md
npm run view              # open the run log viewer
```

### Environment (`.env`)

```
CLAUDE_CODE_USE_BEDROCK=1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
ANTHROPIC_MODEL=...
```

## Design guarantees

- **No fabricated founder data** — LinkedIn `/in/` URLs are emitted only if they appear verbatim in a real Exa/WebFetch result; otherwise `"not_found"`.
- **Always writes before sending** — `report.md` survives transport failure; sending is gated and external.
- **Graceful degradation** — Exa is enrichment, not a hard dependency; one dead `pow-designer` can't sink the report.
- **`maxTurns` on every subagent** — runaway-loop backstop.

## Layout

```
src/
  agent.ts          orchestrator pipeline (7 steps)
  schemas.ts        zod handoff schemas
  agents/           4 subagent definitions
  tools/            deterministic MCP tools
  lib/              stage runner, ranking, logger, helpers
  config/           feeds + user profile
```

## Status

- [x] Deterministic tools (built, tested)
- [x] Orchestrator + 4 subagents with structured outputs
- [ ] `email_send` mechanism (cron mailer on `report.md`)
- [ ] Daily scheduled trigger
- [ ] SQL lead store for cross-run dedup
