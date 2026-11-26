import React, { useMemo, useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Activity } from 'lucide-react';
import { TeamCrest } from './TeamCrest.tsx';
import type {
  MatchAnalysisData,
  PoissonModelResult,
  TeamComplementaryStats,
  TeamLastFiveStats,
  TeamStandingsStats,
} from '../types/football.ts';

interface TeamPerformanceRadarProps {
  data: MatchAnalysisData;
  model: PoissonModelResult;
}

type FocusTeamMode = 'both' | 'home' | 'away';

interface RadarAttributeDatum {
  attribute: string;
  shortLabel: string;
  home: number;
  away: number;
  homeDetail: string;
  awayDetail: string;
  description: string;
  advantage: 'home' | 'away' | 'even';
}

interface CustomRadarTooltipPayload {
  dataKey?: string | number;
  value?: number | string;
  payload?: RadarAttributeDatum;
}

interface CustomRadarTooltipProps {
  active?: boolean;
  payload?: CustomRadarTooltipPayload[];
  homeName: string;
  awayName: string;
}

function clampScore(value: number, min = 12, max = 98): number {
  if (!Number.isFinite(value)) return 50;
  return Math.round(Math.min(max, Math.max(min, value)));
}

function fmtDec(val: number, digits = 2): string {
  return val.toFixed(digits).replace('.', ',');
}

function computeAttackMetric(
  lastFive: TeamLastFiveStats,
  standings: TeamStandingsStats,
  comp: TeamComplementaryStats,
  expectedGoals: number
): { score: number; detail: string } {
  const played = standings.played && standings.played > 0 ? standings.played : null;
  const seasonGoalsPerGame =
    played && standings.goalsFor !== null ? standings.goalsFor / played : null;
  const recentAvg = Math.max(0, lastFive.avgGoalsScored || 0);
  const blendedGoalsPerGame =
    seasonGoalsPerGame !== null
      ? seasonGoalsPerGame * 0.5 + recentAvg * 0.3 + expectedGoals * 0.2
      : recentAvg * 0.65 + expectedGoals * 0.35;

  let score = 20 + blendedGoalsPerGame * 30;
  if (comp.avgShotsOnTarget !== null && comp.avgShotsOnTarget >= 0) {
    score += (comp.avgShotsOnTarget - 4.0) * 3.5;
  }

  return {
    score: clampScore(score),
    detail: `${fmtDec(blendedGoalsPerGame)} gols/j · xG ${fmtDec(expectedGoals)}`,
  };
}

function computeDefenseMetric(
  lastFive: TeamLastFiveStats,
  standings: TeamStandingsStats,
  opponentXg: number
): { score: number; detail: string } {
  const played = standings.played && standings.played > 0 ? standings.played : null;
  const seasonConcededPerGame =
    played && standings.goalsAgainst !== null
      ? standings.goalsAgainst / played
      : null;
  const recentConceded = Math.max(0, lastFive.avgGoalsConceded || 0);
  const blendedConceded =
    seasonConcededPerGame !== null
      ? seasonConcededPerGame * 0.55 + recentConceded * 0.3 + opponentXg * 0.15
      : recentConceded * 0.7 + opponentXg * 0.3;

  const score = 100 - blendedConceded * 32;

  return {
    score: clampScore(score),
    detail: `${fmtDec(blendedConceded)} sofridos/j`,
  };
}

function computeFormMetric(
  lastFive: TeamLastFiveStats,
  standings: TeamStandingsStats
): { score: number; detail: string } {
  const matchCount = Math.max(
    lastFive.wins + lastFive.draws + lastFive.losses,
    lastFive.matches.length,
    1
  );
  const recentPointsPct =
    ((lastFive.wins * 3 + lastFive.draws) / (matchCount * 3)) * 100;
  const seasonPct =
    standings.winPercentage !== null && standings.winPercentage !== undefined
      ? standings.winPercentage
      : null;

  const recentGd = (lastFive.goalsScored - lastFive.goalsConceded) / matchCount;
  const base =
    seasonPct !== null ? recentPointsPct * 0.75 + seasonPct * 0.25 : recentPointsPct;
  const score = base + recentGd * 4;

  return {
    score: clampScore(score),
    detail: `${lastFive.wins}V ${lastFive.draws}E ${lastFive.losses}D (${Math.round(
      recentPointsPct
    )}%)`,
  };
}

