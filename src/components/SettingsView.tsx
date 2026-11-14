import React from 'react';
import type {
  ActiveModulesConfig,
  AppSettings,
  ChampionshipScope,
  UpdateMode,
} from '../types/football.ts';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
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
      {/* 1. Campeonatos */}
      <section className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5">
        <h2 className="font-display text-xl font-bold text-slate-900">
          Configuração do analisador
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Personalize os campeonatos sugeridos, módulos ativos e pesos do modelo de Poisson.
        </p>

        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-2.5">
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
                      ? 'bg-emerald-50/80 border-emerald-600 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-bold">{opt.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{opt.sub}</div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. Módulos */}
      <section className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          2. Quais análises deseja incluir?
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Desativar módulos recalcula o modelo matemático instantaneamente.
        </p>

        <div className="divide-y divide-slate-100">
          {moduleOptions.map((item) => {
            const enabled = settings.activeModules[item.key];
            return (
              <div
                key={item.key}
                className="py-3 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.desc}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => toggleModule(item.key)}
                  className={`relative shrink-0 w-12 h-7 rounded-full transition-colors p-1 flex items-center ${
                    enabled ? 'bg-emerald-700 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Pesos matemáticos e Atualização */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              3. Calibração do modelo matemático
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Controle o equilíbrio entre forma recente e desempenho da temporada.
            </p>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium text-slate-700">Peso das últimas 5 partidas</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
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
              className="w-full accent-emerald-700 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium text-slate-700">Fator mando de campo</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
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
              className="w-full accent-emerald-700 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-2.5">
            4. Como deseja atualizar os dados?
          </h3>
          <div className="space-y-2.5">
            {(
              [
                {
                  id: 'auto',
                  title: 'Automaticamente pela Internet',
                  sub: 'Busca jogos atuais ao abrir e inicia a análise imediatamente ao tocar em um confronto.',
                },
                {
                  id: 'manual',
                  title: 'Somente quando solicitar uma análise',
                  sub: 'Preenche os campos do confronto selecionado e aguarda seu toque em Calcular Probabilidades.',
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
                      ? 'bg-emerald-50/80 border-emerald-600 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-bold">{opt.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{opt.sub}</div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
