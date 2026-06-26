# Daily Startup Scout — Architecture

Multi-agent pipeline built on Claude Agent SDK. Runs daily: discovers funded startups → scores fit → designs proof-of-work → sends ranked report to Telegram.

## Why multi-agent?
- **7 distinct stages** with two fan-outs (multiple funding sources, top-5 parallel deep-dives).
- **Isolated context** per subagent — only schema-validated JSON returns to orchestrator.
- **Least-privilege tools** — each subagent gets only what it needs.

## Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR (agent.ts)                     │
│  Runs each stage via runStage()/runStageText(), handles ranking,    │
│  writes report.md, sends Telegram message                           │
└─────────────────────────────────────────────────────────────────────┘
         │                │                │                │
         ▼                ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  funding-   │  │    fit-     │  │    pow-     │  │ sendMessage │
│ researcher  │  │ strategist  │  │  designer   │  │    Agent    │
│ Steps 1+2   │  │ Steps 3+4   │  │   Step 5    │  │   Step 7    │
│             │  │             │  │ (×5 parallel│  │  (render)   │
│ Candidate[] │  │ScoredStartup│  │ ProofOfWork │  │  markdown   │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

## Step breakdown

| Step | Owner | What happens |
|---|---|---|
| 1+2 | funding-researcher | Sweep RSS + scrapers → filter to edge sectors → `Candidate[]` |
| 3+4 | fit-strategist | Enrich via Exa → score → `ScoredStartup[]` |
| 5 | pow-designer (×5) | One instance per top-5 startup → `ProofOfWork` |
| 6 | orchestrator | `rank = fitScore × expectedLearning` (code) |
| 7 | sendMessageAgent → orchestrator | Render frozen template → write `report.md` → send Telegram |

## Data flow

All stage boundaries are zod-validated JSON:
- `CandidateList` → `ScoredList` → `ProofOfWork[]` → ranked dossier → message markdown.

Unknown values render as `TBD`. No prose between stages.

## Tools by stage

| Stage | Tools |
|---|---|
| funding-researcher | `get_recent_funding`, `get_gallery_funding`, `get_india_funding`, Exa |
| fit-strategist | Exa, `check_url` |
| pow-designer | Exa |
| sendMessageAgent | (none) |
| orchestrator | `computeRanking()`, `sendTelegramMessage()`, `writeFile()` |

## Output

Frozen Telegram template with per-placeholder length budgets. Total: 3,400–3,900 chars, ≤4,096 hard ceiling. Written to `report.md` before send.