function computeBallControlMetric(
  comp: TeamComplementaryStats,
  standings: TeamStandingsStats,
  lastFive: TeamLastFiveStats
): { score: number; detail: string } {
  if (comp.avgPossessionPct !== null && comp.avgPossessionPct !== undefined) {
    const poss = comp.avgPossessionPct;
    const normalized = 15 + ((poss - 30) / 40) * 75;
    return {
      score: clampScore(normalized),
      detail: `${fmtDec(poss, 1)}% posse`,
    };
  }

  // Fallback estimate grounded on shots, corners, and season dominance when possession is unavailable
  const shotsSignal = comp.avgShots !== null ? (comp.avgShots - 10) * 2.4 : 0;
  const cornersSignal = comp.avgCorners !== null ? (comp.avgCorners - 4.5) * 3.5 : 0;
  const winSignal =
    standings.winPercentage !== null
      ? (standings.winPercentage - 45) * 0.45
      : ((lastFive.wins - lastFive.losses) / 5) * 14;
  const estimatedScore = 52 + shotsSignal + cornersSignal + winSignal;

  return {
    score: clampScore(estimatedScore, 25, 86),
    detail:
      comp.avgShots !== null
        ? `Est. (${fmtDec(comp.avgShots, 1)} fin/j)`
        : 'Est. (posse N/D)',
  };
}

function computeDisciplineMetric(
  comp: TeamComplementaryStats,
  absencesCount: number
): { score: number; detail: string } {
  if (comp.avgCards !== null && comp.avgCards !== undefined) {
    const cards = Math.max(0, comp.avgCards);
    // Lower card average = higher discipline score (1.0 card -> ~88, 3.5 cards -> ~38)
    const normalized = 108 - cards * 20;
    return {
      score: clampScore(normalized),
      detail: `${fmtDec(cards, 1)} cartões/j`,
    };
  }

  // Conservative fallback when average cards are unavailable
  const absencePenalty = Math.min(absencesCount, 5) * 3.5;
  const estimated = 68 - absencePenalty;
  return {
    score: clampScore(estimated, 30, 80),
    detail:
      absencesCount > 0
        ? `Est. (${absencesCount} desfalque${absencesCount > 1 ? 's' : ''})`
        : 'Est. (cartões N/D)',
  };
}

