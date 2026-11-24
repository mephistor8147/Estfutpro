import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  Download,
  Flame,
  Layers,
  Loader2,
  RefreshCw,
  Share2,
  ShieldCheck,
  Target,
  X,
} from 'lucide-react';
import { CompetitionFlag } from './CompetitionFlag.tsx';
import { MiniPitch } from './MiniPitch.tsx';
import { TeamCrest } from './TeamCrest.tsx';
import {
  buildSuperCombinedWhatsappText,
  generateSuperCombinedTipPng,
  type SuperCombinedImagePayload,
} from '../lib/shareMultipleImage.ts';
import type {
  SuperCombinedLeg,
  SuperCombinedTip,
  SuperSameGameCombo,
  SuperTipMarketCategory,
} from '../types/football.ts';

export type SuperTipViewMode = 'multi' | 'same-game';

export interface SaveSuperCombinedPayload {
  mode: SuperTipViewMode;
  signature: string;
  title: string;
  leagueSlug: string;
  legs: SuperCombinedLeg[];
  combinedProbabilityPct: number;
  fairOddEstimate: number;
  isTodaySlate: boolean;
}

interface SuperCombinedTipCardProps {
  tip: SuperCombinedTip | null;
  isLoading: boolean;
  error: string | null;
  savedSignatures: Set<string>;
  onRefresh: () => void;
  onOpenTipsMenu: () => void;
  onOpenHistory: () => void;
  onSelectLeg: (leg: SuperCombinedLeg) => void;
  onSaveToHistory: (payload: SaveSuperCombinedPayload) => void;
}

function getCategoryAccentClass(category: SuperTipMarketCategory): string {
  switch (category) {
    case 'result':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'goals':
      return 'text-blue-700 dark:text-blue-400';
    case 'btts':
      return 'text-violet-700 dark:text-violet-400';
    case 'cards':
      return 'text-amber-700 dark:text-amber-400';
    case 'corners':
      return 'text-cyan-700 dark:text-cyan-400';
  }
}

function getBarFillClass(category: SuperTipMarketCategory): string {
  switch (category) {
    case 'result':
      return 'fill-emerald-600 dark:fill-emerald-400';
    case 'goals':
      return 'fill-blue-600 dark:fill-blue-400';
    case 'btts':
      return 'fill-violet-600 dark:fill-violet-400';
    case 'cards':
      return 'fill-amber-500 dark:fill-amber-400';
    case 'corners':
      return 'fill-cyan-600 dark:fill-cyan-400';
  }
}

const MarginBar: React.FC<{
  pct: number;
  category: SuperTipMarketCategory;
}> = ({ pct, category }) => {
  const clamped = Math.max(4, Math.min(100, Math.round(pct)));
  return (
    <svg
      viewBox="0 0 100 4"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="w-full h-1.5 rounded-full overflow-hidden bg-slate-200/80 dark:bg-slate-800"
    >
      <rect
        x="0"
        y="0"
        width={clamped}
        height="4"
        rx="2"
        className={getBarFillClass(category)}
      />
    </svg>
  );
};

