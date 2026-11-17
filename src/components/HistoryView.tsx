import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Edit3,
  Flame,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { formatBrlCurrency } from '../lib/shareMultipleImage.ts';
import { CompetitionFlag } from './CompetitionFlag.tsx';
import { TeamCrest } from './TeamCrest.tsx';
import type {
  MultipleHistoryItem,
  MultipleHistoryLeg,
  MultipleLegStatus,
  MultipleTipStatus,
  PredictionHistoryItem,
} from '../types/football.ts';

interface HistoryViewProps {
  history: PredictionHistoryItem[];
  multipleHistory: MultipleHistoryItem[];
  initialSection?: 'multiple' | 'analysis';
  isCheckingMultipleResults: boolean;
  multipleCheckMessage: string | null;
  liveScoresUpdatedAt: string | null;
  onRecordScore: (id: string, homeGoals: number, awayGoals: number) => void;
  onDeleteItem: (id: string) => void;
  onLoadSnapshot: (item: PredictionHistoryItem) => void;
  onUpdateMultipleLegStatus: (
    itemId: string,
    legIndex: number,
    status: MultipleLegStatus
  ) => void;
  onResolveMultipleTip: (itemId: string, status: MultipleTipStatus) => void;
  onDeleteMultipleItem: (itemId: string) => void;
  onCheckMultipleResults: () => void;
}

function getPredictedFavorite(item: PredictionHistoryItem): 'H' | 'D' | 'A' {
  if (
    item.predictedHomePct >= item.predictedDrawPct &&
    item.predictedHomePct >= item.predictedAwayPct
  ) {
    return 'H';
  }
  if (
    item.predictedAwayPct >= item.predictedDrawPct &&
    item.predictedAwayPct >= item.predictedHomePct
  ) {
    return 'A';
  }
  return 'D';
}

function getActualOutcome(homeGoals: number, awayGoals: number): 'H' | 'D' | 'A' {
  if (homeGoals > awayGoals) return 'H';
  if (awayGoals > homeGoals) return 'A';
  return 'D';
}

