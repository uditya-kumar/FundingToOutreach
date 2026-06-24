import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { jsonResult } from "@/lib/mcp";
import { CheckResult as CheckResultSchema, CheckResultList } from "@/schemas";

// General-purpose HTTP link verifier. Tells you whether a URL is live and where
// it redirects to — nothing more. It does NOT judge whether the page is the
// "right" one, and it is NOT a substitute for source-provenance on URLs that
// sites wall off (e.g. personal LinkedIn /in/ profiles return anti-bot codes
// that don't distinguish real from fake — don't rely on this for those).
type CheckResult = z.infer<typeof CheckResultSchema>;

async function checkOne(url: string): Promise<CheckResult> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    return {
      url,
      status: res.status,
      ok: res.status >= 200 && res.status < 400,
      finalUrl: res.url !== url ? res.url : undefined,
    };
  } catch (e) {
    return { url, status: "ERR", ok: false, error: String(e).slice(0, 80) };
  }
}

export const urlCheckServer = createSdkMcpServer({
  name: "link-tools",
  version: "1.0.0",
  tools: [
    tool(
      "check_url",
      "HTTP-verify that one or more URLs are live. Returns compact JSON per url: " +
        "{url,status,ok,finalUrl,error}. `ok` is true for a 2xx/3xx response. " +
        "Best for hiring/careers pages and other public URLs (404 => wrong URL, " +
        "drop it). NOT reliable for sites that wall bots (personal LinkedIn /in/ " +
        "profiles return anti-bot codes regardless of whether the page exists) — " +
        "use source provenance for those, not this tool.",
      { urls: z.array(z.string()).min(1).max(20) },
      async ({ urls }) => {
        const results = await Promise.all(urls.map(checkOne));
        return jsonResult(results, CheckResultList);
      },
      { annotations: { readOnlyHint: true } },
    ),
  ],
});
