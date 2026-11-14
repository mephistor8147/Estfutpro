import type {
  AnalysisResponsePayload,
  ChampionshipScope,
  GroundingSource,
  HeadToHeadMatch,
  MatchAnalysisData,
  MatchOutcome,
  RecentMatchItem,
  SuggestedFixture,
  TeamComplementaryStats,
  TeamIdentity,
  TeamLastFiveStats,
  TeamStandingsStats,
} from '../types/football.ts';

interface EspnSearchTeam {
  id: string;
  displayName: string;
  abbreviation: string;
  color: string;
  alternateColor: string;
  defaultLeagueSlug: string;
  leagueName?: string;
}

const LEAGUE_SLUG_MAP: { match: RegExp; slug: string; label: string }[] = [
  { match: /brasileir[aã]o.*b|s[eé]rie b/i, slug: 'bra.2', label: 'Brasileirão Série B' },
  { match: /brasileir[aã]o|s[eé]rie a|brasil/i, slug: 'bra.1', label: 'Brasileirão Série A' },
  { match: /libertadores/i, slug: 'conmebol.libertadores', label: 'Copa Libertadores' },
  { match: /sul-?americana|sudamericana/i, slug: 'conmebol.sudamericana', label: 'Copa Sul-Americana' },
  { match: /premier\s*league|ingl[eê]s/i, slug: 'eng.1', label: 'Premier League' },
  { match: /la\s*liga|espanhol/i, slug: 'esp.1', label: 'La Liga' },
  { match: /champions/i, slug: 'uefa.champions', label: 'UEFA Champions League' },
  { match: /europa\s*league/i, slug: 'uefa.europa', label: 'UEFA Europa League' },
  { match: /serie\s*a.*it[aá]l|italiano/i, slug: 'ita.1', label: 'Serie A Itália' },
  { match: /bundesliga|alem[aã]o/i, slug: 'ger.1', label: 'Bundesliga' },
  { match: /ligue\s*1|franc[eê]s/i, slug: 'fra.1', label: 'Ligue 1' },
  { match: /portug|primeira liga/i, slug: 'por.1', label: 'Liga Portugal' },
  { match: /argentin/i, slug: 'arg.1', label: 'Liga Profesional Argentina' },
  { match: /mls/i, slug: 'usa.1', label: 'MLS' },
];

const LEAGUE_LABELS: Record<string, string> = {
  'bra.1': 'Brasileirão Série A',
  'bra.2': 'Brasileirão Série B',
  'conmebol.libertadores': 'Copa Libertadores',
  'conmebol.sudamericana': 'Copa Sul-Americana',
  'eng.1': 'Premier League',
  'esp.1': 'La Liga',
  'uefa.champions': 'UEFA Champions League',
  'uefa.europa': 'UEFA Europa League',
  'ita.1': 'Serie A Itália',
  'ger.1': 'Bundesliga',
  'fra.1': 'Ligue 1',
  'por.1': 'Liga Portugal',
  'arg.1': 'Liga Profesional Argentina',
  'usa.1': 'MLS',
};

