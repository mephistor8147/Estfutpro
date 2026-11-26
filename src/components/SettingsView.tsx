import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Bell,
  Cloud,
  Filter,
  LogIn,
  LogOut,
  Moon,
  ShieldCheck,
  Sliders,
  Sun,
  User as UserIcon,
  Volume2,
} from 'lucide-react';
import type {
  ActiveModulesConfig,
  AppSettings,
  ChampionshipScope,
  MatchSearchWindow,
  MatchSortMode,
  MultipleHistoryItem,
  NotificationPreferences,
  PredictionHistoryItem,
  SearchPreferences,
  UpdateMode,
  UserAccountRecord,
} from '../types/football.ts';
import { MULTIPLE_COMPETITIONS } from '../lib/competitions.ts';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from '../lib/notifications.ts';

interface SettingsViewProps {
  settings: AppSettings;
  theme: 'light' | 'dark';
  authUser: User | null;
  isAdmin: boolean;
  userAccount: UserAccountRecord | null;
  historyCount: number;
  multipleHistory: MultipleHistoryItem[];
  isSigningIn: boolean;
  isSigningOut?: boolean;
  authError: string | null;
  onSignInGoogle: () => void;
  onSignOut: () => void;
  onChangeTheme: (next: 'light' | 'dark') => void;
  onUpdateSettings: (next: AppSettings) => void;
  onTestNotification: () => void;
  onOpenAdmin?: () => void;
  onOpenProfile?: () => void;
  history?: PredictionHistoryItem[];
}

