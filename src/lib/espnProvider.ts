import type {
  AnalysisResponsePayload,
  ChampionshipScope,
  GroundingSource,
  HeadToHeadMatch,
  MatchAnalysisData,
  MatchOutcome,
  RecentMatchItem,
  SerieAMultipleLeg,
  SerieAMultipleTip,
  SuggestedFixture,
  TeamComplementaryStats,
  TeamIdentity,
  TeamLastFiveStats,
  TeamStandingsStats,
} from '../types/football.js';
import { calculatePoissonModel } from './poisson.js';

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
  { match: /copa\s*do\s*brasil/i, slug: 'bra.copa_do_brazil', label: 'Copa do Brasil' },
  { match: /copa\s*do\s*nordeste|nordest[aã]o/i, slug: 'bra.copa_do_nordeste', label: 'Copa do Nordeste' },
  { match: /paulista|paulist[aã]o/i, slug: 'bra.camp.paulista', label: 'Campeonato Paulista' },
  { match: /carioca|carioc[aã]o/i, slug: 'bra.camp.carioca', label: 'Campeonato Carioca' },
  { match: /mineiro/i, slug: 'bra.camp.mineiro', label: 'Campeonato Mineiro' },
  { match: /ga[uú]cho|gauch[aã]o/i, slug: 'bra.camp.gaucho', label: 'Campeonato Gaúcho' },
  { match: /brasileir[aã]o.*c|s[eé]rie c/i, slug: 'bra.3', label: 'Brasileirão Série C' },
  { match: /brasileir[aã]o.*b|s[eé]rie b/i, slug: 'bra.2', label: 'Brasileirão Série B' },
  { match: /brasileir[aã]o|s[eé]rie a|brasil/i, slug: 'bra.1', label: 'Brasileirão Série A' },
  { match: /libertadores/i, slug: 'conmebol.libertadores', label: 'Copa Libertadores' },
  { match: /sul-?americana|sudamericana/i, slug: 'conmebol.sudamericana', label: 'Copa Sul-Americana' },
  { match: /premier\s*league|ingl[eê]s/i, slug: 'eng.1', label: 'Premier League' },
  { match: /la\s*liga|espanhol/i, slug: 'esp.1', label: 'La Liga' },
  { match: /champions/i, slug: 'uefa.champions', label: 'UEFA Champions League' },
  { match: /europa\s*league/i, slug: 'uefa.europa', label: 'UEFA Europa League' },
  { match: /nations\s*league/i, slug: 'uefa.nations', label: 'UEFA Nations League' },
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
  'bra.3': 'Brasileirão Série C',
  'bra.copa_do_brazil': 'Copa do Brasil',
  'bra.copa_do_nordeste': 'Copa do Nordeste',
  'bra.camp.paulista': 'Campeonato Paulista',
  'bra.camp.carioca': 'Campeonato Carioca',
  'bra.camp.mineiro': 'Campeonato Mineiro',
  'bra.camp.gaucho': 'Campeonato Gaúcho',
  'conmebol.libertadores': 'Copa Libertadores',
  'conmebol.sudamericana': 'Copa Sul-Americana',
  'eng.1': 'Premier League',
  'esp.1': 'La Liga',
  'esp.2': 'La Liga 2',
  'uefa.champions': 'UEFA Champions League',
  'uefa.europa': 'UEFA Europa League',
  'uefa.nations': 'UEFA Nations League',
  'ita.1': 'Serie A Itália',
  'ger.1': 'Bundesliga',
  'fra.1': 'Ligue 1',
  'por.1': 'Liga Portugal',
  'arg.1': 'Liga Profesional Argentina',
  'usa.1': 'MLS',
  'fifa.friendly': 'Amistosos Internacionais',
  'fifa.worldq.conmebol': 'Eliminatórias Sul-Americanas',
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

async function fetchJson<T>(url: string, timeoutMs = 9000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
    });
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

