import React from 'react';
import { Bookmark, Check, RefreshCw, ArrowRight } from 'lucide-react';
import { CompetitionFlag } from './CompetitionFlag.tsx';
import { MiniPitch } from './MiniPitch.tsx';
import { TeamCrest } from './TeamCrest.tsx';
import type { AnalysisResponsePayload, PoissonModelResult } from '../types/football.ts';

interface ProbabilityHeroProps {
  analysis: AnalysisResponsePayload;
  model: PoissonModelResult;
  isSaved: boolean;
  isRefreshing: boolean;
  onSaveToHistory: () => void;
  onRefresh: () => void;
  onOpenModules: () => void;
}

export const ProbabilityHero: React.FC<ProbabilityHeroProps> = ({
  analysis,
  model,
  isSaved,
  isRefreshing,
  onSaveToHistory,
  onRefresh,
  onOpenModules,
}) => {
  const { data, updatedAt } = analysis;
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(updatedAt));

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Unboxed clean metadata header */}
      <div className="px-3.5 sm:px-5 pt-3.5 sm:pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
          <CompetitionFlag competition={data.competition} size="md" />
          <span className="font-semibold text-slate-800 dark:text-slate-200 break-words">
            {data.competition}
          </span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{data.season}</span>
          {data.matchDateInfo && (
            <>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">{data.matchDateInfo}</span>
            </>
          )}
        </div>
        <span className="font-mono tabular-nums text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
          Atualizado {formattedDate}
        </span>
      </div>

      {/* Team Matchup Header */}
      <div className="px-3.5 sm:px-5 py-4 sm:py-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
          <div className="flex flex-col items-center text-center min-w-0">
            <TeamCrest
              name={data.homeTeam.name}
              shortCode={data.homeTeam.shortCode}
              primaryColor={data.homeTeam.primaryColor}
              secondaryColor={data.homeTeam.secondaryColor}
              logoUrl={data.homeTeam.logoUrl}
              size="lg"
            />
            <h2 className="mt-2 font-display text-lg min-[400px]:text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight line-clamp-2 break-words w-full">
              {data.homeTeam.name}
            </h2>
            <span className="mt-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Mandante
            </span>
          </div>

          <div className="flex flex-col items-center justify-center px-1 sm:px-2 shrink-0">
            <span className="text-[11px] sm:text-xs font-mono font-semibold text-slate-400 dark:text-slate-500">
              VS
            </span>
            <span className="mt-1 sm:mt-1.5 font-mono tabular-nums text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              λ {model.expectedGoalsHome.toFixed(2)} : {model.expectedGoalsAway.toFixed(2)}
            </span>
          </div>

          <div className="flex flex-col items-center text-center min-w-0">
            <TeamCrest
              name={data.awayTeam.name}
              shortCode={data.awayTeam.shortCode}
              primaryColor={data.awayTeam.primaryColor}
              secondaryColor={data.awayTeam.secondaryColor}
              logoUrl={data.awayTeam.logoUrl}
              size="lg"
            />
            <h2 className="mt-2 font-display text-lg min-[400px]:text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight line-clamp-2 break-words w-full">
              {data.awayTeam.name}
            </h2>
            <span className="mt-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
              Visitante
            </span>
          </div>
        </div>

        {/* Tactical Mini Pitch */}
        <MiniPitch
          variant="hero"
          className="mt-4 sm:mt-5"
          homeTeam={data.homeTeam}
          awayTeam={data.awayTeam}
          expectedGoalsHome={model.expectedGoalsHome}
          expectedGoalsAway={model.expectedGoalsAway}
          homeWinPct={model.homeWinPct}
          drawPct={model.drawPct}
          awayWinPct={model.awayWinPct}
          homePossessionPct={data.module4Complementary.home.avgPossessionPct}
          awayPossessionPct={data.module4Complementary.away.avgPossessionPct}
          homeShots={data.module4Complementary.home.avgShots}
          awayShots={data.module4Complementary.away.avgShots}
          homeShotsOnTarget={data.module4Complementary.home.avgShotsOnTarget}
          awayShotsOnTarget={data.module4Complementary.away.avgShotsOnTarget}
          centerLabel={`λ ${model.expectedGoalsHome.toFixed(1)} : ${model.expectedGoalsAway.toFixed(1)}`}
        />

        {/* 1X2 Probabilities */}
        <div className="mt-5 sm:mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Probabilidades calculadas (Poisson)
            </span>
            <span className="font-mono tabular-nums">Soma 100%</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
            <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-800/70 px-2 sm:px-3 py-2.5 sm:py-3 text-center min-w-0">
              <div className="text-[11px] font-medium text-emerald-900 dark:text-emerald-200 truncate">
                Vitória {data.homeTeam.shortCode}
              </div>
              <div className="mt-1 font-display text-2xl min-[400px]:text-3xl sm:text-4xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums leading-none">
                {model.homeWinPct}%
              </div>
            </div>

            <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/50 border border-amber-200/70 dark:border-amber-800/70 px-2 sm:px-3 py-2.5 sm:py-3 text-center min-w-0">
              <div className="text-[11px] font-medium text-amber-900 dark:text-amber-200 truncate">
                Empate
              </div>
              <div className="mt-1 font-display text-2xl min-[400px]:text-3xl sm:text-4xl font-bold text-amber-700 dark:text-amber-400 tabular-nums leading-none">
                {model.drawPct}%
              </div>
            </div>

            <div className="rounded-xl bg-blue-50/70 dark:bg-blue-950/50 border border-blue-200/70 dark:border-blue-800/70 px-2 sm:px-3 py-2.5 sm:py-3 text-center min-w-0">
              <div className="text-[11px] font-medium text-blue-900 dark:text-blue-200 truncate">
                Vitória {data.awayTeam.shortCode}
              </div>
              <div className="mt-1 font-display text-2xl min-[400px]:text-3xl sm:text-4xl font-bold text-blue-700 dark:text-blue-400 tabular-nums leading-none">
                {model.awayWinPct}%
              </div>
            </div>
          </div>

          {/* Segmented distribution bar */}
          <div
            className="mt-3 h-2.5 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800"
            role="img"
            aria-label={`Distribuição: ${model.homeWinPct}% mandante, ${model.drawPct}% empate, ${model.awayWinPct}% visitante`}
          >
            <div
              className="bg-emerald-600 dark:bg-emerald-500 transition-all duration-300"
              style={{ width: `${model.homeWinPct}%` }}
            />
            <div
              className="bg-amber-500 transition-all duration-300"
              style={{ width: `${model.drawPct}%` }}
            />
            <div
              className="bg-blue-600 dark:bg-blue-500 transition-all duration-300"
              style={{ width: `${model.awayWinPct}%` }}
            />
          </div>
        </div>

        {/* Painel de Análise Final */}
        <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Painel de análise final
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
            <div className="py-2.5 flex flex-col min-[380px]:flex-row min-[380px]:items-center justify-between gap-0.5 min-[380px]:gap-4">
              <span className="text-slate-500 dark:text-slate-400 shrink-0">Favorito estatístico</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 min-[380px]:text-right">
                {model.favoriteLabel}
              </span>
            </div>
            <div className="py-2.5 flex flex-col min-[380px]:flex-row min-[380px]:items-center justify-between gap-0.5 min-[380px]:gap-4">
              <span className="text-slate-500 dark:text-slate-400 shrink-0">Placar mais provável</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {model.mostLikelyScore.homeGoals} x {model.mostLikelyScore.awayGoals} ({model.mostLikelyScore.probabilityPct}%)
              </span>
            </div>
            <div className="py-2.5 flex flex-col min-[420px]:flex-row min-[420px]:items-center justify-between gap-0.5 min-[420px]:gap-4">
              <span className="text-slate-500 dark:text-slate-400 shrink-0">Tendência de gols</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums min-[420px]:text-right">
                {model.goalTrendLabel} · +1,5 ({model.over15Pct}%) · +2,5 ({model.over25Pct}%)
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-4">
              <span className="text-slate-500 dark:text-slate-400">Ambas as equipes marcam</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {model.bttsPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Responsive action strip */}
        <div className="mt-5 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onSaveToHistory}
            disabled={isSaved}
            className={`flex-1 basis-[155px] min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
              isSaved
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 cursor-default'
                : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white active:scale-[0.99]'
            }`}
          >
            {isSaved ? <Check className="w-4 h-4 shrink-0" /> : <Bookmark className="w-4 h-4 shrink-0" />}
            <span>{isSaved ? 'Salvo no histórico' : 'Salvar previsão'}</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex-1 basis-[155px] min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 active:scale-[0.99] flex items-center justify-center gap-2 transition-colors whitespace-nowrap disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Atualizando...' : 'Atualizar dados'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenModules}
            className="flex-1 basis-[155px] min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white active:scale-[0.99] flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <span>Ver 5 módulos</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>
    </section>
  );
};
