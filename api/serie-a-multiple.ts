import { getSerieAMultipleService, resolveApiError } from '../src/lib/analyzeService.js';
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
    let forceRefresh = false;
    if (req.method === 'POST') {
      const body = await readJsonBody<{ forceRefresh?: boolean }>(req);
      forceRefresh = Boolean(body?.forceRefresh);
    }

    const tip = await getSerieAMultipleService(forceRefresh);
    res.setHeader('Cache-Control', 'no-store');
    sendJson(res, 200, tip);
  } catch (error: any) {
    if (error?.message === 'NO_UPCOMING_SERIE_A_MATCHES') {
      sendJson(res, 404, {
        error:
          'Nenhum jogo futuro da Série A disponível no calendário oficial neste momento.',
      });
      return;
    }
    const { status, message } = resolveApiError(
      error,
      'Não foi possível calcular a múltipla da Série A agora.'
    );
    console.error('Error building Serie A multiple:', error?.message || error);
    sendJson(res, status, { error: message });
  }
}
