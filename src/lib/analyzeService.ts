import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import type {
  AnalysisResponsePayload,
  ChampionshipScope,
  GroundingSource,
  LiveScoreMatchResult,
  LiveScoreQueryItem,
  MatchAnalysisData,
  MatchLiveState,
  MultipleDayFilter,
  MultipleLegStatus,
  MultipleTipStatus,
  ParsedBetSlipLeg,
  ParsedBetSlipResponse,
  SerieAMultipleTip,
  SuggestedFixture,
  SuperCombinedTip,
} from '../types/football.js';
import {
  analyzeMatchViaEspn,
  buildMultipleTipViaEspn,
  buildSuperCombinedTipViaEspn,
  checkMultipleLegsResultsViaEspn,
  enrichParsedBetLegsViaEspn,
  evaluateMultipleMarketOutcome,
  fetchEspnLiveFixtures,
  fetchLiveScoresViaEspn,
  type MultipleLegCheckInput,
  type MultipleLegCheckResult,
} from './espnProvider.js';
import { parseBetSlipOcrText } from './betSlipTextParser.js';
import { MULTIPLE_COMPETITION_SET } from './competitions.js';

const FIXTURES_TTL_MS = 30 * 60 * 1000;
const ANALYSIS_TTL_MS = 15 * 60 * 1000;
const MULTIPLE_TTL_MS = 30 * 60 * 1000;
const LIVE_SCORE_TTL_MS = 20 * 1000;

const fixturesCache = new Map<
  ChampionshipScope,
  { fixtures: SuggestedFixture[]; updatedAt: string; expiresAt: number }
>();

const analysisCache = new Map<
  string,
  { payload: AnalysisResponsePayload; expiresAt: number }
>();

const multipleCache = new Map<
  string,
  { tip: SerieAMultipleTip; expiresAt: number }
>();

let superCombinedCache: { tip: SuperCombinedTip; expiresAt: number } | null = null;

const liveScoreCache = new Map<
  string,
  { result: LiveScoreMatchResult; expiresAt: number }
>();

export function resolveGeminiApiKey(): string | null {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.VITE_GEMINI_API_KEY,
    process.env.API_KEY,
  ];
  for (const val of candidates) {
    const trimmed = typeof val === 'string' ? val.trim() : '';
    if (trimmed && trimmed !== 'MY_GEMINI_API_KEY') {
      return trimmed;
    }
  }
  return null;
}

function getAiClient(): GoogleGenAI {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractGroundingSources(response: any): GroundingSource[] {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const sources: GroundingSource[] = [];
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    const title = chunk?.web?.title;
    if (uri && typeof uri === 'string' && !seen.has(uri)) {
      seen.add(uri);
      sources.push({
        uri,
        title: typeof title === 'string' && title.trim() ? title.trim() : new URL(uri).hostname,
      });
    }
  }
  return sources.slice(0, 8);
}

const matchAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    competition: { type: Type.STRING },
    season: { type: Type.STRING },
    matchDateInfo: { type: Type.STRING, nullable: true },
    homeTeam: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        shortCode: { type: Type.STRING },
        primaryColor: { type: Type.STRING },
        secondaryColor: { type: Type.STRING },
      },
      required: ['name', 'shortCode', 'primaryColor', 'secondaryColor'],
    },
    awayTeam: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        shortCode: { type: Type.STRING },
        primaryColor: { type: Type.STRING },
        secondaryColor: { type: Type.STRING },
      },
      required: ['name', 'shortCode', 'primaryColor', 'secondaryColor'],
    },
    module1LastFive: {
      type: Type.OBJECT,
      properties: {
        home: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING, nullable: true },
                  opponent: { type: Type.STRING },
                  venue: { type: Type.STRING },
                  scoreFor: { type: Type.INTEGER },
                  scoreAgainst: { type: Type.INTEGER },
                  outcome: { type: Type.STRING },
                  competition: { type: Type.STRING, nullable: true },
                },
                required: ['opponent', 'venue', 'scoreFor', 'scoreAgainst', 'outcome'],
              },
            },
            wins: { type: Type.INTEGER },
            draws: { type: Type.INTEGER },
            losses: { type: Type.INTEGER },
            goalsScored: { type: Type.INTEGER },
            goalsConceded: { type: Type.INTEGER },
            avgGoalsScored: { type: Type.NUMBER },
            avgGoalsConceded: { type: Type.NUMBER },
            homeSummary: { type: Type.STRING, nullable: true },
            awaySummary: { type: Type.STRING, nullable: true },
          },
          required: [
            'matches',
            'wins',
            'draws',
            'losses',
            'goalsScored',
            'goalsConceded',
            'avgGoalsScored',
            'avgGoalsConceded',
          ],
        },
        away: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING, nullable: true },
                  opponent: { type: Type.STRING },
                  venue: { type: Type.STRING },
                  scoreFor: { type: Type.INTEGER },
                  scoreAgainst: { type: Type.INTEGER },
                  outcome: { type: Type.STRING },
                  competition: { type: Type.STRING, nullable: true },
                },
                required: ['opponent', 'venue', 'scoreFor', 'scoreAgainst', 'outcome'],
              },
            },
            wins: { type: Type.INTEGER },
            draws: { type: Type.INTEGER },
            losses: { type: Type.INTEGER },
            goalsScored: { type: Type.INTEGER },
            goalsConceded: { type: Type.INTEGER },
            avgGoalsScored: { type: Type.NUMBER },
            avgGoalsConceded: { type: Type.NUMBER },
            homeSummary: { type: Type.STRING, nullable: true },
            awaySummary: { type: Type.STRING, nullable: true },
          },
          required: [
            'matches',
            'wins',
            'draws',
            'losses',
            'goalsScored',
            'goalsConceded',
            'avgGoalsScored',
            'avgGoalsConceded',
          ],
        },
      },
      required: ['home', 'away'],
    },
    module2HeadToHead: {
      type: Type.OBJECT,
      properties: {
        totalMatchesAnalyzed: { type: Type.INTEGER },
        homeTeamWins: { type: Type.INTEGER },
        awayTeamWins: { type: Type.INTEGER },
        draws: { type: Type.INTEGER },
        avgGoalsPerMatch: { type: Type.NUMBER, nullable: true },
        recentMatches: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING, nullable: true },
              homeTeam: { type: Type.STRING },
              awayTeam: { type: Type.STRING },
              homeGoals: { type: Type.INTEGER },
              awayGoals: { type: Type.INTEGER },
              competition: { type: Type.STRING, nullable: true },
            },
            required: ['homeTeam', 'awayTeam', 'homeGoals', 'awayGoals'],
          },
        },
      },
      required: ['totalMatchesAnalyzed', 'homeTeamWins', 'awayTeamWins', 'draws', 'recentMatches'],
    },
    module3Standings: {
      type: Type.OBJECT,
      properties: {
        home: {
          type: Type.OBJECT,
          properties: {
            position: { type: Type.INTEGER, nullable: true },
            points: { type: Type.INTEGER, nullable: true },
            played: { type: Type.INTEGER, nullable: true },
            wins: { type: Type.INTEGER, nullable: true },
            draws: { type: Type.INTEGER, nullable: true },
            losses: { type: Type.INTEGER, nullable: true },
            goalsFor: { type: Type.INTEGER, nullable: true },
            goalsAgainst: { type: Type.INTEGER, nullable: true },
            goalDifference: { type: Type.INTEGER, nullable: true },
            winPercentage: { type: Type.NUMBER, nullable: true },
            homeRecord: { type: Type.STRING, nullable: true },
            awayRecord: { type: Type.STRING, nullable: true },
          },
        },
        away: {
          type: Type.OBJECT,
          properties: {
            position: { type: Type.INTEGER, nullable: true },
            points: { type: Type.INTEGER, nullable: true },
            played: { type: Type.INTEGER, nullable: true },
            wins: { type: Type.INTEGER, nullable: true },
            draws: { type: Type.INTEGER, nullable: true },
            losses: { type: Type.INTEGER, nullable: true },
            goalsFor: { type: Type.INTEGER, nullable: true },
            goalsAgainst: { type: Type.INTEGER, nullable: true },
            goalDifference: { type: Type.INTEGER, nullable: true },
            winPercentage: { type: Type.NUMBER, nullable: true },
            homeRecord: { type: Type.STRING, nullable: true },
            awayRecord: { type: Type.STRING, nullable: true },
          },
        },
      },
      required: ['home', 'away'],
    },
    module4Complementary: {
      type: Type.OBJECT,
      properties: {
        home: {
          type: Type.OBJECT,
          properties: {
            avgCorners: { type: Type.NUMBER, nullable: true },
            avgCards: { type: Type.NUMBER, nullable: true },
            avgShots: { type: Type.NUMBER, nullable: true },
            avgShotsOnTarget: { type: Type.NUMBER, nullable: true },
            avgPossessionPct: { type: Type.NUMBER, nullable: true },
            bttsPct: { type: Type.NUMBER, nullable: true },
            over15Pct: { type: Type.NUMBER, nullable: true },
            over25Pct: { type: Type.NUMBER, nullable: true },
          },
        },
        away: {
          type: Type.OBJECT,
          properties: {
            avgCorners: { type: Type.NUMBER, nullable: true },
            avgCards: { type: Type.NUMBER, nullable: true },
            avgShots: { type: Type.NUMBER, nullable: true },
            avgShotsOnTarget: { type: Type.NUMBER, nullable: true },
            avgPossessionPct: { type: Type.NUMBER, nullable: true },
            bttsPct: { type: Type.NUMBER, nullable: true },
            over15Pct: { type: Type.NUMBER, nullable: true },
            over25Pct: { type: Type.NUMBER, nullable: true },
          },
        },
      },
      required: ['home', 'away'],
    },
    module5Context: {
      type: Type.OBJECT,
      properties: {
        homeAdvantageNote: { type: Type.STRING, nullable: true },
        matchImportance: { type: Type.STRING, nullable: true },
        homeTeamContext: {
          type: Type.OBJECT,
          properties: {
            absencesAndSuspensions: { type: Type.ARRAY, items: { type: Type.STRING } },
            restDays: { type: Type.INTEGER, nullable: true },
            recentCoachChange: { type: Type.STRING, nullable: true },
            formNote: { type: Type.STRING, nullable: true },
          },
          required: ['absencesAndSuspensions'],
        },
        awayTeamContext: {
          type: Type.OBJECT,
          properties: {
            absencesAndSuspensions: { type: Type.ARRAY, items: { type: Type.STRING } },
            restDays: { type: Type.INTEGER, nullable: true },
            recentCoachChange: { type: Type.STRING, nullable: true },
            formNote: { type: Type.STRING, nullable: true },
          },
          required: ['absencesAndSuspensions'],
        },
        contextualImpactHome: { type: Type.NUMBER },
        contextualImpactAway: { type: Type.NUMBER },
      },
      required: ['homeTeamContext', 'awayTeamContext', 'contextualImpactHome', 'contextualImpactAway'],
    },
    dataWarnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    'competition',
    'season',
    'homeTeam',
    'awayTeam',
    'module1LastFive',
    'module2HeadToHead',
    'module3Standings',
    'module4Complementary',
    'module5Context',
    'dataWarnings',
  ],
};

function sanitizeOutcome(val: string): 'V' | 'E' | 'D' {
  const upper = (val || '').trim().toUpperCase();
  if (upper.startsWith('V') || upper === 'W') return 'V';
  if (upper === 'E') return 'E';
  return 'D';
}

