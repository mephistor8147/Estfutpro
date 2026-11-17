import { getLiveScoresService, resolveApiError } from '../src/lib/analyzeService.js';
import type { LiveScoreQueryItem } from '../src/types/football.js';
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
      matches?: LiveScoreQueryItem[];
      forceRefresh?: boolean;
      allowWebFallback?: boolean;
    }>(req);

    const matches = Array.isArray(body?.matches) ? body.matches : [];
    const results = await getLiveScoresService(matches, {
      forceRefresh: Boolean(body?.forceRefresh),
      allowWebFallback: Boolean(body?.allowWebFallback),
    });

    res.setHeader('Cache-Control', 'no-store');
    sendJson(res, 200, { results, checkedAt: new Date().toISOString() });
  } catch (error: any) {
    const { status, message } = resolveApiError(
      error,
      'Não foi possível buscar os placares ao vivo na web no momento.'
    );
    console.error('Error fetching live scores:', error?.message || error);
    sendJson(res, status, { error: message });
  }
}
