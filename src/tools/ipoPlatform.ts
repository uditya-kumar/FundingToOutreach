import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import * as cheerio from "cheerio";
import { z } from "zod";
import { jsonResult } from "@/lib/mcp";

const IpoStartup = z.object({
  name: z.string(),
  url: z.string(),
  sector: z.string(),
  date: z.string(),
  location: z.string(),
  funding: z.string(),
  description: z.string(),
});
const IpoStartupList = z.array(IpoStartup);

export { IpoStartup, IpoStartupList };

const BASE_URL = "https://www.ipoplatform.com";

function parseDate(dateStr: string): number | null {
  // Handle "23-Jun-2026" format
  const t = Date.parse(dateStr);
  if (!Number.isNaN(t)) return t;
  return null;
}

async function scrapeIpoPlatform(hoursBack: number): Promise<z.infer<typeof IpoStartup>[]> {
  const res = await fetch(`${BASE_URL}/best-startup-funding-india-list`, {
    headers: { "User-Agent": "Mozilla/5.0 (daily-scout)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const startups: z.infer<typeof IpoStartup>[] = [];
  const seen = new Set<string>();

  $(".card.h-100").each((_, cardEl) => {
    const card = $(cardEl);

    // Name from h5
    const name = card.find("h5").first().text().trim();
    if (!name || seen.has(name)) return;
    seen.add(name);

    // URL from startup link
    const linkEl = card.find('a[href*="startup-business-funding"]').first();
    const url = linkEl.attr("href") || "not_found";

    // Sector from .text-success.linesort2 (remove icon, clean whitespace)
    const sectorText = card.find(".text-success.linesort2").text();
    const sector = sectorText.replace(/[\s\n]+/g, " ").trim() || "not_found";

    // Card body contains: Investment Publication, Location, Fund Raise
    const cardBody = card.find(".card-body");
    const bodyText = cardBody.text();

    // Date: "Investment Publication: 23-Jun-2026"
    const dateMatch = bodyText.match(/Investment Publication:\s*(\d{1,2}-\w{3}-\d{4})/);
    const date = dateMatch?.[1] || "not_found";

    // Location
    const locationMatch = bodyText.match(/Location:\s*([A-Za-z\s]+?)(?=Fund|Total|$)/);
    const location = locationMatch?.[1]?.trim() || "not_found";

    // Fund Raise: "$ 95.00 Mn." or "₹ X Cr."
    const fundMatchUSD = bodyText.match(/Fund Raise:\s*\$\s*([\d.,]+)\s*(Mn|Cr|Bn)/i);
    const fundMatchINR = bodyText.match(/Fund Raise:\s*₹\s*([\d.,]+)\s*(Cr|Mn|Bn)/i);
    let funding = "not_found";
    if (fundMatchUSD) {
      funding = `$${fundMatchUSD[1]} ${fundMatchUSD[2]}`;
    } else if (fundMatchINR) {
      funding = `₹${fundMatchINR[1]} ${fundMatchINR[2]}`;
    }

    // Description from .about-company-t p
    const description = card.find(".about-company-t p").text().trim() || "not_found";

    startups.push({
      name,
      url,
      sector,
      date,
      location,
      funding,
      description,
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

export const ipoPlatformServer = createSdkMcpServer({
  name: "ipo-platform",
  version: "1.0.0",
  tools: [
    tool(
      "get_india_funding",
      "Scrape recent Indian startup funding announcements from ipoplatform.com. " +
        "Returns compact JSON with name, url, sector, date, location, funding amount, " +
        "and description. Filters to last N hours (default 72). India-focused.",
      { hoursBack: z.number().default(72) },
      async ({ hoursBack }) => {
        try {
          const startups = await scrapeIpoPlatform(hoursBack);
          return jsonResult(startups, IpoStartupList);
        } catch (e) {
          return jsonResult([]);
        }
      },
      { annotations: { readOnlyHint: true } },
    ),
  ],
});
