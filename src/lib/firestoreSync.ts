import { updateProfile, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import type {
  AppGlobalConfig,
  AppSettings,
  LiveMatchScore,
  MatchSearchWindow,
  MatchSortMode,
  MultipleHistoryItem,
  MultipleHistoryLeg,
  MultipleTipStatus,
  NotificationPreferences,
  PredictionHistoryItem,
  SearchPreferences,
  UserAccountRecord,
  UserAccountStatus,
  UserRole,
} from '../types/football.ts';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'l2xbrasil@gmail.com';

export const DEFAULT_SEARCH_PREFERENCES: SearchPreferences = {
  window: 'week',
  includeLiveMatches: true,
  sortBy: 'time',
  favoriteLeagues: [],
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  browserPush: false,
  notifyLiveGoals: true,
  notifyBetResolved: true,
  notifyDailySuperTip: false,
  notifyKickoffMinutes: 30,
  soundEnabled: false,
};

export const DEFAULT_APP_GLOBAL_CONFIG: AppGlobalConfig = {
  appName: 'CampoStats',
  announcementBanner: '',
  maintenanceMode: false,
  bettingMenuEnabled: true,
  defaultChampionshipScope: 'brasil',
  defaultMultipleCount: 3,
  defaultSearchWindow: 'week',
  oddsMarginPct: 5,
  minTipProbabilityPct: 60,
};

export function sanitizeDocId(rawId: string): string {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 128);
  return cleaned || `doc-${Date.now()}`;
}

function clampStr(value: unknown, maxLength: number, fallback = ''): string {
  const str = typeof value === 'string' ? value : String(value ?? fallback);
  const trimmed = str.trim();
  if (!trimmed && fallback) return fallback.slice(0, maxLength);
  return trimmed.slice(0, maxLength);
}

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

function toIsoString(val: unknown, fallback?: string): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (
    val &&
    typeof val === 'object' &&
    typeof (val as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === 'string' && val.trim()) {
    return val;
  }
  return fallback || new Date().toISOString();
}