async function searchTeamInLeagueDirectory(
  query: string,
  leagueSlug: string
): Promise<EspnSearchTeam | null> {
  const data = await fetchJson<any>(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/teams?limit=100`,
    7000
  );
  const rawTeams: any[] = data?.sports?.[0]?.leagues?.[0]?.teams || [];
  if (rawTeams.length === 0) return null;

  const qNorm = normalizeText(query).replace(/[-_]+/g, ' ');
  const qTokens = qNorm.split(/\s+/).filter((t) => t.length >= 2);

  let bestTeam: any = null;
  let bestScore = 0;

  for (const wrapper of rawTeams) {
    const t = wrapper?.team;
    if (!t?.id) continue;
    const candidates = [t.displayName, t.shortDisplayName, t.name, t.location, t.abbreviation]
      .filter(Boolean)
      .map((s: string) => normalizeText(s).replace(/[-_]+/g, ' '));

    let score = 0;
    for (const c of candidates) {
      if (c === qNorm) score = Math.max(score, 100);
      else if (c.includes(qNorm) || qNorm.includes(c)) score = Math.max(score, 65);
      else if (qTokens.length > 0 && qTokens.every((tok) => c.includes(tok))) {
        score = Math.max(score, 55);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestTeam = t;
    }
  }

  if (!bestTeam || bestScore < 50) return null;

  return {
    id: String(bestTeam.id),
    displayName: bestTeam.displayName || bestTeam.name || query,
    abbreviation: (bestTeam.abbreviation || bestTeam.displayName || 'TIM')
      .slice(0, 3)
      .toUpperCase(),
    color: sanitizeHex(bestTeam.color, '#0F766E'),
    alternateColor: sanitizeHex(bestTeam.alternateColor, '#FFFFFF'),
    defaultLeagueSlug: leagueSlug,
  };
}

async function searchEspnTeam(
  query: string,
  preferredSlug: string | null
): Promise<EspnSearchTeam | null> {
  const queryVariants = Array.from(
    new Set([query.trim(), normalizeText(query).replace(/[-_]+/g, ' ')].filter(Boolean))
  );

  let items: any[] = [];
  for (const q of queryVariants) {
    const url = `https://site.web.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(
      q
    )}&limit=10&type=team`;
    const data = await fetchJson<{ items?: any[] }>(url, 7000);
    items = (data?.items || []).filter((item) => item?.sport === 'soccer');
    if (items.length > 0) break;
  }

  if (items.length === 0) {
    const fallbackSlugs = Array.from(
      new Set(
        [
          preferredSlug,
          'bra.1',
          'eng.1',
          'esp.1',
          'ita.1',
          'ger.1',
          'fra.1',
          'uefa.champions',
          'conmebol.libertadores',
        ].filter((s): s is string => Boolean(s))
      )
    ).slice(0, 4);

    for (const slug of fallbackSlugs) {
      const found = await searchTeamInLeagueDirectory(query, slug);
      if (found) return found;
    }
    return null;
  }

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
      ? [
          'bra.1',
          'bra.2',
          'bra.copa_do_brazil',
          'bra.copa_do_nordeste',
          'bra.camp.paulista',
          'bra.camp.carioca',
          'bra.camp.mineiro',
          'bra.camp.gaucho',
          'conmebol.libertadores',
        ]
      : scope === 'principais'
        ? ['bra.1', 'eng.1', 'esp.1', 'ita.1', 'ger.1', 'uefa.champions', 'uefa.nations']
        : [
            'bra.1',
            'bra.copa_do_brazil',
            'eng.1',
            'esp.1',
            'ita.1',
            'ger.1',
            'fra.1',
            'uefa.champions',
            'uefa.nations',
            'conmebol.libertadores',
          ];

  const initialResults = await Promise.all(
    leagues.map(async (slug) => {
      const data = await fetchJson<any>(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`,
        6000
      );
      return { slug, data };
    })
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const futureDateFetches: Promise<{ slug: string; data: any }>[] = [];

  for (const { slug, data } of initialResults) {
    const activeCount = (data?.events || []).filter((ev: any) => {
      const st = ev?.competitions?.[0]?.status?.type;
      return !st?.completed && st?.state !== 'post';
    }).length;

    if (activeCount < 3) {
      const calendar: string[] = data?.leagues?.[0]?.calendar || [];
      const nextDates = calendar
        .filter((d) => typeof d === 'string' && d.slice(0, 10) >= todayIso)
        .slice(0, 2);

      for (const dateStr of nextDates) {
        const ymd = dateStr.slice(0, 10).replace(/-/g, '');
        futureDateFetches.push(
          fetchJson<any>(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${ymd}`,
            6000
          ).then((futureData) => ({ slug, data: futureData }))
        );
      }
    }
  }

  const extraResults = futureDateFetches.length > 0 ? await Promise.all(futureDateFetches) : [];
  const allBatches = [...initialResults, ...extraResults];

  const seenEventIds = new Set<string>();
  const collected: (SuggestedFixture & { isLive: boolean; timestamp: number })[] = [];
  const now = Date.now();

  for (const { slug, data } of allBatches) {
    if (!data) continue;
    const compTitle =
      LEAGUE_LABELS[slug] || data?.leagues?.[0]?.name || slug.toUpperCase();
    const events = data?.events || [];

    for (const ev of events) {
      const eventId = String(ev?.id || '');
      if (!eventId || seenEventIds.has(eventId)) continue;

      const comp = ev?.competitions?.[0];
      const statusType = comp?.status?.type;
      const state = statusType?.state; // 'pre' | 'in' | 'post'
      const completed = Boolean(statusType?.completed);

      // Strictly keep ONLY current (in progress) or future (pre) matches
      if (completed || state === 'post') continue;

      const evDate = ev.date ? new Date(ev.date) : null;
      const timestamp = evDate && !Number.isNaN(evDate.getTime()) ? evDate.getTime() : now;
      const isLive = state === 'in';

      // Exclude stale unstarted games more than 3 hours in the past
      if (!isLive && timestamp < now - 3 * 60 * 60 * 1000) continue;

      const competitors = comp?.competitors || [];
      const home = competitors.find((c: any) => c.homeAway === 'home');
      const away = competitors.find((c: any) => c.homeAway === 'away');
      if (!home || !away) continue;

      const homeTitle = home.team?.displayName || home.team?.shortDisplayName || '';
      const awayTitle = away.team?.displayName || away.team?.shortDisplayName || '';
      if (
        !homeTitle ||
        !awayTitle ||
        /\btbd\b/i.test(homeTitle) ||
        /\btbd\b/i.test(awayTitle)
      ) {
        continue;
      }

      seenEventIds.add(eventId);

      let dateLabel = statusType?.shortDetail || 'Agendado';
      if (isLive) {
        const detail = statusType?.shortDetail || 'Em andamento';
        dateLabel = `Ao vivo · ${detail}`;
      } else if (evDate && !Number.isNaN(evDate.getTime())) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfEvDay = new Date(evDate);
        startOfEvDay.setHours(0, 0, 0, 0);
        const diffDays = Math.round(
          (startOfEvDay.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)
        );
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

      collected.push({
        homeTeam: home.team?.displayName || home.team?.shortDisplayName || 'Mandante',
        awayTeam: away.team?.displayName || away.team?.shortDisplayName || 'Visitante',
        competition: compTitle,
        dateLabel,
        isLive,
        timestamp,
      });
    }
  }

  collected.sort((a, b) => {
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    return a.timestamp - b.timestamp;
  });

  return collected.slice(0, 10).map(({ homeTeam, awayTeam, competition, dateLabel }) => ({
    homeTeam,
    awayTeam,
    competition,
    dateLabel,
  }));
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

function formatUpcomingKickoffLabel(evDate: Date | null, fallbackDetail?: string): string {
  if (!evDate || Number.isNaN(evDate.getTime())) {
    return fallbackDetail || 'Agendado';
  }
  const timeZone = 'America/Sao_Paulo';
  const dayKeyFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayKey = dayKeyFmt.format(new Date());
  const evKey = dayKeyFmt.format(evDate);
  const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowKey = dayKeyFmt.format(tomorrowDate);

  const timeStr = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(evDate);

  if (evKey === todayKey) return `Hoje · ${timeStr}`;
  if (evKey === tomorrowKey) return `Amanhã · ${timeStr}`;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(evDate);
}

const WORLD_MIX_LEAGUES = [
  'bra.1',
  'eng.1',
  'esp.1',
  'ita.1',
  'ger.1',
  'fra.1',
  'uefa.champions',
  'conmebol.libertadores',
];

const TODAY_ALL_LEAGUES = [
  'bra.1',
  'bra.2',
  'bra.copa_do_brazil',
  'bra.copa_do_nordeste',
  'bra.camp.paulista',
  'bra.camp.carioca',
  'bra.camp.mineiro',
  'bra.camp.gaucho',
  'eng.1',
  'esp.1',
  'esp.2',
  'ita.1',
  'ger.1',
  'fra.1',
  'por.1',
  'arg.1',
  'usa.1',
  'uefa.champions',
  'uefa.europa',
  'uefa.nations',
  'conmebol.libertadores',
  'conmebol.sudamericana',
  'fifa.worldq.conmebol',
  'fifa.friendly',
];

const BRT_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function extractCalendarDates(scoreboardJson: any, todayIso: string, maxDates = 3): string[] {
  const calendar: any[] = scoreboardJson?.leagues?.[0]?.calendar || [];
  const rawDates: string[] = [];

  for (const entry of calendar) {
    if (typeof entry === 'string') {
      rawDates.push(entry);
    } else if (Array.isArray(entry?.entries)) {
      for (const sub of entry.entries) {
        if (typeof sub === 'string') rawDates.push(sub);
        else if (typeof sub?.startDate === 'string') rawDates.push(sub.startDate);
      }
    } else if (typeof entry?.startDate === 'string') {
      rawDates.push(entry.startDate);
    }
  }

  return Array.from(new Set(rawDates))
    .filter((d) => d.slice(0, 10) >= todayIso)
    .sort()
    .slice(0, maxDates);
}

export async function buildMultipleTipViaEspn(
  leagueKey = 'bra.1',
  desiredCount = 3,
  onlyToday = false
): Promise<SerieAMultipleTip | null> {
  const targetCount = desiredCount === 4 || desiredCount === 5 ? desiredCount : 3;
  const isTodayMode = leagueKey === 'today';
  const effectiveTodayOnly = isTodayMode || onlyToday;
  const isWorldMix = leagueKey === 'world' || isTodayMode;

  const targetLeagues = isTodayMode
    ? TODAY_ALL_LEAGUES
    : leagueKey === 'world'
      ? WORLD_MIX_LEAGUES
      : [leagueKey];

  const baseCompLabel = isTodayMode
    ? 'Jogos de Hoje (Mundial)'
    : leagueKey === 'world'
      ? 'Principais do Mundo (Misto)'
      : LEAGUE_LABELS[leagueKey] || leagueKey.toUpperCase();
  const compLabel =
    onlyToday && !isTodayMode ? `${baseCompLabel} · Hoje` : baseCompLabel;

  const nowDate = new Date();
  const todayBrtIso = BRT_DAY_FORMATTER.format(nowDate);
  const tomorrowBrtIso = BRT_DAY_FORMATTER.format(
    new Date(nowDate.getTime() + 24 * 60 * 60 * 1000)
  );
  const todayBrtYmd = todayBrtIso.replace(/-/g, '');
  const tomorrowBrtYmd = tomorrowBrtIso.replace(/-/g, '');
  const todayIso = nowDate.toISOString().slice(0, 10);
  const now = Date.now();

  const initialScoreboards = await Promise.all(
    targetLeagues.map(async (slug) => {
      const url = effectiveTodayOnly
        ? `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${todayBrtYmd}`
        : `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`;
      const json = await fetchJson<any>(url, 7000);
      return { slug, json };
    })
  );

  interface CandidateMatch {
    eventId: string;
    leagueSlug: string;
    compLabel: string;
    timestamp: number;
    dateLabel: string;
    homeId: string;
    homeName: string;
    homeAbbr: string;
    homeColor: string;
    awayId: string;
    awayName: string;
    awayAbbr: string;
    awayColor: string;
  }

  const extractUpcomingFromBatch = (batch: any, slug: string): CandidateMatch[] => {
    const out: CandidateMatch[] = [];
    const leagueTitle =
      LEAGUE_LABELS[slug] || batch?.leagues?.[0]?.name || slug.toUpperCase();

    for (const ev of batch?.events || []) {
      const eventId = String(ev?.id || '');
      const comp = ev?.competitions?.[0];
      const statusType = comp?.status?.type;
      const state = statusType?.state;
      const completed = Boolean(statusType?.completed);

      // Strictly upcoming matches for the multiple slip
      if (!eventId || completed || state !== 'pre') continue;

      const evDate = ev?.date ? new Date(ev.date) : null;
      const timestamp = evDate && !Number.isNaN(evDate.getTime()) ? evDate.getTime() : 0;
      if (!timestamp || timestamp < now - 20 * 60 * 1000) continue;

      if (effectiveTodayOnly && evDate) {
        const evBrtDay = BRT_DAY_FORMATTER.format(evDate);
        if (evBrtDay !== todayBrtIso) continue;
      }

      const competitors = comp?.competitors || [];
      const home = competitors.find((c: any) => c.homeAway === 'home');
      const away = competitors.find((c: any) => c.homeAway === 'away');
      if (!home?.team?.id || !away?.team?.id) continue;

      const homeName = home.team.displayName || home.team.shortDisplayName || '';
      const awayName = away.team.displayName || away.team.shortDisplayName || '';
      if (
        !homeName ||
        !awayName ||
        /\btbd\b/i.test(homeName) ||
        /\btbd\b/i.test(awayName)
      ) {
        continue;
      }

      out.push({
        eventId,
        leagueSlug: slug,
        compLabel: leagueTitle,
        timestamp,
        dateLabel: formatUpcomingKickoffLabel(evDate, statusType?.shortDetail),
        homeId: String(home.team.id),
        homeName,
        homeAbbr: (home.team.abbreviation || homeName || 'MAN')
          .slice(0, 3)
          .toUpperCase(),
        homeColor: sanitizeHex(home.team.color, '#0F766E'),
        awayId: String(away.team.id),
        awayName,
        awayAbbr: (away.team.abbreviation || awayName || 'VIS')
          .slice(0, 3)
          .toUpperCase(),
        awayColor: sanitizeHex(away.team.color, '#1D4ED8'),
      });
    }
    return out;
  };

  const upcomingMap = new Map<string, CandidateMatch>();
  const extraDateFetches: Promise<{ slug: string; json: any }>[] = [];

  for (const { slug, json } of initialScoreboards) {
    if (!json) continue;
    const found = extractUpcomingFromBatch(json, slug);
    for (const item of found) {
      upcomingMap.set(`${slug}:${item.eventId}`, item);
    }

    if (effectiveTodayOnly) {
      // Late evening BRT matches (after 21:00 BRT) fall on tomorrow UTC date in ESPN
      if (!isTodayMode || slug.startsWith('bra.') || slug.startsWith('conmebol.') || slug === 'arg.1' || slug === 'usa.1') {
        extraDateFetches.push(
          fetchJson<any>(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${tomorrowBrtYmd}`,
            5500
          ).then((batch) => ({ slug, json: batch }))
        );
      }
    } else {
      const minDesired = isWorldMix ? 2 : Math.max(5, targetCount + 2);
      if (found.length < minDesired) {
        const nextDates = extractCalendarDates(json, todayIso, isWorldMix ? 2 : 3);
        for (const dateStr of nextDates) {
          const ymd = dateStr.slice(0, 10).replace(/-/g, '');
          extraDateFetches.push(
            fetchJson<any>(
              `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${ymd}`,
              6000
            ).then((batch) => ({ slug, json: batch }))
          );
        }
      }
    }
  }

  if (extraDateFetches.length > 0) {
    const extraBatches = await Promise.all(extraDateFetches);
    for (const { slug, json } of extraBatches) {
      if (!json) continue;
      for (const item of extractUpcomingFromBatch(json, slug)) {
        const key = `${slug}:${item.eventId}`;
        if (!upcomingMap.has(key)) {
          upcomingMap.set(key, item);
        }
      }
    }
  }

  const allUpcoming = Array.from(upcomingMap.values()).sort(
    (a, b) => a.timestamp - b.timestamp
  );

  let candidateMatches: CandidateMatch[];
  if (isWorldMix) {
    // Pick up to 2 soonest matches per league first for global diversity
    const perLeagueCount = new Map<string, number>();
    const diverse: CandidateMatch[] = [];
    const overflow: CandidateMatch[] = [];
    for (const m of allUpcoming) {
      const count = perLeagueCount.get(m.leagueSlug) ?? 0;
      if (count < 2) {
        perLeagueCount.set(m.leagueSlug, count + 1);
        diverse.push(m);
      } else {
        overflow.push(m);
      }
    }
    candidateMatches = [...diverse, ...overflow].slice(0, Math.max(8, targetCount + 4));
  } else {
    candidateMatches = allUpcoming.slice(0, Math.max(7, targetCount + 3));
  }

  if (candidateMatches.length === 0) {
    return null;
  }

  const involvedLeagues = Array.from(
    new Set(candidateMatches.map((m) => m.leagueSlug))
  );
  const teamLeaguePairs = Array.from(
    new Map(
      candidateMatches.flatMap((m) => [
        [`${m.leagueSlug}:${m.homeId}`, { slug: m.leagueSlug, teamId: m.homeId }],
        [`${m.leagueSlug}:${m.awayId}`, { slug: m.leagueSlug, teamId: m.awayId }],
      ])
    ).entries()
  );

  const [standingsResults, scheduleResults] = await Promise.all([
    Promise.all(
      involvedLeagues.map(async (slug) => {
        const json = await fetchJson<any>(
          `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`,
          7000
        );
        return [slug, json] as const;
      })
    ),
    Promise.all(
      teamLeaguePairs.map(async ([key, pair]) => {
        const json = await fetchJson<any>(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${pair.slug}/teams/${pair.teamId}/schedule`,
          6500
        );
        return [key, json] as const;
      })
    ),
  ]);

  const standingsJsonMap = new Map<string, any>(standingsResults);
  const scheduleMap = new Map<string, any>(scheduleResults);

  const standingsEntriesByLeague = new Map<string, any[]>();
  for (const [slug, sJson] of standingsJsonMap.entries()) {
    const entries: any[] = [];
    for (const child of sJson?.children || []) {
      if (Array.isArray(child?.standings?.entries)) {
        entries.push(...child.standings.entries);
      }
    }
    standingsEntriesByLeague.set(slug, entries);
  }

  const buildStanding = (
    slug: string,
    teamId: string,
    completedList: ParsedScheduleEvent[]
  ): TeamStandingsStats => {
    const entries = standingsEntriesByLeague.get(slug) || [];
    const entry = entries.find((e) => String(e?.team?.id) === String(teamId));
    const fallback = buildStandingsFromSchedule(completedList);
    if (!entry || !Array.isArray(entry.stats)) return fallback;

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

  interface ScoredCandidateLeg {
    timestamp: number;
    score: number;
    leagueSlug: string;
    marketType: '1X2' | 'DC' | 'O15' | 'O25' | 'BTTS';
    leg: SerieAMultipleLeg;
  }

  const scoredCandidates: ScoredCandidateLeg[] = [];
  const defaultYear = String(new Date().getFullYear());

  for (const match of candidateMatches) {
    const homeRaw = scheduleMap.get(`${match.leagueSlug}:${match.homeId}`);
    const awayRaw = scheduleMap.get(`${match.leagueSlug}:${match.awayId}`);

    const homeEvents = parseScheduleEvents(homeRaw, match.homeId, match.compLabel)
      .filter((e) => e.completed)
      .sort((a, b) => b.timestamp - a.timestamp);
    const awayEvents = parseScheduleEvents(awayRaw, match.awayId, match.compLabel)
      .filter((e) => e.completed)
      .sort((a, b) => b.timestamp - a.timestamp);

    const homeStandings = buildStanding(match.leagueSlug, match.homeId, homeEvents);
    const awayStandings = buildStanding(match.leagueSlug, match.awayId, awayEvents);

    const h2hEvents = homeEvents
      .filter((e) => String(e.opponentId) === match.awayId)
      .slice(0, 5);
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

    const latestHomeTs = homeEvents[0]?.timestamp;
    const latestAwayTs = awayEvents[0]?.timestamp;
    const homeRest = latestHomeTs
      ? Math.max(0, Math.round((match.timestamp - latestHomeTs) / (1000 * 60 * 60 * 24)))
      : null;
    const awayRest = latestAwayTs
      ? Math.max(0, Math.round((match.timestamp - latestAwayTs) / (1000 * 60 * 60 * 24)))
      : null;

    let contextualImpactHome = 0;
    let contextualImpactAway = 0;
    if (homeRest !== null && awayRest !== null) {
      if (homeRest - awayRest >= 3) contextualImpactHome = 0.08;
      else if (awayRest - homeRest >= 3) contextualImpactAway = 0.08;
    }

    const sJson = standingsJsonMap.get(match.leagueSlug);
    const seasonLabel = String(
      sJson?.children?.[0]?.standings?.seasonDisplayName || defaultYear
    );

    const analysisData: MatchAnalysisData = {
      competition: match.compLabel,
      season: seasonLabel,
      matchDateInfo: match.dateLabel,
      homeTeam: {
        name: match.homeName,
        shortCode: match.homeAbbr,
        primaryColor: match.homeColor,
        secondaryColor: '#FFFFFF',
      },
      awayTeam: {
        name: match.awayName,
        shortCode: match.awayAbbr,
        primaryColor: match.awayColor,
        secondaryColor: '#FFFFFF',
      },
      module1LastFive: {
        home: buildLastFiveStats(homeEvents, match.compLabel),
        away: buildLastFiveStats(awayEvents, match.compLabel),
      },
      module2HeadToHead: {
        totalMatchesAnalyzed: h2hEvents.length,
        homeTeamWins: h2hHomeWins,
        awayTeamWins: h2hAwayWins,
        draws: h2hDraws,
        avgGoalsPerMatch: h2hAvgGoals,
        recentMatches: [],
      },
      module3Standings: {
        home: homeStandings,
        away: awayStandings,
      },
      module4Complementary: {
        home: {
          avgCorners: null,
          avgCards: null,
          avgShots: null,
          avgShotsOnTarget: null,
          avgPossessionPct: null,
          bttsPct: null,
          over15Pct: null,
          over25Pct: null,
        },
        away: {
          avgCorners: null,
          avgCards: null,
          avgShots: null,
          avgShotsOnTarget: null,
          avgPossessionPct: null,
          bttsPct: null,
          over15Pct: null,
          over25Pct: null,
        },
      },
      module5Context: {
        homeAdvantageNote: null,
        matchImportance: null,
        homeTeamContext: {
          absencesAndSuspensions: [],
          restDays: homeRest,
          recentCoachChange: null,
          formNote: null,
        },
        awayTeamContext: {
          absencesAndSuspensions: [],
          restDays: awayRest,
          recentCoachChange: null,
          formNote: null,
        },
        contextualImpactHome,
        contextualImpactAway,
      },
      dataWarnings: [],
    };

    const poisson = calculatePoissonModel(analysisData);
    const homeLast5 = analysisData.module1LastFive.home;
    const awayLast5 = analysisData.module1LastFive.away;
    const homePosStr = homeStandings.position ? `${homeStandings.position}º` : 'Mandante';
    const awayPosStr = awayStandings.position ? `${awayStandings.position}º` : 'Visitante';

    interface MarketOption {
      marketType: ScoredCandidateLeg['marketType'];
      marketLabel: string;
      probabilityPct: number;
      score: number;
      rationale: string;
    }

    const options: MarketOption[] = [];

    if (poisson.homeWinPct >= 52) {
      options.push({
        marketType: '1X2',
        marketLabel: `Vitória ${match.homeName}`,
        probabilityPct: poisson.homeWinPct,
        score: poisson.homeWinPct + 18,
        rationale: `${match.homeName} (${homePosStr}) soma ${homeLast5.wins}V nos últimos 5 jogos e xG de ${poisson.expectedGoalsHome.toFixed(2)} em casa contra ${match.awayName} (${awayPosStr}).`,
      });
    }

    if (poisson.awayWinPct >= 52) {
      options.push({
        marketType: '1X2',
        marketLabel: `Vitória ${match.awayName}`,
        probabilityPct: poisson.awayWinPct,
        score: poisson.awayWinPct + 18,
        rationale: `${match.awayName} (${awayPosStr}) projeta xG de ${poisson.expectedGoalsAway.toFixed(2)} com ${awayLast5.wins}V nas últimas 5 partidas diante de ${match.homeName} (${homePosStr}).`,
      });
    }

    const homeDoubleChance = Math.min(96, poisson.homeWinPct + poisson.drawPct);
    if (homeDoubleChance >= 72) {
      options.push({
        marketType: 'DC',
        marketLabel: `Dupla chance: ${match.homeName} ou Empate`,
        probabilityPct: homeDoubleChance,
        score: homeDoubleChance - 5,
        rationale: `${match.homeName} (${homePosStr}) mantém ${homeDoubleChance}% de probabilidade combinada de pontuar como mandante (xG ${poisson.expectedGoalsHome.toFixed(2)} × ${poisson.expectedGoalsAway.toFixed(2)}).`,
      });
    }

    const awayDoubleChance = Math.min(96, poisson.awayWinPct + poisson.drawPct);
    if (awayDoubleChance >= 72) {
      options.push({
        marketType: 'DC',
        marketLabel: `Dupla chance: ${match.awayName} ou Empate`,
        probabilityPct: awayDoubleChance,
        score: awayDoubleChance - 5,
        rationale: `${match.awayName} (${awayPosStr}) acumula ${awayLast5.wins}V-${awayLast5.draws}E nos últimos 5 jogos e ${awayDoubleChance}% de chance de sair invicto.`,
      });
    }

    if (poisson.over25Pct >= 58) {
      options.push({
        marketType: 'O25',
        marketLabel: 'Mais de 2,5 gols',
        probabilityPct: poisson.over25Pct,
        score: poisson.over25Pct + 10,
        rationale: `Expectativa ofensiva combinada de ${(
          poisson.expectedGoalsHome + poisson.expectedGoalsAway
        ).toFixed(2)} gols (médias recentes de ${homeLast5.avgGoalsScored} e ${awayLast5.avgGoalsScored} gols marcados).`,
      });
    }

    if (poisson.bttsPct >= 58) {
      options.push({
        marketType: 'BTTS',
        marketLabel: 'Ambas marcam: Sim',
        probabilityPct: poisson.bttsPct,
        score: poisson.bttsPct + 9,
        rationale: `Ataques regulares: ${match.homeName} marca ${homeLast5.avgGoalsScored}/jogo e ${match.awayName} marca ${awayLast5.avgGoalsScored}/jogo nas últimas 5 rodadas.`,
      });
    }

    if (poisson.over15Pct >= 70) {
      options.push({
        marketType: 'O15',
        marketLabel: 'Mais de 1,5 gols',
        probabilityPct: poisson.over15Pct,
        score: poisson.over15Pct - 6,
        rationale: `Tendência sólida de gols com soma de xG em ${(
          poisson.expectedGoalsHome + poisson.expectedGoalsAway
        ).toFixed(2)} e ${poisson.over15Pct}% na matriz de Poisson.`,
      });
    }

    if (options.length === 0) {
      if (homeDoubleChance >= awayDoubleChance && homeDoubleChance >= poisson.over15Pct) {
        options.push({
          marketType: 'DC',
          marketLabel: `Dupla chance: ${match.homeName} ou Empate`,
          probabilityPct: homeDoubleChance,
          score: homeDoubleChance - 8,
          rationale: `Confronto equilibrado entre ${homePosStr} e ${awayPosStr}, com proteção do mando para ${match.homeName}.`,
        });
      } else {
        options.push({
          marketType: 'O15',
          marketLabel: 'Mais de 1,5 gols',
          probabilityPct: poisson.over15Pct,
          score: poisson.over15Pct - 8,
          rationale: `Soma projetada de ${(
            poisson.expectedGoalsHome + poisson.expectedGoalsAway
          ).toFixed(2)} xG entre ${match.homeName} e ${match.awayName}.`,
        });
      }
    }

    options.sort((a, b) => b.score - a.score);
    const bestOpt = options[0];

    scoredCandidates.push({
      timestamp: match.timestamp,
      score: bestOpt.score,
      leagueSlug: match.leagueSlug,
      marketType: bestOpt.marketType,
      leg: {
        homeTeam: match.homeName,
        awayTeam: match.awayName,
        homeShortCode: match.homeAbbr,
        awayShortCode: match.awayAbbr,
        competition: match.compLabel,
        dateLabel: match.dateLabel,
        marketLabel: bestOpt.marketLabel,
        probabilityPct: bestOpt.probabilityPct,
        expectedGoalsHome: poisson.expectedGoalsHome,
        expectedGoalsAway: poisson.expectedGoalsAway,
        rationale: bestOpt.rationale,
      },
    });
  }

  if (scoredCandidates.length === 0) {
    return null;
  }

  scoredCandidates.sort((a, b) => b.score - a.score);

  let chosenCandidates: ScoredCandidateLeg[];
  if (isWorldMix) {
    // Prefer up to 1 top pick per distinct league first, then fill up to targetCount
    const picked: ScoredCandidateLeg[] = [];
    const pickedTimestamps = new Set<string>();
    const seenLeagues = new Set<string>();
    for (const cand of scoredCandidates) {
      if (!seenLeagues.has(cand.leagueSlug)) {
        seenLeagues.add(cand.leagueSlug);
        picked.push(cand);
        pickedTimestamps.add(`${cand.leg.homeTeam}::${cand.leg.awayTeam}`);
        if (picked.length === targetCount) break;
      }
    }
    if (picked.length < targetCount) {
      for (const cand of scoredCandidates) {
        const key = `${cand.leg.homeTeam}::${cand.leg.awayTeam}`;
        if (!pickedTimestamps.has(key)) {
          picked.push(cand);
          pickedTimestamps.add(key);
          if (picked.length === targetCount) break;
        }
      }
    }
    chosenCandidates = picked;
  } else {
    chosenCandidates = scoredCandidates.slice(0, targetCount);
  }

  const selected = chosenCandidates
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((item) => item.leg);

  const combinedProduct = selected.reduce(
    (acc, leg) => acc * (leg.probabilityPct / 100),
    1
  );
  const combinedProbabilityPct = Math.max(1, Math.round(combinedProduct * 100));
  const fairOddEstimate = Number((1 / Math.max(0.01, combinedProduct)).toFixed(2));

  return {
    leagueSlug: leagueKey,
    requestedCount: targetCount,
    onlyToday: effectiveTodayOnly,
    competition: compLabel,
    updatedAt: new Date().toISOString(),
    legs: selected,
    combinedProbabilityPct,
    fairOddEstimate,
    sourceUrl: isWorldMix
      ? 'https://www.espn.com/soccer/scoreboard'
      : `https://www.espn.com/soccer/scoreboard/_/league/${leagueKey}`,
  };
}

export async function buildSerieAMultipleViaEspn(): Promise<SerieAMultipleTip | null> {
  return buildMultipleTipViaEspn('bra.1', 3);
}
