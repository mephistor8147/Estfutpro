import type {
  AnalysisResponsePayload,
  ChampionshipScope,
  DailyBetOddsMatch,
  DailyBetsResponse,
  GroundingSource,
  HeadToHeadMatch,
  LiveScoreMatchResult,
  LiveScoreQueryItem,
  MatchAnalysisData,
  MatchLiveState,
  MatchOutcome,
  MultipleDayFilter,
  MultipleLegStatus,
  ParsedBetSlipLeg,
  RecentMatchItem,
  SearchPreferences,
  SerieAMultipleLeg,
  SerieAMultipleTip,
  SuggestedFixture,
  SuperCombinedLeg,
  SuperCombinedTip,
  SuperSameGameCombo,
  SuperTipMarketCategory,
  TeamComplementaryStats,
  TeamIdentity,
  TeamLastFiveStats,
  TeamStandingsStats,
} from '../types/football.js';
import { calculatePoissonModel, poissonPmf } from './poisson.js';

interface EspnSearchTeam {
  id: string;
  displayName: string;
  abbreviation: string;
  color: string;
  alternateColor: string;
  defaultLeagueSlug: string;
  leagueName?: string;
  logoUrl?: string;
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
  { match: /championship|ingl[eê]s.*2/i, slug: 'eng.2', label: 'EFL Championship' },
  { match: /premier\s*league|ingl[eê]s/i, slug: 'eng.1', label: 'Premier League' },
  { match: /la\s*liga\s*2|espanhol.*2/i, slug: 'esp.2', label: 'La Liga 2' },
  { match: /la\s*liga|espanhol/i, slug: 'esp.1', label: 'La Liga' },
  { match: /conference\s*league/i, slug: 'uefa.europa.conf', label: 'UEFA Conference League' },
  { match: /champions/i, slug: 'uefa.champions', label: 'UEFA Champions League' },
  { match: /europa\s*league/i, slug: 'uefa.europa', label: 'UEFA Europa League' },
  { match: /nations\s*league/i, slug: 'uefa.nations', label: 'UEFA Nations League' },
  { match: /serie\s*a.*it[aá]l|italiano/i, slug: 'ita.1', label: 'Serie A Itália' },
  { match: /bundesliga|alem[aã]o/i, slug: 'ger.1', label: 'Bundesliga' },
  { match: /ligue\s*1|franc[eê]s/i, slug: 'fra.1', label: 'Ligue 1' },
  { match: /portug|primeira liga/i, slug: 'por.1', label: 'Liga Portugal' },
  { match: /eredivisie|holand/i, slug: 'ned.1', label: 'Eredivisie (Holanda)' },
  { match: /belg|pro league/i, slug: 'bel.1', label: 'Pro League (Bélgica)' },
  { match: /turqu|s[uü]per\s*lig/i, slug: 'tur.1', label: 'Süper Lig (Turquia)' },
  { match: /esc[oó]cia|scottish/i, slug: 'sco.1', label: 'Premiership (Escócia)' },
  { match: /argentin/i, slug: 'arg.1', label: 'Liga Profesional Argentina' },
  { match: /liga\s*mx|m[eé]xico|mexican/i, slug: 'mex.1', label: 'Liga MX (México)' },
  { match: /col[oô]mbia/i, slug: 'col.1', label: 'Primera A (Colômbia)' },
  { match: /urugua/i, slug: 'uru.1', label: 'Campeonato Uruguaio' },
  { match: /chile/i, slug: 'chi.1', label: 'Campeonato Chileno' },
  { match: /saudi|ar[aá]bia/i, slug: 'ksa.1', label: 'Saudi Pro League' },
  { match: /j\.?\s*league|jap[aã]o/i, slug: 'jpn.1', label: 'J.League (Japão)' },
  { match: /a-?league|austr[aá]lia/i, slug: 'aus.1', label: 'A-League (Austrália)' },
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
  'bra.supercopa_do_brazil': 'Supercopa do Brasil',
  'conmebol.libertadores': 'Copa Libertadores',
  'conmebol.sudamericana': 'Copa Sul-Americana',
  'conmebol.recopa': 'Recopa Sul-Americana',
  'conmebol.america': 'Copa América',
  'eng.1': 'Premier League',
  'eng.2': 'EFL Championship',
  'eng.3': 'League One (Inglaterra)',
  'eng.4': 'League Two (Inglaterra)',
  'eng.5': 'National League (Inglaterra)',
  'eng.fa': 'FA Cup',
  'eng.league_cup': 'Copa da Liga Inglesa',
  'esp.1': 'La Liga',
  'esp.2': 'La Liga 2',
  'esp.copa_del_rey': 'Copa do Rei (Espanha)',
  'esp.copa_de_la_reina': 'Copa da Rainha (Espanha)',
  'uefa.champions': 'UEFA Champions League',
  'uefa.wchampions': 'UEFA Champions League Feminina',
  'uefa.europa': 'UEFA Europa League',
  'uefa.europa.conf': 'UEFA Conference League',
  'uefa.nations': 'UEFA Nations League',
  'uefa.euro': 'Eurocopa',
  'ita.1': 'Serie A Itália',
  'ita.2': 'Serie B Itália',
  'ita.coppa_italia': 'Coppa Italia',
  'ger.1': 'Bundesliga',
  'ger.2': '2. Bundesliga',
  'ger.dfb_pokal': 'Copa da Alemanha',
  'fra.1': 'Ligue 1',
  'fra.2': 'Ligue 2',
  'fra.w.1': 'Première Ligue (França)',
  'fra.coupe_de_france': 'Copa da França',
  'por.1': 'Liga Portugal',
  'por.taca.portugal': 'Taça de Portugal',
  'ned.1': 'Eredivisie (Holanda)',
  'ned.2': 'Eerste Divisie (Holanda)',
  'ned.cup': 'Copa da Holanda',
  'bel.1': 'Pro League (Bélgica)',
  'tur.1': 'Süper Lig (Turquia)',
  'sco.1': 'Premiership (Escócia)',
  'sco.2': 'Championship (Escócia)',
  'rus.1': 'Premier League (Rússia)',
  'gre.1': 'Super League (Grécia)',
  'aut.1': 'Bundesliga (Áustria)',
  'den.1': 'Superliga (Dinamarca)',
  'nor.1': 'Eliteserien (Noruega)',
  'swe.1': 'Allsvenskan (Suécia)',
  'arg.1': 'Liga Profesional Argentina',
  'arg.2': 'Primera Nacional (Argentina)',
  'arg.copa': 'Copa Argentina',
  'mex.1': 'Liga MX (México)',
  'mex.2': 'Liga de Expansión (México)',
  'col.1': 'Primera A (Colômbia)',
  'col.copa': 'Copa Colômbia',
  'uru.1': 'Campeonato Uruguaio',
  'uru.2': 'Segunda Divisão (Uruguai)',
  'chi.1': 'Campeonato Chileno',
  'chi.copa_chi': 'Copa Chile',
  'ecu.1': 'LigaPro (Equador)',
  'par.1': 'Primera División (Paraguai)',
  'per.1': 'Liga 1 (Peru)',
  'bol.1': 'División Profesional (Bolívia)',
  'ven.1': 'Liga FUTVE (Venezuela)',
  'crc.1': 'Primera División (Costa Rica)',
  'hon.1': 'Liga Nacional (Honduras)',
  'gua.1': 'Liga Nacional (Guatemala)',
  'slv.1': 'Primera División (El Salvador)',
  'usa.1': 'MLS',
  'usa.usl.1': 'USL Championship (EUA)',
  'usa.open': 'US Open Cup',
  'concacaf.champions': 'CONCACAF Champions Cup',
  'concacaf.nations.league': 'CONCACAF Nations League',
  'concacaf.leagues.cup': 'Leagues Cup',
  'ksa.1': 'Saudi Pro League',
  'ksa.kings.cup': 'Copa do Rei (Arábia Saudita)',
  'jpn.1': 'J.League (Japão)',
  'chn.1': 'Super League (China)',
  'aus.1': 'A-League (Austrália)',
  'aus.w.1': 'A-League Feminina (Austrália)',
  'ind.1': 'Indian Super League',
  'ind.2': 'I-League (Índia)',
  'rsa.1': 'Premiership (África do Sul)',
  'afc.champions': 'AFC Champions League',
  'afc.cup': 'AFC Cup',
  'caf.champions': 'CAF Champions League',
  'caf.confed': 'CAF Confederation Cup',
  'caf.nations': 'Copa Africana de Nações',
  'fifa.world': 'Copa do Mundo FIFA',
  'fifa.cwc': 'Mundial de Clubes FIFA',
  'fifa.friendly': 'Amistosos Internacionais',
  'fifa.worldq.conmebol': 'Eliminatórias Sul-Americanas',
  'fifa.worldq.uefa': 'Eliminatórias Europeias',
  'fifa.worldq.concacaf': 'Eliminatórias CONCACAF',
  'fifa.worldq.afc': 'Eliminatórias Asiáticas',
  'fifa.worldq.caf': 'Eliminatórias Africanas',
  'fifa.world.u20': 'Mundial Sub-20 FIFA',
  'fifa.world.u17': 'Mundial Sub-17 FIFA',
  'club.friendly': 'Amistosos de Clubes',
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

function extractTeamLogoUrl(teamObj: any): string | undefined {
  const direct =
    typeof teamObj?.logo === 'string' && teamObj.logo.startsWith('http')
      ? teamObj.logo
      : typeof teamObj?.logos?.[0]?.href === 'string' &&
          teamObj.logos[0].href.startsWith('http')
        ? teamObj.logos[0].href
        : undefined;
  if (direct) return direct;
  const idStr = String(teamObj?.id || '').trim();
  if (/^\d+$/.test(idStr)) {
    return `https://a.espncdn.com/i/teamlogos/soccer/500/${idStr}.png`;
  }
  return undefined;
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
    logoUrl: extractTeamLogoUrl(bestTeam),
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
    logoUrl: extractTeamLogoUrl(best),
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
  scope: ChampionshipScope,
  searchPrefs?: Partial<SearchPreferences>
): Promise<SuggestedFixture[]> {
  const baseLeagues =
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
            'por.1',
            'ned.1',
            'bel.1',
            'tur.1',
            'arg.1',
            'mex.1',
            'col.1',
            'uru.1',
            'usa.1',
            'ksa.1',
            'jpn.1',
            'uefa.champions',
            'uefa.europa',
            'uefa.nations',
            'conmebol.libertadores',
          ];

  const favSlugs = Array.isArray(searchPrefs?.favoriteLeagues)
    ? searchPrefs.favoriteLeagues
        .map((s) => String(s || '').trim())
        .filter((s) => Boolean(s) && s !== 'today' && s !== 'tomorrow' && s !== 'world')
        .slice(0, 12)
    : [];
  const leagues = Array.from(new Set([...favSlugs, ...baseLeagues])).slice(0, 22);

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

  const includeLive = searchPrefs?.includeLiveMatches !== false;
  const searchWindow = searchPrefs?.window || 'week';
  const sortBy = searchPrefs?.sortBy || 'time';
  const favSet = new Set(favSlugs);
  const todayBrtIso = BRT_DAY_FORMATTER.format(new Date());

  const seenEventIds = new Set<string>();
  const collected: (SuggestedFixture & { isLive: boolean; timestamp: number; isFav: boolean })[] = [];
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

      const isLive = state === 'in';
      if (isLive && !includeLive) continue;

      const evDate = ev.date ? new Date(ev.date) : null;
      const timestamp = evDate && !Number.isNaN(evDate.getTime()) ? evDate.getTime() : now;

      // Exclude stale unstarted games more than 3 hours in the past
      if (!isLive && timestamp < now - 3 * 60 * 60 * 1000) continue;

      if (!isLive && searchWindow === 'today') {
        const evBrtDay = evDate ? BRT_DAY_FORMATTER.format(evDate) : '';
        if (evBrtDay !== todayBrtIso) continue;
      } else if (!isLive && searchWindow === '48h') {
        if (timestamp > now + 48 * 60 * 60 * 1000) continue;
      }

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
        homeTeam: homeTitle,
        awayTeam: awayTitle,
        homeShortCode: (home.team?.abbreviation || homeTitle || 'MAN')
          .slice(0, 3)
          .toUpperCase(),
        awayShortCode: (away.team?.abbreviation || awayTitle || 'VIS')
          .slice(0, 3)
          .toUpperCase(),
        homeLogoUrl: extractTeamLogoUrl(home.team),
        awayLogoUrl: extractTeamLogoUrl(away.team),
        homeColor: sanitizeHex(home.team?.color, '#0F766E'),
        awayColor: sanitizeHex(away.team?.color, '#1D4ED8'),
        leagueSlug: slug,
        competition: compTitle,
        dateLabel,
        isLive,
        timestamp,
        isFav: favSet.has(slug),
      });
    }
  }

  collected.sort((a, b) => {
    if (a.isFav !== b.isFav) return a.isFav ? -1 : 1;
    if (sortBy === 'league') {
      const compDiff = a.competition.localeCompare(b.competition, 'pt-BR');
      if (compDiff !== 0) return compDiff;
    }
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    return a.timestamp - b.timestamp;
  });

  return collected
    .slice(0, 14)
    .map(({ isLive: _isLive, timestamp: _ts, isFav: _isFav, ...rest }) => rest);
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
    logoUrl: homeInfo.logoUrl,
  };
  const awayIdentity: TeamIdentity = {
    name: awayInfo.displayName,
    shortCode: awayInfo.abbreviation,
    primaryColor: awayInfo.color,
    secondaryColor: awayInfo.alternateColor,
    logoUrl: awayInfo.logoUrl,
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
  'por.1',
  'ned.1',
  'bel.1',
  'tur.1',
  'arg.1',
  'mex.1',
  'col.1',
  'uru.1',
  'usa.1',
  'ksa.1',
  'jpn.1',
  'aus.1',
  'uefa.champions',
  'uefa.europa',
  'uefa.europa.conf',
  'conmebol.libertadores',
  'conmebol.sudamericana',
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
  'eng.2',
  'eng.fa',
  'eng.league_cup',
  'esp.1',
  'esp.2',
  'esp.copa_del_rey',
  'ita.1',
  'ita.2',
  'ita.coppa_italia',
  'ger.1',
  'ger.2',
  'ger.dfb_pokal',
  'fra.1',
  'fra.2',
  'fra.coupe_de_france',
  'por.1',
  'por.taca.portugal',
  'ned.1',
  'ned.2',
  'bel.1',
  'tur.1',
  'sco.1',
  'rus.1',
  'gre.1',
  'aut.1',
  'den.1',
  'nor.1',
  'swe.1',
  'arg.1',
  'mex.1',
  'col.1',
  'uru.1',
  'chi.1',
  'ecu.1',
  'par.1',
  'per.1',
  'usa.1',
  'ksa.1',
  'jpn.1',
  'aus.1',
  'chn.1',
  'ind.1',
  'rsa.1',
  'uefa.champions',
  'uefa.europa',
  'uefa.europa.conf',
  'uefa.nations',
  'conmebol.libertadores',
  'conmebol.sudamericana',
  'afc.champions',
  'caf.champions',
  'concacaf.champions',
  'concacaf.nations.league',
  'fifa.worldq.conmebol',
  'fifa.worldq.uefa',
  'fifa.worldq.concacaf',
  'fifa.worldq.afc',
  'fifa.worldq.caf',
  'fifa.friendly',
];

