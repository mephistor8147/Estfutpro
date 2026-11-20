import type {
  MultipleHistoryItem,
  MultipleHistoryLeg,
  PredictionHistoryItem,
  SerieAMultipleTip,
  SuperCombinedLeg,
  SuperSameGameCombo,
  SuperTipMarketCategory,
} from '../types/football';

export interface MultipleImagePayload {
  tip: SerieAMultipleTip;
  legOdds: number[];
  totalOdd: number;
  stake: number;
  potentialReturn: number;
  potentialProfit: number;
}

export function formatBrlCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function buildWhatsappSummaryText(payload: MultipleImagePayload): string {
  const { tip, legOdds, totalOdd, stake, potentialReturn, potentialProfit } = payload;
  const isMultiLeague =
    tip.leagueSlug === 'world' ||
    tip.leagueSlug === 'today' ||
    tip.leagueSlug === 'tomorrow';
  const lines = [
    `*Dica Quente · ${tip.competition}* (CampoStats)`,
    ``,
    ...tip.legs.map((leg, i) => {
      const odd = legOdds[i] ?? 1;
      const compSuffix = isMultiLeague && leg.competition ? ` · ${leg.competition}` : '';
      return `${i + 1}. *${leg.homeTeam} × ${leg.awayTeam}* (${leg.dateLabel}${compSuffix})\n   Palpite: *${leg.marketLabel}* · ${leg.probabilityPct}% · Odd ${odd.toFixed(2)}`;
    }),
    ``,
    `Probabilidade combinada (Poisson): *${tip.combinedProbabilityPct}%*`,
    `Odd total: *${totalOdd.toFixed(2)}*`,
    `Valor simulado: *${formatBrlCurrency(stake)}*`,
    `Ganho potencial: *${formatBrlCurrency(potentialReturn)}* (+${formatBrlCurrency(potentialProfit)})`,
  ];
  return lines.join('\n');
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  // Add ellipsis if text exceeded maxLines
  if (lines.length === maxLines) {
    const consumedWords = lines.join(' ').split(/\s+/).length;
    if (consumedWords < words.length) {
      let last = lines[maxLines - 1];
      while (last.length > 3 && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1).trimEnd();
      }
      lines[maxLines - 1] = `${last}…`;
    }
  }

  return lines;
}

