import { checkMultipleResultsService, resolveApiError } from '../src/lib/analyzeService.js';
import type { MultipleLegCheckInput } from '../src/lib/espnProvider.js';
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
    const body = await readJsonBody<{ legs?: MultipleLegCheckInput[] }>(req);
    const legs = Array.isArray(body?.legs) ? body.legs : [];
    const results = await checkMultipleResultsService(legs);
    res.setHeader('Cache-Control', 'no-store');
    sendJson(res, 200, { results, checkedAt: new Date().toISOString() });
  } catch (error: any) {
    const { status, message } = resolveApiError(
      error,
      'Não foi possível verificar os placares das múltiplas na ESPN.'
    );
    console.error('Error checking multiple results:', error?.message || error);
    sendJson(res, status, { error: message });
  }
}
