import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  Flame,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  RotateCcw,
  Share2,
  X,
} from 'lucide-react';
import {
  buildWhatsappSummaryText,
  formatBrlCurrency,
  generateMultipleTipPng,
} from '../lib/shareMultipleImage.ts';
import type { SerieAMultipleLeg, SerieAMultipleTip } from '../types/football';

interface SerieAMultipleCardProps {
  tip: SerieAMultipleTip | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectLeg: (leg: SerieAMultipleLeg) => void;
}

function parseLocaleDecimal(raw: string): number {
  const normalized = raw.replace(/\s+/g, '').replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function computeFairLegOdd(probabilityPct: number): string {
  const safeProb = Math.max(1, Math.min(99, probabilityPct));
  return (100 / safeProb).toFixed(2);
}

export const SerieAMultipleCard: React.FC<SerieAMultipleCardProps> = ({
  tip,
  isLoading,
  error,
  onRefresh,
  onSelectLeg,
}) => {
  const [legOddInputs, setLegOddInputs] = useState<string[]>([]);
  const [customTotalOddInput, setCustomTotalOddInput] = useState<string | null>(null);
  const [stakeInput, setStakeInput] = useState<string>('50');

  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState<{
    dataUrl: string;
    fileName: string;
  } | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  // Reset leg odds & preview whenever a fresh tip arrives
  useEffect(() => {
    if (!tip) {
      setLegOddInputs([]);
      setCustomTotalOddInput(null);
      setGeneratedPreview(null);
      return;
    }
    setLegOddInputs(tip.legs.map((leg) => computeFairLegOdd(leg.probabilityPct)));
    setCustomTotalOddInput(null);
    setGeneratedPreview(null);
    setShareFeedback(null);
  }, [tip]);

  const parsedLegOdds = useMemo(() => {
    if (!tip) return [];
    return tip.legs.map((leg, idx) => {
      const raw = legOddInputs[idx];
      const parsed = raw !== undefined ? parseLocaleDecimal(raw) : 0;
      return parsed >= 1 ? parsed : Number(computeFairLegOdd(leg.probabilityPct));
    });
  }, [tip, legOddInputs]);

  const multipliedOdd = useMemo(() => {
    if (parsedLegOdds.length === 0) return tip?.fairOddEstimate ?? 1;
    const prod = parsedLegOdds.reduce((acc, o) => acc * o, 1);
    return Number(prod.toFixed(2));
  }, [parsedLegOdds, tip]);

  const totalOdd = useMemo(() => {
    if (customTotalOddInput !== null) {
      const parsed = parseLocaleDecimal(customTotalOddInput);
      return parsed >= 1 ? parsed : 1;
    }
    return multipliedOdd;
  }, [customTotalOddInput, multipliedOdd]);

  const stake = useMemo(() => parseLocaleDecimal(stakeInput), [stakeInput]);
  const potentialReturn = useMemo(() => stake * totalOdd, [stake, totalOdd]);
  const potentialProfit = useMemo(
    () => Math.max(0, potentialReturn - stake),
    [potentialReturn, stake]
  );

  const isCustomOddActive = useMemo(() => {
    if (!tip) return false;
    if (customTotalOddInput !== null) return true;
    return tip.legs.some(
      (leg, idx) => legOddInputs[idx] !== computeFairLegOdd(leg.probabilityPct)
    );
  }, [tip, customTotalOddInput, legOddInputs]);

  const handleLegOddChange = (idx: number, val: string) => {
    setCustomTotalOddInput(null);
    setLegOddInputs((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  const handleResetFairOdds = () => {
    if (!tip) return;
    setLegOddInputs(tip.legs.map((leg) => computeFairLegOdd(leg.probabilityPct)));
    setCustomTotalOddInput(null);
  };

  const currentPayload = useMemo(() => {
    if (!tip) return null;
    return {
      tip,
      legOdds: parsedLegOdds,
      totalOdd,
      stake,
      potentialReturn,
      potentialProfit,
    };
  }, [tip, parsedLegOdds, totalOdd, stake, potentialReturn, potentialProfit]);

  const whatsappHref = useMemo(() => {
    if (!currentPayload) return '#';
    const text = buildWhatsappSummaryText(currentPayload);
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }, [currentPayload]);

  const triggerPngDownload = (dataUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateImageOnly = async () => {
    if (!currentPayload) return;
    setIsGeneratingImage(true);
    setShareFeedback(null);
    try {
      const { dataUrl, fileName } = await generateMultipleTipPng(currentPayload);
      setGeneratedPreview({ dataUrl, fileName });
      triggerPngDownload(dataUrl, fileName);
      setShareFeedback('Imagem PNG gerada e salva. Envie no WhatsApp pelo botão abaixo.');
    } catch {
      setShareFeedback('Não foi possível gerar a imagem da dica neste navegador.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleShareWhatsapp = async () => {
    if (!currentPayload) return;
    setIsGeneratingImage(true);
    setShareFeedback(null);
    try {
      const { blob, dataUrl, fileName } = await generateMultipleTipPng(currentPayload);
      setGeneratedPreview({ dataUrl, fileName });

      const summaryText = buildWhatsappSummaryText(currentPayload);
      const imageFile = new File([blob], fileName, { type: 'image/png' });

      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [imageFile] })
      ) {
        try {
          await navigator.share({
            title: 'Dica Quente · Múltipla da Série A',
            text: summaryText,
            files: [imageFile],
          });
          setShareFeedback('Imagem pronta e compartilhada.');
          return;
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') {
            return;
          }
          // Fall through to desktop/iframe preview + download fallback
        }
      }

      triggerPngDownload(dataUrl, fileName);
      setShareFeedback(
        'Imagem PNG baixada! Anexe a imagem no WhatsApp ou envie o resumo pelo link abaixo.'
      );
    } catch {
      setShareFeedback('Erro ao gerar a imagem para compartilhamento.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleCopyWhatsappText = async () => {
    if (!currentPayload || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(buildWhatsappSummaryText(currentPayload));
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const updatedTime = tip?.updatedAt
    ? new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(tip.updatedAt))
    : null;

  return (
    <section
      aria-label="Dica quente de Múltipla da Série A"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs mb-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
              Dica quente · Múltipla da Série A
            </h2>
          </div>

          {tip ? (
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {tip.competition} · {tip.legs.length}{' '}
              {tip.legs.length === 1 ? 'seleção' : 'seleções'} · Prob. combinada{' '}
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                {tip.combinedProbabilityPct}%
              </span>{' '}
              · Odd justa estimada{' '}
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {tip.fairOddEstimate.toFixed(2)}
              </span>
              {updatedTime ? ` · Atualizado ${updatedTime}` : ''}
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Combinada calculada pelo modelo Poisson com jogos futuros do Brasileirão Série A.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Body States */}
      {isLoading && !tip ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 space-y-2.5 animate-pulse"
            >
              <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-44 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-5 w-36 rounded bg-emerald-200/60 dark:bg-emerald-900/40" />
              <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      ) : error && !tip ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-200">{error}</p>
          <button
            type="button"
            onClick={onRefresh}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0"
          >
            Tentar novamente
          </button>
        </div>
      ) : tip && tip.legs.length > 0 ? (
        <>
          {/* 3 Legs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {tip.legs.map((leg, idx) => (
              <article
                key={`${leg.homeTeam}-${leg.awayTeam}-${idx}`}
                className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5 flex flex-col justify-between gap-2.5"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-medium truncate">
                      Jogo {idx + 1} · {leg.dateLabel}
                    </span>
                    <span className="font-mono tabular-nums shrink-0">
                      xG {leg.expectedGoalsHome.toFixed(1)}–{leg.expectedGoalsAway.toFixed(1)}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                    {leg.homeTeam} × {leg.awayTeam}
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

                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">Odd</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Odd para ${leg.homeTeam} × ${leg.awayTeam}`}
                      value={legOddInputs[idx] ?? computeFairLegOdd(leg.probabilityPct)}
                      onChange={(e) => handleLegOddChange(idx, e.target.value)}
                      className="w-20 min-h-[38px] px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-slate-100 text-center focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700 dark:focus:border-emerald-500"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => onSelectLeg(leg)}
                    className="min-h-[38px] px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 inline-flex items-center gap-1 transition-colors shrink-0"
                  >
                    <span>Analisar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>

          {/* Odd Calculator + Potential Return + WhatsApp Share Bar */}
          <div className="mt-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/70 p-3.5 sm:p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              {/* Total Odd Field */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label
                    htmlFor="multiple-total-odd"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Odd da múltipla
                  </label>
                  {isCustomOddActive && (
                    <button
                      type="button"
                      onClick={handleResetFairOdds}
                      className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Odd justa</span>
                    </button>
                  )}
                </div>
                <input
                  id="multiple-total-odd"
                  type="text"
                  inputMode="decimal"
                  value={
                    customTotalOddInput !== null
                      ? customTotalOddInput
                      : multipliedOdd.toFixed(2)
                  }
                  onChange={(e) => setCustomTotalOddInput(e.target.value)}
                  placeholder="Ex: 2.50"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono tabular-nums text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700 dark:focus:border-emerald-500"
                />
              </div>

              {/* Stake Input Field */}
              <div>
                <label
                  htmlFor="multiple-stake"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Valor simulado (R$)
                </label>
                <input
                  id="multiple-stake"
                  type="text"
                  inputMode="decimal"
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                  placeholder="50"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono tabular-nums text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700 dark:focus:border-emerald-500"
                />
              </div>

              {/* Potential Return Display */}
              <div className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/70 flex flex-col justify-center">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  Ganho potencial
                </span>
                <div className="flex items-baseline justify-between gap-2 tabular-nums">
                  <span className="font-mono text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    {formatBrlCurrency(potentialReturn)}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-emerald-800/80 dark:text-emerald-300/90">
                    +{formatBrlCurrency(potentialProfit)}
                  </span>
                </div>
              </div>

              {/* Share & Image Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShareWhatsapp}
                  disabled={isGeneratingImage}
                  className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
                >
                  {isGeneratingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <Share2 className="w-4 h-4 shrink-0" />
                  )}
                  <span className="whitespace-nowrap">WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateImageOnly}
                  disabled={isGeneratingImage}
                  title="Gerar e baixar imagem PNG da múltipla"
                  aria-label="Gerar e baixar imagem PNG da múltipla"
                  className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
                >
                  <ImageIcon className="w-4 h-4 shrink-0" />
                  <span className="hidden xl:inline">Imagem</span>
                </button>
              </div>
            </div>

            {/* Inline Share Feedback + Generated Image Preview / WhatsApp Link Fallback */}
            {(shareFeedback || generatedPreview) && (
              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {generatedPreview && (
                    <img
                      src={generatedPreview.dataUrl}
                      alt="Prévia da imagem da múltipla para WhatsApp"
                      className="w-16 h-20 object-cover rounded-lg border border-slate-300 dark:border-slate-700 shrink-0"
                    />
                  )}
                  <div className="min-w-0 space-y-1">
                    {shareFeedback && (
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        {shareFeedback}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Abrir WhatsApp com texto</span>
                      </a>

                      {generatedPreview && (
                        <a
                          href={generatedPreview.dataUrl}
                          download={generatedPreview.fileName}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Baixar PNG</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={handleCopyWhatsappText}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors"
                      >
                        {copiedText ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
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
                  className="min-h-[36px] min-w-[36px] rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 inline-flex items-center justify-center self-end sm:self-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              As odds vêm preenchidas com a odd justa do modelo Poisson (1 / probabilidade) e podem ser editadas conforme sua casa de apostas.
            </span>
            <a
              href={tip.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
            >
              Fonte: ESPN Série A
            </a>
          </div>
        </>
      ) : null}
    </section>
  );
};