export async function generateMultipleTipPng(
  payload: MultipleImagePayload
): Promise<{ blob: Blob; dataUrl: string; fileName: string }> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font loading warnings
    }
  }

  const { tip, legOdds, totalOdd, stake, potentialReturn, potentialProfit } = payload;

  const width = 1080;
  const paddingX = 64;
  const cardWidth = width - paddingX * 2;
  const legCardHeight = 224;
  const legGap = 24;
  const legsCount = tip.legs.length;

  const headerHeight = 200;
  const legsBlockHeight = legsCount * legCardHeight + Math.max(0, legsCount - 1) * legGap;
  const summaryHeight = 220;
  const footerHeight = 96;
  const height = 56 + headerHeight + legsBlockHeight + 32 + summaryHeight + footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('CANVAS_UNAVAILABLE');
  }

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#071318');
  bgGrad.addColorStop(0.55, '#0b1923');
  bgGrad.addColorStop(1, '#091119');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle emerald glow top-right
  const glow = ctx.createRadialGradient(width - 140, 120, 20, width - 140, 120, 420);
  glow.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
  glow.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Header brand + title
  let cursorY = 64;

  ctx.fillStyle = '#34D399';
  ctx.font = '700 24px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText('CAMPOSTATS · ANALISADOR ESTATÍSTICO', paddingX, cursorY + 24);

  cursorY += 56;
  ctx.fillStyle = '#F8FAFC';
  const headerTitle = `DICA QUENTE · ${tip.competition.toUpperCase()}`;
  const titleFontSize = headerTitle.length > 34 ? 42 : headerTitle.length > 26 ? 48 : 54;
  ctx.font = `700 ${titleFontSize}px "Barlow Condensed", "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillText(headerTitle, paddingX, cursorY + 46, cardWidth);

  cursorY += 68;
  const updatedStr = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(tip.updatedAt));

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 24px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `${tip.competition} · ${legsCount} ${legsCount === 1 ? 'seleção' : 'seleções'} · Modelo Poisson · ${updatedStr}`,
    paddingX,
    cursorY + 22
  );

  // Divider line
  cursorY += 52;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(paddingX, cursorY);
  ctx.lineTo(width - paddingX, cursorY);
  ctx.stroke();

  cursorY += 28;
  const isMultiLeague =
    tip.leagueSlug === 'world' ||
    tip.leagueSlug === 'today' ||
    tip.leagueSlug === 'tomorrow';

  // Leg Cards
  tip.legs.forEach((leg, idx) => {
    const cardY = cursorY;
    const oddVal = legOdds[idx] ?? 1;

    drawRoundedRect(ctx, paddingX, cardY, cardWidth, legCardHeight, 24);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const innerX = paddingX + 32;
    const innerRight = paddingX + cardWidth - 32;

    // Top row: Jogo # + (league in multi-league mode) + date | xG
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 22px "Plus Jakarta Sans", system-ui, sans-serif';
    const topLeftLabel =
      isMultiLeague && leg.competition
        ? `JOGO ${idx + 1} · ${leg.competition.toUpperCase()} · ${leg.dateLabel.toUpperCase()}`
        : `JOGO ${idx + 1} · ${leg.dateLabel.toUpperCase()}`;
    ctx.fillText(topLeftLabel, innerX, cardY + 42, cardWidth - 260);

    const xgText = `xG ${leg.expectedGoalsHome.toFixed(1)} – ${leg.expectedGoalsAway.toFixed(1)}`;
    ctx.font = '600 22px "JetBrains Mono", monospace';
    const xgW = ctx.measureText(xgText).width;
    ctx.fillText(xgText, innerRight - xgW, cardY + 42);

    // Matchup title
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 34px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`${leg.homeTeam} × ${leg.awayTeam}`, innerX, cardY + 90);

    // Market pick + Probability + Odd
    ctx.fillStyle = '#34D399';
    ctx.font = '700 28px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(leg.marketLabel, innerX, cardY + 138);

    const oddText = `Odd ${oddVal.toFixed(2)}`;
    const probText = `${leg.probabilityPct}%`;

    ctx.font = '700 28px "JetBrains Mono", monospace';
    const oddW = ctx.measureText(oddText).width;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(oddText, innerRight - oddW, cardY + 138);

    ctx.fillStyle = '#34D399';
    const probW = ctx.measureText(probText).width;
    ctx.fillText(probText, innerRight - oddW - 24 - probW, cardY + 138);

    // Rationale (max 2 lines)
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '400 21px "Plus Jakarta Sans", system-ui, sans-serif';
    const rationaleLines = wrapTextLines(ctx, leg.rationale, cardWidth - 64, 2);
    rationaleLines.forEach((line, lIdx) => {
      ctx.fillText(line, innerX, cardY + 178 + lIdx * 28);
    });

    cursorY += legCardHeight + legGap;
  });

  cursorY += 8;

  // Summary / Return Box
  drawRoundedRect(ctx, paddingX, cursorY, cardWidth, summaryHeight, 26);
  const sumGrad = ctx.createLinearGradient(paddingX, cursorY, paddingX + cardWidth, cursorY + summaryHeight);
  sumGrad.addColorStop(0, 'rgba(6, 78, 59, 0.52)');
  sumGrad.addColorStop(1, 'rgba(15, 23, 42, 0.94)');
  ctx.fillStyle = sumGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const colWidth = (cardWidth - 64) / 3;
  const metricY = cursorY + 54;
  const valueY = cursorY + 104;

  // Col 1: Prob combinada
  ctx.fillStyle = '#A7F3D0';
  ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('PROB. COMBINADA', paddingX + 32, metricY);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 44px "JetBrains Mono", monospace';
  ctx.fillText(`${tip.combinedProbabilityPct}%`, paddingX + 32, valueY);

  // Col 2: Odd total
  ctx.fillStyle = '#A7F3D0';
  ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('ODD TOTAL', paddingX + 32 + colWidth, metricY);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 44px "JetBrains Mono", monospace';
  ctx.fillText(totalOdd.toFixed(2), paddingX + 32 + colWidth, valueY);

  // Col 3: Aposta simulada
  ctx.fillStyle = '#A7F3D0';
  ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('VALOR SIMULADO', paddingX + 32 + colWidth * 2, metricY);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 40px "JetBrains Mono", monospace';
  ctx.fillText(formatBrlCurrency(stake), paddingX + 32 + colWidth * 2, valueY);

  // Bottom highlight row: Ganho potencial + Lucro
  ctx.strokeStyle = 'rgba(167, 243, 208, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(paddingX + 32, cursorY + 132);
  ctx.lineTo(paddingX + cardWidth - 32, cursorY + 132);
  ctx.stroke();

  ctx.fillStyle = '#D1FAE5';
  ctx.font = '600 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('GANHO POTENCIAL', paddingX + 32, cursorY + 180);

  const profitText = `Lucro +${formatBrlCurrency(potentialProfit)}`;
  const returnText = formatBrlCurrency(potentialReturn);

  ctx.font = '700 38px "JetBrains Mono", monospace';
  const returnW = ctx.measureText(returnText).width;
  ctx.fillStyle = '#34D399';
  ctx.fillText(returnText, paddingX + cardWidth - 32 - returnW, cursorY + 184);

  ctx.font = '600 22px "Plus Jakarta Sans", system-ui, sans-serif';
  const profitW = ctx.measureText(profitText).width;
  ctx.fillStyle = '#A7F3D0';
  ctx.fillText(profitText, paddingX + cardWidth - 32 - returnW - 24 - profitW, cursorY + 180);

  // Footer disclaimer
  const footerY = cursorY + summaryHeight + 48;
  ctx.fillStyle = '#64748B';
  ctx.font = '500 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    `Modelo Poisson · Dados ao vivo ESPN (${tip.competition}) · Análise informativa`,
    paddingX,
    footerY
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('BLOB_FAILED'));
    }, 'image/png');
  });

  const dataUrl = canvas.toDataURL('image/png');
  const dateTag = new Date().toISOString().slice(0, 10);
  const slugPart = (tip.leagueSlug || 'multipla').replace(/[^a-z0-9-]+/gi, '-');
  return {
    blob,
    dataUrl,
    fileName: `campostats-multipla-${slugPart}-${dateTag}.png`,
  };
}

export interface SuperCombinedImagePayload {
  mode: 'multi' | 'same-game';
  scopeLabel: string;
  updatedAt: string;
  legs: SuperCombinedLeg[];
  sameGame?: SuperSameGameCombo | null;
  combinedProbabilityPct: number;
  avgProbabilityPct: number;
  fairOddEstimate: number;
}

function getCanvasCategoryHex(category: SuperTipMarketCategory): string {
  switch (category) {
    case 'result':
      return '#34D399';
    case 'goals':
      return '#60A5FA';
    case 'btts':
      return '#C084FC';
    case 'cards':
      return '#FBBF24';
    case 'corners':
      return '#22D3EE';
  }
}

export function buildSuperCombinedWhatsappText(
  payload: SuperCombinedImagePayload
): string {
  const {
    mode,
    scopeLabel,
    legs,
    sameGame,
    combinedProbabilityPct,
    avgProbabilityPct,
    fairOddEstimate,
  } = payload;

  if (mode === 'same-game' && sameGame) {
    const lines = [
      `*Super Dica Combinada · Mesmo Jogo* (CampoStats)`,
      `*${sameGame.homeTeam} × ${sameGame.awayTeam}* (${sameGame.competition} · ${sameGame.dateLabel})`,
      `1X2: Casa ${sameGame.homeWinPct}% · Empate ${sameGame.drawPct}% · Fora ${sameGame.awayWinPct}%`,
      ``,
      ...legs.map(
        (leg, idx) =>
          `${idx + 1}. [${leg.categoryLabel}] *${leg.marketLabel}* · ${leg.probabilityPct}% (@${leg.fairOdd.toFixed(2)})`
      ),
      ``,
      `Margem combinada (Poisson): *${combinedProbabilityPct}%*`,
      `Média por mercado: *${avgProbabilityPct}%*`,
      `Odd justa estimada: *${fairOddEstimate.toFixed(2)}x*`,
    ];
    return lines.join('\n');
  }

  const lines = [
    `*Super Dica Combinada · ${scopeLabel}* (CampoStats)`,
    ``,
    ...legs.map(
      (leg, idx) =>
        `${idx + 1}. [${leg.categoryLabel}] *${leg.homeTeam} × ${leg.awayTeam}* (${leg.competition} · ${leg.dateLabel})\n   Palpite: *${leg.marketLabel}* · ${leg.probabilityPct}% (@${leg.fairOdd.toFixed(2)})`
    ),
    ``,
    `Margem combinada: *${combinedProbabilityPct}%*`,
    `Média por mercado: *${avgProbabilityPct}%*`,
    `Odd justa estimada: *${fairOddEstimate.toFixed(2)}x*`,
  ];
  return lines.join('\n');
}

export async function generateSuperCombinedTipPng(
  payload: SuperCombinedImagePayload
): Promise<{ blob: Blob; dataUrl: string; fileName: string }> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font loading warnings
    }
  }

  const {
    mode,
    scopeLabel,
    updatedAt,
    legs,
    sameGame,
    combinedProbabilityPct,
    avgProbabilityPct,
    fairOddEstimate,
  } = payload;

  const isSameGame = mode === 'same-game' && Boolean(sameGame);
  const width = 1080;
  const paddingX = 64;
  const cardWidth = width - paddingX * 2;
  const legCardHeight = isSameGame ? 188 : 236;
  const legGap = 22;
  const legsCount = legs.length;

  const headerHeight = 196;
  const matchBannerHeight = isSameGame ? 148 : 0;
  const legsBlockHeight =
    legsCount * legCardHeight + Math.max(0, legsCount - 1) * legGap;
  const summaryHeight = 158;
  const footerHeight = 88;
  const height =
    56 +
    headerHeight +
    matchBannerHeight +
    (isSameGame ? 24 : 0) +
    legsBlockHeight +
    32 +
    summaryHeight +
    footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('CANVAS_UNAVAILABLE');
  }

  // Deep slate-emerald studio background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#071318');
  bgGrad.addColorStop(0.55, '#0B1923');
  bgGrad.addColorStop(1, '#091119');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width - 130, 110, 20, width - 130, 110, 440);
  glow.addColorStop(0, 'rgba(16, 185, 129, 0.24)');
  glow.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  let cursorY = 62;

  ctx.fillStyle = '#34D399';
  ctx.font = '700 23px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText('CAMPOSTATS · MELHOR MARGEM DE ACERTO', paddingX, cursorY + 22);

  cursorY += 54;
  ctx.fillStyle = '#F8FAFC';
  const mainTitle = isSameGame
    ? 'SUPER DICA COMBINADA · MESMO JOGO'
    : 'SUPER DICA COMBINADA · MULTI-JOGOS';
  ctx.font = '700 50px "Barlow Condensed", "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(mainTitle, paddingX, cursorY + 44, cardWidth);

  cursorY += 66;
  const updatedStr = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(updatedAt));

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 22px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `${scopeLabel} · ${legsCount} mercados · Modelo Poisson + ESPN · ${updatedStr}`,
    paddingX,
    cursorY + 20,
    cardWidth
  );

  // Hairline divider
  cursorY += 48;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(paddingX, cursorY);
  ctx.lineTo(width - paddingX, cursorY);
  ctx.stroke();

  cursorY += 26;

  // Featured Match Banner in Same-Game Mode
  if (isSameGame && sameGame) {
    drawRoundedRect(ctx, paddingX, cursorY, cardWidth, matchBannerHeight, 22);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const innerX = paddingX + 32;
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 21px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(
      `${sameGame.competition.toUpperCase()} · ${sameGame.dateLabel.toUpperCase()}`,
      innerX,
      cursorY + 40,
      cardWidth - 64
    );

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 38px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(
      `${sameGame.homeTeam} × ${sameGame.awayTeam}`,
      innerX,
      cursorY + 90,
      cardWidth - 64
    );

    const extraParts = [
      `Casa ${sameGame.homeWinPct}% · Empate ${sameGame.drawPct}% · Fora ${sameGame.awayWinPct}%`,
      `xG ${sameGame.expectedGoalsHome.toFixed(1)}–${sameGame.expectedGoalsAway.toFixed(1)}`,
    ];
    if (sameGame.expectedCardsTotal !== null) {
      extraParts.push(
        `Cartões est. ${sameGame.expectedCardsTotal.toFixed(1).replace('.', ',')}`
      );
    }
    if (sameGame.expectedCornersTotal !== null) {
      extraParts.push(
        `Escanteios est. ${sameGame.expectedCornersTotal.toFixed(1).replace('.', ',')}`
      );
    }
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '500 20px "JetBrains Mono", monospace';
    ctx.fillText(extraParts.join('  ·  '), innerX, cursorY + 128, cardWidth - 64);

    cursorY += matchBannerHeight + 24;
  }

  // Selection Cards
  legs.forEach((leg) => {
    const cardY = cursorY;
    const catColor = getCanvasCategoryHex(leg.category);

    drawRoundedRect(ctx, paddingX, cardY, cardWidth, legCardHeight, 22);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const innerX = paddingX + 32;
    const innerRight = paddingX + cardWidth - 32;
    const innerWidth = cardWidth - 64;

    // Top row: Category accent + competition/date or stat highlight
    ctx.fillStyle = catColor;
    ctx.font = '700 21px "Plus Jakarta Sans", system-ui, sans-serif';
    const catLabel = leg.categoryLabel.toUpperCase();
    ctx.fillText(catLabel, innerX, cardY + 38);

    const topRightText = isSameGame
      ? leg.statHighlight
      : `${leg.competition || ''} · ${leg.dateLabel}`;
    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 20px "Plus Jakarta Sans", system-ui, sans-serif';
    const topRightW = Math.min(ctx.measureText(topRightText).width, innerWidth - 260);
    ctx.fillText(topRightText, innerRight - topRightW, cardY + 38, innerWidth - 260);

    let pickY = cardY + 86;

    if (!isSameGame) {
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 32px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(
        `${leg.homeTeam} × ${leg.awayTeam}`,
        innerX,
        cardY + 84,
        innerWidth
      );
      pickY = cardY + 132;
    }

    // Market pick + Prob% + Fair Odd
    const oddText = `@${leg.fairOdd.toFixed(2)}`;
    const probText = `${leg.probabilityPct}%`;

    ctx.font = '700 26px "JetBrains Mono", monospace';
    const oddW = ctx.measureText(oddText).width;
    const probW = ctx.measureText(probText).width;

    ctx.fillStyle = '#94A3B8';
    ctx.fillText(oddText, innerRight - oddW, pickY);

    ctx.fillStyle = '#34D399';
    ctx.fillText(probText, innerRight - oddW - 18 - probW, pickY);

    const pickMaxW = innerWidth - oddW - probW - 36;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 28px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(leg.marketLabel, innerX, pickY, pickMaxW);

    // Hit Margin Progress Bar
    const barY = pickY + 18;
    drawRoundedRect(ctx, innerX, barY, innerWidth, 10, 5);
    ctx.fillStyle = 'rgba(51, 65, 85, 0.85)';
    ctx.fill();

    const fillW = Math.max(
      24,
      Math.round((Math.min(100, Math.max(5, leg.probabilityPct)) / 100) * innerWidth)
    );
    drawRoundedRect(ctx, innerX, barY, fillW, 10, 5);
    ctx.fillStyle = catColor;
    ctx.fill();

    // Rationale / stat highlight
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '400 20px "Plus Jakarta Sans", system-ui, sans-serif';
    const subText = isSameGame
      ? leg.rationale
      : `${leg.statHighlight} · ${leg.rationale}`;
    const wrapped = wrapTextLines(ctx, subText, innerWidth, 2);
    wrapped.forEach((line, idx) => {
      ctx.fillText(line, innerX, barY + 34 + idx * 25);
    });

    cursorY += legCardHeight + legGap;
  });

  cursorY += 10;

  // Summary Metrics Strip
  drawRoundedRect(ctx, paddingX, cursorY, cardWidth, summaryHeight, 24);
  const sumGrad = ctx.createLinearGradient(
    paddingX,
    cursorY,
    paddingX + cardWidth,
    cursorY + summaryHeight
  );
  sumGrad.addColorStop(0, 'rgba(6, 78, 59, 0.56)');
  sumGrad.addColorStop(1, 'rgba(15, 23, 42, 0.94)');
  ctx.fillStyle = sumGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.48)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const colWidth = (cardWidth - 64) / 3;
  const labelY = cursorY + 52;
  const valY = cursorY + 112;

  ctx.fillStyle = '#A7F3D0';
  ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('MARGEM COMBINADA', paddingX + 32, labelY);
  ctx.fillStyle = '#34D399';
  ctx.font = '700 48px "JetBrains Mono", monospace';
  ctx.fillText(`${combinedProbabilityPct}%`, paddingX + 32, valY);

  ctx.fillStyle = '#A7F3D0';
  ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('MÉDIA / MERCADO', paddingX + 32 + colWidth, labelY);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 48px "JetBrains Mono", monospace';
  ctx.fillText(`${avgProbabilityPct}%`, paddingX + 32 + colWidth, valY);

  ctx.fillStyle = '#A7F3D0';
  ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('ODD JUSTA EST.', paddingX + 32 + colWidth * 2, labelY);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 48px "JetBrains Mono", monospace';
  ctx.fillText(`${fairOddEstimate.toFixed(2)}x`, paddingX + 32 + colWidth * 2, valY);

  // Footer
  const footerY = cursorY + summaryHeight + 48;
  ctx.fillStyle = '#64748B';
  ctx.font = '500 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    'CampoStats · Modelo Poisson + Súmulas ESPN (Gols, Ambas Marcam, Cartões e 1X2)',
    paddingX,
    footerY,
    cardWidth
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('BLOB_FAILED'));
    }, 'image/png');
  });

  const dataUrl = canvas.toDataURL('image/png');
  const dateTag = new Date().toISOString().slice(0, 10);
  const modeTag = isSameGame ? 'mesmo-jogo' : 'multi-jogos';
  return {
    blob,
    dataUrl,
    fileName: `campostats-super-combinada-${modeTag}-${dateTag}.png`,
  };
}

function resolveMultipleLegScore(leg: MultipleHistoryLeg): {
  homeGoals: number;
  awayGoals: number;
  isLive: boolean;
  isPost: boolean;
  statusLabel: string;
} {
  const isLive = leg.liveScore?.state === 'in';
  const isPost = leg.liveScore?.state === 'post' || leg.actualScore !== undefined;

  if (isLive && leg.liveScore) {
    return {
      homeGoals: leg.liveScore.homeGoals,
      awayGoals: leg.liveScore.awayGoals,
      isLive: true,
      isPost: false,
      statusLabel: leg.liveScore.statusDetail || 'Ao vivo',
    };
  }
  if (leg.actualScore) {
    return {
      homeGoals: leg.actualScore.homeGoals,
      awayGoals: leg.actualScore.awayGoals,
      isLive: false,
      isPost: true,
      statusLabel: leg.liveScore?.statusDetail || leg.actualScore.statusDetail || 'Finalizado',
    };
  }
  if (leg.liveScore?.state === 'post') {
    return {
      homeGoals: leg.liveScore.homeGoals,
      awayGoals: leg.liveScore.awayGoals,
      isLive: false,
      isPost: true,
      statusLabel: leg.liveScore.statusDetail || 'Finalizado',
    };
  }
  return {
    homeGoals: 0,
    awayGoals: 0,
    isLive: false,
    isPost: false,
    statusLabel: leg.liveScore?.statusDetail || leg.dateLabel,
  };
}

function hasLegDisplayedScore(leg: MultipleHistoryLeg): boolean {
  return (
    leg.liveScore?.state === 'in' ||
    leg.liveScore?.state === 'post' ||
    leg.actualScore !== undefined
  );
}

export function buildMultipleResultWhatsappText(
  item: MultipleHistoryItem
): string {
  const statusTitle =
    item.status === 'won'
      ? 'ACERTO'
      : item.status === 'lost'
        ? 'PERDA'
        : 'EM ANDAMENTO';

  const netValue =
    item.status === 'won'
      ? item.potentialReturn - item.stake
      : item.status === 'lost'
        ? -item.stake
        : 0;

  const netStr =
    item.status === 'pending'
      ? 'Em aberto'
      : `${netValue >= 0 ? '+' : '-'}${formatBrlCurrency(Math.abs(netValue))}`;

  const stakeLabel = item.source === 'image' ? 'Valor apostado' : 'Valor simulado';

  const legLines = item.legs.map((leg, idx) => {
    const scoreInfo = resolveMultipleLegScore(leg);
    const hasScore = hasLegDisplayedScore(leg);
    const scoreStr = hasScore
      ? ` · Placar: *${scoreInfo.homeGoals} × ${scoreInfo.awayGoals}* (${scoreInfo.statusLabel})`
      : ` · ${scoreInfo.statusLabel}`;
    const legStatusStr =
      leg.status === 'won' ? 'Acerto' : leg.status === 'lost' ? 'Perda' : 'Pendente';
    const oddPart = leg.odd > 1 ? ` · Odd ${leg.odd.toFixed(2)}` : '';
    const probPart = leg.probabilityPct > 0 ? ` (${leg.probabilityPct}%)` : '';
    return `${idx + 1}. *${leg.homeTeam} × ${leg.awayTeam}*${scoreStr}\n   ${leg.marketLabel}${oddPart}${probPart} · [${legStatusStr}]`;
  });

  const lines = [
    `*Resultado · ${statusTitle} · ${item.competition}* (CampoStats)`,
    ``,
    ...legLines,
    ``,
    `Odd total: *${item.totalOdd.toFixed(2)}*`,
    `${stakeLabel}: *${formatBrlCurrency(item.stake)}*`,
    `Retorno alvo: *${formatBrlCurrency(item.potentialReturn)}*`,
    `Resultado líquido: *${netStr}*`,
  ];

  return lines.join('\n');
}

export async function generateMultipleResultPng(
  item: MultipleHistoryItem
): Promise<{ blob: Blob; dataUrl: string; fileName: string }> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font loading warnings
    }
  }

  const width = 1080;
  const paddingX = 64;
  const cardWidth = width - paddingX * 2;
  const legCardHeight = 196;
  const legGap = 20;
  const legsCount = item.legs.length;

  const headerHeight = 192;
  const legsBlockHeight =
    legsCount * legCardHeight + Math.max(0, legsCount - 1) * legGap;
  const summaryHeight = 216;
  const footerHeight = 92;
  const height =
    56 + headerHeight + legsBlockHeight + 32 + summaryHeight + footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('CANVAS_UNAVAILABLE');
  }

  const statusTheme =
    item.status === 'won'
      ? {
          label: 'ACERTO',
          hex: '#34D399',
          pillBg: 'rgba(16, 185, 129, 0.18)',
          pillBorder: 'rgba(52, 211, 153, 0.55)',
          glow: 'rgba(16, 185, 129, 0.24)',
          sumStart: 'rgba(6, 78, 59, 0.55)',
        }
      : item.status === 'lost'
        ? {
            label: 'PERDA',
            hex: '#FB7185',
            pillBg: 'rgba(244, 63, 94, 0.18)',
            pillBorder: 'rgba(251, 113, 133, 0.55)',
            glow: 'rgba(244, 63, 94, 0.22)',
            sumStart: 'rgba(136, 19, 55, 0.45)',
          }
        : {
            label: 'EM ANDAMENTO',
            hex: '#FBBF24',
            pillBg: 'rgba(245, 158, 11, 0.18)',
            pillBorder: 'rgba(251, 191, 36, 0.55)',
            glow: 'rgba(245, 158, 11, 0.2)',
            sumStart: 'rgba(120, 53, 15, 0.42)',
          };

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#071318');
  bgGrad.addColorStop(0.55, '#0B1923');
  bgGrad.addColorStop(1, '#091119');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width - 130,
    110,
    20,
    width - 130,
    110,
    430
  );
  glow.addColorStop(0, statusTheme.glow);
  glow.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Header
  let cursorY = 62;
  ctx.fillStyle = statusTheme.hex;
  ctx.font = '700 23px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText('CAMPOSTATS · RESULTADO NO HISTÓRICO', paddingX, cursorY + 22);

  // Top-right status pill
  ctx.font = '700 24px "Plus Jakarta Sans", system-ui, sans-serif';
  const pillW = Math.max(170, ctx.measureText(statusTheme.label).width + 48);
  const pillX = width - paddingX - pillW;
  drawRoundedRect(ctx, pillX, cursorY - 4, pillW, 46, 23);
  ctx.fillStyle = statusTheme.pillBg;
  ctx.fill();
  ctx.strokeStyle = statusTheme.pillBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = statusTheme.hex;
  const pillTextW = ctx.measureText(statusTheme.label).width;
  ctx.fillText(statusTheme.label, pillX + (pillW - pillTextW) / 2, cursorY + 28);

  cursorY += 56;
  ctx.fillStyle = '#F8FAFC';
  const titleText = item.competition.toUpperCase();
  const titleSize = titleText.length > 32 ? 42 : titleText.length > 24 ? 48 : 54;
  ctx.font = `700 ${titleSize}px "Barlow Condensed", "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillText(titleText, paddingX, cursorY + 46, cardWidth);

  cursorY += 66;
  const dateStr = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(item.createdAt));

  const subParts = [
    `${legsCount} ${legsCount === 1 ? 'jogo' : 'jogos'}`,
    item.combinedProbabilityPct > 0
      ? `Prob. ${item.combinedProbabilityPct}%`
      : null,
    item.source === 'image'
      ? item.bookmaker
        ? `${item.bookmaker} · Bilhete importado`
        : 'Bilhete importado'
      : 'Dica salva',
    dateStr,
  ].filter(Boolean);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 22px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText(subParts.join(' · '), paddingX, cursorY + 20, cardWidth);

  cursorY += 46;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(paddingX, cursorY);
  ctx.lineTo(width - paddingX, cursorY);
  ctx.stroke();

  cursorY += 26;

  // Legs
  item.legs.forEach((leg, idx) => {
    const cardY = cursorY;
    const scoreInfo = resolveMultipleLegScore(leg);
    const hasScore = hasLegDisplayedScore(leg);

    const legBadge =
      leg.status === 'won'
        ? {
            label: 'ACERTO',
            color: '#34D399',
            bg: 'rgba(16, 185, 129, 0.16)',
            border: 'rgba(52, 211, 153, 0.45)',
          }
        : leg.status === 'lost'
          ? {
              label: 'PERDA',
              color: '#FB7185',
              bg: 'rgba(244, 63, 94, 0.16)',
              border: 'rgba(251, 113, 133, 0.45)',
            }
          : {
              label: 'PENDENTE',
              color: '#CBD5E1',
              bg: 'rgba(148, 163, 184, 0.14)',
              border: 'rgba(148, 163, 184, 0.35)',
            };

    drawRoundedRect(ctx, paddingX, cardY, cardWidth, legCardHeight, 22);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fill();
    ctx.strokeStyle = scoreInfo.isLive
      ? 'rgba(251, 113, 133, 0.48)'
      : 'rgba(148, 163, 184, 0.24)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const innerX = paddingX + 32;
    const innerRight = paddingX + cardWidth - 32;

    // Top row: Jogo # + competition + statusLabel | Leg Status Pill
    const metaLabel = [
      `JOGO ${idx + 1}`,
      leg.competition ? leg.competition.toUpperCase() : null,
      scoreInfo.isLive
        ? `AO VIVO · ${scoreInfo.statusLabel.toUpperCase()}`
        : scoreInfo.statusLabel.toUpperCase(),
    ]
      .filter(Boolean)
      .join(' · ');

    ctx.fillStyle = scoreInfo.isLive ? '#FB7185' : '#94A3B8';
    ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(metaLabel, innerX, cardY + 42, cardWidth - 260);

    ctx.font = '700 18px "Plus Jakarta Sans", system-ui, sans-serif';
    const bW = Math.max(122, ctx.measureText(legBadge.label).width + 32);
    const bX = innerRight - bW;
    drawRoundedRect(ctx, bX, cardY + 18, bW, 34, 17);
    ctx.fillStyle = legBadge.bg;
    ctx.fill();
    ctx.strokeStyle = legBadge.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = legBadge.color;
    const bTextW = ctx.measureText(legBadge.label).width;
    ctx.fillText(legBadge.label, bX + (bW - bTextW) / 2, cardY + 41);

    // Middle row: Matchup + Live/Final Score Box
    const scoreBoxWidth = hasScore ? 132 : 0;
    const matchupMaxW = cardWidth - 64 - (hasScore ? scoreBoxWidth + 24 : 0);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 33px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(
      `${leg.homeTeam} × ${leg.awayTeam}`,
      innerX,
      cardY + 98,
      matchupMaxW
    );

    if (hasScore) {
      const sBoxX = innerRight - scoreBoxWidth;
      const sBoxY = cardY + 66;
      drawRoundedRect(ctx, sBoxX, sBoxY, scoreBoxWidth, 48, 12);
      ctx.fillStyle = scoreInfo.isLive
        ? 'rgba(244, 63, 94, 0.2)'
        : 'rgba(30, 41, 59, 0.95)';
      ctx.fill();
      ctx.strokeStyle = scoreInfo.isLive
        ? 'rgba(251, 113, 133, 0.55)'
        : 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const scoreText = `${scoreInfo.homeGoals} – ${scoreInfo.awayGoals}`;
      ctx.fillStyle = scoreInfo.isLive ? '#FDA4AF' : '#FFFFFF';
      ctx.font = '700 28px "JetBrains Mono", monospace';
      const sW = ctx.measureText(scoreText).width;
      ctx.fillText(scoreText, sBoxX + (scoreBoxWidth - sW) / 2, sBoxY + 34);
    }

    // Bottom row: Market label + Odd/Prob
    const oddPart = leg.odd > 1 ? `Odd ${leg.odd.toFixed(2)}` : '';
    const probPart = leg.probabilityPct > 0 ? `${leg.probabilityPct}%` : '';

    ctx.font = '700 26px "JetBrains Mono", monospace';
    const oddW = oddPart ? ctx.measureText(oddPart).width : 0;
    const probW = probPart ? ctx.measureText(probPart).width : 0;

    if (oddPart) {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(oddPart, innerRight - oddW, cardY + 158);
    }
    if (probPart) {
      ctx.fillStyle = '#34D399';
      const probX = oddPart
        ? innerRight - oddW - 22 - probW
        : innerRight - probW;
      ctx.fillText(probPart, probX, cardY + 158);
    }

    const rightReserved =
      (oddW > 0 ? oddW + 24 : 0) + (probW > 0 ? probW + 24 : 0);
    ctx.fillStyle = '#34D399';
    ctx.font = '700 27px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(
      leg.marketLabel,
      innerX,
      cardY + 158,
      cardWidth - 64 - rightReserved
    );

    cursorY += legCardHeight + legGap;
  });

  cursorY += 12;

  // Summary Box
  drawRoundedRect(ctx, paddingX, cursorY, cardWidth, summaryHeight, 26);
  const sumGrad = ctx.createLinearGradient(
    paddingX,
    cursorY,
    paddingX + cardWidth,
    cursorY + summaryHeight
  );
  sumGrad.addColorStop(0, statusTheme.sumStart);
  sumGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
  ctx.fillStyle = sumGrad;
  ctx.fill();
  ctx.strokeStyle = statusTheme.pillBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  const colWidth = (cardWidth - 64) / 3;
  const metricY = cursorY + 52;
  const valueY = cursorY + 102;

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    item.source === 'image' ? 'VALOR APOSTADO' : 'VALOR SIMULADO',
    paddingX + 32,
    metricY
  );
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 40px "JetBrains Mono", monospace';
  ctx.fillText(formatBrlCurrency(item.stake), paddingX + 32, valueY);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('ODD TOTAL', paddingX + 32 + colWidth, metricY);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 42px "JetBrains Mono", monospace';
  ctx.fillText(item.totalOdd.toFixed(2), paddingX + 32 + colWidth, valueY);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('RETORNO ALVO', paddingX + 32 + colWidth * 2, metricY);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 40px "JetBrains Mono", monospace';
  ctx.fillText(
    formatBrlCurrency(item.potentialReturn),
    paddingX + 32 + colWidth * 2,
    valueY
  );

  // Bottom result row
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(paddingX + 32, cursorY + 130);
  ctx.lineTo(paddingX + cardWidth - 32, cursorY + 130);
  ctx.stroke();

  ctx.fillStyle = '#E2E8F0';
  ctx.font = '600 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('RESULTADO LÍQUIDO', paddingX + 32, cursorY + 178);

  const netValue =
    item.status === 'won'
      ? item.potentialReturn - item.stake
      : item.status === 'lost'
        ? -item.stake
        : 0;
  const netStr =
    item.status === 'pending'
      ? 'Em aberto'
      : `${netValue >= 0 ? '+' : '-'}${formatBrlCurrency(Math.abs(netValue))}`;

  ctx.font = '700 38px "JetBrains Mono", monospace';
  const netW = ctx.measureText(netStr).width;
  ctx.fillStyle = statusTheme.hex;
  ctx.fillText(netStr, paddingX + cardWidth - 32 - netW, cursorY + 182);

  // Footer
  const footerY = cursorY + summaryHeight + 48;
  ctx.fillStyle = '#64748B';
  ctx.font = '500 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    'CampoStats · Histórico de Apostas e Placares ao Vivo',
    paddingX,
    footerY
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('BLOB_FAILED'));
    }, 'image/png');
  });

  const dataUrl = canvas.toDataURL('image/png');
  const dateTag = new Date().toISOString().slice(0, 10);
  const slugPart = (item.leagueSlug || 'historico').replace(/[^a-z0-9-]+/gi, '-');
  return {
    blob,
    dataUrl,
    fileName: `campostats-resultado-${slugPart}-${dateTag}.png`,
  };
}

