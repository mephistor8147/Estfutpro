import type { User } from 'firebase/auth';
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
  AppSettings,
  LiveMatchScore,
  MultipleHistoryItem,
  MultipleHistoryLeg,
  MultipleTipStatus,
  PredictionHistoryItem,
} from '../types/football.ts';

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
    const updatePayload: Record<string, unknown> = {
      email: clampStr(user.email, 254),
      updatedAt: serverTimestamp(),
    };
    if (user.displayName) {
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
        ...updatePayload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface SyncedPreferences {
  settings: AppSettings;
  theme: 'light' | 'dark';
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
      const items: PredictionHistoryItem[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
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
      });
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
      const items: MultipleHistoryItem[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          tipSignature: String(d.tipSignature || docSnap.id),
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
          status:
            d.status === 'won' || d.status === 'lost' ? d.status : 'pending',
          source:
            d.source === 'tip' || d.source === 'image' ? d.source : undefined,
          bookmaker: d.bookmaker ? String(d.bookmaker) : undefined,
          notes: d.notes ? String(d.notes) : undefined,
          resolvedAt: d.resolvedAt ? String(d.resolvedAt) : undefined,
        };
      });
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
