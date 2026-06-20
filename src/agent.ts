import { writeFile } from "node:fs/promises";
import {
  fundingResearcher,
  fitStrategist,
  powDesigner,
  reportWriter,
} from "@/agents";
import { mcpServers } from "@/tools";
import { runStage, runStageText } from "@/lib/stage";
import { computeRanking } from "@/lib/ranking";
import { log } from "@/lib/logger";
import { CandidateList, ScoredList, ProofOfWork } from "@/schemas";
import { z } from "zod";

// Exa web search, shared across stages that whitelist it.
const allServers = {
  ...mcpServers,
  "exa-web-search": { type: "http" as const, url: "https://mcp.exa.ai/mcp" },
};

const today = new Date().toISOString().slice(0, 10);

type Scored = z.infer<typeof ScoredList>["startups"][number];
type Pow = z.infer<typeof ProofOfWork>;

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

  // ── Step 5: top-5 proof-of-work, ONE startup per agent, HARDCODED PARALLEL ─
  const top5 = [...startups].sort((a, b) => b.fitScore - a.fitScore).slice(0, 5);
  log.info("pipeline", `Step 5: proof-of-work for top ${top5.length} (parallel)`);

  const powResults = await Promise.all(
    top5.map((s) =>
      runStage<Pow>({
        label: `pow-designer:${s.name}`,
        system: powDesigner.system,
        prompt: `Design the proof-of-work for THIS startup only:\n${JSON.stringify(s)}`,
        schema: ProofOfWork,
        mcpServers: allServers,
        allowedTools: powDesigner.allowedTools,
        maxTurns: powDesigner.maxTurns,
      }).catch((e) => {
        log.warn("pipeline", `pow-designer failed for ${s.name}: ${String(e).slice(0, 120)}`);
        return null; // one failure must not sink the report (Rule 6)
      }),
    ),
  );

  const pows = powResults.filter((p): p is Pow => p !== null);
  log.info("pipeline", `Step 5: ${pows.length}/${top5.length} proof-of-work plans`);
  log.data("pipeline", "proofOfWork", pows);

  // ── Step 6: deterministic ranking (code, not LLM) ────────────────────────
  const byName = new Map<string, Scored>(top5.map((s) => [s.name, s]));
  const ranked = computeRanking(
    pows.map((p) => {
      const s = byName.get(p.name);
      return {
        name: p.name,
        expectedLearning: s?.expectedLearning ?? 0,
        hiringProbability: p.responseProbabilityScore,
        founderAccessibility: s?.founderAccessibility ?? 0,
      };
    }),
  );
  log.data("pipeline", "ranking", ranked);
  log.info("pipeline", `Step 6: top — ${ranked[0]?.name} (score ${ranked[0]?.score})`);

  // ── Step 7: render email + save report.md (send stays gated/external) ─────
  log.info("pipeline", "Step 7: rendering email");
  const dossier = ranked.map((r) => ({
    rank: r.rank,
    score: r.score,
    startup: byName.get(r.name),
    proofOfWork: pows.find((p) => p.name === r.name),
  }));

  const email = await runStageText({
    label: "report-writer",
    system: reportWriter.system,
    prompt: `Today is ${today}. Render the daily email from this ranked data:\n${JSON.stringify(dossier)}`,
    allowedTools: reportWriter.allowedTools,
    maxTurns: reportWriter.maxTurns,
  });

  const REPORT_PATH = new URL("../report.md", import.meta.url);
  await writeFile(REPORT_PATH, email, "utf8");
  log.info("pipeline", `Step 7: wrote report.md (${Buffer.byteLength(email)} bytes); send is a separate gated step`);
  log.info("pipeline", `run done — top: ${ranked[0]?.name ?? "none"}`);
}

main().catch((e) => {
  log.error("pipeline", `run failed: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  process.exitCode = 1;
});
