import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { parseBetSlipOcrText } from '../lib/betSlipTextParser.ts';
import { prepareBetSlipImageForUpload } from '../lib/imageUploadUtils.ts';
import { extractTextFromBetSlipImage } from '../lib/localBetSlipOcr.ts';
import { formatBrlCurrency } from '../lib/shareMultipleImage.ts';
import { CompetitionFlag } from './CompetitionFlag.tsx';
import { TeamCrest } from './TeamCrest.tsx';
import type {
  MultipleHistoryItem,
  MultipleHistoryLeg,
  MultipleLegStatus,
  MultipleTipStatus,
  ParsedBetSlipLeg,
  ParsedBetSlipResponse,
} from '../types/football.ts';

interface BetSlipUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveBetSlip: (item: MultipleHistoryItem) => void;
}

interface EditableLeg {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeShortCode: string;
  awayShortCode: string;
  homeLogoUrl?: string;
  awayLogoUrl?: string;
  homeColor?: string;
  awayColor?: string;
  competition: string;
  leagueSlug?: string;
  dateLabel: string;
  marketLabel: string;
  oddInput: string;
  status: MultipleLegStatus;
}

function makeShortCode(name: string): string {
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
  return (clean || 'TIM').slice(0, 3);
}

function parseNumericInput(raw: string): number {
  const cleaned = raw.replace(/\s+/g, '').replace(',', '.');
  const num = Number(cleaned);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

function createEmptyLeg(): EditableLeg {
  return {
    id: `leg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    homeTeam: '',
    awayTeam: '',
    homeShortCode: 'MAN',
    awayShortCode: 'VIS',
    homeColor: '#0F766E',
    awayColor: '#1D4ED8',
    competition: '',
    dateLabel: 'Hoje',
    marketLabel: '',
    oddInput: '1.50',
    status: 'pending',
  };
}

function toEditableLegs(legs: ParsedBetSlipLeg[]): EditableLeg[] {
  return legs.map((leg, idx) => ({
    id: `leg-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
    homeTeam: leg.homeTeam,
    awayTeam: leg.awayTeam,
    homeShortCode: leg.homeShortCode || makeShortCode(leg.homeTeam),
    awayShortCode: leg.awayShortCode || makeShortCode(leg.awayTeam),
    homeLogoUrl: leg.homeLogoUrl,
    awayLogoUrl: leg.awayLogoUrl,
    homeColor: leg.homeColor || '#0F766E',
    awayColor: leg.awayColor || '#1D4ED8',
    competition: leg.competition || 'Futebol',
    leagueSlug: leg.leagueSlug,
    dateLabel: leg.dateLabel || 'Importado',
    marketLabel: leg.marketLabel,
    oddInput: leg.odd > 0 ? leg.odd.toFixed(2) : '',
    status: leg.status,
  }));
}

