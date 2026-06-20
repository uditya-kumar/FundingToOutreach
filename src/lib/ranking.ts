// Step 6 ranking math — single source of truth, used by BOTH the
// rank_opportunities MCP tool and the code pipeline.
// rank = expectedLearning × hiringProbability × founderAccessibility.
export type Opportunity = {
  name: string;
  expectedLearning: number;
  hiringProbability: number;
  founderAccessibility: number;
};

export type Ranked = Opportunity & { rank: number; score: number };

export function computeRanking(opportunities: Opportunity[]): Ranked[] {
  return opportunities
    .map((o) => ({
      ...o,
      score: Number(
        (o.expectedLearning * o.hiringProbability * o.founderAccessibility).toFixed(2),
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .map((o, i) => ({ rank: i + 1, ...o }));
}