function normalizeMatchData(raw: MatchAnalysisData): MatchAnalysisData {
  const fixTeamLastFive = (stats: MatchAnalysisData['module1LastFive']['home']) => {
    const matches = (stats.matches || []).slice(0, 5).map((m) => {
      const outcome: 'V' | 'E' | 'D' =
        m.scoreFor > m.scoreAgainst
          ? 'V'
          : m.scoreFor === m.scoreAgainst
            ? 'E'
            : 'D';
      return {
        ...m,
        venue: (m.venue === 'Fora' ? 'Fora' : 'Casa') as 'Casa' | 'Fora',
        outcome: sanitizeOutcome(outcome),
      };
    });
    const count = matches.length;
    const wins = count > 0 ? matches.filter((m) => m.outcome === 'V').length : stats.wins || 0;
    const draws = count > 0 ? matches.filter((m) => m.outcome === 'E').length : stats.draws || 0;
    const losses = count > 0 ? matches.filter((m) => m.outcome === 'D').length : stats.losses || 0;
    const goalsScored =
      count > 0 ? matches.reduce((acc, m) => acc + (m.scoreFor || 0), 0) : stats.goalsScored || 0;
    const goalsConceded =
      count > 0
        ? matches.reduce((acc, m) => acc + (m.scoreAgainst || 0), 0)
        : stats.goalsConceded || 0;
    const denom = count > 0 ? count : Math.max(1, wins + draws + losses);

    return {
      ...stats,
      matches,
      wins,
      draws,
      losses,
      goalsScored,
      goalsConceded,
      avgGoalsScored: Number((goalsScored / denom).toFixed(2)),
      avgGoalsConceded: Number((goalsConceded / denom).toFixed(2)),
    };
  };

  return {
    ...raw,
    homeTeam: {
      ...raw.homeTeam,
      shortCode: (raw.homeTeam?.shortCode || raw.homeTeam?.name || 'TIM').slice(0, 3).toUpperCase(),
      primaryColor: /^#[0-9A-Fa-f]{6}$/.test(raw.homeTeam?.primaryColor || '')
        ? raw.homeTeam.primaryColor
        : '#0F766E',
      secondaryColor: /^#[0-9A-Fa-f]{6}$/.test(raw.homeTeam?.secondaryColor || '')
        ? raw.homeTeam.secondaryColor
        : '#FFFFFF',
    },
    awayTeam: {
      ...raw.awayTeam,
      shortCode: (raw.awayTeam?.shortCode || raw.awayTeam?.name || 'VIS').slice(0, 3).toUpperCase(),
      primaryColor: /^#[0-9A-Fa-f]{6}$/.test(raw.awayTeam?.primaryColor || '')
        ? raw.awayTeam.primaryColor
        : '#1D4ED8',
      secondaryColor: /^#[0-9A-Fa-f]{6}$/.test(raw.awayTeam?.secondaryColor || '')
        ? raw.awayTeam.secondaryColor
        : '#FFFFFF',
    },
    module1LastFive: {
      home: fixTeamLastFive(raw.module1LastFive.home),
      away: fixTeamLastFive(raw.module1LastFive.away),
    },
    module5Context: {
      ...raw.module5Context,
      contextualImpactHome: Math.max(-0.35, Math.min(0.35, raw.module5Context?.contextualImpactHome ?? 0)),
      contextualImpactAway: Math.max(-0.35, Math.min(0.35, raw.module5Context?.contextualImpactAway ?? 0)),
    },
  };
}

function extractJsonBlock<T>(rawText: string): T {
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('JSON_PARSE_FAILED');
  }
  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
}

export function resolveApiError(error: any, fallbackMessage: string): { status: number; message: string } {
  const rawMsg = String(error?.message || '');
  const status =
    error?.status ||
    (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')
      ? 429
      : rawMsg.includes('403') || rawMsg.includes('PERMISSION_DENIED')
        ? 403
        : rawMsg.includes('400') || rawMsg.includes('API_KEY_INVALID')
          ? 400
          : 500);

  if (error?.message === 'ESPN_AND_GEMINI_UNAVAILABLE') {
    return {
      status: 404,
      message:
        'Não foi possível localizar um dos clubes na base esportiva ao vivo. Verifique a grafia oficial dos times e tente novamente.',
    };
  }
  if (error?.message === 'GEMINI_API_KEY_MISSING') {
    return {
      status: 503,
      message:
        'Serviço auxiliar indisponível neste servidor no momento. Tente novamente ou use o modo local.',
    };
  }
  if (status === 429) {
    return {
      status: 429,
      message:
        'Limite temporário de consultas atingido (429). Aguarde alguns instantes e tente novamente.',
    };
  }
  if (status === 403 || status === 400) {
    return {
      status,
      message: fallbackMessage,
    };
  }
  return { status: 500, message: fallbackMessage };
}