const LEAGUE_CHOICES = MULTIPLE_COMPETITIONS.filter(
  (c) => c.slug !== 'today' && c.slug !== 'tomorrow' && c.slug !== 'world'
);

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  theme,
  authUser,
  isAdmin,
  userAccount,
  historyCount,
  multipleHistory,
  isSigningIn,
  isSigningOut = false,
  authError,
  onSignInGoogle,
  onSignOut,
  onChangeTheme,
  onUpdateSettings,
  onTestNotification,
  onOpenAdmin,
  onOpenProfile,
}) => {
  const [browserPerm, setBrowserPerm] = useState(getBrowserNotificationPermission);

  const toggleModule = (key: keyof ActiveModulesConfig) => {
    onUpdateSettings({
      ...settings,
      activeModules: {
        ...settings.activeModules,
        [key]: !settings.activeModules[key],
      },
    });
  };

  const setScope = (championshipScope: ChampionshipScope) => {
    onUpdateSettings({ ...settings, championshipScope });
  };

  const setUpdateMode = (updateMode: UpdateMode) => {
    onUpdateSettings({ ...settings, updateMode });
  };

  const updateSearchPrefs = (patch: Partial<SearchPreferences>) => {
    onUpdateSettings({
      ...settings,
      searchPreferences: {
        ...settings.searchPreferences,
        ...patch,
      },
    });
  };

  const toggleFavoriteLeague = (slug: string) => {
    const current = settings.searchPreferences.favoriteLeagues;
    const exists = current.includes(slug);
    const next = exists
      ? current.filter((s) => s !== slug)
      : current.length < 12
        ? [...current, slug]
        : current;
    updateSearchPrefs({ favoriteLeagues: next });
  };

  const updateNotifications = (patch: Partial<NotificationPreferences>) => {
    onUpdateSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        ...patch,
      },
    });
  };

  const handleToggleBrowserPush = async () => {
    const nextVal = !settings.notifications.browserPush;
    if (nextVal && browserPerm !== 'granted' && browserPerm !== 'unsupported') {
      const perm = await requestBrowserNotificationPermission();
      setBrowserPerm(perm);
      if (perm === 'denied') {
        updateNotifications({ browserPush: false });
        return;
      }
    }
    updateNotifications({ browserPush: nextVal });
  };

  const resolvedMultiples = multipleHistory.filter(
    (m) => m.status === 'won' || m.status === 'lost'
  );
  const wonMultiples = resolvedMultiples.filter((m) => m.status === 'won').length;
  const hitRatePct =
    resolvedMultiples.length > 0
      ? Math.round((wonMultiples / resolvedMultiples.length) * 100)
      : null;

  const moduleOptions: { key: keyof ActiveModulesConfig; label: string; desc: string }[] = [
    {
      key: 'lastFive',
      label: 'Últimas 5 partidas',
      desc: 'Avalia momento atual, vitórias, empates, derrotas e média de gols.',
    },
    {
      key: 'headToHead',
      label: 'Histórico de confrontos diretos',
      desc: 'Considera retrospecto recente entre as duas equipes.',
    },
    {
      key: 'standings',
      label: 'Classificação do campeonato',
      desc: 'Usa força ofensiva/defensiva na temporada e aproveitamento.',
    },
    {
      key: 'poisson',
      label: 'Cálculo de probabilidades por Poisson',
      desc: 'Gera matriz completa de placares prováveis e percentuais 1X2.',
    },
    {
      key: 'goalsAndBtts',
      label: 'Estatísticas de gols e ambas marcam',
      desc: 'Inclui probabilidades de +1,5, +2,5 gols e ambas marcam.',
    },
    {
      key: 'corners',
      label: 'Estatísticas de escanteios',
      desc: 'Exibe médias de escanteios quando disponíveis nas fontes.',
    },
    {
      key: 'cards',
      label: 'Estatísticas de cartões',
      desc: 'Exibe médias disciplinares quando disponíveis nas fontes.',
    },
    {
      key: 'contextFactors',
      label: 'Fatores contextuais (Módulo 5)',
      desc: 'Aplica ajustes de desfalques, descanso, técnico e importância.',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Painel do Usuário e Sincronização em Banco de Dados */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {authUser?.photoURL ? (
              <img
                src={authUser.photoURL}
                alt={authUser.displayName || 'Avatar'}
                className="w-11 h-11 rounded-xl border border-slate-200 dark:border-slate-700 object-cover shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                {authUser ? <UserIcon className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                  {authUser ? 'Painel do usuário' : 'Backup e sincronização na nuvem'}
                </h2>
                {authUser && (
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {isAdmin ? 'Administrador' : 'Conta ativa'}
                  </span>
                )}
                {userAccount?.status === 'blocked' && (
                  <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    · Acesso suspenso
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-words line-clamp-2 sm:truncate">
                {authUser
                  ? `${userAccount?.displayName || authUser.displayName || 'Usuário'} (${authUser.email || ''}) · Sincronização ativa no banco de dados.`
                  : 'Entre com sua conta Google para salvar análises, bilhetes, alertas e preferências entre dispositivos.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
            {authUser && isAdmin && onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 rounded-xl border border-emerald-600/40 dark:border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-950/50 hover:bg-emerald-100/70 dark:hover:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Menu Admin</span>
              </button>
            )}
            {authUser && !isAdmin && onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 rounded-xl border border-emerald-600/40 dark:border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-950/50 hover:bg-emerald-100/70 dark:hover:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <UserIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Menu Perfil</span>
              </button>
            )}

            {authUser ? (
              <button
                type="button"
                onClick={onSignOut}
                disabled={isSigningOut}
                className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/70 bg-rose-50/70 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>{isSigningOut ? 'Saindo...' : 'Sair da conta'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignInGoogle}
                disabled={isSigningIn}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span>{isSigningIn ? 'Conectando...' : 'Conectar com Google'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Resumo estatístico da conta */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 min-[360px]:grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 px-3 py-2.5">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              Análises 1X2
            </div>
            <div className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
              {historyCount}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 px-3 py-2.5">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              Bilhetes salvos
            </div>
            <div className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
              {multipleHistory.length}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 px-3 py-2.5">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              Taxa de acerto
            </div>
            <div className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
              {hitRatePct !== null ? `${hitRatePct}%` : '—'}
            </div>
          </div>
        </div>

        {authError && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-800 dark:text-rose-200">
            {authError}
          </div>
        )}
      </section>

      {/* Aparência e Escopo */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
              Aparência e campeonatos
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Alterne entre tema claro e escuro ou ajuste campeonatos e módulos.
            </p>
          </div>

          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onChangeTheme('light')}
              className={`flex-1 sm:flex-initial min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                theme === 'light'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Claro</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeTheme('dark')}
              className={`flex-1 sm:flex-initial min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                theme === 'dark'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Escuro</span>
            </button>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
            1. Quais campeonatos deseja acompanhar?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(
              [
                {
                  id: 'brasil',
                  title: 'Campeonatos brasileiros',
                  sub: 'Série A, B, Copa do Brasil, Libertadores',
                },
                {
                  id: 'principais',
                  title: 'Principais do mundo',
                  sub: 'Brasil, Premier, La Liga, Champions',
                },
                {
                  id: 'todos',
                  title: 'Todos disponíveis',
                  sub: 'Ligas nacionais e internacionais',
                },
              ] as const
            ).map((opt) => {
              const active = settings.championshipScope === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setScope(opt.id)}
                  className={`min-h-[56px] p-3.5 rounded-xl border text-left transition-colors ${
                    active
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-600 dark:border-emerald-500 text-slate-900 dark:text-slate-100'
                      : 'bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold">{opt.title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {opt.sub}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Preferências de Pesquisa de Jogos */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
              Preferência de pesquisa de jogos
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Define janela temporal, exibição de partidas ao vivo, ordenação e ligas prioritárias.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Janela temporal dos jogos
            </label>
            <div className="grid grid-cols-1 min-[360px]:grid-cols-3 gap-2">
              {(
                [
                  { id: 'today', label: 'Somente hoje' },
                  { id: '48h', label: '48 horas' },
                  { id: 'week', label: '7 dias' },
                ] as { id: MatchSearchWindow; label: string }[]
              ).map((opt) => {
                const active = settings.searchPreferences.window === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateSearchPrefs({ window: opt.id })}
                    className={`min-h-[44px] px-2 py-2 rounded-xl border text-xs font-semibold transition-colors truncate ${
                      active
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-600 dark:border-emerald-500 text-emerald-900 dark:text-emerald-200'
                        : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Ordenação padrão dos confrontos
            </label>
            <div className="grid grid-cols-1 min-[360px]:grid-cols-3 gap-2">
              {(
                [
                  { id: 'time', label: 'Horário' },
                  { id: 'league', label: 'Campeonato' },
                  { id: 'odds_balance', label: 'Equilíbrio' },
                ] as { id: MatchSortMode; label: string }[]
              ).map((opt) => {
                const active = settings.searchPreferences.sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateSearchPrefs({ sortBy: opt.id })}
                    className={`min-h-[44px] px-2 py-2 rounded-xl border text-xs font-semibold transition-colors truncate ${
                      active
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-600 dark:border-emerald-500 text-emerald-900 dark:text-emerald-200'
                        : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Incluir partidas ao vivo nas pesquisas
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Exibe jogos em andamento junto aos próximos confrontos nas abas Jogos e Apostas.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Incluir partidas ao vivo nas pesquisas"
            aria-checked={settings.searchPreferences.includeLiveMatches}
            onClick={() =>
              updateSearchPrefs({
                includeLiveMatches: !settings.searchPreferences.includeLiveMatches,
              })
            }
            className="min-h-[44px] min-w-[52px] inline-flex items-center justify-end shrink-0"
          >
            <span
              className={`w-12 h-7 rounded-full transition-colors p-1 flex items-center ${
                settings.searchPreferences.includeLiveMatches
                  ? 'bg-emerald-700 dark:bg-emerald-600 justify-end'
                  : 'bg-slate-300 dark:bg-slate-700 justify-start'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
            </span>
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Campeonatos prioritários ({settings.searchPreferences.favoriteLeagues.length}/12)
            </span>
            {settings.searchPreferences.favoriteLeagues.length > 0 && (
              <button
                type="button"
                onClick={() => updateSearchPrefs({ favoriteLeagues: [] })}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Limpar seleção
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
            {LEAGUE_CHOICES.map((lg) => {
              const selected = settings.searchPreferences.favoriteLeagues.includes(
                lg.slug
              );
              return (
                <button
                  key={lg.slug}
                  type="button"
                  onClick={() => toggleFavoriteLeague(lg.slug)}
                  className={`min-h-[44px] px-2.5 py-1.5 rounded-lg border text-left text-xs font-medium truncate transition-colors ${
                    selected
                      ? 'bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-600 dark:border-emerald-500 text-emerald-900 dark:text-emerald-200'
                      : 'bg-slate-50/80 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title={lg.label}
                >
                  {lg.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Ajustes de Notificação */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                Ajustes de notificação
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Receba alertas sobre atualização de placares ao vivo, bilhetes encerrados e dicas do dia.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onTestNotification}
            className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Bell className="w-3.5 h-3.5 shrink-0" />
            <span>Testar notificação</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 divide-y md:divide-y-0 md:gap-y-2 divide-slate-100 dark:divide-slate-800">
          {(
            [
              {
                key: 'enabled',
                label: 'Alertas internos do aplicativo',
                desc: 'Mostra avisos discretos no topo quando há novidades.',
                checked: settings.notifications.enabled,
                onToggle: () =>
                  updateNotifications({ enabled: !settings.notifications.enabled }),
              },
              {
                key: 'browserPush',
                label: `Notificações do navegador (${
                  browserPerm === 'granted'
                    ? 'Permitido'
                    : browserPerm === 'denied'
                      ? 'Bloqueado'
                      : browserPerm === 'unsupported'
                        ? 'Indisponível'
                        : 'Sob demanda'
                })`,
                desc: 'Exibe alertas nativos do sistema mesmo com a aba em segundo plano.',
                checked: settings.notifications.browserPush,
                onToggle: () => void handleToggleBrowserPush(),
              },
              {
                key: 'notifyLiveGoals',
                label: 'Alertar gols e encerramentos ao vivo',
                desc: 'Notifica mudanças de placar nas partidas salvas no Histórico.',
                checked: settings.notifications.notifyLiveGoals,
                onToggle: () =>
                  updateNotifications({
                    notifyLiveGoals: !settings.notifications.notifyLiveGoals,
                  }),
              },
              {
                key: 'notifyBetResolved',
                label: 'Alertar bilhete ganho ou perdido',
                desc: 'Avisa assim que todas as seleções de uma múltipla encerrarem.',
                checked: settings.notifications.notifyBetResolved,
                onToggle: () =>
                  updateNotifications({
                    notifyBetResolved: !settings.notifications.notifyBetResolved,
                  }),
              },
              {
                key: 'notifyDailySuperTip',
                label: 'Aviso da Super Dica Combinada do dia',
                desc: 'Notifica quando uma nova rodada diária estiver carregada.',
                checked: settings.notifications.notifyDailySuperTip,
                onToggle: () =>
                  updateNotifications({
                    notifyDailySuperTip: !settings.notifications.notifyDailySuperTip,
                  }),
              },
              {
                key: 'soundEnabled',
                label: 'Sinal sonoro discreto',
                desc: 'Emite um toque breve ao receber uma notificação importante.',
                checked: settings.notifications.soundEnabled,
                onToggle: () =>
                  updateNotifications({
                    soundEnabled: !settings.notifications.soundEnabled,
                  }),
              },
            ] as const
          ).map((item) => (
            <div
              key={item.key}
              className="py-3 md:py-2.5 md:border-b md:border-slate-100 md:dark:border-slate-800 flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-start gap-1.5 leading-snug">
                  {item.key === 'soundEnabled' && (
                    <Volume2 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  )}
                  <span>{item.label}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {item.desc}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-label={item.label}
                aria-checked={item.checked}
                onClick={item.onToggle}
                className="min-h-[44px] min-w-[52px] inline-flex items-center justify-end shrink-0"
              >
                <span
                  className={`w-12 h-7 rounded-full transition-colors p-1 flex items-center ${
                    item.checked
                      ? 'bg-emerald-700 dark:bg-emerald-600 justify-end'
                      : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                </span>
              </button>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Antecedência para lembrete de início de jogo
          </label>
          <div className="grid grid-cols-2 min-[380px]:grid-cols-4 gap-2 w-full sm:max-w-md">
            {([0, 15, 30, 60] as const).map((mins) => {
              const active = settings.notifications.notifyKickoffMinutes === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => updateNotifications({ notifyKickoffMinutes: mins })}
                  className={`min-h-[44px] px-2 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-600 dark:border-emerald-500 text-emerald-900 dark:text-emerald-200'
                      : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {mins === 0 ? 'Desligado' : `${mins} min`}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. Módulos */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
        <div className="flex items-start gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              2. Quais análises deseja incluir?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Desativar módulos recalcula o modelo matemático instantaneamente.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 divide-y md:divide-y-0 md:gap-y-2 divide-slate-100 dark:divide-slate-800">
          {moduleOptions.map((item) => {
            const enabled = settings.activeModules[item.key];
            return (
              <div
                key={item.key}
                className="py-3 md:py-2.5 md:border-b md:border-slate-100 md:dark:border-slate-800 flex items-center justify-between gap-3 sm:gap-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {item.label}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {item.desc}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-label={item.label}
                  aria-checked={enabled}
                  onClick={() => toggleModule(item.key)}
                  className="min-h-[44px] min-w-[52px] inline-flex items-center justify-end shrink-0"
                >
                  <span
                    className={`w-12 h-7 rounded-full transition-colors p-1 flex items-center ${
                      enabled
                        ? 'bg-emerald-700 dark:bg-emerald-600 justify-end'
                        : 'bg-slate-300 dark:bg-slate-700 justify-start'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Pesos matemáticos e Atualização */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              3. Calibração do modelo matemático
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Controle o equilíbrio entre forma recente e desempenho da temporada.
            </p>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Peso das últimas 5 partidas
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {Math.round(settings.recentFormWeight * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.15}
              max={0.55}
              step={0.05}
              value={settings.recentFormWeight}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  recentFormWeight: parseFloat(e.target.value),
                })
              }
              className="w-full accent-emerald-700 dark:accent-emerald-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Fator mando de campo
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {settings.homeAdvantageMultiplier.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min={1.0}
              max={1.25}
              step={0.02}
              value={settings.homeAdvantageMultiplier}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  homeAdvantageMultiplier: parseFloat(e.target.value),
                })
              }
              className="w-full accent-emerald-700 dark:accent-emerald-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
            />
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
            4. Como deseja atualizar os dados?
          </h3>
          <div className="space-y-2.5">
            {(
              [
                {
                  id: 'auto',
                  title: 'Automaticamente pela Internet',
                  sub: 'Inicia a análise automaticamente ao selecionar um confronto na aba Jogos.',
                },
                {
                  id: 'manual',
                  title: 'Somente quando solicitar uma análise',
                  sub: 'Preenche os campos do Analisador e aguarda seu toque em Calcular probabilidades.',
                },
              ] as const
            ).map((opt) => {
              const active = settings.updateMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setUpdateMode(opt.id)}
                  className={`w-full min-h-[56px] p-3.5 rounded-xl border text-left transition-colors ${
                    active
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-600 dark:border-emerald-500 text-slate-900 dark:text-slate-100'
                      : 'bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold">{opt.title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {opt.sub}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
