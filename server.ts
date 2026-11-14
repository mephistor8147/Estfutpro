import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import type {
  AnalysisResponsePayload,
  ChampionshipScope,
  GroundingSource,
  MatchAnalysisData,
  SuggestedFixture,
} from './src/types/football.ts';
import { analyzeMatchViaEspn, fetchEspnLiveFixtures } from './src/lib/espnProvider.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
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
  if (upper.startsWith('E') || upper === 'D') {
    // Distinguish Portuguese Empate (E) vs Derrota (D)
    if (upper === 'E') return 'E';
  }
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

const FIXTURES_TTL_MS = 30 * 60 * 1000;
const ANALYSIS_TTL_MS = 15 * 60 * 1000;

const fixturesCache = new Map<
  ChampionshipScope,
  { fixtures: SuggestedFixture[]; updatedAt: string; expiresAt: number }
>();

const analysisCache = new Map<
  string,
  { payload: AnalysisResponsePayload; expiresAt: number }
>();

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

function resolveApiError(error: any, fallbackMessage: string): { status: number; message: string } {
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

  if (error?.message === 'GEMINI_API_KEY_MISSING') {
    return {
      status: 400,
      message: 'Chave da API Gemini não configurada no painel Settings > Secrets.',
    };
  }
  if (status === 429) {
    return {
      status: 429,
      message:
        'Cota de consultas da API Gemini atingida temporariamente (429). Aguarde alguns instantes ou selecione uma chave com faturamento habilitado em Settings > Secrets.',
    };
  }
  if (status === 403 || status === 400) {
    return {
      status,
      message: 'Verifique a chave da API configurada em Settings > Secrets.',
    };
  }
  return { status: 500, message: fallbackMessage };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.post('/api/fixtures', async (req, res) => {
    try {
      const scope = (req.body?.scope as ChampionshipScope) || 'brasil';
      const forceRefresh = Boolean(req.body?.forceRefresh);
      const cached = fixturesCache.get(scope);

      if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
        res.json({
          fixtures: cached.fixtures,
          updatedAt: cached.updatedAt,
          cached: true,
        });
        return;
      }

      // 1. Primary live sports data source (ESPN public API - zero Gemini quota burn)
      const espnFixtures = await fetchEspnLiveFixtures(scope);
      if (espnFixtures.length > 0) {
        const updatedAt = new Date().toISOString();
        fixturesCache.set(scope, {
          fixtures: espnFixtures,
          updatedAt,
          expiresAt: Date.now() + FIXTURES_TTL_MS,
        });
        res.json({ fixtures: espnFixtures, updatedAt });
        return;
      }

      // 2. Fallback to Gemini Search Grounding only if ESPN returned empty
      const todayStr = new Date().toISOString().split('T')[0];
      const ai = getAiClient();

      const scopeDescription =
        scope === 'brasil'
          ? 'Campeonato Brasileiro Série A, Série B, Copa do Brasil e Copa Libertadores (times brasileiros)'
          : scope === 'principais'
            ? 'Brasileirão Série A, Premier League, La Liga, Serie A Itália, Bundesliga e UEFA Champions League'
            : 'principais campeonatos nacionais e internacionais de futebol do mundo hoje';

      const prompt = `Data de hoje: ${todayStr}. Pesquise na web até 6 partidas de futebol reais que vão acontecer nos próximos dias ou que aconteceram nesta semana envolvendo ${scopeDescription}.
Responda EXCLUSIVAMENTE com um JSON válido no formato:
{
  "fixtures": [
    {
      "homeTeam": "Nome do mandante",
      "awayTeam": "Nome do visitante",
      "competition": "Nome do campeonato",
      "dateLabel": "Data ou status curto (ex: Hoje · 21:30)"
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

      res.json({ fixtures, updatedAt });
    } catch (error: any) {
      const { status, message } = resolveApiError(
        error,
        'Não foi possível buscar jogos atualizados no momento.'
      );
      if (status !== 429) {
        console.error('Error fetching fixtures:', error?.message || error);
      }
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/analyze', async (req, res) => {
    try {
      const homeTeam = String(req.body?.homeTeam || '').trim();
      const awayTeam = String(req.body?.awayTeam || '').trim();
      const competition = String(req.body?.competition || '').trim();
      const forceRefresh = Boolean(req.body?.forceRefresh);

      if (!homeTeam || !awayTeam) {
        res.status(400).json({ error: 'Informe o Time Mandante e o Time Visitante.' });
        return;
      }

      const cacheKey = `${homeTeam.toLowerCase()}::${awayTeam.toLowerCase()}::${competition.toLowerCase()}`;
      const cached = analysisCache.get(cacheKey);
      if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
        res.json(cached.payload);
        return;
      }

      // 1. Primary live sports data provider (ESPN real-time stats, standings, last 5, H2H, boxscores)
      const espnPayload = await analyzeMatchViaEspn(homeTeam, awayTeam, competition);
      if (espnPayload) {
        analysisCache.set(cacheKey, {
          payload: espnPayload,
          expiresAt: Date.now() + ANALYSIS_TTL_MS,
        });
        res.json(espnPayload);
        return;
      }

      // 2. Fallback to Gemini Search Grounding for clubs/competitions not found in ESPN
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
        // Fallback single schema conversion only if raw text was not valid JSON
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

      res.json(payload);
    } catch (error: any) {
      const { status, message } = resolveApiError(
        error,
        'Erro ao buscar dados estatísticos atualizados na Internet. Tente novamente.'
      );
      if (status !== 429) {
        console.error('Error analyzing match:', error?.message || error);
      }
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CampoStats server listening on http://localhost:${PORT}`);
  });
}

startServer();
