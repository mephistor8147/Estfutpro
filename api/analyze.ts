import { analyzeMatchService, resolveApiError } from '../src/lib/analyzeService.js';
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
      homeTeam?: string;
      awayTeam?: string;
      competition?: string;
      forceRefresh?: boolean;
    }>(req);

    const homeTeam = String(body?.homeTeam || '').trim();
    const awayTeam = String(body?.awayTeam || '').trim();
    const competition = String(body?.competition || '').trim();

    if (!homeTeam || !awayTeam) {
      sendJson(res, 400, { error: 'Informe o Time Mandante e o Time Visitante.' });
      return;
    }

    const payload = await analyzeMatchService({
      homeTeam,
      awayTeam,
      competition,
      forceRefresh: Boolean(body?.forceRefresh),
    });

    res.setHeader('Cache-Control', 'no-store');
    sendJson(res, 200, payload);
  } catch (error: any) {
    const { status, message } = resolveApiError(
      error,
      'Erro ao buscar dados estatísticos atualizados na Internet. Tente novamente.'
    );
    if (status !== 429) {
      console.error('Error analyzing match:', error?.message || error);
    }
    sendJson(res, status, { error: message });
  }
}
