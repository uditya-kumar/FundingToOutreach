// Step 6 ranking math — single source of truth, used by BOTH the
// rank_opportunities MCP tool and the code pipeline.
// rank = fitScore × expectedLearning. Both signals come from fit-strategist on
// real enrichment data and vary across candidates. Founder accessibility was
// dropped (never measurable — founder LinkedIn is never found) and the old
// hiringProbability term was a constant that contributed nothing.
// fitScore is a DECIMAL in [0,1] and expectedLearning is [0,10], so score is
// [0,10] with fine granularity — avoids the integer-tie problem where #1 was
// decided by discovery order rather than merit.
export type Opportunity = {
  name: string;
  fitScore: number; // decimal 0-1
  expectedLearning: number; // 0-10
};

export type Ranked = Opportunity & { rank: number; score: number };

export function computeRanking(opportunities: Opportunity[]): Ranked[] {
  return opportunities
    .map((o) => ({
      ...o,
      score: Number((o.fitScore * o.expectedLearning).toFixed(2)),
    }))
    .sort((a, b) => b.score - a.score)
    .map((o, i) => ({ rank: i + 1, ...o }));
}
