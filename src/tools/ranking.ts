import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { jsonResult } from "@/lib/mcp";
import { RankedList } from "@/schemas";
import { computeRanking } from "@/lib/ranking";

// Step 6: rank = fitScore × expectedLearning.
// Deterministic math (see lib/ranking), kept out of the LLM so the ranking is
// reproducible. Exposed as a tool for any agent-driven use; the code pipeline
// calls computeRanking() directly.
const Opportunity = z.object({
  name: z.string(),
  fitScore: z.number().min(0).max(1), // decimal 0-1
  expectedLearning: z.number().min(0).max(10),
});

export const rankingServer = createSdkMcpServer({
  name: "ranking-tools",
  version: "1.0.0",
  tools: [
    tool(
      "rank_opportunities",
      "Rank startups by fitScore × expectedLearning. " +
        "Input: array of {name, fitScore (decimal 0-1), expectedLearning (0-10)}. " +
        "Returns the same items with a computed `score`, sorted desc.",
      { opportunities: z.array(Opportunity).min(1) },
      async ({ opportunities }) => jsonResult(computeRanking(opportunities), RankedList),
      { annotations: { readOnlyHint: true } },
    ),
  ],
});
