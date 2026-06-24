import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import * as cheerio from "cheerio";
import { z } from "zod";
import { jsonResult } from "@/lib/mcp";

const GalleryStartup = z.object({
  name: z.string(),
  url: z.string(),
  funding: z.string(),
  series: z.string(),
  investor: z.string(),
  source: z.string(),
  date: z.string(),
});
const GalleryStartupList = z.array(GalleryStartup);

export { GalleryStartup, GalleryStartupList };

const BASE_URL = "https://startups.gallery";

function parseDate(dateStr: string): number | null {
  // Handle "Jun 23, 2026" format
  const t = Date.parse(dateStr);
  if (!Number.isNaN(t)) return t;
  return null;
}

async function scrapeStartupsGallery(hoursBack: number): Promise<z.infer<typeof GalleryStartup>[]> {
  const res = await fetch(`${BASE_URL}/news`, {
    headers: { "User-Agent": "Mozilla/5.0 (daily-scout)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const startups: z.infer<typeof GalleryStartup>[] = [];
  const seen = new Set<string>();

  // Each card is a div with data-framer-name="Post"
  $('[data-framer-name="Post"]').each((_, postEl) => {
    const card = $(postEl);

    // Company link: href contains "/companies/"
    const companyLink = card.find('a[href*="/companies/"]').first();
    const href = companyLink.attr("href");
    if (!href) return;

    const slug = href.replace(/^\.?\/companies\//, "");
    if (seen.has(slug)) return;
    seen.add(slug);

    const name = companyLink.text().trim() || slug;

    // Funding amount and series: text like "$98M · Seed" or "$50M · Series B"
    const amountText = card.find('[data-framer-name="Amount"]').text().trim();
    const amountMatch = amountText.match(/\$?([\d.,]+[MBK])\s*·?\s*(Seed|Series [A-Z])?/i);
    const funding = amountMatch ? `$${amountMatch[1]}` : "not_found";
    const series = amountMatch?.[2] ?? "not_found";

    // Date from <time> element
    const timeEl = card.find("time");
    const date = timeEl.text().trim() || "not_found";

    // Investor link: href contains "/investors/"
    const investorLink = card.find('a[href*="/investors/"]').first();
    const investor = investorLink.text().trim() || "not_found";

    // Source link: has data-framer-name="Source"
    const sourceLink = card.find('a[data-framer-name="Source"]').first();
    const source = sourceLink.attr("href") || "not_found";

    startups.push({
      name,
      url: `${BASE_URL}/companies/${slug}`,
      funding,
      series,
      investor,
      source,
      date,
    });
  });

  // Filter by date window
  const cutoffMs = Date.now() - hoursBack * 3600_000;
  return startups.filter((s) => {
    const t = parseDate(s.date);
    // If date can't be parsed, include it (assume recent)
    return t === null || t >= cutoffMs;
  });
}

export const startupsGalleryServer = createSdkMcpServer({
  name: "startups-gallery",
  version: "1.0.0",
  tools: [
    tool(
      "get_gallery_funding",
      "Scrape recent startup funding announcements from startups.gallery/news. " +
        "Returns compact JSON with name, url, funding amount, series, investor, " +
        "source article URL, and date. Filters to last N hours (default 72).",
      { hoursBack: z.number().default(72) },
      async ({ hoursBack }) => {
        try {
          const startups = await scrapeStartupsGallery(hoursBack);
          return jsonResult(startups, GalleryStartupList);
        } catch (e) {
          return jsonResult([]);
        }
      },
      { annotations: { readOnlyHint: true } },
    ),
  ],
});