function getAnalysisFavoriteOutcome(
  item: PredictionHistoryItem
): 'H' | 'D' | 'A' {
  if (
    item.predictedHomePct >= item.predictedDrawPct &&
    item.predictedHomePct >= item.predictedAwayPct
  ) {
    return 'H';
  }
  if (
    item.predictedAwayPct >= item.predictedDrawPct &&
    item.predictedAwayPct >= item.predictedHomePct
  ) {
    return 'A';
  }
  return 'D';
}

function getOutcomeCode(homeGoals: number, awayGoals: number): 'H' | 'D' | 'A' {
  if (homeGoals > awayGoals) return 'H';
  if (awayGoals > homeGoals) return 'A';
  return 'D';
}

export function buildAnalysisResultWhatsappText(
  item: PredictionHistoryItem
): string {
  const isLive = item.liveScore?.state === 'in';
  const hasResult = item.actualScore !== undefined;
  const favCode = getAnalysisFavoriteOutcome(item);
  const favLabel =
    favCode === 'H'
      ? `Vitória ${item.homeTeam.name}`
      : favCode === 'A'
        ? `Vitória ${item.awayTeam.name}`
        : 'Empate';

  let scoreLine = 'Placar: *Aguardando início / registro*';
  let verdictLine = `Tendência principal: *${favLabel}*`;

  if (isLive && item.liveScore) {
    const partialHit =
      getOutcomeCode(item.liveScore.homeGoals, item.liveScore.awayGoals) ===
      favCode;
    scoreLine = `Placar ao vivo (${item.liveScore.statusDetail || 'Em andamento'}): *${item.homeTeam.name} ${item.liveScore.homeGoals} × ${item.liveScore.awayGoals} ${item.awayTeam.name}*`;
    verdictLine = `Parcial 1X2: *${partialHit ? 'Favorável ao modelo' : 'Divergindo no momento'}*`;
  } else if (hasResult && item.actualScore) {
    const isHit =
      getOutcomeCode(item.actualScore.homeGoals, item.actualScore.awayGoals) ===
      favCode;
    scoreLine = `Placar final: *${item.homeTeam.name} ${item.actualScore.homeGoals} × ${item.actualScore.awayGoals} ${item.awayTeam.name}*`;
    verdictLine = `Resultado 1X2: *${isHit ? 'Acertou a tendência' : 'Divergiu da tendência'}* (${favLabel})`;
  }

  return [
    `*Análise 1X2 · ${item.competition}* (CampoStats)`,
    `*${item.homeTeam.name} × ${item.awayTeam.name}*`,
    scoreLine,
    ``,
    `Probabilidades: Casa *${item.predictedHomePct}%* · Empate *${item.predictedDrawPct}%* · Fora *${item.predictedAwayPct}%*`,
    `xG esperado: *${item.expectedGoalsHome.toFixed(1)} – ${item.expectedGoalsAway.toFixed(1)}* · Placar provável: *${item.mostLikelyScore}*`,
    `Mais de 2,5 gols: *${item.over25Pct}%* · Ambas marcam: *${item.bttsPct}%*`,
    verdictLine,
  ].join('\n');
}