export const BetSlipUploadModal: React.FC<BetSlipUploadModalProps> = ({
  isOpen,
  onClose,
  onSaveBetSlip,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preparedPayload, setPreparedPayload] = useState<{
    dataUrl: string;
    base64: string;
    mimeType: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [readingLabel, setReadingLabel] = useState<string>(
    'Lendo bilhete, identificando jogos e buscando brasões...'
  );
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notesMsg, setNotesMsg] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);

  // Editable slip state
  const [title, setTitle] = useState('Bilhete importado');
  const [bookmaker, setBookmaker] = useState('');
  const [leagueSlug, setLeagueSlug] = useState('world');
  const [stakeInput, setStakeInput] = useState('25');
  const [totalOddInput, setTotalOddInput] = useState('1.00');
  const [potentialReturnInput, setPotentialReturnInput] = useState('25.00');
  const [slipStatus, setSlipStatus] = useState<MultipleTipStatus>('pending');
  const [legs, setLegs] = useState<EditableLeg[]>([]);

  const resetModalState = useCallback(() => {
    setPreviewUrl(null);
    setPreparedPayload(null);
    setIsDragging(false);
    setIsReading(false);
    setReadingLabel('Lendo bilhete, identificando jogos e buscando brasões...');
    setOcrProgress(null);
    setErrorMsg(null);
    setNotesMsg(null);
    setShowReview(false);
    setTitle('Bilhete importado');
    setBookmaker('');
    setLeagueSlug('world');
    setStakeInput('25');
    setTotalOddInput('1.00');
    setPotentialReturnInput('25.00');
    setSlipStatus('pending');
    setLegs([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClose = useCallback(() => {
    if (isReading) return;
    resetModalState();
    onClose();
  }, [isReading, onClose, resetModalState]);

  const applyParsedResponse = useCallback((parsed: ParsedBetSlipResponse) => {
    if (!parsed.isBetSlip || parsed.legs.length === 0) {
      setErrorMsg(
        parsed.notes ||
          'Não identificamos jogos de futebol nesta imagem. Tente outro print mais nítido ou preencha os jogos manualmente.'
      );
      setShowReview(false);
      return;
    }

    const nextLegs = toEditableLegs(parsed.legs);
    setLegs(nextLegs);
    setTitle(parsed.title || parsed.competition || 'Bilhete importado');
    setBookmaker(parsed.bookmaker || '');
    setLeagueSlug(parsed.leagueSlug || 'world');
    const safeStake = parsed.stake > 0 ? parsed.stake : 25;
    const safeOdd = parsed.totalOdd >= 1 ? parsed.totalOdd : 1;
    const safeReturn =
      parsed.potentialReturn > 0
        ? parsed.potentialReturn
        : Number((safeStake * safeOdd).toFixed(2));
    setStakeInput(String(safeStake));
    setTotalOddInput(safeOdd.toFixed(2));
    setPotentialReturnInput(safeReturn.toFixed(2));
    setSlipStatus(parsed.status || 'pending');
    setNotesMsg(parsed.notes || null);
    setErrorMsg(null);
    setShowReview(true);
  }, []);

  const runLocalOcrPipeline = useCallback(
    async (dataUrl: string) => {
      setReadingLabel('Lendo texto do bilhete (OCR local)...');
      setOcrProgress(5);
      const ocr = await extractTextFromBetSlipImage(dataUrl, (pct) => {
        setOcrProgress(pct);
      });

      const trimmed = ocr.text.trim();
      if (!trimmed) {
        applyParsedResponse({
          isBetSlip: false,
          extractionMode: 'ocr',
          title: 'Bilhete importado',
          competition: 'Bilhete importado',
          leagueSlug: 'world',
          stake: 0,
          totalOdd: 1,
          potentialReturn: 0,
          status: 'pending',
          legs: [],
          notes:
            'Não foi possível detectar texto legível nesta imagem. Envie um print mais nítido ou preencha manualmente.',
        });
        return;
      }

      setReadingLabel('Identificando jogos e buscando brasões oficiais...');
      setOcrProgress(null);

      try {
        const enrichRes = await fetch('/api/parse-bet-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ocrText: trimmed }),
        });
        if (enrichRes.ok) {
          const enrichedJson = (await enrichRes.json()) as ParsedBetSlipResponse;
          applyParsedResponse(enrichedJson);
          return;
        }
      } catch {
        // Fall through to offline client parser if network drops
      }

      applyParsedResponse(parseBetSlipOcrText(trimmed));
    },
    [applyParsedResponse]
  );

  const runImageExtraction = useCallback(
    async (payload: { dataUrl: string; base64: string; mimeType: string }) => {
      setShowReview(false);
      setIsReading(true);
      setReadingLabel('Lendo bilhete, identificando jogos e buscando brasões...');
      setOcrProgress(null);
      setErrorMsg(null);
      setNotesMsg(null);

      try {
        let shouldRunLocalOcr = false;

        try {
          const res = await fetch('/api/parse-bet-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: payload.base64,
              mimeType: payload.mimeType,
            }),
          });
          const json = (await res.json()) as ParsedBetSlipResponse & {
            error?: string;
          };

          if (res.ok) {
            if (json.needsLocalOcr) {
              shouldRunLocalOcr = true;
            } else {
              applyParsedResponse(json);
              return;
            }
          } else {
            // Fallback to local OCR on any server key/quota error so Vercel deployments never fail
            shouldRunLocalOcr = true;
          }
        } catch {
          shouldRunLocalOcr = true;
        }

        if (shouldRunLocalOcr) {
          await runLocalOcrPipeline(payload.dataUrl);
        }
      } catch (err: any) {
        setErrorMsg(
          err?.message ||
            'Erro ao processar a imagem do bilhete. Tente novamente ou preencha manualmente.'
        );
      } finally {
        setIsReading(false);
        setOcrProgress(null);
      }
    },
    [applyParsedResponse, runLocalOcrPipeline]
  );

  const handleImageBlob = useCallback(
    async (blob: Blob) => {
      setErrorMsg(null);
      setNotesMsg(null);
      try {
        const prepared = await prepareBetSlipImageForUpload(blob);
        const nextPayload = {
          dataUrl: prepared.dataUrl,
          base64: prepared.base64,
          mimeType: prepared.mimeType,
        };
        setPreviewUrl(prepared.dataUrl);
        setPreparedPayload(nextPayload);
        await runImageExtraction(nextPayload);
      } catch (err: any) {
        setErrorMsg(
          err?.message || 'Não foi possível carregar o arquivo de imagem selecionado.'
        );
      }
    },
    [runImageExtraction]
  );

  // Keyboard Escape + Clipboard Paste (Ctrl+V) support while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (isReading) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            handleImageBlob(blob);
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
    };
  }, [isOpen, isReading, handleClose, handleImageBlob]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageBlob(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isReading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImageBlob(file);
    }
  };

  const handleOpenManualEditor = () => {
    setErrorMsg(null);
    setNotesMsg(null);
    if (legs.length === 0) {
      setLegs([createEmptyLeg()]);
      setTotalOddInput('1.50');
      const s = parseNumericInput(stakeInput) || 25;
      setPotentialReturnInput((s * 1.5).toFixed(2));
    }
    setShowReview(true);
  };

  const recalcFromLegs = (nextLegs: EditableLeg[], stakeStr = stakeInput) => {
    const product = nextLegs.reduce((acc, l) => {
      const o = parseNumericInput(l.oddInput);
      return o >= 1.01 ? acc * o : acc;
    }, 1);
    const nextOdd = product >= 1.01 ? product : parseNumericInput(totalOddInput) || 1;
    setTotalOddInput(nextOdd.toFixed(2));
    const s = parseNumericInput(stakeStr);
    if (s > 0) {
      setPotentialReturnInput((s * nextOdd).toFixed(2));
    }
  };

  const handleStakeChange = (value: string) => {
    setStakeInput(value);
    const s = parseNumericInput(value);
    const odd = parseNumericInput(totalOddInput);
    if (s >= 0 && odd >= 1) {
      setPotentialReturnInput((s * odd).toFixed(2));
    }
  };

  const handleTotalOddChange = (value: string) => {
    setTotalOddInput(value);
    const odd = parseNumericInput(value);
    const s = parseNumericInput(stakeInput);
    if (s >= 0 && odd >= 1) {
      setPotentialReturnInput((s * odd).toFixed(2));
    }
  };

  const updateLegField = (
    legId: string,
    patch: Partial<EditableLeg>,
    recalcOdds = false
  ) => {
    setLegs((prev) => {
      const next = prev.map((l) => {
        if (l.id !== legId) return l;
        const updated = { ...l, ...patch };
        if (patch.homeTeam !== undefined) {
          updated.homeShortCode = makeShortCode(patch.homeTeam);
        }
        if (patch.awayTeam !== undefined) {
          updated.awayShortCode = makeShortCode(patch.awayTeam);
        }
        return updated;
      });

      if (recalcOdds) {
        recalcFromLegs(next);
      }

      if (patch.status !== undefined) {
        if (next.some((l) => l.status === 'lost')) setSlipStatus('lost');
        else if (next.length > 0 && next.every((l) => l.status === 'won'))
          setSlipStatus('won');
        else setSlipStatus('pending');
      }

      return next;
    });
  };

  const handleAddLeg = () => {
    setLegs((prev) => {
      const next = [...prev, createEmptyLeg()];
      recalcFromLegs(next);
      return next;
    });
  };

  const handleRemoveLeg = (legId: string) => {
    setLegs((prev) => {
      const next = prev.filter((l) => l.id !== legId);
      recalcFromLegs(next);
      return next;
    });
  };

  const validLegsCount = legs.filter(
    (l) =>
      l.homeTeam.trim().length > 0 &&
      l.awayTeam.trim().length > 0 &&
      l.marketLabel.trim().length > 0
  ).length;

  const canSave = showReview && validLegsCount > 0 && !isReading;

  const handleConfirmSave = () => {
    const cleanLegs: MultipleHistoryLeg[] = legs
      .filter(
        (l) =>
          l.homeTeam.trim().length > 0 &&
          l.awayTeam.trim().length > 0 &&
          l.marketLabel.trim().length > 0
      )
      .map((l) => {
        const parsedOdd = parseNumericInput(l.oddInput);
        return {
          leagueSlug: l.leagueSlug,
          homeTeam: l.homeTeam.trim(),
          awayTeam: l.awayTeam.trim(),
          homeShortCode: l.homeShortCode || makeShortCode(l.homeTeam),
          awayShortCode: l.awayShortCode || makeShortCode(l.awayTeam),
          homeLogoUrl: l.homeLogoUrl,
          awayLogoUrl: l.awayLogoUrl,
          homeColor: l.homeColor || '#0F766E',
          awayColor: l.awayColor || '#1D4ED8',
          competition: l.competition.trim() || 'Futebol',
          dateLabel: l.dateLabel.trim() || 'Importado',
          marketLabel: l.marketLabel.trim(),
          probabilityPct: 0,
          expectedGoalsHome: 0,
          expectedGoalsAway: 0,
          rationale: bookmaker.trim()
            ? `Importado de bilhete (${bookmaker.trim()}).`
            : 'Importado por imagem de bilhete.',
          odd: parsedOdd >= 1.01 ? Number(parsedOdd.toFixed(2)) : 1,
          status: l.status,
        };
      });

    if (cleanLegs.length === 0) {
      setErrorMsg('Preencha pelo menos um jogo com mandante, visitante e palpite.');
      return;
    }

    const stake = Number(Math.max(0, parseNumericInput(stakeInput)).toFixed(2));
    const totalOddRaw = parseNumericInput(totalOddInput);
    const derivedOdd = cleanLegs.reduce((acc, l) => acc * (l.odd >= 1 ? l.odd : 1), 1);
    const totalOdd = Number(
      (totalOddRaw >= 1.01 ? totalOddRaw : Math.max(1, derivedOdd)).toFixed(2)
    );
    const potentialReturnRaw = parseNumericInput(potentialReturnInput);
    const potentialReturn = Number(
      (potentialReturnRaw > 0 ? potentialReturnRaw : stake * totalOdd).toFixed(2)
    );

    const distinctSlugs = Array.from(
      new Set(
        cleanLegs.map((l) => l.leagueSlug).filter((s): s is string => Boolean(s))
      )
    );
    const resolvedLeagueSlug =
      distinctSlugs.length === 1 ? distinctSlugs[0] : leagueSlug || 'world';

    const cleanBookmaker = bookmaker.trim() || undefined;
    const cleanTitle =
      title.trim() ||
      (cleanBookmaker
        ? `${cleanLegs.length === 1 ? 'Aposta simples' : 'Múltipla'} · ${cleanBookmaker}`
        : cleanLegs.length === 1
          ? 'Aposta simples importada'
          : 'Múltipla importada');

    const nowIso = new Date().toISOString();
    const historyItem: MultipleHistoryItem = {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tipSignature: `img::${nowIso}::${cleanLegs
        .map((l) => `${l.homeTeam}-${l.awayTeam}-${l.marketLabel}`)
        .join('|')}`,
      createdAt: nowIso,
      competition: cleanTitle,
      leagueSlug: resolvedLeagueSlug,
      dayFilter: 'all',
      legs: cleanLegs,
      combinedProbabilityPct: 0,
      totalOdd,
      stake,
      potentialReturn,
      status: slipStatus,
      resolvedAt: slipStatus === 'pending' ? undefined : nowIso,
      source: 'image',
      bookmaker: cleanBookmaker,
      notes: notesMsg || undefined,
    };

    onSaveBetSlip(historyItem);
    resetModalState();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-bet-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full sm:max-w-3xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col overflow-hidden">
        {/* Mobile bottom-sheet grab handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2
              id="upload-bet-modal-title"
              className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 truncate"
            >
              Carregar aposta por imagem
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Envie o print ou foto do bilhete para importar os jogos e acompanhar o placar ao vivo.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isReading}
            aria-label="Fechar janela de importação"
            className="min-h-[44px] min-w-[44px] rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif,image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Upload Dropzone when no review is active yet */}
          {!showReview && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed p-5 sm:p-7 text-center transition-colors ${
                isDragging
                  ? 'border-emerald-600 dark:border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/40'
              }`}
            >
              {previewUrl && isReading ? (
                <div className="space-y-4">
                  <div className="mx-auto max-w-xs overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                    <img
                      src={previewUrl}
                      alt="Prévia do bilhete enviado"
                      className="w-full max-h-56 object-contain"
                    />
                  </div>
                  <div className="space-y-2 max-w-xs mx-auto">
                    <div className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span>
                        {ocrProgress !== null
                          ? `${readingLabel} ${ocrProgress}%`
                          : readingLabel}
                      </span>
                    </div>
                    {ocrProgress !== null && (
                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-200"
                          style={{ width: `${ocrProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {previewUrl ? (
                    <div className="mx-auto max-w-xs overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                      <img
                        src={previewUrl}
                        alt="Imagem selecionada do bilhete"
                        className="w-full max-h-48 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto">
                      <ImagePlus className="w-6 h-6" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                      Selecione, arraste ou cole (Ctrl+V) a imagem da aposta
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      Compatível com prints e fotos de Bet365, Betano, Superbet, KTO, Sportingbet, Betnacional e bilhetes compartilhados (PNG, JPG ou WebP).
                    </p>
                  </div>

                  <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                    >
                      <Upload className="w-4 h-4 shrink-0" />
                      <span>{previewUrl ? 'Escolher outra imagem' : 'Escolher imagem'}</span>
                    </button>

                    {preparedPayload && (
                      <button
                        type="button"
                        onClick={() => runImageExtraction(preparedPayload)}
                        className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                        <span>Tentar ler novamente</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleOpenManualEditor}
                      className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <span>Preencher manualmente</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Alert */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="space-y-1">
                <div>{errorMsg}</div>
                {!showReview && (
                  <button
                    type="button"
                    onClick={handleOpenManualEditor}
                    className="font-semibold underline underline-offset-2 text-rose-900 dark:text-rose-100"
                  >
                    Abrir preenchimento manual
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Review & Edit Extracted Slip */}
          {showReview && (
            <div className="space-y-4">
              {/* Image preview strip + status banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="Miniatura do bilhete"
                      className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-900"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {legs.length === 1
                          ? '1 jogo pronto para revisão'
                          : `${legs.length} jogos prontos para revisão`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {notesMsg ||
                        'Confira times, palpites, odds e valor apostado antes de salvar no histórico.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isReading}
                    className="flex-1 sm:flex-initial min-h-[44px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap transition-colors"
                  >
                    Trocar imagem
                  </button>
                  {preparedPayload && (
                    <button
                      type="button"
                      onClick={() => runImageExtraction(preparedPayload)}
                      disabled={isReading}
                      aria-label="Reanalisar imagem"
                      className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors shrink-0"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isReading ? 'animate-spin' : ''}`}
                      />
                    </button>
                  )}
                </div>
              </div>

              {/* Slip Metadata & Financial Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="slip-title"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Título / Competição
                  </label>
                  <input
                    id="slip-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Múltipla Betano"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700 dark:focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="slip-bookmaker"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Casa de apostas (opcional)
                  </label>
                  <input
                    id="slip-bookmaker"
                    type="text"
                    value={bookmaker}
                    onChange={(e) => setBookmaker(e.target.value)}
                    placeholder="Ex: Bet365, Betano, Superbet"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700 dark:focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2.5">
                <div>
                  <label
                    htmlFor="slip-stake"
                    className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
                  >
                    Valor (R$)
                  </label>
                  <input
                    id="slip-stake"
                    type="text"
                    inputMode="decimal"
                    value={stakeInput}
                    onChange={(e) => handleStakeChange(e.target.value)}
                    className="w-full min-h-[44px] px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                  />
                </div>

                <div>
                  <label
                    htmlFor="slip-odd"
                    className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
                  >
                    Odd total
                  </label>
                  <input
                    id="slip-odd"
                    type="text"
                    inputMode="decimal"
                    value={totalOddInput}
                    onChange={(e) => handleTotalOddChange(e.target.value)}
                    className="w-full min-h-[44px] px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                  />
                </div>

                <div>
                  <label
                    htmlFor="slip-return"
                    className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
                  >
                    Retorno (R$)
                  </label>
                  <input
                    id="slip-return"
                    type="text"
                    inputMode="decimal"
                    value={potentialReturnInput}
                    onChange={(e) => setPotentialReturnInput(e.target.value)}
                    className="w-full min-h-[44px] px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                  />
                </div>
              </div>

              {/* Overall Slip Status */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Status do bilhete
                </span>
                <div
                  role="group"
                  aria-label="Status geral do bilhete"
                  className="grid grid-cols-3 gap-1.5 w-full sm:w-auto"
                >
                  {(
                    [
                      { id: 'pending', label: 'Pendente' },
                      { id: 'won', label: 'Acerto' },
                      { id: 'lost', label: 'Perda' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSlipStatus(st.id)}
                      className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        slipStatus === st.id
                          ? st.id === 'won'
                            ? 'bg-emerald-700 text-white'
                            : st.id === 'lost'
                              ? 'bg-rose-700 text-white'
                              : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editable Legs List */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                    Jogos da aposta ({legs.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddLeg}
                    className="min-h-[44px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>Adicionar jogo</span>
                  </button>
                </div>

                {legs.map((leg, idx) => (
                  <div
                    key={leg.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CompetitionFlag
                          leagueSlug={leg.leagueSlug}
                          competition={leg.competition || 'Futebol'}
                          size="sm"
                        />
                        <TeamCrest
                          name={leg.homeTeam || 'Mandante'}
                          shortCode={leg.homeShortCode}
                          primaryColor={leg.homeColor || '#0F766E'}
                          secondaryColor="#FFFFFF"
                          logoUrl={leg.homeLogoUrl}
                          size="xs"
                        />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                          Jogo {idx + 1}
                          {leg.homeTeam && leg.awayTeam
                            ? ` · ${leg.homeTeam} × ${leg.awayTeam}`
                            : ''}
                        </span>
                        <TeamCrest
                          name={leg.awayTeam || 'Visitante'}
                          shortCode={leg.awayShortCode}
                          primaryColor={leg.awayColor || '#1D4ED8'}
                          secondaryColor="#FFFFFF"
                          logoUrl={leg.awayLogoUrl}
                          size="xs"
                        />
                      </div>

                      {legs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLeg(leg.id)}
                          aria-label={`Remover jogo ${idx + 1}`}
                          className="min-h-[44px] min-w-[44px] rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={leg.homeTeam}
                        onChange={(e) =>
                          updateLegField(leg.id, { homeTeam: e.target.value })
                        }
                        placeholder="Time mandante (ex: Flamengo)"
                        aria-label={`Mandante do jogo ${idx + 1}`}
                        className="w-full min-h-[44px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                      />
                      <input
                        type="text"
                        value={leg.awayTeam}
                        onChange={(e) =>
                          updateLegField(leg.id, { awayTeam: e.target.value })
                        }
                        placeholder="Time visitante (ex: Palmeiras)"
                        aria-label={`Visitante do jogo ${idx + 1}`}
                        className="w-full min-h-[44px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px] gap-2">
                      <input
                        type="text"
                        value={leg.marketLabel}
                        onChange={(e) =>
                          updateLegField(leg.id, { marketLabel: e.target.value })
                        }
                        placeholder="Palpite / Mercado (ex: Vitória Flamengo, Mais de 1,5 gols)"
                        aria-label={`Palpite do jogo ${idx + 1}`}
                        className="w-full min-h-[44px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={leg.oddInput}
                        onChange={(e) =>
                          updateLegField(
                            leg.id,
                            { oddInput: e.target.value },
                            true
                          )
                        }
                        placeholder="Odd (1.80)"
                        aria-label={`Odd do jogo ${idx + 1}`}
                        className="w-full min-h-[44px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={leg.competition}
                        onChange={(e) =>
                          updateLegField(leg.id, { competition: e.target.value })
                        }
                        placeholder="Competição (ex: Brasileirão Série A)"
                        aria-label={`Competição do jogo ${idx + 1}`}
                        className="w-full min-h-[44px] px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                      />
                      <input
                        type="text"
                        value={leg.dateLabel}
                        onChange={(e) =>
                          updateLegField(leg.id, { dateLabel: e.target.value })
                        }
                        placeholder="Data/hora (ex: Hoje · 21:30)"
                        aria-label={`Data do jogo ${idx + 1}`}
                        className="w-full min-h-[44px] px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      {(
                        [
                          { id: 'pending', label: 'Pendente' },
                          { id: 'won', label: 'Acerto' },
                          { id: 'lost', label: 'Perda' },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => updateLegField(leg.id, { status: st.id })}
                          className={`min-h-[44px] px-2 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                            leg.status === st.id
                              ? st.id === 'won'
                                ? 'bg-emerald-700 text-white'
                                : st.id === 'lost'
                                  ? 'bg-rose-700 text-white'
                                  : 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="px-4 sm:px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          {showReview ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {validLegsCount} {validLegsCount === 1 ? 'jogo válido' : 'jogos válidos'} · Odd{' '}
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {(parseNumericInput(totalOddInput) || 1).toFixed(2)}
              </span>{' '}
              · Retorno{' '}
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                {formatBrlCurrency(parseNumericInput(potentialReturnInput))}
              </span>
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Os placares ao vivo serão sincronizados automaticamente após salvar.
            </div>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleClose}
              disabled={isReading}
              className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            {showReview && (
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={!canSave}
                className="flex-1 sm:flex-initial min-h-[48px] px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-50"
              >
                Salvar no histórico
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
