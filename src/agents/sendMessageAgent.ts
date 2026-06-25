import { FIRST_NAME, profile, type StageConfig } from "@/agents/_shared";

// 4. Send-message agent (task.md Step 7 render). Returns the Telegram message
// markdown as text. The orchestrator writes it to report.md, then sends it via
// the deterministic Telegram client (lib/telegram.ts) — the agent never sends.
//
// The template below is FROZEN: it is the exact message shape the user wants on
// every run. The agent ONLY fills {{placeholders}} from the ranked dossier JSON
// in the prompt — it must not add, drop, or reorder sections. Locking the
// template here keeps output quality identical run-to-run.
const TEMPLATE = `# Daily Startup Job Scout — {{date}}

Hi {{user_first_name}},

**Best target today:** **{{startup_name}}**
**Why:** {{startup_one_liner}}

---

## Top Opportunity Today

| Field | Details |
|:--|:--|
| **Startup** | **#1 · {{startup_name}}** |
| **Score** | **{{score}}** |
| **Stage** | **{{stage}}** |
| **Investors** | {{investors}} |
| **Hiring page** | {{hiring_page}} |
| **Founders** | {{founders}} |

### What they do

{{startup_name}} is an {{what_they_do}}.

**In simple terms**: {{simple_terms}}

---

## Proof-of-Work to Build

### Build: **{{build_name}}**

{{build_definition}}

{{build_analogy_intro}}

- {{check_1}}
- {{check_2}}
- {{check_3}}
- {{check_4}}
- {{check_5}}

{{build_payoff}}

### Why it matters

{{why_it_matters_1}}

{{why_it_matters_2}}

{{why_it_matters_3}}

### Demo scope

| Deliverable | Detail |
|:--|:--|
| **{{deliverable_1_label}}** | {{deliverable_1_detail}} |
| **{{deliverable_2_label}}** | {{deliverable_2_detail}} |
| **{{deliverable_3_label}}** | {{deliverable_3_detail}} |
| **{{deliverable_4_label}}** | {{deliverable_4_detail}} |
| **{{deliverable_5_label}}** | {{deliverable_5_detail}} |


**Difficulty:** {{difficulty}}
**Founder response probability:** {{response_probability}}

---

## Exact Outreach Message

<details open>
<summary><b>Email to {{outreach_target}}</b></summary>

> **Subject:** {{outreach_subject}}
>
>
> Hi {{outreach_first_name}},
>
>
> {{outreach_p1}}
>
>
> {{outreach_p2}}
>
>
> Demo: [insert Loom/GitHub link]
>
>
> {{outreach_cta}}
>
>
> Best,
> {{user_first_name}}
> GitHub: {{github_handle}}
> LinkedIn: {{linkedin_handle}}

</details>

---

## Other Strong Targets

| Rank | Startup | Score | Funding | What they do |
|:--:|:--|:--:|:--|:--|
| **2** | **{{rank2_name}}** | **{{rank2_score}}** | {{rank2_funding}} | {{rank2_desc}} |
| **3** | **{{rank3_name}}** | **{{rank3_score}}** | {{rank3_funding}} | {{rank3_desc}} |
| **4** | **{{rank4_name}}** | **{{rank4_score}}** | {{rank4_funding}} | {{rank4_desc}} |
| **5** | **{{rank5_name}}** | **{{rank5_score}}** | {{rank5_funding}} | {{rank5_desc}} |

---

## Today's Action

- [ ] Build the **{{startup_name}} {{build_name}}** first.
- [ ] {{action_2}}
- [ ] {{action_3}}
- [ ] Record a short Loom.
- [ ] Send the {{outreach_first_name}} outreach email with the demo link.

=={{priority_line}}==`;