const BRT_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Pre-seeded ESPN numeric leagueId -> { slug, name } cache (dynamically enriched at runtime)
const leagueIdMetaCache = new Map<string, { slug: string; name: string }>([
  ['630', { slug: 'bra.1', name: 'Brasileirão Série A' }],
  ['680', { slug: 'uru.1', name: 'Campeonato Uruguaio' }],
  ['770', { slug: 'usa.1', name: 'MLS' }],
  ['740', { slug: 'esp.1', name: 'La Liga' }],
  ['720', { slug: 'ger.1', name: 'Bundesliga' }],
  ['710', { slug: 'fra.1', name: 'Ligue 1' }],
  ['730', { slug: 'ita.1', name: 'Serie A Itália' }],
  ['700', { slug: 'eng.1', name: 'Premier League' }],
  ['745', { slug: 'arg.1', name: 'Liga Profesional Argentina' }],
  ['760', { slug: 'mex.1', name: 'Liga MX (México)' }],
  ['750', { slug: 'jpn.1', name: 'J.League (Japão)' }],
  ['640', { slug: 'chi.1', name: 'Campeonato Chileno' }],
  ['650', { slug: 'col.1', name: 'Primera A (Colômbia)' }],
  ['660', { slug: 'ecu.1', name: 'LigaPro (Equador)' }],
  ['3934', { slug: 'par.1', name: 'Primera División (Paraguai)' }],
  ['21231', { slug: 'ksa.1', name: 'Saudi Pro League' }],
  ['3906', { slug: 'aus.1', name: 'A-League (Austrália)' }],
  ['3901', { slug: 'bel.1', name: 'Pro League (Bélgica)' }],
  ['3939', { slug: 'rus.1', name: 'Premier League (Rússia)' }],
  ['3913', { slug: 'den.1', name: 'Superliga (Dinamarca)' }],
  ['3960', { slug: 'nor.1', name: 'Eliteserien (Noruega)' }],
  ['8316', { slug: 'ind.1', name: 'Indian Super League' }],
  ['3921', { slug: 'esp.2', name: 'La Liga 2' }],
  ['3927', { slug: 'ger.2', name: '2. Bundesliga' }],
  ['3931', { slug: 'ita.2', name: 'Serie B Itália' }],
  ['3926', { slug: 'fra.2', name: 'Ligue 2' }],
  ['3933', { slug: 'ned.2', name: 'Eerste Divisie (Holanda)' }],
  ['3940', { slug: 'sco.2', name: 'Championship (Escócia)' }],
  ['20922', { slug: 'por.taca.portugal', name: 'Taça de Portugal' }],
  ['19483', { slug: 'uefa.wchampions', name: 'UEFA Champions League Feminina' }],
]);

function isExcludedAmateurLeague(slug: string): boolean {
  const s = slug.toLowerCase();
  return s.startsWith('usa.ncaa.') || s === 'nonfifa';
}

function getLeaguePriorityTier(slug: string): 1 | 2 | 3 {
  const s = slug.toLowerCase();
  if (
    /^(bra\.1|bra\.copa_do_brazil|eng\.1|esp\.1|ita\.1|ger\.1|fra\.1|por\.1|ned\.1|bel\.1|tur\.1|arg\.1|mex\.1|usa\.1)$/.test(
      s
    ) ||
    /^(uefa\.(champions|europa|europa\.conf|nations|euro)|conmebol\.(libertadores|sudamericana|recopa|america)|afc\.champions|caf\.champions|concacaf\.(champions|nations)|fifa\.(world|cwc|worldq))/.test(
      s
    )
  ) {
    return 1;
  }
  if (
    /^(bra\.2|bra\.3|bra\.copa_do_nordeste|bra\.camp\.|col\.1|uru\.1|chi\.1|ecu\.1|par\.1|per\.1|bol\.1|ven\.1|crc\.1|hon\.1|gua\.1|slv\.1|jpn\.1|ksa\.1|chn\.1|aus\.1|ind\.1|rsa\.1|sco\.1|rus\.1|gre\.1|aut\.1|den\.1|nor\.1|swe\.1|eng\.2|eng\.fa|eng\.league_cup|esp\.2|esp\.copa_del_rey|ger\.2|ger\.dfb_pokal|ita\.2|ita\.coppa_italia|fra\.2|fra\.coupe_de_france|por\.taca\.portugal|ned\.2|ned\.cup|arg\.copa|col\.copa|chi\.copa_chi|ksa\.kings\.cup|caf\.nations|caf\.confed|afc\.asian\.cup|afc\.cup)/.test(
      s
    )
  ) {
    return 2;
  }
  return 3;
}

interface DiscoveredUpcomingMatch {
  eventId: string;
  leagueSlug: string;
  compLabel: string;
  tier: 1 | 2 | 3;
  timestamp: number;
  isToday: boolean;
  dateLabel: string;
  homeId: string;
  homeName: string;
  homeAbbr: string;
  homeColor: string;
  homeLogoUrl?: string;
  awayId: string;
  awayName: string;
  awayAbbr: string;
  awayColor: string;
  awayLogoUrl?: string;
}

function parseLeagueIdFromUid(uid?: string): string | null {
  if (!uid) return null;
  const m = String(uid).match(/l:(\d+)/);
  return m ? m[1] : null;
}

async function resolveLeagueMetaForGlobalEvents(events: any[]): Promise<void> {
  const sampleEventByUnseenLid = new Map<string, string>();
  for (const ev of events) {
    const lid = parseLeagueIdFromUid(ev?.uid);
    const evId = String(ev?.id || '');
    if (!lid || !evId || leagueIdMetaCache.has(lid) || sampleEventByUnseenLid.has(lid)) {
      continue;
    }
    sampleEventByUnseenLid.set(lid, evId);
  }

  if (sampleEventByUnseenLid.size === 0) return;

  const entries = Array.from(sampleEventByUnseenLid.entries()).slice(0, 32);
  await Promise.all(
    entries.map(async ([lid, evId]) => {
      const sum = await fetchJson<any>(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${encodeURIComponent(
          evId
        )}`,
        5000
      );
      const lg = sum?.header?.league;
      const slug = typeof lg?.slug === 'string' ? lg.slug.trim() : '';
      const rawName = typeof lg?.name === 'string' ? lg.name.trim() : '';
      if (slug) {
        leagueIdMetaCache.set(lid, {
          slug,
          name: LEAGUE_LABELS[slug] || rawName || slug.toUpperCase(),
        });
      }
    })
  );
}

async function discoverGlobalUpcomingMatches(
  ymds: string[],
  todayBrtIso: string,
  targetBrtIso?: string
): Promise<DiscoveredUpcomingMatch[]> {
  const uniqueYmds = Array.from(new Set(ymds.filter(Boolean)));
  const boards = await Promise.all(
    uniqueYmds.map((ymd) =>
      fetchJson<any>(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${ymd}`,
        7000
      )
    )
  );

  const rawEvents: any[] = [];
  const seenRawIds = new Set<string>();
  for (const board of boards) {
    for (const ev of board?.events || []) {
      const evId = String(ev?.id || '');
      const state = ev?.competitions?.[0]?.status?.type?.state;
      const completed = Boolean(ev?.competitions?.[0]?.status?.type?.completed);
      if (!evId || seenRawIds.has(evId) || completed || state !== 'pre') continue;
      seenRawIds.add(evId);
      rawEvents.push(ev);
    }
  }

  await resolveLeagueMetaForGlobalEvents(rawEvents);

  const now = Date.now();
  const out: DiscoveredUpcomingMatch[] = [];

  for (const ev of rawEvents) {
    const eventId = String(ev?.id || '');
    const comp = ev?.competitions?.[0];
    const statusType = comp?.status?.type;
    const evDate = ev?.date ? new Date(ev.date) : null;
    const timestamp = evDate && !Number.isNaN(evDate.getTime()) ? evDate.getTime() : 0;
    if (!timestamp || timestamp < now - 20 * 60 * 1000) continue;

    const evBrtDay = evDate ? BRT_DAY_FORMATTER.format(evDate) : '';
    if (targetBrtIso && evBrtDay !== targetBrtIso) continue;

    const lid = parseLeagueIdFromUid(ev?.uid);
    const meta = lid ? leagueIdMetaCache.get(lid) : undefined;
    const slug = meta?.slug || '';
    if (!slug || isExcludedAmateurLeague(slug)) continue;

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

    const compLabel = LEAGUE_LABELS[slug] || meta?.name || slug.toUpperCase();

    out.push({
      eventId,
      leagueSlug: slug,
      compLabel,
      tier: getLeaguePriorityTier(slug),
      timestamp,
      isToday: evBrtDay === todayBrtIso,
      dateLabel: formatUpcomingKickoffLabel(evDate, statusType?.shortDetail),
      homeId: String(home.team.id),
      homeName,
      homeAbbr: (home.team.abbreviation || homeName || 'MAN').slice(0, 3).toUpperCase(),
      homeColor: sanitizeHex(home.team.color, '#0F766E'),
      homeLogoUrl: extractTeamLogoUrl(home.team),
      awayId: String(away.team.id),
      awayName,
      awayAbbr: (away.team.abbreviation || awayName || 'VIS').slice(0, 3).toUpperCase(),
      awayColor: sanitizeHex(away.team.color, '#1D4ED8'),
      awayLogoUrl: extractTeamLogoUrl(away.team),
    });
  }

  return out;
}

function isTournamentOrCupSlug(slug: string): boolean {
  const s = slug.toLowerCase();
  return /(copa|cup|taca|pokal|champions|europa|conf|libertadores|sudamericana|nations|friendly|world|america|recopa|olympics)/.test(
    s
  );
}

async function fetchTeamScheduleWithAllFallback(
  slug: string,
  teamId: string
): Promise<any> {
  if (!isTournamentOrCupSlug(slug)) {
    const primary = await fetchJson<any>(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(
        slug
      )}/teams/${encodeURIComponent(teamId)}/schedule`,
      6000
    );
    const completedCount = (primary?.events || []).filter((e: any) =>
      Boolean(e?.competitions?.[0]?.status?.type?.completed)
    ).length;
    if (completedCount >= 3) {
      return primary;
    }
    const allSched = await fetchJson<any>(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${encodeURIComponent(
        teamId
      )}/schedule`,
      6000
    );
    const allCompleted = (allSched?.events || []).filter((e: any) =>
      Boolean(e?.competitions?.[0]?.status?.type?.completed)
    ).length;
    return allCompleted > completedCount ? allSched : primary;
  }

  // For cups & continental tournaments, /all/teams/{id}/schedule captures full recent club form
  const allSched = await fetchJson<any>(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${encodeURIComponent(
      teamId
    )}/schedule`,
    6000
  );
  if ((allSched?.events || []).length > 0) {
    return allSched;
  }
  return fetchJson<any>(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(
      slug
    )}/teams/${encodeURIComponent(teamId)}/schedule`,
    6000
  );
}

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
  leagueKey = 'today',
  desiredCount = 3,
  dayFilterInput: MultipleDayFilter | boolean = 'all'
): Promise<SerieAMultipleTip | null> {
  const targetCount =
    desiredCount === 4 || desiredCount === 5 || desiredCount === 10 ? desiredCount : 3;

  const effectiveDayFilter: MultipleDayFilter =
    leagueKey === 'today'
      ? 'today'
      : leagueKey === 'tomorrow'
        ? 'tomorrow'
        : typeof dayFilterInput === 'boolean'
          ? dayFilterInput
            ? 'today'
            : 'all'
          : dayFilterInput;

  const isGlobalDayMode = leagueKey === 'today' || leagueKey === 'tomorrow';
  const isDateRestricted = effectiveDayFilter !== 'all';
  const isWorldMix = leagueKey === 'world' || isGlobalDayMode;

  const targetLeagues = isGlobalDayMode
    ? TODAY_ALL_LEAGUES.slice(0, 18)
    : leagueKey === 'world'
      ? WORLD_MIX_LEAGUES
      : [leagueKey];

  const baseCompLabel =
    leagueKey === 'today'
      ? 'Jogos de Hoje (Mundial)'
      : leagueKey === 'tomorrow'
        ? 'Jogos de Amanhã (Mundial)'
        : leagueKey === 'world'
          ? 'Todo o Mundo (Misto)'
          : LEAGUE_LABELS[leagueKey] || leagueKey.toUpperCase();

  const compLabel = !isGlobalDayMode
    ? effectiveDayFilter === 'today'
      ? `${baseCompLabel} · Hoje`
      : effectiveDayFilter === 'tomorrow'
        ? `${baseCompLabel} · Amanhã`
        : baseCompLabel
    : baseCompLabel;

  const nowDate = new Date();
  const todayBrtIso = BRT_DAY_FORMATTER.format(nowDate);
  const offsetDays = effectiveDayFilter === 'tomorrow' ? 1 : 0;
  const targetBrtRefDate = new Date(nowDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const targetBrtIso = BRT_DAY_FORMATTER.format(targetBrtRefDate);
  const lookaheadBrtIso = BRT_DAY_FORMATTER.format(
    new Date(targetBrtRefDate.getTime() + 24 * 60 * 60 * 1000)
  );
  const dayAfterLookaheadIso = BRT_DAY_FORMATTER.format(
    new Date(targetBrtRefDate.getTime() + 48 * 60 * 60 * 1000)
  );
  const targetBrtYmd = targetBrtIso.replace(/-/g, '');
  const lookaheadBrtYmd = lookaheadBrtIso.replace(/-/g, '');
  const dayAfterLookaheadYmd = dayAfterLookaheadIso.replace(/-/g, '');
  const todayIso = nowDate.toISOString().slice(0, 10);
  const now = Date.now();

  type CandidateMatch = DiscoveredUpcomingMatch;
  const upcomingMap = new Map<string, CandidateMatch>();

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

      const evBrtDay = evDate ? BRT_DAY_FORMATTER.format(evDate) : '';
      if (isDateRestricted && evDate && evBrtDay !== targetBrtIso) continue;

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
        tier: getLeaguePriorityTier(slug),
        timestamp,
        isToday: evBrtDay === todayBrtIso,
        dateLabel: formatUpcomingKickoffLabel(evDate, statusType?.shortDetail),
        homeId: String(home.team.id),
        homeName,
        homeAbbr: (home.team.abbreviation || homeName || 'MAN')
          .slice(0, 3)
          .toUpperCase(),
        homeColor: sanitizeHex(home.team.color, '#0F766E'),
        homeLogoUrl: extractTeamLogoUrl(home.team),
        awayId: String(away.team.id),
        awayName,
        awayAbbr: (away.team.abbreviation || awayName || 'VIS')
          .slice(0, 3)
          .toUpperCase(),
        awayColor: sanitizeHex(away.team.color, '#1D4ED8'),
        awayLogoUrl: extractTeamLogoUrl(away.team),
      });
    }
    return out;
  };

  if (isWorldMix) {
    // Worldwide discovery: scan ESPN global /all/scoreboard across target dates + supplemental league boards
    const globalYmds = isDateRestricted
      ? [targetBrtYmd, lookaheadBrtYmd]
      : [targetBrtYmd, lookaheadBrtYmd, dayAfterLookaheadYmd];

    const [globalDiscovered, supplementalBoards] = await Promise.all([
      discoverGlobalUpcomingMatches(
        globalYmds,
        todayBrtIso,
        isDateRestricted ? targetBrtIso : undefined
      ),
      Promise.all(
        targetLeagues.map(async (slug) => {
          const url = isDateRestricted
            ? `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${targetBrtYmd}`
            : `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`;
          const json = await fetchJson<any>(url, 6000);
          return { slug, json };
        })
      ),
    ]);

    for (const m of globalDiscovered) {
      upcomingMap.set(`${m.leagueSlug}:${m.eventId}`, m);
    }

    const extraCalendarFetches: Promise<{ slug: string; json: any }>[] = [];
    for (const { slug, json } of supplementalBoards) {
      if (!json) continue;
      for (const m of extractUpcomingFromBatch(json, slug)) {
        const key = `${slug}:${m.eventId}`;
        if (!upcomingMap.has(key)) upcomingMap.set(key, m);
      }
      if (!isDateRestricted && upcomingMap.size < targetCount + 6) {
        const nextDates = extractCalendarDates(json, todayIso, 2);
        for (const dateStr of nextDates) {
          const ymd = dateStr.slice(0, 10).replace(/-/g, '');
          extraCalendarFetches.push(
            fetchJson<any>(
              `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${ymd}`,
              5500
            ).then((batch) => ({ slug, json: batch }))
          );
        }
      }
    }

    if (extraCalendarFetches.length > 0) {
      const extraBatches = await Promise.all(extraCalendarFetches);
      for (const { slug, json } of extraBatches) {
        if (!json) continue;
        for (const m of extractUpcomingFromBatch(json, slug)) {
          const key = `${slug}:${m.eventId}`;
          if (!upcomingMap.has(key)) upcomingMap.set(key, m);
        }
      }
    }
  } else {
    const initialScoreboards = await Promise.all(
      targetLeagues.map(async (slug) => {
        const url = isDateRestricted
          ? `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${targetBrtYmd}`
          : `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`;
        const json = await fetchJson<any>(url, 7000);
        return { slug, json };
      })
    );

    const extraDateFetches: Promise<{ slug: string; json: any }>[] = [];

    for (const { slug, json } of initialScoreboards) {
      if (!json) continue;
      const found = extractUpcomingFromBatch(json, slug);
      for (const item of found) {
        upcomingMap.set(`${slug}:${item.eventId}`, item);
      }

      if (isDateRestricted) {
        // Late evening BRT matches (after 21:00 BRT) fall on next UTC date in ESPN
        extraDateFetches.push(
          fetchJson<any>(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${lookaheadBrtYmd}`,
            5500
          ).then((batch) => ({ slug, json: batch }))
        );
      } else {
        const minDesired = Math.max(5, targetCount + 2);
        if (found.length < minDesired) {
          const nextDates = extractCalendarDates(json, todayIso, 3);
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
  }

  const allUpcoming = Array.from(upcomingMap.values()).sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.timestamp - b.timestamp;
  });

  let candidateMatches: CandidateMatch[];
  if (isWorldMix) {
    // Pick up to N soonest matches per league across Tier 1 & Tier 2 first, then Tier 3 if needed for global diversity
    const maxPerLeague = targetCount >= 10 ? 3 : 2;
    const perLeagueCount = new Map<string, number>();
    const diverse: CandidateMatch[] = [];
    const overflow: CandidateMatch[] = [];
    for (const m of allUpcoming) {
      const count = perLeagueCount.get(m.leagueSlug) ?? 0;
      if (count < maxPerLeague) {
        perLeagueCount.set(m.leagueSlug, count + 1);
        diverse.push(m);
      } else {
        overflow.push(m);
      }
    }
    candidateMatches = [...diverse, ...overflow].slice(0, Math.max(14, targetCount + 6));
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
          6500
        );
        return [slug, json] as const;
      })
    ),
    Promise.all(
      teamLeaguePairs.map(async ([key, pair]) => {
        const json = await fetchTeamScheduleWithAllFallback(pair.slug, pair.teamId);
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
        eventId: match.eventId,
        leagueSlug: match.leagueSlug,
        homeTeam: match.homeName,
        awayTeam: match.awayName,
        homeShortCode: match.homeAbbr,
        awayShortCode: match.awayAbbr,
        homeLogoUrl: match.homeLogoUrl,
        awayLogoUrl: match.awayLogoUrl,
        homeColor: match.homeColor,
        awayColor: match.awayColor,
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
  const rawCombinedPct = combinedProduct * 100;
  const combinedProbabilityPct =
    rawCombinedPct >= 1
      ? Math.round(rawCombinedPct)
      : Math.max(0.1, Number(rawCombinedPct.toFixed(1)));
  const fairOddEstimate = Number((1 / Math.max(0.0001, combinedProduct)).toFixed(2));

  return {
    leagueSlug: leagueKey,
    requestedCount: targetCount,
    onlyToday: effectiveDayFilter === 'today',
    dayFilter: effectiveDayFilter,
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

function poissonAtLeast(lambda: number, minK: number): number {
  const safeLambda = Math.max(0.2, lambda);
  let below = 0;
  for (let k = 0; k < minK; k++) {
    below += poissonPmf(safeLambda, k);
  }
  return Math.min(0.94, Math.max(0.05, 1 - below));
}

function poissonAtMost(lambda: number, maxK: number): number {
  const safeLambda = Math.max(0.2, lambda);
  let sum = 0;
  for (let k = 0; k <= maxK; k++) {
    sum += poissonPmf(safeLambda, k);
  }
  return Math.min(0.94, Math.max(0.05, sum));
}

function scorePracticalMargin(probPct: number, bonus = 0): number {
  // Ideal hit margin sweet spot is 70%–87% (high accuracy without trivial 96% odds)
  const penaltyOver = probPct > 89 ? (probPct - 89) * 2.2 : 0;
  const penaltyUnder = probPct < 60 ? (60 - probPct) * 1.4 : 0;
  return probPct + bonus - penaltyOver - penaltyUnder;
}

function computeFairOddFromPct(probPct: number): number {
  const safe = Math.max(5, Math.min(96, probPct));
  return Number((100 / safe).toFixed(2));
}

async function fetchQuickCardsAndCorners(
  leagueSlug: string,
  teamId: string,
  completedEvents: ParsedScheduleEvent[],
  summaryCache: Map<string, Promise<any>>
): Promise<{
  avgCards: number | null;
  avgCorners: number | null;
  sampleSize: number;
}> {
  const targetIds = completedEvents.slice(0, 3).map((e) => e.id).filter(Boolean);
  if (targetIds.length === 0) {
    return { avgCards: null, avgCorners: null, sampleSize: 0 };
  }

  const summaries = await Promise.all(
    targetIds.map((id) => {
      const cacheKey = `${leagueSlug}:${id}`;
      let req = summaryCache.get(cacheKey);
      if (!req) {
        req = fetchJson<any>(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${id}`,
          4500
        ).then((res) =>
          res?.boxscore?.teams
            ? res
            : fetchJson<any>(
                `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueSlug}/summary?event=${id}`,
                4500
              )
        );
        summaryCache.set(cacheKey, req);
      }
      return req;
    })
  );

  const cards: number[] = [];
  const corners: number[] = [];

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

    const yc = getVal('yellowCards');
    const rc = getVal('redCards');
    if (yc !== null || rc !== null) {
      cards.push((yc ?? 0) + (rc ?? 0));
    }

    const c = getVal('wonCorners');
    if (c !== null) {
      corners.push(c);
    }
  }

  const avg = (arr: number[]): number | null =>
    arr.length > 0
      ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1))
      : null;

  return {
    avgCards: avg(cards),
    avgCorners: avg(corners),
    sampleSize: Math.max(cards.length, corners.length),
  };
}

