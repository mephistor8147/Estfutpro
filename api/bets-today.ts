import { getDailyBettingMatchesService, resolveApiError } from '../src/lib/analyzeService.js';
import { readJsonBody, sendJson, type VercelReq, type VercelRes } from './_http.js';

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const body =
      req.method === 'POST'
        ? await readJsonBody<{
            forceRefresh?: boolean;
            oddsMarginPct?: number;
            includeLive?: boolean;
            favoriteLeagues?: string[];
          }>(req)
        : {};

    const forceRefresh =
      Boolean(body?.forceRefresh) || req.query?.refresh === '1';
    const oddsMarginRaw = body?.oddsMarginPct ?? req.query?.oddsMarginPct;
    const oddsMarginPct =
      oddsMarginRaw !== undefined ? Number(oddsMarginRaw) : 5;
    const includeLive =
      body?.includeLive !== undefined
        ? Boolean(body.includeLive)
        : req.query?.includeLive !== '0';
    const favoriteLeagues = Array.isArray(body?.favoriteLeagues)
      ? body.favoriteLeagues
      : [];

    const result = await getDailyBettingMatchesService({
      forceRefresh,
      oddsMarginPct: Number.isFinite(oddsMarginPct) ? oddsMarginPct : 5,
      includeLive,
      favoriteLeagues,
    });

    res.setHeader('Cache-Control', 'no-store');
    sendJson(res, 200, result);
  } catch (error: any) {
    const { status, message } = resolveApiError(
      error,
      'Não foi possível carregar os jogos de hoje com odds no momento.'
    );
    if (status !== 429) {
      console.error('Error fetching daily betting matches:', error?.message || error);
    }
    sendJson(res, status, { error: message });
  }
}
