export type MatchOutcome = 'V' | 'E' | 'D';

export interface RecentMatchItem {
  date: string | null;
  opponent: string;
  venue: 'Casa' | 'Fora';
  scoreFor: number;
  scoreAgainst: number;
  outcome: MatchOutcome;
  competition: string | null;
}

export interface TeamLastFiveStats {
  matches: RecentMatchItem[];
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  avgGoalsScored: number;
  avgGoalsConceded: number;
  homeSummary: string | null;
  awaySummary: string | null;
}

export interface HeadToHeadMatch {
  date: string | null;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  competition: string | null;
}

export interface HeadToHeadStats {
  totalMatchesAnalyzed: number;
  homeTeamWins: number;
  awayTeamWins: number;
  draws: number;
  avgGoalsPerMatch: number | null;
  recentMatches: HeadToHeadMatch[];
}

export interface TeamStandingsStats {
  position: number | null;
  points: number | null;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  goalDifference: number | null;
  winPercentage: number | null;
  homeRecord: string | null;
  awayRecord: string | null;
}

export interface TeamComplementaryStats {
  avgCorners: number | null;
  avgCards: number | null;
  avgShots: number | null;
  avgShotsOnTarget: number | null;
  avgPossessionPct: number | null;
  bttsPct: number | null;
  over15Pct: number | null;
  over25Pct: number | null;
}

export interface TeamContextFactors {
  absencesAndSuspensions: string[];
  restDays: number | null;
  recentCoachChange: string | null;
  formNote: string | null;
}

export interface MatchContextFactors {
  homeAdvantageNote: string | null;
  matchImportance: string | null;
  homeTeamContext: TeamContextFactors;
  awayTeamContext: TeamContextFactors;
  contextualImpactHome: number; // -0.35 to +0.35 goal expectancy adjustment
  contextualImpactAway: number; // -0.35 to +0.35 goal expectancy adjustment
}

export interface TeamIdentity {
  name: string;
  shortCode: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface MatchAnalysisData {
  competition: string;
  season: string;
  matchDateInfo: string | null;
  homeTeam: TeamIdentity;
  awayTeam: TeamIdentity;
  module1LastFive: {
    home: TeamLastFiveStats;
    away: TeamLastFiveStats;
  };
  module2HeadToHead: HeadToHeadStats;
  module3Standings: {
    home: TeamStandingsStats;
    away: TeamStandingsStats;
  };
  module4Complementary: {
    home: TeamComplementaryStats;
    away: TeamComplementaryStats;
  };
  module5Context: MatchContextFactors;
  dataWarnings: string[];
}

export interface ScorelineProbability {
  homeGoals: number;
  awayGoals: number;
  probability: number; // 0..100
}

export interface PoissonModelResult {
  expectedGoalsHome: number;
  expectedGoalsAway: number;
  homeWinPct: number; // integer, sums to 100 with drawPct & awayWinPct
  drawPct: number;
  awayWinPct: number;
  over15Pct: number;
  over25Pct: number;
  bttsPct: number;
  mostLikelyScore: {
    homeGoals: number;
    awayGoals: number;
    probabilityPct: number;
  };
  topScorelines: ScorelineProbability[];
  matrix: number[][]; // matrix[homeGoals][awayGoals] in 0..100%
  favoriteLabel: string;
  goalTrendLabel: string;
  methodologyBreakdown: {
    seasonAttackHome: number | null;
    seasonAttackAway: number | null;
    recentFormHome: number | null;
    recentFormAway: number | null;
    h2hFactorHome: number | null;
    h2hFactorAway: number | null;
    homeAdvantageBoost: number;
    contextualDeltaHome: number;
    contextualDeltaAway: number;
  };
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface AnalysisResponsePayload {
  id: string;
  updatedAt: string;
  data: MatchAnalysisData;
  sources: GroundingSource[];
}

export interface PredictionHistoryItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  competition: string;
  homeTeam: TeamIdentity;
  awayTeam: TeamIdentity;
  predictedHomePct: number;
  predictedDrawPct: number;
  predictedAwayPct: number;
  expectedGoalsHome: number;
  expectedGoalsAway: number;
  mostLikelyScore: string;
  over25Pct: number;
  bttsPct: number;
  actualScore?: {
    homeGoals: number;
    awayGoals: number;
    recordedAt: string;
  };
  snapshot?: AnalysisResponsePayload;
}

export type ChampionshipScope = 'brasil' | 'principais' | 'todos';
export type UpdateMode = 'auto' | 'manual';

export interface ActiveModulesConfig {
  lastFive: boolean;
  headToHead: boolean;
  standings: boolean;
  poisson: boolean;
  goalsAndBtts: boolean;
  corners: boolean;
  cards: boolean;
  contextFactors: boolean;
}

export interface AppSettings {
  championshipScope: ChampionshipScope;
  updateMode: UpdateMode;
  activeModules: ActiveModulesConfig;
  recentFormWeight: number; // 0.15 to 0.55
  homeAdvantageMultiplier: number; // 1.00 to 1.25
}

export interface SuggestedFixture {
  homeTeam: string;
  awayTeam: string;
  competition: string;
  dateLabel: string;
}

export interface SerieAMultipleLeg {
  homeTeam: string;
  awayTeam: string;
  homeShortCode: string;
  awayShortCode: string;
  competition?: string;
  dateLabel: string;
  marketLabel: string;
  probabilityPct: number;
  expectedGoalsHome: number;
  expectedGoalsAway: number;
  rationale: string;
}

export interface SerieAMultipleTip {
  leagueSlug?: string;
  competition: string;
  updatedAt: string;
  legs: SerieAMultipleLeg[];
  combinedProbabilityPct: number;
  fairOddEstimate: number;
  sourceUrl: string;
}
