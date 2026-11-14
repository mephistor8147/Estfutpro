import type {
  ActiveModulesConfig,
  AppSettings,
  MatchAnalysisData,
  PoissonModelResult,
  ScorelineProbability,
} from '../types/football.ts';

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

export function poissonPmf(lambda: number, k: number): number {
  const safeLambda = Math.max(0.05, lambda);
  return (Math.exp(-safeLambda) * Math.pow(safeLambda, k)) / factorial(k);
}

/**
 * Largest-remainder rounding so integer percentages always sum to exactly 100.
 */
function roundTo100(values: [number, number, number]): [number, number, number] {
  const sum = values[0] + values[1] + values[2];
  if (sum <= 0) return [34, 33, 33];

  const normalized = values.map((v) => (v / sum) * 100);
  const floored = normalized.map((v) => Math.floor(v));
  const remainders = normalized.map((v, idx) => ({
    idx,
    rem: v - floored[idx],
  }));

  let deficit = 100 - (floored[0] + floored[1] + floored[2]);
  remainders.sort((a, b) => b.rem - a.rem);

  for (let i = 0; i < deficit; i++) {
    floored[remainders[i % 3].idx] += 1;
  }

  return [floored[0], floored[1], floored[2]];
}

export function calculatePoissonModel(
  data: MatchAnalysisData,
  settings?: Partial<AppSettings>,
  contextOverride?: { homeDelta?: number; awayDelta?: number }
): PoissonModelResult {
  const modules: ActiveModulesConfig = {
    lastFive: true,
    headToHead: true,
    standings: true,
    poisson: true,
    goalsAndBtts: true,
    corners: true,
    cards: true,
    contextFactors: true,
    ...settings?.activeModules,
  };

  const recentWeightConfig = settings?.recentFormWeight ?? 0.35;
  const homeAdvBoost = settings?.homeAdvantageMultiplier ?? 1.12;

  const LEAGUE_BASELINE_GOALS = 1.32;

  // 1. Season standings attack & defense strength (Module 3)
  let seasonHomeLambda: number | null = null;
  let seasonAwayLambda: number | null = null;

  const hs = data.module3Standings.home;
  const as = data.module3Standings.away;

  if (
    modules.standings &&
    hs.played &&
    hs.played > 0 &&
    hs.goalsFor !== null &&
    hs.goalsAgainst !== null &&
    as.played &&
    as.played > 0 &&
    as.goalsFor !== null &&
    as.goalsAgainst !== null
  ) {
    const homeAttackPerGame = hs.goalsFor / hs.played;
    const homeConcededPerGame = hs.goalsAgainst / hs.played;
    const awayAttackPerGame = as.goalsFor / as.played;
    const awayConcededPerGame = as.goalsAgainst / as.played;

    // Combine own attacking rate with opponent's defensive concession rate
    seasonHomeLambda = (homeAttackPerGame * 0.55 + awayConcededPerGame * 0.45);
    seasonAwayLambda = (awayAttackPerGame * 0.55 + homeConcededPerGame * 0.45);
  }

  // 2. Recent 5 matches form (Module 1)
  let recentHomeLambda: number | null = null;
  let recentAwayLambda: number | null = null;

  const h5 = data.module1LastFive.home;
  const a5 = data.module1LastFive.away;

  if (modules.lastFive && (h5.matches.length > 0 || a5.matches.length > 0)) {
    const hAtk = h5.avgGoalsScored ?? LEAGUE_BASELINE_GOALS;
    const hDef = h5.avgGoalsConceded ?? LEAGUE_BASELINE_GOALS;
    const aAtk = a5.avgGoalsScored ?? LEAGUE_BASELINE_GOALS;
    const aDef = a5.avgGoalsConceded ?? LEAGUE_BASELINE_GOALS;

    recentHomeLambda = hAtk * 0.55 + aDef * 0.45;
    recentAwayLambda = aAtk * 0.55 + hDef * 0.45;
  }

  // 3. Head-to-Head historical adjustment (Module 2)
  let h2hHomeLambda: number | null = null;
  let h2hAwayLambda: number | null = null;

  const h2h = data.module2HeadToHead;
  if (modules.headToHead && h2h.totalMatchesAnalyzed > 0) {
    const total = h2h.totalMatchesAnalyzed;
    const homeShare = (h2h.homeTeamWins + h2h.draws * 0.5) / total;
    const awayShare = (h2h.awayTeamWins + h2h.draws * 0.5) / total;
    const avgH2HGoals = h2h.avgGoalsPerMatch ?? 2.4;

    h2hHomeLambda = Math.max(0.4, avgH2HGoals * (0.35 + homeShare * 0.3));
    h2hAwayLambda = Math.max(0.35, avgH2HGoals * (0.35 + awayShare * 0.3));
  }

  // Weighted aggregation across available & enabled modules
  let wSeason = seasonHomeLambda !== null ? 0.50 : 0;
  let wRecent = recentHomeLambda !== null ? recentWeightConfig : 0;
  let wH2H = h2hHomeLambda !== null ? 0.15 : 0;

  const totalWeight = wSeason + wRecent + wH2H;

  let baseHomeLambda = LEAGUE_BASELINE_GOALS;
  let baseAwayLambda = LEAGUE_BASELINE_GOALS * 0.88;

  if (totalWeight > 0) {
    baseHomeLambda =
      ((seasonHomeLambda ?? 0) * wSeason +
        (recentHomeLambda ?? 0) * wRecent +
        (h2hHomeLambda ?? 0) * wH2H) /
      totalWeight;

    baseAwayLambda =
      ((seasonAwayLambda ?? 0) * wSeason +
        (recentAwayLambda ?? 0) * wRecent +
        (h2hAwayLambda ?? 0) * wH2H) /
      totalWeight;
  }

  // Apply home advantage multiplier
  let lambdaHome = baseHomeLambda * homeAdvBoost;
  let lambdaAway = baseAwayLambda * (2 - homeAdvBoost > 0.75 ? Math.max(0.84, 2 - homeAdvBoost * 0.98) : 0.9);

  // 4. Contextual factors adjustment (Module 5)
  const deltaHome = modules.contextFactors
    ? (contextOverride?.homeDelta ?? data.module5Context.contextualImpactHome ?? 0)
    : 0;
  const deltaAway = modules.contextFactors
    ? (contextOverride?.awayDelta ?? data.module5Context.contextualImpactAway ?? 0)
    : 0;

  lambdaHome = Math.min(4.2, Math.max(0.25, lambdaHome + deltaHome));
  lambdaAway = Math.min(4.0, Math.max(0.22, lambdaAway + deltaAway));

  // 5. Build Poisson matrix up to 7 goals each (0..7) and expose 0..5 display matrix
  const MAX_CALC = 8;
  const DISPLAY_SIZE = 6;
  const matrix: number[][] = Array.from({ length: DISPLAY_SIZE }, () =>
    Array(DISPLAY_SIZE).fill(0)
  );

  let rawHomeWin = 0;
  let rawDraw = 0;
  let rawAwayWin = 0;
  let rawOver15 = 0;
  let rawOver25 = 0;
  let rawBtts = 0;

  const allScores: ScorelineProbability[] = [];

  for (let i = 0; i <= MAX_CALC; i++) {
    const pHome = poissonPmf(lambdaHome, i);
    for (let j = 0; j <= MAX_CALC; j++) {
      const pAway = poissonPmf(lambdaAway, j);
      const pJoint = pHome * pAway;

      if (i > j) rawHomeWin += pJoint;
      else if (i === j) rawDraw += pJoint;
      else rawAwayWin += pJoint;

      if (i + j >= 2) rawOver15 += pJoint;
      if (i + j >= 3) rawOver25 += pJoint;
      if (i >= 1 && j >= 1) rawBtts += pJoint;

      if (i < DISPLAY_SIZE && j < DISPLAY_SIZE) {
        matrix[i][j] = Number((pJoint * 100).toFixed(1));
        allScores.push({
          homeGoals: i,
          awayGoals: j,
          probability: Number((pJoint * 100).toFixed(1)),
        });
      }
    }
  }

  const [homeWinPct, drawPct, awayWinPct] = roundTo100([
    rawHomeWin,
    rawDraw,
    rawAwayWin,
  ]);

  allScores.sort((a, b) => b.probability - a.probability);
  const topScorelines = allScores.slice(0, 6);
  const best = topScorelines[0] ?? { homeGoals: 1, awayGoals: 1, probability: 12 };

  const over15Pct = Math.min(98, Math.max(2, Math.round(rawOver15 * 100)));
  const over25Pct = Math.min(96, Math.max(2, Math.round(rawOver25 * 100)));
  const bttsPct = Math.min(95, Math.max(3, Math.round(rawBtts * 100)));

  let favoriteLabel = 'Equilibrado';
  if (homeWinPct - awayWinPct >= 8 && homeWinPct >= drawPct) {
    favoriteLabel = `${data.homeTeam.name} (Mandante)`;
  } else if (awayWinPct - homeWinPct >= 8 && awayWinPct >= drawPct) {
    favoriteLabel = `${data.awayTeam.name} (Visitante)`;
  } else if (drawPct > homeWinPct && drawPct > awayWinPct) {
    favoriteLabel = 'Tendência ao Empate';
  } else if (homeWinPct > awayWinPct) {
    favoriteLabel = `Leve vantagem: ${data.homeTeam.name}`;
  } else if (awayWinPct > homeWinPct) {
    favoriteLabel = `Leve vantagem: ${data.awayTeam.name}`;
  }

  let goalTrendLabel = 'Mais de 1,5 gols';
  if (over25Pct >= 58) {
    goalTrendLabel = 'Mais de 2,5 gols';
  } else if (over15Pct < 60) {
    goalTrendLabel = 'Menos de 2,5 gols';
  }

  return {
    expectedGoalsHome: Number(lambdaHome.toFixed(2)),
    expectedGoalsAway: Number(lambdaAway.toFixed(2)),
    homeWinPct,
    drawPct,
    awayWinPct,
    over15Pct,
    over25Pct,
    bttsPct,
    mostLikelyScore: {
      homeGoals: best.homeGoals,
      awayGoals: best.awayGoals,
      probabilityPct: best.probability,
    },
    topScorelines,
    matrix,
    favoriteLabel,
    goalTrendLabel,
    methodologyBreakdown: {
      seasonAttackHome: seasonHomeLambda !== null ? Number(seasonHomeLambda.toFixed(2)) : null,
      seasonAttackAway: seasonAwayLambda !== null ? Number(seasonAwayLambda.toFixed(2)) : null,
      recentFormHome: recentHomeLambda !== null ? Number(recentHomeLambda.toFixed(2)) : null,
      recentFormAway: recentAwayLambda !== null ? Number(recentAwayLambda.toFixed(2)) : null,
      h2hFactorHome: h2hHomeLambda !== null ? Number(h2hHomeLambda.toFixed(2)) : null,
      h2hFactorAway: h2hAwayLambda !== null ? Number(h2hAwayLambda.toFixed(2)) : null,
      homeAdvantageBoost: homeAdvBoost,
      contextualDeltaHome: Number(deltaHome.toFixed(2)),
      contextualDeltaAway: Number(deltaAway.toFixed(2)),
    },
  };
}
