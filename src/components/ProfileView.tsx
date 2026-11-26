import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowRight,
  Bell,
  BookmarkCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  Cloud,
  Edit3,
  Flame,
  LogOut,
  Mail,
  Moon,
  SlidersHorizontal,
  Sun,
  Ticket,
  User as UserIcon,
  X,
} from 'lucide-react';
import type {
  AppSettings,
  MultipleHistoryItem,
  PredictionHistoryItem,
  UserAccountRecord,
} from '../types/football.ts';
import { MULTIPLE_COMPETITIONS } from '../lib/competitions.ts';
import { updateUserDisplayName } from '../lib/firestoreSync.ts';

interface ProfileViewProps {
  authUser: User;
  userAccount: UserAccountRecord | null;
  settings: AppSettings;
  theme: 'light' | 'dark';
  bettingEnabled: boolean;
  history: PredictionHistoryItem[];
  multipleHistory: MultipleHistoryItem[];
  isSigningOut?: boolean;
  onChangeTheme: (next: 'light' | 'dark') => void;
  onSignOut: () => void;
  onOpenHistory: (section: 'multiple' | 'analysis') => void;
  onOpenSettings: () => void;
  onOpenBetting: () => void;
}

function formatBrlCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDatePt(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

const SCOPE_LABELS: Record<AppSettings['championshipScope'], string> = {
  brasil: 'Campeonatos brasileiros',
  principais: 'Principais do mundo',
  todos: 'Todos disponíveis',
};

const WINDOW_LABELS: Record<AppSettings['searchPreferences']['window'], string> = {
  today: 'Somente hoje',
  '48h': 'Próximas 48 horas',
  week: 'Próximos 7 dias',
};

export const ProfileView: React.FC<ProfileViewProps> = ({
  authUser,
  userAccount,
  settings,
  theme,
  bettingEnabled,
  history,
  multipleHistory,
  isSigningOut = false,
  onChangeTheme,
  onSignOut,
  onOpenHistory,
  onOpenSettings,
  onOpenBetting,
}) => {
  const effectiveName =
    userAccount?.displayName ||
    authUser.displayName ||
    authUser.email?.split('@')[0] ||
    'Usuário';

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(effectiveName);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameFeedback, setNameFeedback] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditingName) {
      setNameInput(effectiveName);
    }
  }, [effectiveName, isEditingName]);

  const stats = useMemo(() => {
    const resolvedMultiples = multipleHistory.filter(
      (m) => m.status === 'won' || m.status === 'lost'
    );
    const wonMultiples = resolvedMultiples.filter((m) => m.status === 'won').length;
    const pendingMultiples = multipleHistory.filter(
      (m) => m.status === 'pending'
    ).length;
    const multipleHitRatePct =
      resolvedMultiples.length > 0
        ? Math.round((wonMultiples / resolvedMultiples.length) * 100)
        : null;

    const netBalance = resolvedMultiples.reduce((acc, m) => {
      if (m.status === 'won') return acc + (m.potentialReturn - m.stake);
      if (m.status === 'lost') return acc - m.stake;
      return acc;
    }, 0);

    const finishedAnalyses = history.filter((h) => h.actualScore !== undefined);
    const wonAnalyses = finishedAnalyses.filter((h) => {
      if (!h.actualScore) return false;
      const fav =
        h.predictedHomePct >= h.predictedDrawPct &&
        h.predictedHomePct >= h.predictedAwayPct
          ? 'home'
          : h.predictedAwayPct >= h.predictedHomePct &&
              h.predictedAwayPct >= h.predictedDrawPct
            ? 'away'
            : 'draw';
      const actual =
        h.actualScore.homeGoals > h.actualScore.awayGoals
          ? 'home'
          : h.actualScore.awayGoals > h.actualScore.homeGoals
            ? 'away'
            : 'draw';
      return fav === actual;
    }).length;
    const analysisHitRatePct =
      finishedAnalyses.length > 0
        ? Math.round((wonAnalyses / finishedAnalyses.length) * 100)
        : null;

    return {
      resolvedMultiplesCount: resolvedMultiples.length,
      wonMultiples,
      pendingMultiples,
      multipleHitRatePct,
      netBalance,
      finishedAnalysesCount: finishedAnalyses.length,
      analysisHitRatePct,
    };
  }, [history, multipleHistory]);

  const favoriteLeagueLabels = useMemo(() => {
    const map = new Map<string, string>(
      MULTIPLE_COMPETITIONS.map((c) => [c.slug, c.label] as const)
    );
    return settings.searchPreferences.favoriteLeagues.map(
      (slug) => map.get(slug) || slug
    );
  }, [settings.searchPreferences.favoriteLeagues]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);
    setNameFeedback(null);
    setIsSavingName(true);
    try {
      await updateUserDisplayName(authUser, nameInput);
      setIsEditingName(false);
      setNameFeedback('Nome de exibição atualizado na sua conta.');
      window.setTimeout(() => setNameFeedback(null), 4000);
    } catch (err: any) {
      setNameError(
        err?.message || 'Não foi possível atualizar seu nome agora.'
      );
    } finally {
      setIsSavingName(false);
    }
  };

  const recentMultiples = multipleHistory.slice(0, 3);
  const recentAnalyses = history.slice(0, 3);
  const isBlocked = userAccount?.status === 'blocked';
  const initials = effectiveName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'US';

  return (
    <div className="space-y-4">
      {/* 1. Cartão Principal de Identidade do Perfil */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            {authUser.photoURL ? (
              <img
                src={authUser.photoURL}
                alt={effectiveName}
                referrerPolicy="no-referrer"
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border border-slate-200 dark:border-slate-700 object-cover shrink-0"
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-display text-xl font-bold flex items-center justify-center shrink-0">
                {initials}
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight break-words">
                  {effectiveName}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                    isBlocked
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                      : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300'
                  }`}
                >
                  <UserIcon className="w-3 h-3 shrink-0" />
                  <span>{isBlocked ? 'Conta suspensa' : 'Usuário padrão'}</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5 min-w-0 break-all">
                  <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span>{authUser.email || 'E-mail não informado'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                  <Cloud className="w-3.5 h-3.5 shrink-0" />
                  <span>Sincronização na nuvem ativa</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums pt-0.5">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                  <span>Conta criada em: {formatDatePt(userAccount?.createdAt || authUser.metadata.creationTime)}</span>
                </span>
                <span>
                  Último acesso: {formatDatePt(userAccount?.lastLoginAt || authUser.metadata.lastSignInTime)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col min-[380px]:flex-row sm:flex-col md:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
            {!isEditingName && (
              <button
                type="button"
                onClick={() => {
                  setNameInput(effectiveName);
                  setNameError(null);
                  setIsEditingName(true);
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5 shrink-0" />
                <span>Editar nome</span>
              </button>
            )}

            <button
              type="button"
              onClick={onSignOut}
              disabled={isSigningOut}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/70 bg-rose-50/70 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-60"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>{isSigningOut ? 'Saindo...' : 'Sair da conta'}</span>
            </button>
          </div>
        </div>

        {/* Formulário inline para editar nome de exibição */}
        {isEditingName && (
          <form
            onSubmit={handleSaveName}
            className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-end gap-2.5"
          >
            <div className="flex-1 min-w-0">
              <label
                htmlFor="profile-display-name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Nome de exibição no perfil
              </label>
              <input
                id="profile-display-name"
                type="text"
                maxLength={120}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Digite seu nome"
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700 dark:focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsEditingName(false);
                  setNameError(null);
                }}
                disabled={isSavingName}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center justify-center gap-1"
              >
                <X className="w-3.5 h-3.5 shrink-0" />
                <span>Cancelar</span>
              </button>
              <button
                type="submit"
                disabled={isSavingName}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{isSavingName ? 'Salvando...' : 'Salvar nome'}</span>
              </button>
            </div>
          </form>
        )}

        {nameFeedback && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{nameFeedback}</span>
          </div>
        )}

        {nameError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200">
            {nameError}
          </div>
        )}

        {/* KPI Strip da Conta */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 p-3">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Análises 1X2 salvas
            </div>
            <div className="font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
              {history.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {stats.analysisHitRatePct !== null
                ? `Acerto 1X2: ${stats.analysisHitRatePct}%`
                : 'Sem placar final ainda'}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 p-3">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Múltiplas & bilhetes
            </div>
            <div className="font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
              {multipleHistory.length}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {stats.pendingMultiples} {stats.pendingMultiples === 1 ? 'pendente' : 'pendentes'}
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/70 p-3">
            <div className="text-[11px] font-medium text-emerald-900 dark:text-emerald-200">
              Taxa em apostas
            </div>
            <div className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
              {stats.multipleHitRatePct !== null ? `${stats.multipleHitRatePct}%` : '—'}
            </div>
            <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-0.5 tabular-nums">
              {stats.wonMultiples}/{stats.resolvedMultiplesCount} resolvidas
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 p-3">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Saldo simulado
            </div>
            <div
              className={`font-mono text-xl font-bold tabular-nums mt-0.5 ${
                stats.resolvedMultiplesCount === 0
                  ? 'text-slate-900 dark:text-slate-100'
                  : stats.netBalance >= 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {stats.resolvedMultiplesCount === 0
                ? '—'
                : `${stats.netBalance >= 0 ? '+' : '-'}${formatBrlCurrency(
                    Math.abs(stats.netBalance)
                  )}`}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Baseado em bilhetes resolvidos
            </div>
          </div>
        </div>
      </section>

      {/* 2. Atividade Recente Salva */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Flame className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                  Últimas múltiplas e bilhetes
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onOpenHistory('multiple')}
                className="min-h-[36px] px-2.5 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <span>Ver todas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentMultiples.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800 px-3">
                Você ainda não salvou múltiplas ou bilhetes nesta conta.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentMultiples.map((item) => (
                  <div
                    key={item.id}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.competition}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                        {item.legs.length} {item.legs.length === 1 ? 'jogo' : 'jogos'} · Odd @
                        {item.totalOdd.toFixed(2)} · {formatBrlCurrency(item.stake)}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-bold shrink-0 ${
                        item.status === 'won'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : item.status === 'lost'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {item.status === 'won'
                        ? 'Acerto'
                        : item.status === 'lost'
                          ? 'Perda'
                          : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <BookmarkCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                  Últimas análises 1X2
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onOpenHistory('analysis')}
                className="min-h-[36px] px-2.5 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <span>Ver todas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentAnalyses.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800 px-3">
                Nenhuma análise 1X2 salva no histórico até o momento.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentAnalyses.map((item) => (
                  <div
                    key={item.id}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.homeTeam.name} × {item.awayTeam.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5 truncate">
                        {item.competition} · {item.predictedHomePct}% / {item.predictedDrawPct}% /{' '}
                        {item.predictedAwayPct}%
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0 tabular-nums">
                      {item.actualScore
                        ? `${item.actualScore.homeGoals} × ${item.actualScore.awayGoals}`
                        : `Est. ${item.mostLikelyScore}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 3. Preferências Sincronizadas & Ações Rápidas */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              Preferências sincronizadas
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configurações salvas automaticamente na sua conta em qualquer dispositivo.
            </p>
          </div>

          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onChangeTheme('light')}
              className={`flex-1 sm:flex-initial min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                theme === 'light'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Claro</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeTheme('dark')}
              className={`flex-1 sm:flex-initial min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                theme === 'dark'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Escuro</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Escopo de campeonatos
            </div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {SCOPE_LABELS[settings.championshipScope]}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Pesquisa de confrontos
            </div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {WINDOW_LABELS[settings.searchPreferences.window]}
              {settings.searchPreferences.includeLiveMatches ? ' · Com ao vivo' : ''}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
              <Bell className="w-3 h-3" />
              <span>Alertas e notificações</span>
            </div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {settings.notifications.enabled
                ? settings.notifications.browserPush
                  ? 'No app e navegador'
                  : 'Somente no aplicativo'
                : 'Desativados'}
            </div>
          </div>
        </div>

        {favoriteLeagueLabels.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Ligas prioritárias ({favoriteLeagueLabels.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {favoriteLeagueLabels.map((label) => (
                <span
                  key={label}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/70 text-[11px] font-medium text-emerald-900 dark:text-emerald-200"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" />
            <span>Ajustar preferências</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenHistory('multiple')}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <BookmarkCheck className="w-4 h-4 shrink-0" />
            <span>Abrir histórico</span>
          </button>

          {bettingEnabled && (
            <button
              type="button"
              onClick={onOpenBetting}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <Ticket className="w-4 h-4 shrink-0" />
              <span>Ir para Apostas de hoje</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
