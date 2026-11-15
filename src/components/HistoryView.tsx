import React, { useState } from 'react';
import { CheckCircle2, XCircle, Trash2, BarChart3, Edit3 } from 'lucide-react';
import { TeamCrest } from './TeamCrest.tsx';
import type { PredictionHistoryItem } from '../types/football.ts';

interface HistoryViewProps {
  history: PredictionHistoryItem[];
  onRecordScore: (id: string, homeGoals: number, awayGoals: number) => void;
  onDeleteItem: (id: string) => void;
  onLoadSnapshot: (item: PredictionHistoryItem) => void;
}

function getPredictedFavorite(item: PredictionHistoryItem): 'H' | 'D' | 'A' {
  if (item.predictedHomePct >= item.predictedDrawPct && item.predictedHomePct >= item.predictedAwayPct) {
    return 'H';
  }
  if (item.predictedAwayPct >= item.predictedDrawPct && item.predictedAwayPct >= item.predictedHomePct) {
    return 'A';
  }
  return 'D';
}

function getActualOutcome(homeGoals: number, awayGoals: number): 'H' | 'D' | 'A' {
  if (homeGoals > awayGoals) return 'H';
  if (awayGoals > homeGoals) return 'A';
  return 'D';
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  onRecordScore,
  onDeleteItem,
  onLoadSnapshot,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [homeInput, setHomeInput] = useState<string>('1');
  const [awayInput, setAwayInput] = useState<string>('0');
  const [filterLeague, setFilterLeague] = useState<string>('all');

  const leagues = Array.from(new Set(history.map((h) => h.competition)));
  const filtered =
    filterLeague === 'all' ? history : history.filter((h) => h.competition === filterLeague);

  const finished = history.filter((h) => h.actualScore !== undefined);
  const correct1X2 = finished.filter((h) => {
    if (!h.actualScore) return false;
    return (
      getPredictedFavorite(h) ===
      getActualOutcome(h.actualScore.homeGoals, h.actualScore.awayGoals)
    );
  }).length;

  const hitRatePct = finished.length > 0 ? Math.round((correct1X2 / finished.length) * 100) : null;

  const avgGoalDiff =
    finished.length > 0
      ? (
          finished.reduce((acc, h) => {
            if (!h.actualScore) return acc;
            const predTotal = h.expectedGoalsHome + h.expectedGoalsAway;
            const realTotal = h.actualScore.homeGoals + h.actualScore.awayGoals;
            return acc + Math.abs(predTotal - realTotal);
          }, 0) / finished.length
        ).toFixed(2)
      : null;

  const startEdit = (item: PredictionHistoryItem) => {
    setEditingId(item.id);
    setHomeInput(String(item.actualScore?.homeGoals ?? 1));
    setAwayInput(String(item.actualScore?.awayGoals ?? 0));
  };

  const submitScore = (id: string) => {
    const h = Math.max(0, Math.min(20, parseInt(homeInput, 10) || 0));
    const a = Math.max(0, Math.min(20, parseInt(awayInput, 10) || 0));
    onRecordScore(id, h, a);
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Calibration Summary */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
              Histórico e calibração do modelo
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Compare previsões calculadas com os placares reais após as partidas.
            </p>
          </div>
          <BarChart3 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Previsões salvas</div>
            <div className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
              {history.length}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Jogos finalizados</div>
            <div className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
              {finished.length}
            </div>
          </div>
          <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-800/70 p-3">
            <div className="text-[11px] text-emerald-900 dark:text-emerald-200">Taxa de acerto 1X2</div>
            <div className="font-display text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
              {hitRatePct !== null ? `${hitRatePct}%` : '—'}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Erro médio de gols</div>
            <div className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
              {avgGoalDiff !== null ? avgGoalDiff : '—'}
            </div>
          </div>
        </div>

        {leagues.length > 1 && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setFilterLeague('all')}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                filterLeague === 'all'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todos ({history.length})
            </button>
            {leagues.map((league) => (
              <button
                key={league}
                type="button"
                onClick={() => setFilterLeague(league)}
                className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  filterLeague === league
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {league}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* List of saved items */}
      {filtered.length === 0 ? (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 text-center">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Nenhuma previsão salva ainda
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Analise um confronto na aba Analisador e toque em Salvar previsão para acompanhar sua taxa de acerto por campeonato.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {filtered.map((item) => {
            const isEditing = editingId === item.id;
            const hasResult = item.actualScore !== undefined;
            const isHit =
              hasResult &&
              item.actualScore &&
              getPredictedFavorite(item) ===
                getActualOutcome(item.actualScore.homeGoals, item.actualScore.awayGoals);

            const dateText = new Intl.DateTimeFormat('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(item.createdAt));

            return (
              <article
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                      {item.competition} · {dateText}
                    </span>
                    {hasResult && (
                      <span
                        className={`inline-flex items-center gap-1 font-semibold shrink-0 ${
                          isHit
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {isHit ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        <span>{isHit ? 'Acertou 1X2' : 'Divergiu'}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <TeamCrest
                        name={item.homeTeam.name}
                        shortCode={item.homeTeam.shortCode}
                        primaryColor={item.homeTeam.primaryColor}
                        secondaryColor={item.homeTeam.secondaryColor}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 sm:truncate">
                          {item.homeTeam.name} × {item.awayTeam.name}
                        </div>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                          {item.predictedHomePct}% · {item.predictedDrawPct}% · {item.predictedAwayPct}% · Placar {item.mostLikelyScore}
                        </div>
                      </div>
                    </div>

                    {hasResult && item.actualScore && (
                      <div className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono text-sm font-bold tabular-nums">
                        {item.actualScore.homeGoals} x {item.actualScore.awayGoals}
                      </div>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                        <span className="font-mono font-semibold">{item.homeTeam.shortCode}</span>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={homeInput}
                          onChange={(e) => setHomeInput(e.target.value)}
                          className="w-16 min-h-[44px] px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-center font-mono font-semibold text-slate-900 dark:text-slate-100"
                        />
                      </label>
                      <span className="text-xs font-mono text-slate-400 dark:text-slate-500">x</span>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={awayInput}
                          onChange={(e) => setAwayInput(e.target.value)}
                          className="w-16 min-h-[44px] px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-center font-mono font-semibold text-slate-900 dark:text-slate-100"
                        />
                        <span className="font-mono font-semibold">{item.awayTeam.shortCode}</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto justify-end">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="min-h-[44px] px-3 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => submitScore(item.id)}
                        className="min-h-[44px] px-4 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white"
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Edit3 className="w-3.5 h-3.5 shrink-0" />
                        <span>{hasResult ? 'Editar placar' : 'Registrar placar real'}</span>
                      </button>

                      {item.snapshot && (
                        <button
                          type="button"
                          onClick={() => onLoadSnapshot(item)}
                          className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/80 dark:border-emerald-800 whitespace-nowrap"
                        >
                          Abrir análise
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      aria-label="Excluir previsão"
                      className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
