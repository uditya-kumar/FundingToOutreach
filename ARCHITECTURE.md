# Daily Startup Scout — Architecture

Multi-agent pipeline built on Claude Agent SDK. Runs daily: discovers funded startups → scores fit → categorizes each into a skill track → sends one personalized outreach email per top company to Telegram.

## Why multi-agent?
- **7 distinct stages** with two fan-outs (multiple funding sources, top-5 parallel deep-dives).
- **Isolated context** per subagent — only schema-validated JSON returns to orchestrator.
- **Least-privilege tools** — each subagent gets only what it needs.

## Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR (agent.ts)                     │
│  Runs each stage via runStage(), handles ranking, renders each      │
│  email (code), writes report.md, sends one Telegram msg per company │
└─────────────────────────────────────────────────────────────────────┘
         │                │                │
         ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  funding-   │  │    fit-     │  │  outreach-  │
│ researcher  │  │ strategist  │  │  designer   │
│ Steps 1+2   │  │ Steps 3+4   │  │   Step 5    │
│             │  │             │  │ (×5 parallel│
│ Candidate[] │  │ScoredStartup│  │  Outreach   │
└─────────────┘  └─────────────┘  └─────────────┘
```

## Step breakdown

| Step | Owner | What happens |
|---|---|---|
| 1+2 | funding-researcher | Sweep RSS + scrapers → filter to edge sectors → `Candidate[]` |
| 3+4 | fit-strategist | Enrich via Exa → score → `ScoredStartup[]` |
| 5 | outreach-designer (×5) | One instance per top-5 startup → categorize (Mobile/Web/GenAI) + personalized slots (greeting + ≤120-char hook) + HQ location/timezone → `Outreach` |
| 6 | orchestrator | `rank = fitScore × expectedLearning` (code) |
| 7 | orchestrator | `computeSendWindow()` (best send time from HQ tz) + `renderOutreach()` fills the fixed skill template (code) → write `report.md` → send ONE Telegram message per company, sequentially, best-first |

## Data flow

All agent-stage boundaries are zod-validated JSON:
- `CandidateList` → `ScoredList` → `Outreach[]` → ranked → per-company email markdown.

Rendering is deterministic: all three tracks share one skeleton, and the per-track copy (`focus`, `projects`, `closing`) lives in the `EMAIL_TEMPLATES` config table in `config/emailTemplates.ts`. The agent supplies only the ~20% personalized slots (founder greeting + a ≤120-char observation hook, capped in code). Unknown values render as `TBD`. No prose between stages.

## Tools by stage

| Stage | Tools |
|---|---|
| funding-researcher | `get_recent_funding`, `get_gallery_funding`, `get_india_funding`, Exa |
| fit-strategist | Exa, WebFetch |
| outreach-designer | Exa, WebFetch |
| orchestrator | `computeRanking()`, `computeSendWindow()`, `renderOutreach()`, `sendTelegramMessage()`, `writeFile()` |

## Output

One Telegram message per top-5 company, each an 80%-fixed / 20%-personalized outreach email chosen by skill track (Mobile / Web / GenAI) and prefixed with a metadata header (rank · funding · fit score · best send time). Messages are sent sequentially, best-first. All are written to `report.md` (joined by `---`) before any send.
