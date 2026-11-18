import type {
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

