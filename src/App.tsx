import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  AlertCircle,
  ArrowLeftRight,
  BarChart2,
  Bell,
  BookmarkCheck,
  CalendarDays,
  Compass,
  Flame,
  Layers,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Ticket,
  X,
} from 'lucide-react';
import {
  auth,
  completeGoogleRedirectSignIn,
  formatFirebaseAuthError,
  signInWithGooglePopup,
  signOutFirebase,
} from './firebase.ts';
import {
  checkUserIsAdmin,
  createUserAnalysis,
  createUserMultiple,
  DEFAULT_APP_GLOBAL_CONFIG,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_SEARCH_PREFERENCES,
  deleteUserAnalysis,
  deleteUserMultiple,
  migrateLocalDataToFirestore,
  sanitizeDocId,
  saveUserPreferences,
  subscribeAppGlobalConfig,
  subscribeCurrentUserAccount,
  subscribeUserAnalyses,
  subscribeUserMultiples,
  subscribeUserPreferences,
  updateUserAnalysisScore,
  updateUserMultipleSlip,
  upsertUserAccountRecord,
  upsertUserProfile,
} from './lib/firestoreSync.ts';
import { dispatchAppNotification } from './lib/notifications.ts';
import { calculatePoissonModel } from './lib/poisson.ts';
import { CompetitionFlag } from './components/CompetitionFlag.tsx';
import { MiniPitch } from './components/MiniPitch.tsx';
import { TeamCrest } from './components/TeamCrest.tsx';
import { ProbabilityHero } from './components/ProbabilityHero.tsx';
import { ModulesView } from './components/ModulesView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { AdminView } from './components/AdminView.tsx';
import {
  BettingMenuView,
  type BetSlipSelection,
} from './components/BettingMenuView.tsx';
import {
  SuperCombinedTipCard,
  type SaveSuperCombinedPayload,
} from './components/SuperCombinedTipCard.tsx';
import {
  SerieAMultipleCard,
  type SaveMultiplePayload,
} from './components/SerieAMultipleCard.tsx';
import type {
  AnalysisResponsePayload,
  AppGlobalConfig,
  AppSettings,
  DailyBetOddsMatch,
  DailyBetsResponse,
  InAppNotificationItem,
  LiveMatchScore,
  LiveScoreMatchResult,
  LiveScoreQueryItem,
  MultipleDayFilter,
  MultipleHistoryItem,
  MultipleLegStatus,
  MultipleTipStatus,
  PredictionHistoryItem,
  SerieAMultipleLeg,
  SerieAMultipleTip,
  SuggestedFixture,
  SuperCombinedTip,
  UserAccountRecord,
} from './types/football.ts';

type AppTab =
  | 'analyzer'
  | 'betting'
  | 'tips'
  | 'fixtures'
  | 'modules'
  | 'history'
  | 'settings'
  | 'admin';
type ThemeMode = 'light' | 'dark';

