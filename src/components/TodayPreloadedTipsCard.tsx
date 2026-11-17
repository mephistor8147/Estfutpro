import React from 'react';
import { ArrowRight, Calendar, Flame } from 'lucide-react';
import { CompetitionFlag } from './CompetitionFlag.tsx';
import { TeamCrest } from './TeamCrest.tsx';
import type { SerieAMultipleLeg, SerieAMultipleTip } from '../types/football.ts';

interface TodayPreloadedTipsCardProps {
  tip: SerieAMultipleTip | null;
  isLoading: boolean;
  error: string | null;
  onOpenTipsMenu: () => void;
  onSelectLeg: (leg: SerieAMultipleLeg) => void;
}

export const TodayPreloadedTipsCard: React.FC<TodayPreloadedTipsCardProps> = ({
  tip,
  isLoading,
  error,
  onOpenTipsMenu,
  onSelectLeg,
}) => {
  const updatedTime = tip?.updatedAt
    ? new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(tip.updatedAt))
    : null;

  return (
    <section
      aria-label="Dicas pré-carregadas de hoje"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs mb-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight text-balance">
              Dicas do dia
            </h2>
          </div>

          {tip && tip.legs.length > 0 ? (
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 tabular-nums flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span>Pré-carregadas para hoje</span>
              <span aria-hidden="true">·</span>
              <span>
                {tip.legs.length} {tip.legs.length === 1 ? 'jogo' : 'jogos'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Prob. combinada{' '}
                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  {tip.combinedProbabilityPct}%
                </span>
              </span>
              {updatedTime && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Atualizado {updatedTime}</span>
                </>
              )}
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Dicas pré-carregadas para os jogos de hoje via modelo Poisson.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenTipsMenu}
          className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          <Flame className="w-3.5 h-3.5 shrink-0" />
          <span>Abrir Dicas quentes</span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>

      {/* Body */}
      {isLoading && !tip ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 space-y-2.5 animate-pulse"
            >
              <div className="h-3 w-32 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-5 w-44 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-5 w-36 rounded bg-emerald-200/60 dark:bg-emerald-900/40" />
              <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      ) : error || !tip || tip.legs.length === 0 ? (
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            {error ||
              'Nenhuma partida qualificada disponível na grade de hoje no momento.'}
          </p>
          <button
            type="button"
            onClick={onOpenTipsMenu}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <span>Explorar em Dicas quentes</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {tip.legs.map((leg, idx) => (
            <article
              key={`${leg.homeTeam}-${leg.awayTeam}-${idx}`}
              className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5 flex flex-col justify-between gap-2.5"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5 font-medium min-w-0 truncate">
                    <CompetitionFlag
                      leagueSlug={leg.leagueSlug}
                      competition={leg.competition || tip.competition}
                      size="sm"
                    />
                    <span className="truncate">
                      {leg.competition || tip.competition} · {leg.dateLabel}
                    </span>
                  </span>
                  <span className="font-mono tabular-nums shrink-0">
                    xG {leg.expectedGoalsHome.toFixed(1)}–{leg.expectedGoalsAway.toFixed(1)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamCrest
                      name={leg.homeTeam}
                      shortCode={leg.homeShortCode}
                      primaryColor={leg.homeColor || '#0F766E'}
                      secondaryColor="#FFFFFF"
                      logoUrl={leg.homeLogoUrl}
                      size="xs"
                    />
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {leg.homeTeam}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamCrest
                      name={leg.awayTeam}
                      shortCode={leg.awayShortCode}
                      primaryColor={leg.awayColor || '#1D4ED8'}
                      secondaryColor="#FFFFFF"
                      logoUrl={leg.awayLogoUrl}
                      size="xs"
                    />
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {leg.awayTeam}
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline justify-between gap-2 pt-0.5">
                  <span className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    {leg.marketLabel}
                  </span>
                  <span className="font-mono tabular-nums text-sm font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                    {leg.probabilityPct}%
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                  {leg.rationale}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 flex justify-end">
                <button
                  type="button"
                  onClick={() => onSelectLeg(leg)}
                  className="min-h-[44px] px-3 py-1 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                >
                  <span>Analisar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