// Per-placeholder length budget. Keeps message length and tone within ±10%
// run-to-run so quality is reproducible. "chars" = characters incl. spaces;
// "w" = words; "sent." = sentences; "≤" marks a hard ceiling. Single-line
// fields must contain NO newlines (they sit in tables / bold lines).
const BUDGET = `## Fill-in Variables — length budget (enforce on every value)

| Variable | Meaning | Length budget | Example |
|:--|:--|:--|:--|
| {{date}} | Report date, YYYY-MM-DD | exactly 10 chars | 2026-06-25 |
| {{user_first_name}} | Greeting name | 1 w · 3–15 chars | Uditya |
| {{startup_name}} | #1 target name | ≤ 4 w · 3–30 chars | Hang Ten Systems |
| {{startup_one_liner}} | One-line why-this-target | 1 sent. · 80–160 chars | Their core product is a reusable AI skills library for agentic code generation — exactly where your proof-of-work can stand out. |
| {{score}} | Score out of 10 | 6–9 chars | 8.4 / 10 |
| {{stage}} | Funding stage + amount | 1–3 w · 6–20 chars | $32M Seed |
| {{investors}} | Comma-separated investors | 1–4 names · 10–60 chars | Mayfield, Aramco Ventures |
| {{hiring_page}} | URL | ≤ 60 chars · valid URL | https://hangten.ai/ |
| {{founders}} | Comma-separated founders | 1–5 names · 10–90 chars | Vishal Sikka, Navin Budhiraja |
| {{what_they_do}} | 1 sentence, bold the core category | 1 sent. · 90–160 chars | enterprise AI startup building **agentic code generation** around a reusable AI **skills library** |
| {{simple_terms}} | 1 plain-English sentence | 1 sent. · 90–180 chars | they are trying to turn repeatable engineering tasks into reusable AI-powered skills |
| {{build_name}} | Proof-of-work project name | ≤ 3 w · 5–25 chars | Skill Harness |
| {{build_definition}} | 1 sentence defining the build | 1 sent. · 90–170 chars | A **Skill Harness** is a testing and quality-control system for AI skills. |
| {{build_analogy_intro}} | 1 sentence setting up the bullets | 1 sent. · 80–160 chars · ends in ":" | Think of each AI skill like a reusable playbook: |
| {{check_1..5}} | 5 short question-style bullets | each 1 line · 20–70 chars | Does it take the right inputs? |
| {{build_payoff}} | 1 sentence closing the analogy | 1 sent. · 50–120 chars | The Skill Harness answers these questions automatically. |
| {{why_it_matters_1}} | 1 sentence — what's at stake | 1 sent. · 60–140 chars | Hang Ten's reusable AI skills are likely part of its **core IP**. |
| {{why_it_matters_2}} | 2 sentences — the cost of failure | 2 sent. · 90–180 chars | If those skills are unreliable, every deployment needs manual review. That slows every customer. |
| {{why_it_matters_3}} | 2 sentences — the upside | 2 sent. · 120–220 chars | A Skill Harness turns each skill into a testable, versioned, auditable asset. That makes scaling cheaper and safer. |
| {{deliverable_N_label}} (N=1–5) | Demo-scope row label | ≤ 3 w · 4–18 chars | Sample skills |
| {{deliverable_N_detail}} (N=1–5) | Demo-scope row detail | 1 line · 25–80 chars | Ship with 5 reusable demo skills. |
| {{difficulty}} | Difficulty out of 10 | 3–5 chars | 7/10 |
| {{response_probability}} | Low / Medium / High | 1 w | Medium |
| {{outreach_target}} | Person to email | 2–3 w · 5–30 chars | Vishal Sikka |
| {{outreach_subject}} | Email subject line | 1 line · 30–70 chars | Improving reliability of Hang Ten's AI skills library |
| {{outreach_first_name}} | Email greeting name | 1 w · 3–15 chars | Vishal |
| {{outreach_p1}} | the bottleneck you see | 1–2 sent. · 180–320 chars | As Hang Ten scales, one bottleneck becomes critical: skill reliability. |
| {{outreach_p2}} | what you built (bold the name) | 1–2 sent. · 200–340 chars | I built **Skill Harness**: an MCP server + dashboard that scores each skill. |
| {{outreach_cta}} | the ask | 1 sent. · 60–130 chars · ends in "?" | Would you be open to a 15-minute call this week? |
| {{github_handle}} | github.com/handle | ≤ 40 chars | github.com/uditya-kumar |
| {{linkedin_handle}} | linkedin.com/in/handle | ≤ 40 chars | linkedin.com/in/udityakumar |
| {{rankN_name}} (N=2–5) | Other-target name | ≤ 3 w · 3–25 chars | Runlayer |
| {{rankN_score}} (N=2–5) | Other-target score | 3–5 chars | 8.01 |
| {{rankN_funding}} (N=2–5) | Other-target funding | 8–22 chars | $30M Series A |
| {{rankN_desc}} (N=2–5) | Other-target what-they-do | 1 line · 40–100 chars · starts "Builds" | Builds governance layers for MCP-based agent tools. |
| {{action_2}} | 2nd action item | 1 line · 20–60 chars · imperative | Add 5 sample skills. |
| {{action_3}} | 3rd action item | 1 line · 20–60 chars · imperative | Build the dashboard pass/fail view. |
| {{priority_line}} | 1 sentence priority summary | 1 line · 60–130 chars | Priority: Hang Ten first, Runlayer second. |

Length contract (counts): ALWAYS 5 check bullets, 5 deliverable rows, and 4 other-target rows (ranks 2–5). Sentence counts: {{what_they_do}}, {{simple_terms}}, {{build_definition}}, each {{check_n}}, {{build_payoff}}, {{why_it_matters_1}}, and {{outreach_cta}} are 1 sentence; {{why_it_matters_2}} and {{why_it_matters_3}} are 2 sentences each; outreach paragraphs are 1–2 sentences.

Length contract (whole message): total body should land at 3,400–3,900 chars and 120–150 lines, with a HARD CEILING of ≤ 4,096 chars (Telegram's single-message limit). Ranks 2–5 scores must DESCEND and all stay strictly below {{score}}. If a value is unknown, write "TBD" — never delete a row or leave a placeholder unfilled.`;

