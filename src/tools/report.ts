import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { jsonResult } from "@/lib/mcp";
import { SaveResult } from "@/schemas";

// Step 7 (write half): persist the rendered email to report.md FIRST, before
// any send. The artifact survives transport failure and is inspectable. The
// actual send is intentionally NOT here — it stays separate and confirm-gated.
const REPORT_PATH = new URL("../../report.md", import.meta.url);

export const reportServer = createSdkMcpServer({
  name: "report-tools",
  version: "1.0.0",
  tools: [
    tool(
      "save_report",
      "Write the final daily email (full markdown) to report.md. Call this " +
        "BEFORE any send step. Returns {ok, path, bytes}. Does NOT send email — " +
        "sending is a separate, gated step.",
      { markdown: z.string().min(1) },
      async ({ markdown }) => {
        try {
          await writeFile(REPORT_PATH, markdown, "utf8");
          return jsonResult(
            { ok: true as const, path: "report.md", bytes: Buffer.byteLength(markdown, "utf8") },
            SaveResult,
          );
        } catch (e) {
          return jsonResult({ ok: false as const, error: String(e).slice(0, 120) }, SaveResult);
        }
      },
    ),
  ],
});
