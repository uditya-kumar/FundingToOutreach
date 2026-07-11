import { writeFile } from "node:fs/promises";
import {
  fundingResearcher,
  fitStrategist,
  outreachDesigner,
} from "@/agents";
import { mcpServers } from "@/tools";
import { runStage } from "@/lib/stage";
import { computeRanking } from "@/lib/ranking";
import { sendTelegramMessage } from "@/lib/telegram";
import { log } from "@/lib/logger";
import { CandidateList, ScoredList, Outreach } from "@/schemas";
import { FIRST_NAME } from "@/config/profile";
import { renderOutreach } from "@/config/emailTemplates";
import { computeSendWindow } from "@/lib/sendWindow";
import { z } from "zod";

// Exa web search, shared across stages that whitelist it.
const allServers = {
  ...mcpServers,
  "exa-web-search": { type: "http" as const, url: "https://mcp.exa.ai/mcp" },
};

const today = new Date().toISOString().slice(0, 10);
const REPORT_PATH = new URL("../report.md", import.meta.url);

type Scored = z.infer<typeof ScoredList>["startups"][number];
type OutreachT = z.infer<typeof Outreach>;

// Some days simply have no funded startups in-sector within 72h. Write a valid,
// honest report and stop — never feed [] downstream into ranking/rendering.
async function writeNoTargets(reason: string): Promise<void> {
  const md = `Subject: Daily Startup Targets — ${today}

Hi ${FIRST_NAME},

No qualifying startup opportunities today — ${reason}

This is expected on quiet days. The scan will run again tomorrow.

## Today's Action
Spend 30 minutes shipping on an existing proof-of-work or open-source PR instead.
`;
  await writeFile(REPORT_PATH, md, "utf8");
  log.warn("pipeline", `no targets (${reason}) — wrote placeholder report.md, stopping`);
}

