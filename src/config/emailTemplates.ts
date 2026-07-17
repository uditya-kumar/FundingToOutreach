// Outreach email templates — ONE per skill track (GenAI / Mobile / Web).
//
// Everything a template needs lives in EMAIL_TEMPLATES below, so the copy can be
// edited here WITHOUT touching the renderer or the rest of the pipeline. All
// three tracks share the same fixed skeleton (subject, greeting, observation
// clause, projects paragraph, closing, signature); only three text pieces differ
// per track — `focus`, `projects`, and `closing`.
//
// Each email is ~80% fixed (the copy in this file) and ~20% personalized: the
// founder greeting and a short company-specific observation (≤120 chars) that
// the outreach-designer agent produces per startup. The 120-char cap is enforced
// in code (see renderOutreach), so it holds for every track.
import { profile } from "@/config/profile";

export type Skill = "Mobile" | "Web" | "GenAI";
export const SKILLS: readonly Skill[] = ["Mobile", "Web", "GenAI"] as const;

// Hard ceiling on the personalized observation clause, enforced in code.
export const OBSERVATION_MAX_CHARS = 120;

// The GenAI track uses a tighter, hardcoded AI-role skeleton (see renderOutreach)
// whose observation slot is capped shorter than the shared Mobile/Web skeleton.
export const GENAI_OBSERVATION_MAX_CHARS = 70;

// ── EDIT COPY HERE ─────────────────────────────────────────────────────────
// One entry per track. Placeholders are filled by the renderer:
//   {{company}} → the startup name.
// `focus`    → completes "…caught my attention because my recent work has focused on {focus}."
// `projects` → the 1-2 sentence proof paragraph (existing work, no new demo promised).
// `closing`  → completes "I build across {closing}."
export const EMAIL_TEMPLATES: Record<Skill, { focus: string; projects: string; closing: string }> = {
  // NOTE: GenAI now renders a fully hardcoded AI-role email (see renderGenAI);
  // this entry is no longer read at render time — kept only to satisfy the
  // per-track Record type. Edit the GenAI copy in renderGenAI, not here.
  GenAI: {
    focus: "AI agents, MCP tooling, and the product systems around them",
    projects:
      "I built a Mutual Funds Research Agent with the Claude Agent SDK and four specialized MCP tools for structured analysis. " +
      "I also built a ConfirmTkt MCP Server for live railway search and seat availability by reverse-engineering a public API.",
    closing: "external integrations, MCP tooling, agent workflows, and the product layer around them",
  },
  Mobile: {
    focus: "building mobile products with React Native, real-time features, and end-to-end product ownership",
    projects:
      "I built a Campus Ride App that lets students create rides, join trips, and coordinate through real-time group chat using Expo, React Native, TypeScript, and PostgreSQL. " +
      "I also built a Teacher Management App for teacher discovery, ratings, and student feedback.",
    closing: "mobile interfaces, real-time interactions, backend integrations, and the product layer around them",
  },
  Web: {
    focus: "building full-stack web products, business workflows, and user-facing applications",
    projects:
      "I built Smooth Supply Hub, a full-stack B2B e-commerce platform for housekeeping supplies with product management, ordering workflows, and business-focused procurement capabilities using React, TypeScript, PostgreSQL, Vite, and Tailwind CSS.",
    closing: "frontend interfaces, backend workflows, database-backed products, and the full product layer around them",
  },
};
// ── END EDIT COPY ──────────────────────────────────────────────────────────

// The ~20% personalized slots the outreach-designer agent produces per startup.
export type OutreachPersonalization = {
  category: Skill;
  founderGreeting: string; // founder first name, or "there"
  hook: string; // ≤120-char company observation clause (capped in code)
};

// Everything code supplies deterministically (rank/score/funding + send time).
export type OutreachContext = {
  rank: number;
  score: number;
  startupName: string;
  funding: string; // e.g. "$18 Mn Seed" or "TBD"
  sendTimeNote: string; // deterministic "best time to send" value (label added here)
  companyUrl: string; // company page URL, or "not_found"
};

// Cap the personalized observation at OBSERVATION_MAX_CHARS. Trims whitespace and
// any trailing period (it flows into "<obs> caught my attention because…"), then
// truncates at a word boundary if the clause is over the limit.
function capObservation(raw: string, max: number = OBSERVATION_MAX_CHARS): string {
  const clean = raw.trim().replace(/\.+$/, "").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

// The metadata header shown above every email so the user can triage at a glance.
function header(p: OutreachPersonalization, ctx: OutreachContext): string {
  const url = ctx.companyUrl && ctx.companyUrl !== "not_found" ? ctx.companyUrl : "TBD";
  return `# #${ctx.rank} · ${ctx.startupName} · ${p.category}
**Funding:** ${ctx.funding}  |  **Fit score:** ${ctx.score}  |  **Send at:** ${ctx.sendTimeNote}

**Url:-** ${url}

---`;
}

// The signature block — shared by every track. Name, links, phone on their own
// lines (matches the AI-role email format).
function signature(): string {
  return `Best,
${profile.name}

GitHub: ${profile.links.github}

LinkedIn: ${profile.links.linkedin}`;
}

// GenAI track — a FIXED, hardcoded AI-role email. Everything outside the two
// placeholders ({{name}} greeting, {{personalization}} hook) is verbatim copy;
// the observation slot is capped at GENAI_OBSERVATION_MAX_CHARS (~70 chars).
function renderGenAI(p: OutreachPersonalization, ctx: OutreachContext): string {
  const observation = capObservation(p.hook, GENAI_OBSERVATION_MAX_CHARS);
  return `${header(p, ctx)}

**Subject:** Interested in building with ${ctx.startupName}

Hi ${p.founderGreeting},

${observation} caught my attention; it closely aligns with the reliable AI systems I've been building.

I built a Mutual Funds Research Agent using the Claude Agent SDK and specialized MCP tools for structured analysis. I also built a ConfirmTkt MCP Server for live railway search and seat availability by reverse-engineering a public API.

I work across external integrations, MCP tooling, agent workflows, and the product layer around them.

I'd love to bring that experience to the team at ${ctx.startupName}. Looking forward to hearing from you.

${signature()}`;
}

// Render ONE Telegram-ready outreach message from the track's template copy.
// GenAI uses its own hardcoded AI-role skeleton (renderGenAI); Mobile/Web share
// the skeleton below, where only EMAIL_TEMPLATES[category] varies.
export function renderOutreach(p: OutreachPersonalization, ctx: OutreachContext): string {
  if (p.category === "GenAI") return renderGenAI(p, ctx);
  const t = EMAIL_TEMPLATES[p.category];
  const observation = capObservation(p.hook);
  return `${header(p, ctx)}

**Subject:** Interested in building with ${ctx.startupName}

Hi ${p.founderGreeting},

${observation} caught my attention because my recent work has focused on ${t.focus}.

${t.projects}

I build across ${t.closing}. I'd love to bring that experience to the team at ${ctx.startupName}. Looking forward to hearing from you.

${signature()}`;
}
