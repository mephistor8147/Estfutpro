import type { SerieAMultipleTip } from '../types/football';

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
  const lines = [
    `*Dica Quente · Múltipla da Série A* (CampoStats)`,
    ``,
    ...tip.legs.map((leg, i) => {
      const odd = legOdds[i] ?? 1;
      return `${i + 1}. *${leg.homeTeam} × ${leg.awayTeam}* (${leg.dateLabel})\n   Palpite: *${leg.marketLabel}* · ${leg.probabilityPct}% · Odd ${odd.toFixed(2)}`;
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
  ctx.font = '700 54px "Barlow Condensed", "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('DICA QUENTE · MÚLTIPLA DA SÉRIE A', paddingX, cursorY + 46);

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

    // Top row: Jogo # + date | xG
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`JOGO ${idx + 1} · ${leg.dateLabel.toUpperCase()}`, innerX, cardY + 42);

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
    'Modelo Poisson · Dados ao vivo ESPN Série A · Análise estatística informativa',
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
  return {
    blob,
    dataUrl,
    fileName: `campostats-multipla-serie-a-${dateTag}.png`,
  };
}
