import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ArrowLeftRight,
  BarChart2,
  BookmarkCheck,
  Compass,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { calculatePoissonModel } from './lib/poisson.ts';
import { ProbabilityHero } from './components/ProbabilityHero.tsx';
import { ModulesView } from './components/ModulesView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import type {
  AnalysisResponsePayload,
  AppSettings,
  PredictionHistoryItem,
  SuggestedFixture,
} from './types/football.ts';

type AppTab = 'compare' | 'modules' | 'history' | 'settings';

const STORAGE_SETTINGS_KEY = 'campostats_settings_v1';
const STORAGE_HISTORY_KEY = 'campostats_history_v1';

const DEFAULT_SETTINGS: AppSettings = {
  championshipScope: 'brasil',
  updateMode: 'auto',
  activeModules: {
    lastFive: true,
    headToHead: true,
    standings: true,
    poisson: true,
    goalsAndBtts: true,
    corners: true,
    cards: true,
    contextFactors: true,
  },
  recentFormWeight: 0.35,
  homeAdvantageMultiplier: 1.12,
};

const QUICK_LEAGUES = [
  'Brasileirão Série A',
  'Copa do Brasil',
  'Copa Libertadores',
  'Premier League',
  'UEFA Champions League',
  'La Liga',
];

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('compare');

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          activeModules: {
            ...DEFAULT_SETTINGS.activeModules,
            ...parsed.activeModules,
          },
        };
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_SETTINGS;
  });

  const [history, setHistory] = useState<PredictionHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore storage errors
    }
    return [];
  });

  const [homeTeamInput, setHomeTeamInput] = useState('Flamengo');
  const [awayTeamInput, setAwayTeamInput] = useState('Palmeiras');
  const [competitionInput, setCompetitionInput] = useState('Brasileirão Série A');

  const [analysis, setAnalysis] = useState<AnalysisResponsePayload | null>(null);
  const [contextDelta, setContextDelta] = useState<{ home: number; away: number }>({
    home: 0,
    away: 0,
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [fixtures, setFixtures] = useState<SuggestedFixture[]>([]);
  const [isLoadingFixtures, setIsLoadingFixtures] = useState(false);
  const [fixturesError, setFixturesError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Ignore
    }
  }, [history]);

  const fetchFixtures = useCallback(async (scope: AppSettings['championshipScope'], forceRefresh = true) => {
    setIsLoadingFixtures(true);
    setFixturesError(null);
    try {
      const res = await fetch('/api/fixtures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, forceRefresh }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao buscar jogos.');
      }
      setFixtures(Array.isArray(json.fixtures) ? json.fixtures : []);
    } catch (err: any) {
      setFixturesError(err?.message || 'Falha ao carregar confrontos atuais.');
    } finally {
      setIsLoadingFixtures(false);
    }
  }, []);

  const runAnalysis = useCallback(
    async (home: string, away: string, comp: string, forceRefresh = false) => {
      const h = home.trim();
      const a = away.trim();
      if (!h || !a) {
        setAnalyzeError('Informe o Time Mandante e o Time Visitante para iniciar.');
        return;
      }
      setIsAnalyzing(true);
      setAnalyzeError(null);
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            homeTeam: h,
            awayTeam: a,
            competition: comp.trim(),
            forceRefresh,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Não foi possível concluir a análise.');
        }
        const payload = json as AnalysisResponsePayload;
        setAnalysis(payload);
        setContextDelta({
          home: payload.data.module5Context.contextualImpactHome ?? 0,
          away: payload.data.module5Context.contextualImpactAway ?? 0,
        });
      } catch (err: any) {
        setAnalyzeError(
          err?.message || 'Erro ao consultar dados atualizados na Internet.'
        );
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runAnalysis(homeTeamInput, awayTeamInput, competitionInput);
  };

  const handleSwapTeams = () => {
    setHomeTeamInput(awayTeamInput);
    setAwayTeamInput(homeTeamInput);
  };

  const handleSelectFixture = (fixture: SuggestedFixture) => {
    setHomeTeamInput(fixture.homeTeam);
    setAwayTeamInput(fixture.awayTeam);
    setCompetitionInput(fixture.competition);
    if (settings.updateMode === 'auto') {
      runAnalysis(fixture.homeTeam, fixture.awayTeam, fixture.competition);
    }
  };

  const model = useMemo(() => {
    if (!analysis) return null;
    return calculatePoissonModel(analysis.data, settings, {
      homeDelta: contextDelta.home,
      awayDelta: contextDelta.away,
    });
  }, [analysis, settings, contextDelta]);

  const isSavedInHistory = useMemo(() => {
    if (!analysis) return false;
    return history.some((item) => item.id === analysis.id);
  }, [analysis, history]);

  const handleSaveToHistory = () => {
    if (!analysis || !model || isSavedInHistory) return;
    const entry: PredictionHistoryItem = {
      id: analysis.id,
      createdAt: new Date().toISOString(),
      updatedAt: analysis.updatedAt,
      competition: analysis.data.competition,
      homeTeam: analysis.data.homeTeam,
      awayTeam: analysis.data.awayTeam,
      predictedHomePct: model.homeWinPct,
      predictedDrawPct: model.drawPct,
      predictedAwayPct: model.awayWinPct,
      expectedGoalsHome: model.expectedGoalsHome,
      expectedGoalsAway: model.expectedGoalsAway,
      mostLikelyScore: `${model.mostLikelyScore.homeGoals} x ${model.mostLikelyScore.awayGoals}`,
      over25Pct: model.over25Pct,
      bttsPct: model.bttsPct,
      snapshot: analysis,
    };
    setHistory((prev) => [entry, ...prev]);
  };

  const handleRecordScore = (id: string, homeGoals: number, awayGoals: number) => {
    setHistory((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              actualScore: {
                homeGoals,
                awayGoals,
                recordedAt: new Date().toISOString(),
              },
            }
          : item
      )
    );
  };

  const handleDeleteHistory = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleLoadSnapshot = (item: PredictionHistoryItem) => {
    if (!item.snapshot) return;
    setAnalysis(item.snapshot);
    setHomeTeamInput(item.snapshot.data.homeTeam.name);
    setAwayTeamInput(item.snapshot.data.awayTeam.name);
    setCompetitionInput(item.snapshot.data.competition);
    setContextDelta({
      home: item.snapshot.data.module5Context.contextualImpactHome ?? 0,
      away: item.snapshot.data.module5Context.contextualImpactAway ?? 0,
    });
    setActiveTab('compare');
  };

  const navItems: { id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'compare', label: 'Comparar', icon: Compass },
    { id: 'modules', label: 'Módulos', icon: Layers },
    { id: 'history', label: 'Histórico', icon: BookmarkCheck },
    { id: 'settings', label: 'Ajustes', icon: SlidersHorizontal },
  ];

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-slate-900 pb-20 lg:pb-10">
      {/* Compact Sticky Header (Mobile 48px / Desktop 3-Zone Top Bar) */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 h-12 lg:h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('compare');
            }}
            className="font-display text-xl lg:text-2xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            CampoStats
          </a>

          {/* Desktop Navigation (3-zone contract) */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    active
                      ? 'text-slate-900 border-emerald-700 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('compare');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
            >
              Nova análise
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="top" className="max-w-6xl mx-auto px-4 pt-4 sm:pt-6">
        {/* TAB 1: COMPARAR */}
        {activeTab === 'compare' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column on Desktop / Top on Mobile: Search & Upcoming Fixtures */}
            <div className="lg:col-span-5 space-y-4">
              <section className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
                <div className="mb-4">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight text-balance">
                    Analisador estatístico de futebol
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Consulta dados atualizados na Internet e calcula probabilidades pelo modelo de Poisson.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                    <div>
                      <label
                        htmlFor="home-team"
                        className="block text-xs font-semibold text-emerald-800 mb-1"
                      >
                        Time A (Mandante)
                      </label>
                      <input
                        id="home-team"
                        type="text"
                        value={homeTeamInput}
                        onChange={(e) => setHomeTeamInput(e.target.value)}
                        placeholder="Ex: Flamengo"
                        className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleSwapTeams}
                      aria-label="Inverter mandante e visitante"
                      className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                    </button>

                    <div>
                      <label
                        htmlFor="away-team"
                        className="block text-xs font-semibold text-blue-800 mb-1"
                      >
                        Time B (Visitante)
                      </label>
                      <input
                        id="away-team"
                        type="text"
                        value={awayTeamInput}
                        onChange={(e) => setAwayTeamInput(e.target.value)}
                        placeholder="Ex: Palmeiras"
                        className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="competition"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Campeonato
                    </label>
                    <input
                      id="competition"
                      type="text"
                      value={competitionInput}
                      onChange={(e) => setCompetitionInput(e.target.value)}
                      placeholder="Ex: Brasileirão Série A, Champions League"
                      className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700"
                    />
                    <div className="mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                      {QUICK_LEAGUES.map((league) => (
                        <button
                          key={league}
                          type="button"
                          onClick={() => setCompetitionInput(league)}
                          className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors border ${
                            competitionInput === league
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {league}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isAnalyzing}
                    className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-65"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span>Pesquisando dados e calculando...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 shrink-0" />
                        <span>Calcular probabilidades</span>
                      </>
                    )}
                  </button>
                </form>

                {analyzeError && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                    {analyzeError}
                  </div>
                )}
              </section>

              {/* Live / Upcoming Fixtures Picker */}
              <section className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      {fixtures.length > 0 ? 'Jogos em destaque na web' : 'Confrontos para teste rápido'}
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Toque em um confronto para preencher{' '}
                      {settings.updateMode === 'auto' ? 'e analisar' : 'os campos'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchFixtures(settings.championshipScope, true)}
                    disabled={isLoadingFixtures}
                    className="min-h-[44px] px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 shrink-0"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isLoadingFixtures ? 'animate-spin' : ''}`}
                    />
                    <span>Buscar na web</span>
                  </button>
                </div>

                {fixturesError && (
                  <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    {fixturesError}
                  </div>
                )}

                {isLoadingFixtures && fixtures.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                    <span>Buscando jogos atuais pela Internet...</span>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {(fixtures.length > 0
                      ? fixtures
                      : settings.championshipScope === 'brasil'
                        ? [
                            { homeTeam: 'Flamengo', awayTeam: 'Palmeiras', competition: 'Brasileirão Série A', dateLabel: 'Clássico nacional' },
                            { homeTeam: 'Botafogo', awayTeam: 'Atlético-MG', competition: 'Brasileirão Série A', dateLabel: 'Série A' },
                            { homeTeam: 'São Paulo', awayTeam: 'Corinthians', competition: 'Brasileirão Série A', dateLabel: 'Majestoso' },
                            { homeTeam: 'Internacional', awayTeam: 'Grêmio', competition: 'Brasileirão Série A', dateLabel: 'Gre-Nal' },
                          ]
                        : [
                            { homeTeam: 'Real Madrid', awayTeam: 'Barcelona', competition: 'La Liga', dateLabel: 'El Clásico' },
                            { homeTeam: 'Arsenal', awayTeam: 'Liverpool', competition: 'Premier League', dateLabel: 'Premier League' },
                            { homeTeam: 'Flamengo', awayTeam: 'Palmeiras', competition: 'Brasileirão Série A', dateLabel: 'Série A' },
                            { homeTeam: 'Inter de Milão', awayTeam: 'Juventus', competition: 'Serie A Itália', dateLabel: 'Derby d’Italia' },
                          ]
                    ).map((fx, idx) => (
                      <button
                        key={`${fx.homeTeam}-${fx.awayTeam}-${idx}`}
                        type="button"
                        onClick={() => handleSelectFixture(fx)}
                        className="w-full min-h-[56px] py-2.5 px-2 -mx-2 rounded-xl hover:bg-slate-50 active:bg-slate-100 flex items-center justify-between gap-3 text-left transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {fx.homeTeam} × {fx.awayTeam}
                          </div>
                          <div className="text-xs text-slate-500 truncate mt-0.5">
                            {fx.competition} · {fx.dateLabel}
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-emerald-700 shrink-0">
                          Selecionar
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right Column on Desktop / Below on Mobile: Results */}
            <div className="lg:col-span-7 space-y-4">
              {isAnalyzing ? (
                <section className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-700 mx-auto" />
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    Consultando fontes esportivas ao vivo
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                    Coletando últimas 5 partidas, confrontos diretos, classificação atual, estatísticas complementares e fatores de campo para {homeTeamInput} × {awayTeamInput}.
                  </p>
                </section>
              ) : analysis && model ? (
                <ProbabilityHero
                  analysis={analysis}
                  model={model}
                  isSaved={isSavedInHistory}
                  isRefreshing={isAnalyzing}
                  onSaveToHistory={handleSaveToHistory}
                  onRefresh={() =>
                    runAnalysis(
                      analysis.data.homeTeam.name,
                      analysis.data.awayTeam.name,
                      analysis.data.competition,
                      true
                    )
                  }
                  onOpenModules={() => setActiveTab('modules')}
                />
              ) : (
                <section className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/70 text-emerald-700 flex items-center justify-center mx-auto">
                    <BarChart2 className="w-6 h-6" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-slate-900">
                    Pronto para analisar qualquer confronto
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                    Escolha dois times ao lado ou toque em um dos jogos em destaque para buscar estatísticas reais na Internet e gerar a matriz de probabilidades por Poisson.
                  </p>
                  <div className="pt-2 grid grid-cols-3 gap-2 max-w-sm mx-auto text-xs text-slate-600">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                      <div className="font-semibold text-slate-900">5 Módulos</div>
                      <div className="text-[11px] text-slate-500">Forma, H2H, Tabela</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                      <div className="font-semibold text-slate-900">Poisson</div>
                      <div className="text-[11px] text-slate-500">Matriz de placares</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                      <div className="font-semibold text-slate-900">Tempo real</div>
                      <div className="text-[11px] text-slate-500">Fontes da web</div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MÓDULOS */}
        {activeTab === 'modules' && (
          <div className="space-y-4">
            {analysis && model ? (
              <>
                <div className="bg-white rounded-2xl border border-slate-200/90 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {analysis.data.homeTeam.name} × {analysis.data.awayTeam.name}
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-600">
                    {model.homeWinPct}% · {model.drawPct}% · {model.awayWinPct}% (Placar{' '}
                    {model.mostLikelyScore.homeGoals}x{model.mostLikelyScore.awayGoals})
                  </div>
                </div>
                <ModulesView
                  analysis={analysis}
                  model={model}
                  settings={settings}
                  contextDelta={contextDelta}
                  onChangeContextDelta={setContextDelta}
                  onResetContextDelta={() =>
                    setContextDelta({
                      home: analysis.data.module5Context.contextualImpactHome ?? 0,
                      away: analysis.data.module5Context.contextualImpactAway ?? 0,
                    })
                  }
                />
              </>
            ) : (
              <section className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center space-y-3">
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Nenhuma análise carregada
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                  Calcule as probabilidades de um confronto na aba Comparar para inspecionar os 5 módulos estatísticos e a matriz de Poisson.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('compare')}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800"
                >
                  Ir para Comparar
                </button>
              </section>
            )}
          </div>
        )}

        {/* TAB 3: HISTÓRICO */}
        {activeTab === 'history' && (
          <HistoryView
            history={history}
            onRecordScore={handleRecordScore}
            onDeleteItem={handleDeleteHistory}
            onLoadSnapshot={handleLoadSnapshot}
          />
        )}

        {/* TAB 4: AJUSTES */}
        {activeTab === 'settings' && (
          <SettingsView settings={settings} onUpdateSettings={setSettings} />
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (Natural Thumb Zone, 56px height) */}
      <nav
        aria-label="Navegação principal móvel"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 pb-safe"
      >
        <div className="grid grid-cols-4 items-center h-14">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`h-full min-h-[44px] flex flex-col items-center justify-center transition-colors ${
                  active ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.25]' : 'stroke-[1.75]'}`} />
                <span className="text-[11px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