export async function getFixturesService(params: {
  scope?: ChampionshipScope;
  forceRefresh?: boolean;
}): Promise<{ fixtures: SuggestedFixture[]; updatedAt: string; cached?: boolean }> {
  const scope = params.scope || 'brasil';
  const forceRefresh = Boolean(params.forceRefresh);
  const cached = fixturesCache.get(scope);

  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return {
      fixtures: cached.fixtures,
      updatedAt: cached.updatedAt,
      cached: true,
    };
  }

  const espnFixtures = await fetchEspnLiveFixtures(scope);
  if (espnFixtures.length > 0) {
    const updatedAt = new Date().toISOString();
    fixturesCache.set(scope, {
      fixtures: espnFixtures,
      updatedAt,
      expiresAt: Date.now() + FIXTURES_TTL_MS,
    });
    return { fixtures: espnFixtures, updatedAt };
  }

  if (!resolveGeminiApiKey()) {
    return { fixtures: [], updatedAt: new Date().toISOString() };
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const ai = getAiClient();

  const scopeDescription =
    scope === 'brasil'
      ? 'Campeonato Brasileiro Série A, Série B, Copa do Brasil e Copa Libertadores (times brasileiros)'
      : scope === 'principais'
        ? 'Brasileirão Série A, Premier League, La Liga, Serie A Itália, Bundesliga e UEFA Champions League'
        : 'principais campeonatos nacionais e internacionais de futebol do mundo hoje';

  const prompt = `Data e hora de referência: ${new Date().toISOString()}. Pesquise na web até 6 partidas de futebol reais que estão acontecendo ao vivo agora ou que vão acontecer hoje e nos próximos dias envolvendo ${scopeDescription}. NUNCA inclua jogos já encerrados.
Responda EXCLUSIVAMENTE com um JSON válido no formato:
{
  "fixtures": [
    {
      "homeTeam": "Nome do mandante",
      "awayTeam": "Nome do visitante",
      "competition": "Nome do campeonato",
      "dateLabel": "Data ou status curto (ex: Ao vivo, Hoje · 21:30, Amanhã · 16:00)"
    }
  ]
}
Não invente confrontos.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const parsed = extractJsonBlock<{ fixtures: SuggestedFixture[] }>(response.text ?? '{}');
  const fixtures = (parsed.fixtures || []).slice(0, 6);
  const updatedAt = new Date().toISOString();

  fixturesCache.set(scope, {
    fixtures,
    updatedAt,
    expiresAt: Date.now() + FIXTURES_TTL_MS,
  });

  return { fixtures, updatedAt };
}

export async function analyzeMatchService(params: {
  homeTeam: string;
  awayTeam: string;
  competition?: string;
  forceRefresh?: boolean;
}): Promise<AnalysisResponsePayload> {
  const homeTeam = params.homeTeam.trim();
  const awayTeam = params.awayTeam.trim();
  const competition = (params.competition || '').trim();
  const forceRefresh = Boolean(params.forceRefresh);

  const cacheKey = `${homeTeam.toLowerCase()}::${awayTeam.toLowerCase()}::${competition.toLowerCase()}`;
  const cached = analysisCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const espnPayload = await analyzeMatchViaEspn(homeTeam, awayTeam, competition);
  if (espnPayload) {
    analysisCache.set(cacheKey, {
      payload: espnPayload,
      expiresAt: Date.now() + ANALYSIS_TTL_MS,
    });
    return espnPayload;
  }

  if (!resolveGeminiApiKey()) {
    throw new Error('ESPN_AND_GEMINI_UNAVAILABLE');
  }

  const ai = getAiClient();
  const todayStr = new Date().toISOString().split('T')[0];

  const searchPrompt = `Você é um analista estatístico de futebol profissional. Data de referência: ${todayStr}.
Pesquise na Internet informações ATUALIZADAS e REAIS para o confronto:
- Mandante (Time A): ${homeTeam}
- Visitante (Time B): ${awayTeam}
- Campeonato/Contexto: ${competition || 'Competição principal atual em que ambos atuam'}

REGRA ABSOLUTA: Nunca invente dados, placares ou estatísticas. Se um dado específico (como escanteios, posse de bola ou cartões) não estiver disponível nas fontes encontradas, retorne null nesse campo e registre a ausência em dataWarnings.

Responda EXCLUSIVAMENTE com um JSON válido (sem texto antes ou depois) seguindo exatamente esta estrutura em português do Brasil:
{
  "competition": "string",
  "season": "string",
  "matchDateInfo": "string ou null",
  "homeTeam": { "name": "string", "shortCode": "3 letras", "primaryColor": "#HEX", "secondaryColor": "#HEX" },
  "awayTeam": { "name": "string", "shortCode": "3 letras", "primaryColor": "#HEX", "secondaryColor": "#HEX" },
  "module1LastFive": {
    "home": {
      "matches": [{ "date": "string|null", "opponent": "string", "venue": "Casa|Fora", "scoreFor": 0, "scoreAgainst": 0, "outcome": "V|E|D", "competition": "string|null" }],
      "wins": 0, "draws": 0, "losses": 0, "goalsScored": 0, "goalsConceded": 0, "avgGoalsScored": 0, "avgGoalsConceded": 0,
      "homeSummary": "string|null", "awaySummary": "string|null"
    },
    "away": {
      "matches": [{ "date": "string|null", "opponent": "string", "venue": "Casa|Fora", "scoreFor": 0, "scoreAgainst": 0, "outcome": "V|E|D", "competition": "string|null" }],
      "wins": 0, "draws": 0, "losses": 0, "goalsScored": 0, "goalsConceded": 0, "avgGoalsScored": 0, "avgGoalsConceded": 0,
      "homeSummary": "string|null", "awaySummary": "string|null"
    }
  },
  "module2HeadToHead": {
    "totalMatchesAnalyzed": 0, "homeTeamWins": 0, "awayTeamWins": 0, "draws": 0, "avgGoalsPerMatch": number|null,
    "recentMatches": [{ "date": "string|null", "homeTeam": "string", "awayTeam": "string", "homeGoals": 0, "awayGoals": 0, "competition": "string|null" }]
  },
  "module3Standings": {
    "home": { "position": number|null, "points": number|null, "played": number|null, "wins": number|null, "draws": number|null, "losses": number|null, "goalsFor": number|null, "goalsAgainst": number|null, "goalDifference": number|null, "winPercentage": number|null, "homeRecord": "string|null", "awayRecord": "string|null" },
    "away": { "position": number|null, "points": number|null, "played": number|null, "wins": number|null, "draws": number|null, "losses": number|null, "goalsFor": number|null, "goalsAgainst": number|null, "goalDifference": number|null, "winPercentage": number|null, "homeRecord": "string|null", "awayRecord": "string|null" }
  },
  "module4Complementary": {
    "home": { "avgCorners": number|null, "avgCards": number|null, "avgShots": number|null, "avgShotsOnTarget": number|null, "avgPossessionPct": number|null, "bttsPct": number|null, "over15Pct": number|null, "over25Pct": number|null },
    "away": { "avgCorners": number|null, "avgCards": number|null, "avgShots": number|null, "avgShotsOnTarget": number|null, "avgPossessionPct": number|null, "bttsPct": number|null, "over15Pct": number|null, "over25Pct": number|null }
  },
  "module5Context": {
    "homeAdvantageNote": "string|null",
    "matchImportance": "string|null",
    "homeTeamContext": { "absencesAndSuspensions": ["string"], "restDays": number|null, "recentCoachChange": "string|null", "formNote": "string|null" },
    "awayTeamContext": { "absencesAndSuspensions": ["string"], "restDays": number|null, "recentCoachChange": "string|null", "formNote": "string|null" },
    "contextualImpactHome": 0,
    "contextualImpactAway": 0
  },
  "dataWarnings": ["string"]
}
Nota sobre contextualImpactHome e contextualImpactAway: número conservador entre -0.30 e +0.30 refletindo apenas desfalques, descanso, troca de técnico e importância; use 0 se neutro.`;

  const searchResponse = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: searchPrompt,
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
    },
  });

  const sources = extractGroundingSources(searchResponse);
  const rawText = searchResponse.text ?? '';

  let parsedRaw: MatchAnalysisData;
  try {
    parsedRaw = extractJsonBlock<MatchAnalysisData>(rawText);
  } catch {
    const structuredResponse = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Converta o relatório abaixo para JSON estrito sem inventar números:\n\n${rawText}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: matchAnalysisSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    parsedRaw = JSON.parse((structuredResponse.text ?? '{}').trim()) as MatchAnalysisData;
  }

  const normalizedData = normalizeMatchData(parsedRaw);

  const payload: AnalysisResponsePayload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    updatedAt: new Date().toISOString(),
    data: normalizedData,
    sources,
  };

  analysisCache.set(cacheKey, {
    payload,
    expiresAt: Date.now() + ANALYSIS_TTL_MS,
  });

  return payload;
}

export async function getSerieAMultipleService(
  forceRefresh = false,
  leagueInput = 'today',
  countInput = 3,
  dayFilterInput: MultipleDayFilter | boolean = 'all'
): Promise<SerieAMultipleTip> {
  const normalized = String(leagueInput || 'today').trim().toLowerCase();
  const leagueKey = MULTIPLE_COMPETITION_SET.has(normalized) ? normalized : 'today';
  const parsedCount = Number(countInput);
  const legCount =
    parsedCount === 4 || parsedCount === 5 || parsedCount === 10 ? parsedCount : 3;

  const effectiveDayFilter: MultipleDayFilter =
    leagueKey === 'today'
      ? 'today'
      : leagueKey === 'tomorrow'
        ? 'tomorrow'
        : typeof dayFilterInput === 'boolean'
          ? dayFilterInput
            ? 'today'
            : 'all'
          : dayFilterInput === 'today' || dayFilterInput === 'tomorrow'
            ? dayFilterInput
            : 'all';

  const cacheKey = `${leagueKey}::${legCount}::${effectiveDayFilter}`;

  const cached = multipleCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.tip;
  }

  const tip = await buildMultipleTipViaEspn(leagueKey, legCount, effectiveDayFilter);
  if (!tip || tip.legs.length === 0) {
    if (effectiveDayFilter === 'tomorrow') {
      throw new Error('NO_TOMORROW_MULTIPLE_MATCHES');
    }
    throw new Error(
      effectiveDayFilter === 'today'
        ? 'NO_TODAY_MULTIPLE_MATCHES'
        : 'NO_UPCOMING_MULTIPLE_MATCHES'
    );
  }

  multipleCache.set(cacheKey, {
    tip,
    expiresAt: Date.now() + MULTIPLE_TTL_MS,
  });

  return tip;
}

export async function getSuperCombinedTipService(
  forceRefresh = false
): Promise<SuperCombinedTip> {
  if (!forceRefresh && superCombinedCache && superCombinedCache.expiresAt > Date.now()) {
    return superCombinedCache.tip;
  }

  const tip = await buildSuperCombinedTipViaEspn();
  if (!tip || (tip.multiMatchLegs.length === 0 && tip.sameGameCombos.length === 0)) {
    throw new Error('NO_SUPER_COMBINED_MATCHES');
  }

  superCombinedCache = {
    tip,
    expiresAt: Date.now() + MULTIPLE_TTL_MS,
  };

  return tip;
}

export async function checkMultipleResultsService(
  legs: MultipleLegCheckInput[]
): Promise<MultipleLegCheckResult[]> {
  if (!Array.isArray(legs) || legs.length === 0) {
    return [];
  }
  return checkMultipleLegsResultsViaEspn(legs);
}

interface GeminiWebScoreItem {
  key: string;
  found: boolean;
  state: 'pre' | 'in' | 'post';
  homeGoals: number | null;
  awayGoals: number | null;
  clock?: string | null;
  statusDetail?: string | null;
}

async function fetchMissingLiveScoresViaWebSearch(
  missingItems: LiveScoreQueryItem[]
): Promise<Map<string, LiveScoreMatchResult>> {
  const out = new Map<string, LiveScoreMatchResult>();
  if (missingItems.length === 0 || !resolveGeminiApiKey()) {
    return out;
  }

  const targetSlice = missingItems.slice(0, 4);
  const nowIso = new Date().toISOString();
  const todayBr = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());

  try {
    const ai = getAiClient();
    const listText = targetSlice
      .map(
        (m) =>
          `- key="${m.key}" | ${m.homeTeam} x ${m.awayTeam} | Competição: ${
            m.competition || 'Futebol'
          }${m.dateHint ? ` | Salvo em: ${m.dateHint.slice(0, 10)}` : ''}`
      )
      .join('\n');

    const prompt = `Data/hora atual: ${todayBr}.
Pesquise na web (Google Search) o placar ao vivo ou placar final mais recente para cada jogo abaixo:
${listText}

REGRA ESTRITA: Nunca invente placares ou minutos. Se não encontrar confirmação real na web para um jogo, retorne "found": false.
Retorne EXCLUSIVAMENTE um JSON válido neste formato:
{
  "matches": [
    {
      "key": "string",
      "found": true,
      "state": "in" | "post" | "pre",
      "homeGoals": 0,
      "awayGoals": 0,
      "clock": "67'" | "INT" | "FIM" | null,
      "statusDetail": "2ºT · 67'" | "Intervalo" | "Finalizado" | "Hoje · 21:00"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const parsed = extractJsonBlock<{ matches?: GeminiWebScoreItem[] }>(
      response.text ?? ''
    );
    const matches = Array.isArray(parsed?.matches) ? parsed.matches : [];
    const byKey = new Map(targetSlice.map((item) => [item.key, item]));

    for (const row of matches) {
      if (!row?.found || !row.key) continue;
      const orig = byKey.get(row.key);
      if (!orig) continue;

      const state: MatchLiveState =
        row.state === 'in' || row.state === 'post' ? row.state : 'pre';
      const completed = state === 'post';
      const hasScore =
        (state === 'in' || state === 'post') &&
        typeof row.homeGoals === 'number' &&
        Number.isFinite(row.homeGoals) &&
        typeof row.awayGoals === 'number' &&
        Number.isFinite(row.awayGoals);

      const marketStatus =
        orig.marketLabel && completed && hasScore
          ? evaluateMultipleMarketOutcome(
              orig.marketLabel,
              orig.homeTeam,
              orig.awayTeam,
              row.homeGoals!,
              row.awayGoals!
            )
          : undefined;

      out.set(orig.key, {
        key: orig.key,
        found: true,
        state,
        completed,
        homeGoals: hasScore ? row.homeGoals! : undefined,
        awayGoals: hasScore ? row.awayGoals! : undefined,
        clock: row.clock || (completed ? 'FIM' : undefined),
        statusDetail:
          row.statusDetail ||
          (completed ? 'Finalizado' : state === 'in' ? 'Ao vivo' : 'Agendado'),
        eventId: orig.eventId,
        leagueSlug: orig.leagueSlug,
        sourceLabel: 'Busca Web',
        marketStatus,
        updatedAt: nowIso,
      });
    }
  } catch {
    // Web search fallback is strictly optional; keep ESPN results intact
  }

  return out;
}

export async function getLiveScoresService(
  items: LiveScoreQueryItem[],
  options?: { forceRefresh?: boolean; allowWebFallback?: boolean }
): Promise<LiveScoreMatchResult[]> {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const forceRefresh = Boolean(options?.forceRefresh);
  const allowWebFallback = Boolean(options?.allowWebFallback);
  const now = Date.now();
  const bounded = items.slice(0, 35);

  const finalByKey = new Map<string, LiveScoreMatchResult>();
  const toFetch: LiveScoreQueryItem[] = [];

  for (const item of bounded) {
    const cacheId = item.eventId
      ? `ev:${item.eventId}:${item.marketLabel || ''}`
      : `nm:${item.homeTeam.toLowerCase()}::${item.awayTeam.toLowerCase()}::${item.marketLabel || ''}`;
    const cached = liveScoreCache.get(cacheId);
    if (!forceRefresh && cached && cached.expiresAt > now) {
      finalByKey.set(item.key, { ...cached.result, key: item.key });
    } else {
      toFetch.push(item);
    }
  }

  if (toFetch.length > 0) {
    const espnResults = await fetchLiveScoresViaEspn(toFetch);
    const missingForWeb: LiveScoreQueryItem[] = [];

    espnResults.forEach((res, idx) => {
      const orig = toFetch[idx];
      if (res.found) {
        finalByKey.set(orig.key, res);
      } else {
        missingForWeb.push(orig);
        finalByKey.set(orig.key, res);
      }
    });

    if (allowWebFallback && missingForWeb.length > 0) {
      const webMap = await fetchMissingLiveScoresViaWebSearch(missingForWeb);
      for (const [k, webRes] of webMap.entries()) {
        finalByKey.set(k, webRes);
      }
    }

    for (const orig of toFetch) {
      const resolved = finalByKey.get(orig.key);
      if (!resolved) continue;
      const cacheId = orig.eventId
        ? `ev:${orig.eventId}:${orig.marketLabel || ''}`
        : `nm:${orig.homeTeam.toLowerCase()}::${orig.awayTeam.toLowerCase()}::${orig.marketLabel || ''}`;
      liveScoreCache.set(cacheId, {
        result: resolved,
        expiresAt: Date.now() + LIVE_SCORE_TTL_MS,
      });
    }
  }

  return bounded.map(
    (item) =>
      finalByKey.get(item.key) ?? {
        key: item.key,
        found: false,
        state: 'pre',
        completed: false,
        statusDetail: 'Sem atualização ao vivo',
        sourceLabel: 'ESPN',
        updatedAt: new Date().toISOString(),
      }
  );
}

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const betSlipExtractionSchema = {
  type: Type.OBJECT,
  properties: {
    isBetSlip: {
      type: Type.BOOLEAN,
      description:
        'true se a imagem contiver um bilhete, comprovante, cupom, print de aposta ou dica de jogos de futebol; false caso contrário.',
    },
    bookmaker: {
      type: Type.STRING,
      description:
        'Nome da casa de apostas visível (ex: Bet365, Betano, Superbet, KTO, Sportingbet, Betnacional, Novibet, Pixbet) ou string vazia.',
    },
    title: {
      type: Type.STRING,
      description:
        'Título curto para o bilhete em português (ex: "Múltipla Betano", "Aposta simples Bet365" ou nome do campeonato).',
    },
    stake: {
      type: Type.NUMBER,
      description: 'Valor apostado em reais (apenas número, ex: 50 ou 25.5). Use 0 se não estiver visível.',
    },
    totalOdd: {
      type: Type.NUMBER,
      description:
        'Cotação/odd total do bilhete (apenas número decimal, ex: 4.25). Use 0 se não estiver visível.',
    },
    potentialReturn: {
      type: Type.NUMBER,
      description:
        'Retorno potencial ou valor ganho em reais (apenas número). Use 0 se não estiver visível.',
    },
    status: {
      type: Type.STRING,
      description:
        'Status geral do bilhete: "won" se ganho/green/vencido, "lost" se perdido/red, ou "pending" se em aberto/ao vivo/não resolvido.',
    },
    notes: {
      type: Type.STRING,
      description:
        'Observação curta em português sobre a leitura ou motivo caso isBetSlip seja false.',
    },
    legs: {
      type: Type.ARRAY,
      description: 'Lista de cada jogo / seleção presente na aposta.',
      items: {
        type: Type.OBJECT,
        properties: {
          homeTeam: {
            type: Type.STRING,
            description: 'Nome oficial ou principal do time mandante (primeiro time listado).',
          },
          awayTeam: {
            type: Type.STRING,
            description: 'Nome oficial ou principal do time visitante (segundo time listado).',
          },
          competition: {
            type: Type.STRING,
            description:
              'Nome do campeonato/liga se visível ou reconhecível (ex: "Brasileirão Série A", "Premier League", "Champions League", ou "Futebol").',
          },
          dateLabel: {
            type: Type.STRING,
            description:
              'Data/horário do jogo conforme exibido no bilhete (ex: "Hoje · 21:30", "17/11 · 19:00", ou "Agendado").',
          },
          marketLabel: {
            type: Type.STRING,
            description:
              'Palpite/mercado em português padronizado sempre que aplicável: "Vitória <Time>", "Empate", "Dupla chance: <Time> ou Empate", "Mais de 1,5 gols", "Mais de 2,5 gols", "Menos de 2,5 gols", "Ambas marcam: Sim", "Ambas marcam: Não", ou o texto fiel do mercado se for outro (ex: escanteios/cartões).',
          },
          odd: {
            type: Type.NUMBER,
            description: 'Odd individual da seleção (ex: 1.75). Use 0 se não estiver visível.',
          },
          status: {
            type: Type.STRING,
            description:
              'Status individual do jogo: "won" se acertou/verde/check, "lost" se errou/vermelho/X, ou "pending" se ainda não encerrado.',
          },
        },
        required: ['homeTeam', 'awayTeam', 'marketLabel'],
      },
    },
  },
  required: ['isBetSlip', 'legs'],
};

function sanitizeLegStatus(raw: unknown): MultipleLegStatus {
  const s = String(raw || '').toLowerCase().trim();
  if (s === 'won' || s === 'win' || s === 'green' || s === 'ganha' || s === 'acerto') {
    return 'won';
  }
  if (s === 'lost' || s === 'loss' || s === 'red' || s === 'perdida' || s === 'perda') {
    return 'lost';
  }
  return 'pending';
}

function sanitizePositiveNumber(raw: unknown, fallback = 0): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Number(n.toFixed(2));
}

function makeShortCodeFromTeam(name: string): string {
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
  return (clean || 'TIM').slice(0, 3);
}

function buildNeedsLocalOcrResponse(): ParsedBetSlipResponse {
  return {
    isBetSlip: false,
    needsLocalOcr: true,
    title: 'Bilhete importado',
    competition: 'Bilhete importado',
    leagueSlug: 'world',
    stake: 0,
    totalOdd: 1,
    potentialReturn: 0,
    status: 'pending',
    legs: [],
  };
}

export async function parseBetSlipImageService(params: {
  imageBase64?: string;
  mimeType?: string;
  ocrText?: string;
}): Promise<ParsedBetSlipResponse> {
  // Mode 1: Client-side OCR text sent for structured parsing + official ESPN crest/league enrichment
  const rawOcrText = typeof params.ocrText === 'string' ? params.ocrText.trim() : '';
  if (rawOcrText.length > 0) {
    const parsedOcr = parseBetSlipOcrText(rawOcrText);
    if (!parsedOcr.isBetSlip || parsedOcr.legs.length === 0) {
      return parsedOcr;
    }
    const enrichedLegs = await enrichParsedBetLegsViaEspn(parsedOcr.legs);
    const distinctSlugs = Array.from(
      new Set(
        enrichedLegs
          .map((l) => l.leagueSlug)
          .filter((s): s is string => Boolean(s))
      )
    );
    return {
      ...parsedOcr,
      extractionMode: 'ocr',
      leagueSlug: distinctSlugs.length === 1 ? distinctSlugs[0] : parsedOcr.leagueSlug,
      legs: enrichedLegs,
    };
  }

  // Mode 2: Image upload
  const rawInput = String(params.imageBase64 || '').trim();
  if (!rawInput) {
    throw new Error('IMAGE_REQUIRED');
  }

  let base64 = rawInput;
  let mimeType = String(params.mimeType || 'image/jpeg').toLowerCase().trim();
  const dataUrlMatch = rawInput.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1].toLowerCase().trim();
    base64 = dataUrlMatch[2].trim();
  }

  if (mimeType === 'image/jpg') {
    mimeType = 'image/jpeg';
  }
  if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
    throw new Error('INVALID_IMAGE_TYPE');
  }

  // ~7.5MB decoded safety limit
  if (base64.length > 10_500_000) {
    throw new Error('IMAGE_TOO_LARGE');
  }

  // If GEMINI_API_KEY is not configured on this deployment (e.g. Vercel without key),
  // seamlessly delegate real OCR extraction to the browser's Tesseract.js engine.
  if (!resolveGeminiApiKey()) {
    return buildNeedsLocalOcrResponse();
  }

  const prompt = `Você é um especialista em leitura de bilhetes e comprovantes de apostas esportivas de futebol (Bet365, Betano, Superbet, KTO, Sportingbet, Betnacional, Novibet, Pixbet, EstrelaBet, prints de dicas/múltiplas, etc.).
Analise cuidadosamente a imagem anexada e extraia TODAS as partidas de futebol, mercados/palpites, odds, valor apostado (stake), retorno potencial e status (ganha/perdida/pendente) que estejam realmente visíveis na imagem.

REGRAS ESTRITAS:
1. NUNCA invente jogos, times, odds ou valores que não apareçam na imagem.
2. Se a imagem NÃO contiver uma aposta ou lista de jogos de futebol, retorne "isBetSlip": false e "legs": [].
3. Padronize o campo "marketLabel" em português claro do Brasil:
   - Vitória do time: "Vitória <Nome do Time>"
   - Empate seco: "Empate"
   - Dupla chance / Hipótese dupla: "Dupla chance: <Nome do Time> ou Empate"
   - Gols: "Mais de 1,5 gols", "Mais de 2,5 gols", "Menos de 2,5 gols", etc.
   - Ambas marcam: "Ambas marcam: Sim" ou "Ambas marcam: Não"
   - Outros mercados (escanteios, cartões, handicap, chutes, jogadores): mantenha a descrição fiel e clara em português.
4. Converta valores monetários em formato brasileiro (ex: "R$ 50,00" -> 50; "R$ 1.250,40" -> 1250.4).
5. Se a aposta tiver apenas 1 jogo e a odd individual não aparecer separada da odd total, use a odd total nesse jogo.
6. Identifique ícones ou rótulos visuais de resultado por jogo (check verde / "Ganha" => "won"; X vermelho / "Perdida" => "lost"; relógio / "Em aberto" / ao vivo => "pending").`;

  let rawText = '{}';
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: betSlipExtractionSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    rawText = (response.text ?? '{}').trim();
  } catch (err: any) {
    // If Gemini API fails (e.g. invalid key or quota 429 on Vercel), gracefully delegate to local OCR
    console.warn(
      'Gemini vision unavailable for bet slip, falling back to local OCR:',
      err?.message || err
    );
    return buildNeedsLocalOcrResponse();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = extractJsonBlock<any>(rawText);
  }

  const rawLegs: any[] = Array.isArray(parsed?.legs) ? parsed.legs : [];
  const validLegsRaw: ParsedBetSlipLeg[] = rawLegs
    .filter(
      (leg) =>
        typeof leg?.homeTeam === 'string' &&
        leg.homeTeam.trim().length > 0 &&
        typeof leg?.awayTeam === 'string' &&
        leg.awayTeam.trim().length > 0
    )
    .slice(0, 15)
    .map((leg) => {
      const homeTeam = String(leg.homeTeam).trim();
      const awayTeam = String(leg.awayTeam).trim();
      const competition = String(leg.competition || '').trim() || 'Futebol';
      const dateLabel = String(leg.dateLabel || '').trim() || 'Importado';
      const marketLabel =
        String(leg.marketLabel || '').trim() || `Vitória ${homeTeam}`;
      const odd = sanitizePositiveNumber(leg.odd, 0);
      return {
        homeTeam,
        awayTeam,
        homeShortCode: makeShortCodeFromTeam(homeTeam),
        awayShortCode: makeShortCodeFromTeam(awayTeam),
        competition,
        dateLabel,
        marketLabel,
        odd,
        status: sanitizeLegStatus(leg.status),
      };
    });

  const isBetSlip = Boolean(parsed?.isBetSlip) && validLegsRaw.length > 0;
  if (!isBetSlip) {
    return {
      isBetSlip: false,
      title: 'Bilhete importado',
      competition: 'Bilhete importado',
      leagueSlug: 'world',
      stake: 0,
      totalOdd: 1,
      potentialReturn: 0,
      status: 'pending',
      legs: [],
      notes:
        String(parsed?.notes || '').trim() ||
        'Não foi possível identificar jogos de futebol nesta imagem. Envie um print nítido do bilhete de aposta ou preencha os jogos manualmente.',
    };
  }

  const bookmaker = String(parsed?.bookmaker || '').trim() || undefined;
  let stake = sanitizePositiveNumber(parsed?.stake, 0);
  let totalOdd = sanitizePositiveNumber(parsed?.totalOdd, 0);
  let potentialReturn = sanitizePositiveNumber(parsed?.potentialReturn, 0);

  // Fill single-leg odd from totalOdd when only total odd was shown
  if (validLegsRaw.length === 1 && validLegsRaw[0].odd <= 0 && totalOdd >= 1.01) {
    validLegsRaw[0].odd = totalOdd;
  }

  // Fill missing leg odds with neutral 1.00 or derive totalOdd from legs
  const productOfKnownOdds = validLegsRaw.reduce(
    (acc, leg) => (leg.odd >= 1.01 ? acc * leg.odd : acc),
    1
  );
  if (totalOdd < 1.01) {
    if (productOfKnownOdds >= 1.01) {
      totalOdd = Number(productOfKnownOdds.toFixed(2));
    } else if (stake > 0 && potentialReturn > stake) {
      totalOdd = Number((potentialReturn / stake).toFixed(2));
    } else {
      totalOdd = 1;
    }
  }

  if (stake <= 0 && potentialReturn > 0 && totalOdd > 1) {
    stake = Number((potentialReturn / totalOdd).toFixed(2));
  }
  if (potentialReturn <= 0 && stake > 0 && totalOdd >= 1) {
    potentialReturn = Number((stake * totalOdd).toFixed(2));
  }

  // Enrich legs with official ESPN club crests, colors, and league slugs
  const enrichedLegs = await enrichParsedBetLegsViaEspn(validLegsRaw);

  // Determine overall status (respecting leg statuses if clear)
  let status: MultipleTipStatus = sanitizeLegStatus(parsed?.status);
  if (status === 'pending') {
    if (enrichedLegs.some((l) => l.status === 'lost')) status = 'lost';
    else if (enrichedLegs.every((l) => l.status === 'won')) status = 'won';
  } else if (status === 'won' && enrichedLegs.every((l) => l.status === 'pending')) {
    for (const l of enrichedLegs) l.status = 'won';
  }

  // Pick a clean slip header competition/title
  const distinctComps = Array.from(
    new Set(
      enrichedLegs
        .map((l) => l.competition)
        .filter((c) => c && c.toLowerCase() !== 'futebol')
    )
  );
  const distinctSlugs = Array.from(
    new Set(enrichedLegs.map((l) => l.leagueSlug).filter((s): s is string => Boolean(s)))
  );

  const rawTitle = String(parsed?.title || '').trim();
  const competitionLabel =
    rawTitle ||
    (distinctComps.length === 1
      ? distinctComps[0]
      : bookmaker
        ? `${enrichedLegs.length === 1 ? 'Aposta simples' : 'Múltipla'} · ${bookmaker}`
        : enrichedLegs.length === 1
          ? 'Aposta simples importada'
          : 'Múltipla importada');

  const leagueSlug = distinctSlugs.length === 1 ? distinctSlugs[0] : 'world';

  return {
    isBetSlip: true,
    extractionMode: 'vision',
    bookmaker,
    title: competitionLabel,
    competition: competitionLabel,
    leagueSlug,
    stake,
    totalOdd,
    potentialReturn,
    status,
    legs: enrichedLegs,
    notes: String(parsed?.notes || '').trim() || undefined,
  };
}

