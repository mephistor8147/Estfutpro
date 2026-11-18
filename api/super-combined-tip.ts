import { getSuperCombinedTipService, resolveApiError } from '../src/lib/analyzeService.js';
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
    let forceRefresh = req.query?.refresh === '1';
    if (req.method === 'POST') {
      const body = await readJsonBody<{ forceRefresh?: boolean }>(req);
      forceRefresh = Boolean(body?.forceRefresh);
    }

    const tip = await getSuperCombinedTipService(forceRefresh);
    res.setHeader('Cache-Control', 'no-store');
    sendJson(res, 200, tip);
  } catch (error: any) {
    if (error?.message === 'NO_SUPER_COMBINED_MATCHES') {
      sendJson(res, 404, {
        error:
          'Nenhum confronto futuro encontrado no calendário oficial neste momento para montar a Super Dica Combinada.',
      });
      return;
    }
    const { status, message } = resolveApiError(
      error,
      'Não foi possível calcular a Super Dica Combinada agora.'
    );
    console.error('Error building super combined tip:', error?.message || error);
    sendJson(res, status, { error: message });
  }
}
