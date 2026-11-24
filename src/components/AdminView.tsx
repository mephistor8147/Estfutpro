import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Ban,
  CheckCircle2,
  Lock,
  LogIn,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type {
  AppGlobalConfig,
  ChampionshipScope,
  MatchSearchWindow,
  UserAccountRecord,
} from '../types/football.ts';
import {
  adminUpdateUserAccount,
  BOOTSTRAPPED_ADMIN_EMAIL,
  DEFAULT_APP_GLOBAL_CONFIG,
  isBootstrappedAdminEmail,
  saveAppGlobalConfig,
  subscribeAllUserAccounts,
} from '../lib/firestoreSync.ts';

interface AdminViewProps {
  authUser: User | null;
  isAdmin: boolean;
  isSigningIn: boolean;
  globalConfig: AppGlobalConfig;
  onSignInGoogle: () => void;
}

type AdminSubTab = 'config' | 'users';

export const AdminView: React.FC<AdminViewProps> = ({
  authUser,
  isAdmin,
  isSigningIn,
  globalConfig,
  onSignInGoogle,
}) => {
  const [subTab, setSubTab] = useState<AdminSubTab>('config');
  const [draftConfig, setDraftConfig] = useState<AppGlobalConfig>(globalConfig);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const [users, setUsers] = useState<UserAccountRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  useEffect(() => {
    setDraftConfig(globalConfig);
  }, [globalConfig]);

  useEffect(() => {
    if (!authUser || !isAdmin) {
      setUsers([]);
      return;
    }
    setUsersLoading(true);
    setUsersError(null);
    const unsub = subscribeAllUserAccounts(
      (list) => {
        setUsers(list);
        setUsersLoading(false);
      },
      (err) => {
        setUsersError(
          err?.message || 'Não foi possível carregar o diretório de usuários.'
        );
        setUsersLoading(false);
      }
    );
    return () => unsub();
  }, [authUser, isAdmin]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
  }, [users, userSearch, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const blocked = users.filter((u) => u.status === 'blocked').length;
    return {
      total,
      admins,
      active: total - blocked,
      blocked,
    };
  }, [users]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !isAdmin) return;
    setSavingConfig(true);
    setConfigFeedback(null);
    setConfigError(null);
    try {
      await saveAppGlobalConfig(authUser, draftConfig);
      setConfigFeedback('Configurações globais salvas e aplicadas ao aplicativo.');
      setTimeout(() => setConfigFeedback(null), 4000);
    } catch (err: any) {
      setConfigError(
        err?.message || 'Erro ao salvar configurações globais no banco de dados.'
      );
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggleRole = async (target: UserAccountRecord) => {
    if (!authUser || !isAdmin) return;
    if (isBootstrappedAdminEmail(target.email) || target.uid === authUser.uid) {
      return;
    }
    setUpdatingUid(target.uid);
    setUsersError(null);
    try {
      await adminUpdateUserAccount(authUser, target, {
        role: target.role === 'admin' ? 'user' : 'admin',
      });
    } catch (err: any) {
      setUsersError(err?.message || 'Falha ao atualizar permissão do usuário.');
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleToggleStatus = async (target: UserAccountRecord) => {
    if (!authUser || !isAdmin) return;
    if (isBootstrappedAdminEmail(target.email) || target.uid === authUser.uid) {
      return;
    }
    setUpdatingUid(target.uid);
    setUsersError(null);
    try {
      await adminUpdateUserAccount(authUser, target, {
        status: target.status === 'blocked' ? 'active' : 'blocked',
      });
    } catch (err: any) {
      setUsersError(err?.message || 'Falha ao atualizar status da conta.');
    } finally {
      setUpdatingUid(null);
    }
  };

  if (!authUser) {
    return (
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 text-center max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 mt-4">
          Menu administrativo restrito
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
          Entre com a conta Google de administrador para configurar parâmetros globais do aplicativo e gerenciar o painel de usuários.
        </p>
        <button
          type="button"
          onClick={onSignInGoogle}
          disabled={isSigningIn}
          className="mt-5 min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
        >
          <LogIn className="w-4 h-4" />
          <span>{isSigningIn ? 'Conectando...' : 'Entrar com Google'}</span>
        </button>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200/90 dark:border-rose-900/60 p-6 sm:p-8 text-center max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 mt-4">
          Acesso exclusivo para administradores
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
          A conta conectada (<strong className="text-slate-700 dark:text-slate-200">{authUser.email}</strong>) possui perfil padrão de usuário. Solicite acesso ao administrador principal ({BOOTSTRAPPED_ADMIN_EMAIL}).
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho Administrativo */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
                Administração do aplicativo
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sessão autenticada como {authUser.email}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 w-full sm:w-auto gap-1">
            <button
              type="button"
              onClick={() => setSubTab('config')}
              className={`min-h-[44px] px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                subTab === 'config'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              <span className="min-[440px]:hidden">Configurações</span>
              <span className="hidden min-[440px]:inline">Configurações globais</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('users')}
              className={`min-h-[44px] px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                subTab === 'users'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span className="min-[440px]:hidden">Usuários ({users.length})</span>
              <span className="hidden min-[440px]:inline">Painel de usuários ({users.length})</span>
            </button>
          </div>
        </div>
      </section>

      {subTab === 'config' ? (
        <form
          onSubmit={handleSaveConfig}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 space-y-5"
        >
          {configFeedback && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{configFeedback}</span>
            </div>
          )}
          {configError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200">
              {configError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nome público do aplicativo
              </label>
              <input
                type="text"
                maxLength={80}
                required
                value={draftConfig.appName}
                onChange={(e) =>
                  setDraftConfig((c) => ({ ...c, appName: e.target.value }))
                }
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Banner / comunicado global (opcional)
              </label>
              <input
                type="text"
                maxLength={280}
                placeholder="Ex: Rodada do Brasileirão atualizada às 14h"
                value={draftConfig.announcementBanner}
                onChange={(e) =>
                  setDraftConfig((c) => ({
                    ...c,
                    announcementBanner: e.target.value,
                  }))
                }
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3 py-1">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Habilitar menu Apostas (jogos do dia)
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Controla a exibição da aba Apostas com odds do dia na navegação.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-label="Habilitar menu Apostas"
                aria-checked={draftConfig.bettingMenuEnabled}
                onClick={() =>
                  setDraftConfig((c) => ({
                    ...c,
                    bettingMenuEnabled: !c.bettingMenuEnabled,
                  }))
                }
                className="min-h-[44px] min-w-[52px] inline-flex items-center justify-end shrink-0"
              >
                <span
                  className={`w-12 h-7 rounded-full transition-colors p-1 flex items-center ${
                    draftConfig.bettingMenuEnabled
                      ? 'bg-emerald-700 dark:bg-emerald-600 justify-end'
                      : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                </span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 py-1">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Modo aviso de manutenção
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Exibe faixa de manutenção no topo para todos os usuários.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-label="Modo aviso de manutenção"
                aria-checked={draftConfig.maintenanceMode}
                onClick={() =>
                  setDraftConfig((c) => ({
                    ...c,
                    maintenanceMode: !c.maintenanceMode,
                  }))
                }
                className="min-h-[44px] min-w-[52px] inline-flex items-center justify-end shrink-0"
              >
                <span
                  className={`w-12 h-7 rounded-full transition-colors p-1 flex items-center ${
                    draftConfig.maintenanceMode
                      ? 'bg-amber-600 justify-end'
                      : 'bg-slate-300 dark:bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Escopo padrão (novos visitantes)
              </label>
              <select
                value={draftConfig.defaultChampionshipScope}
                onChange={(e) =>
                  setDraftConfig((c) => ({
                    ...c,
                    defaultChampionshipScope: e.target.value as ChampionshipScope,
                  }))
                }
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100"
              >
                <option value="brasil">Campeonatos brasileiros</option>
                <option value="principais">Principais do mundo</option>
                <option value="todos">Todos disponíveis</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Qtd. padrão de jogos em Dicas Quentes
              </label>
              <select
                value={draftConfig.defaultMultipleCount}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setDraftConfig((c) => ({
                    ...c,
                    defaultMultipleCount:
                      n === 4 || n === 5 || n === 10 ? n : 3,
                  }));
                }}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100"
              >
                <option value={3}>3 jogos</option>
                <option value={4}>4 jogos</option>
                <option value={5}>5 jogos</option>
                <option value={10}>10 jogos</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Janela padrão de pesquisa
              </label>
              <select
                value={draftConfig.defaultSearchWindow}
                onChange={(e) =>
                  setDraftConfig((c) => ({
                    ...c,
                    defaultSearchWindow: e.target.value as MatchSearchWindow,
                  }))
                }
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100"
              >
                <option value="today">Somente hoje</option>
                <option value="48h">Próximas 48h</option>
                <option value="week">Próximos 7 dias</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Margem calibrada das odds no menu Apostas
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {draftConfig.oddsMarginPct}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={draftConfig.oddsMarginPct}
                onChange={(e) =>
                  setDraftConfig((c) => ({
                    ...c,
                    oddsMarginPct: Number(e.target.value),
                  }))
                }
                className="w-full accent-emerald-700 dark:accent-emerald-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Probabilidade mínima para selo de destaque
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {draftConfig.minTipProbabilityPct}%
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={90}
                step={5}
                value={draftConfig.minTipProbabilityPct}
                onChange={(e) =>
                  setDraftConfig((c) => ({
                    ...c,
                    minTipProbabilityPct: Number(e.target.value),
                  }))
                }
                className="w-full accent-emerald-700 dark:accent-emerald-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => setDraftConfig({ ...DEFAULT_APP_GLOBAL_CONFIG })}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar padrão</span>
            </button>

            <button
              type="submit"
              disabled={savingConfig}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingConfig ? 'Salvando...' : 'Salvar configurações globais'}</span>
            </button>
          </div>
        </form>
      ) : (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 p-3">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Total de usuários
              </div>
              <div className="font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {stats.total}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 p-3">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Administradores
              </div>
              <div className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {stats.admins}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 p-3">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Contas ativas
              </div>
              <div className="font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {stats.active}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 p-3">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Bloqueadas
              </div>
              <div className="font-mono text-xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                {stats.blocked}
              </div>
            </div>
          </div>

          {/* Filtros do diretório */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar usuário por nome ou e-mail..."
                className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>
            <div className="sm:col-span-3">
              <select
                value={roleFilter}
                onChange={(e) =>
                  setRoleFilter(e.target.value as 'all' | 'admin' | 'user')
                }
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="all">Todos os perfis</option>
                <option value="admin">Somente Admins</option>
                <option value="user">Usuários padrão</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | 'active' | 'blocked')
                }
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="all">Todos os status</option>
                <option value="active">Ativos</option>
                <option value="blocked">Bloqueados</option>
              </select>
            </div>
          </div>

          {usersError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200">
              {usersError}
            </div>
          )}

          {usersLoading ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Carregando contas registradas...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Nenhum usuário encontrado com estes filtros.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.map((account) => {
                const isRoot = isBootstrappedAdminEmail(account.email);
                const isSelf = account.uid === authUser.uid;
                const locked = isRoot || isSelf;
                const busy = updatingUid === account.uid;

                return (
                  <div
                    key={account.uid}
                    className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {account.photoURL ? (
                        <img
                          src={account.photoURL}
                          alt={account.displayName}
                          className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shrink-0">
                          {account.displayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {account.displayName}
                          </span>
                          <span
                            className={`text-[11px] font-semibold ${
                              account.role === 'admin'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {account.role === 'admin' ? 'Admin' : 'Usuário'}
                          </span>
                          {account.status === 'blocked' && (
                            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                              · Bloqueado
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {account.email}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                          {account.analysesCount} análises · {account.multiplesCount} bilhetes · Último acesso:{' '}
                          {new Intl.DateTimeFormat('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(account.lastLoginAt))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
                      <button
                        type="button"
                        disabled={locked || busy}
                        onClick={() => void handleToggleRole(account)}
                        className="min-h-[44px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-40 transition-colors whitespace-nowrap flex items-center justify-center"
                      >
                        {account.role === 'admin' ? 'Remover Admin' : 'Promover a Admin'}
                      </button>
                      <button
                        type="button"
                        disabled={locked || busy}
                        onClick={() => void handleToggleStatus(account)}
                        className={`min-h-[44px] px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1 disabled:opacity-40 transition-colors whitespace-nowrap ${
                          account.status === 'blocked'
                            ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                            : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5 shrink-0" />
                        <span>{account.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