export const SuperCombinedTipCard: React.FC<SuperCombinedTipCardProps> = ({
  tip,
  isLoading,
  error,
  savedSignatures,
  onRefresh,
  onOpenTipsMenu,
  onOpenHistory,
  onSelectLeg,
  onSaveToHistory,
}) => {
  const [viewMode, setViewMode] = useState<SuperTipViewMode>('multi');
  const [selectedMatchIdx, setSelectedMatchIdx] = useState(0);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState<{
    dataUrl: string;
    fileName: string;
  } | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  const safeMatchIdx = useMemo(() => {
    if (!tip || tip.sameGameCombos.length === 0) return 0;
    return Math.min(selectedMatchIdx, tip.sameGameCombos.length - 1);
  }, [tip, selectedMatchIdx]);

  const activeSameGame: SuperSameGameCombo | null =
    tip?.sameGameCombos?.[safeMatchIdx] ?? null;

  useEffect(() => {
    setGeneratedPreview(null);
    setShareFeedback(null);
    setCopiedText(false);
  }, [tip, viewMode, safeMatchIdx]);

  const updatedTime = tip?.updatedAt
    ? new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(tip.updatedAt))
    : null;

  const activePayload = useMemo<SaveSuperCombinedPayload | null>(() => {
    if (!tip) return null;
    if (viewMode === 'same-game' && activeSameGame) {
      const signature = `super-sg::${activeSameGame.homeTeam}|${activeSameGame.awayTeam}|${activeSameGame.picks
        .map((p) => p.marketLabel)
        .join('|')}`;
      return {
        mode: 'same-game',
        signature,
        title: `Super Combinada · ${activeSameGame.homeTeam} × ${activeSameGame.awayTeam}`,
        leagueSlug: activeSameGame.leagueSlug,
        legs: activeSameGame.picks,
        combinedProbabilityPct: activeSameGame.combinedProbabilityPct,
        fairOddEstimate: activeSameGame.fairOddEstimate,
        isTodaySlate: tip.isTodaySlate,
      };
    }

    if (tip.multiMatchLegs.length === 0) return null;
    const signature = `super-multi::${tip.multiMatchLegs
      .map((l) => `${l.homeTeam}|${l.awayTeam}|${l.marketLabel}`)
      .join('||')}`;
    return {
      mode: 'multi',
      signature,
      title: `Super Dica Combinada (${tip.multiMatchLegs.length} mercados)`,
      leagueSlug: 'world',
      legs: tip.multiMatchLegs,
      combinedProbabilityPct: tip.multiMatchCombinedPct,
      fairOddEstimate: tip.multiMatchFairOdd,
      isTodaySlate: tip.isTodaySlate,
    };
  }, [tip, viewMode, activeSameGame]);

  const isCurrentSaved = activePayload
    ? savedSignatures.has(activePayload.signature)
    : false;

  const summaryStats = useMemo(() => {
    if (!tip) return null;
    if (viewMode === 'same-game' && activeSameGame) {
      return {
        combinedPct: activeSameGame.combinedProbabilityPct,
        avgPct: activeSameGame.avgLegProbabilityPct,
        fairOdd: activeSameGame.fairOddEstimate,
        count: activeSameGame.picks.length,
        marketsLabel: `${activeSameGame.picks.length} mercados no jogo`,
      };
    }
    return {
      combinedPct: tip.multiMatchCombinedPct,
      avgPct: tip.multiMatchAvgPct,
      fairOdd: tip.multiMatchFairOdd,
      count: tip.multiMatchLegs.length,
      marketsLabel: `${tip.multiMatchLegs.length} mercados combinados`,
    };
  }, [tip, viewMode, activeSameGame]);

  const hasSameGame = Boolean(tip && tip.sameGameCombos.length > 0);
  const hasMulti = Boolean(tip && tip.multiMatchLegs.length > 0);
  const effectiveMode: SuperTipViewMode =
    viewMode === 'same-game' && !hasSameGame && hasMulti ? 'multi' : viewMode;

  const shareImagePayload = useMemo<SuperCombinedImagePayload | null>(() => {
    if (!tip) return null;
    if (effectiveMode === 'same-game' && activeSameGame) {
      return {
        mode: 'same-game',
        scopeLabel: tip.scopeLabel,
        updatedAt: tip.updatedAt,
        legs: activeSameGame.picks,
        sameGame: activeSameGame,
        combinedProbabilityPct: activeSameGame.combinedProbabilityPct,
        avgProbabilityPct: activeSameGame.avgLegProbabilityPct,
        fairOddEstimate: activeSameGame.fairOddEstimate,
      };
    }
    if (tip.multiMatchLegs.length === 0) return null;
    return {
      mode: 'multi',
      scopeLabel: tip.scopeLabel,
      updatedAt: tip.updatedAt,
      legs: tip.multiMatchLegs,
      sameGame: null,
      combinedProbabilityPct: tip.multiMatchCombinedPct,
      avgProbabilityPct: tip.multiMatchAvgPct,
      fairOddEstimate: tip.multiMatchFairOdd,
    };
  }, [tip, effectiveMode, activeSameGame]);

  const whatsappHref = useMemo(() => {
    if (!shareImagePayload) return '#';
    const text = buildSuperCombinedWhatsappText(shareImagePayload);
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }, [shareImagePayload]);

  const triggerPngDownload = (dataUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShareWhatsapp = async () => {
    if (!shareImagePayload) return;
    setIsGeneratingImage(true);
    setShareFeedback(null);
    try {
      const { blob, dataUrl, fileName } = await generateSuperCombinedTipPng(
        shareImagePayload
      );
      setGeneratedPreview({ dataUrl, fileName });

      const summaryText = buildSuperCombinedWhatsappText(shareImagePayload);
      const imageFile = new File([blob], fileName, { type: 'image/png' });

      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [imageFile] })
      ) {
        try {
          await navigator.share({
            title: 'Super Dica Combinada · CampoStats',
            text: summaryText,
            files: [imageFile],
          });
          setShareFeedback('Imagem pronta e compartilhada no WhatsApp.');
          return;
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') {
            return;
          }
          // Fall through to PNG download + WhatsApp link fallback
        }
      }

      triggerPngDownload(dataUrl, fileName);
      setShareFeedback(
        'Imagem PNG baixada! Anexe a imagem no WhatsApp ou abra o envio com o resumo abaixo.'
      );
    } catch {
      setShareFeedback('Não foi possível gerar a imagem para compartilhamento agora.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleCopyWhatsappText = async () => {
    if (!shareImagePayload || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(
        buildSuperCombinedWhatsappText(shareImagePayload)
      );
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <section
      aria-label="Super dica combinada"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs mb-5 overflow-hidden"
    >
      {/* Header Row */}
      <div className="p-4 sm:p-5 pb-3.5 sm:pb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-none text-balance">
              Super dica combinada
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 tabular-nums flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span>
              {tip?.scopeLabel ||
                'Melhor margem entre gols +/-, ambas marcam, cartões e resultado'}
            </span>
            {updatedTime && (
              <>
                <span aria-hidden="true">·</span>
                <span>Atualizado {updatedTime}</span>
              </>
            )}
          </p>
        </div>

        {/* Interactive Mode Switcher & Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0 w-full lg:w-auto">
          {hasSameGame && hasMulti && (
            <div
              role="tablist"
              aria-label="Formato da super dica combinada"
              className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 w-full sm:w-auto"
            >
              <button
                type="button"
                role="tab"
                aria-selected={effectiveMode === 'multi'}
                onClick={() => setViewMode('multi')}
                className={`flex-1 sm:flex-initial min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  effectiveMode === 'multi'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>Multi-jogos</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={effectiveMode === 'same-game'}
                onClick={() => setViewMode('same-game')}
                className={`flex-1 sm:flex-initial min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  effectiveMode === 'same-game'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Target className="w-3.5 h-3.5 shrink-0" />
                <span>Mesmo jogo</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 shrink-0 ${isLoading ? 'animate-spin' : ''}`}
            />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && !tip ? (
        <div className="px-4 sm:px-5 pb-5 space-y-3">
          <div className="py-3 border-y border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-6 w-16 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 space-y-2.5"
              >
                <div className="h-3 w-40 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-4 w-52 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-5 w-44 rounded bg-emerald-200/60 dark:bg-emerald-900/40" />
                <div className="h-1.5 w-full rounded bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        </div>
      ) : error || !tip || (!hasMulti && !hasSameGame) ? (
        <div className="px-4 sm:px-5 pb-5">
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              {error ||
                'Nenhum confronto futuro qualificado disponível na base esportiva neste momento.'}
            </p>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onRefresh}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>Tentar novamente</span>
              </button>
              <button
                type="button"
                onClick={onOpenTipsMenu}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Flame className="w-3.5 h-3.5 shrink-0" />
                <span>Abrir Dicas quentes</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Clean Hairline KPI Summary Strip (Single Elevation, Zero Pills) */}
          {summaryStats && (
            <div className="px-4 sm:px-5 py-3 border-y border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2.5">
              <div className="min-w-0">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Margem combinada
                </div>
                <div className="mt-0.5 font-mono tabular-nums text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400 leading-tight">
                  {summaryStats.combinedPct}%
                </div>
              </div>

              <div className="min-w-0">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Média de acerto / mercado
                </div>
                <div className="mt-0.5 font-mono tabular-nums text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  {summaryStats.avgPct}%
                </div>
              </div>

              <div className="min-w-0">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Odd justa estimada
                </div>
                <div className="mt-0.5 font-mono tabular-nums text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  {summaryStats.fairOdd.toFixed(2)}x
                </div>
              </div>

              <div className="min-w-0">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Composição
                </div>
                <div className="mt-0.5 text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200 leading-tight pt-0.5 truncate">
                  {summaryStats.marketsLabel}
                </div>
              </div>
            </div>
          )}

          {/* MODE 1: MULTI-MATCH SUPER COMBINADA */}
          {effectiveMode === 'multi' && (
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {tip.multiMatchLegs.map((leg, idx) => (
                  <article
                    key={`${leg.eventId || idx}-${leg.category}-${leg.marketLabel}`}
                    className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5 sm:p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2.5">
                      {/* Unboxed Metadata Line */}
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
                        <span
                          className={`font-semibold ${getCategoryAccentClass(leg.category)}`}
                        >
                          {leg.categoryLabel}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 min-w-0">
                          <CompetitionFlag
                            leagueSlug={leg.leagueSlug}
                            competition={leg.competition}
                            size="sm"
                          />
                          <span className="truncate">
                            {leg.competition} · {leg.dateLabel}
                          </span>
                        </span>
                      </div>

                      {/* Mini Campo */}
                      <MiniPitch
                        variant="compact"
                        homeTeam={{
                          name: leg.homeTeam,
                          shortCode: leg.homeShortCode,
                          primaryColor: leg.homeColor,
                          logoUrl: leg.homeLogoUrl,
                        }}
                        awayTeam={{
                          name: leg.awayTeam,
                          shortCode: leg.awayShortCode,
                          primaryColor: leg.awayColor,
                          logoUrl: leg.awayLogoUrl,
                        }}
                        expectedGoalsHome={leg.expectedGoalsHome}
                        expectedGoalsAway={leg.expectedGoalsAway}
                      />

                      {/* Teams Matchup with Official Crests */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                        <span className="inline-flex items-center gap-1.5 min-w-0">
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
                        </span>
                        <span className="text-xs text-slate-400 font-medium">×</span>
                        <span className="inline-flex items-center gap-1.5 min-w-0">
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
                        </span>
                      </div>

                      {/* Market Pick + Hit Margin Bar */}
                      <div className="space-y-1.5 pt-0.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                            {leg.marketLabel}
                          </span>
                          <span className="font-mono tabular-nums text-sm font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                            {leg.probabilityPct}%{' '}
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              @{leg.fairOdd.toFixed(2)}
                            </span>
                          </span>
                        </div>
                        <MarginBar pct={leg.probabilityPct} category={leg.category} />
                      </div>

                      {/* Grounded Evidence */}
                      <div className="space-y-1">
                        <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {leg.statHighlight}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                          {leg.rationale}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        xG {leg.expectedGoalsHome.toFixed(1)}–{leg.expectedGoalsAway.toFixed(1)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectLeg(leg)}
                        className="min-h-[44px] px-3 py-1 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                      >
                        <span>Analisar jogo</span>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* MODE 2: SAME-GAME BET BUILDER ("CRIAR APOSTA" — EXACT JOINT POISSON) */}
          {effectiveMode === 'same-game' && activeSameGame && (
            <div className="p-4 sm:p-5 space-y-4">
              {/* Top-3 Match Selector */}
              {tip.sameGameCombos.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                  {tip.sameGameCombos.map((combo, idx) => {
                    const active = idx === safeMatchIdx;
                    return (
                      <button
                        key={combo.eventId}
                        type="button"
                        onClick={() => setSelectedMatchIdx(idx)}
                        className={`min-h-[44px] px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <TeamCrest
                          name={combo.homeTeam}
                          shortCode={combo.homeShortCode}
                          primaryColor={combo.homeColor || '#0F766E'}
                          secondaryColor="#FFFFFF"
                          logoUrl={combo.homeLogoUrl}
                          size="xs"
                        />
                        <span>
                          {combo.homeShortCode} × {combo.awayShortCode}
                        </span>
                        <span
                          className={`font-mono tabular-nums ${
                            active
                              ? 'text-emerald-300 dark:text-emerald-700'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {combo.combinedProbabilityPct}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Featured Match Header */}
              <div className="pb-3.5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <CompetitionFlag
                      leagueSlug={activeSameGame.leagueSlug}
                      competition={activeSameGame.competition}
                      size="sm"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {activeSameGame.competition}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{activeSameGame.dateLabel}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2">
                      <TeamCrest
                        name={activeSameGame.homeTeam}
                        shortCode={activeSameGame.homeShortCode}
                        primaryColor={activeSameGame.homeColor || '#0F766E'}
                        secondaryColor="#FFFFFF"
                        logoUrl={activeSameGame.homeLogoUrl}
                        size="sm"
                      />
                      <span className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                        {activeSameGame.homeTeam}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-slate-400">×</span>
                    <span className="inline-flex items-center gap-2">
                      <TeamCrest
                        name={activeSameGame.awayTeam}
                        shortCode={activeSameGame.awayShortCode}
                        primaryColor={activeSameGame.awayColor || '#1D4ED8'}
                        secondaryColor="#FFFFFF"
                        logoUrl={activeSameGame.awayLogoUrl}
                        size="sm"
                      />
                      <span className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                        {activeSameGame.awayTeam}
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    <span>
                      Casa {activeSameGame.homeWinPct}% · Empate {activeSameGame.drawPct}% · Fora{' '}
                      {activeSameGame.awayWinPct}%
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      xG {activeSameGame.expectedGoalsHome.toFixed(1)}–
                      {activeSameGame.expectedGoalsAway.toFixed(1)}
                    </span>
                    {activeSameGame.expectedCardsTotal !== null && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          Cartões est.{' '}
                          {activeSameGame.expectedCardsTotal.toFixed(1).replace('.', ',')}
                        </span>
                      </>
                    )}
                    {activeSameGame.expectedCornersTotal !== null && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          Escanteios est.{' '}
                          {activeSameGame.expectedCornersTotal.toFixed(1).replace('.', ',')}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {activeSameGame.picks[0] && (
                  <button
                    type="button"
                    onClick={() => onSelectLeg(activeSameGame.picks[0])}
                    className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <span>Analisar confronto</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                )}
              </div>

              {/* Hero Mini Campo for Featured Match */}
              <MiniPitch
                variant="hero"
                homeTeam={{
                  name: activeSameGame.homeTeam,
                  shortCode: activeSameGame.homeShortCode,
                  primaryColor: activeSameGame.homeColor,
                  logoUrl: activeSameGame.homeLogoUrl,
                }}
                awayTeam={{
                  name: activeSameGame.awayTeam,
                  shortCode: activeSameGame.awayShortCode,
                  primaryColor: activeSameGame.awayColor,
                  logoUrl: activeSameGame.awayLogoUrl,
                }}
                expectedGoalsHome={activeSameGame.expectedGoalsHome}
                expectedGoalsAway={activeSameGame.expectedGoalsAway}
                homeWinPct={activeSameGame.homeWinPct}
                drawPct={activeSameGame.drawPct}
                awayWinPct={activeSameGame.awayWinPct}
                expectedCardsTotal={activeSameGame.expectedCardsTotal}
                expectedCornersTotal={activeSameGame.expectedCornersTotal}
                centerLabel={`λ ${activeSameGame.expectedGoalsHome.toFixed(1)} : ${activeSameGame.expectedGoalsAway.toFixed(1)}`}
              />

              {/* Clean Hairline-Separated Same-Game Selections */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/90">
                {activeSameGame.picks.map((pick, idx) => (
                  <div
                    key={`${pick.category}-${pick.marketLabel}-${idx}`}
                    className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        <span
                          className={`font-semibold ${getCategoryAccentClass(pick.category)}`}
                        >
                          {pick.categoryLabel}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                          ·
                        </span>
                        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {pick.statHighlight}
                        </span>
                      </div>
                      <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        {pick.marketLabel}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {pick.rationale}
                      </p>
                    </div>

                    <div className="sm:w-36 shrink-0 space-y-1">
                      <div className="flex items-baseline justify-between sm:justify-end gap-2 font-mono tabular-nums">
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                          {pick.probabilityPct}%
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          @{pick.fairOdd.toFixed(2)}
                        </span>
                      </div>
                      <MarginBar pct={pick.probabilityPct} category={pick.category} />
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeSameGame.summary}
              </p>
            </div>
          )}

          {/* Footer Action Bar (Always-Visible Responsive Buttons) */}
          <div className="px-4 sm:px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="grid grid-cols-1 min-[440px]:grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
                {shareImagePayload && (
                  <button
                    type="button"
                    onClick={handleShareWhatsapp}
                    disabled={isGeneratingImage}
                    className="min-[440px]:col-span-2 sm:col-span-1 w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors text-center shrink-0 disabled:opacity-60"
                  >
                    {isGeneratingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    ) : (
                      <Share2 className="w-4 h-4 shrink-0" />
                    )}
                    <span>Compartilhar imagem no WhatsApp</span>
                  </button>
                )}

                {activePayload && (
                  <button
                    type="button"
                    onClick={() => onSaveToHistory(activePayload)}
                    disabled={isCurrentSaved}
                    className={`w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border ${
                      isCurrentSaved
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80'
                        : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {isCurrentSaved ? (
                      <>
                        <BookmarkCheck className="w-4 h-4 shrink-0" />
                        <span>Salva no histórico</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-4 h-4 shrink-0" />
                        <span>Salvar no histórico</span>
                      </>
                    )}
                  </button>
                )}

                {isCurrentSaved && (
                  <button
                    type="button"
                    onClick={onOpenHistory}
                    className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Acompanhar ao vivo</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onOpenTipsMenu}
                className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Flame className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>Abrir Dicas quentes</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>

            {/* Inline WhatsApp Image Preview + Fallback Links */}
            {(shareFeedback || generatedPreview) && (
              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex flex-col min-[380px]:flex-row items-start min-[380px]:items-center gap-3 min-w-0 w-full">
                  {generatedPreview && (
                    <img
                      src={generatedPreview.dataUrl}
                      alt="Prévia da imagem da Super Dica Combinada para WhatsApp"
                      referrerPolicy="no-referrer"
                      className="w-16 h-20 object-cover rounded-lg border border-slate-300 dark:border-slate-700 shrink-0"
                    />
                  )}
                  <div className="min-w-0 space-y-2 flex-1">
                    {shareFeedback && (
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        {shareFeedback}
                      </p>
                    )}
                    <div className="grid grid-cols-1 min-[420px]:grid-cols-3 sm:flex sm:flex-wrap items-center gap-2">
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        <Share2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Abrir WhatsApp</span>
                      </a>

                      {generatedPreview && (
                        <a
                          href={generatedPreview.dataUrl}
                          download={generatedPreview.fileName}
                          className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5 shrink-0" />
                          <span>Baixar PNG</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={handleCopyWhatsappText}
                        className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        {copiedText ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 shrink-0" />
                            <span>Copiar texto</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setGeneratedPreview(null);
                    setShareFeedback(null);
                  }}
                  aria-label="Fechar prévia de compartilhamento"
                  className="min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 inline-flex items-center justify-center self-end sm:self-center shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};