const STORAGE_SETTINGS_KEY = 'campostats_settings_v1';
const STORAGE_HISTORY_KEY = 'campostats_history_v1';
const STORAGE_MULTIPLE_HISTORY_KEY = 'campostats_multiple_history_v1';
const STORAGE_THEME_KEY = 'campostats_theme_v1';

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
  searchPreferences: DEFAULT_SEARCH_PREFERENCES,
  notifications: DEFAULT_NOTIFICATION_PREFERENCES,
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
  const [activeTab, setActiveTab] = useState<AppTab>('analyzer');
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
      if (
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ) {
        return 'dark';
      }
    } catch {
      // Ignore storage errors
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

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
          searchPreferences: {
            ...DEFAULT_SETTINGS.searchPreferences,
            ...parsed.searchPreferences,
            favoriteLeagues: Array.isArray(parsed.searchPreferences?.favoriteLeagues)
              ? parsed.searchPreferences.favoriteLeagues
              : [],
          },
          notifications: {
            ...DEFAULT_SETTINGS.notifications,
            ...parsed.notifications,
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

  const [multipleHistory, setMultipleHistory] = useState<MultipleHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_MULTIPLE_HISTORY_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore storage errors
    }
    return [];
  });

  const [historyInitialSection, setHistoryInitialSection] = useState<
    'multiple' | 'analysis'
  >('multiple');
  const [isCheckingMultipleResults, setIsCheckingMultipleResults] = useState(false);
  const [multipleCheckMessage, setMultipleCheckMessage] = useState<string | null>(
    null
  );
  const [liveScoresUpdatedAt, setLiveScoresUpdatedAt] = useState<string | null>(null);

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [firestoreError, setFirestoreError] = useState<Error | null>(null);

  const [globalConfig, setGlobalConfig] = useState<AppGlobalConfig>(
    DEFAULT_APP_GLOBAL_CONFIG
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const [userAccount, setUserAccount] = useState<UserAccountRecord | null>(null);
  const [notificationsList, setNotificationsList] = useState<InAppNotificationItem[]>(
    []
  );
  const [dailyBets, setDailyBets] = useState<DailyBetsResponse | null>(null);
  const [isLoadingDailyBets, setIsLoadingDailyBets] = useState(false);
  const [dailyBetsError, setDailyBetsError] = useState<string | null>(null);

  const historyRef = useRef(history);
  historyRef.current = history;
  const multipleHistoryRef = useRef(multipleHistory);
  multipleHistoryRef.current = multipleHistory;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const authUserRef = useRef(authUser);
  authUserRef.current = authUser;
  const migratedUidRef = useRef<string | null>(null);
  const skipCloudPrefWriteRef = useRef(false);
  const modulesDetailsRef = useRef<HTMLDivElement | null>(null);
  const hasStoredSettingsRef = useRef<boolean>(
    (() => {
      try {
        return Boolean(localStorage.getItem(STORAGE_SETTINGS_KEY));
      } catch {
        return false;
      }
    })()
  );

  const pushNotification = useCallback(
    (
      payload: {
        title: string;
        message: string;
        category: InAppNotificationItem['category'];
      },
      forceTest = false
    ) => {
      const item = dispatchAppNotification(
        settingsRef.current.notifications,
        payload,
        forceTest
      );
      if (!item) return;
      setNotificationsList((prev) => [item, ...prev].slice(0, 3));
      window.setTimeout(() => {
        setNotificationsList((prev) => prev.filter((n) => n.id !== item.id));
      }, 6500);
    },
    []
  );

  if (firestoreError) {
    throw firestoreError;
  }

  useEffect(() => {
    const unsubGlobal = subscribeAppGlobalConfig((cfg) => {
      setGlobalConfig(cfg);
      if (!hasStoredSettingsRef.current && !authUserRef.current) {
        setSettings((prev) => ({
          ...prev,
          championshipScope: cfg.defaultChampionshipScope,
          searchPreferences: {
            ...prev.searchPreferences,
            window: cfg.defaultSearchWindow,
          },
        }));
      }
    });
    return () => unsubGlobal();
  }, []);

  useEffect(() => {
    void completeGoogleRedirectSignIn().catch((err) => {
      setAuthError(formatFirebaseAuthError(err));
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setIsAuthReady(true);
      if (user && !user.emailVerified) {
        setAuthError(
          'Sua conta Google precisa estar com e-mail verificado para sincronizar com o banco de dados.'
        );
      }
      if (!user) {
        migratedUidRef.current = null;
        setIsAdmin(false);
        setUserAccount(null);
      } else {
        void checkUserIsAdmin(user).then((flag) => setIsAdmin(flag));
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !authUser || !authUser.emailVerified) {
      return;
    }

    const uid = authUser.uid;
    let cancelled = false;

    const initCloudSync = async () => {
      try {
        await upsertUserProfile(authUser);
        await upsertUserAccountRecord(authUser, {
          analysesCount: historyRef.current.length,
          multiplesCount: multipleHistoryRef.current.length,
        });
        if (migratedUidRef.current !== uid) {
          migratedUidRef.current = uid;
          await migrateLocalDataToFirestore(uid, {
            history: historyRef.current,
            multipleHistory: multipleHistoryRef.current,
            settings: settingsRef.current,
            theme: themeRef.current,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setFirestoreError(
            err instanceof Error ? err : new Error(String(err))
          );
        }
      }
    };

    void initCloudSync();

    const unsubAccount = subscribeCurrentUserAccount(uid, (acc) => {
      setUserAccount(acc);
      if (acc?.role === 'admin') {
        setIsAdmin(true);
      }
    });

    const unsubPrefs = subscribeUserPreferences(
      uid,
      (prefs) => {
        if (!prefs) return;
        skipCloudPrefWriteRef.current = true;
        setSettings(prefs.settings);
        setTheme(prefs.theme);
      },
      (err) => {
        if (!cancelled) setFirestoreError(err);
      }
    );

    const unsubAnalyses = subscribeUserAnalyses(
      uid,
      (items) => {
        setHistory(items);
      },
      (err) => {
        if (!cancelled) setFirestoreError(err);
      }
    );

    const unsubMultiples = subscribeUserMultiples(
      uid,
      (items) => {
        setMultipleHistory(items);
      },
      (err) => {
        if (!cancelled) setFirestoreError(err);
      }
    );

    return () => {
      cancelled = true;
      unsubAccount();
      unsubPrefs();
      unsubAnalyses();
      unsubMultiples();
    };
  }, [isAuthReady, authUser]);

  useEffect(() => {
    if (!isAuthReady || !authUser || !authUser.emailVerified) return;
    const timer = window.setTimeout(() => {
      void upsertUserAccountRecord(authUser, {
        analysesCount: history.length,
        multiplesCount: multipleHistory.length,
      }).catch(() => {});
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [isAuthReady, authUser, history.length, multipleHistory.length]);

  const handleSignInGoogle = useCallback(async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGooglePopup();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setAuthError(formatFirebaseAuthError(err));
      }
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setAuthError(null);
    try {
      await signOutFirebase();
    } catch {
      setAuthError('Não foi possível encerrar a sessão agora.');
    }
  }, []);

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

  const [selectedMultipleLeague, setSelectedMultipleLeague] = useState<string>('today');
  const [selectedMultipleCount, setSelectedMultipleCount] = useState<3 | 4 | 5 | 10>(3);
  const [multipleDayFilter, setMultipleDayFilter] = useState<MultipleDayFilter>('today');
  const [multipleTip, setMultipleTip] = useState<SerieAMultipleTip | null>(null);
  const [isLoadingMultiple, setIsLoadingMultiple] = useState(false);
  const [multipleError, setMultipleError] = useState<string | null>(null);

  const [superCombinedTip, setSuperCombinedTip] = useState<SuperCombinedTip | null>(null);
  const [isLoadingSuperTip, setIsLoadingSuperTip] = useState(true);
  const [superTipError, setSuperTipError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore
    }
  }, [settings]);

  useEffect(() => {
    if (!isAuthReady || !authUser || !authUser.emailVerified) return;
    if (skipCloudPrefWriteRef.current) {
      skipCloudPrefWriteRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void saveUserPreferences(authUser.uid, settings, theme).catch((err) =>
        setFirestoreError(err instanceof Error ? err : new Error(String(err)))
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [isAuthReady, authUser, settings, theme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Ignore
    }
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_MULTIPLE_HISTORY_KEY,
        JSON.stringify(multipleHistory)
      );
    } catch {
      // Ignore
    }
  }, [multipleHistory]);

  const fetchFixtures = useCallback(
    async (
      scope: AppSettings['championshipScope'],
      forceRefresh = false,
      searchPrefs = settingsRef.current.searchPreferences
    ) => {
      setIsLoadingFixtures(true);
      setFixturesError(null);
      try {
        const res = await fetch('/api/fixtures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope,
            forceRefresh,
            searchPreferences: searchPrefs,
          }),
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
    },
    []
  );

  useEffect(() => {
    if (activeTab === 'fixtures') {
      fetchFixtures(
        settings.championshipScope,
        false,
        settings.searchPreferences
      );
    }
  }, [
    activeTab,
    settings.championshipScope,
    settings.searchPreferences,
    fetchFixtures,
  ]);

  const fetchDailyBets = useCallback(
    async (forceRefresh = false) => {
      setIsLoadingDailyBets(true);
      setDailyBetsError(null);
      try {
        const res = await fetch('/api/bets-today', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            forceRefresh,
            oddsMarginPct: globalConfig.oddsMarginPct,
            includeLive: settingsRef.current.searchPreferences.includeLiveMatches,
            favoriteLeagues: settingsRef.current.searchPreferences.favoriteLeagues,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json.error || 'Não foi possível carregar os jogos de hoje com odds.'
          );
        }
        setDailyBets(json as DailyBetsResponse);
      } catch (err: any) {
        setDailyBetsError(
          err?.message || 'Erro ao buscar lista de jogos do dia com odds.'
        );
      } finally {
        setIsLoadingDailyBets(false);
      }
    },
    [globalConfig.oddsMarginPct]
  );

  useEffect(() => {
    if (activeTab === 'betting') {
      fetchDailyBets(false);
    }
  }, [
    activeTab,
    fetchDailyBets,
    settings.searchPreferences.includeLiveMatches,
    settings.searchPreferences.favoriteLeagues,
  ]);

  const fetchMultipleTip = useCallback(
    async (
      leagueSlug: string,
      legCount: 3 | 4 | 5 | 10,
      dayFilter: MultipleDayFilter,
      forceRefresh = false
    ) => {
      setIsLoadingMultiple(true);
      setMultipleError(null);
      try {
        const res = await fetch('/api/serie-a-multiple', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            league: leagueSlug,
            count: legCount,
            dayFilter,
            onlyToday: dayFilter === 'today',
            forceRefresh,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json.error || 'Erro ao calcular a múltipla desta competição.'
          );
        }
        setMultipleTip(json as SerieAMultipleTip);
      } catch (err: any) {
        setMultipleError(
          err?.message || 'Não foi possível carregar as dicas desta competição.'
        );
      } finally {
        setIsLoadingMultiple(false);
      }
    },
    []
  );

  const fetchSuperCombinedTip = useCallback(async (forceRefresh = false) => {
    setIsLoadingSuperTip(true);
    setSuperTipError(null);
    try {
      const res = await fetch('/api/super-combined-tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error || 'Sem confrontos qualificados para a Super Dica Combinada.'
        );
      }
      setSuperCombinedTip(json as SuperCombinedTip);
    } catch (err: any) {
      setSuperTipError(
        err?.message || 'Não foi possível carregar a Super Dica Combinada no momento.'
      );
    } finally {
      setIsLoadingSuperTip(false);
    }
  }, []);

  // Load Super Dica Combinada automatically on Dashboard mount
  useEffect(() => {
    fetchSuperCombinedTip(false);
  }, [fetchSuperCombinedTip]);

  useEffect(() => {
    if (activeTab !== 'tips') return;
    fetchMultipleTip(
      selectedMultipleLeague,
      selectedMultipleCount,
      multipleDayFilter,
      false
    );
  }, [activeTab, selectedMultipleLeague, selectedMultipleCount, multipleDayFilter, fetchMultipleTip]);

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
    setActiveTab('modules');
    if (settings.updateMode === 'auto') {
      runAnalysis(fixture.homeTeam, fixture.awayTeam, fixture.competition);
    }
  };

  const handleSelectMultipleLeg = (leg: SerieAMultipleLeg) => {
    const comp = leg.competition || multipleTip?.competition || 'Brasileirão Série A';
    setHomeTeamInput(leg.homeTeam);
    setAwayTeamInput(leg.awayTeam);
    setCompetitionInput(comp);
    setActiveTab('modules');
    runAnalysis(leg.homeTeam, leg.awayTeam, comp);
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
      id: sanitizeDocId(analysis.id),
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
    const user = authUserRef.current;
    if (user && user.emailVerified) {
      void createUserAnalysis(user.uid, entry).catch((err) =>
        setFirestoreError(err instanceof Error ? err : new Error(String(err)))
      );
    }
  };

  const handleRecordScore = (id: string, homeGoals: number, awayGoals: number) => {
    const nextActualScore = {
      homeGoals,
      awayGoals,
      recordedAt: new Date().toISOString(),
    };
    setHistory((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              actualScore: nextActualScore,
            }
          : item
      )
    );
    const user = authUserRef.current;
    if (user && user.emailVerified) {
      void updateUserAnalysisScore(user.uid, id, {
        actualScore: nextActualScore,
      }).catch((err) =>
        setFirestoreError(err instanceof Error ? err : new Error(String(err)))
      );
    }
  };

  const handleDeleteHistory = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    const user = authUserRef.current;
    if (user && user.emailVerified) {
      void deleteUserAnalysis(user.uid, id).catch((err) =>
        setFirestoreError(err instanceof Error ? err : new Error(String(err)))
      );
    }
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
    setActiveTab('modules');
  };

  const currentTipSignature = useMemo(() => {
    if (!multipleTip) return '';
    return multipleTip.legs
      .map((l) => `${l.homeTeam}|${l.awayTeam}|${l.marketLabel}`)
      .join('||');
  }, [multipleTip]);

  const isMultipleSavedInHistory = useMemo(() => {
    if (!currentTipSignature) return false;
    return multipleHistory.some((item) => item.tipSignature === currentTipSignature);
  }, [currentTipSignature, multipleHistory]);

  const multipleHistorySummary = useMemo(
    () => ({
      total: multipleHistory.length,
      won: multipleHistory.filter((m) => m.status === 'won').length,
      lost: multipleHistory.filter((m) => m.status === 'lost').length,
      pending: multipleHistory.filter((m) => m.status === 'pending').length,
    }),
    [multipleHistory]
  );

  const handleChangeMultipleLeague = (slug: string) => {
    setSelectedMultipleLeague(slug);
    if (slug === 'today') {
      setMultipleDayFilter('today');
    } else if (slug === 'tomorrow') {
      setMultipleDayFilter('tomorrow');
    } else if (slug === 'world') {
      setMultipleDayFilter('all');
    }
  };

  const handleChangeMultipleDayFilter = (next: MultipleDayFilter) => {
    setMultipleDayFilter(next);
    if (next === 'tomorrow') {
      if (
        selectedMultipleLeague === 'today' ||
        selectedMultipleLeague === 'world'
      ) {
        setSelectedMultipleLeague('tomorrow');
      }
    } else if (next === 'today') {
      if (
        selectedMultipleLeague === 'tomorrow' ||
        selectedMultipleLeague === 'world'
      ) {
        setSelectedMultipleLeague('today');
      }
    } else {
      if (
        selectedMultipleLeague === 'today' ||
        selectedMultipleLeague === 'tomorrow'
      ) {
        setSelectedMultipleLeague('world');
      }
    }
  };

  const handleSaveMultipleTip = (payload: SaveMultiplePayload) => {
    if (!currentTipSignature || isMultipleSavedInHistory) return;
    const item: MultipleHistoryItem = {
      id: sanitizeDocId(`${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      tipSignature: currentTipSignature,
      createdAt: new Date().toISOString(),
      competition: payload.tip.competition,
      leagueSlug: payload.tip.leagueSlug || selectedMultipleLeague,
      dayFilter:
        payload.tip.dayFilter ??
        (payload.tip.onlyToday ? 'today' : multipleDayFilter),
      legs: payload.tip.legs.map((leg, idx) => ({
        ...leg,
        odd: payload.legOdds[idx] ?? 1,
        status: 'pending',
      })),
      combinedProbabilityPct: payload.tip.combinedProbabilityPct,
      totalOdd: payload.totalOdd,
      stake: payload.stake,
      potentialReturn: payload.potentialReturn,
      status: 'pending',
    };
    setMultipleHistory((prev) => [item, ...prev]);
    const user = authUserRef.current;
    if (user && user.emailVerified) {
      void createUserMultiple(user.uid, item).catch((err) =>
        setFirestoreError(err instanceof Error ? err : new Error(String(err)))
      );
    }
  };

  const savedSuperTipSignatures = useMemo(
    () => new Set(multipleHistory.map((item) => item.tipSignature)),
    [multipleHistory]
  );

  const handleSaveSuperCombinedTip = (payload: SaveSuperCombinedPayload) => {
    if (!payload.signature || savedSuperTipSignatures.has(payload.signature)) return;
    const defaultStake = 50;
    const item: MultipleHistoryItem = {
      id: sanitizeDocId(`${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      tipSignature: payload.signature,
      createdAt: new Date().toISOString(),
      competition: payload.title,
      leagueSlug: payload.leagueSlug || 'world',
      dayFilter: payload.isTodaySlate ? 'today' : 'all',
      legs: payload.legs.map((leg) => ({
        ...leg,
        odd: leg.fairOdd,
        status: 'pending',
      })),
      combinedProbabilityPct: payload.combinedProbabilityPct,
      totalOdd: payload.fairOddEstimate,
      stake: defaultStake,
      potentialReturn: Number((defaultStake * payload.fairOddEstimate).toFixed(2)),
      status: 'pending',
      source: 'tip',
      notes:
        payload.mode === 'same-game'
          ? 'Super Dica Combinada (mesmo jogo · modelo Poisson + ESPN)'
          : 'Super Dica Combinada multi-mercados (melhor margem de acerto)',
    };
    setMultipleHistory((prev) => [item, ...prev]);
    const user = authUserRef.current;
    if (user && user.emailVerified) {
      void createUserMultiple(user.uid, item).catch((err) =>
        setFirestoreError(err instanceof Error ? err : new Error(String(err)))
      );
    }
  };

  const deriveTipStatus = (legs: { status: MultipleLegStatus }[]): MultipleTipStatus => {
    if (legs.some((l) => l.status === 'lost')) return 'lost';
    if (legs.length > 0 && legs.every((l) => l.status === 'won')) return 'won';
    return 'pending';
  };

  const handleUpdateMultipleLegStatus = (
    itemId: string,
    legIndex: number,
    status: MultipleLegStatus
  ) => {
    const user = authUserRef.current;
    const current = multipleHistoryRef.current.find((m) => m.id === itemId);
    let nextSyncPayload: {
      legs: typeof current extends undefined ? never : NonNullable<typeof current>['legs'];
      status: MultipleTipStatus;
      resolvedAt?: string;
    } | null = null;

    if (current) {
      const nextLegs = current.legs.map((leg, idx) =>
        idx === legIndex ? { ...leg, status } : leg
      );
      const nextStatus = deriveTipStatus(nextLegs);
      nextSyncPayload = {
        legs: nextLegs,
        status: nextStatus,
        resolvedAt: nextStatus === 'pending' ? undefined : new Date().toISOString(),
      };
    }

    setMultipleHistory((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const nextLegs = item.legs.map((leg, idx) =>
          idx === legIndex ? { ...leg, status } : leg
        );
        const nextStatus = deriveTipStatus(nextLegs);
        return {
          ...item,
          legs: nextLegs,
          status: nextStatus,
          resolvedAt: nextStatus === 'pending' ? undefined : new Date().toISOString(),
        };
      })
    );

    if (user && user.emailVerified && nextSyncPayload) {
      void updateUserMultipleSlip(user.uid, itemId, nextSyncPayload).catch((err) =>
        setFirestoreError(err instanceof Error ? err : new Error(String(err)))
      );
    }
  };

  const handleResolveMultipleTip = (itemId: string, status: MultipleTipStatus) => {
    const user = authUserRef.current;
    const current = multipleHistoryRef.current.find((m) => m.id === itemId);
    let nextSyncPayload: {
      legs: NonNullable<typeof current>['legs'];
      status: MultipleTipStatus;
      resolvedAt?: string;
    } | null = null;

    if (current) {
      const nextLegs =
        status === 'won'
          ? current.legs.map((leg) => ({ ...leg, status: 'won' as MultipleLegStatus }))
          : status === 'pending'
            ? current.legs.map((leg) => ({
                ...leg,
                status: 'pending' as MultipleLegStatus,
              }))
            : current.legs;
      nextSyncPayload = {
        legs: nextLegs,
        status,
        resolvedAt: status === 'pending' ? undefined : new Date().toISOString(),
      };
    }

    setMultipleHistory((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const nextLegs =
          status === 'won'
            ? item.legs.map((leg) => ({ ...leg, status: 'won' as MultipleLegStatus }))
            : status === 'pending'
              ? item.legs.map((leg) => ({
                  ...leg,
                  status: 'pending' as MultipleLegStatus,
                }))
              : item.legs;
        return {
          ...item,
          legs: nextLegs,
          status,
          resolvedAt: status === 'pending' ? undefined : new Date().toISOString(),
        };
      })
    );

    if (user && user.emailVerified && nextSyncPayload) {
      void updateUserMultipleSlip(user.uid, itemId, nextSyncPayload).catch((err) =>
        setFirestoreError(err instanceof Error ? err : new Error(String(err)))
      );
    }
  };

  const handleDeleteMultipleItem = (itemId: string) => {
    setMultipleHistory((prev) => prev.filter((item) => item.id !== itemId));
    const user = authUserRef.current;
    if (user && user.emailVerified) {
      void deleteUserMultiple(user.uid, itemId).catch((err) =>
        setFirestoreError(err instanceof Error ? err : new Error(String(err)))
      );
    }
  };

  const refreshHistoryLiveScores = useCallback(
    async (options?: {
      forceRefresh?: boolean;
      allowWebFallback?: boolean;
      silent?: boolean;
    }) => {
      const forceRefresh = Boolean(options?.forceRefresh);
      const allowWebFallback = Boolean(options?.allowWebFallback);
      const silent = Boolean(options?.silent);

      const queries: LiveScoreQueryItem[] = [];

      for (const item of multipleHistoryRef.current) {
        item.legs.forEach((leg, legIdx) => {
          const isPostDone =
            leg.liveScore?.state === 'post' &&
            leg.actualScore !== undefined &&
            leg.status !== 'pending';
          if (!forceRefresh && isPostDone) return;
          queries.push({
            key: `mul:${item.id}:${legIdx}`,
            eventId: leg.eventId,
            leagueSlug: leg.leagueSlug,
            competition: leg.competition || item.competition,
            homeTeam: leg.homeTeam,
            awayTeam: leg.awayTeam,
            marketLabel: leg.marketLabel,
            dateHint: item.createdAt,
          });
        });
      }

      for (const item of historyRef.current) {
        const isPostDone =
          item.liveScore?.state === 'post' && item.actualScore !== undefined;
        if (!forceRefresh && isPostDone) return;
        queries.push({
          key: `ana:${item.id}`,
          eventId: item.liveScore?.eventId,
          leagueSlug: item.liveScore?.leagueSlug,
          competition: item.competition,
          homeTeam: item.homeTeam.name,
          awayTeam: item.awayTeam.name,
          dateHint: item.createdAt,
        });
      }

      if (queries.length === 0) {
        if (!silent) {
          setMultipleCheckMessage(
            'Todos os jogos salvos no histórico já estão com placar finalizado.'
          );
        }
        return;
      }

      setIsCheckingMultipleResults(true);
      if (!silent) {
        setMultipleCheckMessage(null);
      }

      try {
        const res = await fetch('/api/live-scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matches: queries.slice(0, 35),
            forceRefresh,
            allowWebFallback,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Erro ao buscar placares ao vivo na web.');
        }

        const results: LiveScoreMatchResult[] = Array.isArray(json.results)
          ? json.results
          : [];
        const byKey = new Map(results.map((r) => [r.key, r]));

        let liveCount = 0;
        let finishedCount = 0;
        let foundCount = 0;

        for (const r of results) {
          if (!r.found) continue;
          foundCount += 1;
          if (r.state === 'in') liveCount += 1;
          else if (r.state === 'post') finishedCount += 1;
        }

        const updatedMultiplesToSync: MultipleHistoryItem[] = [];
        const notifiedMessages: {
          title: string;
          message: string;
          category: InAppNotificationItem['category'];
        }[] = [];

        setMultipleHistory((prev) =>
          prev.map((item) => {
            let changed = false;
            const nextLegs = item.legs.map((leg, legIdx) => {
              const match = byKey.get(`mul:${item.id}:${legIdx}`);
              if (!match || !match.found) return leg;

              const hasNumericScore =
                typeof match.homeGoals === 'number' &&
                typeof match.awayGoals === 'number';

              if (
                hasNumericScore &&
                leg.liveScore &&
                (match.homeGoals! > leg.liveScore.homeGoals ||
                  match.awayGoals! > leg.liveScore.awayGoals) &&
                settingsRef.current.notifications.notifyLiveGoals
              ) {
                notifiedMessages.push({
                  title: 'Gol ao vivo',
                  message: `${leg.homeTeam} ${match.homeGoals} × ${match.awayGoals} ${leg.awayTeam}`,
                  category: 'goal',
                });
              }

              const nextLiveScore: LiveMatchScore = {
                homeGoals: hasNumericScore ? match.homeGoals! : 0,
                awayGoals: hasNumericScore ? match.awayGoals! : 0,
                state: match.state,
                clock: match.clock,
                statusDetail: match.statusDetail,
                updatedAt: match.updatedAt,
                sourceLabel: match.sourceLabel,
                eventId: match.eventId || leg.eventId,
                leagueSlug: match.leagueSlug || leg.leagueSlug,
              };

              changed = true;
              const nextActual =
                match.completed && hasNumericScore
                  ? {
                      homeGoals: match.homeGoals!,
                      awayGoals: match.awayGoals!,
                      statusDetail: match.statusDetail,
                    }
                  : leg.actualScore;

              const nextLegStatus: MultipleLegStatus =
                match.completed &&
                leg.status === 'pending' &&
                match.marketStatus
                  ? match.marketStatus
                  : leg.status;

              return {
                ...leg,
                eventId: match.eventId || leg.eventId,
                leagueSlug: match.leagueSlug || leg.leagueSlug,
                liveScore: nextLiveScore,
                actualScore: nextActual,
                status: nextLegStatus,
              };
            });

            if (!changed) return item;
            const nextStatus = deriveTipStatus(nextLegs);
            if (
              item.status === 'pending' &&
              (nextStatus === 'won' || nextStatus === 'lost') &&
              settingsRef.current.notifications.notifyBetResolved
            ) {
              notifiedMessages.push({
                title: nextStatus === 'won' ? 'Bilhete ganho!' : 'Bilhete encerrado',
                message: `${item.competition} (${nextStatus === 'won' ? 'Ganha' : 'Perdida'})`,
                category: 'bet',
              });
            }
            const updatedItem: MultipleHistoryItem = {
              ...item,
              legs: nextLegs,
              status: nextStatus,
              resolvedAt:
                nextStatus === 'pending'
                  ? item.resolvedAt
                  : item.resolvedAt || new Date().toISOString(),
            };
            updatedMultiplesToSync.push(updatedItem);
            return updatedItem;
          })
        );

        const updatedAnalysesToSync: PredictionHistoryItem[] = [];
        setHistory((prev) =>
          prev.map((item) => {
            const match = byKey.get(`ana:${item.id}`);
            if (!match || !match.found) return item;

            const hasNumericScore =
              typeof match.homeGoals === 'number' &&
              typeof match.awayGoals === 'number';

            if (
              hasNumericScore &&
              item.liveScore &&
              (match.homeGoals! > item.liveScore.homeGoals ||
                match.awayGoals! > item.liveScore.awayGoals) &&
              settingsRef.current.notifications.notifyLiveGoals
            ) {
              notifiedMessages.push({
                title: 'Gol ao vivo',
                message: `${item.homeTeam.name} ${match.homeGoals} × ${match.awayGoals} ${item.awayTeam.name}`,
                category: 'goal',
              });
            }

            const nextLiveScore: LiveMatchScore = {
              homeGoals: hasNumericScore ? match.homeGoals! : 0,
              awayGoals: hasNumericScore ? match.awayGoals! : 0,
              state: match.state,
              clock: match.clock,
              statusDetail: match.statusDetail,
              updatedAt: match.updatedAt,
              sourceLabel: match.sourceLabel,
              eventId: match.eventId || item.liveScore?.eventId,
              leagueSlug: match.leagueSlug || item.liveScore?.leagueSlug,
            };

            const nextActual =
              !item.actualScore && match.completed && hasNumericScore
                ? {
                    homeGoals: match.homeGoals!,
                    awayGoals: match.awayGoals!,
                    recordedAt: match.updatedAt,
                  }
                : item.actualScore;

            const updatedAnalysis: PredictionHistoryItem = {
              ...item,
              liveScore: nextLiveScore,
              actualScore: nextActual,
            };
            updatedAnalysesToSync.push(updatedAnalysis);
            return updatedAnalysis;
          })
        );

        for (const msg of notifiedMessages.slice(0, 2)) {
          pushNotification(msg);
        }

        const user = authUserRef.current;
        if (user && user.emailVerified) {
          for (const m of updatedMultiplesToSync) {
            void updateUserMultipleSlip(user.uid, m.id, {
              legs: m.legs,
              status: m.status,
              resolvedAt: m.resolvedAt,
            }).catch((err) =>
              setFirestoreError(err instanceof Error ? err : new Error(String(err)))
            );
          }
          for (const a of updatedAnalysesToSync) {
            void updateUserAnalysisScore(user.uid, a.id, {
              liveScore: a.liveScore,
              actualScore: a.actualScore,
            }).catch((err) =>
              setFirestoreError(err instanceof Error ? err : new Error(String(err)))
            );
          }
        }

        setLiveScoresUpdatedAt(json.checkedAt || new Date().toISOString());

        if (!silent) {
          if (liveCount > 0 && finishedCount > 0) {
            setMultipleCheckMessage(
              `${liveCount} ${liveCount === 1 ? 'jogo ao vivo' : 'jogos ao vivo'} e ${finishedCount} ${
                finishedCount === 1 ? 'finalizado atualizado' : 'finalizados atualizados'
              } com dados da web.`
            );
          } else if (liveCount > 0) {
            setMultipleCheckMessage(
              `${liveCount} ${
                liveCount === 1 ? 'jogo ao vivo atualizado' : 'jogos ao vivo atualizados'
              } em tempo real pela web.`
            );
          } else if (finishedCount > 0) {
            setMultipleCheckMessage(
              `${finishedCount} ${
                finishedCount === 1 ? 'jogo finalizado atualizado' : 'jogos finalizados atualizados'
              } com placar oficial.`
            );
          } else if (foundCount > 0) {
            setMultipleCheckMessage(
              `Placares verificados na web (${foundCount} ${
                foundCount === 1 ? 'partida ainda agendada' : 'partidas ainda agendadas'
              }).`
            );
          } else {
            setMultipleCheckMessage(
              'Nenhum placar ao vivo ou encerrado localizado na web para os jogos pendentes no momento.'
            );
          }
        }
      } catch (err: any) {
        if (!silent) {
          setMultipleCheckMessage(
            err?.message || 'Não foi possível buscar placares ao vivo na web agora.'
          );
        }
      } finally {
        setIsCheckingMultipleResults(false);
      }
    },
    []
  );

  // Auto-load live scores when entering Histórico + poll every 45s while visible & active
  useEffect(() => {
    if (activeTab !== 'history') return;
    if (historyRef.current.length === 0 && multipleHistoryRef.current.length === 0) {
      return;
    }

    refreshHistoryLiveScores({
      forceRefresh: false,
      allowWebFallback: false,
      silent: true,
    });

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const hasTrackableMultiple = multipleHistoryRef.current.some((m) =>
        m.legs.some(
          (l) =>
            l.liveScore?.state === 'in' ||
            (l.status === 'pending' && l.liveScore?.state !== 'post')
        )
      );
      const hasTrackableAnalysis = historyRef.current.some(
        (h) =>
          h.liveScore?.state === 'in' ||
          (!h.actualScore && h.liveScore?.state !== 'post')
      );
      if (hasTrackableMultiple || hasTrackableAnalysis) {
        refreshHistoryLiveScores({
          forceRefresh: true,
          allowWebFallback: false,
          silent: true,
        });
      }
    }, 45000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeTab, refreshHistoryLiveScores]);

  const handleCheckMultipleResults = useCallback(() => {
    refreshHistoryLiveScores({
      forceRefresh: true,
      allowWebFallback: true,
      silent: false,
    });
  }, [refreshHistoryLiveScores]);

  const handleImportBetSlip = useCallback(
    (item: MultipleHistoryItem) => {
      const normalizedItem: MultipleHistoryItem = {
        ...item,
        id: sanitizeDocId(item.id),
      };
      const next = [normalizedItem, ...multipleHistoryRef.current];
      multipleHistoryRef.current = next;
      setMultipleHistory(next);
      const user = authUserRef.current;
      if (user && user.emailVerified) {
        void createUserMultiple(user.uid, normalizedItem).catch((err) =>
          setFirestoreError(err instanceof Error ? err : new Error(String(err)))
        );
      }
      setMultipleCheckMessage(
        'Bilhete importado no histórico. Buscando placares ao vivo na web...'
      );
      refreshHistoryLiveScores({
        forceRefresh: false,
        allowWebFallback: false,
        silent: false,
      });
    },
    [refreshHistoryLiveScores]
  );

  const handleSaveDailyBetSlip = useCallback(
    (payload: {
      selections: BetSlipSelection[];
      stake: number;
      totalOdd: number;
      potentialReturn: number;
      combinedProbabilityPct: number;
    }) => {
      if (payload.selections.length === 0) return;
      const sig = `bets:${payload.selections
        .map((s) => `${s.match.eventId}:${s.marketKey}`)
        .join('|')}:${Date.now()}`;
      const compTitle =
        payload.selections.length === 1
          ? `Aposta simples · ${payload.selections[0].match.competition}`
          : `Múltipla de Hoje (${payload.selections.length} jogos)`;

      const item: MultipleHistoryItem = {
        id: sanitizeDocId(`${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        tipSignature: sig,
        createdAt: new Date().toISOString(),
        competition: compTitle,
        leagueSlug:
          payload.selections.length === 1
            ? payload.selections[0].match.leagueSlug
            : 'today',
        dayFilter: 'today',
        legs: payload.selections.map((s) => ({
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
          rationale: `Odd calibrada @${s.odd.toFixed(2)} no menu Apostas`,
          odd: s.odd,
          status: 'pending',
        })),
        combinedProbabilityPct: payload.combinedProbabilityPct,
        totalOdd: payload.totalOdd,
        stake: payload.stake,
        potentialReturn: payload.potentialReturn,
        status: 'pending',
        source: 'tip',
      };

      setMultipleHistory((prev) => [item, ...prev]);
      const user = authUserRef.current;
      if (user && user.emailVerified) {
        void createUserMultiple(user.uid, item).catch((err) =>
          setFirestoreError(err instanceof Error ? err : new Error(String(err)))
        );
      }
      pushNotification({
        title: 'Bilhete salvo no Histórico',
        message: `${compTitle} · Odd @${payload.totalOdd.toFixed(2)}`,
        category: 'bet',
      });
    },
    [pushNotification]
  );

  const handleAnalyzeDailyBetMatch = useCallback(
    (match: DailyBetOddsMatch) => {
      setHomeTeamInput(match.homeTeam);
      setAwayTeamInput(match.awayTeam);
      setCompetitionInput(match.competition);
      setActiveTab('modules');
      runAnalysis(match.homeTeam, match.awayTeam, match.competition);
    },
    [runAnalysis]
  );

  const navItems: {
    id: AppTab;
    label: string;
    mobileLabel?: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'analyzer', label: 'Dashboard', icon: Compass },
    ...(globalConfig.bettingMenuEnabled || isAdmin
      ? [{ id: 'betting' as AppTab, label: 'Apostas', icon: Ticket }]
      : []),
    { id: 'tips', label: 'Dicas quentes', mobileLabel: 'Dicas', icon: Flame },
    { id: 'fixtures', label: 'Jogos', icon: CalendarDays },
    { id: 'modules', label: 'Modelos', icon: Layers },
    { id: 'history', label: 'Histórico', icon: BookmarkCheck },
    { id: 'settings', label: 'Ajustes', icon: SlidersHorizontal },
    { id: 'admin', label: 'Admin', icon: ShieldCheck },
  ];

  const mobilePrimaryTabIds: AppTab[] = [
    'analyzer',
    ...(globalConfig.bettingMenuEnabled || isAdmin ? (['betting'] as AppTab[]) : []),
    'tips',
    'fixtures',
    'history',
  ];
  const mobilePrimaryItems = navItems.filter((i) =>
    mobilePrimaryTabIds.includes(i.id)
  );
  const mobileSecondaryItems = navItems.filter(
    (i) => !mobilePrimaryTabIds.includes(i.id)
  );
  const isSecondaryActive = mobileSecondaryItems.some((i) => i.id === activeTab);

  const selectTab = (tab: AppTab) => {
    setActiveTab(tab);
    setIsMobileMoreOpen(false);
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-[#F6F7F9] dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 lg:pb-12 transition-colors">
      {/* Toast Notifications Stack */}
      {notificationsList.length > 0 && (
        <div className="fixed top-16 left-3 right-3 sm:left-auto sm:right-4 sm:w-80 z-50 space-y-2 pointer-events-none">
          {notificationsList.map((n) => (
            <div
              key={n.id}
              className="pointer-events-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg p-3 flex items-start gap-2.5"
            >
              <Bell className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {n.title}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug mt-0.5 break-words">
                  {n.message}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setNotificationsList((prev) => prev.filter((item) => item.id !== n.id))
                }
                aria-label="Fechar notificação"
                className="min-h-[32px] min-w-[32px] -mr-1 -mt-1 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Compact Sticky Header (Mobile 52px / Desktop 3-Zone Top Bar) */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-13 lg:h-16 flex items-center justify-between gap-2 sm:gap-4 lg:gap-6">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              selectTab('analyzer');
            }}
            className="font-display text-xl lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 truncate max-w-[155px] sm:max-w-[220px]"
          >
            {globalConfig.appName || 'CampoStats'}
          </a>

          {/* Desktop Navigation (3-zone contract) */}
          <nav
            aria-label="Navegação principal"
            className="hidden lg:flex items-center gap-3.5 xl:gap-6 text-xs xl:text-sm font-medium text-slate-600 dark:text-slate-300 min-w-0 overflow-x-auto no-scrollbar"
          >
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTab(item.id)}
                  className={`py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    active
                      ? 'text-slate-900 dark:text-white border-emerald-700 dark:border-emerald-400 font-semibold'
                      : 'border-transparent hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Header Controls: Google Cloud Account + Theme Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {authUser ? (
              <button
                type="button"
                onClick={handleSignOut}
                title={`Conectado como ${authUser.email || authUser.displayName || 'usuário'} · Toque para sair`}
                className="min-h-[44px] px-2.5 sm:px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <span className="max-w-[96px] truncate">
                  {authUser.displayName?.split(' ')[0] || 'Conta'}
                </span>
                <LogOut className="w-3.5 h-3.5 shrink-0" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSignInGoogle}
                disabled={isSigningIn}
                className="min-h-[44px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span>{isSigningIn ? 'Entrando...' : 'Entrar'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              className="min-h-[44px] px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Tema claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="hidden sm:inline">Tema escuro</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="top" className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {(globalConfig.maintenanceMode || globalConfig.announcementBanner.trim()) && (
          <div
            className={`mb-4 px-4 py-2.5 rounded-2xl border text-xs font-medium flex flex-wrap items-center justify-between gap-2 ${
              globalConfig.maintenanceMode
                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                : 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200'
            }`}
          >
            <span>
              {globalConfig.maintenanceMode
                ? 'Manutenção programada em andamento. Alguns recursos podem sofrer instabilidade temporária.'
                : globalConfig.announcementBanner}
            </span>
          </div>
        )}

        {userAccount?.status === 'blocked' && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200">
            Sua conta está temporariamente suspensa pelo administrador. Entre em contato caso considere um engano.
          </div>
        )}

        {authError && (
          <div
            role="alert"
            className="mb-4 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 text-xs sm:text-sm text-rose-900 dark:text-rose-200 flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed break-words">{authError}</p>
            </div>
            <button
              type="button"
              onClick={() => setAuthError(null)}
              aria-label="Fechar aviso de login"
              className="min-h-[36px] min-w-[36px] rounded-lg text-rose-500 hover:text-rose-800 dark:hover:text-rose-100 inline-flex items-center justify-center shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1: DASHBOARD (Super Dica Combinada) */}
        {activeTab === 'analyzer' && (
          <div>
            <SuperCombinedTipCard
              tip={superCombinedTip}
              isLoading={isLoadingSuperTip}
              error={superTipError}
              savedSignatures={savedSuperTipSignatures}
              onRefresh={() => fetchSuperCombinedTip(true)}
              onOpenTipsMenu={() => setActiveTab('tips')}
              onOpenHistory={() => {
                setHistoryInitialSection('multiple');
                setActiveTab('history');
              }}
              onSelectLeg={handleSelectMultipleLeg}
              onSaveToHistory={handleSaveSuperCombinedTip}
            />
          </div>
        )}

        {/* TAB 2: APOSTAS (Jogos do dia atual com odds) */}
        {activeTab === 'betting' && (
          <BettingMenuView
            data={dailyBets}
            loading={isLoadingDailyBets}
            error={dailyBetsError}
            oddsMarginPct={globalConfig.oddsMarginPct}
            minTipProbabilityPct={globalConfig.minTipProbabilityPct}
            onRefresh={() => fetchDailyBets(true)}
            onAnalyzeMatch={handleAnalyzeDailyBetMatch}
            onSaveBetSlip={handleSaveDailyBetSlip}
          />
        )}

        {/* TAB 2: DICAS QUENTES (Menu exclusivo para múltiplas, ligas mundiais e jogos de amanhã) */}
        {activeTab === 'tips' && (
          <div>
            <SerieAMultipleCard
              tip={multipleTip}
              selectedLeague={selectedMultipleLeague}
              selectedCount={selectedMultipleCount}
              dayFilter={multipleDayFilter}
              isLoading={isLoadingMultiple}
              error={multipleError}
              isSavedInHistory={isMultipleSavedInHistory}
              multipleHistorySummary={multipleHistorySummary}
              onChangeLeague={handleChangeMultipleLeague}
              onChangeCount={(cnt) => setSelectedMultipleCount(cnt)}
              onChangeDayFilter={handleChangeMultipleDayFilter}
              onRefresh={() =>
                fetchMultipleTip(
                  selectedMultipleLeague,
                  selectedMultipleCount,
                  multipleDayFilter,
                  true
                )
              }
              onSelectLeg={handleSelectMultipleLeg}
              onSaveToHistory={handleSaveMultipleTip}
              onOpenMultipleHistory={() => {
                setHistoryInitialSection('multiple');
                setActiveTab('history');
              }}
            />
          </div>
        )}

        {/* TAB 3: JOGOS (Menu separado para confrontos atuais e futuros) */}
        {activeTab === 'fixtures' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Confrontos sugeridos
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Apenas jogos ao vivo e próximas partidas agendadas. Toque para enviar ao Analisador em Modelos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchFixtures(settings.championshipScope, true)}
                  disabled={isLoadingFixtures}
                  className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isLoadingFixtures ? 'animate-spin' : ''}`}
                  />
                  <span>Atualizar jogos</span>
                </button>
              </div>

              {fixturesError && (
                <div className="mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-xs text-amber-900 dark:text-amber-200">
                  {fixturesError}
                </div>
              )}

              {isLoadingFixtures && fixtures.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-700 dark:text-emerald-400" />
                  <span>Buscando jogos ao vivo e próximos confrontos...</span>
                </div>
              ) : fixtures.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Nenhum jogo ao vivo ou agendado encontrado para o escopo selecionado no momento.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('modules')}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold"
                  >
                    Digitar confrontos no Analisador
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {fixtures.map((fx, idx) => {
                    const isFixtureLive = fx.dateLabel
                      .toLowerCase()
                      .startsWith('ao vivo');
                    return (
                      <button
                        key={`${fx.homeTeam}-${fx.awayTeam}-${idx}`}
                        type="button"
                        onClick={() => handleSelectFixture(fx)}
                        className="w-full p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 active:bg-slate-100 dark:active:bg-slate-800 flex flex-col gap-2.5 text-left transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                          <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                            <CompetitionFlag
                              leagueSlug={fx.leagueSlug}
                              competition={fx.competition}
                              size="sm"
                            />
                            <span className="truncate">
                              {fx.competition} · {fx.dateLabel}
                            </span>
                          </span>
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0 whitespace-nowrap">
                            Analisar
                          </span>
                        </div>

                        <MiniPitch
                          variant="compact"
                          homeTeam={{
                            name: fx.homeTeam,
                            shortCode: fx.homeShortCode || fx.homeTeam,
                            primaryColor: fx.homeColor,
                            logoUrl: fx.homeLogoUrl,
                          }}
                          awayTeam={{
                            name: fx.awayTeam,
                            shortCode: fx.awayShortCode || fx.awayTeam,
                            primaryColor: fx.awayColor,
                            logoUrl: fx.awayLogoUrl,
                          }}
                          isLive={isFixtureLive}
                          centerLabel={isFixtureLive ? 'AO VIVO' : 'VS'}
                        />

                        <div className="flex items-center justify-between gap-2 min-w-0 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                          <span className="truncate">{fx.homeTeam}</span>
                          <span className="text-xs text-slate-400 shrink-0">×</span>
                          <span className="truncate text-right">{fx.awayTeam}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 4: MODELOS (Analisador estatístico de futebol + 5 Módulos & Matriz de Poisson) */}
        {activeTab === 'modules' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Dedicated Card: Analisador estatístico de futebol */}
              <div className="lg:col-span-5">
                <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
                  <div className="mb-4">
                    <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight text-balance">
                      Analisador estatístico de futebol
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Consulta dados atualizados na Internet e calcula probabilidades pelo modelo de Poisson.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-1 min-[440px]:grid-cols-[1fr_auto_1fr] items-end gap-2">
                      <div className="min-w-0">
                        <label
                          htmlFor="home-team"
                          className="block text-xs font-semibold text-emerald-800 dark:text-emerald-400 mb-1 truncate"
                        >
                          Time A (Mandante)
                        </label>
                        <input
                          id="home-team"
                          type="text"
                          value={homeTeamInput}
                          onChange={(e) => setHomeTeamInput(e.target.value)}
                          placeholder="Ex: Flamengo"
                          className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700 dark:focus:border-emerald-500"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSwapTeams}
                        aria-label="Inverter mandante e visitante"
                        className="min-h-[44px] w-full min-[440px]:w-auto min-[440px]:min-w-[44px] px-3 min-[440px]:px-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ArrowLeftRight className="w-4 h-4 shrink-0" />
                        <span className="min-[440px]:hidden">Inverter mandante e visitante</span>
                      </button>

                      <div className="min-w-0">
                        <label
                          htmlFor="away-team"
                          className="block text-xs font-semibold text-blue-800 dark:text-blue-400 mb-1 truncate"
                        >
                          Time B (Visitante)
                        </label>
                        <input
                          id="away-team"
                          type="text"
                          value={awayTeamInput}
                          onChange={(e) => setAwayTeamInput(e.target.value)}
                          placeholder="Ex: Palmeiras"
                          className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-700 dark:focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="competition"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        Campeonato
                      </label>
                      <input
                        id="competition"
                        type="text"
                        value={competitionInput}
                        onChange={(e) => setCompetitionInput(e.target.value)}
                        placeholder="Ex: Brasileirão Série A, Champions League"
                        className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-700 dark:focus:border-emerald-500"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {QUICK_LEAGUES.map((league) => (
                          <button
                            key={league}
                            type="button"
                            onClick={() => setCompetitionInput(league)}
                            className={`min-h-[44px] px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border inline-flex items-center gap-1.5 ${
                              competitionInput === league
                                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            <CompetitionFlag competition={league} size="sm" />
                            <span>{league}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isAnalyzing}
                      className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 active:scale-[0.99] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-65"
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
                    <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 text-xs text-rose-800 dark:text-rose-200">
                      {analyzeError}
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Quer escolher um jogo da rodada?
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('fixtures')}
                      className="min-h-[44px] px-2.5 py-1 rounded-lg font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 whitespace-nowrap"
                    >
                      Ver agenda de jogos
                    </button>
                  </div>
                </section>
              </div>

              {/* Right Column on Desktop / Below on Mobile: Results */}
              <div className="lg:col-span-7 space-y-4">
                {isAnalyzing ? (
                  <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-8 text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-700 dark:text-emerald-400 mx-auto" />
                    <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                      Consultando fontes esportivas ao vivo
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
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
                    onOpenModules={() =>
                      modulesDetailsRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }
                  />
                ) : (
                  <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto">
                      <BarChart2 className="w-6 h-6" />
                    </div>
                    <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
                      Pronto para analisar qualquer confronto
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      Informe dois clubes no card Analisador ou escolha uma partida na aba Jogos para buscar estatísticas reais na Internet e gerar a matriz de probabilidades por Poisson.
                    </p>
                    <div className="pt-2 grid grid-cols-1 min-[380px]:grid-cols-3 gap-2 max-w-md mx-auto text-xs text-slate-600 dark:text-slate-300">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">5 Módulos</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">Forma, H2H, Tabela</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">Poisson</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">Matriz de placares</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">Tempo real</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">Fontes da web</div>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </div>

            {analysis && model && (
              <div ref={modulesDetailsRef} className="space-y-4 pt-1">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CompetitionFlag competition={analysis.data.competition} size="sm" />
                    <TeamCrest
                      name={analysis.data.homeTeam.name}
                      shortCode={analysis.data.homeTeam.shortCode}
                      primaryColor={analysis.data.homeTeam.primaryColor}
                      secondaryColor={analysis.data.homeTeam.secondaryColor}
                      logoUrl={analysis.data.homeTeam.logoUrl}
                      size="xs"
                    />
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {analysis.data.homeTeam.name} × {analysis.data.awayTeam.name}
                    </span>
                    <TeamCrest
                      name={analysis.data.awayTeam.name}
                      shortCode={analysis.data.awayTeam.shortCode}
                      primaryColor={analysis.data.awayTeam.primaryColor}
                      secondaryColor={analysis.data.awayTeam.secondaryColor}
                      logoUrl={analysis.data.awayTeam.logoUrl}
                      size="xs"
                    />
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
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
              </div>
            )}
          </div>
        )}

        {/* TAB 5: HISTÓRICO */}
        {activeTab === 'history' && (
          <HistoryView
            history={history}
            multipleHistory={multipleHistory}
            initialSection={historyInitialSection}
            isCheckingMultipleResults={isCheckingMultipleResults}
            multipleCheckMessage={multipleCheckMessage}
            liveScoresUpdatedAt={liveScoresUpdatedAt}
            authUser={authUser}
            isSigningIn={isSigningIn}
            onSignInGoogle={handleSignInGoogle}
            onRecordScore={handleRecordScore}
            onDeleteItem={handleDeleteHistory}
            onLoadSnapshot={handleLoadSnapshot}
            onUpdateMultipleLegStatus={handleUpdateMultipleLegStatus}
            onResolveMultipleTip={handleResolveMultipleTip}
            onDeleteMultipleItem={handleDeleteMultipleItem}
            onCheckMultipleResults={handleCheckMultipleResults}
            onImportBetSlip={handleImportBetSlip}
          />
        )}

        {/* TAB 6: AJUSTES */}
        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            theme={theme}
            authUser={authUser}
            isAdmin={isAdmin}
            userAccount={userAccount}
            historyCount={history.length}
            multipleHistory={multipleHistory}
            isSigningIn={isSigningIn}
            authError={authError}
            onSignInGoogle={handleSignInGoogle}
            onSignOut={handleSignOut}
            onChangeTheme={setTheme}
            onUpdateSettings={setSettings}
            onTestNotification={() =>
              pushNotification(
                {
                  title: 'Notificações ativas',
                  message:
                    'Você receberá alertas de gols ao vivo e bilhetes encerrados conforme seus ajustes.',
                  category: 'system',
                },
                true
              )
            }
            onOpenAdmin={() => setActiveTab('admin')}
          />
        )}

        {/* TAB 7: ADMIN */}
        {activeTab === 'admin' && (
          <AdminView
            authUser={authUser}
            isAdmin={isAdmin}
            isSigningIn={isSigningIn}
            globalConfig={globalConfig}
            onSignInGoogle={handleSignInGoogle}
          />
        )}
      </main>

      {/* Mobile "Mais" Drawer Sheet for Modelos / Ajustes / Admin */}
      {isMobileMoreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mais menus do aplicativo"
          className="md:hidden fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-end justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMobileMoreOpen(false);
          }}
        >
          <div className="w-full bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 shadow-2xl px-4 pt-2.5 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-3">
            <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto" />
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                Mais recursos e ajustes
              </h3>
              <button
                type="button"
                onClick={() => setIsMobileMoreOpen(false)}
                aria-label="Fechar menu"
                className="min-h-[44px] min-w-[44px] rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {mobileSecondaryItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                const subtitle =
                  item.id === 'modules'
                    ? 'Analisador estatístico, 5 módulos e matriz de Poisson'
                    : item.id === 'settings'
                      ? 'Painel do usuário, pesquisa de jogos e notificações'
                      : 'Configurações globais e gerenciamento de usuários';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectTab(item.id)}
                    className={`w-full min-h-[56px] px-3.5 py-2.5 rounded-2xl border text-left flex items-center gap-3 transition-colors ${
                      active
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-600 dark:border-emerald-500 text-emerald-950 dark:text-emerald-100'
                        : 'bg-slate-50/80 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        active
                          ? 'bg-emerald-700 text-white'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold truncate">{item.label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile & Tablet Fixed Bottom Navigation Bar (Natural Thumb Zone) */}
      <nav
        aria-label="Navegação principal móvel"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 pb-safe"
      >
        {/* Phones (< md): Fits all primary destinations + Mais sheet with zero horizontal cutoff */}
        <div
          className={`md:hidden grid items-center min-h-[56px] px-1 ${
            mobilePrimaryItems.length === 5 ? 'grid-cols-6' : 'grid-cols-5'
          }`}
        >
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={`min-h-[52px] px-1 py-1.5 flex flex-col items-center justify-center transition-colors ${
                  active
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? 'stroke-[2.25]' : 'stroke-[1.75]'}`} />
                <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap truncate max-w-full">
                  {item.mobileLabel ?? item.label}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setIsMobileMoreOpen(true)}
            aria-expanded={isMobileMoreOpen}
            className={`min-h-[52px] px-1 py-1.5 flex flex-col items-center justify-center transition-colors ${
              isSecondaryActive || isMobileMoreOpen
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Menu
              className={`w-5 h-5 shrink-0 ${
                isSecondaryActive || isMobileMoreOpen ? 'stroke-[2.25]' : 'stroke-[1.75]'
              }`}
            />
            <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
              Mais
            </span>
          </button>
        </div>

        {/* Tablets (md to lg-1): All tabs comfortably distributed in one row */}
        <div className="hidden md:grid grid-flow-col auto-cols-fr items-center min-h-[58px] px-2 max-w-4xl mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={`min-h-[52px] px-1.5 py-1.5 flex flex-col items-center justify-center transition-colors ${
                  active
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? 'stroke-[2.25]' : 'stroke-[1.75]'}`} />
                <span className="text-[11px] font-medium tracking-tight mt-0.5 whitespace-nowrap truncate max-w-full">
                  {item.mobileLabel ?? item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
