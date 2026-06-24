// Shared building blocks for every agent stage config.

// Profile-derived strings come from config/userProfile.json (edit there, not here).
export { PROFILE, EDGE_SECTORS, AVOID_SECTORS, profile } from "@/config/profile";

// Fully-qualified MCP tool names (mirror tools/index.ts).
export const TOOLS = {
  recentFunding: "mcp__funding-feeds__get_recent_funding",
  galleryFunding: "mcp__startups-gallery__get_gallery_funding",
  indiaFunding: "mcp__ipo-platform__get_india_funding",
  checkUrl: "mcp__link-tools__check_url",
  exa: "mcp__exa-web-search__*",
} as const;

// Appended to a prompt to enforce JSON-only output matching a schema (Rule 1).
export const jsonOnly = (schema: string) =>
  `\n\nOUTPUT: Return ONLY a single JSON object matching this exact shape — no prose, no markdown fences:\n${schema}`;

// One pipeline stage: system prompt + tool whitelist + turn cap.
export type StageConfig = {
  system: string;
  allowedTools: string[];
  maxTurns: number;
};