function resolveLeagueSlug(competitionInput: string): string | null {
  if (!competitionInput.trim()) return null;
  for (const entry of LEAGUE_SLUG_MAP) {
    if (entry.match.test(competitionInput)) {
      return entry.slug;
    }
  }
  return null;
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function sanitizeHex(hex?: string, fallback = '#0F766E'): string {
  if (!hex) return fallback;
  const clean = hex.startsWith('#') ? hex : `#${hex}`;
  return /^#[0-9A-Fa-f]{6}$/.test(clean) ? clean : fallback;
}

async function searchEspnTeam(
  query: string,
  preferredSlug: string | null
): Promise<EspnSearchTeam | null> {
  const url = `https://site.web.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(
    query
  )}&limit=10&type=team`;
  const data = await fetchJson<{ items?: any[] }>(url);
  const items = (data?.items || []).filter((item) => item?.sport === 'soccer');
  if (items.length === 0) return null;

  // Filter out youth / women / reserve squads unless user specifically asked
  const qNorm = normalizeText(query);
  const wantsYouthOrWomen = /u20|u19|u23|sub-?20|fem|women/i.test(qNorm);
  const candidates = items.filter((item) => {
    const nameNorm = normalizeText(item.displayName || item.name || '');
    if (!wantsYouthOrWomen && /(u20|u19|u21|u23|women|fem|b team|ii$)/.test(nameNorm)) {
      return false;
    }
    return true;
  });

  const pool = candidates.length > 0 ? candidates : items;

  // Score candidates: exact name match + preferred league match
  const scored = pool.map((item) => {
    const nameNorm = normalizeText(item.displayName || item.name || '');
    let score = 0;
    if (nameNorm === qNorm) score += 100;
    else if (nameNorm.includes(qNorm) || qNorm.includes(nameNorm)) score += 50;
    if (preferredSlug && (item.defaultLeagueSlug === preferredSlug || item.league === preferredSlug)) {
      score += 40;
    }
    if (/^(bra|eng|esp|ita|ger|fra|por|arg|uefa|conmebol)\./.test(item.defaultLeagueSlug || '')) {
      score += 15;
    }
    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]?.item;
  if (!best) return null;

  return {
    id: String(best.id),
    displayName: best.displayName || best.name || query,
    abbreviation: (best.abbreviation || best.displayName || 'TIM').slice(0, 3).toUpperCase(),
    color: sanitizeHex(best.color, '#0F766E'),
    alternateColor: sanitizeHex(best.alternateColor, '#FFFFFF'),
    defaultLeagueSlug: best.defaultLeagueSlug || best.league || preferredSlug || 'bra.1',
  };
}

function getStatValue(stats: any[], name: string): number | null {
  const found = stats?.find((s) => s?.name === name);
  if (!found || found.value === undefined || found.value === null) return null;
  const num = Number(found.value);
  return Number.isFinite(num) ? num : null;
}

function formatDatePtBr(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(d);
}

interface ParsedScheduleEvent {
  id: string;
  dateIso: string;
  timestamp: number;
  completed: boolean;
  isHome: boolean;
  teamScore: number;
  opponentName: string;
  opponentId: string;
  opponentScore: number;
  competitionName: string;
  outcome: MatchOutcome;
}

function parseScheduleEvents(rawJson: any, teamId: string, fallbackComp: string): ParsedScheduleEvent[] {
  const events = rawJson?.events || [];
  const parsed: ParsedScheduleEvent[] = [];

  for (const ev of events) {
    const comp = ev?.competitions?.[0];
    if (!comp) continue;
    const completed = Boolean(comp?.status?.type?.completed);
    const competitors = comp?.competitors || [];
    const self = competitors.find((c: any) => String(c?.team?.id) === String(teamId));
    const opp = competitors.find((c: any) => String(c?.team?.id) !== String(teamId));
    if (!self || !opp) continue;

    const teamScore = Number(self?.score?.value ?? self?.score?.displayValue ?? 0);
    const oppScore = Number(opp?.score?.value ?? opp?.score?.displayValue ?? 0);
    const dateIso = ev.date || comp.date || '';
    const ts = new Date(dateIso).getTime();

    const outcome: MatchOutcome =
      teamScore > oppScore ? 'V' : teamScore === oppScore ? 'E' : 'D';

    parsed.push({
      id: String(ev.id),
      dateIso,
      timestamp: Number.isFinite(ts) ? ts : 0,
      completed,
      isHome: self.homeAway === 'home',
      teamScore: Number.isFinite(teamScore) ? teamScore : 0,
      opponentName: opp?.team?.displayName || opp?.team?.shortDisplayName || 'Adversário',
      opponentId: String(opp?.team?.id || ''),
      opponentScore: Number.isFinite(oppScore) ? oppScore : 0,
      competitionName: ev?.seasonType?.name || rawJson?.team?.standingSummary || fallbackComp,
      outcome,
    });
  }

  return parsed;
}

function buildRecordSummary(events: ParsedScheduleEvent[]): string | null {
  if (events.length === 0) return null;
  const v = events.filter((e) => e.outcome === 'V').length;
  const e = events.filter((e) => e.outcome === 'E').length;
  const d = events.filter((e) => e.outcome === 'D').length;
  return `${v}V-${e}E-${d}D (${events.length} jogos)`;
}

function buildLastFiveStats(
  completedNewestFirst: ParsedScheduleEvent[],
  competitionName: string
): TeamLastFiveStats {
  const last5 = completedNewestFirst.slice(0, 5);
  const matches: RecentMatchItem[] = last5.map((ev) => ({
    date: formatDatePtBr(ev.dateIso),
    opponent: ev.opponentName,
    venue: ev.isHome ? 'Casa' : 'Fora',
    scoreFor: ev.teamScore,
    scoreAgainst: ev.opponentScore,
    outcome: ev.outcome,
    competition: competitionName,
  }));

  const wins = matches.filter((m) => m.outcome === 'V').length;
  const draws = matches.filter((m) => m.outcome === 'E').length;
  const losses = matches.filter((m) => m.outcome === 'D').length;
  const goalsScored = matches.reduce((sum, m) => sum + m.scoreFor, 0);
  const goalsConceded = matches.reduce((sum, m) => sum + m.scoreAgainst, 0);
  const denom = Math.max(1, matches.length);

  const homeGames = completedNewestFirst.filter((e) => e.isHome);
  const awayGames = completedNewestFirst.filter((e) => !e.isHome);

  return {
    matches,
    wins,
    draws,
    losses,
    goalsScored,
    goalsConceded,
    avgGoalsScored: Number((goalsScored / denom).toFixed(2)),
    avgGoalsConceded: Number((goalsConceded / denom).toFixed(2)),
    homeSummary: buildRecordSummary(homeGames),
    awaySummary: buildRecordSummary(awayGames),
  };
}

async function fetchBoxscoreAverages(
  leagueSlug: string,
  teamId: string,
  recentEvents: ParsedScheduleEvent[],
  allSeasonCompleted: ParsedScheduleEvent[]
): Promise<TeamComplementaryStats> {
  const totalSeason = allSeasonCompleted.length;
  let bttsPct: number | null = null;
  let over15Pct: number | null = null;
  let over25Pct: number | null = null;

  if (totalSeason > 0) {
    const bttsCount = allSeasonCompleted.filter(
      (m) => m.teamScore > 0 && m.opponentScore > 0
    ).length;
    const o15Count = allSeasonCompleted.filter(
      (m) => m.teamScore + m.opponentScore >= 2
    ).length;
    const o25Count = allSeasonCompleted.filter(
      (m) => m.teamScore + m.opponentScore >= 3
    ).length;

    bttsPct = Math.round((bttsCount / totalSeason) * 100);
    over15Pct = Math.round((o15Count / totalSeason) * 100);
    over25Pct = Math.round((o25Count / totalSeason) * 100);
  }

  const targetIds = recentEvents.slice(0, 5).map((e) => e.id);
  const summaries = await Promise.all(
    targetIds.map((id) =>
      fetchJson<any>(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/summary?event=${id}`,
        6000
      )
    )
  );

  const corners: number[] = [];
  const cards: number[] = [];
  const shots: number[] = [];
  const shotsOnTarget: number[] = [];
  const possession: number[] = [];

  for (const sum of summaries) {
    const teamsBox = sum?.boxscore?.teams;
    if (!Array.isArray(teamsBox)) continue;
    const myBox = teamsBox.find((t: any) => String(t?.team?.id) === String(teamId));
    if (!myBox || !Array.isArray(myBox.statistics)) continue;

    const getVal = (statName: string): number | null => {
      const s = myBox.statistics.find((x: any) => x?.name === statName);
      if (!s) return null;
      const n = Number(s.displayValue ?? s.value);
      return Number.isFinite(n) ? n : null;
    };

    const c = getVal('wonCorners');
    if (c !== null) corners.push(c);

    const yc = getVal('yellowCards');
    const rc = getVal('redCards');
    if (yc !== null || rc !== null) {
      cards.push((yc ?? 0) + (rc ?? 0));
    }

    const sh = getVal('totalShots');
    if (sh !== null) shots.push(sh);

    const sot = getVal('shotsOnTarget');
    if (sot !== null) shotsOnTarget.push(sot);

    const poss = getVal('possessionPct');
    if (poss !== null) possession.push(poss);
  }

  const avg = (arr: number[]): number | null =>
    arr.length > 0
      ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1))
      : null;

  return {
    avgCorners: avg(corners),
    avgCards: avg(cards),
    avgShots: avg(shots),
    avgShotsOnTarget: avg(shotsOnTarget),
    avgPossessionPct: avg(possession),
    bttsPct,
    over15Pct,
    over25Pct,
  };
}

function buildStandingsFromSchedule(
  completed: ParsedScheduleEvent[]
): TeamStandingsStats {
  if (completed.length === 0) {
    return {
      position: null,
      points: null,
      played: null,
      wins: null,
      draws: null,
      losses: null,
      goalsFor: null,
      goalsAgainst: null,
      goalDifference: null,
      winPercentage: null,
      homeRecord: null,
      awayRecord: null,
    };
  }

  const played = completed.length;
  const wins = completed.filter((m) => m.outcome === 'V').length;
  const draws = completed.filter((m) => m.outcome === 'E').length;
  const losses = completed.filter((m) => m.outcome === 'D').length;
  const points = wins * 3 + draws;
  const goalsFor = completed.reduce((acc, m) => acc + m.teamScore, 0);
  const goalsAgainst = completed.reduce((acc, m) => acc + m.opponentScore, 0);

  return {
    position: null,
    points,
    played,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    winPercentage: Math.round((points / (played * 3)) * 100),
    homeRecord: buildRecordSummary(completed.filter((m) => m.isHome)),
    awayRecord: buildRecordSummary(completed.filter((m) => !m.isHome)),
  };
}

export async function fetchEspnLiveFixtures(
  scope: ChampionshipScope
): Promise<SuggestedFixture[]> {
  const leagues =
    scope === 'brasil'
      ? ['bra.1', 'bra.2', 'conmebol.libertadores']
      : scope === 'principais'
        ? ['bra.1', 'eng.1', 'esp.1', 'ita.1', 'ger.1', 'uefa.champions']
        : ['bra.1', 'eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1', 'uefa.champions', 'conmebol.libertadores'];

  const results = await Promise.all(
    leagues.map(async (slug) => {
      const data = await fetchJson<any>(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`,
        6000
      );
      return { slug, data };
    })
  );

  const fixtures: SuggestedFixture[] = [];
  const now = Date.now();

  for (const { slug, data } of results) {
    const compTitle =
      LEAGUE_LABELS[slug] || data?.leagues?.[0]?.name || slug.toUpperCase();
    const events = data?.events || [];
    for (const ev of events) {
      const comp = ev?.competitions?.[0];
      const competitors = comp?.competitors || [];
      const home = competitors.find((c: any) => c.homeAway === 'home');
      const away = competitors.find((c: any) => c.homeAway === 'away');
      if (!home || !away) continue;

      const evDate = ev.date ? new Date(ev.date) : null;
      let dateLabel = comp?.status?.type?.shortDetail || 'Agendado';
      if (evDate && !Number.isNaN(evDate.getTime())) {
        const diffDays = Math.round((evDate.getTime() - now) / (1000 * 60 * 60 * 24));
        const timeStr = new Intl.DateTimeFormat('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(evDate);
        if (diffDays === 0) dateLabel = `Hoje · ${timeStr}`;
        else if (diffDays === 1) dateLabel = `Amanhã · ${timeStr}`;
        else {
          dateLabel = new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }).format(evDate);
        }
      }

      fixtures.push({
        homeTeam: home.team?.displayName || home.team?.shortDisplayName || 'Mandante',
        awayTeam: away.team?.displayName || away.team?.shortDisplayName || 'Visitante',
        competition: compTitle,
        dateLabel,
      });
    }
  }

  return fixtures.slice(0, 8);
}

