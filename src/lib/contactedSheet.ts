// Live cross-run dedup: read the Google Sheet of already-contacted companies so
// the orchestrator can drop them BEFORE picking the top-5 outreach targets.
//
// Fetched fresh on every run via the Sheets REST API (API key, read-only) — no
// library, mirrors the fetch-based `telegram.ts` style. Never throws: on any
// failure (missing env, network, bad response) it returns an EMPTY exclusion set
// and logs, so a Sheets outage degrades to "contact everyone" rather than
// sinking the run (Rule 6/7). Column A = Company Name, Column B = Website.

import { log } from "@/lib/logger";

// Normalize a company name for comparison: lowercase, strip punctuation/spaces.
// "Kapture CX" and "kapture-cx" collapse to the same key.
function normName(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Normalize a website/URL to its bare root domain: "https://www.getpie.com/" →
// "getpie.com". Drops scheme, "www.", path, and trailing dot so a candidate URL
// and a sheet URL that point at the same site compare equal.
function normDomain(raw: string): string {
  if (!raw) return "";
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.split(/[/?#]/)[0]; // drop path/query/hash
  return s.replace(/\.$/, "");
}

export type ContactedIndex = {
  names: Set<string>;
  domains: Set<string>;
  count: number;
  // True if a startup (by name OR domain) is already in the sheet.
  has: (name: string, url: string) => boolean;
};

const EMPTY: ContactedIndex = {
  names: new Set(),
  domains: new Set(),
  count: 0,
  has: () => false,
};

/**
 * Fetch the contacted-companies sheet live and build an exclusion index.
 * Returns an empty (matches-nothing) index on any failure — never throws.
 */
export async function fetchContactedIndex(): Promise<ContactedIndex> {
  const SHEET_ID = process.env.SHEET_ID;
  const API_KEY = process.env.SHEETS_API_KEY;
  if (!SHEET_ID || !API_KEY) {
    log.warn("contacted-sheet", "SHEET_ID / SHEETS_API_KEY not set — skipping dedup (contacting everyone)");
    return EMPTY;
  }

  // A2:B skips the header row and reads both columns to the end of the sheet.
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A2:B?key=${API_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      log.warn("contacted-sheet", `Sheets API ${res.status}: ${body.slice(0, 200)} — skipping dedup`);
      return EMPTY;
    }
    const json = (await res.json()) as { values?: string[][] };
    const rows = json.values ?? [];

    const names = new Set<string>();
    const domains = new Set<string>();
    for (const row of rows) {
      const name = normName(row[0] ?? "");
      const domain = normDomain(row[1] ?? "");
      if (name) names.add(name);
      if (domain) domains.add(domain);
    }

    const has = (name: string, urlStr: string): boolean => {
      const n = normName(name);
      const d = normDomain(urlStr);
      return (n !== "" && names.has(n)) || (d !== "" && domains.has(d));
    };

    log.info("contacted-sheet", `loaded ${rows.length} contacted rows (${names.size} names, ${domains.size} domains)`);
    return { names, domains, count: rows.length, has };
  } catch (e) {
    log.warn("contacted-sheet", `fetch failed: ${String(e).slice(0, 200)} — skipping dedup`);
    return EMPTY;
  }
}
