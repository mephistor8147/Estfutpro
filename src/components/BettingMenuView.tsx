import React, { useMemo, useState } from 'react';
import {
  Activity,
  BookmarkCheck,
  Clock,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
  Trash2,
  X,
} from 'lucide-react';
import type {
  BettingMarketKey,
  DailyBetOddsMatch,
  DailyBetsResponse,
  MultipleHistoryLeg,
} from '../types/football.ts';
import { MiniPitch } from './MiniPitch.tsx';

export interface BetSlipSelection {
  match: DailyBetOddsMatch;
  marketKey: BettingMarketKey;
  marketLabel: string;
  odd: number;
  probabilityPct: number;
}

interface BettingMenuViewProps {
  data: DailyBetsResponse | null;
  loading: boolean;
  error: string | null;
  oddsMarginPct: number;
  minTipProbabilityPct: number;
  onRefresh: () => void;
  onAnalyzeMatch: (match: DailyBetOddsMatch) => void;
  onSaveBetSlip: (payload: {
    selections: BetSlipSelection[];
    stake: number;
    totalOdd: number;
    potentialReturn: number;
    combinedProbabilityPct: number;
  }) => void;
}

const TeamAvatar: React.FC<{
  name: string;
  shortCode: string;
  logoUrl?: string;
  color: string;
}> = ({ name, shortCode, logoUrl, color }) => {
  const [failed, setFailed] = useState(false);
  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={name}
        onError={() => setFailed(true)}
        className="w-7 h-7 object-contain shrink-0"
      />
    );
  }
  return (
    <span
      className="w-7 h-7 rounded-lg text-[10px] font-bold text-white flex items-center justify-center shrink-0"
      style={{ backgroundColor: color || '#0F766E' }}
    >
      {shortCode.slice(0, 3)}
    </span>
  );
};

