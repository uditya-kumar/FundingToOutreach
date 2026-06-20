# Daily Startup Scout — Agent Architecture

> Automated career-strategy agent built on the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`).
> Runs once per day, finds freshly-funded startups, scores fit, designs proof-of-work projects,
> and emails a ranked daily report. See [`task.md`](./task.md) for the full spec.

---

## 1. Architecture Decision: Single vs. Multi-Agent

| Criterion | Single agent (one `query()` loop) | **Multi-agent (orchestrator + subagents)** ✅ |
| --- | --- | --- |
| Task shape | One linear job | 7 distinct stages, 2 of them fan out (N sources, top-5 startups) |
| Parallelism | None — serial tool calls | Discovery & deep-dive run **in parallel** per item |
| Context bloat | All 9 sources + 5 deep-dives pollute one window | Each subagent gets an **isolated context**; only summaries return |
| Separation of concerns | Research + scoring + writing tangled | Researcher / Strategist / Writer have focused system prompts + tool sets |
| Tool safety | One broad tool grant | Each subagent gets **least-privilege** tools (`tools` field) |
| Cost / latency | Cheaper per run, slower wall-clock | More tokens, but parallel fan-out is faster and more reliable |

**Decision → Multi-agent, orchestrator-worker pattern.**

The work is naturally a pipeline with two fan-out stages (Step 1 sweeps ~9 funding sources;
Step 5 deep-dives the top 5 startups). The SDK's [subagents](https://code.claude.com/docs/en/agent-sdk/subagents)
let the main `query()` loop act as an **orchestrator** that delegates isolated subtasks via the
`Agent` tool, keeping each worker's context clean and its tools scoped. A single agent would
work for an MVP, but would serialize all research, blow up its context window, and mix concerns.

---

## 2. Architecture Diagram

```mermaid
flowchart TD
    CRON["⏰ Daily trigger<br/>(cron / scheduled run)"] --> MAIN

    subgraph ORCH["🧠 Orchestrator Agent — main query() loop"]
        direction TB
        MAIN["Reads task.md as system prompt<br/>permissionMode: bypassPermissions<br/>allowedTools includes 'Agent'<br/>Coordinates the 7-step pipeline"]
    end

    MAIN -->|"Step 1+2: delegate sweep"| DISC
    MAIN -->|"Step 3+4: delegate enrich/score"| SCOUT
    MAIN -->|"Step 5: delegate per top-5"| POW
    MAIN -->|"Step 6+7: delegate compose"| WRITER

    subgraph SUBS["👥 Subagents (AgentDefinition + scoped tools)"]
        direction TB

        DISC["🔎 funding-researcher<br/><i>Find startups funded in last 72h</i><br/>tools: WebSearch, WebFetch,<br/>mcp__exa-web-search__*<br/>FAN-OUT: one pass per source<br/>(TechCrunch, Entrackr, Inc42, YS,<br/>ET, ISN, LiveMint, YC, VC blogs)"]

        SCOUT["🎯 fit-strategist<br/><i>Filter to sectors w/ edge,<br/>enrich founders, score /10</i><br/>tools: WebSearch, WebFetch,<br/>mcp__exa-web-search__*"]

        POW["🛠️ proof-of-work-designer<br/><i>Per top-5: pain points, 48h build,<br/>impact, difficulty, response prob</i><br/>tools: Read, mcp__exa-web-search__*<br/>FAN-OUT: 5 parallel deep-dives"]

        WRITER["✍️ report-writer<br/><i>Rank + render daily email<br/>in the exact task.md format</i><br/>tools: Read, Write"]
    end

    DISC -.->|"raw funded startups"| MAIN
    SCOUT -.->|"scored shortlist"| MAIN
    POW -.->|"5 proof-of-work plans"| MAIN
    WRITER -.->|"final email markdown"| MAIN

    MAIN --> OUT["📧 Step 7 output<br/>email_send tool (MCP / SMTP)<br/>or write report.md → cron mailer"]

    subgraph TOOLS["🧰 Tools & Integrations"]
        direction LR
        T1["Exa Web Search MCP<br/>(http: mcp.exa.ai/mcp)"]
        T2["WebFetch / WebSearch<br/>(built-in)"]
        T3["Read / Write / Glob<br/>(filesystem)"]
        T4["email_send<br/>(MCP server — TO ADD)"]
    end

    DISC -. uses .-> T1
    DISC -. uses .-> T2
    SCOUT -. uses .-> T1
    POW -. uses .-> T1
    WRITER -. uses .-> T3
    OUT -. uses .-> T4

    classDef orch fill:#1e3a8a,stroke:#93c5fd,color:#fff;
    classDef sub fill:#065f46,stroke:#6ee7b7,color:#fff;
    classDef tool fill:#7c2d12,stroke:#fdba74,color:#fff;
    classDef io fill:#4c1d95,stroke:#c4b5fd,color:#fff;
    class MAIN orch;
    class DISC,SCOUT,POW,WRITER sub;
    class T1,T2,T3,T4 tool;
    class CRON,OUT io;
```

---

## 3. Pipeline ↔ Agent mapping

| task.md step | Owner | Mode |
| --- | --- | --- |
| **1.** Find startups funded in last 72h | `funding-researcher` | fan-out across ~9 sources |
| **2.** Keep only sectors with an edge | `funding-researcher` → `fit-strategist` | filter |
| **3.** Enrich (founder, LinkedIn, hiring page, team size) | `fit-strategist` | per startup |
| **4.** "Why hire Uditya?" + score /10 | `fit-strategist` | reasoning |
| **5.** Top-5: pain points, 48h proof-of-work, impact, difficulty, reply prob | `proof-of-work-designer` | **5 parallel deep-dives** |
| **6.** Rank = Learning × Hiring Prob × Accessibility | Orchestrator | synthesis |
| **7.** Render + send daily email | `report-writer` → `email_send` | output |

---

## 4. Implementation Notes (vs. current `src/agent.ts`)

The current scaffold is a **single-agent stub** — empty `prompt`, no `agents`, Exa MCP only.
To realize this architecture:

1. **Load `task.md` as the prompt / system prompt** instead of the empty string.
2. **Add the `Agent` tool** to `allowedTools` so the orchestrator can invoke subagents.
3. **Add an `agents: { ... }` map** with the four `AgentDefinition`s above, each with a focused
   `prompt` and a least-privilege `tools` array.
4. **Add `WebSearch`** (and keep `WebFetch`) so researchers aren't limited to a single source URL.
5. **Add an email mechanism** — an `email_send` MCP server (e.g. Resend/SMTP) for Step 7, or write
   `report.md` and let the cron job mail it. *(This is the one capability `task.md` requires that the
   current tool set is missing.)*
6. **Schedule it** — wrap the run in a daily cron / scheduled task so it executes "every day".
7. *(Optional)* Use **structured outputs** between stages so the shortlist/scores pass as typed JSON
   rather than free-form text.