const RadarTooltipContent: React.FC<CustomRadarTooltipProps> = ({
  active,
  payload,
  homeName,
  awayName,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 shadow-lg text-xs max-w-[260px]">
      <div className="font-semibold text-slate-900 dark:text-slate-100">
        {datum.attribute}
      </div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
        {datum.description}
      </div>
      <div className="space-y-1.5 tabular-nums">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200 min-w-0">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 shrink-0" />
            <span className="truncate max-w-[110px]">{homeName}</span>
          </span>
          <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
            {datum.home}/100
            <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400 ml-1">
              ({datum.homeDetail})
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200 min-w-0">
            <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 shrink-0" />
            <span className="truncate max-w-[110px]">{awayName}</span>
          </span>
          <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
            {datum.away}/100
            <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400 ml-1">
              ({datum.awayDetail})
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export const TeamPerformanceRadar: React.FC<TeamPerformanceRadarProps> = ({
  data,
  model,
}) => {
  const [focusMode, setFocusMode] = useState<FocusTeamMode>('both');
  const [selectedAttr, setSelectedAttr] = useState<string | null>(null);

  const radarData = useMemo<RadarAttributeDatum[]>(() => {
    const homeAttack = computeAttackMetric(
      data.module1LastFive.home,
      data.module3Standings.home,
      data.module4Complementary.home,
      model.expectedGoalsHome
    );
    const awayAttack = computeAttackMetric(
      data.module1LastFive.away,
      data.module3Standings.away,
      data.module4Complementary.away,
      model.expectedGoalsAway
    );

    const homeDefense = computeDefenseMetric(
      data.module1LastFive.home,
      data.module3Standings.home,
      model.expectedGoalsAway
    );
    const awayDefense = computeDefenseMetric(
      data.module1LastFive.away,
      data.module3Standings.away,
      model.expectedGoalsHome
    );

    const homeForm = computeFormMetric(
      data.module1LastFive.home,
      data.module3Standings.home
    );
    const awayForm = computeFormMetric(
      data.module1LastFive.away,
      data.module3Standings.away
    );

    const homeControl = computeBallControlMetric(
      data.module4Complementary.home,
      data.module3Standings.home,
      data.module1LastFive.home
    );
    const awayControl = computeBallControlMetric(
      data.module4Complementary.away,
      data.module3Standings.away,
      data.module1LastFive.away
    );

    const homeDiscipline = computeDisciplineMetric(
      data.module4Complementary.home,
      data.module5Context.homeTeamContext.absencesAndSuspensions.length
    );
    const awayDiscipline = computeDisciplineMetric(
      data.module4Complementary.away,
      data.module5Context.awayTeamContext.absencesAndSuspensions.length
    );

    const rows: Omit<RadarAttributeDatum, 'advantage'>[] = [
      {
        attribute: 'Ataque',
        shortLabel: 'Ataque',
        home: homeAttack.score,
        away: awayAttack.score,
        homeDetail: homeAttack.detail,
        awayDetail: awayAttack.detail,
        description: 'Volume ofensivo, média de gols e xG projetado',
      },
      {
        attribute: 'Defesa',
        shortLabel: 'Defesa',
        home: homeDefense.score,
        away: awayDefense.score,
        homeDetail: homeDefense.detail,
        awayDetail: awayDefense.detail,
        description: 'Solidez defensiva e menor média de gols sofridos',
      },
      {
        attribute: 'Forma',
        shortLabel: 'Forma',
        home: homeForm.score,
        away: awayForm.score,
        homeDetail: homeForm.detail,
        awayDetail: awayForm.detail,
        description: 'Aproveitamento nos últimos 5 jogos e campanha atual',
      },
      {
        attribute: 'Controle de bola',
        shortLabel: 'Controle',
        home: homeControl.score,
        away: awayControl.score,
        homeDetail: homeControl.detail,
        awayDetail: awayControl.detail,
        description: 'Posse de bola média e domínio territorial',
      },
      {
        attribute: 'Disciplina',
        shortLabel: 'Disciplina',
        home: homeDiscipline.score,
        away: awayDiscipline.score,
        homeDetail: homeDiscipline.detail,
        awayDetail: awayDiscipline.detail,
        description: 'Menor média de cartões e estabilidade disciplinar',
      },
    ];

    return rows.map((row) => ({
      ...row,
      advantage:
        row.home - row.away >= 4
          ? 'home'
          : row.away - row.home >= 4
            ? 'away'
            : 'even',
    }));
  }, [data, model.expectedGoalsHome, model.expectedGoalsAway]);

  const homeAvg = useMemo(
    () =>
      Math.round(
        radarData.reduce((acc, item) => acc + item.home, 0) / radarData.length
      ),
    [radarData]
  );
  const awayAvg = useMemo(
    () =>
      Math.round(
        radarData.reduce((acc, item) => acc + item.away, 0) / radarData.length
      ),
    [radarData]
  );

  const activeDatum = useMemo(
    () =>
      radarData.find((item) => item.attribute === selectedAttr) ?? radarData[0],
    [radarData, selectedAttr]
  );

  return (
    <section
      aria-label="Comparador visual de desempenho entre os times"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5"
    >
      {/* Header + Interactive Team Focus Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Comparador visual de desempenho
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Perfil comparativo normalizado (0–100) em 5 atributos críticos ·{' '}
            {data.homeTeam.shortCode} {homeAvg} vs {awayAvg} {data.awayTeam.shortCode}
          </p>
        </div>

        <div
          role="group"
          aria-label="Filtrar exibição das equipes no gráfico"
          className="grid grid-cols-3 sm:inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 gap-1 shrink-0"
        >
          <button
            type="button"
            onClick={() => setFocusMode('both')}
            className={`min-h-[44px] sm:min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              focusMode === 'both'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Ambos
          </button>
          <button
            type="button"
            onClick={() => setFocusMode('home')}
            className={`min-h-[44px] sm:min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap inline-flex items-center justify-center gap-1.5 ${
              focusMode === 'home'
                ? 'bg-white dark:bg-slate-950 text-emerald-700 dark:text-emerald-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-xs bg-emerald-600 shrink-0" />
            <span className="truncate max-w-[80px]">{data.homeTeam.shortCode}</span>
          </button>
          <button
            type="button"
            onClick={() => setFocusMode('away')}
            className={`min-h-[44px] sm:min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap inline-flex items-center justify-center gap-1.5 ${
              focusMode === 'away'
                ? 'bg-white dark:bg-slate-950 text-blue-700 dark:text-blue-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-xs bg-blue-600 shrink-0" />
            <span className="truncate max-w-[80px]">{data.awayTeam.shortCode}</span>
          </button>
        </div>
      </div>

      {/* Main 2-column comparator layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-4 items-center">
        {/* Left: Recharts Radar Chart */}
        <div className="lg:col-span-6 flex flex-col">
          {/* Team Legend Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 mb-2 text-xs">
            <div className="inline-flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-xs bg-emerald-600 shrink-0" />
              <TeamCrest
                name={data.homeTeam.name}
                shortCode={data.homeTeam.shortCode}
                primaryColor={data.homeTeam.primaryColor}
                secondaryColor={data.homeTeam.secondaryColor}
                logoUrl={data.homeTeam.logoUrl}
                size="xs"
              />
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[140px]">
                {data.homeTeam.name}
              </span>
              <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-bold">
                {homeAvg}
              </span>
            </div>

            <div className="inline-flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-xs bg-blue-600 shrink-0" />
              <TeamCrest
                name={data.awayTeam.name}
                shortCode={data.awayTeam.shortCode}
                primaryColor={data.awayTeam.primaryColor}
                secondaryColor={data.awayTeam.secondaryColor}
                logoUrl={data.awayTeam.logoUrl}
                size="xs"
              />
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[140px]">
                {data.awayTeam.name}
              </span>
              <span className="font-mono tabular-nums text-blue-700 dark:text-blue-400 font-bold">
                {awayAvg}
              </span>
            </div>
          </div>

          <div className="w-full h-[290px] sm:h-[340px] text-slate-600 dark:text-slate-300">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                cx="50%"
                cy="50%"
                outerRadius="66%"
                data={radarData}
                margin={{ top: 20, right: 46, bottom: 20, left: 46 }}
              >
                <PolarGrid
                  gridType="polygon"
                  stroke="currentColor"
                  strokeOpacity={0.18}
                />
                <PolarAngleAxis
                  dataKey="attribute"
                  tick={{
                    fill: 'currentColor',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tickCount={5}
                  axisLine={false}
                  tick={{
                    fill: 'currentColor',
                    fillOpacity: 0.55,
                    fontSize: 10,
                  }}
                />
                <Tooltip
                  content={
                    <RadarTooltipContent
                      homeName={data.homeTeam.name}
                      awayName={data.awayTeam.name}
                    />
                  }
                />
                {focusMode !== 'away' && (
                  <Radar
                    name={data.homeTeam.name}
                    dataKey="home"
                    stroke="#059669"
                    strokeWidth={2.4}
                    fill="#059669"
                    fillOpacity={focusMode === 'home' ? 0.34 : 0.22}
                    dot={{ r: 3.5, fill: '#059669', strokeWidth: 0 }}
                    activeDot={{ r: 5.5, fill: '#059669' }}
                  />
                )}
                {focusMode !== 'home' && (
                  <Radar
                    name={data.awayTeam.name}
                    dataKey="away"
                    stroke="#2563EB"
                    strokeWidth={2.4}
                    fill="#2563EB"
                    fillOpacity={focusMode === 'away' ? 0.34 : 0.2}
                    dot={{ r: 3.5, fill: '#2563EB', strokeWidth: 0 }}
                    activeDot={{ r: 5.5, fill: '#2563EB' }}
                  />
                )}
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Structured Attribute Comparison Table (Hairline Dividers, Zero Nested Cards) */}
        <div className="lg:col-span-6 divide-y divide-slate-100 dark:divide-slate-800 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 pt-2 lg:pt-0 lg:pl-5">
          {radarData.map((row) => {
            const isSelected = activeDatum.attribute === row.attribute;
            const homeLeading = row.advantage === 'home';
            const awayLeading = row.advantage === 'away';
            return (
              <button
                key={row.attribute}
                type="button"
                onClick={() => setSelectedAttr(row.attribute)}
                className={`w-full text-left py-2.5 px-2 rounded-xl transition-colors ${
                  isSelected
                    ? 'bg-slate-50/90 dark:bg-slate-800/60'
                    : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/35'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {row.attribute}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0 whitespace-nowrap">
                    {homeLeading
                      ? `Vantagem ${data.homeTeam.shortCode}`
                      : awayLeading
                        ? `Vantagem ${data.awayTeam.shortCode}`
                        : 'Equilibrado'}
                  </span>
                </div>

                {/* Dual Score + Progress Bar */}
                <div className="flex items-center gap-2.5 text-xs tabular-nums">
                  <span
                    className={`w-7 font-mono font-bold shrink-0 ${
                      homeLeading
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {row.home}
                  </span>

                  <div className="flex-1 grid grid-cols-2 gap-1 items-center">
                    <div className="h-2 rounded-l-md bg-slate-100 dark:bg-slate-800 overflow-hidden flex justify-end">
                      <div
                        className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-l-md transition-all duration-300"
                        style={{ width: `${row.home}%` }}
                      />
                    </div>
                    <div className="h-2 rounded-r-md bg-slate-100 dark:bg-slate-800 overflow-hidden flex justify-start">
                      <div
                        className="h-full bg-blue-600 dark:bg-blue-500 rounded-r-md transition-all duration-300"
                        style={{ width: `${row.away}%` }}
                      />
                    </div>
                  </div>

                  <span
                    className={`w-7 font-mono font-bold text-right shrink-0 ${
                      awayLeading
                        ? 'text-blue-700 dark:text-blue-400'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {row.away}
                  </span>
                </div>

                {/* Underlying Raw Metrics */}
                <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  <span className="truncate">{row.homeDetail}</span>
                  <span className="truncate text-right">{row.awayDetail}</span>
                </div>
              </button>
            );
          })}

          <div className="pt-2.5 px-2 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <span>
              Destaque: <strong className="text-slate-700 dark:text-slate-200">{activeDatum.attribute}</strong> — {activeDatum.description}
            </span>
            <span className="font-mono tabular-nums">Escala 0–100</span>
          </div>
        </div>
      </div>
    </section>
  );
};