export async function generateAnalysisResultPng(
  item: PredictionHistoryItem
): Promise<{ blob: Blob; dataUrl: string; fileName: string }> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font loading warnings
    }
  }

  const isLive = item.liveScore?.state === 'in';
  const hasResult = item.actualScore !== undefined;
  const favCode = getAnalysisFavoriteOutcome(item);
  const favLabel =
    favCode === 'H'
      ? `Vitória ${item.homeTeam.name}`
      : favCode === 'A'
        ? `Vitória ${item.awayTeam.name}`
        : 'Empate';

  const isHit =
    hasResult && item.actualScore
      ? getOutcomeCode(item.actualScore.homeGoals, item.actualScore.awayGoals) ===
        favCode
      : false;
  const livePartialHit =
    isLive && item.liveScore
      ? getOutcomeCode(item.liveScore.homeGoals, item.liveScore.awayGoals) ===
        favCode
      : false;

  const statusTheme = isLive
    ? {
        label: 'AO VIVO',
        hex: '#FB7185',
        pillBg: 'rgba(244, 63, 94, 0.18)',
        pillBorder: 'rgba(251, 113, 133, 0.55)',
        glow: 'rgba(244, 63, 94, 0.22)',
        verdictText: livePartialHit
          ? `Parcial favorável · Tendência: ${favLabel}`
          : `Parcial divergindo · Tendência: ${favLabel}`,
      }
    : hasResult
      ? isHit
        ? {
            label: 'ACERTO 1X2',
            hex: '#34D399',
            pillBg: 'rgba(16, 185, 129, 0.18)',
            pillBorder: 'rgba(52, 211, 153, 0.55)',
            glow: 'rgba(16, 185, 129, 0.24)',
            verdictText: `Modelo acertou o desfecho 1X2 (${favLabel})`,
          }
        : {
            label: 'DIVERGIU 1X2',
            hex: '#FB7185',
            pillBg: 'rgba(244, 63, 94, 0.18)',
            pillBorder: 'rgba(251, 113, 133, 0.55)',
            glow: 'rgba(244, 63, 94, 0.22)',
            verdictText: `Desfecho divergiu da tendência principal (${favLabel})`,
          }
      : {
          label: 'PREVISÃO 1X2',
          hex: '#34D399',
          pillBg: 'rgba(16, 185, 129, 0.16)',
          pillBorder: 'rgba(52, 211, 153, 0.45)',
          glow: 'rgba(16, 185, 129, 0.2)',
          verdictText: `Tendência principal do modelo: ${favLabel}`,
        };

  const width = 1080;
  const paddingX = 64;
  const cardWidth = width - paddingX * 2;
  const height = 870;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('CANVAS_UNAVAILABLE');
  }

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#071318');
  bgGrad.addColorStop(0.55, '#0B1923');
  bgGrad.addColorStop(1, '#091119');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width - 130,
    110,
    20,
    width - 130,
    110,
    430
  );
  glow.addColorStop(0, statusTheme.glow);
  glow.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Header
  let cursorY = 62;
  ctx.fillStyle = statusTheme.hex;
  ctx.font = '700 23px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText('CAMPOSTATS · RESULTADO DA ANÁLISE 1X2', paddingX, cursorY + 22);

  ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
  const pillW = Math.max(176, ctx.measureText(statusTheme.label).width + 44);
  const pillX = width - paddingX - pillW;
  drawRoundedRect(ctx, pillX, cursorY - 4, pillW, 44, 22);
  ctx.fillStyle = statusTheme.pillBg;
  ctx.fill();
  ctx.strokeStyle = statusTheme.pillBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = statusTheme.hex;
  const pillTextW = ctx.measureText(statusTheme.label).width;
  ctx.fillText(statusTheme.label, pillX + (pillW - pillTextW) / 2, cursorY + 26);

  cursorY += 56;
  ctx.fillStyle = '#F8FAFC';
  const compTitle = item.competition.toUpperCase();
  ctx.font = '700 48px "Barlow Condensed", "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(compTitle, paddingX, cursorY + 42, cardWidth);

  cursorY += 64;
  const dateStr = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(item.createdAt));
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(`Análise salva em ${dateStr} · Modelo Poisson`, paddingX, cursorY + 18);

  cursorY += 44;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(paddingX, cursorY);
  ctx.lineTo(width - paddingX, cursorY);
  ctx.stroke();

  cursorY += 28;

  // Matchup Scoreboard Card
  const scoreboardHeight = 200;
  drawRoundedRect(ctx, paddingX, cursorY, cardWidth, scoreboardHeight, 24);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fill();
  ctx.strokeStyle = statusTheme.pillBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  const shownScore =
    isLive && item.liveScore
      ? {
          home: item.liveScore.homeGoals,
          away: item.liveScore.awayGoals,
          detail: item.liveScore.statusDetail || 'Ao vivo',
        }
      : hasResult && item.actualScore
        ? {
            home: item.actualScore.homeGoals,
            away: item.actualScore.awayGoals,
            detail: item.liveScore?.statusDetail || 'Placar final registrado',
          }
        : null;

  const centerX = width / 2;
  const sideWidth = (cardWidth - 220) / 2;

  // Home team (left)
  ctx.fillStyle = item.homeTeam.primaryColor || '#0F766E';
  ctx.beginPath();
  ctx.arc(paddingX + 56, cursorY + 76, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 18px "JetBrains Mono", monospace';
  const hCode = (item.homeTeam.shortCode || 'CAS').slice(0, 3).toUpperCase();
  const hCodeW = ctx.measureText(hCode).width;
  ctx.fillText(hCode, paddingX + 56 - hCodeW / 2, cursorY + 83);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 17px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('MANDANTE', paddingX + 104, cursorY + 62);
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 30px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    item.homeTeam.name,
    paddingX + 104,
    cursorY + 100,
    sideWidth - 60
  );

  // Center score box
  drawRoundedRect(ctx, centerX - 82, cursorY + 42, 164, 78, 18);
  ctx.fillStyle = isLive ? 'rgba(244, 63, 94, 0.22)' : 'rgba(30, 41, 59, 0.95)';
  ctx.fill();
  ctx.strokeStyle = isLive
    ? 'rgba(251, 113, 133, 0.55)'
    : 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const scoreMain = shownScore ? `${shownScore.home} – ${shownScore.away}` : '×';
  ctx.fillStyle = isLive ? '#FDA4AF' : '#FFFFFF';
  ctx.font = '700 40px "JetBrains Mono", monospace';
  const smW = ctx.measureText(scoreMain).width;
  ctx.fillText(scoreMain, centerX - smW / 2, cursorY + 95);

  ctx.fillStyle = isLive ? '#FB7185' : '#94A3B8';
  ctx.font = '600 18px "Plus Jakarta Sans", system-ui, sans-serif';
  const detailText = shownScore
    ? shownScore.detail
    : item.liveScore?.statusDetail || 'Aguardando placar';
  const dW = ctx.measureText(detailText).width;
  ctx.fillText(detailText, centerX - dW / 2, cursorY + 158);

  // Away team (right)
  const awayCircleX = width - paddingX - 56;
  ctx.fillStyle = item.awayTeam.primaryColor || '#1D4ED8';
  ctx.beginPath();
  ctx.arc(awayCircleX, cursorY + 76, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 18px "JetBrains Mono", monospace';
  const aCode = (item.awayTeam.shortCode || 'FOR').slice(0, 3).toUpperCase();
  const aCodeW = ctx.measureText(aCode).width;
  ctx.fillText(aCode, awayCircleX - aCodeW / 2, cursorY + 83);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 17px "Plus Jakarta Sans", system-ui, sans-serif';
  const awayLbl = 'VISITANTE';
  const awayLblW = ctx.measureText(awayLbl).width;
  ctx.fillText(awayLbl, awayCircleX - 46 - awayLblW, cursorY + 62);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 30px "Plus Jakarta Sans", system-ui, sans-serif';
  const awayNameMaxW = sideWidth - 60;
  const measuredAwayW = Math.min(ctx.measureText(item.awayTeam.name).width, awayNameMaxW);
  ctx.fillText(
    item.awayTeam.name,
    awayCircleX - 46 - measuredAwayW,
    cursorY + 100,
    awayNameMaxW
  );

  cursorY += scoreboardHeight + 24;

  // Probabilities & Poisson Stats Card
  const statsCardHeight = 250;
  drawRoundedRect(ctx, paddingX, cursorY, cardWidth, statsCardHeight, 24);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const innerX = paddingX + 32;
  const innerW = cardWidth - 64;

  // 1X2 distribution bar
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 19px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('PROBABILIDADES 1X2 DO MODELO', innerX, cursorY + 42);

  const probLabel = `Casa ${item.predictedHomePct}%  ·  Empate ${item.predictedDrawPct}%  ·  Fora ${item.predictedAwayPct}%`;
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 22px "JetBrains Mono", monospace';
  const pLblW = ctx.measureText(probLabel).width;
  ctx.fillText(probLabel, paddingX + cardWidth - 32 - pLblW, cursorY + 42);

  const barY = cursorY + 62;
  const totalPct = Math.max(
    1,
    item.predictedHomePct + item.predictedDrawPct + item.predictedAwayPct
  );
  const homeW = Math.round((item.predictedHomePct / totalPct) * innerW);
  const drawW = Math.round((item.predictedDrawPct / totalPct) * innerW);
  const awayW = Math.max(0, innerW - homeW - drawW);

  ctx.fillStyle = '#10B981';
  drawRoundedRect(ctx, innerX, barY, Math.max(8, homeW), 16, 6);
  ctx.fill();
  ctx.fillStyle = '#64748B';
  ctx.fillRect(innerX + homeW + 2, barY, Math.max(4, drawW - 4), 16);
  ctx.fillStyle = '#3B82F6';
  drawRoundedRect(ctx, innerX + homeW + drawW, barY, Math.max(8, awayW), 16, 6);
  ctx.fill();

  // 4 metric columns
  const mColW = innerW / 4;
  const mLabelY = cursorY + 132;
  const mValY = cursorY + 178;

  const metrics = [
    {
      label: 'xG ESPERADO',
      val: `${item.expectedGoalsHome.toFixed(1)}–${item.expectedGoalsAway.toFixed(1)}`,
    },
    { label: 'PLACAR PROVÁVEL', val: item.mostLikelyScore },
    { label: 'MAIS DE 2,5 GOLS', val: `${item.over25Pct}%` },
    { label: 'AMBAS MARCAM', val: `${item.bttsPct}%` },
  ];

  metrics.forEach((m, idx) => {
    const mx = innerX + mColW * idx;
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 18px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(m.label, mx, mLabelY);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 34px "JetBrains Mono", monospace';
    ctx.fillText(m.val, mx, mValY);
  });

  // Verdict bar inside bottom of stats card
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(innerX, cursorY + 202);
  ctx.lineTo(innerX + innerW, cursorY + 202);
  ctx.stroke();

  ctx.fillStyle = statusTheme.hex;
  ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(statusTheme.verdictText, innerX, cursorY + 234, innerW);

  // Footer
  const footerY = cursorY + statsCardHeight + 48;
  ctx.fillStyle = '#64748B';
  ctx.font = '500 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    'CampoStats · Histórico e Calibração Estatística 1X2',
    paddingX,
    footerY
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('BLOB_FAILED'));
    }, 'image/png');
  });

  const dataUrl = canvas.toDataURL('image/png');
  const dateTag = new Date().toISOString().slice(0, 10);
  const hSlug = (item.homeTeam.shortCode || 'home').toLowerCase();
  const aSlug = (item.awayTeam.shortCode || 'away').toLowerCase();
  return {
    blob,
    dataUrl,
    fileName: `campostats-analise-${hSlug}-x-${aSlug}-${dateTag}.png`,
  };
}


