import React, { useState } from 'react';
import { ExternalLink, AlertCircle, RotateCcw } from 'lucide-react';
import { CompetitionFlag } from './CompetitionFlag.tsx';
import { LastFiveGoalsChart } from './LastFiveGoalsChart.tsx';
import { TeamCrest } from './TeamCrest.tsx';
import type {
  AnalysisResponsePayload,
  AppSettings,
  MatchOutcome,
  PoissonModelResult,
} from '../types/football.ts';

export type ModuleSubTab =
  | 'poisson'
  | 'last5'
  | 'h2h'
  | 'standings'
  | 'complementary'
  | 'context';

interface ModulesViewProps {
  analysis: AnalysisResponsePayload;
  model: PoissonModelResult;
  settings: AppSettings;
  contextDelta: { home: number; away: number };
  onChangeContextDelta: (next: { home: number; away: number }) => void;
  onResetContextDelta: () => void;
}

function fmtNum(value: number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/D';
  return `${value}${suffix}`;
}

function outcomeStyle(outcome: MatchOutcome): string {
  if (outcome === 'V') {
    return 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
  }
  if (outcome === 'E') {
    return 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
  }
  return 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800';
}

export const ModulesView: React.FC<ModulesViewProps> = ({
  analysis,
  model,
  settings,
  contextDelta,
  onChangeContextDelta,
  onResetContextDelta,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<ModuleSubTab>('poisson');
  const { data, sources } = analysis;

  const tabs: { id: ModuleSubTab; label: string }[] = [
    { id: 'poisson', label: 'Modelo Poisson' },
    { id: 'last5', label: '1. Últimas 5' },
    { id: 'h2h', label: '2. Confrontos' },
    { id: 'standings', label: '3. Tabela' },
    { id: 'complementary', label: '4. Complementares' },
    { id: 'context', label: '5. Fatores' },
  ];

  const isContextModified =
    Math.abs(contextDelta.home - data.module5Context.contextualImpactHome) > 0.005 ||
    Math.abs(contextDelta.away - data.module5Context.contextualImpactAway) > 0.005;

  return (
    <div className="space-y-4">
      {/* Sub-navigation bar — always shows all 6 module tabs without clipping */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-1.5">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 items-stretch gap-1.5">
          {tabs.map((tab) => {
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`min-h-[44px] px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap flex items-center justify-center ${
                  active
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* POISSON TAB */}
      {activeSubTab === 'poisson' && (
        <div className="space-y-4">
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Matriz de placares prováveis (Poisson)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Linhas: gols de {data.homeTeam.name} · Colunas: gols de {data.awayTeam.name}
                </p>
              </div>
              <span className="font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                λ {model.expectedGoalsHome.toFixed(2)} × {model.expectedGoalsAway.toFixed(2)}
              </span>
            </div>

            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full border-collapse text-center font-mono text-[11px] sm:text-xs tabular-nums">
                <thead>
                  <tr>
                    <th className="p-1.5 sm:p-2 text-[10px] sm:text-[11px] font-medium text-slate-400 dark:text-slate-500 text-left whitespace-nowrap">
                      {data.homeTeam.shortCode} \ {data.awayTeam.shortCode}
                    </th>
                    {[0, 1, 2, 3, 4].map((awayG) => (
                      <th key={awayG} className="p-1.5 sm:p-2 font-semibold text-blue-700 dark:text-blue-400">
                        {awayG}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4].map((homeG) => (
                    <tr key={homeG} className="border-t border-slate-100 dark:border-slate-800">
                      <th className="p-1.5 sm:p-2 font-semibold text-emerald-700 dark:text-emerald-400 text-left">
                        {homeG}
                      </th>
                      {[0, 1, 2, 3, 4].map((awayG) => {
                        const prob = model.matrix[homeG]?.[awayG] ?? 0;
                        const isBest =
                          model.mostLikelyScore.homeGoals === homeG &&
                          model.mostLikelyScore.awayGoals === awayG;
                        const cellBg = isBest
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                          : homeG > awayG
                            ? prob >= 7
                              ? 'bg-emerald-100/80 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200'
                              : 'bg-emerald-50/40 dark:bg-emerald-950/30 text-slate-700 dark:text-slate-300'
                            : homeG === awayG
                              ? prob >= 7
                                ? 'bg-amber-100/80 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200'
                                : 'bg-amber-50/40 dark:bg-amber-950/30 text-slate-700 dark:text-slate-300'
                              : prob >= 7
                                ? 'bg-blue-100/80 dark:bg-blue-900/50 text-blue-900 dark:text-blue-200'
                                : 'bg-blue-50/40 dark:bg-blue-950/30 text-slate-700 dark:text-slate-300';

                        return (
                          <td key={awayG} className="p-0.5 sm:p-1">
                            <div
                              className={`rounded-lg py-1.5 sm:py-2 px-1 sm:px-1.5 ${cellBg}`}
                              title={`${homeG} x ${awayG}: ${prob}%`}
                            >
                              {prob.toFixed(1)}%
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Top 6 placares */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2.5">
                Placares com maior probabilidade
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {model.topScorelines.map((item) => (
                  <div
                    key={`${item.homeGoals}-${item.awayGoals}`}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 text-xs"
                  >
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {item.homeGoals} x {item.awayGoals}
                    </span>
                    <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                      {item.probability.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Breakdown + Interactive Contextual Sensitivity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Composição do modelo matemático
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300">Força da temporada (Tabela)</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {model.methodologyBreakdown.seasonAttackHome !== null
                      ? `${model.methodologyBreakdown.seasonAttackHome} vs ${model.methodologyBreakdown.seasonAttackAway}`
                      : 'Indisponível'}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300">Forma recente (Últimas 5)</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {model.methodologyBreakdown.recentFormHome !== null
                      ? `${model.methodologyBreakdown.recentFormHome} vs ${model.methodologyBreakdown.recentFormAway}`
                      : 'Desativado / N/D'}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300">Histórico direto (H2H)</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {model.methodologyBreakdown.h2hFactorHome !== null
                      ? `${model.methodologyBreakdown.h2hFactorHome} vs ${model.methodologyBreakdown.h2hFactorAway}`
                      : 'Desativado / N/D'}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300">Multiplicador mando de campo</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {model.methodologyBreakdown.homeAdvantageBoost.toFixed(2)}x
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300">Ajuste contextual (Módulo 5)</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {model.methodologyBreakdown.contextualDeltaHome >= 0 ? '+' : ''}
                    {model.methodologyBreakdown.contextualDeltaHome} /{' '}
                    {model.methodologyBreakdown.contextualDeltaAway >= 0 ? '+' : ''}
                    {model.methodologyBreakdown.contextualDeltaAway}
                  </span>
                </div>
              </div>
            </section>

            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Simulador de impacto contextual
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Ajuste desfalques ou motivação para recalcular em tempo real
                  </p>
                </div>
                {isContextModified && (
                  <button
                    type="button"
                    onClick={onResetContextDelta}
                    className="min-h-[44px] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar</span>
                  </button>
                )}
              </div>

              <div className="space-y-4 mt-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-emerald-800 dark:text-emerald-300">
                      Impacto em {data.homeTeam.name}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                      {contextDelta.home >= 0 ? '+' : ''}
                      {contextDelta.home.toFixed(2)} gols
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-0.35}
                    max={0.35}
                    step={0.05}
                    value={contextDelta.home}
                    onChange={(e) =>
                      onChangeContextDelta({
                        ...contextDelta,
                        home: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-700 dark:accent-emerald-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-blue-800 dark:text-blue-300">
                      Impacto em {data.awayTeam.name}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                      {contextDelta.away >= 0 ? '+' : ''}
                      {contextDelta.away.toFixed(2)} gols
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-0.35}
                    max={0.35}
                    step={0.05}
                    value={contextDelta.away}
                    onChange={(e) =>
                      onChangeContextDelta({
                        ...contextDelta,
                        away: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-blue-700 dark:accent-blue-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* MODULE 1: LAST 5 MATCHES */}
      {activeSubTab === 'last5' && (
        <div className="space-y-4">
          <LastFiveGoalsChart
            homeTeam={data.homeTeam}
            awayTeam={data.awayTeam}
            homeStats={data.module1LastFive.home}
            awayStats={data.module1LastFive.away}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              { label: 'Mandante', team: data.homeTeam, stats: data.module1LastFive.home, tone: 'emerald' },
              { label: 'Visitante', team: data.awayTeam, stats: data.module1LastFive.away, tone: 'blue' },
            ].map(({ label, team, stats, tone }) => (
            <section
              key={team.name}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <TeamCrest
                    name={team.name}
                    shortCode={team.shortCode}
                    primaryColor={team.primaryColor}
                    secondaryColor={team.secondaryColor}
                    logoUrl={team.logoUrl}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <span
                      className={`text-xs font-semibold ${
                        tone === 'emerald'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-blue-700 dark:text-blue-400'
                      }`}
                    >
                      {label}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                      {team.name}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {stats.matches.map((m, idx) => (
                    <span
                      key={idx}
                      className={`w-7 h-7 rounded-lg border text-xs font-mono font-bold flex items-center justify-center ${outcomeStyle(
                        m.outcome
                      )}`}
                    >
                      {m.outcome}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 min-[400px]:grid-cols-4 gap-2 py-3 border-b border-slate-100 dark:border-slate-800 text-center">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">V · E · D</div>
                  <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                    {stats.wins}-{stats.draws}-{stats.losses}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Gols pró</div>
                  <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                    {stats.goalsScored}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Sofridos</div>
                  <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                    {stats.goalsConceded}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Média GP</div>
                  <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                    {stats.avgGoalsScored.toFixed(2)}
                  </div>
                </div>
              </div>

              {(stats.homeSummary || stats.awaySummary) && (
                <div className="py-2.5 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  {stats.homeSummary && (
                    <div>
                      <span className="font-medium text-slate-800 dark:text-slate-100">Em casa:</span>{' '}
                      {stats.homeSummary}
                    </div>
                  )}
                  {stats.awaySummary && (
                    <div>
                      <span className="font-medium text-slate-800 dark:text-slate-100">Fora:</span>{' '}
                      {stats.awaySummary}
                    </div>
                  )}
                </div>
              )}

              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-1">
                {stats.matches.length === 0 ? (
                  <p className="py-4 text-xs text-slate-500 dark:text-slate-400">
                    Jogos recentes detalhados indisponíveis nas fontes consultadas.
                  </p>
                ) : (
                  stats.matches.map((m, idx) => (
                    <div
                      key={idx}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {m.venue === 'Casa' ? 'vs' : '@'} {m.opponent}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {m.venue}
                          {m.competition ? ` · ${m.competition}` : ''}
                          {m.date ? ` · ${m.date}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                          {m.scoreFor} x {m.scoreAgainst}
                        </span>
                        <span
                          className={`w-6 h-6 rounded-md border text-[11px] font-mono font-bold flex items-center justify-center ${outcomeStyle(
                            m.outcome
                          )}`}
                        >
                          {m.outcome}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ))}
          </div>
        </div>
      )}

      {/* MODULE 2: HEAD TO HEAD */}
      {activeSubTab === 'h2h' && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Módulo 2 — Confrontos diretos
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/70 p-3 text-center">
              <div className="text-[11px] text-emerald-900 dark:text-emerald-200 truncate">
                Vitórias {data.homeTeam.shortCode}
              </div>
              <div className="font-display text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
                {data.module2HeadToHead.homeTeamWins}
              </div>
            </div>
            <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/70 p-3 text-center">
              <div className="text-[11px] text-amber-900 dark:text-amber-200">Empates</div>
              <div className="font-display text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums mt-0.5">
                {data.module2HeadToHead.draws}
              </div>
            </div>
            <div className="rounded-xl bg-blue-50/70 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-800/70 p-3 text-center">
              <div className="text-[11px] text-blue-900 dark:text-blue-200 truncate">
                Vitórias {data.awayTeam.shortCode}
              </div>
              <div className="font-display text-2xl font-bold text-blue-700 dark:text-blue-400 tabular-nums mt-0.5">
                {data.module2HeadToHead.awayTeamWins}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 p-3 text-center">
              <div className="text-[11px] text-slate-600 dark:text-slate-300">Média de gols</div>
              <div className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                {fmtNum(data.module2HeadToHead.avgGoalsPerMatch)}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Últimos confrontos encontrados ({data.module2HeadToHead.recentMatches.length})
            </h4>
            {data.module2HeadToHead.recentMatches.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
                Histórico detalhado de confrontos diretos indisponível nas fontes atuais.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.module2HeadToHead.recentMatches.map((m, idx) => (
                  <div
                    key={idx}
                    className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {m.homeTeam} × {m.awayTeam}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {m.competition || 'Competição oficial'}
                        {m.date ? ` · ${m.date}` : ''}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700">
                      {m.homeGoals} x {m.awayGoals}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* MODULE 3: STANDINGS */}
      {activeSubTab === 'standings' && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Módulo 3 — Classificação no campeonato
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
              <CompetitionFlag competition={data.competition} size="sm" />
              <span>
                {data.competition} · {data.season}
              </span>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 text-left font-medium">Indicador</th>
                  <th className="py-2.5 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                    {data.homeTeam.shortCode}
                  </th>
                  <th className="py-2.5 text-right font-semibold text-blue-700 dark:text-blue-400">
                    {data.awayTeam.shortCode}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                {[
                  {
                    label: 'Posição na tabela',
                    h: fmtNum(data.module3Standings.home.position, 'º'),
                    a: fmtNum(data.module3Standings.away.position, 'º'),
                  },
                  {
                    label: 'Pontuação',
                    h: fmtNum(data.module3Standings.home.points),
                    a: fmtNum(data.module3Standings.away.points),
                  },
                  {
                    label: 'Jogos disputados',
                    h: fmtNum(data.module3Standings.home.played),
                    a: fmtNum(data.module3Standings.away.played),
                  },
                  {
                    label: 'Vitórias / Empates / Derrotas',
                    h: `${fmtNum(data.module3Standings.home.wins)}-${fmtNum(
                      data.module3Standings.home.draws
                    )}-${fmtNum(data.module3Standings.home.losses)}`,
                    a: `${fmtNum(data.module3Standings.away.wins)}-${fmtNum(
                      data.module3Standings.away.draws
                    )}-${fmtNum(data.module3Standings.away.losses)}`,
                  },
                  {
                    label: 'Gols pró / contra',
                    h: `${fmtNum(data.module3Standings.home.goalsFor)} / ${fmtNum(
                      data.module3Standings.home.goalsAgainst
                    )}`,
                    a: `${fmtNum(data.module3Standings.away.goalsFor)} / ${fmtNum(
                      data.module3Standings.away.goalsAgainst
                    )}`,
                  },
                  {
                    label: 'Saldo de gols',
                    h: fmtNum(data.module3Standings.home.goalDifference),
                    a: fmtNum(data.module3Standings.away.goalDifference),
                  },
                  {
                    label: 'Aproveitamento',
                    h: fmtNum(data.module3Standings.home.winPercentage, '%'),
                    a: fmtNum(data.module3Standings.away.winPercentage, '%'),
                  },
                  {
                    label: 'Campanha como mandante',
                    h: data.module3Standings.home.homeRecord || 'N/D',
                    a: data.module3Standings.away.homeRecord || 'N/D',
                  },
                  {
                    label: 'Campanha como visitante',
                    h: data.module3Standings.home.awayRecord || 'N/D',
                    a: data.module3Standings.away.awayRecord || 'N/D',
                  },
                ].map((row) => (
                  <tr key={row.label}>
                    <td className="py-2.5 text-slate-600 dark:text-slate-300 pr-3">{row.label}</td>
                    <td className="py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {row.h}
                    </td>
                    <td className="py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {row.a}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* MODULE 4: COMPLEMENTARY STATS */}
      {activeSubTab === 'complementary' && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Módulo 4 — Estatísticas complementares
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Dados exibidos apenas quando disponíveis nas fontes esportivas consultadas (N/D quando ausentes).
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 text-left font-medium">Métrica</th>
                  <th className="py-2.5 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                    {data.homeTeam.shortCode}
                  </th>
                  <th className="py-2.5 text-right font-semibold text-blue-700 dark:text-blue-400">
                    {data.awayTeam.shortCode}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                {[
                  {
                    enabled: settings.activeModules.corners,
                    label: 'Média de escanteios',
                    h: fmtNum(data.module4Complementary.home.avgCorners),
                    a: fmtNum(data.module4Complementary.away.avgCorners),
                  },
                  {
                    enabled: settings.activeModules.cards,
                    label: 'Média de cartões',
                    h: fmtNum(data.module4Complementary.home.avgCards),
                    a: fmtNum(data.module4Complementary.away.avgCards),
                  },
                  {
                    enabled: true,
                    label: 'Finalizações por jogo',
                    h: fmtNum(data.module4Complementary.home.avgShots),
                    a: fmtNum(data.module4Complementary.away.avgShots),
                  },
                  {
                    enabled: true,
                    label: 'Finalizações no gol',
                    h: fmtNum(data.module4Complementary.home.avgShotsOnTarget),
                    a: fmtNum(data.module4Complementary.away.avgShotsOnTarget),
                  },
                  {
                    enabled: true,
                    label: 'Posse de bola média',
                    h: fmtNum(data.module4Complementary.home.avgPossessionPct, '%'),
                    a: fmtNum(data.module4Complementary.away.avgPossessionPct, '%'),
                  },
                  {
                    enabled: settings.activeModules.goalsAndBtts,
                    label: 'Ambas as equipes marcam',
                    h: fmtNum(data.module4Complementary.home.bttsPct, '%'),
                    a: fmtNum(data.module4Complementary.away.bttsPct, '%'),
                  },
                  {
                    enabled: settings.activeModules.goalsAndBtts,
                    label: 'Jogos com +1,5 gols',
                    h: fmtNum(data.module4Complementary.home.over15Pct, '%'),
                    a: fmtNum(data.module4Complementary.away.over15Pct, '%'),
                  },
                  {
                    enabled: settings.activeModules.goalsAndBtts,
                    label: 'Jogos com +2,5 gols',
                    h: fmtNum(data.module4Complementary.home.over25Pct, '%'),
                    a: fmtNum(data.module4Complementary.away.over25Pct, '%'),
                  },
                ]
                  .filter((row) => row.enabled)
                  .map((row) => (
                    <tr key={row.label}>
                      <td className="py-2.5 text-slate-600 dark:text-slate-300 pr-3">{row.label}</td>
                      <td className="py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {row.h}
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {row.a}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* MODULE 5: CONTEXT FACTORS */}
      {activeSubTab === 'context' && (
        <div className="space-y-4">
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Módulo 5 — Fatores que influenciam o resultado
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              <div className="py-2.5">
                <div className="text-xs text-slate-500 dark:text-slate-400">Importância do jogo</div>
                <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {data.module5Context.matchImportance || 'Partida regular de campeonato'}
                </div>
              </div>
              <div className="py-2.5">
                <div className="text-xs text-slate-500 dark:text-slate-400">Mando de campo</div>
                <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {data.module5Context.homeAdvantageNote || `Mando de campo favorável a ${data.homeTeam.name}`}
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              { team: data.homeTeam, ctx: data.module5Context.homeTeamContext, tone: 'emerald' },
              { team: data.awayTeam, ctx: data.module5Context.awayTeamContext, tone: 'blue' },
            ].map(({ team, ctx, tone }) => (
              <section
                key={team.name}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamCrest
                      name={team.name}
                      shortCode={team.shortCode}
                      primaryColor={team.primaryColor}
                      secondaryColor={team.secondaryColor}
                      logoUrl={team.logoUrl}
                      size="xs"
                    />
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 min-w-0 truncate">
                      {team.name}
                    </h4>
                  </div>
                  <span
                    className={`text-xs font-mono tabular-nums shrink-0 ${
                      tone === 'emerald'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-blue-700 dark:text-blue-400'
                    }`}
                  >
                    Descanso: {ctx.restDays !== null && ctx.restDays !== undefined ? `${ctx.restDays} dias` : 'N/D'}
                  </span>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Desfalques e suspensões
                  </div>
                  {ctx.absencesAndSuspensions.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Nenhum desfalque relevante confirmado nas fontes consultadas.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-xs text-slate-800 dark:text-slate-200 list-disc pl-4">
                      {ctx.absencesAndSuspensions.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {ctx.recentCoachChange && (
                  <div className="text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Comando técnico: </span>
                    <span className="text-slate-600 dark:text-slate-300">{ctx.recentCoachChange}</span>
                  </div>
                )}

                {ctx.formNote && (
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Contexto atual: </span>
                    {ctx.formNote}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      )}

      {/* Grounding Sources & Data Warnings */}
      {(sources.length > 0 || data.dataWarnings.length > 0) && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 space-y-3">
          {data.dataWarnings.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Observações sobre disponibilidade de dados</span>
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pl-5 list-disc">
                {data.dataWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {sources.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Fontes esportivas consultadas na Internet
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sources.map((src) => (
                  <a
                    key={src.uri}
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/60 dark:bg-slate-800/60 flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <span className="truncate font-medium">{src.title}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