export async function buildSuperCombinedTipViaEspn(): Promise<SuperCombinedTip | null> {
  const nowDate = new Date();
  const todayBrtIso = BRT_DAY_FORMATTER.format(nowDate);
  const tomorrowBrtIso = BRT_DAY_FORMATTER.format(
    new Date(nowDate.getTime() + 24 * 60 * 60 * 1000)
  );
  const dayAfterBrtIso = BRT_DAY_FORMATTER.format(
    new Date(nowDate.getTime() + 48 * 60 * 60 * 1000)
  );
  const todayBrtYmd = todayBrtIso.replace(/-/g, '');
  const tomorrowBrtYmd = tomorrowBrtIso.replace(/-/g, '');
  const dayAfterBrtYmd = dayAfterBrtIso.replace(/-/g, '');
  const todayIso = nowDate.toISOString().slice(0, 10);
  const now = Date.now();

  type SuperCandidateMatch = DiscoveredUpcomingMatch;

  const extractUpcoming = (batch: any, slug: string): SuperCandidateMatch[] => {
    const out: SuperCandidateMatch[] = [];
    const leagueTitle =
      LEAGUE_LABELS[slug] || batch?.leagues?.[0]?.name || slug.toUpperCase();

    for (const ev of batch?.events || []) {
      const eventId = String(ev?.id || '');
      const comp = ev?.competitions?.[0];
      const statusType = comp?.status?.type;
      const state = statusType?.state;
      const completed = Boolean(statusType?.completed);

      if (!eventId || completed || state !== 'pre') continue;

      const evDate = ev?.date ? new Date(ev.date) : null;
      const timestamp = evDate && !Number.isNaN(evDate.getTime()) ? evDate.getTime() : 0;
      if (!timestamp || timestamp < now - 20 * 60 * 1000) continue;

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

      const evBrtDay = evDate ? BRT_DAY_FORMATTER.format(evDate) : '';
      out.push({
        eventId,
        leagueSlug: slug,
        compLabel: leagueTitle,
        tier: getLeaguePriorityTier(slug),
        timestamp,
        isToday: evBrtDay === todayBrtIso,
        dateLabel: formatUpcomingKickoffLabel(evDate, statusType?.shortDetail),
        homeId: String(home.team.id),
        homeName,
        homeAbbr: (home.team.abbreviation || homeName || 'MAN').slice(0, 3).toUpperCase(),
        homeColor: sanitizeHex(home.team.color, '#0F766E'),
        homeLogoUrl: extractTeamLogoUrl(home.team),
        awayId: String(away.team.id),
        awayName,
        awayAbbr: (away.team.abbreviation || awayName || 'VIS').slice(0, 3).toUpperCase(),
        awayColor: sanitizeHex(away.team.color, '#1D4ED8'),
        awayLogoUrl: extractTeamLogoUrl(away.team),
      });
    }
    return out;
  };

  // Step 1: Discover ALL worldwide matches today via ESPN global /all/scoreboard + key regional leagues
  const priorityRegionalLeagues = [
    'bra.1',
    'bra.2',
    'bra.copa_do_brazil',
    'conmebol.libertadores',
    'conmebol.sudamericana',
    'eng.1',
    'esp.1',
    'ita.1',
    'ger.1',
    'fra.1',
    'uefa.champions',
  ];

  const [globalTodayMatches, priorityBatches] = await Promise.all([
    discoverGlobalUpcomingMatches([todayBrtYmd, tomorrowBrtYmd], todayBrtIso, todayBrtIso),
    Promise.all(
      priorityRegionalLeagues.map(async (slug) => {
        const json = await fetchJson<any>(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${todayBrtYmd}`,
          5500
        );
        return { slug, json };
      })
    ),
  ]);

  const matchMap = new Map<string, SuperCandidateMatch>();
  for (const m of globalTodayMatches) {
    if (m.isToday) {
      matchMap.set(`${m.leagueSlug}:${m.eventId}`, m);
    }
  }
  for (const { slug, json } of priorityBatches) {
    if (!json) continue;
    for (const m of extractUpcoming(json, slug)) {
      if (m.isToday) {
        const key = `${slug}:${m.eventId}`;
        if (!matchMap.has(key)) matchMap.set(key, m);
      }
    }
  }

  const todayCount = matchMap.size;

  // Step 2: If today has fewer than 6 upcoming games (e.g., late night BRT), seamlessly include tomorrow & next upcoming worldwide games
  if (matchMap.size < 6) {
    const [globalUpcomingMatches, defaultBoards] = await Promise.all([
      discoverGlobalUpcomingMatches([tomorrowBrtYmd, dayAfterBrtYmd], todayBrtIso),
      Promise.all(
        WORLD_MIX_LEAGUES.slice(0, 12).map(async (slug) => {
          const json = await fetchJson<any>(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`,
            5500
          );
          return { slug, json };
        })
      ),
    ]);

    for (const m of globalUpcomingMatches) {
      const key = `${m.leagueSlug}:${m.eventId}`;
      if (!matchMap.has(key)) matchMap.set(key, m);
    }

    const extraDates: Promise<{ slug: string; json: any }>[] = [];
    for (const { slug, json } of defaultBoards) {
      if (!json) continue;
      const found = extractUpcoming(json, slug);
      for (const m of found) {
        const key = `${slug}:${m.eventId}`;
        if (!matchMap.has(key)) matchMap.set(key, m);
      }
      if (found.length < 2 && matchMap.size < 10) {
        const nextDates = extractCalendarDates(json, todayIso, 2);
        for (const dateStr of nextDates) {
          const ymd = dateStr.slice(0, 10).replace(/-/g, '');
          extraDates.push(
            fetchJson<any>(
              `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${ymd}`,
              5000
            ).then((batch) => ({ slug, json: batch }))
          );
        }
      }
    }

    if (extraDates.length > 0) {
      const extraRes = await Promise.all(extraDates);
      for (const { slug, json } of extraRes) {
        if (!json) continue;
        for (const m of extractUpcoming(json, slug)) {
          const key = `${slug}:${m.eventId}`;
          if (!matchMap.has(key)) matchMap.set(key, m);
        }
      }
    }
  }

  const allUpcoming = Array.from(matchMap.values()).sort((a, b) => {
    if (a.isToday !== b.isToday) return a.isToday ? -1 : 1;
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.timestamp - b.timestamp;
  });

  if (allUpcoming.length === 0) {
    return null;
  }

  // Pick up to 12 diverse upcoming matches worldwide (preferring max 2 per league for global breadth)
  const perLeague = new Map<string, number>();
  const diverse: SuperCandidateMatch[] = [];
  const overflow: SuperCandidateMatch[] = [];
  for (const m of allUpcoming) {
    const cnt = perLeague.get(m.leagueSlug) ?? 0;
    if (cnt < 2) {
      perLeague.set(m.leagueSlug, cnt + 1);
      diverse.push(m);
    } else {
      overflow.push(m);
    }
  }
  const candidateMatches = [...diverse, ...overflow].slice(0, 12);

  const involvedLeagues = Array.from(new Set(candidateMatches.map((m) => m.leagueSlug)));
  const teamPairs = Array.from(
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
          6000
        );
        return [slug, json] as const;
      })
    ),
    Promise.all(
      teamPairs.map(async ([key, pair]) => {
        const json = await fetchTeamScheduleWithAllFallback(pair.slug, pair.teamId);
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

  interface PreMatchContext {
    match: SuperCandidateMatch;
    homeEvents: ParsedScheduleEvent[];
    awayEvents: ParsedScheduleEvent[];
    homeStandings: TeamStandingsStats;
    awayStandings: TeamStandingsStats;
    analysisData: MatchAnalysisData;
    poisson: ReturnType<typeof calculatePoissonModel>;
    dataRichness: number;
  }

  const defaultYear = String(new Date().getFullYear());
  const preContexts: PreMatchContext[] = [];

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
        logoUrl: match.homeLogoUrl,
      },
      awayTeam: {
        name: match.awayName,
        shortCode: match.awayAbbr,
        primaryColor: match.awayColor,
        secondaryColor: '#FFFFFF',
        logoUrl: match.awayLogoUrl,
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
    const dataRichness =
      Math.min(5, homeEvents.length) +
      Math.min(5, awayEvents.length) +
      (homeStandings.played ? 3 : 0) +
      (awayStandings.played ? 3 : 0) +
      (match.isToday ? 6 : 0);

    preContexts.push({
      match,
      homeEvents,
      awayEvents,
      homeStandings,
      awayStandings,
      analysisData,
      poisson,
      dataRichness,
    });
  }

  // Enrich top 8 richest matches with REAL ESPN boxscore cards & corners averages
  preContexts.sort((a, b) => b.dataRichness - a.dataRichness || a.match.timestamp - b.match.timestamp);
  const topForBoxscores = preContexts.slice(0, 8);
  const summaryCache = new Map<string, Promise<any>>();

  const boxscoreMap = new Map<
    string,
    {
      homeCards: number | null;
      awayCards: number | null;
      homeCorners: number | null;
      awayCorners: number | null;
    }
  >();

  await Promise.all(
    topForBoxscores.map(async (ctx) => {
      const [hBox, aBox] = await Promise.all([
        fetchQuickCardsAndCorners(ctx.match.leagueSlug, ctx.match.homeId, ctx.homeEvents, summaryCache),
        fetchQuickCardsAndCorners(ctx.match.leagueSlug, ctx.match.awayId, ctx.awayEvents, summaryCache),
      ]);
      boxscoreMap.set(`${ctx.match.leagueSlug}:${ctx.match.eventId}`, {
        homeCards: hBox.avgCards,
        awayCards: aBox.avgCards,
        homeCorners: hBox.avgCorners,
        awayCorners: aBox.avgCorners,
      });
    })
  );

  type ScorePred = (h: number, a: number) => boolean;

  interface EvaluatedMarket {
    category: SuperTipMarketCategory;
    categoryLabel: string;
    marketLabel: string;
    probabilityPct: number;
    score: number;
    statHighlight: string;
    rationale: string;
    pred?: ScorePred; // present for goal/result/btts markets so joint probability is exact
  }

  interface MatchMarketProfile {
    ctx: PreMatchContext;
    expectedCardsTotal: number | null;
    expectedCornersTotal: number | null;
    bestByCategory: Partial<Record<SuperTipMarketCategory, EvaluatedMarket>>;
    allOptionsByCategory: Partial<Record<SuperTipMarketCategory, EvaluatedMarket[]>>;
  }

  const profiles: MatchMarketProfile[] = [];

  for (const ctx of topForBoxscores) {
    const { match, poisson, homeEvents, awayEvents, homeStandings, awayStandings, analysisData } =
      ctx;
    const lambdaH = poisson.expectedGoalsHome;
    const lambdaA = poisson.expectedGoalsAway;
    const totalXg = Number((lambdaH + lambdaA).toFixed(2));
    const homeLast5 = analysisData.module1LastFive.home;
    const awayLast5 = analysisData.module1LastFive.away;
    const homePosStr = homeStandings.position ? `${homeStandings.position}º` : 'Mandante';
    const awayPosStr = awayStandings.position ? `${awayStandings.position}º` : 'Visitante';

    // Exact probabilities from Poisson 0..8 grid
    const probFromPred = (pred: ScorePred): number => {
      let p = 0;
      for (let i = 0; i <= 8; i++) {
        const ph = poissonPmf(lambdaH, i);
        for (let j = 0; j <= 8; j++) {
          if (pred(i, j)) p += ph * poissonPmf(lambdaA, j);
        }
      }
      return Math.min(95, Math.max(4, Math.round(p * 100)));
    };

    // Empirical season rates for gentle calibration (75% Poisson + 25% empirical when >= 6 matches)
    const calcEmpirical = (
      events: ParsedScheduleEvent[],
      check: (e: ParsedScheduleEvent) => boolean
    ): number | null => {
      if (events.length < 6) return null;
      const hits = events.filter(check).length;
      return Math.round((hits / events.length) * 100);
    };

    const blendWithEmpirical = (
      poissonPct: number,
      empH: number | null,
      empA: number | null
    ): number => {
      if (empH === null || empA === null) return poissonPct;
      const empAvg = (empH + empA) / 2;
      return Math.min(93, Math.max(8, Math.round(poissonPct * 0.75 + empAvg * 0.25)));
    };

    const empBttsH = calcEmpirical(homeEvents, (e) => e.teamScore > 0 && e.opponentScore > 0);
    const empBttsA = calcEmpirical(awayEvents, (e) => e.teamScore > 0 && e.opponentScore > 0);
    const empO15H = calcEmpirical(homeEvents, (e) => e.teamScore + e.opponentScore >= 2);
    const empO15A = calcEmpirical(awayEvents, (e) => e.teamScore + e.opponentScore >= 2);
    const empO25H = calcEmpirical(homeEvents, (e) => e.teamScore + e.opponentScore >= 3);
    const empO25A = calcEmpirical(awayEvents, (e) => e.teamScore + e.opponentScore >= 3);
    const empU35H = calcEmpirical(homeEvents, (e) => e.teamScore + e.opponentScore <= 3);
    const empU35A = calcEmpirical(awayEvents, (e) => e.teamScore + e.opponentScore <= 3);

    const bttsYesPct = blendWithEmpirical(poisson.bttsPct, empBttsH, empBttsA);
    const bttsNoPct = Math.min(93, Math.max(7, 100 - bttsYesPct));
    const over15Pct = blendWithEmpirical(poisson.over15Pct, empO15H, empO15A);
    const over25Pct = blendWithEmpirical(poisson.over25Pct, empO25H, empO25A);
    const under25Pct = Math.min(93, Math.max(7, 100 - over25Pct));
    const rawUnder35 = probFromPred((i, j) => i + j <= 3);
    const under35Pct = blendWithEmpirical(rawUnder35, empU35H, empU35A);

    const homeOrDrawPct = Math.min(94, poisson.homeWinPct + poisson.drawPct);
    const awayOrDrawPct = Math.min(94, poisson.awayWinPct + poisson.drawPct);
    const homeOrAwayPct = Math.min(94, poisson.homeWinPct + poisson.awayWinPct);

    const resultOptions: EvaluatedMarket[] = [
      {
        category: 'result',
        categoryLabel: 'Casa / Fora / Empate',
        marketLabel: `Vitória ${match.homeName}`,
        probabilityPct: poisson.homeWinPct,
        score: scorePracticalMargin(poisson.homeWinPct, poisson.homeWinPct >= 56 ? 12 : -4),
        statHighlight: `1X2: ${poisson.homeWinPct}% · ${poisson.drawPct}% · ${poisson.awayWinPct}%`,
        rationale: `${match.homeName} (${homePosStr}) soma ${homeLast5.wins}V nos últimos 5 jogos com xG ${lambdaH.toFixed(2)} em casa contra ${match.awayName} (${awayPosStr}).`,
        pred: (i, j) => i > j,
      },
      {
        category: 'result',
        categoryLabel: 'Casa / Fora / Empate',
        marketLabel: `Vitória ${match.awayName}`,
        probabilityPct: poisson.awayWinPct,
        score: scorePracticalMargin(poisson.awayWinPct, poisson.awayWinPct >= 56 ? 12 : -4),
        statHighlight: `1X2: ${poisson.homeWinPct}% · ${poisson.drawPct}% · ${poisson.awayWinPct}%`,
        rationale: `${match.awayName} (${awayPosStr}) projeta xG ${lambdaA.toFixed(2)} e ${awayLast5.wins}V nas últimas 5 partidas diante de ${match.homeName}.`,
        pred: (i, j) => j > i,
      },
      {
        category: 'result',
        categoryLabel: 'Casa / Fora / Empate',
        marketLabel: `Dupla chance: ${match.homeName} ou Empate`,
        probabilityPct: homeOrDrawPct,
        score: scorePracticalMargin(homeOrDrawPct, 2),
        statHighlight: `1X2: ${poisson.homeWinPct}% · ${poisson.drawPct}% · ${poisson.awayWinPct}%`,
        rationale: `${match.homeName} (${homePosStr}) mantém ${homeOrDrawPct}% de margem para pontuar como mandante (xG ${lambdaH.toFixed(2)}–${lambdaA.toFixed(2)}).`,
        pred: (i, j) => i >= j,
      },
      {
        category: 'result',
        categoryLabel: 'Casa / Fora / Empate',
        marketLabel: `Dupla chance: ${match.awayName} ou Empate`,
        probabilityPct: awayOrDrawPct,
        score: scorePracticalMargin(awayOrDrawPct, 2),
        statHighlight: `1X2: ${poisson.homeWinPct}% · ${poisson.drawPct}% · ${poisson.awayWinPct}%`,
        rationale: `${match.awayName} (${awayPosStr}) registra ${awayLast5.wins}V-${awayLast5.draws}E nas últimas 5 rodadas e ${awayOrDrawPct}% de chance de sair invicto.`,
        pred: (i, j) => j >= i,
      },
      {
        category: 'result',
        categoryLabel: 'Casa / Fora / Empate',
        marketLabel: 'Casa ou Fora (sem empate)',
        probabilityPct: homeOrAwayPct,
        score: scorePracticalMargin(homeOrAwayPct, -1),
        statHighlight: `Empate em apenas ${poisson.drawPct}%`,
        rationale: `Confronto com baixa tendência ao empate (${poisson.drawPct}% no modelo de Poisson), favorecendo vencedor nos 90 minutos.`,
        pred: (i, j) => i !== j,
      },
    ];

    if (poisson.drawPct >= 30 && Math.abs(poisson.homeWinPct - poisson.awayWinPct) <= 6) {
      resultOptions.push({
        category: 'result',
        categoryLabel: 'Casa / Fora / Empate',
        marketLabel: 'Empate',
        probabilityPct: poisson.drawPct,
        score: scorePracticalMargin(poisson.drawPct, -8),
        statHighlight: `Equilíbrio: ${poisson.homeWinPct}% · ${poisson.drawPct}% · ${poisson.awayWinPct}%`,
        rationale: `Equilíbrio estreito entre ${match.homeName} e ${match.awayName} com projeção de xG parelho (${lambdaH.toFixed(2)}–${lambdaA.toFixed(2)}).`,
        pred: (i, j) => i === j,
      });
    }

    resultOptions.sort((a, b) => b.score - a.score);

    const goalsOptions: EvaluatedMarket[] = [
      {
        category: 'goals',
        categoryLabel: 'Gols +/-',
        marketLabel: 'Mais de 1,5 gols',
        probabilityPct: over15Pct,
        score: scorePracticalMargin(over15Pct, 3),
        statHighlight: `xG total ${totalXg.toFixed(2)} (${lambdaH.toFixed(1)}–${lambdaA.toFixed(1)})`,
        rationale: `Soma projetada de ${totalXg.toFixed(2)} xG com médias recentes de ${homeLast5.avgGoalsScored} e ${awayLast5.avgGoalsScored} gols marcados por partida.`,
        pred: (i, j) => i + j >= 2,
      },
      {
        category: 'goals',
        categoryLabel: 'Gols +/-',
        marketLabel: 'Mais de 2,5 gols',
        probabilityPct: over25Pct,
        score: scorePracticalMargin(over25Pct, over25Pct >= 62 ? 6 : 0),
        statHighlight: `xG total ${totalXg.toFixed(2)}`,
        rationale: `Tendência ofensiva elevada (${totalXg.toFixed(2)} gols esperados) apoiada pelo ritmo de gols das duas equipes nas últimas 5 rodadas.`,
        pred: (i, j) => i + j >= 3,
      },
      {
        category: 'goals',
        categoryLabel: 'Gols +/-',
        marketLabel: 'Menos de 3,5 gols',
        probabilityPct: under35Pct,
        score: scorePracticalMargin(under35Pct, totalXg <= 2.55 ? 4 : 0),
        statHighlight: `xG total ${totalXg.toFixed(2)}`,
        rationale: `Ritmo moderado de gols (xG somado de ${totalXg.toFixed(2)}) com alta margem estatística para até 3 gols na partida.`,
        pred: (i, j) => i + j <= 3,
      },
      {
        category: 'goals',
        categoryLabel: 'Gols +/-',
        marketLabel: 'Menos de 2,5 gols',
        probabilityPct: under25Pct,
        score: scorePracticalMargin(under25Pct, under25Pct >= 62 ? 5 : 0),
        statHighlight: `xG total ${totalXg.toFixed(2)}`,
        rationale: `Defesas consistentes projetam placar travado (${totalXg.toFixed(2)} xG combinado e ${under25Pct}% de probabilidade sob 2,5 gols).`,
        pred: (i, j) => i + j <= 2,
      },
    ];
    goalsOptions.sort((a, b) => b.score - a.score);

    const bttsOptions: EvaluatedMarket[] = [
      {
        category: 'btts',
        categoryLabel: 'Ambas marcam',
        marketLabel: 'Ambas marcam: Sim',
        probabilityPct: bttsYesPct,
        score: scorePracticalMargin(bttsYesPct, 2),
        statHighlight:
          empBttsH !== null && empBttsA !== null
            ? `BTTS temp.: ${empBttsH}% / ${empBttsA}%`
            : `xG ${lambdaH.toFixed(1)}–${lambdaA.toFixed(1)}`,
        rationale: `${match.homeName} (${homeLast5.avgGoalsScored} gols/jogo) e ${match.awayName} (${awayLast5.avgGoalsScored} gols/jogo) apresentam produção ofensiva regular.`,
        pred: (i, j) => i >= 1 && j >= 1,
      },
      {
        category: 'btts',
        categoryLabel: 'Ambas marcam',
        marketLabel: 'Ambas marcam: Não',
        probabilityPct: bttsNoPct,
        score: scorePracticalMargin(bttsNoPct, 2),
        statHighlight:
          empBttsH !== null && empBttsA !== null
            ? `Sem BTTS: ${100 - empBttsH}% / ${100 - empBttsA}%`
            : `xG ${lambdaH.toFixed(1)}–${lambdaA.toFixed(1)}`,
        rationale: `Assimetria defensiva ou ataque visitante contido (xG ${lambdaH.toFixed(2)}–${lambdaA.toFixed(2)}) eleva a chance de ao menos um zero no placar.`,
        pred: (i, j) => i === 0 || j === 0,
      },
    ];
    bttsOptions.sort((a, b) => b.score - a.score);

    // Real ESPN Boxscore Cards & Corners
    const box = boxscoreMap.get(`${match.leagueSlug}:${match.eventId}`);
    const expectedCardsTotal =
      box && box.homeCards !== null && box.awayCards !== null
        ? Number((box.homeCards + box.awayCards).toFixed(1))
        : null;
    const expectedCornersTotal =
      box && box.homeCorners !== null && box.awayCorners !== null
        ? Number((box.homeCorners + box.awayCorners).toFixed(1))
        : null;

    const cardsOptions: EvaluatedMarket[] = [];
    if (expectedCardsTotal !== null && expectedCardsTotal > 0.5) {
      const cardCandidates: { label: string; prob: number; bonus: number }[] = [
        {
          label: 'Mais de 2,5 cartões',
          prob: Math.round(poissonAtLeast(expectedCardsTotal, 3) * 100),
          bonus: 2,
        },
        {
          label: 'Mais de 3,5 cartões',
          prob: Math.round(poissonAtLeast(expectedCardsTotal, 4) * 100),
          bonus: 4,
        },
        {
          label: 'Mais de 4,5 cartões',
          prob: Math.round(poissonAtLeast(expectedCardsTotal, 5) * 100),
          bonus: 4,
        },
        {
          label: 'Menos de 4,5 cartões',
          prob: Math.round(poissonAtMost(expectedCardsTotal, 4) * 100),
          bonus: expectedCardsTotal <= 3.2 ? 3 : 0,
        },
        {
          label: 'Menos de 5,5 cartões',
          prob: Math.round(poissonAtMost(expectedCardsTotal, 5) * 100),
          bonus: 2,
        },
        {
          label: 'Menos de 6,5 cartões',
          prob: Math.round(poissonAtMost(expectedCardsTotal, 6) * 100),
          bonus: 0,
        },
      ];

      for (const cc of cardCandidates) {
        if (cc.prob < 58 || cc.prob > 90) continue;
        cardsOptions.push({
          category: 'cards',
          categoryLabel: 'Total de cartões',
          marketLabel: cc.label,
          probabilityPct: cc.prob,
          score: scorePracticalMargin(cc.prob, cc.bonus),
          statHighlight: `Média real ${expectedCardsTotal.toFixed(1).replace('.', ',')} cartões/jogo`,
          rationale: `Súmulas recentes ESPN: ${match.homeName} (${box!.homeCards!.toFixed(1).replace('.', ',')}) + ${match.awayName} (${box!.awayCards!.toFixed(1).replace('.', ',')}) somam ${expectedCardsTotal.toFixed(1).replace('.', ',')} cartões/jogo.`,
        });
      }
      cardsOptions.sort((a, b) => b.score - a.score);
    }

    const cornersOptions: EvaluatedMarket[] = [];
    if (expectedCornersTotal !== null && expectedCornersTotal > 3) {
      const cornerCandidates: { label: string; prob: number; bonus: number }[] = [
        {
          label: 'Mais de 7,5 escanteios',
          prob: Math.round(poissonAtLeast(expectedCornersTotal, 8) * 100),
          bonus: 2,
        },
        {
          label: 'Mais de 8,5 escanteios',
          prob: Math.round(poissonAtLeast(expectedCornersTotal, 9) * 100),
          bonus: 4,
        },
        {
          label: 'Mais de 9,5 escanteios',
          prob: Math.round(poissonAtLeast(expectedCornersTotal, 10) * 100),
          bonus: 4,
        },
        {
          label: 'Menos de 11,5 escanteios',
          prob: Math.round(poissonAtMost(expectedCornersTotal, 11) * 100),
          bonus: 2,
        },
        {
          label: 'Menos de 12,5 escanteios',
          prob: Math.round(poissonAtMost(expectedCornersTotal, 12) * 100),
          bonus: 0,
        },
      ];

      for (const cn of cornerCandidates) {
        if (cn.prob < 58 || cn.prob > 90) continue;
        cornersOptions.push({
          category: 'corners',
          categoryLabel: 'Escanteios',
          marketLabel: cn.label,
          probabilityPct: cn.prob,
          score: scorePracticalMargin(cn.prob, cn.bonus),
          statHighlight: `Média real ${expectedCornersTotal.toFixed(1).replace('.', ',')} esc./jogo`,
          rationale: `Média oficial dos últimos jogos: ${match.homeName} (${box!.homeCorners!.toFixed(1).replace('.', ',')}) + ${match.awayName} (${box!.awayCorners!.toFixed(1).replace('.', ',')}) projetam ${expectedCornersTotal.toFixed(1).replace('.', ',')} escanteios.`,
        });
      }
      cornersOptions.sort((a, b) => b.score - a.score);
    }

    const bestByCategory: MatchMarketProfile['bestByCategory'] = {
      result: resultOptions[0],
      goals: goalsOptions[0],
      btts: bttsOptions[0],
      ...(cardsOptions[0] ? { cards: cardsOptions[0] } : {}),
      ...(cornersOptions[0] ? { corners: cornersOptions[0] } : {}),
    };

    profiles.push({
      ctx,
      expectedCardsTotal,
      expectedCornersTotal,
      bestByCategory,
      allOptionsByCategory: {
        result: resultOptions,
        goals: goalsOptions,
        btts: bttsOptions,
        cards: cardsOptions,
        corners: cornersOptions,
      },
    });
  }

  if (profiles.length === 0) {
    return null;
  }

  const toSuperLeg = (
    profile: MatchMarketProfile,
    opt: EvaluatedMarket
  ): SuperCombinedLeg => {
    const { match, poisson } = profile.ctx;
    return {
      eventId: match.eventId,
      leagueSlug: match.leagueSlug,
      homeTeam: match.homeName,
      awayTeam: match.awayName,
      homeShortCode: match.homeAbbr,
      awayShortCode: match.awayAbbr,
      homeLogoUrl: match.homeLogoUrl,
      awayLogoUrl: match.awayLogoUrl,
      homeColor: match.homeColor,
      awayColor: match.awayColor,
      competition: match.compLabel,
      dateLabel: match.dateLabel,
      marketLabel: opt.marketLabel,
      probabilityPct: opt.probabilityPct,
      expectedGoalsHome: poisson.expectedGoalsHome,
      expectedGoalsAway: poisson.expectedGoalsAway,
      rationale: opt.rationale,
      category: opt.category,
      categoryLabel: opt.categoryLabel,
      statHighlight: opt.statHighlight,
      fairOdd: computeFairOddFromPct(opt.probabilityPct),
      expectedCardsTotal: profile.expectedCardsTotal,
      expectedCornersTotal: profile.expectedCornersTotal,
    };
  };

  // =========================================================================
  // MODE 1: Multi-Match Super Combinada (optimal assignment across core markets)
  // =========================================================================
  const hasAnyCards = profiles.some((p) => Boolean(p.bestByCategory.cards));
  const hasAnyCorners = profiles.some((p) => Boolean(p.bestByCategory.corners));
  const targetCategories: SuperTipMarketCategory[] = hasAnyCards
    ? ['result', 'goals', 'btts', 'cards']
    : hasAnyCorners
      ? ['result', 'goals', 'btts', 'corners']
      : ['result', 'goals', 'btts'];

  let bestAssignment: { profileIdx: number; cat: SuperTipMarketCategory; opt: EvaluatedMarket }[] =
    [];
  let bestAssignmentScore = -Infinity;

  const searchAssignment = (
    catIdx: number,
    usedMatches: Set<number>,
    current: { profileIdx: number; cat: SuperTipMarketCategory; opt: EvaluatedMarket }[],
    scoreSum: number
  ) => {
    if (catIdx >= targetCategories.length) {
      if (scoreSum > bestAssignmentScore) {
        bestAssignmentScore = scoreSum;
        bestAssignment = [...current];
      }
      return;
    }

    const cat = targetCategories[catIdx];
    let branched = false;
    for (let i = 0; i < profiles.length; i++) {
      if (profiles.length >= targetCategories.length && usedMatches.has(i)) continue;
      const opt = profiles[i].bestByCategory[cat];
      if (!opt) continue;
      branched = true;
      usedMatches.add(i);
      current.push({ profileIdx: i, cat, opt });
      searchAssignment(catIdx + 1, usedMatches, current, scoreSum + opt.score);
      current.pop();
      usedMatches.delete(i);
    }

    if (!branched) {
      searchAssignment(catIdx + 1, usedMatches, current, scoreSum - 25);
    }
  };

  searchAssignment(0, new Set<number>(), [], 0);

  const multiMatchLegs: SuperCombinedLeg[] = bestAssignment.map(({ profileIdx, opt }) =>
    toSuperLeg(profiles[profileIdx], opt)
  );

  // If fewer than 4 legs and an unused match has corners, append best corners leg
  if (multiMatchLegs.length < 4 && hasAnyCorners) {
    const usedIds = new Set(multiMatchLegs.map((l) => `${l.leagueSlug}:${l.eventId}`));
    const cornerCandidates = profiles
      .filter((p) => p.bestByCategory.corners && !usedIds.has(`${p.ctx.match.leagueSlug}:${p.ctx.match.eventId}`))
      .sort((a, b) => (b.bestByCategory.corners?.score ?? 0) - (a.bestByCategory.corners?.score ?? 0));
    if (cornerCandidates[0]?.bestByCategory.corners) {
      multiMatchLegs.push(
        toSuperLeg(cornerCandidates[0], cornerCandidates[0].bestByCategory.corners)
      );
    }
  }

  const multiCombinedProduct = multiMatchLegs.reduce(
    (acc, leg) => acc * (leg.probabilityPct / 100),
    1
  );
  const multiRawPct = multiCombinedProduct * 100;
  const multiMatchCombinedPct =
    multiRawPct >= 1 ? Math.round(multiRawPct) : Math.max(0.5, Number(multiRawPct.toFixed(1)));
  const multiMatchAvgPct =
    multiMatchLegs.length > 0
      ? Math.round(
          multiMatchLegs.reduce((acc, leg) => acc + leg.probabilityPct, 0) /
            multiMatchLegs.length
        )
      : 0;
  const multiMatchFairOdd = Number(
    (1 / Math.max(0.01, multiCombinedProduct)).toFixed(2)
  );

  // =========================================================================
  // MODE 2: Same-Game Super Combinada ("Criar Aposta" with exact joint Poisson!)
  // =========================================================================
  const sameGameCombos: SuperSameGameCombo[] = [];

  for (const profile of profiles) {
    const { match, poisson } = profile.ctx;
    const lambdaH = poisson.expectedGoalsHome;
    const lambdaA = poisson.expectedGoalsAway;

    const evalJointProb = (picks: EvaluatedMarket[]): number => {
      const scorePreds = picks.map((p) => p.pred).filter((fn): fn is ScorePred => Boolean(fn));
      let jointGoalProb = 1;
      if (scorePreds.length > 0) {
        let sum = 0;
        for (let i = 0; i <= 8; i++) {
          const ph = poissonPmf(lambdaH, i);
          for (let j = 0; j <= 8; j++) {
            if (scorePreds.every((fn) => fn(i, j))) {
              sum += ph * poissonPmf(lambdaA, j);
            }
          }
        }
        jointGoalProb = sum;
      }
      const indepProb = picks
        .filter((p) => !p.pred)
        .reduce((acc, p) => acc * (p.probabilityPct / 100), 1);

      return jointGoalProb * indepProb;
    };

    const topRes = (profile.allOptionsByCategory.result || []).slice(0, 3);
    const topGoals = (profile.allOptionsByCategory.goals || []).slice(0, 3);
    const topBtts = (profile.allOptionsByCategory.btts || []).slice(0, 2);
    const bestCards = profile.bestByCategory.cards;
    const bestCorners = profile.bestByCategory.corners;

    let bestComboPicks: EvaluatedMarket[] = [];
    let bestComboJoint = 0;
    let bestComboScore = -Infinity;

    const tryCombo = (picks: EvaluatedMarket[]) => {
      if (picks.length < 3) return;
      if (picks.some((p) => p.probabilityPct < 55)) return;
      const joint = evalJointProb(picks);
      const jointPct = joint * 100;
      if (jointPct < 24) return;
      const avgPct =
        picks.reduce((acc, p) => acc + p.probabilityPct, 0) / picks.length;
      const hasCards = picks.some((p) => p.category === 'cards');
      const hasBtts = picks.some((p) => p.category === 'btts');
      // Reward high joint probability, 4-market depth when coherent, and card/btts coverage
      const comboScore =
        jointPct * 1.15 +
        avgPct * 0.4 +
        (picks.length === 4 && jointPct >= 34 ? 10 : 0) +
        (hasCards ? 5 : 0) +
        (hasBtts ? 3 : 0);

      if (comboScore > bestComboScore) {
        bestComboScore = comboScore;
        bestComboJoint = joint;
        bestComboPicks = picks;
      }
    };

    for (const r of topRes) {
      for (const g of topGoals) {
        if (bestCards) {
          tryCombo([r, g, bestCards]);
          for (const b of topBtts) {
            tryCombo([r, g, b, bestCards]);
          }
          if (bestCorners) {
            tryCombo([r, g, bestCards, bestCorners]);
          }
        }
        for (const b of topBtts) {
          tryCombo([r, g, b]);
          if (bestCorners) {
            tryCombo([r, g, b, bestCorners]);
          }
        }
        if (bestCorners) {
          tryCombo([r, g, bestCorners]);
        }
      }
    }

    if (bestComboPicks.length >= 3) {
      const jointPctRaw = bestComboJoint * 100;
      const combinedProbabilityPct = Math.min(
        85,
        Math.max(15, Math.round(jointPctRaw))
      );
      const avgLegProbabilityPct = Math.round(
        bestComboPicks.reduce((acc, p) => acc + p.probabilityPct, 0) /
          bestComboPicks.length
      );
      const fairOddEstimate = Number(
        (100 / Math.max(5, combinedProbabilityPct)).toFixed(2)
      );

      const categoryNames = bestComboPicks.map((p) => p.categoryLabel).join(' + ');

      sameGameCombos.push({
        eventId: match.eventId,
        leagueSlug: match.leagueSlug,
        competition: match.compLabel,
        dateLabel: match.dateLabel,
        homeTeam: match.homeName,
        awayTeam: match.awayName,
        homeShortCode: match.homeAbbr,
        awayShortCode: match.awayAbbr,
        homeLogoUrl: match.homeLogoUrl,
        awayLogoUrl: match.awayLogoUrl,
        homeColor: match.homeColor,
        awayColor: match.awayColor,
        expectedGoalsHome: poisson.expectedGoalsHome,
        expectedGoalsAway: poisson.expectedGoalsAway,
        expectedCardsTotal: profile.expectedCardsTotal,
        expectedCornersTotal: profile.expectedCornersTotal,
        homeWinPct: poisson.homeWinPct,
        drawPct: poisson.drawPct,
        awayWinPct: poisson.awayWinPct,
        picks: bestComboPicks.map((p) => toSuperLeg(profile, p)),
        combinedProbabilityPct,
        avgLegProbabilityPct,
        fairOddEstimate,
        summary: `Combinação coerente (${categoryNames}) com probabilidade conjunta exata na matriz de Poisson.`,
      });
    }
  }

  sameGameCombos.sort(
    (a, b) =>
      b.combinedProbabilityPct +
      b.avgLegProbabilityPct * 0.35 -
      (a.combinedProbabilityPct + a.avgLegProbabilityPct * 0.35)
  );

  const isTodaySlate = todayCount >= 3;
  const scopeLabel =
    todayCount >= 4
      ? 'Jogos de hoje · Campeonatos do mundo'
      : todayCount > 0
        ? 'Jogos de hoje e próximos confrontos · Mundial'
        : 'Próximos jogos · Campeonatos do mundo';

  return {
    updatedAt: new Date().toISOString(),
    scopeLabel,
    isTodaySlate,
    multiMatchLegs,
    multiMatchCombinedPct,
    multiMatchAvgPct,
    multiMatchFairOdd,
    sameGameCombos: sameGameCombos.slice(0, 3),
    sourceUrl: 'https://www.espn.com/soccer/scoreboard',
  };
}

function normalizeTeamText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function evaluateMultipleMarketOutcome(
  marketLabel: string,
  homeTeam: string,
  awayTeam: string,
  homeGoals: number,
  awayGoals: number
): MultipleLegStatus {
  const m = normalizeTeamText(marketLabel);
  const h = normalizeTeamText(homeTeam);
  const a = normalizeTeamText(awayTeam);
  const total = homeGoals + awayGoals;

  // Skip non-goal specialized markets (corners, cards, shots, player props)
  if (
    /(escanteio|corner|cartao|cartoes|card|chute|finalizac|impedimento|falta|handicap|asiatic)/.test(
      m
    )
  ) {
    return 'pending';
  }

  // Over / Mais de X.5 gols
  const overMatch = m.match(/(?:mais de|over|\+)\s*([0-9]+(?:[.,]5)?)\s*gol/);
  if (overMatch) {
    const threshold = parseFloat(overMatch[1].replace(',', '.'));
    if (Number.isFinite(threshold)) {
      return total > threshold ? 'won' : 'lost';
    }
  }
  if (m.includes('mais de 1,5') || m.includes('mais de 1.5')) {
    return total >= 2 ? 'won' : 'lost';
  }
  if (m.includes('mais de 2,5') || m.includes('mais de 2.5')) {
    return total >= 3 ? 'won' : 'lost';
  }

  // Under / Menos de X.5 gols
  const underMatch = m.match(/(?:menos de|under)\s*([0-9]+(?:[.,]5)?)\s*gol/);
  if (underMatch) {
    const threshold = parseFloat(underMatch[1].replace(',', '.'));
    if (Number.isFinite(threshold)) {
      return total < threshold ? 'won' : 'lost';
    }
  }

  // Ambas marcam (BTTS)
  if (m.includes('ambas marcam') || m.includes('ambos marcam') || m.includes('btts')) {
    if (m.includes('nao') || m.includes('no')) {
      return homeGoals === 0 || awayGoals === 0 ? 'won' : 'lost';
    }
    return homeGoals >= 1 && awayGoals >= 1 ? 'won' : 'lost';
  }

  // Dupla chance (1X / X2 / 12 / Casa ou Fora)
  if (
    m.includes('dupla chance') ||
    m.includes('hipotese dupla') ||
    m.includes('ou empate') ||
    m.includes('casa ou fora') ||
    m.includes('sem empate') ||
    /\b(1x|x2|12)\b/.test(m)
  ) {
    if (/\b12\b/.test(m) || m.includes('casa ou fora') || m.includes('sem empate')) {
      return homeGoals !== awayGoals ? 'won' : 'lost';
    }
    if ((h && m.includes(h)) || /\b1x\b/.test(m)) {
      return homeGoals >= awayGoals ? 'won' : 'lost';
    }
    if ((a && m.includes(a)) || /\bx2\b/.test(m)) {
      return awayGoals >= homeGoals ? 'won' : 'lost';
    }
  }

  // Empate (1X2 Draw)
  if (
    m === 'empate' ||
    m === 'x' ||
    m.includes('resultado final: empate') ||
    m.includes('resultado: empate')
  ) {
    return homeGoals === awayGoals ? 'won' : 'lost';
  }

  // Vitória / Resultado final (1X2 Team Win)
  if (
    m.startsWith('vitoria') ||
    m.includes('resultado final') ||
    m.includes('vence') ||
    m === h ||
    m === a
  ) {
    if (h && m.includes(h)) {
      return homeGoals > awayGoals ? 'won' : 'lost';
    }
    if (a && m.includes(a)) {
      return awayGoals > homeGoals ? 'won' : 'lost';
    }
  }

  return 'pending';
}

export interface MultipleLegCheckInput {
  eventId?: string;
  leagueSlug?: string;
  homeTeam: string;
  awayTeam: string;
  marketLabel: string;
}

export interface MultipleLegCheckResult {
  eventId: string;
  leagueSlug: string;
  state?: MatchLiveState;
  clock?: string;
  statusDetail?: string;
  completed: boolean;
  status: MultipleLegStatus;
  actualScore?: {
    homeGoals: number;
    awayGoals: number;
    statusDetail?: string;
  };
}

function formatYyyymmdd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function cleanClubNameForMatch(raw: string): string {
  return normalizeTeamText(raw)
    .replace(/[-_./]+/g, ' ')
    .replace(
      /\b(fc|cf|sc|ec|cr|ac|se|ca|cd|ud|sd|rc|club|clube|esporte|sport|athletic|atletico|de|da|do|dos|das|regatas|futebol|football|real|racing)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreTeamNameMatch(queryName: string, candidateName: string): number {
  const qFull = normalizeTeamText(queryName).replace(/[-_./]+/g, ' ').replace(/\s+/g, ' ').trim();
  const cFull = normalizeTeamText(candidateName).replace(/[-_./]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!qFull || !cFull) return 0;
  if (qFull === cFull) return 100;

  const qClean = cleanClubNameForMatch(queryName) || qFull;
  const cClean = cleanClubNameForMatch(candidateName) || cFull;
  if (qClean === cClean && qClean.length >= 3) return 95;

  if (
    qClean.length >= 4 &&
    cClean.length >= 4 &&
    (cClean.includes(qClean) || qClean.includes(cClean))
  ) {
    return 82;
  }

  if (
    qFull.length >= 4 &&
    cFull.length >= 4 &&
    (cFull.includes(qFull) || qFull.includes(cFull))
  ) {
    return 76;
  }

  const qTokens = qClean.split(' ').filter((t) => t.length >= 3);
  const cTokens = cClean.split(' ').filter((t) => t.length >= 3);
  if (qTokens.length > 0 && cTokens.length > 0) {
    const overlap = qTokens.filter((t) => cTokens.includes(t)).length;
    if (overlap === qTokens.length && overlap === cTokens.length) return 90;
    if (overlap >= 1 && overlap / Math.max(qTokens.length, cTokens.length) >= 0.5) {
      return 68;
    }
  }

  return 0;
}

function extractEspnNumericScore(competitor: any): number | null {
  if (!competitor) return null;
  const raw =
    typeof competitor.score === 'object' && competitor.score !== null
      ? competitor.score.value ?? competitor.score.displayValue
      : competitor.score;
  if (raw === undefined || raw === null || raw === '') return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function formatEspnLiveStatus(
  statusObj: any,
  isoDate?: string
): { state: MatchLiveState; completed: boolean; clock?: string; statusDetail: string } {
  const statusType = statusObj?.type;
  const rawState = String(statusType?.state || '').toLowerCase();
  const typeName = String(statusType?.name || '').toUpperCase();
  const shortDetail = String(statusType?.shortDetail || '').trim();
  const displayClock = String(statusObj?.displayClock || '').trim();
  const period = Number(statusObj?.period || 0);

  const completed = Boolean(statusType?.completed || rawState === 'post');
  if (completed) {
    if (typeName.includes('PEN') || /\bPEN\b|PK/i.test(shortDetail)) {
      return { state: 'post', completed: true, clock: 'FIM', statusDetail: 'Final (Pên.)' };
    }
    if (typeName.includes('AET') || /\bAET\b/i.test(shortDetail)) {
      return { state: 'post', completed: true, clock: 'FIM', statusDetail: 'Final (Prorr.)' };
    }
    return { state: 'post', completed: true, clock: 'FIM', statusDetail: 'Finalizado' };
  }

  if (rawState === 'in') {
    if (typeName.includes('HALFTIME') || /^HT$/i.test(shortDetail)) {
      return { state: 'in', completed: false, clock: 'INT', statusDetail: 'Intervalo' };
    }
    if (typeName.includes('SHOOTOUT')) {
      return { state: 'in', completed: false, clock: 'PEN', statusDetail: 'Pênaltis' };
    }
    const clockStr =
      displayClock && displayClock !== "0'"
        ? displayClock
        : shortDetail && /^\d+/.test(shortDetail)
          ? shortDetail
          : '';
    if (period === 1) {
      return {
        state: 'in',
        completed: false,
        clock: clockStr || '1ºT',
        statusDetail: clockStr ? `1ºT · ${clockStr}` : '1º Tempo',
      };
    }
    if (period === 2) {
      return {
        state: 'in',
        completed: false,
        clock: clockStr || '2ºT',
        statusDetail: clockStr ? `2ºT · ${clockStr}` : '2º Tempo',
      };
    }
    if (period >= 3) {
      return {
        state: 'in',
        completed: false,
        clock: clockStr || 'PROR',
        statusDetail: clockStr ? `Prorr. · ${clockStr}` : 'Prorrogação',
      };
    }
    return {
      state: 'in',
      completed: false,
      clock: clockStr || 'VIVO',
      statusDetail: clockStr ? `Em andamento · ${clockStr}` : 'Em andamento',
    };
  }

  // Scheduled ('pre')
  if (isoDate) {
    const evDate = new Date(isoDate);
    if (!Number.isNaN(evDate.getTime())) {
      return {
        state: 'pre',
        completed: false,
        statusDetail: formatUpcomingKickoffLabel(evDate, 'Agendado'),
      };
    }
  }

  return { state: 'pre', completed: false, statusDetail: 'Agendado' };
}

interface PoolScoreboardEvent {
  eventId: string;
  leagueSlug: string;
  dateIso: string;
  timestamp: number;
  homeNames: string[];
  awayNames: string[];
  homeGoals: number | null;
  awayGoals: number | null;
  status: any;
}

function parseScoreboardEventsIntoPool(
  rawJson: any,
  fallbackSlug: string
): PoolScoreboardEvent[] {
  const events: any[] = rawJson?.events || [];
  const out: PoolScoreboardEvent[] = [];

  for (const ev of events) {
    const comp = ev?.competitions?.[0];
    if (!comp) continue;
    const competitors: any[] = comp?.competitors || [];
    const home = competitors.find((c) => c.homeAway === 'home');
    const away = competitors.find((c) => c.homeAway === 'away');
    if (!home || !away) continue;

    const dateIso = ev.date || comp.date || '';
    const ts = new Date(dateIso).getTime();
    const homeNames = [
      home.team?.displayName,
      home.team?.shortDisplayName,
      home.team?.name,
      home.team?.location,
    ].filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    const awayNames = [
      away.team?.displayName,
      away.team?.shortDisplayName,
      away.team?.name,
      away.team?.location,
    ].filter((s): s is string => typeof s === 'string' && s.trim().length > 0);

    const slugFromEv =
      ev?.league?.slug ||
      comp?.league?.slug ||
      rawJson?.leagues?.[0]?.slug ||
      fallbackSlug;

    out.push({
      eventId: String(ev.id || comp.id || ''),
      leagueSlug: slugFromEv || 'all',
      dateIso,
      timestamp: Number.isFinite(ts) ? ts : 0,
      homeNames,
      awayNames,
      homeGoals: extractEspnNumericScore(home),
      awayGoals: extractEspnNumericScore(away),
      status: comp.status || ev.status,
    });
  }

  return out;
}

function findBestPoolMatch(
  item: LiveScoreQueryItem,
  pool: PoolScoreboardEvent[]
): { event: PoolScoreboardEvent; swapped: boolean } | null {
  let best: { event: PoolScoreboardEvent; swapped: boolean; score: number } | null = null;
  const hintTs = item.dateHint ? new Date(item.dateHint).getTime() : Date.now();

  for (const ev of pool) {
    const hDirect = Math.max(
      0,
      ...ev.homeNames.map((n) => scoreTeamNameMatch(item.homeTeam, n))
    );
    const aDirect = Math.max(
      0,
      ...ev.awayNames.map((n) => scoreTeamNameMatch(item.awayTeam, n))
    );

    const hSwap = Math.max(
      0,
      ...ev.awayNames.map((n) => scoreTeamNameMatch(item.homeTeam, n))
    );
    const aSwap = Math.max(
      0,
      ...ev.homeNames.map((n) => scoreTeamNameMatch(item.awayTeam, n))
    );

    let swapped = false;
    let combined = 0;

    if (hDirect >= 68 && aDirect >= 68) {
      combined = hDirect + aDirect + 10;
      swapped = false;
    } else if (hSwap >= 76 && aSwap >= 76) {
      combined = hSwap + aSwap;
      swapped = true;
    } else {
      continue;
    }

    // Guard against attaching stale matches from months earlier/later
    const state = String(ev.status?.type?.state || '').toLowerCase();
    const DAY_MS = 1000 * 60 * 60 * 24;
    if (ev.timestamp > 0 && Number.isFinite(hintTs)) {
      const signedDiffDays = (ev.timestamp - hintTs) / DAY_MS;
      if (state === 'post') {
        // Completed match must have occurred near or shortly after the saved prediction
        if (signedDiffDays < -3 || signedDiffDays > 16) continue;
      } else if (state === 'pre') {
        if (signedDiffDays < -1 || signedDiffDays > 30) continue;
      } else if (state === 'in') {
        if (Math.abs(signedDiffDays) > 30) continue;
      }

      const absDiffDays = Math.abs(signedDiffDays);
      if (absDiffDays <= 2) combined += 15;
      else if (absDiffDays <= 7) combined += 6;
      else combined -= Math.min(20, absDiffDays);
    }

    // Prefer live matches first
    if (state === 'in') combined += 25;

    if (!best || combined > best.score) {
      best = { event: ev, swapped, score: combined };
    }
  }

  return best ? { event: best.event, swapped: best.swapped } : null;
}

export async function fetchLiveScoresViaEspn(
  items: LiveScoreQueryItem[]
): Promise<LiveScoreMatchResult[]> {
  const nowIso = new Date().toISOString();
  const bounded = items.slice(0, 35);
  const resultsByKey = new Map<string, LiveScoreMatchResult>();

  // Tier 1: Direct Event Summary lookup for items that already carry eventId
  const directItems = bounded.filter((i) => i.eventId);
  const uniqueDirect = Array.from(
    new Map(
      directItems.map((i) => [`${i.leagueSlug || 'all'}:${i.eventId}`, i])
    ).values()
  );

  const summaryByPair = new Map<string, any>();
  await Promise.all(
    uniqueDirect.map(async (item) => {
      const eventId = String(item.eventId);
      const slug =
        item.leagueSlug &&
        item.leagueSlug !== 'today' &&
        item.leagueSlug !== 'tomorrow' &&
        item.leagueSlug !== 'world'
          ? item.leagueSlug
          : 'all';

      let json = await fetchJson<any>(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(
          slug
        )}/summary?event=${encodeURIComponent(eventId)}`,
        6500
      );

      if (!json?.header?.competitions?.[0] && slug !== 'all') {
        json = await fetchJson<any>(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${encodeURIComponent(
            eventId
          )}`,
          6500
        );
      }

      if (json?.header?.competitions?.[0]) {
        summaryByPair.set(`${item.leagueSlug || 'all'}:${eventId}`, json);
      }
    })
  );

  for (const item of directItems) {
    const pairKey = `${item.leagueSlug || 'all'}:${item.eventId}`;
    const summary = summaryByPair.get(pairKey);
    const comp = summary?.header?.competitions?.[0];
    if (!comp) continue;

    const statusInfo = formatEspnLiveStatus(comp.status, comp.date);
    const competitors: any[] = comp.competitors || [];
    const home = competitors.find((c) => c.homeAway === 'home');
    const away = competitors.find((c) => c.homeAway === 'away');
    const homeGoals = extractEspnNumericScore(home);
    const awayGoals = extractEspnNumericScore(away);

    const hasScore =
      (statusInfo.state === 'in' || statusInfo.state === 'post') &&
      homeGoals !== null &&
      awayGoals !== null;

    const marketStatus: MultipleLegStatus | undefined =
      item.marketLabel && statusInfo.completed && hasScore
        ? evaluateMultipleMarketOutcome(
            item.marketLabel,
            item.homeTeam,
            item.awayTeam,
            homeGoals,
            awayGoals
          )
        : undefined;

    resultsByKey.set(item.key, {
      key: item.key,
      found: true,
      state: statusInfo.state,
      completed: statusInfo.completed,
      homeGoals: hasScore ? homeGoals : undefined,
      awayGoals: hasScore ? awayGoals : undefined,
      clock: statusInfo.clock,
      statusDetail: statusInfo.statusDetail,
      eventId: String(item.eventId),
      leagueSlug: item.leagueSlug,
      sourceLabel: 'ESPN',
      marketStatus,
      updatedAt: nowIso,
    });
  }

  // Tier 2: Global 3-day Scoreboard + specific league scoreboards for items without eventId (or missed in Tier 1)
  const unresolvedAfterTier1 = bounded.filter((i) => !resultsByKey.has(i.key));
  if (unresolvedAfterTier1.length > 0) {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const targetSlugs = Array.from(
      new Set(
        unresolvedAfterTier1
          .map((i) => {
            if (
              i.leagueSlug &&
              i.leagueSlug !== 'today' &&
              i.leagueSlug !== 'tomorrow' &&
              i.leagueSlug !== 'world'
            ) {
              return i.leagueSlug;
            }
            return resolveLeagueSlug(i.competition || '');
          })
          .filter((s): s is string => Boolean(s))
      )
    ).slice(0, 6);

    const scoreboardUrls: { url: string; slug: string }[] = [
      {
        url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard',
        slug: 'all',
      },
      {
        url: `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${formatYyyymmdd(
          yesterday
        )}`,
        slug: 'all',
      },
      {
        url: `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${formatYyyymmdd(
          tomorrow
        )}`,
        slug: 'all',
      },
      ...targetSlugs.map((slug) => ({
        url: `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(
          slug
        )}/scoreboard`,
        slug,
      })),
    ];

    const boards = await Promise.all(
      scoreboardUrls.map(async (entry) => ({
        slug: entry.slug,
        json: await fetchJson<any>(entry.url, 6500),
      }))
    );

    const seenEvIds = new Set<string>();
    const pool: PoolScoreboardEvent[] = [];
    for (const board of boards) {
      if (!board.json) continue;
      for (const ev of parseScoreboardEventsIntoPool(board.json, board.slug)) {
        if (ev.eventId && seenEvIds.has(ev.eventId)) continue;
        if (ev.eventId) seenEvIds.add(ev.eventId);
        pool.push(ev);
      }
    }

    for (const item of unresolvedAfterTier1) {
      const matched = findBestPoolMatch(item, pool);
      if (!matched) continue;

      const { event, swapped } = matched;
      const statusInfo = formatEspnLiveStatus(event.status, event.dateIso);
      const rawHome = swapped ? event.awayGoals : event.homeGoals;
      const rawAway = swapped ? event.homeGoals : event.awayGoals;
      const hasScore =
        (statusInfo.state === 'in' || statusInfo.state === 'post') &&
        rawHome !== null &&
        rawAway !== null;

      const marketStatus: MultipleLegStatus | undefined =
        item.marketLabel && statusInfo.completed && hasScore
          ? evaluateMultipleMarketOutcome(
              item.marketLabel,
              item.homeTeam,
              item.awayTeam,
              rawHome,
              rawAway
            )
          : undefined;

      resultsByKey.set(item.key, {
        key: item.key,
        found: true,
        state: statusInfo.state,
        completed: statusInfo.completed,
        homeGoals: hasScore ? rawHome : undefined,
        awayGoals: hasScore ? rawAway : undefined,
        clock: statusInfo.clock,
        statusDetail: statusInfo.statusDetail,
        eventId: event.eventId || item.eventId,
        leagueSlug: event.leagueSlug !== 'all' ? event.leagueSlug : item.leagueSlug,
        sourceLabel: 'ESPN',
        marketStatus,
        updatedAt: nowIso,
      });
    }
  }

  // Tier 3: Team Schedule lookup for remaining unresolved items (e.g., matches from earlier this week)
  const unresolvedAfterTier2 = bounded
    .filter((i) => !resultsByKey.has(i.key))
    .slice(0, 6);

  if (unresolvedAfterTier2.length > 0) {
    await Promise.all(
      unresolvedAfterTier2.map(async (item) => {
        const preferredSlug =
          item.leagueSlug &&
          item.leagueSlug !== 'today' &&
          item.leagueSlug !== 'tomorrow' &&
          item.leagueSlug !== 'world'
            ? item.leagueSlug
            : resolveLeagueSlug(item.competition || '');

        const team = await searchEspnTeam(item.homeTeam, preferredSlug);
        if (!team) return;

        const scheduleLeague = preferredSlug || team.defaultLeagueSlug || 'bra.1';
        let schedJson = await fetchJson<any>(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(
            scheduleLeague
          )}/teams/${encodeURIComponent(team.id)}/schedule`,
          6500
        );

        if ((!schedJson?.events || schedJson.events.length === 0) && scheduleLeague !== team.defaultLeagueSlug) {
          schedJson = await fetchJson<any>(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(
              team.defaultLeagueSlug
            )}/teams/${encodeURIComponent(team.id)}/schedule`,
            6500
          );
        }

        if (!schedJson?.events?.length) return;
        const teamPool = parseScoreboardEventsIntoPool(schedJson, scheduleLeague);
        const matched = findBestPoolMatch(item, teamPool);
        if (!matched) return;

        let { event, swapped } = matched;
        // If live or recently started, refine via live summary endpoint for up-to-the-minute clock
        const rawState = String(event.status?.type?.state || '').toLowerCase();
        if (rawState === 'in' && event.eventId) {
          const liveSummary = await fetchJson<any>(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${encodeURIComponent(
              event.eventId
            )}`,
            5000
          );
          const liveComp = liveSummary?.header?.competitions?.[0];
          if (liveComp) {
            const comps: any[] = liveComp.competitors || [];
            const hComp = comps.find((c) => c.homeAway === 'home');
            const aComp = comps.find((c) => c.homeAway === 'away');
            event = {
              ...event,
              status: liveComp.status || event.status,
              homeGoals: extractEspnNumericScore(hComp) ?? event.homeGoals,
              awayGoals: extractEspnNumericScore(aComp) ?? event.awayGoals,
            };
          }
        }

        const statusInfo = formatEspnLiveStatus(event.status, event.dateIso);
        const rawHome = swapped ? event.awayGoals : event.homeGoals;
        const rawAway = swapped ? event.homeGoals : event.awayGoals;
        const hasScore =
          (statusInfo.state === 'in' || statusInfo.state === 'post') &&
          rawHome !== null &&
          rawAway !== null;

        const marketStatus: MultipleLegStatus | undefined =
          item.marketLabel && statusInfo.completed && hasScore
            ? evaluateMultipleMarketOutcome(
                item.marketLabel,
                item.homeTeam,
                item.awayTeam,
                rawHome,
                rawAway
              )
            : undefined;

        resultsByKey.set(item.key, {
          key: item.key,
          found: true,
          state: statusInfo.state,
          completed: statusInfo.completed,
          homeGoals: hasScore ? rawHome : undefined,
          awayGoals: hasScore ? rawAway : undefined,
          clock: statusInfo.clock,
          statusDetail: statusInfo.statusDetail,
          eventId: event.eventId || item.eventId,
          leagueSlug: event.leagueSlug !== 'all' ? event.leagueSlug : scheduleLeague,
          sourceLabel: 'ESPN',
          marketStatus,
          updatedAt: nowIso,
        });
      })
    );
  }

  return bounded.map(
    (item) =>
      resultsByKey.get(item.key) ?? {
        key: item.key,
        found: false,
        state: 'pre',
        completed: false,
        statusDetail: 'Sem atualização ao vivo',
        eventId: item.eventId,
        leagueSlug: item.leagueSlug,
        sourceLabel: 'ESPN',
        updatedAt: nowIso,
      }
  );
}

export async function checkMultipleLegsResultsViaEspn(
  legs: MultipleLegCheckInput[]
): Promise<MultipleLegCheckResult[]> {
  const queryItems: LiveScoreQueryItem[] = legs.map((leg, idx) => ({
    key: `leg:${idx}`,
    eventId: leg.eventId,
    leagueSlug: leg.leagueSlug,
    homeTeam: leg.homeTeam,
    awayTeam: leg.awayTeam,
    marketLabel: leg.marketLabel,
  }));

  const resolved = await fetchLiveScoresViaEspn(queryItems);

  return legs.map((leg, idx) => {
    const res = resolved[idx];
    const hasScore =
      res &&
      res.found &&
      typeof res.homeGoals === 'number' &&
      typeof res.awayGoals === 'number';

    return {
      eventId: String(res?.eventId || leg.eventId || ''),
      leagueSlug: String(res?.leagueSlug || leg.leagueSlug || ''),
      state: res?.state,
      clock: res?.clock,
      statusDetail: res?.statusDetail,
      completed: Boolean(res?.completed),
      status: res?.completed && res.marketStatus ? res.marketStatus : 'pending',
      actualScore: hasScore
        ? {
            homeGoals: res.homeGoals!,
            awayGoals: res.awayGoals!,
            statusDetail: res.statusDetail,
          }
        : undefined,
    };
  });
}

function makeShortCodeFallback(name: string): string {
  const letters = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
  return (letters || 'TIM').slice(0, 3);
}

/**
 * Enriches bet slip legs extracted from an image with official ESPN club crests,
 * short codes, club colors, and normalized competition slugs.
 */
export async function enrichParsedBetLegsViaEspn(
  legs: ParsedBetSlipLeg[]
): Promise<ParsedBetSlipLeg[]> {
  if (!Array.isArray(legs) || legs.length === 0) return [];

  const bounded = legs.slice(0, 15);
  const uniqueTeamQueries = new Map<string, { name: string; preferredSlug: string | null }>();

  for (const leg of bounded) {
    const preferredSlug = leg.leagueSlug || resolveLeagueSlug(leg.competition || '');
    const hKey = leg.homeTeam.trim().toLowerCase();
    const aKey = leg.awayTeam.trim().toLowerCase();
    if (hKey && !uniqueTeamQueries.has(hKey)) {
      uniqueTeamQueries.set(hKey, { name: leg.homeTeam.trim(), preferredSlug });
    }
    if (aKey && !uniqueTeamQueries.has(aKey)) {
      uniqueTeamQueries.set(aKey, { name: leg.awayTeam.trim(), preferredSlug });
    }
  }

  const teamCache = new Map<string, EspnSearchTeam | null>();
  await Promise.all(
    Array.from(uniqueTeamQueries.entries()).map(async ([key, q]) => {
      try {
        const found = await searchEspnTeam(q.name, q.preferredSlug);
        teamCache.set(key, found);
      } catch {
        teamCache.set(key, null);
      }
    })
  );

  return bounded.map((leg) => {
    const hInfo = teamCache.get(leg.homeTeam.trim().toLowerCase());
    const aInfo = teamCache.get(leg.awayTeam.trim().toLowerCase());
    const resolvedSlug =
      leg.leagueSlug ||
      resolveLeagueSlug(leg.competition || '') ||
      (hInfo?.defaultLeagueSlug && hInfo.defaultLeagueSlug === aInfo?.defaultLeagueSlug
        ? hInfo.defaultLeagueSlug
        : hInfo?.defaultLeagueSlug || aInfo?.defaultLeagueSlug || undefined);

    return {
      ...leg,
      homeShortCode:
        hInfo?.abbreviation ||
        leg.homeShortCode ||
        makeShortCodeFallback(leg.homeTeam),
      awayShortCode:
        aInfo?.abbreviation ||
        leg.awayShortCode ||
        makeShortCodeFallback(leg.awayTeam),
      homeLogoUrl: hInfo?.logoUrl || leg.homeLogoUrl,
      awayLogoUrl: aInfo?.logoUrl || leg.awayLogoUrl,
      homeColor: hInfo?.color || leg.homeColor || '#0F766E',
      awayColor: aInfo?.color || leg.awayColor || '#1D4ED8',
      leagueSlug: resolvedSlug,
    };
  });
}

function moneylineToDecimal(ml: unknown): number | null {
  const num = typeof ml === 'number' ? ml : Number(ml);
  if (!Number.isFinite(num) || num === 0) return null;
  if (num >= 100) {
    return Number((1 + num / 100).toFixed(2));
  }
  if (num <= -100) {
    return Number((1 + 100 / Math.abs(num)).toFixed(2));
  }
  return null;
}

function calibrateOddFromProb(probPct: number, marginPct: number): number {
  const safeProb = Math.max(4, Math.min(93, probPct)) / 100;
  const marginFactor = 1 + Math.max(0, Math.min(20, marginPct)) / 100;
  const raw = 1 / (safeProb * marginFactor);
  return Number(Math.max(1.04, Math.min(18.0, raw)).toFixed(2));
}

export async function fetchTodayBettingMatchesViaEspn(options?: {
  oddsMarginPct?: number;
  includeLive?: boolean;
  favoriteLeagues?: string[];
}): Promise<DailyBetsResponse> {
  const oddsMarginPct = Math.max(0, Math.min(20, Number(options?.oddsMarginPct ?? 5)));
  const includeLive = options?.includeLive !== false;
  const favSlugs = Array.isArray(options?.favoriteLeagues)
    ? options.favoriteLeagues.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  const favSet = new Set(favSlugs);

  const nowDate = new Date();
  const now = nowDate.getTime();
  const todayBrtIso = BRT_DAY_FORMATTER.format(nowDate);
  const tomorrowBrtIso = BRT_DAY_FORMATTER.format(new Date(now + 24 * 60 * 60 * 1000));
  const todayYmd = todayBrtIso.replace(/-/g, '');
  const tomorrowYmd = tomorrowBrtIso.replace(/-/g, '');

  const leagueBoardsToScan = Array.from(
    new Set([...favSlugs, ...TODAY_ALL_LEAGUES.slice(0, 22)])
  ).slice(0, 26);

  const [globalTodayBoard, globalTomorrowBoard, leagueBoards] = await Promise.all([
    fetchJson<any>(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${todayYmd}`,
      7000
    ),
    fetchJson<any>(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${tomorrowYmd}`,
      7000
    ),
    Promise.all(
      leagueBoardsToScan.map(async (slug) => {
        const json = await fetchJson<any>(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${todayYmd}`,
          5500
        );
        return { slug, json };
      })
    ),
  ]);

  const rawGlobalEvents: any[] = [];
  for (const board of [globalTodayBoard, globalTomorrowBoard]) {
    for (const ev of board?.events || []) {
      rawGlobalEvents.push(ev);
    }
  }
  await resolveLeagueMetaForGlobalEvents(rawGlobalEvents);

  interface TodayRawCandidate {
    eventId: string;
    leagueSlug: string;
    competition: string;
    tier: 1 | 2 | 3;
    isFav: boolean;
    timestamp: number;
    kickoffIso: string;
    dateLabel: string;
    state: MatchLiveState;
    clock?: string;
    statusDetail: string;
    homeId: string;
    homeName: string;
    homeAbbr: string;
    homeColor: string;
    homeLogoUrl?: string;
    awayId: string;
    awayName: string;
    awayAbbr: string;
    awayColor: string;
    awayLogoUrl?: string;
    homeScore?: number;
    awayScore?: number;
    espnOdds?: {
      home?: number | null;
      draw?: number | null;
      away?: number | null;
    };
  }

  const candidateMap = new Map<string, TodayRawCandidate>();

  const registerEvent = (ev: any, forcedSlug?: string) => {
    const eventId = String(ev?.id || '');
    if (!eventId) return;

    const comp = ev?.competitions?.[0];
    const statusType = comp?.status?.type;
    const stateRaw = statusType?.state;
    const completed = Boolean(statusType?.completed);
    if (completed || stateRaw === 'post') return;

    const state: MatchLiveState = stateRaw === 'in' ? 'in' : 'pre';
    if (state === 'in' && !includeLive) return;

    const evDate = ev?.date ? new Date(ev.date) : null;
    const timestamp = evDate && !Number.isNaN(evDate.getTime()) ? evDate.getTime() : 0;
    if (!timestamp) return;
    if (state === 'pre' && timestamp < now - 20 * 60 * 1000) return;

    const evBrtDay = evDate ? BRT_DAY_FORMATTER.format(evDate) : '';
    if (evBrtDay !== todayBrtIso && state !== 'in') return;

    const lid = parseLeagueIdFromUid(ev?.uid);
    const meta = lid ? leagueIdMetaCache.get(lid) : undefined;
    const slug = forcedSlug || meta?.slug || '';
    if (!slug || isExcludedAmateurLeague(slug)) return;

    const competitors = comp?.competitors || [];
    const home = competitors.find((c: any) => c.homeAway === 'home');
    const away = competitors.find((c: any) => c.homeAway === 'away');
    if (!home?.team?.id || !away?.team?.id) return;

    const homeName = home.team.displayName || home.team.shortDisplayName || '';
    const awayName = away.team.displayName || away.team.shortDisplayName || '';
    if (!homeName || !awayName || /\btbd\b/i.test(homeName) || /\btbd\b/i.test(awayName)) {
      return;
    }

    const oddsBlock = Array.isArray(comp?.odds) ? comp.odds[0] : null;
    const espnHomeOdd = moneylineToDecimal(oddsBlock?.homeTeamOdds?.moneyLine);
    const espnAwayOdd = moneylineToDecimal(oddsBlock?.awayTeamOdds?.moneyLine);
    const espnDrawOdd = moneylineToDecimal(oddsBlock?.drawOdds?.moneyLine);

    const timeStr = evDate
      ? new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
        }).format(evDate)
      : '';
    const clock = statusType?.shortDetail || undefined;
    const dateLabel =
      state === 'in' ? `Ao vivo · ${clock || 'Em jogo'}` : `Hoje · ${timeStr}`;

    const homeScoreNum =
      state === 'in' && home?.score !== undefined ? Number(home.score) : undefined;
    const awayScoreNum =
      state === 'in' && away?.score !== undefined ? Number(away.score) : undefined;

    const compLabel = LEAGUE_LABELS[slug] || meta?.name || slug.toUpperCase();

    if (!candidateMap.has(eventId)) {
      candidateMap.set(eventId, {
        eventId,
        leagueSlug: slug,
        competition: compLabel,
        tier: getLeaguePriorityTier(slug),
        isFav: favSet.has(slug),
        timestamp,
        kickoffIso: evDate ? evDate.toISOString() : new Date(timestamp).toISOString(),
        dateLabel,
        state,
        clock,
        statusDetail: String(statusType?.detail || statusType?.shortDetail || 'Agendado'),
        homeId: String(home.team.id),
        homeName,
        homeAbbr: (home.team.abbreviation || homeName || 'MAN').slice(0, 3).toUpperCase(),
        homeColor: sanitizeHex(home.team.color, '#0F766E'),
        homeLogoUrl: extractTeamLogoUrl(home.team),
        awayId: String(away.team.id),
        awayName,
        awayAbbr: (away.team.abbreviation || awayName || 'VIS').slice(0, 3).toUpperCase(),
        awayColor: sanitizeHex(away.team.color, '#1D4ED8'),
        awayLogoUrl: extractTeamLogoUrl(away.team),
        homeScore: Number.isFinite(homeScoreNum) ? homeScoreNum : undefined,
        awayScore: Number.isFinite(awayScoreNum) ? awayScoreNum : undefined,
        espnOdds:
          espnHomeOdd || espnAwayOdd || espnDrawOdd
            ? { home: espnHomeOdd, draw: espnDrawOdd, away: espnAwayOdd }
            : undefined,
      });
    }
  };

  for (const ev of rawGlobalEvents) {
    registerEvent(ev);
  }
  for (const { slug, json } of leagueBoards) {
    for (const ev of json?.events || []) {
      registerEvent(ev, slug);
    }
  }

  const allCandidates = Array.from(candidateMap.values()).sort((a, b) => {
    if (a.state !== b.state) return a.state === 'in' ? -1 : 1;
    if (a.isFav !== b.isFav) return a.isFav ? -1 : 1;
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.timestamp - b.timestamp;
  });

  // Compute full Poisson model for up to 22 top matches to maintain fast API response
  const statsSlice = allCandidates.slice(0, 22);
  const involvedLeagues = Array.from(new Set(statsSlice.map((m) => m.leagueSlug)));
  const teamPairs = Array.from(
    new Map(
      statsSlice.flatMap((m) => [
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
          5500
        );
        return [slug, json] as const;
      })
    ),
    Promise.all(
      teamPairs.map(async ([key, pair]) => {
        const json = await fetchTeamScheduleWithAllFallback(pair.slug, pair.teamId);
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

  const defaultYear = String(nowDate.getFullYear());
  const matches: DailyBetOddsMatch[] = [];

  for (const m of allCandidates.slice(0, 36)) {
    const homeRaw = scheduleMap.get(`${m.leagueSlug}:${m.homeId}`);
    const awayRaw = scheduleMap.get(`${m.leagueSlug}:${m.awayId}`);

    let homeWinPct = 43;
    let drawPct = 28;
    let awayWinPct = 29;
    let over25Pct = 51;
    let bttsPct = 52;
    let expectedGoalsHome = 1.42;
    let expectedGoalsAway = 1.12;

    if (homeRaw || awayRaw) {
      const homeEvents = parseScheduleEvents(homeRaw, m.homeId, m.competition)
        .filter((e) => e.completed)
        .sort((a, b) => b.timestamp - a.timestamp);
      const awayEvents = parseScheduleEvents(awayRaw, m.awayId, m.competition)
        .filter((e) => e.completed)
        .sort((a, b) => b.timestamp - a.timestamp);

      const buildStandingLocal = (teamId: string, events: ParsedScheduleEvent[]): TeamStandingsStats => {
        const entries = standingsEntriesByLeague.get(m.leagueSlug) || [];
        const entry = entries.find((e) => String(e?.team?.id) === String(teamId));
        const fallback = buildStandingsFromSchedule(events);
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

      const analysisData: MatchAnalysisData = {
        competition: m.competition,
        season: defaultYear,
        matchDateInfo: m.dateLabel,
        homeTeam: {
          name: m.homeName,
          shortCode: m.homeAbbr,
          primaryColor: m.homeColor,
          secondaryColor: '#FFFFFF',
        },
        awayTeam: {
          name: m.awayName,
          shortCode: m.awayAbbr,
          primaryColor: m.awayColor,
          secondaryColor: '#FFFFFF',
        },
        module1LastFive: {
          home: buildLastFiveStats(homeEvents, m.competition),
          away: buildLastFiveStats(awayEvents, m.competition),
        },
        module2HeadToHead: {
          totalMatchesAnalyzed: 0,
          homeTeamWins: 0,
          awayTeamWins: 0,
          draws: 0,
          avgGoalsPerMatch: null,
          recentMatches: [],
        },
        module3Standings: {
          home: buildStandingLocal(m.homeId, homeEvents),
          away: buildStandingLocal(m.awayId, awayEvents),
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
            restDays: null,
            recentCoachChange: null,
            formNote: null,
          },
          awayTeamContext: {
            absencesAndSuspensions: [],
            restDays: null,
            recentCoachChange: null,
            formNote: null,
          },
          contextualImpactHome: 0,
          contextualImpactAway: 0,
        },
        dataWarnings: [],
      };

      const poisson = calculatePoissonModel(analysisData);
      homeWinPct = poisson.homeWinPct;
      drawPct = poisson.drawPct;
      awayWinPct = poisson.awayWinPct;
      over25Pct = poisson.over25Pct;
      bttsPct = poisson.bttsPct;
      expectedGoalsHome = poisson.expectedGoalsHome;
      expectedGoalsAway = poisson.expectedGoalsAway;
    }

    const hasEspnMoneyline = Boolean(
      m.espnOdds?.home && m.espnOdds?.away && m.espnOdds?.draw
    );

    const odds = {
      home:
        m.espnOdds?.home ?? calibrateOddFromProb(homeWinPct, oddsMarginPct),
      draw:
        m.espnOdds?.draw ?? calibrateOddFromProb(drawPct, oddsMarginPct),
      away:
        m.espnOdds?.away ?? calibrateOddFromProb(awayWinPct, oddsMarginPct),
      over25: calibrateOddFromProb(over25Pct, oddsMarginPct),
      btts: calibrateOddFromProb(bttsPct, oddsMarginPct),
    };

    const marketCandidates = [
      {
        label: `Vitória ${m.homeName}`,
        probPct: homeWinPct,
        odd: odds.home,
      },
      {
        label: 'Empate',
        probPct: drawPct,
        odd: odds.draw,
      },
      {
        label: `Vitória ${m.awayName}`,
        probPct: awayWinPct,
        odd: odds.away,
      },
      {
        label: 'Mais de 2,5 gols',
        probPct: over25Pct,
        odd: odds.over25,
      },
      {
        label: 'Ambas marcam: Sim',
        probPct: bttsPct,
        odd: odds.btts,
      },
    ].sort((a, b) => b.probPct - a.probPct);

    const topPick = marketCandidates[0];

    matches.push({
      eventId: m.eventId,
      leagueSlug: m.leagueSlug,
      competition: m.competition,
      dateLabel: m.dateLabel,
      kickoffIso: m.kickoffIso,
      timestamp: m.timestamp,
      state: m.state,
      clock: m.clock,
      statusDetail: m.statusDetail,
      homeTeam: m.homeName,
      awayTeam: m.awayName,
      homeShortCode: m.homeAbbr,
      awayShortCode: m.awayAbbr,
      homeLogoUrl: m.homeLogoUrl,
      awayLogoUrl: m.awayLogoUrl,
      homeColor: m.homeColor,
      awayColor: m.awayColor,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      expectedGoalsHome,
      expectedGoalsAway,
      probabilities: {
        homeWinPct,
        drawPct,
        awayWinPct,
        over25Pct,
        bttsPct,
      },
      odds,
      oddsSource: hasEspnMoneyline ? 'espn_model' : 'poisson_calibrated',
      recommendedMarket: topPick.label,
      recommendedOdd: topPick.odd,
      recommendedProbPct: topPick.probPct,
    });
  }

  const formattedToday = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(nowDate);

  return {
    dateLabel: formattedToday,
    updatedAt: new Date().toISOString(),
    oddsMarginPct,
    totalMatches: matches.length,
    matches,
  };
}

