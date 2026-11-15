import React from 'react';
import { Moon, Sun } from 'lucide-react';
import type {
  ActiveModulesConfig,
  AppSettings,
  ChampionshipScope,
  UpdateMode,
} from '../types/football.ts';

interface SettingsViewProps {
  settings: AppSettings;
  theme: 'light' | 'dark';
  onChangeTheme: (next: 'light' | 'dark') => void;
  onUpdateSettings: (next: AppSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  theme,
  onChangeTheme,
  onUpdateSettings,
}) => {
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
      {/* Aparência: Tema Claro / Escuro */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
              Aparência e configurações
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
                { id: 'brasil', title: 'Campeonatos brasileiros', sub: 'Série A, B, Copa do Brasil, Libertadores' },
                { id: 'principais', title: 'Principais do mundo', sub: 'Brasil, Premier, La Liga, Champions' },
                { id: 'todos', title: 'Todos disponíveis', sub: 'Ligas nacionais e internacionais' },
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
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{opt.sub}</div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. Módulos */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
          2. Quais análises deseja incluir?
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Desativar módulos recalcula o modelo matemático instantaneamente.
        </p>

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
                  <div className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</div>
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
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{opt.sub}</div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
