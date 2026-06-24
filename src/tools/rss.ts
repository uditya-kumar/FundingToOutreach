import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { FEEDS } from "@/config/feeds.js";
import { decodeEntities } from "@/lib/html.js";
import { jsonResult } from "@/lib/mcp";
import { FeedItemList } from "@/schemas";

const parser = new XMLParser({ htmlEntities: true });

// The compact shape the AGENT actually sees.
type Item = { source: string; title: string; url: string; date: string };

function parseDate(dateStr: string): number | null {
  const t = Date.parse(dateStr);
  if (!Number.isNaN(t)) return t;
  const normalized = dateStr
    .replace(/(\d+)(st|nd|rd|th)/gi, "$1")
    .replace(/UTC|GMT/gi, "");
  const t2 = Date.parse(normalized);
  return Number.isNaN(t2) ? null : t2;
}

async function fetchFeed(source: string, url: string): Promise<Item[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (daily-scout)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const feed = parser.parse(await res.text());
    const raw = feed?.rss?.channel?.item ?? feed?.feed?.entry ?? [];
    const items = Array.isArray(raw) ? raw : [raw];
    return items.map((it: any) => ({
      source,
      title: decodeEntities(
        String(it.title?.["#text"] ?? it.title ?? ""),
      ).trim(),
      url: String(it.link?.href ?? it.link ?? it.guid ?? "").trim(),
      date: String(it.pubDate ?? it.published ?? it.updated ?? "").trim(),
    }));
  } catch {
    return []; // one dead feed must never break the run
  }
}

export const rssServer = createSdkMcpServer({
  name: "funding-feeds",
  version: "1.0.0",
  tools: [
    tool(
      "get_recent_funding",
      "Fetch startup-funding headlines from the last N hours across all news " +
        "feeds. Returns ONLY compact JSON {source,title,url,date}. Raw RSS XML " +
        "is parsed and discarded server-side and never enters the context.",
      { hoursBack: z.number().default(72) },
      async ({ hoursBack }) => {
        const all = (
          await Promise.all(
            Object.entries(FEEDS).map(([s, u]) => fetchFeed(s, u)),
          )
        ).flat();

        // 1) window by date (deterministic — not the model's job)
        // Items with unparseable dates pass through (assume recent since in feed)
        const cutoffMs = Date.now() - hoursBack * 3_600_000;
        const fresh = all.filter((i) => {
          const t = parseDate(i.date);
          return t === null || t >= cutoffMs;
        });

        // 2) dedupe by URL within THIS run (two feeds, same story).
        // URL-based preserves both title variants when coverage differs.
        // Stateless — cross-run dedup is a future DB concern.
        const seen = new Set<string>();
        const deduped = fresh.filter((i) => {
          try {
            const k = new URL(i.url).pathname.toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          } catch {
            return true; // malformed URL → keep item
          }
        });

        return jsonResult(deduped, FeedItemList);
      },
      { annotations: { readOnlyHint: true } },
    ),
  ],
});
