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
    let league =
      typeof req.query?.league === 'string' ? req.query.league : 'bra.1';

    if (req.method === 'POST') {
      const body = await readJsonBody<{
        forceRefresh?: boolean;
        league?: string;
      }>(req);
      forceRefresh = Boolean(body?.forceRefresh);
      if (typeof body?.league === 'string' && body.league.trim()) {
        league = body.league;
      }
    }

    const tip = await getSerieAMultipleService(forceRefresh, league);
    res.setHeader('Cache-Control', 'no-store');
    sendJson(res, 200, tip);
  } catch (error: any) {
    if (
      error?.message === 'NO_UPCOMING_MULTIPLE_MATCHES' ||
      error?.message === 'NO_UPCOMING_SERIE_A_MATCHES'
    ) {
      sendJson(res, 404, {
        error:
          'Nenhum jogo futuro encontrado para esta competição no calendário oficial neste momento. Selecione outra liga ou "Principais do Mundo".',
      });
      return;
    }
    const { status, message } = resolveApiError(
      error,
      'Não foi possível calcular a múltipla desta competição agora.'
    );
    console.error('Error building multiple tip:', error?.message || error);
    sendJson(res, status, { error: message });
  }
}
