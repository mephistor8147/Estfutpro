import { getFixturesService, resolveApiError } from '../src/lib/analyzeService.js';
import type { ChampionshipScope, SearchPreferences } from '../src/types/football.js';
import { readJsonBody, sendJson, type VercelReq, type VercelRes } from './_http.js';

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = await readJsonBody<{
      scope?: ChampionshipScope;
      forceRefresh?: boolean;
      searchPreferences?: Partial<SearchPreferences>;
    }>(req);

    const result = await getFixturesService({
      scope: body?.scope || 'brasil',
      forceRefresh: Boolean(body?.forceRefresh),
      searchPreferences: body?.searchPreferences,
    });

    res.setHeader('Cache-Control', 'no-store');
    sendJson(res, 200, result);
  } catch (error: any) {
    const { status, message } = resolveApiError(
      error,
      'Não foi possível buscar jogos atualizados no momento.'
    );
    if (status !== 429) {
      console.error('Error fetching fixtures:', error?.message || error);
    }
    sendJson(res, status, { error: message });
  }
}