export const sendMessageAgent: StageConfig = {
  allowedTools: [],
  maxTurns: 5,
  system: `You render the daily startup-scout Telegram message from ranked JSON (startups, proof-of-work plans, today's date) given in the prompt.

Output the FROZEN template below with every {{placeholder}} filled in. Do NOT add, remove, reorder, or rename any section, table, heading, or list item. Keep all literal markdown (pipes, blockquotes, <details>, the "==...==" highlight, the two trailing spaces after some lines) EXACTLY as shown. Output ONLY the final message — no commentary, no code fences.

Every value MUST respect the per-placeholder length budget below. Aim for the MIDDLE of each range so total message length stays within ±10% run-to-run. Treat "≤" values as hard ceilings and keep single-line fields free of newlines. Obey both length contracts (counts and whole-message) at the end of the budget.

Fixed values (use verbatim):
- {{user_first_name}} and {{outreach_first_name}} → "${FIRST_NAME}"
- {{github_handle}} → "${profile.links.github}"
- {{linkedin_handle}} → "${profile.links.linkedin}"
- Leave "Demo: [insert Loom/GitHub link]" EXACTLY as written — it is a manual placeholder, do not fill it.

Placeholder sourcing (from the ranked dossier in the prompt):
- {{date}} → today's date.
- The #1 ranked startup fills the "Top Opportunity", "Proof-of-Work", and "Outreach" sections. {{score}} uses the composite \`score\` field (NOT the raw 0-1 fitScore). {{stage}}, {{investors}}, {{hiring_page}}, {{founders}} from its scored data.
- {{what_they_do}} / {{simple_terms}} → a precise then plain-English explanation of #1.
- {{build_name}} = a short name for the proof-of-work \`build\`. {{build_definition}}, {{build_analogy_intro}}, {{check_1..5}} (concrete capabilities/scope checklist), {{build_payoff}} → expand the \`build\` and \`painPoints\`.
- {{why_it_matters_1..3}} → from \`whyItMatters\`. {{deliverable_1..5_label/detail}} → concrete demo deliverables. {{difficulty}} → the numeric difficulty. {{response_probability}} → the qualitative responseProbability.
- {{outreach_target}} = #1 founder name (or "the founder"). {{outreach_subject}}, {{outreach_p1}}, {{outreach_p2}}, {{outreach_cta}} → derived from \`outreachMessage\`.
- Ranks 2-5 fill the "Other Strong Targets" rows from the remaining ranked startups, using each one's composite \`score\`. ALWAYS keep all 4 rows; if a target's data is missing, write "TBD" in that cell — never delete a row.
- {{action_2}} / {{action_3}} → two concrete next steps toward the build.
- {{priority_line}} → one punchy priority sentence for today.

If any value is unknown (including "not_found" inputs), write "TBD" — never delete a row, leave a placeholder unfilled, or output an empty cell.

${BUDGET}

The frozen template:
${TEMPLATE}`,
};
