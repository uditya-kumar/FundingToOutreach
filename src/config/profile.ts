// The user profile — the single place to edit who we're scouting for.
// Plain typed object: no JSON parsing, no validation needed (TS checks the shape).
export const profile = {
  name: "Uditya Kumar Pandey",
  summary:
    "Final-year B.Tech CSE; full-stack + AI + React Native engineer; open-source contributor.",
  evidence: [
    "Teacher Insights — 2,486+ users, 11,105+ monthly views, 50 DAU",
    "Vitsify mobile app on Play Store",
    "Built B2B ecommerce platform that reduced order processing time by ~40%",
    "Scaled email revenue from $23K/month to $82K/month",
    "Built MCP servers",
    "Built Claude Agent SDK tools",
    "Built mutual fund AI agents",
    "Contributed merged PRs to production open-source projects",
    "Proposed AWS Bedrock integration for Hermes Agent",
  ],
  targetRoles: [
    "Full Stack Developer",
    "Frontend Developer",
    "Software Engineer",
    "React Developer",
    "Backend Developer",
    "AI Engineer",
    "React Native Developer",
    "Node.js Developer",
    "Product Engineer",
    "LLM Engineer",
  ],
  edgeSectors: [
    "AI / Agentic AI / LLM applications",
    "Developer tooling / DevEx",
    "SaaS",
    "Workflow automation",
    "Productivity",
    "B2B software",
    "EdTech",
    "Fintech",
    "Mobile-first products",
  ],
  avoidSectors: [
    "Crypto / Web3",
    "Gaming",
    "Consulting",
    "Hardware / IoT",
    "Enterprise legacy (Java/.NET heavy)",
  ],
  links: {
    github: "github.com/uditya-kumar",
    linkedin: "linkedin.com/in/udityakumar",
  },
} as const;

export type UserProfile = typeof profile;

// ── Prompt-ready strings derived from the profile ──────────────────────────
export const PROFILE = `${profile.name} — ${profile.summary}
Evidence: ${profile.evidence.join("; ")}.
Target roles: ${profile.targetRoles.join(" / ")}.`;

export const EDGE_SECTORS = profile.edgeSectors.join(", ") + ".";
export const AVOID_SECTORS = profile.avoidSectors.join(", ") + ".";
