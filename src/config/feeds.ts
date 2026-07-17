// Step 1 funding-news sources. All verified returning 200 + items.
// NOTE: Entrackr and IndiaStartupNews use /rss — their /feed paths 404.
//
// The editable feed map now lives in `feeds.data.json` (edited via the config UI:
// `npm run config`). This module just re-exports it with the same `FEEDS` shape.
import feedsData from "@/config/feeds.data.json" with { type: "json" };

export const FEEDS: Record<string, string> = feedsData;