export async function upsertUserProfile(user: User): Promise<void> {
  if (!user.uid || !user.email) return;
  const path = `users/${user.uid}/private/profile`;
  const ref = doc(db, 'users', user.uid, 'private', 'profile');

  try {
    const snap = await getDoc(ref);
    const existingName = snap.exists() ? snap.data()?.displayName : undefined;
    const updatePayload: Record<string, unknown> = {
      email: clampStr(user.email, 254),
      updatedAt: serverTimestamp(),
    };
    if (
      (!existingName || typeof existingName !== 'string' || !existingName.trim()) &&
      user.displayName
    ) {
      updatePayload.displayName = clampStr(user.displayName, 120);
    }
    if (user.photoURL) {
      updatePayload.photoURL = clampStr(user.photoURL, 512);
    }

    if (snap.exists()) {
      await updateDoc(ref, updatePayload);
    } else {
      await setDoc(ref, {
        ownerId: user.uid,
        ...(user.displayName ? { displayName: clampStr(user.displayName, 120) } : {}),
        ...updatePayload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function getUserPrimaryEmail(user: User | null): string | null {
  if (!user) return null;
  if (user.email && user.email.trim()) return user.email.trim();
  const providerEmail = user.providerData?.find((p) => p?.email?.trim())?.email;
  return providerEmail ? providerEmail.trim() : null;
}

export async function updateUserDisplayName(
  user: User,
  nextDisplayName: string
): Promise<string> {
  const userEmail = getUserPrimaryEmail(user);
  if (!user.uid || !userEmail || !user.emailVerified) {
    throw new Error('Entre com uma conta Google verificada para atualizar seu perfil.');
  }
  const cleaned = clampStr(nextDisplayName, 120);
  if (cleaned.length < 2) {
    throw new Error('Informe um nome com pelo menos 2 caracteres.');
  }

  try {
    await updateProfile(user, { displayName: cleaned });
  } catch {
    // Non-fatal if Firebase Auth profile update is skipped; Firestore remains source of truth
  }

  const profilePath = `users/${user.uid}/private/profile`;
  const profileRef = doc(db, 'users', user.uid, 'private', 'profile');
  try {
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
      await updateDoc(profileRef, {
        displayName: cleaned,
        email: clampStr(userEmail, 254),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(profileRef, {
        ownerId: user.uid,
        email: clampStr(userEmail, 254),
        displayName: cleaned,
        ...(user.photoURL ? { photoURL: clampStr(user.photoURL, 512) } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }

  const accountPath = `userAccounts/${user.uid}`;
  const accountRef = doc(db, 'userAccounts', user.uid);
  const bootstrappedAdmin = isBootstrappedAdminEmail(userEmail);
  try {
    const accSnap = await getDoc(accountRef);
    if (accSnap.exists()) {
      await updateDoc(accountRef, {
        displayName: cleaned,
        updatedAt: serverTimestamp(),
      });
      if (
        bootstrappedAdmin &&
        (accSnap.data()?.role !== 'admin' || accSnap.data()?.status !== 'active')
      ) {
        await updateDoc(accountRef, {
          role: 'admin',
          status: 'active',
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      await setDoc(accountRef, {
        ownerId: user.uid,
        email: clampStr(userEmail, 254),
        displayName: cleaned,
        role: bootstrappedAdmin ? 'admin' : 'user',
        status: 'active',
        analysesCount: 0,
        multiplesCount: 0,
        lastLoginAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(user.photoURL ? { photoURL: clampStr(user.photoURL, 512) } : {}),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, accountPath);
  }

  return cleaned;
}

export interface SyncedPreferences {
  settings: AppSettings;
  theme: 'light' | 'dark';
}

function normalizeSearchPreferences(raw: unknown): SearchPreferences {
  const sp = (raw && typeof raw === 'object' ? raw : {}) as Partial<SearchPreferences>;
  const windowVal: MatchSearchWindow =
    sp.window === 'today' || sp.window === '48h' || sp.window === 'week'
      ? sp.window
      : DEFAULT_SEARCH_PREFERENCES.window;
  const sortByVal: MatchSortMode =
    sp.sortBy === 'time' || sp.sortBy === 'league' || sp.sortBy === 'odds_balance'
      ? sp.sortBy
      : DEFAULT_SEARCH_PREFERENCES.sortBy;
  const favoriteLeagues = Array.isArray(sp.favoriteLeagues)
    ? Array.from(
        new Set(
          sp.favoriteLeagues
            .map((s) => clampStr(s, 64))
            .filter(Boolean)
        )
      ).slice(0, 12)
    : [];

  return {
    window: windowVal,
    includeLiveMatches: Boolean(sp.includeLiveMatches ?? true),
    sortBy: sortByVal,
    favoriteLeagues,
  };
}

function normalizeNotificationPreferences(raw: unknown): NotificationPreferences {
  const np = (raw && typeof raw === 'object' ? raw : {}) as Partial<NotificationPreferences>;
  const rawMinutes = Number(np.notifyKickoffMinutes);
  const kickoffMinutes: 0 | 15 | 30 | 60 =
    rawMinutes === 0 || rawMinutes === 15 || rawMinutes === 30 || rawMinutes === 60
      ? rawMinutes
      : 30;

  return {
    enabled: Boolean(np.enabled ?? true),
    browserPush: Boolean(np.browserPush ?? false),
    notifyLiveGoals: Boolean(np.notifyLiveGoals ?? true),
    notifyBetResolved: Boolean(np.notifyBetResolved ?? true),
    notifyDailySuperTip: Boolean(np.notifyDailySuperTip ?? false),
    notifyKickoffMinutes: kickoffMinutes,
    soundEnabled: Boolean(np.soundEnabled ?? false),
  };
}

export function subscribeUserPreferences(
  uid: string,
  onData: (prefs: SyncedPreferences | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/settings/preferences`;
  const ref = doc(db, 'users', uid, 'settings', 'preferences');

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        theme: d.theme === 'dark' ? 'dark' : 'light',
        settings: {
          championshipScope:
            d.championshipScope === 'principais' || d.championshipScope === 'todos'
              ? d.championshipScope
              : 'brasil',
          updateMode: d.updateMode === 'manual' ? 'manual' : 'auto',
          activeModules: {
            lastFive: Boolean(d.activeModules?.lastFive ?? true),
            headToHead: Boolean(d.activeModules?.headToHead ?? true),
            standings: Boolean(d.activeModules?.standings ?? true),
            poisson: Boolean(d.activeModules?.poisson ?? true),
            goalsAndBtts: Boolean(d.activeModules?.goalsAndBtts ?? true),
            corners: Boolean(d.activeModules?.corners ?? true),
            cards: Boolean(d.activeModules?.cards ?? true),
            contextFactors: Boolean(d.activeModules?.contextFactors ?? true),
          },
          recentFormWeight: clampNum(d.recentFormWeight, 0.15, 0.55, 0.35),
          homeAdvantageMultiplier: clampNum(
            d.homeAdvantageMultiplier,
            1.0,
            1.25,
            1.12
          ),
          searchPreferences: normalizeSearchPreferences(d.searchPreferences),
          notifications: normalizeNotificationPreferences(d.notifications),
        },
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function saveUserPreferences(
  uid: string,
  settings: AppSettings,
  theme: 'light' | 'dark'
): Promise<void> {
  const path = `users/${uid}/settings/preferences`;
  const ref = doc(db, 'users', uid, 'settings', 'preferences');

  const basePayload = {
    ownerId: uid,
    theme: theme === 'dark' ? 'dark' : 'light',
    championshipScope: settings.championshipScope,
    updateMode: settings.updateMode,
    activeModules: {
      lastFive: Boolean(settings.activeModules.lastFive),
      headToHead: Boolean(settings.activeModules.headToHead),
      standings: Boolean(settings.activeModules.standings),
      poisson: Boolean(settings.activeModules.poisson),
      goalsAndBtts: Boolean(settings.activeModules.goalsAndBtts),
      corners: Boolean(settings.activeModules.corners),
      cards: Boolean(settings.activeModules.cards),
      contextFactors: Boolean(settings.activeModules.contextFactors),
    },
    recentFormWeight: clampNum(settings.recentFormWeight, 0.15, 0.55, 0.35),
    homeAdvantageMultiplier: clampNum(
      settings.homeAdvantageMultiplier,
      1.0,
      1.25,
      1.12
    ),
    searchPreferences: normalizeSearchPreferences(settings.searchPreferences),
    notifications: normalizeNotificationPreferences(settings.notifications),
    updatedAt: serverTimestamp(),
  };

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      const { ownerId: _ignoredOwner, ...updateFields } = basePayload;
      await updateDoc(ref, updateFields);
    } else {
      await setDoc(ref, {
        ...basePayload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

function buildAnalysisCreateDoc(uid: string, item: PredictionHistoryItem) {
  const docId = sanitizeDocId(item.id);
  const nowIso = new Date().toISOString();

  const rawDoc: Record<string, unknown> = {
    ownerId: uid,
    id: docId,
    competition: clampStr(item.competition, 140, 'Campeonato'),
    homeTeam: stripUndefinedDeep(item.homeTeam),
    awayTeam: stripUndefinedDeep(item.awayTeam),
    predictedHomePct: clampNum(item.predictedHomePct, 0, 100, 34),
    predictedDrawPct: clampNum(item.predictedDrawPct, 0, 100, 33),
    predictedAwayPct: clampNum(item.predictedAwayPct, 0, 100, 33),
    expectedGoalsHome: clampNum(item.expectedGoalsHome, 0, 15, 1),
    expectedGoalsAway: clampNum(item.expectedGoalsAway, 0, 15, 1),
    mostLikelyScore: clampStr(item.mostLikelyScore, 24, '1 x 1'),
    over25Pct: clampNum(item.over25Pct, 0, 100, 50),
    bttsPct: clampNum(item.bttsPct, 0, 100, 50),
    savedAtIso: clampStr(item.createdAt, 64, nowIso),
    updatedAtIso: clampStr(item.updatedAt, 64, nowIso),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (item.liveScore) {
    rawDoc.liveScore = stripUndefinedDeep(item.liveScore);
  }
  if (item.actualScore) {
    rawDoc.actualScore = stripUndefinedDeep(item.actualScore);
  }
  if (item.snapshot) {
    const trimmedSnapshot = {
      ...item.snapshot,
      sources: Array.isArray(item.snapshot.sources)
        ? item.snapshot.sources.slice(0, 12)
        : [],
      data: {
        ...item.snapshot.data,
        dataWarnings: Array.isArray(item.snapshot.data?.dataWarnings)
          ? item.snapshot.data.dataWarnings.slice(0, 10)
          : [],
      },
    };
    rawDoc.snapshot = stripUndefinedDeep(trimmedSnapshot);
  }

  return { docId, docData: rawDoc };
}

function mapAnalysisSnap(
  id: string,
  d: Record<string, any>
): PredictionHistoryItem {
  return {
    id,
    createdAt: toIsoString(d.savedAtIso || d.createdAt),
    updatedAt: toIsoString(d.updatedAtIso || d.updatedAt),
    competition: String(d.competition || ''),
    homeTeam: d.homeTeam,
    awayTeam: d.awayTeam,
    predictedHomePct: Number(d.predictedHomePct ?? 0),
    predictedDrawPct: Number(d.predictedDrawPct ?? 0),
    predictedAwayPct: Number(d.predictedAwayPct ?? 0),
    expectedGoalsHome: Number(d.expectedGoalsHome ?? 0),
    expectedGoalsAway: Number(d.expectedGoalsAway ?? 0),
    mostLikelyScore: String(d.mostLikelyScore || '1 x 1'),
    over25Pct: Number(d.over25Pct ?? 0),
    bttsPct: Number(d.bttsPct ?? 0),
    liveScore: d.liveScore,
    actualScore: d.actualScore,
    snapshot: d.snapshot,
  };
}

export function subscribeUserAnalyses(
  uid: string,
  onData: (items: PredictionHistoryItem[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/analyses`;
  const q = query(
    collection(db, 'users', uid, 'analyses'),
    where('ownerId', '==', uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: PredictionHistoryItem[] = snapshot.docs.map((docSnap) =>
        mapAnalysisSnap(docSnap.id, docSnap.data())
      );
      items.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function createUserAnalysis(
  uid: string,
  item: PredictionHistoryItem
): Promise<string> {
  const { docId, docData } = buildAnalysisCreateDoc(uid, item);
  const path = `users/${uid}/analyses/${docId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'analyses', docId), docData);
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateUserAnalysisScore(
  uid: string,
  analysisId: string,
  updates: {
    liveScore?: LiveMatchScore;
    actualScore?: PredictionHistoryItem['actualScore'];
  }
): Promise<void> {
  const docId = sanitizeDocId(analysisId);
  const path = `users/${uid}/analyses/${docId}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (updates.liveScore !== undefined) {
    payload.liveScore = stripUndefinedDeep(updates.liveScore);
  }
  if (updates.actualScore !== undefined) {
    payload.actualScore = stripUndefinedDeep(updates.actualScore);
  }
  try {
    await updateDoc(doc(db, 'users', uid, 'analyses', docId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteUserAnalysis(
  uid: string,
  analysisId: string
): Promise<void> {
  const docId = sanitizeDocId(analysisId);
  const path = `users/${uid}/analyses/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'analyses', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function sanitizeLegs(legs: MultipleHistoryLeg[]): MultipleHistoryLeg[] {
  return legs.slice(0, 20).map((leg) =>
    stripUndefinedDeep({
      ...leg,
      homeTeam: clampStr(leg.homeTeam, 100, 'Mandante'),
      awayTeam: clampStr(leg.awayTeam, 100, 'Visitante'),
      homeShortCode: clampStr(leg.homeShortCode, 12, 'CAS'),
      awayShortCode: clampStr(leg.awayShortCode, 12, 'FOR'),
      competition: leg.competition ? clampStr(leg.competition, 120) : undefined,
      dateLabel: clampStr(leg.dateLabel, 80, 'Hoje'),
      marketLabel: clampStr(leg.marketLabel, 140, 'Mercado'),
      rationale: clampStr(leg.rationale || '', 400),
      odd: clampNum(leg.odd, 1, 10000, 1),
      probabilityPct: clampNum(leg.probabilityPct, 0, 100, 50),
      expectedGoalsHome: clampNum(leg.expectedGoalsHome, 0, 15, 1),
      expectedGoalsAway: clampNum(leg.expectedGoalsAway, 0, 15, 1),
      status:
        leg.status === 'won' || leg.status === 'lost' ? leg.status : 'pending',
    })
  );
}

function buildMultipleCreateDoc(uid: string, item: MultipleHistoryItem) {
  const docId = sanitizeDocId(item.id);
  const nowIso = new Date().toISOString();
  const safeLegs = sanitizeLegs(item.legs || []);

  const rawDoc: Record<string, unknown> = {
    ownerId: uid,
    id: docId,
    tipSignature: clampStr(item.tipSignature, 500, docId),
    competition: clampStr(item.competition, 180, 'Múltipla'),
    leagueSlug: clampStr(item.leagueSlug, 80, 'world'),
    dayFilter:
      item.dayFilter === 'today' || item.dayFilter === 'tomorrow'
        ? item.dayFilter
        : 'all',
    legs: safeLegs,
    combinedProbabilityPct: clampNum(item.combinedProbabilityPct, 0, 100, 0),
    totalOdd: clampNum(item.totalOdd, 1, 100000, 1),
    stake: clampNum(item.stake, 0, 10000000, 0),
    potentialReturn: clampNum(item.potentialReturn, 0, 100000000, 0),
    status:
      item.status === 'won' || item.status === 'lost' ? item.status : 'pending',
    savedAtIso: clampStr(item.createdAt, 64, nowIso),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (item.source === 'tip' || item.source === 'image') {
    rawDoc.source = item.source;
  }
  if (item.bookmaker) {
    rawDoc.bookmaker = clampStr(item.bookmaker, 100);
  }
  if (item.notes) {
    rawDoc.notes = clampStr(item.notes, 300);
  }
  if (item.resolvedAt) {
    rawDoc.resolvedAt = clampStr(item.resolvedAt, 64);
  }

  return { docId, docData: rawDoc };
}

function mapMultipleSnap(
  id: string,
  d: Record<string, any>
): MultipleHistoryItem {
  return {
    id,
    tipSignature: String(d.tipSignature || id),
    createdAt: toIsoString(d.savedAtIso || d.createdAt),
    competition: String(d.competition || ''),
    leagueSlug: String(d.leagueSlug || 'world'),
    dayFilter:
      d.dayFilter === 'today' || d.dayFilter === 'tomorrow'
        ? d.dayFilter
        : 'all',
    legs: Array.isArray(d.legs) ? d.legs : [],
    combinedProbabilityPct: Number(d.combinedProbabilityPct ?? 0),
    totalOdd: Number(d.totalOdd ?? 1),
    stake: Number(d.stake ?? 0),
    potentialReturn: Number(d.potentialReturn ?? 0),
    status: d.status === 'won' || d.status === 'lost' ? d.status : 'pending',
    source: d.source === 'tip' || d.source === 'image' ? d.source : undefined,
    bookmaker: d.bookmaker ? String(d.bookmaker) : undefined,
    notes: d.notes ? String(d.notes) : undefined,
    resolvedAt: d.resolvedAt ? String(d.resolvedAt) : undefined,
  };
}

export function subscribeUserMultiples(
  uid: string,
  onData: (items: MultipleHistoryItem[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/multiples`;
  const q = query(
    collection(db, 'users', uid, 'multiples'),
    where('ownerId', '==', uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: MultipleHistoryItem[] = snapshot.docs.map((docSnap) =>
        mapMultipleSnap(docSnap.id, docSnap.data())
      );
      items.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function createUserMultiple(
  uid: string,
  item: MultipleHistoryItem
): Promise<string> {
  const { docId, docData } = buildMultipleCreateDoc(uid, item);
  const path = `users/${uid}/multiples/${docId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'multiples', docId), docData);
    return docId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateUserMultipleSlip(
  uid: string,
  multipleId: string,
  updates: {
    legs: MultipleHistoryLeg[];
    status: MultipleTipStatus;
    resolvedAt?: string;
  }
): Promise<void> {
  const docId = sanitizeDocId(multipleId);
  const path = `users/${uid}/multiples/${docId}`;
  const payload: Record<string, unknown> = {
    legs: sanitizeLegs(updates.legs),
    status:
      updates.status === 'won' || updates.status === 'lost'
        ? updates.status
        : 'pending',
    resolvedAt: updates.resolvedAt
      ? clampStr(updates.resolvedAt, 64)
      : deleteField(),
    updatedAt: serverTimestamp(),
  };
  try {
    await updateDoc(doc(db, 'users', uid, 'multiples', docId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteUserMultiple(
  uid: string,
  multipleId: string
): Promise<void> {
  const docId = sanitizeDocId(multipleId);
  const path = `users/${uid}/multiples/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'multiples', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function migrateLocalDataToFirestore(
  uid: string,
  localData: {
    history: PredictionHistoryItem[];
    multipleHistory: MultipleHistoryItem[];
    settings: AppSettings;
    theme: 'light' | 'dark';
  }
): Promise<void> {
  // 1. Ensure preferences document exists (do not overwrite existing cloud prefs)
  const prefRef = doc(db, 'users', uid, 'settings', 'preferences');
  try {
    const prefSnap = await getDoc(prefRef);
    if (!prefSnap.exists()) {
      await saveUserPreferences(uid, localData.settings, localData.theme);
    }
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.GET,
      `users/${uid}/settings/preferences`
    );
  }

  // 2. Migrate any locally saved 1X2 analyses missing from cloud
  if (localData.history.length > 0) {
    const analysesPath = `users/${uid}/analyses`;
    try {
      const existingSnap = await getDocs(
        query(collection(db, 'users', uid, 'analyses'), where('ownerId', '==', uid))
      );
      const existingIds = new Set(existingSnap.docs.map((d) => d.id));
      for (const item of localData.history) {
        const docId = sanitizeDocId(item.id);
        if (!existingIds.has(docId)) {
          await createUserAnalysis(uid, item);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, analysesPath);
    }
  }

  // 3. Migrate any locally saved multiples / slips missing from cloud
  if (localData.multipleHistory.length > 0) {
    const multiplesPath = `users/${uid}/multiples`;
    try {
      const existingSnap = await getDocs(
        query(
          collection(db, 'users', uid, 'multiples'),
          where('ownerId', '==', uid)
        )
      );
      const existingIds = new Set(existingSnap.docs.map((d) => d.id));
      const existingSigs = new Set(
        existingSnap.docs.map((d) => String(d.data().tipSignature || ''))
      );
      for (const item of localData.multipleHistory) {
        if (!Array.isArray(item.legs) || item.legs.length === 0) continue;
        const docId = sanitizeDocId(item.id);
        if (!existingIds.has(docId) && !existingSigs.has(item.tipSignature)) {
          await createUserMultiple(uid, item);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, multiplesPath);
    }
  }
}

export function isBootstrappedAdminEmail(email?: string | null): boolean {
  return Boolean(email && email.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL);
}

export async function ensureBootstrappedAdminGrant(user: User | null): Promise<void> {
  const email = getUserPrimaryEmail(user);
  if (!user || !user.uid || !user.emailVerified || !isBootstrappedAdminEmail(email)) {
    return;
  }
  const path = `admins/${user.uid}`;
  const adminRef = doc(db, 'admins', user.uid);
  let exists = false;
  try {
    const adminSnap = await getDoc(adminRef);
    exists = adminSnap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    try {
      await setDoc(adminRef, {
        uid: user.uid,
        email: clampStr(email, 254),
        grantedByUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

export async function checkUserIsAdmin(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (isBootstrappedAdminEmail(getUserPrimaryEmail(user))) return true;
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    return adminSnap.exists();
  } catch {
    return false;
  }
}

export function subscribeAppGlobalConfig(
  onData: (config: AppGlobalConfig) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'appConfig/global';
  const ref = doc(db, 'appConfig', 'global');

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData({ ...DEFAULT_APP_GLOBAL_CONFIG });
        return;
      }
      const d = snap.data();
      const rawMult = Number(d.defaultMultipleCount);
      const defaultMultipleCount: 3 | 4 | 5 | 10 =
        rawMult === 4 || rawMult === 5 || rawMult === 10 ? rawMult : 3;
      onData({
        appName: clampStr(d.appName, 80, 'CampoStats'),
        announcementBanner: clampStr(d.announcementBanner ?? '', 280),
        maintenanceMode: Boolean(d.maintenanceMode),
        bettingMenuEnabled: Boolean(d.bettingMenuEnabled ?? true),
        defaultChampionshipScope:
          d.defaultChampionshipScope === 'principais' ||
          d.defaultChampionshipScope === 'todos'
            ? d.defaultChampionshipScope
            : 'brasil',
        defaultMultipleCount,
        defaultSearchWindow:
          d.defaultSearchWindow === 'today' || d.defaultSearchWindow === '48h'
            ? d.defaultSearchWindow
            : 'week',
        oddsMarginPct: clampNum(d.oddsMarginPct, 0, 20, 5),
        minTipProbabilityPct: clampNum(d.minTipProbabilityPct, 50, 90, 60),
        updatedAt: d.updatedAt ? toIsoString(d.updatedAt) : undefined,
        updatedByEmail: d.updatedByEmail ? String(d.updatedByEmail) : undefined,
      });
    },
    (error) => {
      if (onError) {
        try {
          handleFirestoreError(error, OperationType.GET, path);
        } catch (wrapped) {
          onError(wrapped as Error);
        }
      }
    }
  );
}

export async function saveAppGlobalConfig(
  adminUser: User,
  config: AppGlobalConfig
): Promise<void> {
  if (!adminUser.uid || !adminUser.email) return;
  const path = 'appConfig/global';
  const ref = doc(db, 'appConfig', 'global');
  const rawMult = Number(config.defaultMultipleCount);
  const defaultMultipleCount: 3 | 4 | 5 | 10 =
    rawMult === 4 || rawMult === 5 || rawMult === 10 ? rawMult : 3;

  const basePayload = {
    appName: clampStr(config.appName, 80, 'CampoStats'),
    announcementBanner: clampStr(config.announcementBanner ?? '', 280),
    maintenanceMode: Boolean(config.maintenanceMode),
    bettingMenuEnabled: Boolean(config.bettingMenuEnabled),
    defaultChampionshipScope:
      config.defaultChampionshipScope === 'principais' ||
      config.defaultChampionshipScope === 'todos'
        ? config.defaultChampionshipScope
        : 'brasil',
    defaultMultipleCount,
    defaultSearchWindow:
      config.defaultSearchWindow === 'today' ||
      config.defaultSearchWindow === '48h'
        ? config.defaultSearchWindow
        : 'week',
    oddsMarginPct: clampNum(config.oddsMarginPct, 0, 20, 5),
    minTipProbabilityPct: clampNum(config.minTipProbabilityPct, 50, 90, 60),
    updatedByUid: adminUser.uid,
    updatedByEmail: clampStr(adminUser.email, 254),
    updatedAt: serverTimestamp(),
  };

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, basePayload);
    } else {
      await setDoc(ref, {
        ...basePayload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertUserAccountRecord(
  user: User,
  stats: { analysesCount: number; multiplesCount: number }
): Promise<void> {
  const rawEmail = getUserPrimaryEmail(user);
  if (!user.uid || !rawEmail || !user.emailVerified) return;
  const path = `userAccounts/${user.uid}`;
  const ref = doc(db, 'userAccounts', user.uid);
  const displayName = clampStr(
    user.displayName || rawEmail.split('@')[0] || 'Usuário',
    120,
    'Usuário'
  );
  const email = clampStr(rawEmail, 254);
  const bootstrappedAdmin = isBootstrappedAdminEmail(rawEmail);
  const analysesCount = Math.max(0, Math.min(100000, Math.floor(stats.analysesCount)));
  const multiplesCount = Math.max(0, Math.min(100000, Math.floor(stats.multiplesCount)));

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const existingData = snap.data();
      const existingName = existingData?.displayName;
      const resolvedName =
        typeof existingName === 'string' && existingName.trim()
          ? clampStr(existingName, 120)
          : displayName;
      const updatePayload: Record<string, unknown> = {
        displayName: resolvedName,
        email,
        analysesCount,
        multiplesCount,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (user.photoURL) {
        updatePayload.photoURL = clampStr(user.photoURL, 512);
      }
      await updateDoc(ref, updatePayload);

      if (
        bootstrappedAdmin &&
        (existingData?.role !== 'admin' || existingData?.status !== 'active')
      ) {
        await updateDoc(ref, {
          role: 'admin',
          status: 'active',
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      const createPayload: Record<string, unknown> = {
        ownerId: user.uid,
        email,
        displayName,
        role: bootstrappedAdmin ? 'admin' : 'user',
        status: 'active',
        analysesCount,
        multiplesCount,
        lastLoginAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (user.photoURL) {
        createPayload.photoURL = clampStr(user.photoURL, 512);
      }
      await setDoc(ref, createPayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

function mapUserAccountSnap(
  id: string,
  d: Record<string, any>
): UserAccountRecord {
  const role: UserRole = d.role === 'admin' ? 'admin' : 'user';
  const status: UserAccountStatus = d.status === 'blocked' ? 'blocked' : 'active';
  return {
    uid: id,
    ownerId: String(d.ownerId || id),
    email: String(d.email || ''),
    displayName: String(d.displayName || 'Usuário'),
    photoURL: d.photoURL ? String(d.photoURL) : undefined,
    role,
    status,
    analysesCount: Number(d.analysesCount ?? 0),
    multiplesCount: Number(d.multiplesCount ?? 0),
    lastLoginAt: toIsoString(d.lastLoginAt),
    createdAt: toIsoString(d.createdAt),
    updatedAt: toIsoString(d.updatedAt),
  };
}

export function subscribeCurrentUserAccount(
  uid: string,
  onData: (account: UserAccountRecord | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `userAccounts/${uid}`;
  const ref = doc(db, 'userAccounts', uid);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapUserAccountSnap(snap.id, snap.data()));
    },
    (error) => {
      if (onError) {
        try {
          handleFirestoreError(error, OperationType.GET, path);
        } catch (wrapped) {
          onError(wrapped as Error);
        }
      }
    }
  );
}

export function subscribeAllUserAccounts(
  onData: (accounts: UserAccountRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'userAccounts';
  const ref = collection(db, 'userAccounts');

  return onSnapshot(
    ref,
    (snapshot) => {
      const list = snapshot.docs.map((docSnap) =>
        mapUserAccountSnap(docSnap.id, docSnap.data())
      );
      list.sort(
        (a, b) =>
          new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime()
      );
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function adminUpdateUserAccount(
  adminUser: User,
  targetAccount: UserAccountRecord,
  updates: {
    role?: UserRole;
    status?: UserAccountStatus;
  }
): Promise<void> {
  const targetUid = sanitizeDocId(targetAccount.uid);
  const path = `userAccounts/${targetUid}`;
  const accountRef = doc(db, 'userAccounts', targetUid);

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (updates.role) {
    payload.role = updates.role;
  }
  if (updates.status) {
    payload.status = updates.status;
  }

  try {
    await updateDoc(accountRef, payload);

    if (updates.role !== undefined) {
      const adminRef = doc(db, 'admins', targetUid);
      if (updates.role === 'admin') {
        const existingAdmin = await getDoc(adminRef);
        if (existingAdmin.exists()) {
          await updateDoc(adminRef, {
            email: clampStr(targetAccount.email, 254),
            grantedByUid: adminUser.uid,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(adminRef, {
            uid: targetUid,
            email: clampStr(targetAccount.email, 254),
            grantedByUid: adminUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } else if (!isBootstrappedAdminEmail(targetAccount.email)) {
        const existingAdmin = await getDoc(adminRef);
        if (existingAdmin.exists()) {
          await deleteDoc(adminRef);
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchUserHistoryForAdmin(
  targetUid: string
): Promise<{
  analyses: PredictionHistoryItem[];
  multiples: MultipleHistoryItem[];
}> {
  const safeUid = sanitizeDocId(targetUid);
  const analysesPath = `users/${safeUid}/analyses`;
  const multiplesPath = `users/${safeUid}/multiples`;

  let analyses: PredictionHistoryItem[] = [];
  try {
    const snap = await getDocs(
      query(collection(db, 'users', safeUid, 'analyses'), where('ownerId', '==', safeUid))
    );
    analyses = snap.docs
      .map((d) => mapAnalysisSnap(d.id, d.data()))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, analysesPath);
  }

  let multiples: MultipleHistoryItem[] = [];
  try {
    const snap = await getDocs(
      query(collection(db, 'users', safeUid, 'multiples'), where('ownerId', '==', safeUid))
    );
    multiples = snap.docs
      .map((d) => mapMultipleSnap(d.id, d.data()))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, multiplesPath);
  }

  return { analyses, multiples };
}
