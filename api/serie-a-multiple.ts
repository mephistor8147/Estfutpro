import { getSerieAMultipleService, resolveApiError } from '../src/lib/analyzeService.js';
import type { MultipleDayFilter } from '../src/types/football.js';
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
      typeof req.query?.league === 'string' ? req.query.league : 'today';
    let count =
      typeof req.query?.count === 'string' ? Number(req.query.count) : 3;
    let onlyToday = req.query?.onlyToday === '1';
    let dayFilterRaw =
      typeof req.query?.dayFilter === 'string' ? req.query.dayFilter : undefined;

    if (req.method === 'POST') {
      const body = await readJsonBody<{
        forceRefresh?: boolean;
        league?: string;
        count?: number;
        onlyToday?: boolean;
        dayFilter?: string;
      }>(req);
      forceRefresh = Boolean(body?.forceRefresh);
      if (typeof body?.league === 'string' && body.league.trim()) {
        league = body.league;
      }
      if (body?.count !== undefined) {
        count = Number(body.count);
      }
      if (body?.onlyToday !== undefined) {
        onlyToday = Boolean(body.onlyToday);
      }
      if (typeof body?.dayFilter === 'string') {
        dayFilterRaw = body.dayFilter;
      }
    }

    const dayFilter: MultipleDayFilter =
      dayFilterRaw === 'today' || dayFilterRaw === 'tomorrow' || dayFilterRaw === 'all'
        ? dayFilterRaw
        : onlyToday
          ? 'today'
          : 'all';

    const tip = await getSerieAMultipleService(forceRefresh, league, count, dayFilter);
    res.setHeader('Cache-Control', 'no-store');
    sendJson(res, 200, tip);
  } catch (error: any) {
    if (error?.message === 'NO_TOMORROW_MULTIPLE_MATCHES') {
      sendJson(res, 404, {
        error:
          'Nenhum jogo encontrado para amanhã nesta competição no calendário oficial. Experimente "Jogos de Amanhã (Mundial)" ou desative o filtro de dia.',
      });
      return;
    }
    if (error?.message === 'NO_TODAY_MULTIPLE_MATCHES') {
      sendJson(res, 404, {
        error:
          'Nenhum jogo futuro agendado para hoje nesta competição. Desative "Somente hoje" para ver os próximos jogos ou selecione "Jogos de Hoje (Mundial)".',
      });
      return;
    }
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
