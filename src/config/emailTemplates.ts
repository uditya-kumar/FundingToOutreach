// Outreach email templates — ONE per skill track (GenAI / Mobile / Web).
//
// Each track is a full editable email: a `subject` line and a `body` with tokens
// the renderer substitutes per startup. The copy lives in `emailTemplates.data.json`
// (edited visually via the config UI: `npm run config`), so the wording can change
// WITHOUT touching this renderer or the rest of the pipeline.
//
// Tokens available in `subject` and `body`:
//   {company_name}      → the startup name
//   {founder_greeting}  → founder first name, or "there"
//   {personalization}   → the ≤120-char (≤70 for GenAI) company observation clause
//   {signature}         → the shared sign-off (name + GitHub + LinkedIn) from profile
//
// Each email is ~80% fixed (the template copy) and ~20% personalized: the founder
// greeting and the observation clause the outreach-designer agent produces per
// startup. The character cap on the observation is enforced in code (capObservation).
import { profile } from "@/config/profile";
import templatesData from "@/config/emailTemplates.data.json" with { type: "json" };

export type Skill = "Mobile" | "Web" | "GenAI";
export const SKILLS: readonly Skill[] = ["Mobile", "Web", "GenAI"] as const;

// Hard ceiling on the personalized observation clause, enforced in code.
export const OBSERVATION_MAX_CHARS = 120;

// The GenAI track's observation slot is capped shorter than the Mobile/Web ones.
export const GENAI_OBSERVATION_MAX_CHARS = 70;

// The editable per-track email copy. One entry per track, each a full subject +
// body with {tokens}. Edited via the config UI (`npm run config`).
export type EmailTemplate = { subject: string; body: string };
export const EMAIL_TEMPLATES: Record<Skill, EmailTemplate> = templatesData;

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

// Cap the personalized observation at `max`. Trims whitespace and any trailing
// period (it flows into "<obs> caught my attention…"), then truncates at a word
// boundary if the clause is over the limit.
function capObservation(raw: string, max: number = OBSERVATION_MAX_CHARS): string {
  const clean = raw.trim().replace(/\.+$/, "").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

// The metadata header shown above every email so the user can triage at a glance.
// Code-generated (rank/score/funding/URL are computed), so it is NOT part of the
// editable template.
function header(p: OutreachPersonalization, ctx: OutreachContext): string {
  const url = ctx.companyUrl && ctx.companyUrl !== "not_found" ? ctx.companyUrl : "TBD";
  return `# #${ctx.rank} · ${ctx.startupName} · ${p.category}
**Funding:** ${ctx.funding}  |  **Fit score:** ${ctx.score}  |  **Send at:** ${ctx.sendTimeNote}

**Url:-** ${url}

---`;
}

// The signature block — shared by every track. Name + links on their own lines.
function signature(): string {
  return `Best,
${profile.name}

GitHub: ${profile.links.github}

LinkedIn: ${profile.links.linkedin}`;
}

// Substitute the {tokens} in a template string with the per-startup values.
function fillTokens(
  tmpl: string,
  vals: { company_name: string; founder_greeting: string; personalization: string; signature: string },
): string {
  return tmpl.replace(/\{(company_name|founder_greeting|personalization|signature)\}/g, (_, k) => vals[k as keyof typeof vals]);
}

// Render ONE Telegram-ready outreach message from the track's editable template.
// The observation clause is capped (70 for GenAI, 120 otherwise); the code-generated
// metadata header is prepended, then the subject + body have their tokens filled.
export function renderOutreach(p: OutreachPersonalization, ctx: OutreachContext): string {
  const t = EMAIL_TEMPLATES[p.category];
  const max = p.category === "GenAI" ? GENAI_OBSERVATION_MAX_CHARS : OBSERVATION_MAX_CHARS;
  const vals = {
    company_name: ctx.startupName,
    founder_greeting: p.founderGreeting,
    personalization: capObservation(p.hook, max),
    signature: signature(),
  };
  return `${header(p, ctx)}

**Subject:** ${fillTokens(t.subject, vals)}

${fillTokens(t.body, vals)}`;
}