function normalizeTextSimple(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getLiveLegPartialSignal(
  leg: MultipleHistoryLeg
): { label: string; positive: boolean } | null {
  if (leg.liveScore?.state !== 'in') return null;
  const hGoals = leg.liveScore.homeGoals;
  const aGoals = leg.liveScore.awayGoals;
  const total = hGoals + aGoals;
  const m = normalizeTextSimple(leg.marketLabel);
  const h = normalizeTextSimple(leg.homeTeam);
  const a = normalizeTextSimple(leg.awayTeam);

  if (m.includes('mais de 1,5') || m.includes('mais de 1.5')) {
    return total >= 2
      ? { label: 'Parcial: batendo', positive: true }
      : { label: 'Parcial: em aberto', positive: false };
  }
  if (m.includes('mais de 2,5') || m.includes('mais de 2.5')) {
    return total >= 3
      ? { label: 'Parcial: batendo', positive: true }
      : { label: 'Parcial: em aberto', positive: false };
  }
  if (m.includes('ambas marcam')) {
    return hGoals >= 1 && aGoals >= 1
      ? { label: 'Parcial: batendo', positive: true }
      : { label: 'Parcial: em aberto', positive: false };
  }
  if (m.includes('dupla chance')) {
    if (h && m.includes(h)) {
      return hGoals >= aGoals
        ? { label: 'Parcial: dentro', positive: true }
        : { label: 'Parcial: atrás', positive: false };
    }
    if (a && m.includes(a)) {
      return aGoals >= hGoals
        ? { label: 'Parcial: dentro', positive: true }
        : { label: 'Parcial: atrás', positive: false };
    }
  }
  if (m.startsWith('vitoria')) {
    if (h && m.includes(h)) {
      return hGoals > aGoals
        ? { label: 'Parcial: à frente', positive: true }
        : { label: 'Parcial: atrás', positive: false };
    }
    if (a && m.includes(a)) {
      return aGoals > hGoals
        ? { label: 'Parcial: à frente', positive: true }
        : { label: 'Parcial: atrás', positive: false };
    }
  }
  return null;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  multipleHistory,
  initialSection = 'multiple',
  isCheckingMultipleResults,
  multipleCheckMessage,
  liveScoresUpdatedAt,
  onRecordScore,
  onDeleteItem,
  onLoadSnapshot,
  onUpdateMultipleLegStatus,
  onResolveMultipleTip,
  onDeleteMultipleItem,
  onCheckMultipleResults,
}) => {
  const [section, setSection] = useState<'multiple' | 'analysis'>(initialSection);
  const [multipleFilter, setMultipleFilter] = useState<
    'all' | 'won' | 'lost' | 'pending'
  >('all');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [homeInput, setHomeInput] = useState<string>('1');
  const [awayInput, setAwayInput] = useState<string>('0');
  const [filterLeague, setFilterLeague] = useState<string>('all');

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  // Metrics for Dicas quentes (Multiple History)
  const multipleWonCount = multipleHistory.filter((m) => m.status === 'won').length;
  const multipleLostCount = multipleHistory.filter((m) => m.status === 'lost').length;
  const multiplePendingCount = multipleHistory.filter(
    (m) => m.status === 'pending'
  ).length;
  const multipleResolvedCount = multipleWonCount + multipleLostCount;
  const multipleHitRatePct =
    multipleResolvedCount > 0
      ? Math.round((multipleWonCount / multipleResolvedCount) * 100)
      : null;

  const multipleNetBalance = multipleHistory.reduce((acc, item) => {
    if (item.status === 'won') {
      return acc + (item.potentialReturn - item.stake);
    }
    if (item.status === 'lost') {
      return acc - item.stake;
    }
    return acc;
  }, 0);

  const filteredMultiples =
    multipleFilter === 'all'
      ? multipleHistory
      : multipleHistory.filter((item) => item.status === multipleFilter);

  // Metrics for Analises 1X2
  const leagues = Array.from(new Set(history.map((h) => h.competition)));
  const filteredAnalyses =
    filterLeague === 'all'
      ? history
      : history.filter((h) => h.competition === filterLeague);

  const finished = history.filter((h) => h.actualScore !== undefined);
  const correct1X2 = finished.filter((h) => {
    if (!h.actualScore) return false;
    return (
      getPredictedFavorite(h) ===
      getActualOutcome(h.actualScore.homeGoals, h.actualScore.awayGoals)
    );
  }).length;

  const hitRatePct =
    finished.length > 0 ? Math.round((correct1X2 / finished.length) * 100) : null;

  const avgGoalDiff =
    finished.length > 0
      ? (
          finished.reduce((acc, h) => {
            if (!h.actualScore) return acc;
            const predTotal = h.expectedGoalsHome + h.expectedGoalsAway;
            const realTotal = h.actualScore.homeGoals + h.actualScore.awayGoals;
            return acc + Math.abs(predTotal - realTotal);
          }, 0) / finished.length
        ).toFixed(2)
      : null;

  const liveMultipleGamesCount = multipleHistory.reduce(
    (sum, item) =>
      sum + item.legs.filter((leg) => leg.liveScore?.state === 'in').length,
    0
  );
  const liveAnalysisGamesCount = history.filter(
    (item) => item.liveScore?.state === 'in'
  ).length;
  const formattedLiveSync = liveScoresUpdatedAt
    ? new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(liveScoresUpdatedAt))
    : null;

  const startEdit = (item: PredictionHistoryItem) => {
    setEditingId(item.id);
    setHomeInput(
      String(item.actualScore?.homeGoals ?? item.liveScore?.homeGoals ?? 1)
    );
    setAwayInput(
      String(item.actualScore?.awayGoals ?? item.liveScore?.awayGoals ?? 0)
    );
  };

  const submitScore = (id: string) => {
    const h = Math.max(0, Math.min(20, parseInt(homeInput, 10) || 0));
    const a = Math.max(0, Math.min(20, parseInt(awayInput, 10) || 0));
    onRecordScore(id, h, a);
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Sub-navigation Switcher: Dicas quentes vs Análises 1X2 */}
      <div
        role="tablist"
        aria-label="Seções do histórico"
        className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 gap-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={section === 'multiple'}
          onClick={() => setSection('multiple')}
          className={`min-h-[44px] px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap tabular-nums ${
            section === 'multiple'
              ? 'bg-emerald-700 dark:bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Flame className="w-4 h-4 shrink-0" />
          <span>Dicas quentes ({multipleHistory.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={section === 'analysis'}
          onClick={() => setSection('analysis')}
          className={`min-h-[44px] px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap tabular-nums ${
            section === 'analysis'
              ? 'bg-emerald-700 dark:bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4 shrink-0" />
          <span>Análises 1X2 ({history.length})</span>
        </button>
      </div>

      {section === 'multiple' ? (
        <>
          {/* Dicas Quentes Hit/Loss KPI Summary */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Histórico de acertos e perdas
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Acompanhe placares ao vivo da web, acertos, perdas e desempenho simulado das múltiplas.
                </p>
                {(liveMultipleGamesCount > 0 || formattedLiveSync) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {liveMultipleGamesCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400">
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400 animate-pulse shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          {liveMultipleGamesCount}{' '}
                          {liveMultipleGamesCount === 1
                            ? 'jogo ao vivo agora'
                            : 'jogos ao vivo agora'}
                        </span>
                      </span>
                    )}
                    {liveMultipleGamesCount > 0 && formattedLiveSync && (
                      <span aria-hidden="true">·</span>
                    )}
                    {formattedLiveSync && (
                      <span>Placares atualizados às {formattedLiveSync}</span>
                    )}
                  </div>
                )}
              </div>

              {multipleHistory.length > 0 && (
                <button
                  type="button"
                  onClick={onCheckMultipleResults}
                  disabled={isCheckingMultipleResults}
                  className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  {isCheckingMultipleResults ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>Atualizar placares</span>
                </button>
              )}
            </div>

            {multipleCheckMessage && (
              <div className="mb-4 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200">
                {multipleCheckMessage}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 p-3">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Dicas salvas
                </div>
                <div className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {multipleHistory.length}
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/70 p-3">
                <div className="text-[11px] text-emerald-900 dark:text-emerald-200">
                  Acertos
                </div>
                <div className="font-display text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
                  {multipleWonCount}
                </div>
              </div>

              <div className="rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-800/70 p-3">
                <div className="text-[11px] text-rose-900 dark:text-rose-200">
                  Perdas
                </div>
                <div className="font-display text-2xl font-bold text-rose-700 dark:text-rose-400 tabular-nums mt-0.5">
                  {multipleLostCount}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 p-3">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Taxa de acerto
                </div>
                <div className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {multipleHitRatePct !== null ? `${multipleHitRatePct}%` : '—'}
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 p-3">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Saldo simulado
                </div>
                <div
                  className={`font-display text-2xl font-bold tabular-nums mt-0.5 ${
                    multipleResolvedCount === 0
                      ? 'text-slate-900 dark:text-slate-100'
                      : multipleNetBalance >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {multipleResolvedCount === 0
                    ? '—'
                    : `${multipleNetBalance >= 0 ? '+' : '-'}${formatBrlCurrency(
                        Math.abs(multipleNetBalance)
                      )}`}
                </div>
              </div>
            </div>

            {multipleHistory.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: `Todas (${multipleHistory.length})` },
                    { id: 'won', label: `Acertos (${multipleWonCount})` },
                    { id: 'lost', label: `Perdas (${multipleLostCount})` },
                    { id: 'pending', label: `Pendentes (${multiplePendingCount})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMultipleFilter(tab.id)}
                    className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      multipleFilter === tab.id
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Saved Hot Tips List */}
          {filteredMultiples.length === 0 ? (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 text-center">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {multipleHistory.length === 0
                  ? 'Nenhuma dica quente salva ainda'
                  : 'Nenhuma múltipla neste filtro'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                {multipleHistory.length === 0
                  ? 'No menu Dicas quentes, toque em Salvar dica para registrar a múltipla e acompanhar acertos e perdas.'
                  : 'Selecione outro filtro acima para visualizar as demais múltiplas salvas.'}
              </p>
            </section>
          ) : (
            <div className="space-y-3.5">
              {filteredMultiples.map((item) => {
                const dateText = new Intl.DateTimeFormat('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(item.createdAt));

                const netValue =
                  item.status === 'won'
                    ? item.potentialReturn - item.stake
                    : item.status === 'lost'
                      ? -item.stake
                      : 0;

                return (
                  <article
                    key={item.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 space-y-3.5"
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <CompetitionFlag
                            leagueSlug={item.leagueSlug}
                            competition={item.competition}
                            size="md"
                          />
                          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {item.competition}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                          {item.legs.length} {item.legs.length === 1 ? 'jogo' : 'jogos'} · Prob.{' '}
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {item.combinedProbabilityPct}%
                          </span>{' '}
                          · Odd total{' '}
                          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                            {item.totalOdd.toFixed(2)}
                          </span>{' '}
                          · Salva em {dateText}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                            item.status === 'won'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : item.status === 'lost'
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {item.status === 'won' ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                          ) : item.status === 'lost' ? (
                            <XCircle className="w-4 h-4 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 shrink-0" />
                          )}
                          <span>
                            {item.status === 'won'
                              ? 'Acerto'
                              : item.status === 'lost'
                                ? 'Perda'
                                : 'Pendente'}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Financial Simulation Summary Row */}
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 p-3 text-xs tabular-nums">
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Valor simulado
                        </div>
                        <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                          {formatBrlCurrency(item.stake)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Retorno alvo
                        </div>
                        <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                          {formatBrlCurrency(item.potentialReturn)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Resultado
                        </div>
                        <div
                          className={`font-mono font-bold mt-0.5 ${
                            item.status === 'won'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : item.status === 'lost'
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {item.status === 'pending'
                            ? 'Em aberto'
                            : `${netValue >= 0 ? '+' : '-'}${formatBrlCurrency(
                                Math.abs(netValue)
                              )}`}
                        </div>
                      </div>
                    </div>

                    {/* Legs Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {item.legs.map((leg, legIdx) => {
                        const isLive = leg.liveScore?.state === 'in';
                        const isPost =
                          leg.liveScore?.state === 'post' ||
                          leg.actualScore !== undefined;
                        const displayScore =
                          isLive && leg.liveScore
                            ? {
                                homeGoals: leg.liveScore.homeGoals,
                                awayGoals: leg.liveScore.awayGoals,
                              }
                            : leg.actualScore
                              ? {
                                  homeGoals: leg.actualScore.homeGoals,
                                  awayGoals: leg.actualScore.awayGoals,
                                }
                              : leg.liveScore?.state === 'post'
                                ? {
                                    homeGoals: leg.liveScore.homeGoals,
                                    awayGoals: leg.liveScore.awayGoals,
                                  }
                                : null;

                        const liveSignal = getLiveLegPartialSignal(leg);
                        const statusLabel = isLive
                          ? leg.liveScore?.statusDetail || 'Em andamento'
                          : isPost
                            ? leg.liveScore?.statusDetail ||
                              leg.actualScore?.statusDetail ||
                              'Finalizado'
                            : leg.liveScore?.statusDetail || leg.dateLabel;

                        return (
                          <div
                            key={`${item.id}-${legIdx}`}
                            className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 ${
                              isLive
                                ? 'border-rose-200 dark:border-rose-900/70 bg-rose-50/25 dark:bg-rose-950/15'
                                : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
                            }`}
                          >
                            <div className="min-w-0 space-y-2">
                              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                                  <CompetitionFlag
                                    leagueSlug={leg.leagueSlug || item.leagueSlug}
                                    competition={leg.competition || item.competition}
                                    size="sm"
                                  />
                                  <span className="truncate">
                                    Jogo {legIdx + 1}
                                    {leg.competition ? ` · ${leg.competition}` : ''}
                                  </span>
                                </span>

                                {isLive ? (
                                  <span className="inline-flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400 shrink-0 tabular-nums whitespace-nowrap">
                                    <span
                                      className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400 animate-pulse shrink-0"
                                      aria-hidden="true"
                                    />
                                    <span>AO VIVO · {statusLabel}</span>
                                  </span>
                                ) : isPost ? (
                                  <span className="font-semibold text-slate-600 dark:text-slate-300 shrink-0 whitespace-nowrap">
                                    {statusLabel}
                                  </span>
                                ) : (
                                  <span className="shrink-0 whitespace-nowrap tabular-nums">
                                    {statusLabel}
                                  </span>
                                )}
                              </div>

                              {/* 2-Row Team Scoreboard */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2 min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <TeamCrest
                                      name={leg.homeTeam}
                                      shortCode={leg.homeShortCode}
                                      primaryColor={leg.homeColor || '#0F766E'}
                                      secondaryColor="#FFFFFF"
                                      logoUrl={leg.homeLogoUrl}
                                      size="xs"
                                    />
                                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                      {leg.homeTeam}
                                    </span>
                                  </div>
                                  {displayScore && (
                                    <span
                                      className={`font-mono text-sm sm:text-base font-bold tabular-nums shrink-0 min-w-[26px] text-center px-1.5 py-0.5 rounded-md ${
                                        isLive
                                          ? 'bg-rose-100/80 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                                          : 'bg-slate-200/70 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                                      }`}
                                    >
                                      {displayScore.homeGoals}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center justify-between gap-2 min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <TeamCrest
                                      name={leg.awayTeam}
                                      shortCode={leg.awayShortCode}
                                      primaryColor={leg.awayColor || '#1D4ED8'}
                                      secondaryColor="#FFFFFF"
                                      logoUrl={leg.awayLogoUrl}
                                      size="xs"
                                    />
                                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                      {leg.awayTeam}
                                    </span>
                                  </div>
                                  {displayScore && (
                                    <span
                                      className={`font-mono text-sm sm:text-base font-bold tabular-nums shrink-0 min-w-[26px] text-center px-1.5 py-0.5 rounded-md ${
                                        isLive
                                          ? 'bg-rose-100/80 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                                          : 'bg-slate-200/70 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                                      }`}
                                    >
                                      {displayScore.awayGoals}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs tabular-nums">
                                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                  {leg.marketLabel} · Odd {leg.odd.toFixed(2)} ({leg.probabilityPct}%)
                                </span>
                                {liveSignal && (
                                  <span
                                    className={`text-[11px] font-semibold ${
                                      liveSignal.positive
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : 'text-amber-700 dark:text-amber-400'
                                    }`}
                                  >
                                    {liveSignal.label}
                                  </span>
                                )}
                              </div>
                            </div>

                          <div
                            role="group"
                            aria-label={`Resultado de ${leg.homeTeam} × ${leg.awayTeam}`}
                            className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateMultipleLegStatus(item.id, legIdx, 'won')
                              }
                              className={`min-h-[44px] px-1.5 sm:px-2 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                                leg.status === 'won'
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              }`}
                            >
                              Acerto
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateMultipleLegStatus(item.id, legIdx, 'lost')
                              }
                              className={`min-h-[44px] px-1.5 sm:px-2 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                                leg.status === 'lost'
                                  ? 'bg-rose-700 text-white'
                                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                              }`}
                            >
                              Perda
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateMultipleLegStatus(item.id, legIdx, 'pending')
                              }
                              className={`min-h-[44px] px-1.5 sm:px-2 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                                leg.status === 'pending'
                                  ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              Pendente
                            </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Whole-Slip Actions */}
                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 flex-1">
                        <button
                          type="button"
                          onClick={() => onResolveMultipleTip(item.id, 'won')}
                          className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
                            item.status === 'won'
                              ? 'border-emerald-700 bg-emerald-700 text-white'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                          }`}
                        >
                          Marcar Acerto
                        </button>
                        <button
                          type="button"
                          onClick={() => onResolveMultipleTip(item.id, 'lost')}
                          className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
                            item.status === 'lost'
                              ? 'border-rose-700 bg-rose-700 text-white'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                          }`}
                        >
                          Marcar Perda
                        </button>
                        {item.status !== 'pending' && (
                          <button
                            type="button"
                            onClick={() => onResolveMultipleTip(item.id, 'pending')}
                            className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                          >
                            Reabrir
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteMultipleItem(item.id)}
                        aria-label="Excluir dica salva"
                        className="min-h-[44px] min-w-[44px] rounded-xl text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Calibration Summary (1X2 Analyses) */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                  Histórico e calibração do modelo
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Acompanhe placares ao vivo da web e compare previsões calculadas com os resultados reais.
                </p>
                {(liveAnalysisGamesCount > 0 || formattedLiveSync) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {liveAnalysisGamesCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400">
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400 animate-pulse shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          {liveAnalysisGamesCount}{' '}
                          {liveAnalysisGamesCount === 1
                            ? 'jogo ao vivo agora'
                            : 'jogos ao vivo agora'}
                        </span>
                      </span>
                    )}
                    {liveAnalysisGamesCount > 0 && formattedLiveSync && (
                      <span aria-hidden="true">·</span>
                    )}
                    {formattedLiveSync && (
                      <span>Placares atualizados às {formattedLiveSync}</span>
                    )}
                  </div>
                )}
              </div>

              {history.length > 0 && (
                <button
                  type="button"
                  onClick={onCheckMultipleResults}
                  disabled={isCheckingMultipleResults}
                  className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  {isCheckingMultipleResults ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>Atualizar placares</span>
                </button>
              )}
            </div>

            {multipleCheckMessage && (
              <div className="mb-4 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200">
                {multipleCheckMessage}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 p-3">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Previsões salvas
                </div>
                <div className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {history.length}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 p-3">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Jogos finalizados
                </div>
                <div className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {finished.length}
                </div>
              </div>
              <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-800/70 p-3">
                <div className="text-[11px] text-emerald-900 dark:text-emerald-200">
                  Taxa de acerto 1X2
                </div>
                <div className="font-display text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
                  {hitRatePct !== null ? `${hitRatePct}%` : '—'}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 p-3">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Erro médio de gols
                </div>
                <div className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {avgGoalDiff !== null ? avgGoalDiff : '—'}
                </div>
              </div>
            </div>

            {leagues.length > 1 && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterLeague('all')}
                  className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    filterLeague === 'all'
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Todos ({history.length})
                </button>
                {leagues.map((league) => (
                  <button
                    key={league}
                    type="button"
                    onClick={() => setFilterLeague(league)}
                    className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      filterLeague === league
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {league}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* List of saved items */}
          {filteredAnalyses.length === 0 ? (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 text-center">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Nenhuma previsão salva ainda
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Analise um confronto na aba Analisador e toque em Salvar previsão para acompanhar sua taxa de acerto por campeonato.
              </p>
            </section>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {filteredAnalyses.map((item) => {
                const isEditing = editingId === item.id;
                const isLive = item.liveScore?.state === 'in';
                const hasResult = item.actualScore !== undefined;
                const isHit =
                  hasResult &&
                  item.actualScore &&
                  getPredictedFavorite(item) ===
                    getActualOutcome(
                      item.actualScore.homeGoals,
                      item.actualScore.awayGoals
                    );

                const livePartialMatches =
                  isLive && item.liveScore
                    ? getPredictedFavorite(item) ===
                      getActualOutcome(
                        item.liveScore.homeGoals,
                        item.liveScore.awayGoals
                      )
                    : null;

                const shownScore =
                  isLive && item.liveScore
                    ? {
                        homeGoals: item.liveScore.homeGoals,
                        awayGoals: item.liveScore.awayGoals,
                      }
                    : hasResult && item.actualScore
                      ? {
                          homeGoals: item.actualScore.homeGoals,
                          awayGoals: item.actualScore.awayGoals,
                        }
                      : null;

                const dateText = new Intl.DateTimeFormat('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(item.createdAt));

                return (
                  <article
                    key={item.id}
                    className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 ${
                      isLive
                        ? 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-900/70'
                        : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300 min-w-0 truncate">
                          <CompetitionFlag
                            leagueSlug={item.liveScore?.leagueSlug}
                            competition={item.competition}
                            size="sm"
                          />
                          <span className="truncate">
                            {item.competition} · {dateText}
                          </span>
                        </span>

                        {isLive ? (
                          <span className="inline-flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400 shrink-0 tabular-nums whitespace-nowrap">
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400 animate-pulse shrink-0"
                              aria-hidden="true"
                            />
                            <span>
                              AO VIVO · {item.liveScore?.statusDetail || 'Em andamento'}
                            </span>
                          </span>
                        ) : hasResult ? (
                          <span
                            className={`inline-flex items-center gap-1 font-semibold shrink-0 ${
                              isHit
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {isHit ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            <span>{isHit ? 'Acertou 1X2' : 'Divergiu'}</span>
                          </span>
                        ) : item.liveScore?.statusDetail ? (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0 tabular-nums whitespace-nowrap">
                            {item.liveScore.statusDetail}
                          </span>
                        ) : null}
                      </div>

                      {/* 2-Row Team Scoreboard for 1X2 Analysis */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <TeamCrest
                              name={item.homeTeam.name}
                              shortCode={item.homeTeam.shortCode}
                              primaryColor={item.homeTeam.primaryColor}
                              secondaryColor={item.homeTeam.secondaryColor}
                              logoUrl={item.homeTeam.logoUrl}
                              size="sm"
                            />
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {item.homeTeam.name}
                            </span>
                          </div>
                          {shownScore && (
                            <span
                              className={`font-mono text-base font-bold tabular-nums shrink-0 min-w-[30px] text-center px-2 py-0.5 rounded-lg ${
                                isLive
                                  ? 'bg-rose-100/80 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                                  : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                              }`}
                            >
                              {shownScore.homeGoals}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <TeamCrest
                              name={item.awayTeam.name}
                              shortCode={item.awayTeam.shortCode}
                              primaryColor={item.awayTeam.primaryColor}
                              secondaryColor={item.awayTeam.secondaryColor}
                              logoUrl={item.awayTeam.logoUrl}
                              size="sm"
                            />
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {item.awayTeam.name}
                            </span>
                          </div>
                          {shownScore && (
                            <span
                              className={`font-mono text-base font-bold tabular-nums shrink-0 min-w-[30px] text-center px-2 py-0.5 rounded-lg ${
                                isLive
                                  ? 'bg-rose-100/80 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                                  : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                              }`}
                            >
                              {shownScore.awayGoals}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        <span>
                          {item.predictedHomePct}% · {item.predictedDrawPct}% ·{' '}
                          {item.predictedAwayPct}% · Placar {item.mostLikelyScore}
                        </span>
                        {livePartialMatches !== null && (
                          <span
                            className={`font-sans text-[11px] font-semibold ${
                              livePartialMatches
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {livePartialMatches
                              ? 'Parcial: favorável'
                              : 'Parcial: divergindo'}
                          </span>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                            <span className="font-mono font-semibold">
                              {item.homeTeam.shortCode}
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={20}
                              value={homeInput}
                              onChange={(e) => setHomeInput(e.target.value)}
                              className="w-16 min-h-[44px] px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-center font-mono font-semibold text-slate-900 dark:text-slate-100"
                            />
                          </label>
                          <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                            x
                          </span>
                          <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                            <input
                              type="number"
                              min={0}
                              max={20}
                              value={awayInput}
                              onChange={(e) => setAwayInput(e.target.value)}
                              className="w-16 min-h-[44px] px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-center font-mono font-semibold text-slate-900 dark:text-slate-100"
                            />
                            <span className="font-mono font-semibold">
                              {item.awayTeam.shortCode}
                            </span>
                          </label>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto justify-end">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="min-h-[44px] px-3 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => submitScore(item.id)}
                            className="min-h-[44px] px-4 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white"
                          >
                            Confirmar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Edit3 className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {hasResult ? 'Editar placar' : 'Registrar placar real'}
                            </span>
                          </button>

                          {item.snapshot && (
                            <button
                              type="button"
                              onClick={() => onLoadSnapshot(item)}
                              className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/80 dark:border-emerald-800 whitespace-nowrap"
                            >
                              Abrir análise
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => onDeleteItem(item.id)}
                          aria-label="Excluir previsão"
                          className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
