import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ChampionshipScope } from './src/types/football.js';
import {
  analyzeMatchService,
  getFixturesService,
  getSerieAMultipleService,
  resolveApiError,
  resolveGeminiApiKey,
} from './src/lib/analyzeService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      runtime: 'express',
      hasGeminiKey: Boolean(resolveGeminiApiKey()),
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/fixtures', async (req, res) => {
    try {
      const result = await getFixturesService({
        scope: (req.body?.scope as ChampionshipScope) || 'brasil',
        forceRefresh: Boolean(req.body?.forceRefresh),
      });
      res.json(result);
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

      if (!homeTeam || !awayTeam) {
        res.status(400).json({ error: 'Informe o Time Mandante e o Time Visitante.' });
        return;
      }

      const payload = await analyzeMatchService({
        homeTeam,
        awayTeam,
        competition,
        forceRefresh: Boolean(req.body?.forceRefresh),
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

  app.all('/api/serie-a-multiple', async (req, res) => {
    try {
      const forceRefresh =
        Boolean(req.body?.forceRefresh) || req.query?.refresh === '1';
      const league =
        typeof req.body?.league === 'string'
          ? req.body.league
          : typeof req.query?.league === 'string'
            ? req.query.league
            : 'bra.1';
      const tip = await getSerieAMultipleService(forceRefresh, league);
      res.json(tip);
    } catch (error: any) {
      if (
        error?.message === 'NO_UPCOMING_MULTIPLE_MATCHES' ||
        error?.message === 'NO_UPCOMING_SERIE_A_MATCHES'
      ) {
        res.status(404).json({
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