async function main() {
  log.info("pipeline", `run start — date ${today}`);

  // ── Step 1+2: discover + sector-filter ───────────────────────────────────
  log.info("pipeline", "Step 1+2: discovering funded startups");
  const { candidates } = await runStage({
    label: "funding-researcher",
    system: fundingResearcher.system,
    prompt: `Find startups funded in the last 72h (today is ${today}) and filter to edge sectors.`,
    schema: CandidateList,
    mcpServers: allServers,
    allowedTools: fundingResearcher.allowedTools,
    maxTurns: fundingResearcher.maxTurns,
  });
  log.data("pipeline", "candidates", candidates);
  if (candidates.length === 0) {
    await writeNoTargets("no in-sector startups announced funding in the last 72h");
    return;
  }

  // ── Step 3+4: enrich + score ─────────────────────────────────────────────
  log.info("pipeline", "Step 3+4: enriching + scoring");
  const { startups } = await runStage({
    label: "fit-strategist",
    system: fitStrategist.system,
    prompt: `Enrich and score these candidates:\n${JSON.stringify(candidates)}`,
    schema: ScoredList,
    mcpServers: allServers,
    allowedTools: fitStrategist.allowedTools,
    maxTurns: fitStrategist.maxTurns,
  });
  log.data("pipeline", "scored", startups);
  if (startups.length === 0) {
    await writeNoTargets("candidates were found but none survived enrichment/scoring");
    return;
  }

  // ── Step 5: top-5 outreach, ONE startup per agent, HARDCODED PARALLEL ─────
  // Gate on the SAME signal as the final rank (fitScore × expectedLearning) so
  // the gate can never drop a lead the Step-6 rank would have promoted. Each
  // agent categorizes its startup (Mobile/Web/GenAI) and returns ONLY the
  // personalized slots — the fixed email body is filled by code (renderOutreach).
  const preScore = (s: Scored) => s.fitScore * s.expectedLearning;
  const top5 = [...startups].sort((a, b) => preScore(b) - preScore(a)).slice(0, 5);
  log.info("pipeline", `Step 5: outreach for top ${top5.length} (parallel)`);

  const outreachResults = await Promise.all(
    top5.map((s) =>
      runStage<OutreachT>({
        label: `outreach-designer:${s.name}`,
        system: outreachDesigner.system,
        prompt: `Categorize and personalize outreach for THIS startup only:\n${JSON.stringify(s)}`,
        schema: Outreach,
        mcpServers: allServers,
        allowedTools: outreachDesigner.allowedTools,
        maxTurns: outreachDesigner.maxTurns,
      }).catch((e) => {
        log.warn("pipeline", `outreach-designer failed for ${s.name}: ${String(e).slice(0, 120)}`);
        return null; // one failure must not sink the report (Rule 6)
      }),
    ),
  );

  const outreaches = outreachResults.filter((o): o is OutreachT => o !== null);
  log.info("pipeline", `Step 5: ${outreaches.length}/${top5.length} outreach drafts`);
  log.data("pipeline", "outreach", outreaches);
  if (outreaches.length === 0) {
    await writeNoTargets("top startups were found but outreach design failed for all of them");
    return;
  }

  // ── Step 6: deterministic ranking (code, not LLM) ────────────────────────
  const byName = new Map<string, Scored>(top5.map((s) => [s.name, s]));
  const ranked = computeRanking(
    outreaches.map((o) => {
      const s = byName.get(o.name);
      return {
        name: o.name,
        fitScore: s?.fitScore ?? 0,
        expectedLearning: s?.expectedLearning ?? 0,
      };
    }),
  );
  log.data("pipeline", "ranking", ranked);
  log.info("pipeline", `Step 6: top — ${ranked[0]?.name} (score ${ranked[0]?.score})`);

  // ── Step 7: render one message per company → save report.md → send each ──
  // Rendering is deterministic: renderOutreach fills the fixed template with the
  // agent's personalized slots + code-supplied rank/score/funding. Each company
  // is a SEPARATE Telegram message, sent SEQUENTIALLY best-first. The combined
  // report.md is written FIRST so the artifact survives any transport failure.
  const byOutreach = new Map<string, OutreachT>(outreaches.map((o) => [o.name, o]));
  const now = new Date();
  const messages = ranked
    .map((r) => {
      const o = byOutreach.get(r.name);
      const s = byName.get(r.name);
      if (!o) return null;
      const funding = s
        ? [s.fundingAmount, s.stage].filter((v) => v && v !== "not_found").join(" ") || "TBD"
        : "TBD";
      // Deterministic best-send-time from the company's HQ timezone (code, not
      // LLM) — aim to land at ~9 AM local so the email tops their inbox instead
      // of arriving after the office has emptied.
      const { recommendation } = computeSendWindow(o.hqTimezone, now);
      return {
        name: r.name,
        markdown: renderOutreach(o, {
          rank: r.rank,
          score: r.score,
          startupName: r.name,
          funding,
          sendTimeNote: recommendation,
        }),
      };
    })
    .filter((m): m is { name: string; markdown: string } => m !== null);

  // Write all messages to report.md (artifact survives transport failure).
  const combined = messages.map((m) => m.markdown).join("\n\n---\n\n");
  await writeFile(REPORT_PATH, combined, "utf8");
  log.info("pipeline", `Step 7: wrote report.md (${messages.length} messages, ${Buffer.byteLength(combined)} bytes)`);

  // Send one message per company, SEQUENTIALLY, best-first. One send failing
  // must not stop the rest — log and continue (Rule 6).
  let sentCount = 0;
  for (const m of messages) {
    const sent = await sendTelegramMessage(m.markdown);
    if (sent.ok) {
      sentCount++;
      log.info("pipeline", `Step 7: sent ${m.name} to Telegram (status ${sent.status})`);
    } else {
      log.error("pipeline", `Step 7: Telegram send failed for ${m.name} — ${sent.error}. report.md is intact.`);
    }
  }
  log.info(
    "pipeline",
    `run done — sent ${sentCount}/${messages.length}, top: ${ranked[0]?.name ?? "none"}`,
  );
}

main().catch((e) => {
  log.error("pipeline", `run failed: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  process.exitCode = 1;
});