export async function analyzeMatchViaEspn(
  homeQuery: string,
  awayQuery: string,
  competitionInput: string
): Promise<AnalysisResponsePayload | null> {
  const requestedSlug = resolveLeagueSlug(competitionInput);

  const [homeInfo, awayInfo] = await Promise.all([
    searchEspnTeam(homeQuery, requestedSlug),
    searchEspnTeam(awayQuery, requestedSlug),
  ]);

  if (!homeInfo || !awayInfo) {
    return null;
  }

  // Decide the primary league to inspect standings and schedules
  const leagueSlug =
    requestedSlug ||
    (homeInfo.defaultLeagueSlug === awayInfo.defaultLeagueSlug
      ? homeInfo.defaultLeagueSlug
      : homeInfo.defaultLeagueSlug || 'bra.1');

  const homeLeagueForSchedule = requestedSlug || homeInfo.defaultLeagueSlug || leagueSlug;
  const awayLeagueForSchedule = requestedSlug || awayInfo.defaultLeagueSlug || leagueSlug;

  const currentYear = new Date().getFullYear();

  const [
    standingsJson,
    homeScheduleCurr,
    awayScheduleCurr,
    homeSchedulePrev,
    homeNews,
    awayNews,
  ] = await Promise.all([
    fetchJson<any>(
      `https://site.api.espn.com/apis/v2/sports/soccer/${leagueSlug}/standings`,
      7000
    ),
    fetchJson<any>(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${homeLeagueForSchedule}/teams/${homeInfo.id}/schedule`,
      7000
    ),
    fetchJson<any>(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${awayLeagueForSchedule}/teams/${awayInfo.id}/schedule`,
      7000
    ),
    fetchJson<any>(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${homeLeagueForSchedule}/teams/${homeInfo.id}/schedule?season=${currentYear - 1}`,
      6000
    ),
    fetchJson<any>(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${homeLeagueForSchedule}/news?team=${homeInfo.id}&limit=3`,
      5000
    ),
    fetchJson<any>(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${awayLeagueForSchedule}/news?team=${awayInfo.id}&limit=3`,
      5000
    ),
  ]);

  const compLabel =
    LEAGUE_LABELS[leagueSlug] ||
    standingsJson?.name ||
    competitionInput ||
    'Campeonato Oficial';
  const seasonLabel = String(
    standingsJson?.children?.[0]?.standings?.seasonDisplayName ||
      standingsJson?.children?.[0]?.name ||
      currentYear
  );

  // Parse schedules
  const homeEventsAll = parseScheduleEvents(homeScheduleCurr, homeInfo.id, compLabel);
  const awayEventsAll = parseScheduleEvents(awayScheduleCurr, awayInfo.id, compLabel);
  const homePrevEvents = parseScheduleEvents(homeSchedulePrev, homeInfo.id, compLabel);

  const homeCompleted = homeEventsAll
    .filter((e) => e.completed)
    .sort((a, b) => b.timestamp - a.timestamp);
  const awayCompleted = awayEventsAll
    .filter((e) => e.completed)
    .sort((a, b) => b.timestamp - a.timestamp);

  // Check if they have an upcoming scheduled clash
  const nextClash = homeEventsAll
    .filter((e) => !e.completed && String(e.opponentId) === String(awayInfo.id))
    .sort((a, b) => a.timestamp - b.timestamp)[0];

  const matchDateInfo = nextClash
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(nextClash.dateIso))
    : null;

  // Standings extraction
  const standingEntries: any[] = [];
  for (const child of standingsJson?.children || []) {
    if (Array.isArray(child?.standings?.entries)) {
      standingEntries.push(...child.standings.entries);
    }
  }

  const extractStanding = (
    teamId: string,
    completedList: ParsedScheduleEvent[]
  ): TeamStandingsStats => {
    const entry = standingEntries.find((e) => String(e?.team?.id) === String(teamId));
    const fallback = buildStandingsFromSchedule(completedList);
    if (!entry || !Array.isArray(entry.stats)) {
      return fallback;
    }
    const played = getStatValue(entry.stats, 'gamesPlayed') ?? fallback.played;
    const wins = getStatValue(entry.stats, 'wins') ?? fallback.wins;
    const draws = getStatValue(entry.stats, 'ties') ?? fallback.draws;
    const losses = getStatValue(entry.stats, 'losses') ?? fallback.losses;
    const points = getStatValue(entry.stats, 'points') ?? fallback.points;
    const goalsFor = getStatValue(entry.stats, 'pointsFor') ?? fallback.goalsFor;
    const goalsAgainst = getStatValue(entry.stats, 'pointsAgainst') ?? fallback.goalsAgainst;
    const goalDifference =
      getStatValue(entry.stats, 'pointDifferential') ??
      (goalsFor !== null && goalsAgainst !== null ? goalsFor - goalsAgainst : null);
    const position = getStatValue(entry.stats, 'rank');
    const winPercentage =
      points !== null && played && played > 0
        ? Math.round((points / (played * 3)) * 100)
        : fallback.winPercentage;

    return {
      position,
      points,
      played,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      goalDifference,
      winPercentage,
      homeRecord: fallback.homeRecord,
      awayRecord: fallback.awayRecord,
    };
  };

  const homeStandings = extractStanding(homeInfo.id, homeCompleted);
  const awayStandings = extractStanding(awayInfo.id, awayCompleted);

  // Head-to-head across current & previous season
  const combinedHomeEvents = [...homeCompleted, ...homePrevEvents.filter((e) => e.completed)];
  const h2hSeen = new Set<string>();
  const h2hEvents = combinedHomeEvents
    .filter((e) => {
      if (String(e.opponentId) !== String(awayInfo.id)) return false;
      if (h2hSeen.has(e.id)) return false;
      h2hSeen.add(e.id);
      return true;
    })
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  const h2hRecentMatches: HeadToHeadMatch[] = h2hEvents.map((e) => ({
    date: formatDatePtBr(e.dateIso),
    homeTeam: e.isHome ? homeInfo.displayName : awayInfo.displayName,
    awayTeam: e.isHome ? awayInfo.displayName : homeInfo.displayName,
    homeGoals: e.isHome ? e.teamScore : e.opponentScore,
    awayGoals: e.isHome ? e.opponentScore : e.teamScore,
    competition: compLabel,
  }));

  const h2hHomeWins = h2hEvents.filter((e) => e.outcome === 'V').length;
  const h2hAwayWins = h2hEvents.filter((e) => e.outcome === 'D').length;
  const h2hDraws = h2hEvents.filter((e) => e.outcome === 'E').length;
  const h2hAvgGoals =
    h2hEvents.length > 0
      ? Number(
          (
            h2hEvents.reduce((acc, e) => acc + e.teamScore + e.opponentScore, 0) /
            h2hEvents.length
          ).toFixed(2)
        )
      : null;

  // Complementary stats (corners, cards, shots, possession, BTTS, over 1.5/2.5)
  const [homeCompStats, awayCompStats] = await Promise.all([
    fetchBoxscoreAverages(homeLeagueForSchedule, homeInfo.id, homeCompleted, homeCompleted),
    fetchBoxscoreAverages(awayLeagueForSchedule, awayInfo.id, awayCompleted, awayCompleted),
  ]);

  // Rest days calculation
  const calcRestDays = (completedList: ParsedScheduleEvent[]): number | null => {
    const latest = completedList[0];
    if (!latest || !latest.timestamp) return null;
    const refTs = nextClash?.timestamp || Date.now();
    const diff = Math.round((refTs - latest.timestamp) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 60 ? diff : null;
  };

  const homeRest = calcRestDays(homeCompleted);
  const awayRest = calcRestDays(awayCompleted);

  // Subtle objective contextual impact from rest days & table gap
  let contextualImpactHome = 0;
  let contextualImpactAway = 0;
  if (homeRest !== null && awayRest !== null) {
    if (homeRest - awayRest >= 3) contextualImpactHome += 0.08;
    else if (awayRest - homeRest >= 3) contextualImpactAway += 0.08;
  }

  const homeHeadline = homeNews?.articles?.[0]?.headline || null;
  const awayHeadline = awayNews?.articles?.[0]?.headline || null;

  const dataWarnings: string[] = [];
  if (h2hEvents.length === 0) {
    dataWarnings.push(
      'Nenhum confronto direto recente encontrado nas últimas duas temporadas desta competição.'
    );
  }
  if (homeCompStats.avgCorners === null || awayCompStats.avgCorners === null) {
    dataWarnings.push(
      'Estatísticas detalhadas de escanteios/cartões não estavam disponíveis em todas as partidas recentes.'
    );
  }

  const homeIdentity: TeamIdentity = {
    name: homeInfo.displayName,
    shortCode: homeInfo.abbreviation,
    primaryColor: homeInfo.color,
    secondaryColor: homeInfo.alternateColor,
  };
  const awayIdentity: TeamIdentity = {
    name: awayInfo.displayName,
    shortCode: awayInfo.abbreviation,
    primaryColor: awayInfo.color,
    secondaryColor: awayInfo.alternateColor,
  };

  const analysisData: MatchAnalysisData = {
    competition: compLabel,
    season: seasonLabel,
    matchDateInfo,
    homeTeam: homeIdentity,
    awayTeam: awayIdentity,
    module1LastFive: {
      home: buildLastFiveStats(homeCompleted, compLabel),
      away: buildLastFiveStats(awayCompleted, compLabel),
    },
    module2HeadToHead: {
      totalMatchesAnalyzed: h2hEvents.length,
      homeTeamWins: h2hHomeWins,
      awayTeamWins: h2hAwayWins,
      draws: h2hDraws,
      avgGoalsPerMatch: h2hAvgGoals,
      recentMatches: h2hRecentMatches,
    },
    module3Standings: {
      home: homeStandings,
      away: awayStandings,
    },
    module4Complementary: {
      home: homeCompStats,
      away: awayCompStats,
    },
    module5Context: {
      homeAdvantageNote: `Mando de campo para ${homeInfo.displayName}${
        homeStandings.homeRecord ? ` (${homeStandings.homeRecord} em casa)` : ''
      }.`,
      matchImportance:
        homeStandings.position && awayStandings.position
          ? `${homeInfo.displayName} (${homeStandings.position}º) × ${awayInfo.displayName} (${awayStandings.position}º) em ${compLabel}.`
          : `Confronto oficial por ${compLabel}.`,
      homeTeamContext: {
        absencesAndSuspensions: [],
        restDays: homeRest,
        recentCoachChange: null,
        formNote: homeHeadline ? `Notícia recente: ${homeHeadline}` : null,
      },
      awayTeamContext: {
        absencesAndSuspensions: [],
        restDays: awayRest,
        recentCoachChange: null,
        formNote: awayHeadline ? `Notícia recente: ${awayHeadline}` : null,
      },
      contextualImpactHome: Number(contextualImpactHome.toFixed(2)),
      contextualImpactAway: Number(contextualImpactAway.toFixed(2)),
    },
    dataWarnings,
  };

  const sources: GroundingSource[] = [
    {
      title: `ESPN · Classificação ${compLabel}`,
      uri: `https://www.espn.com/soccer/standings/_/league/${leagueSlug}`,
    },
    {
      title: `ESPN · Resultados ${homeInfo.displayName}`,
      uri: `https://www.espn.com/soccer/team/results/_/id/${homeInfo.id}`,
    },
    {
      title: `ESPN · Resultados ${awayInfo.displayName}`,
      uri: `https://www.espn.com/soccer/team/results/_/id/${awayInfo.id}`,
    },
  ];

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    updatedAt: new Date().toISOString(),
    data: analysisData,
    sources,
  };
}
