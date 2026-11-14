import React from 'react';
import { Bookmark, Check, RefreshCw, ArrowRight } from 'lucide-react';
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
    <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Unboxed clean metadata header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <span className="font-semibold text-slate-800 truncate">{data.competition}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{data.season}</span>
          {data.matchDateInfo && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{data.matchDateInfo}</span>
            </>
          )}
        </div>
        <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
          Atualizado {formattedDate}
        </span>
      </div>

      {/* Team Matchup Header */}
      <div className="px-4 py-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex flex-col items-center text-center min-w-0">
            <TeamCrest
              name={data.homeTeam.name}
              shortCode={data.homeTeam.shortCode}
              primaryColor={data.homeTeam.primaryColor}
              secondaryColor={data.homeTeam.secondaryColor}
              size="lg"
            />
            <h2 className="mt-2 font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-tight line-clamp-2">
              {data.homeTeam.name}
            </h2>
            <span className="mt-0.5 text-xs font-medium text-emerald-700">Mandante</span>
          </div>

          <div className="flex flex-col items-center justify-center px-2">
            <span className="text-xs font-mono font-semibold text-slate-400">VS</span>
            <span className="mt-1.5 font-mono tabular-nums text-xs text-slate-500">
              λ {model.expectedGoalsHome.toFixed(2)} : {model.expectedGoalsAway.toFixed(2)}
            </span>
          </div>

          <div className="flex flex-col items-center text-center min-w-0">
            <TeamCrest
              name={data.awayTeam.name}
              shortCode={data.awayTeam.shortCode}
              primaryColor={data.awayTeam.primaryColor}
              secondaryColor={data.awayTeam.secondaryColor}
              size="lg"
            />
            <h2 className="mt-2 font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-tight line-clamp-2">
              {data.awayTeam.name}
            </h2>
            <span className="mt-0.5 text-xs font-medium text-blue-700">Visitante</span>
          </div>
        </div>

        {/* 1X2 Probabilities */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-medium text-slate-700">Probabilidades calculadas (Poisson)</span>
            <span className="font-mono tabular-nums">Soma 100%</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/70 px-3 py-3 text-center">
              <div className="text-[11px] font-medium text-emerald-900 truncate">
                Vitória {data.homeTeam.shortCode}
              </div>
              <div className="mt-1 font-display text-3xl sm:text-4xl font-bold text-emerald-700 tabular-nums leading-none">
                {model.homeWinPct}%
              </div>
            </div>

            <div className="rounded-xl bg-amber-50/70 border border-amber-200/70 px-3 py-3 text-center">
              <div className="text-[11px] font-medium text-amber-900">Empate</div>
              <div className="mt-1 font-display text-3xl sm:text-4xl font-bold text-amber-700 tabular-nums leading-none">
                {model.drawPct}%
              </div>
            </div>

            <div className="rounded-xl bg-blue-50/70 border border-blue-200/70 px-3 py-3 text-center">
              <div className="text-[11px] font-medium text-blue-900 truncate">
                Vitória {data.awayTeam.shortCode}
              </div>
              <div className="mt-1 font-display text-3xl sm:text-4xl font-bold text-blue-700 tabular-nums leading-none">
                {model.awayWinPct}%
              </div>
            </div>
          </div>

          {/* Segmented distribution bar */}
          <div
            className="mt-3 h-2.5 w-full rounded-full overflow-hidden flex bg-slate-100"
            role="img"
            aria-label={`Distribuição: ${model.homeWinPct}% mandante, ${model.drawPct}% empate, ${model.awayWinPct}% visitante`}
          >
            <div
              className="bg-emerald-600 transition-all duration-300"
              style={{ width: `${model.homeWinPct}%` }}
            />
            <div
              className="bg-amber-500 transition-all duration-300"
              style={{ width: `${model.drawPct}%` }}
            />
            <div
              className="bg-blue-600 transition-all duration-300"
              style={{ width: `${model.awayWinPct}%` }}
            />
          </div>
        </div>

        {/* Painel de Análise Final */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Painel de análise final
          </h3>
          <div className="divide-y divide-slate-100 text-sm">
            <div className="py-2.5 flex items-center justify-between gap-4">
              <span className="text-slate-500">Favorito estatístico</span>
              <span className="font-semibold text-slate-900 text-right">{model.favoriteLabel}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-4">
              <span className="text-slate-500">Placar mais provável</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {model.mostLikelyScore.homeGoals} x {model.mostLikelyScore.awayGoals} ({model.mostLikelyScore.probabilityPct}%)
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-4">
              <span className="text-slate-500">Tendência de gols</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {model.goalTrendLabel} · +1,5 ({model.over15Pct}%) · +2,5 ({model.over25Pct}%)
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-4">
              <span className="text-slate-500">Ambas as equipes marcam</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {model.bttsPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Mobile-friendly action strip */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={onSaveToHistory}
            disabled={isSaved}
            className={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
              isSaved
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.99]'
            }`}
          >
            {isSaved ? <Check className="w-4 h-4 shrink-0" /> : <Bookmark className="w-4 h-4 shrink-0" />}
            <span>{isSaved ? 'Salvo no histórico' : 'Salvar previsão'}</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 active:scale-[0.99] flex items-center justify-center gap-2 transition-colors whitespace-nowrap disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Atualizando...' : 'Atualizar dados'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenModules}
            className="min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-700 text-white hover:bg-emerald-800 active:scale-[0.99] flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <span>Ver 5 módulos</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>
    </section>
  );
};