export const BettingMenuView: React.FC<BettingMenuViewProps> = ({
  data,
  loading,
  error,
  oddsMarginPct,
  minTipProbabilityPct,
  onRefresh,
  onAnalyzeMatch,
  onSaveBetSlip,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'pre'>('all');
  const [selections, setSelections] = useState<BetSlipSelection[]>([]);
  const [stakeInput, setStakeInput] = useState('25');
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [isMobileSlipOpen, setIsMobileSlipOpen] = useState(false);

  const matches = data?.matches ?? [];

  const leagues = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of matches) {
      if (!map.has(m.leagueSlug)) {
        map.set(m.leagueSlug, m.competition);
      }
    }
    return Array.from(map.entries()).map(([slug, label]) => ({ slug, label }));
  }, [matches]);

  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return matches.filter((m) => {
      if (selectedLeague !== 'all' && m.leagueSlug !== selectedLeague) return false;
      if (statusFilter === 'live' && m.state !== 'in') return false;
      if (statusFilter === 'pre' && m.state !== 'pre') return false;
      if (!q) return true;
      return (
        m.homeTeam.toLowerCase().includes(q) ||
        m.awayTeam.toLowerCase().includes(q) ||
        m.competition.toLowerCase().includes(q)
      );
    });
  }, [matches, searchQuery, selectedLeague, statusFilter]);

  const liveCount = matches.filter((m) => m.state === 'in').length;

  const toggleSelection = (
    match: DailyBetOddsMatch,
    marketKey: BettingMarketKey,
    marketLabel: string,
    odd: number,
    probabilityPct: number
  ) => {
    setSavedFeedback(false);
    setSelections((prev) => {
      const existingIdx = prev.findIndex((s) => s.match.eventId === match.eventId);
      if (existingIdx >= 0) {
        const current = prev[existingIdx];
        if (current.marketKey === marketKey) {
          return prev.filter((_, idx) => idx !== existingIdx);
        }
        const next = [...prev];
        next[existingIdx] = {
          match,
          marketKey,
          marketLabel,
          odd,
          probabilityPct,
        };
        return next;
      }
      if (prev.length >= 15) return prev;
      return [...prev, { match, marketKey, marketLabel, odd, probabilityPct }];
    });
  };

  const stakeValue = Math.max(0, Number(stakeInput.replace(',', '.')) || 0);
  const totalOdd = useMemo(() => {
    if (selections.length === 0) return 1;
    const raw = selections.reduce((acc, s) => acc * s.odd, 1);
    return Number(raw.toFixed(2));
  }, [selections]);

  const combinedProbabilityPct = useMemo(() => {
    if (selections.length === 0) return 0;
    const product = selections.reduce((acc, s) => acc * (s.probabilityPct / 100), 1);
    const pct = product * 100;
    return pct >= 1 ? Math.round(pct) : Number(pct.toFixed(1));
  }, [selections]);

  const potentialReturn = Number((stakeValue * totalOdd).toFixed(2));

  const handleSaveSlip = () => {
    if (selections.length === 0) return;
    onSaveBetSlip({
      selections,
      stake: stakeValue,
      totalOdd,
      potentialReturn,
      combinedProbabilityPct,
    });
    setSelections([]);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 4000);
  };

  const getSelectionForMatch = (eventId: string) =>
    selections.find((s) => s.match.eventId === eventId);

  const buildLegsCountPreview = (list: BetSlipSelection[]): MultipleHistoryLeg[] =>
    list.map((s) => ({
      eventId: s.match.eventId,
      leagueSlug: s.match.leagueSlug,
      homeTeam: s.match.homeTeam,
      awayTeam: s.match.awayTeam,
      homeShortCode: s.match.homeShortCode,
      awayShortCode: s.match.awayShortCode,
      homeLogoUrl: s.match.homeLogoUrl,
      awayLogoUrl: s.match.awayLogoUrl,
      homeColor: s.match.homeColor,
      awayColor: s.match.awayColor,
      competition: s.match.competition,
      dateLabel: s.match.dateLabel,
      marketLabel: s.marketLabel,
      probabilityPct: s.probabilityPct,
      expectedGoalsHome: s.match.expectedGoalsHome,
      expectedGoalsAway: s.match.expectedGoalsAway,
      rationale: `Odd calibrada @${s.odd.toFixed(2)} (${s.probabilityPct}%)`,
      odd: s.odd,
      status: 'pending',
    }));

  const previewLegsCount = buildLegsCountPreview(selections).length;

  return (
    <div className="space-y-4">
      {/* Cabeçalho e Filtros */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
                Menu de apostas · Jogos de hoje
              </h2>
              {liveCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                  <Activity className="w-3.5 h-3.5" />
                  {liveCount} ao vivo
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
              {data?.dateLabel || 'Programação oficial de hoje'} · Odds calibradas em tempo real (margem {oddsMarginPct}%)
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Atualizando odds...' : 'Atualizar jogos de hoje'}</span>
          </button>
        </div>

        {/* Barra de filtros */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar time ou campeonato..."
              className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="all">Todas as ligas ({matches.length})</option>
              {leagues.map((lg) => (
                <option key={lg.slug} value={lg.slug}>
                  {lg.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3 grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'live', label: 'Ao vivo' },
                { id: 'pre', label: 'Hoje' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`min-h-[36px] rounded-lg text-[11px] font-semibold transition-colors ${
                  statusFilter === st.id
                    ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/50 p-3.5 text-xs text-rose-800 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* Grade principal: Lista de Jogos + Boletim Lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Lista de jogos do dia atual */}
        <div className="lg:col-span-8 space-y-3">
          {loading && matches.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 animate-pulse h-44"
                />
              ))}
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-8 text-center">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Nenhum jogo disponível encontrado para hoje com estes filtros.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Tente limpar a busca ou atualizar a lista oficial de jogos.
              </p>
            </div>
          ) : (
            filteredMatches.map((match) => {
              const selected = getSelectionForMatch(match.eventId);
              const isHighConf = match.recommendedProbPct >= minTipProbabilityPct;

              const oddButtons: {
                key: BettingMarketKey;
                short: string;
                label: string;
                odd: number;
                prob: number;
              }[] = [
                {
                  key: 'home',
                  short: 'Casa (1)',
                  label: `Vitória ${match.homeTeam}`,
                  odd: match.odds.home,
                  prob: match.probabilities.homeWinPct,
                },
                {
                  key: 'draw',
                  short: 'Empate (X)',
                  label: 'Empate',
                  odd: match.odds.draw,
                  prob: match.probabilities.drawPct,
                },
                {
                  key: 'away',
                  short: 'Fora (2)',
                  label: `Vitória ${match.awayTeam}`,
                  odd: match.odds.away,
                  prob: match.probabilities.awayWinPct,
                },
                {
                  key: 'over25',
                  short: '+2,5 Gols',
                  label: 'Mais de 2,5 gols',
                  odd: match.odds.over25,
                  prob: match.probabilities.over25Pct,
                },
                {
                  key: 'btts',
                  short: 'Ambas',
                  label: 'Ambas marcam: Sim',
                  odd: match.odds.btts,
                  prob: match.probabilities.bttsPct,
                },
              ];

              return (
                <article
                  key={match.eventId}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                >
                  {/* Barra superior: Campeonato + Horário / Ao vivo */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                      {match.competition}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {isHighConf && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <Sparkles className="w-3 h-3" />
                          Destaque {match.recommendedProbPct}%
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-mono font-bold tabular-nums ${
                          match.state === 'in'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        {match.dateLabel}
                      </span>
                    </div>
                  </div>

                  {/* Times + Mini Campo */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-7 space-y-2 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <TeamAvatar
                            name={match.homeTeam}
                            shortCode={match.homeShortCode}
                            logoUrl={match.homeLogoUrl}
                            color={match.homeColor}
                          />
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {match.homeTeam}
                          </span>
                        </div>
                        {match.state === 'in' && match.homeScore !== undefined && (
                          <span className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                            {match.homeScore}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <TeamAvatar
                            name={match.awayTeam}
                            shortCode={match.awayShortCode}
                            logoUrl={match.awayLogoUrl}
                            color={match.awayColor}
                          />
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {match.awayTeam}
                          </span>
                        </div>
                        {match.state === 'in' && match.awayScore !== undefined && (
                          <span className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                            {match.awayScore}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="min-w-0">
                          Sugestão:{' '}
                          <strong className="text-slate-800 dark:text-slate-200">
                            {match.recommendedMarket}
                          </strong>{' '}
                          (@{match.recommendedOdd.toFixed(2)})
                        </span>
                        <button
                          type="button"
                          onClick={() => onAnalyzeMatch(match)}
                          className="min-h-[40px] sm:min-h-[34px] px-2.5 py-1 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 sm:bg-transparent text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
                        >
                          Analisar confronto →
                        </button>
                      </div>
                    </div>

                    <div className="sm:col-span-5">
                      <MiniPitch
                        variant="compact"
                        homeTeam={{
                          name: match.homeTeam,
                          shortCode: match.homeShortCode,
                          primaryColor: match.homeColor,
                        }}
                        awayTeam={{
                          name: match.awayTeam,
                          shortCode: match.awayShortCode,
                          primaryColor: match.awayColor,
                        }}
                        expectedGoalsHome={match.expectedGoalsHome}
                        expectedGoalsAway={match.expectedGoalsAway}
                      />
                    </div>
                  </div>

                  {/* Grade de Odds clicáveis: 3+2 equilibrado no celular e 5 colunas no sm+ */}
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-6 sm:grid-cols-5 gap-2">
                    {oddButtons.map((opt, idx) => {
                      const isActive = selected?.marketKey === opt.key;
                      const spanClass =
                        idx < 3
                          ? 'col-span-2 sm:col-span-1'
                          : 'col-span-3 sm:col-span-1';
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() =>
                            toggleSelection(
                              match,
                              opt.key,
                              opt.label,
                              opt.odd,
                              opt.prob
                            )
                          }
                          className={`${spanClass} min-h-[48px] px-2 sm:px-2.5 py-1.5 rounded-xl border text-left transition-colors flex flex-col justify-between ${
                            isActive
                              ? 'bg-emerald-700 dark:bg-emerald-600 border-emerald-700 dark:border-emerald-500 text-white'
                              : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-700 hover:border-emerald-500/60 text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          <span
                            className={`text-[10px] font-semibold truncate w-full ${
                              isActive
                                ? 'text-emerald-100'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {opt.short}
                          </span>
                          <div className="flex items-baseline justify-between gap-1 mt-0.5 w-full">
                            <span className="font-mono text-sm font-bold tabular-nums">
                              {opt.odd.toFixed(2)}
                            </span>
                            <span
                              className={`text-[10px] font-mono tabular-nums ${
                                isActive
                                  ? 'text-emerald-100'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {opt.prob}%
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Boletim de Apostas (Desktop Sticky Sidebar & Inline Mobile Fallback) */}
        <aside className="lg:col-span-4 lg:sticky lg:top-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Ticket className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                Boletim rápido
              </h3>
            </div>
            <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
              {previewLegsCount} {previewLegsCount === 1 ? 'seleção' : 'seleções'}
            </span>
          </div>

          {savedFeedback && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <BookmarkCheck className="w-4 h-4 shrink-0" />
              <span>Bilhete salvo no seu Histórico!</span>
            </div>
          )}

          {selections.length === 0 ? (
            <div className="py-6 text-center space-y-1.5">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Toque em qualquer odd nos jogos para montar seu bilhete simples ou múltiplo.
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                As odds combinadas e o retorno potencial são calculados na hora.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {selections.map((s) => (
                  <div
                    key={s.match.eventId}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                        {s.match.homeShortCode} × {s.match.awayShortCode} · {s.match.dateLabel}
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                        {s.marketLabel}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        @{s.odd.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelections((prev) =>
                            prev.filter((item) => item.match.eventId !== s.match.eventId)
                          )
                        }
                        aria-label="Remover seleção"
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Probabilidade estimada
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                    {combinedProbabilityPct}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Odd combinada total
                  </span>
                  <span className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    @{totalOdd.toFixed(2)}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Valor simulado / aposta (R$)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={5}
                    value={stakeInput}
                    onChange={(e) => setStakeInput(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60">
                  <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                    Retorno potencial
                  </span>
                  <span className="font-mono text-base font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">
                    R$ {potentialReturn.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleSaveSlip();
                      setIsMobileSlipOpen(false);
                    }}
                    className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <BookmarkCheck className="w-4 h-4 shrink-0" />
                    <span>Salvar no Histórico</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelections([])}
                    className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Mobile Floating Boletim Trigger when selections > 0 */}
      {selections.length > 0 && !isMobileSlipOpen && (
        <div className="lg:hidden fixed bottom-[calc(64px+env(safe-area-inset-bottom))] left-3 right-3 z-30">
          <button
            type="button"
            onClick={() => setIsMobileSlipOpen(true)}
            className="w-full min-h-[48px] px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white shadow-lg flex items-center justify-between gap-2 text-xs font-semibold"
          >
            <span className="inline-flex items-center gap-2 truncate">
              <Ticket className="w-4 h-4 shrink-0" />
              <span>
                Boletim ({previewLegsCount}{' '}
                {previewLegsCount === 1 ? 'seleção' : 'seleções'})
              </span>
            </span>
            <span className="font-mono font-bold tabular-nums shrink-0">
              @{totalOdd.toFixed(2)} · Ver cupom
            </span>
          </button>
        </div>
      )}

      {/* Mobile Boletim Bottom Sheet */}
      {isMobileSlipOpen && selections.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Boletim rápido móvel"
          className="lg:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMobileSlipOpen(false);
          }}
        >
          <div className="w-full max-h-[85vh] bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            <div className="pt-2.5 pb-1 flex justify-center shrink-0">
              <span className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  Boletim rápido ({previewLegsCount})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileSlipOpen(false)}
                aria-label="Fechar boletim"
                className="min-h-[44px] min-w-[44px] rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="space-y-2">
                {selections.map((s) => (
                  <div
                    key={s.match.eventId}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                        {s.match.homeShortCode} × {s.match.awayShortCode} · {s.match.dateLabel}
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                        {s.marketLabel}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        @{s.odd.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelections((prev) =>
                            prev.filter((item) => item.match.eventId !== s.match.eventId)
                          )
                        }
                        aria-label="Remover seleção"
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Probabilidade estimada</span>
                  <span className="font-mono font-bold tabular-nums">{combinedProbabilityPct}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Odd combinada total</span>
                  <span className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    @{totalOdd.toFixed(2)}
                  </span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Valor simulado / aposta (R$)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={5}
                    value={stakeInput}
                    onChange={(e) => setStakeInput(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60">
                  <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                    Retorno potencial
                  </span>
                  <span className="font-mono text-base font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">
                    R$ {potentialReturn.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleSaveSlip();
                      setIsMobileSlipOpen(false);
                    }}
                    className="flex-1 min-h-[48px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                  >
                    <BookmarkCheck className="w-4 h-4 shrink-0" />
                    <span>Salvar no Histórico</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelections([]);
                      setIsMobileSlipOpen(false);
                    }}
                    className="min-h-[48px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
