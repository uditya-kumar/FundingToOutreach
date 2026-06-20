// Barrel for the deterministic MCP tool servers.
//
//   import { mcpServers, ALL_TOOL_NAMES } from "@/tools";
//   query({ options: { mcpServers, allowedTools: [...ALL_TOOL_NAMES, "Agent"] } })
import { rssServer } from "@/tools/rss";
import { urlCheckServer } from "@/tools/urlCheck";
import { rankingServer } from "@/tools/ranking";
import { reportServer } from "@/tools/report";

export { rssServer } from "@/tools/rss";
export { urlCheckServer } from "@/tools/urlCheck";
export { rankingServer } from "@/tools/ranking";
export { reportServer } from "@/tools/report";

// Keyed by server name → pass straight to query() options.mcpServers.
export const mcpServers = {
  "funding-feeds": rssServer,
  "link-tools": urlCheckServer,
  "ranking-tools": rankingServer,
  "report-tools": reportServer,
};

// Fully-qualified tool names, for allowedTools.
export const ALL_TOOL_NAMES = [
  "mcp__funding-feeds__get_recent_funding",
  "mcp__link-tools__check_url",
  "mcp__ranking-tools__rank_opportunities",
  "mcp__report-tools__save_report",
];
