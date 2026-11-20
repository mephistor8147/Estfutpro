import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { TeamCrest } from './TeamCrest.tsx';
import type { TeamIdentity, TeamLastFiveStats } from '../types/football.ts';

interface LastFiveGoalsChartProps {
  homeTeam: TeamIdentity;
  awayTeam: TeamIdentity;
  homeStats: TeamLastFiveStats;
  awayStats: TeamLastFiveStats;
}

interface ChartDatum {
  metric: string;
  home: number;
  away: number;
  homeTotal: number;
  awayTotal: number;
}

interface CustomTooltipPayloadItem {
  dataKey?: string | number;
  name?: string;
  value?: number | string;
  color?: string;
  payload?: ChartDatum;
}

interface CustomTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: CustomTooltipPayloadItem[];
  homeName: string;
  awayName: string;
}

const GoalsChartTooltip: React.FC<CustomTooltipProps> = ({
  active,
  label,
  payload,
  homeName,
  awayName,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 shadow-lg text-xs">
      <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
        {String(label ?? '')}
      </div>
      <div className="space-y-1.5 tabular-nums">
        {payload.map((entry) => {
          const isHome = entry.dataKey === 'home';
          const teamLabel = isHome ? homeName : awayName;
          const totalGoals = isHome ? datum?.homeTotal : datum?.awayTotal;
          const valNum = Number(entry.value ?? 0);
          return (
            <div
              key={String(entry.dataKey)}
              className="flex items-center justify-between gap-4"
            >
              <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-medium">
                <span
                  className={`w-2.5 h-2.5 rounded-xs shrink-0 ${
                    isHome ? 'bg-emerald-600' : 'bg-blue-600'
                  }`}
                />
                <span className="truncate max-w-[150px]">{teamLabel}</span>
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {valNum.toFixed(2).replace('.', ',')} / jogo
                {typeof totalGoals === 'number' ? (
                  <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 ml-1">
                    ({totalGoals}g)
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const LastFiveGoalsChart: React.FC<LastFiveGoalsChartProps> = ({
  homeTeam,
  awayTeam,
  homeStats,
  awayStats,
}) => {
  const data = useMemo<ChartDatum[]>(
    () => [
      {
        metric: 'Gols marcados',
        home: Number((homeStats.avgGoalsScored ?? 0).toFixed(2)),
        away: Number((awayStats.avgGoalsScored ?? 0).toFixed(2)),
        homeTotal: homeStats.goalsScored ?? 0,
        awayTotal: awayStats.goalsScored ?? 0,
      },
      {
        metric: 'Gols sofridos',
        home: Number((homeStats.avgGoalsConceded ?? 0).toFixed(2)),
        away: Number((awayStats.avgGoalsConceded ?? 0).toFixed(2)),
        homeTotal: homeStats.goalsConceded ?? 0,
        awayTotal: awayStats.goalsConceded ?? 0,
      },
    ],
    [homeStats, awayStats]
  );

  const yMax = useMemo(() => {
    const maxVal = Math.max(
      data[0].home,
      data[0].away,
      data[1].home,
      data[1].away,
      1.2
    );
    return Number((Math.ceil((maxVal + 0.45) * 2) / 2).toFixed(1));
  }, [data]);

  return (
    <section
      aria-label="Gráfico comparativo de médias de gols nos últimos 5 jogos"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Média de gols marcados e sofridos (Últimos 5 jogos)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Comparação lado a lado por partida entre {homeTeam.name} e {awayTeam.name}
          </p>
        </div>

        {/* Custom Team Legend */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs shrink-0">
          <div className="inline-flex items-center gap-1.5 min-w-0">
            <span className="w-3 h-3 rounded-xs bg-emerald-600 shrink-0" />
            <TeamCrest
              name={homeTeam.name}
              shortCode={homeTeam.shortCode}
              primaryColor={homeTeam.primaryColor}
              secondaryColor={homeTeam.secondaryColor}
              logoUrl={homeTeam.logoUrl}
              size="xs"
            />
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
              {homeTeam.name}
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 min-w-0">
            <span className="w-3 h-3 rounded-xs bg-blue-600 shrink-0" />
            <TeamCrest
              name={awayTeam.name}
              shortCode={awayTeam.shortCode}
              primaryColor={awayTeam.primaryColor}
              secondaryColor={awayTeam.secondaryColor}
              logoUrl={awayTeam.logoUrl}
              size="xs"
            />
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
              {awayTeam.name}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full h-64 sm:h-72 text-slate-500 dark:text-slate-400">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 22, right: 16, left: -12, bottom: 4 }}
            barGap={10}
            barCategoryGap="26%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="currentColor"
              strokeOpacity={0.14}
            />
            <XAxis
              dataKey="metric"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'currentColor', fontSize: 12, fontWeight: 600 }}
            />
            <YAxis
              domain={[0, yMax]}
              axisLine={false}
              tickLine={false}
              allowDecimals
              tickFormatter={(v: number) => v.toFixed(1).replace('.', ',')}
              tick={{ fill: 'currentColor', fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
              content={
                <GoalsChartTooltip
                  homeName={homeTeam.name}
                  awayName={awayTeam.name}
                />
              }
            />
            <Bar
              dataKey="home"
              name={homeTeam.name}
              fill="#059669"
              radius={[8, 8, 0, 0]}
              maxBarSize={64}
            >
              <LabelList
                dataKey="home"
                position="top"
                formatter={(val: unknown) =>
                  Number(val ?? 0)
                    .toFixed(2)
                    .replace('.', ',')
                }
                fill="#059669"
                fontSize={12}
                fontWeight={700}
              />
            </Bar>
            <Bar
              dataKey="away"
              name={awayTeam.name}
              fill="#2563EB"
              radius={[8, 8, 0, 0]}
              maxBarSize={64}
            >
              <LabelList
                dataKey="away"
                position="top"
                formatter={(val: unknown) =>
                  Number(val ?? 0)
                    .toFixed(2)
                    .replace('.', ',')
                }
                fill="#2563EB"
                fontSize={12}
                fontWeight={700}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
