# Daily Startup Scout — Build Spec

Automated daily agent (Claude Agent SDK, TypeScript) that finds freshly-funded startups,
scores fit, designs proof-of-work projects, and emails a ranked report. Full task spec: [`task.md`](./task.md).
Architecture rationale: [`ARCHITECTURE.md`](./ARCHITECTURE.md). Execution flow: see ARCHITECTURE sequence diagram.

## Stack
- Runtime: Node 22, TypeScript via `tsx` (`npm start` → `npx tsx src/agent.ts`). ESM (`"type": "module"`).
- `@anthropic-ai/claude-agent-sdk` — orchestrator `query()` loop + programmatic subagents (`AgentDefinition`).
- `fast-xml-parser`, `zod` — RSS tool. Exa MCP (http) for web enrichment.

## Architecture: orchestrator + 4 subagents
The main `query()` loop is the **orchestrator** (`allowedTools` includes `Agent`). It runs `task.md`'s
7 steps, delegating each stage to a focused subagent with least-privilege tools. **Every handoff is a
schema-validated JSON object, never prose** — typed, compact, lossless (see Rule 1).

| Subagent | task.md steps | Tools | Returns (schema) |
|---|---|---|---|
| `funding-researcher` | 1 + 2 | `get_recent_funding`, Exa, WebFetch | `Candidate[]` — name, url, date, oneLiner, sector |
| `fit-strategist` | 3 + 4 | Exa, WebFetch | `ScoredStartup[]` — + founders, links, score, accessibility, learning |
| `pow-designer` | 5 | Exa, WebFetch, Read | `ProofOfWork` — one per startup, 5 parallel instances |
| `report-writer` | 6 + 7 | Read, Write | writes `report.md` |

Step 6 (ranking math) and Step 7 (gated send) stay in the **orchestrator**, not a subagent.

## RSS tool — `src/rssTool.ts` (DONE, tested)
`rssServer` exposes `get_recent_funding({ hoursBack=72 })`. Server-side: fetch 8 feeds in parallel →
window by pubDate → funding-keyword filter → within-run dedupe → entity-decode titles → return ~12 KB
compact JSON `{source,title,url,date}`. Raw XML never enters the context window — this is the core
context-pollution defense. **Stateless** (no cross-run memory; SQL dedup is a future concern).

## Required improvements (build these into `src/agent.ts`)

**1. Structured outputs on every handoff.** Each subagent returns a zod/JSON-schema object, not text.
Prevents narration polluting the orchestrator and stops silent loss of `url`/`date`/founder fields.
Define one schema per stage (`Candidate`, `ScoredStartup`, `ProofOfWork`).

**2. One startup per `pow-designer`.** Spawn 5 instances, each receiving ONLY its own startup's data —
never the full shortlist. Avoids 5× context per instance.

**3. Sector filter inside `funding-researcher` (before enrichment).** Researcher drops crypto/web3,
gaming, hardware/IoT, legacy-enterprise using titles+one-liners, returning ~12 relevant candidates not 44.
Keeps orchestrator lean and stops `fit-strategist` wasting web-fetches on discards. (Strategist may still
do a final sanity drop.)

**4. Anti-hallucination on founder data.** `fit-strategist` must NEVER fabricate founder names, LinkedIn,
or hiring URLs. Emit `"not_found"` unless the value came from a real Exa/WebFetch result. Verification
splits by URL type:
- **Hiring/careers pages (and other public URLs)** → HTTP-verify with `check_url`; a 404 means wrong URL, drop it.
- **Founder LinkedIn (`/in/` profiles)** → CANNOT be HTTP-verified (LinkedIn returns anti-bot codes that
  don't distinguish real from fake — confirmed by probe). Safeguard is **provenance**: only emit a
  `/in/` URL that appears VERBATIM in an Exa/WebFetch result. NEVER construct a slug from the founder's
  name. If no source returned one, emit `"not_found"`. (A confidently-guessed wrong profile is the real
  failure mode, and HTTP checking would give false confidence on it.)

**5. Deterministic, confirm-gated send (Step 7).** ALWAYS write `report.md` first, then send. Output
survives transport failure and is inspectable. Sending is outward-facing/irreversible — gate the actual
send (manual confirm or hand the file to the cron mailer); the agent does not fire email freely.

**6. Robustness.**
- `maxTurns` on every subagent (runaway-loop backstop).
- `.filter(Boolean)` on parallel Step-5 results — one dead `pow-designer` must not sink the report.
- Graceful Exa degradation — if Exa is down, the run completes on RSS data alone. Exa is enrichment, not
  a hard dependency.

## Ranking (Step 6, orchestrator)
`rank = expectedLearning × hiringProbability × founderAccessibility`. These must be carried as NUMBERS in
the schemas (`fit-strategist` → accessibility + learning; `pow-designer` → responseProbability ⇒ hiringProb),
so the orchestrator multiplies rather than improvising — keeps ranking reproducible.

## Output
Email rendered in the exact `task.md` template (subject, top opportunity, proof-of-work, outreach message,
"other strong targets" table, today's action). Written to `report.md`, then sent.

## Deterministic tools (`src/tools/`, all tested)
Modular: `config/feeds.ts` (data), `lib/{html,mcp}.ts` (shared helpers), one tool per file in `tools/`,
barrel `tools/index.ts` → `{ mcpServers, ALL_TOOL_NAMES }`.
- `funding-feeds` / `get_recent_funding` — RSS sweep → compact JSON (Step 1 plumbing).
- `link-tools` / `check_url` — general HTTP liveness check for public URLs (hiring/careers pages). `ok`=2xx/3xx.
  NOT for personal LinkedIn `/in/` (anti-bot) — those use provenance (Rule 4).
- `ranking-tools` / `rank_opportunities` — Step 6 math, reproducible (don't let LLM compute it).
- `report-tools` / `save_report` — write `report.md` before send (Rule 5 write-half).

## Status / TODO
- [x] `src/tools/*` — 4 deterministic tools built, modular, tested.
- [ ] `src/agent.ts` — wire orchestrator + 4 subagents with schemas (currently a single-agent stub).
- [ ] `email_send` mechanism (MCP or cron mailer on `report.md`) — only capability `task.md` needs that's missing.
- [ ] Daily cron / scheduled trigger.
- [ ] (Future) SQL lead store for cross-run dedup.

## Conventions
- Keep heavy/dirty fetching in tools; return compact JSON. Prose stays out of context.
- Least-privilege `tools` per subagent. Don't grant `Write` to research agents.
- `.env` holds API keys (gitignored). Add `report.md` to `.gitignore` if versioned.
