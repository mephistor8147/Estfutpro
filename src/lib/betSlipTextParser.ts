import type {
  MultipleLegStatus,
  MultipleTipStatus,
  ParsedBetSlipLeg,
  ParsedBetSlipResponse,
} from '../types/football.js';

const BOOKMAKERS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bbet365\b/i, label: 'Bet365' },
  { pattern: /\bbetano\b/i, label: 'Betano' },
  { pattern: /\bsuperbet\b/i, label: 'Superbet' },
  { pattern: /\bsportingbet\b/i, label: 'Sportingbet' },
  { pattern: /\bkto\b/i, label: 'KTO' },
  { pattern: /\bbetnacional\b/i, label: 'Betnacional' },
  { pattern: /\bnovibet\b/i, label: 'Novibet' },
  { pattern: /\bpixbet\b/i, label: 'Pixbet' },
  { pattern: /\bestrelabet\b|\bestrela\s+bet\b/i, label: 'EstrelaBet' },
  { pattern: /\besportes?\s+da\s+sorte\b/i, label: 'Esportes da Sorte' },
  { pattern: /\bblaze\b/i, label: 'Blaze' },
  { pattern: /\bbetfair\b/i, label: 'Betfair' },
  { pattern: /\b1xbet\b/i, label: '1xBet' },
  { pattern: /\bparimatch\b/i, label: 'Parimatch' },
  { pattern: /\bstake\b/i, label: 'Stake' },
  { pattern: /\bvaidebet\b|\bvai\s+de\s+bet\b/i, label: 'Vaidebet' },
  { pattern: /\bcampostats\b/i, label: 'CampoStats' },
];

const KNOWN_COMPETITIONS: { pattern: RegExp; label: string }[] = [
  { pattern: /brasileir[aã]o\s*s[eé]rie\s*a|s[eé]rie\s*a\s*brasil|campeonato\s*brasileiro\s*a/i, label: 'Brasileirão Série A' },
  { pattern: /brasileir[aã]o\s*s[eé]rie\s*b|s[eé]rie\s*b\s*brasil/i, label: 'Brasileirão Série B' },
  { pattern: /copa\s*do\s*brasil/i, label: 'Copa do Brasil' },
  { pattern: /paulist[aã]o|campeonato\s*paulista/i, label: 'Campeonato Paulista' },
  { pattern: /carioca|campeonato\s*carioca/i, label: 'Campeonato Carioca' },
  { pattern: /mineiro|campeonato\s*mineiro/i, label: 'Campeonato Mineiro' },
  { pattern: /ga[uú]cho|gauch[aã]o/i, label: 'Campeonato Gaúcho' },
  { pattern: /copa\s*do\s*nordeste/i, label: 'Copa do Nordeste' },
  { pattern: /libertadores/i, label: 'Copa Libertadores' },
  { pattern: /sul[-\s]?americana|sudamericana/i, label: 'Copa Sul-Americana' },
  { pattern: /premier\s*league/i, label: 'Premier League' },
  { pattern: /la\s*liga/i, label: 'La Liga' },
  { pattern: /bundesliga/i, label: 'Bundesliga' },
  { pattern: /ligue\s*1/i, label: 'Ligue 1' },
  { pattern: /s[eé]rie\s*a\s*(it[aá]lia|italiana)|serie\s*a\s*tim/i, label: 'Serie A Itália' },
  { pattern: /champions\s*league|liga\s*dos\s*campe[oõ]es/i, label: 'UEFA Champions League' },
  { pattern: /europa\s*league|liga\s*europa/i, label: 'UEFA Europa League' },
  { pattern: /conference\s*league/i, label: 'Conference League' },
  { pattern: /liga\s*portugal|primeira\s*liga/i, label: 'Liga Portugal' },
  { pattern: /eredivisie/i, label: 'Eredivisie' },
  { pattern: /liga\s*profesional|argentin[oa]/i, label: 'Liga Argentina' },
  { pattern: /\bmls\b|major\s*league\s*soccer/i, label: 'MLS' },
  { pattern: /eliminat[oó]rias/i, label: 'Eliminatórias' },
  { pattern: /amistoso|friendly/i, label: 'Amistoso' },
];

const NON_MATCH_LINE_REGEX =
  /\b(valor|aposta|apostado|stake|retorno|ganho|ganhos|pagamento|cotacao|cotac[aã]o|cota[cç][oõ]es|odd\s*total|odds?\s*totais|bilhete|cupom|comprovante|multipla|m[uú]ltipla|simples|combinada|encerrar|cash\s*out|resultado\s*final|resultado|ambas?|ambos|marcam|marcar|btts|mais\s*de|menos\s*de|total\s*de\s*gols?|gols?|dupla\s*chance|hip[oó]tese\s*dupla|escanteio|escanteios|cart[aã]o|cart[oõ]es|handicap|asi[aá]tico|tempo|intervalo|finaliza[cç]|chutes?|impedimentos?|em\s*aberto|pendente|resolvida|finalizada|ganha|perdida|brasileir[aã]o|premier\s*league|champions\s*league|libertadores|la\s*liga|bundesliga|ligue\s*1)\b/i;

const NON_TEAM_EXACT = new Set([
  'sim',
  'nao',
  'não',
  'yes',
  'no',
  'empate',
  'casa',
  'fora',
  'home',
  'away',
  'draw',
  'over',
  'under',
  'gols',
  'gol',
  'odd',
  'odds',
  'total',
  'aberto',
  'aberta',
  'ganha',
  'perdida',
  'pendente',
  'green',
  'red',
]);

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function makeShortCode(name: string): string {
  const letters = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
  return (letters || 'TIM').slice(0, 3);
}

function toTitleCaseClub(raw: string): string {
  const cleaned = raw
    .replace(/^[\d.)\-•*·\[\]()]+\s*/, '')
    .replace(/\s*[\d:;.,\-•*·\[\]()]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  // If OCR returned ALL CAPS, convert cleanly to Title Case keeping common acronyms
  const isAllUpper = cleaned === cleaned.toUpperCase() && /[A-Z]/.test(cleaned);
  if (!isAllUpper) return cleaned;

  const keepUpper = new Set(['FC', 'SC', 'EC', 'CR', 'AC', 'SE', 'CA', 'CF', 'RB', 'PSG', 'CSA', 'CRB', 'ABC', 'AVAI']);
  const keepLower = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'del', 'la']);

  return cleaned
    .split(' ')
    .map((word, idx) => {
      if (keepUpper.has(word)) return word;
      const lower = word.toLowerCase();
      if (idx > 0 && keepLower.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function parseLocaleNumber(raw: string): number {
  const trimmed = raw.replace(/[^\d.,]/g, '').trim();
  if (!trimmed) return 0;

  // Handle Brazilian thousands + decimal e.g. 1.250,50
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(trimmed)) {
    return Number(trimmed.replace(/\./g, '').replace(',', '.')) || 0;
  }
  // Handle standard comma decimal e.g. 50,00 or 1,85
  if (/^\d+,\d{1,2}$/.test(trimmed)) {
    return Number(trimmed.replace(',', '.')) || 0;
  }
  // Handle English thousands + decimal e.g. 1,250.50
  if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(trimmed)) {
    return Number(trimmed.replace(/,/g, '')) || 0;
  }
  // Handle dot decimal or integer
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : 0;
}

function detectBookmaker(text: string): string | undefined {
  for (const item of BOOKMAKERS) {
    if (item.pattern.test(text)) return item.label;
  }
  return undefined;
}

function detectCompetition(line: string): string | null {
  for (const comp of KNOWN_COMPETITIONS) {
    if (comp.pattern.test(line)) return comp.label;
  }
  return null;
}

function detectDateLabel(text: string): string | null {
  const relMatch = text.match(/\b(hoje|amanh[aã]|ontem)\s*(?:[·•\-|,]\s*)?(\d{1,2}[:h]\d{2})?/i);
  if (relMatch) {
    const dayWord = relMatch[1].charAt(0).toUpperCase() + relMatch[1].slice(1).toLowerCase();
    const normalizedDay = dayWord.startsWith('Amanh') ? 'Amanhã' : dayWord;
    const time = relMatch[2] ? relMatch[2].replace('h', ':') : '';
    return time ? `${normalizedDay} · ${time}` : normalizedDay;
  }
  const dateMatch = text.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*(?:[·•\-|,]\s*)?(\d{1,2}[:h]\d{2})?/);
  if (dateMatch) {
    const d = dateMatch[1];
    const t = dateMatch[2] ? dateMatch[2].replace('h', ':') : '';
    return t ? `${d} · ${t}` : d;
  }
  const timeOnly = text.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
  if (timeOnly) return timeOnly[0];
  return null;
}

function detectStatusInText(text: string): MultipleLegStatus {
  const norm = normalizeForMatch(text);
  if (/\b(perdida|perdido|perda|red|derrota|errou)\b/.test(norm)) {
    return 'lost';
  }
  if (/\b(ganha|ganho|vencida|vencedora|green|acerto|acertou|paga)\b/.test(norm)) {
    return 'won';
  }
  return 'pending';
}

function looksLikeTeamName(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 2 || s.length > 38) return false;
  if (!/[A-Za-zÀ-ÿ]{2,}/.test(s)) return false;
  if (/^\d+([.,]\d+)?$/.test(s)) return false;
  if (/r\$/i.test(s)) return false;
  if (NON_TEAM_EXACT.has(normalizeForMatch(s))) return false;
  if (NON_MATCH_LINE_REGEX.test(s)) return false;
  return true;
}

function parseMatchLine(line: string): { homeTeam: string; awayTeam: string } | null {
  const cleanLine = line
    .replace(/^jogo\s*\d+\s*[:·•\-]?\s*/i, '')
    .replace(/\b(?:odd|@)\s*\d+[.,]\d+\b.*$/i, '')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, '')
    .replace(/\b([01]?\d|2[0-3]):[0-5]\d\b/g, '')
    .trim();

  if (cleanLine.length < 5 || cleanLine.length > 90) return null;
  if (NON_MATCH_LINE_REGEX.test(cleanLine)) return null;

  // Strong match separators: " x ", " × ", " vs ", " vs. ", " v "
  const strongMatch = cleanLine.match(/^(.+?)\s+(?:x|×|✕|vs\.?|v\.?)\s+(.+?)$/i);
  if (strongMatch) {
    const home = toTitleCaseClub(strongMatch[1]);
    const away = toTitleCaseClub(strongMatch[2]);
    if (looksLikeTeamName(home) && looksLikeTeamName(away)) {
      return { homeTeam: home, awayTeam: away };
    }
  }

  // Hyphen separator (used by Betano / European slips: "Flamengo - Palmeiras")
  const dashMatch = cleanLine.match(/^(.+?)\s+[-–—]\s+(.+?)$/);
  if (dashMatch) {
    const home = toTitleCaseClub(dashMatch[1]);
    const away = toTitleCaseClub(dashMatch[2]);
    if (
      looksLikeTeamName(home) &&
      looksLikeTeamName(away) &&
      !BOOKMAKERS.some((b) => b.pattern.test(home) || b.pattern.test(away)) &&
      !detectCompetition(home) &&
      !detectCompetition(away)
    ) {
      return { homeTeam: home, awayTeam: away };
    }
  }

  return null;
}

function extractOddFromBlock(lines: string[]): number {
  const joined = lines.join(' ');
  // Explicit "Odd 1.85" or "@ 1.85" or "Cotação 1.85"
  const explicit = joined.match(/(?:odd|cotac[aã]o|cota|@)\s*[:=]?\s*(\d{1,3}[.,]\d{2})/i);
  if (explicit) {
    const val = parseLocaleNumber(explicit[1]);
    if (val >= 1.01 && val <= 500) return val;
  }

  // Standalone decimal odd after removing goal thresholds ("mais de 2.5 gols"), currency, and dates
  const sanitized = joined
    .replace(/r\$\s*[\d.,]+/gi, ' ')
    .replace(/(?:mais\s*de|menos\s*de|over|under|[+-])\s*\d+[.,]5(?:\s*gols?)?/gi, ' ')
    .replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g, ' ')
    .replace(/\d{1,2}:\d{2}/g, ' ');

  const candidates = sanitized.match(/\b(\d{1,2}[.,]\d{2})\b/g) || [];
  for (const cand of candidates) {
    const val = parseLocaleNumber(cand);
    if (val >= 1.02 && val <= 100) return val;
  }

  return 0;
}

function extractMarketFromBlock(
  lines: string[],
  homeTeam: string,
  awayTeam: string
): string {
  const joined = lines.join(' · ');
  const norm = normalizeForMatch(joined);
  const homeNorm = normalizeForMatch(homeTeam);
  const awayNorm = normalizeForMatch(awayTeam);

  // Over / Mais de X.5 gols
  const overMatch = norm.match(/(?:mais\s*de|over|\+)\s*([0-9]+[.,]5)\s*(?:gol|gols)?/);
  if (overMatch && !/(escanteio|corner|cart[ao]|card|chute)/.test(norm)) {
    const threshold = overMatch[1].replace('.', ',');
    return `Mais de ${threshold} gols`;
  }

  // Under / Menos de X.5 gols
  const underMatch = norm.match(/(?:menos\s*de|under)\s*([0-9]+[.,]5)\s*(?:gol|gols)?/);
  if (underMatch && !/(escanteio|corner|cart[ao]|card|chute)/.test(norm)) {
    const threshold = underMatch[1].replace('.', ',');
    return `Menos de ${threshold} gols`;
  }

  // Ambas marcam / BTTS
  if (/(ambas?\s*(?:as\s*equipes\s*|os\s*times\s*)?marcam|btts)/.test(norm)) {
    if (/\b(nao|no)\b/.test(norm)) {
      return 'Ambas marcam: Não';
    }
    return 'Ambas marcam: Sim';
  }

  // Dupla chance / Hipótese dupla
  if (/(dupla\s*chance|hipotese\s*dupla|ou\s*empate|\b1x\b|\bx2\b|\b12\b)/.test(norm)) {
    if (homeNorm && (norm.includes(homeNorm) || /\b1x\b/.test(norm))) {
      return `Dupla chance: ${homeTeam} ou Empate`;
    }
    if (awayNorm && (norm.includes(awayNorm) || /\bx2\b/.test(norm))) {
      return `Dupla chance: ${awayTeam} ou Empate`;
    }
    if (/\b12\b/.test(norm)) {
      return `Dupla chance: ${homeTeam} ou ${awayTeam}`;
    }
    return 'Dupla chance';
  }

  // Corners / Cards / Shots / Handicap custom market preservation
  for (const line of lines) {
    const lNorm = normalizeForMatch(line);
    if (/(escanteio|corner|cartao|cartoes|card|handicap|asiatico|chute|finalizac)/.test(lNorm)) {
      const cleaned = line
        .replace(/\b(?:odd|@)\s*\d+[.,]\d+\b/gi, '')
        .replace(/\s+[-·|]\s*$/, '')
        .trim();
      if (cleaned.length >= 4) return cleaned;
    }
  }

  // Vitória / Resultado Final / Team selection line
  for (const line of lines) {
    const lNorm = normalizeForMatch(line);
    const cleanedLine = line
      .replace(/\b(?:odd|cotac[aã]o|@)\s*[:=]?\s*\d+[.,]\d+\b/gi, '')
      .replace(/\s+[-·|]\s*$/, '')
      .trim();
    const cleanedNorm = normalizeForMatch(cleanedLine);

    if (/(vitoria|vence|resultado\s*final|vencedor|para\s*vencer|1x2)/.test(lNorm)) {
      if (homeNorm && lNorm.includes(homeNorm)) return `Vitória ${homeTeam}`;
      if (awayNorm && lNorm.includes(awayNorm)) return `Vitória ${awayTeam}`;
      if (/\bempate\b/.test(lNorm)) return 'Empate';
    }

    if (cleanedNorm === 'empate' || cleanedNorm === 'x') {
      return 'Empate';
    }
    if (homeNorm && (cleanedNorm === homeNorm || cleanedNorm === `casa` || cleanedNorm === '1')) {
      return `Vitória ${homeTeam}`;
    }
    if (awayNorm && (cleanedNorm === awayNorm || cleanedNorm === `fora` || cleanedNorm === '2')) {
      return `Vitória ${awayTeam}`;
    }
  }

  // Fallback: pick first descriptive non-financial line if any
  for (const line of lines) {
    const cleaned = line
      .replace(/\b(?:odd|cotac[aã]o|@)\s*[:=]?\s*\d+[.,]\d+\b/gi, '')
      .trim();
    if (
      cleaned.length >= 4 &&
      !/^\d+[.,]\d+$/.test(cleaned) &&
      !NON_MATCH_LINE_REGEX.test(cleaned)
    ) {
      return cleaned;
    }
  }

  return `Vitória ${homeTeam}`;
}

function extractLabeledAmount(text: string, labelPattern: RegExp): number {
  const match = text.match(labelPattern);
  if (!match || !match[1]) return 0;
  return parseLocaleNumber(match[1]);
}

export function parseBetSlipOcrText(rawText: string): ParsedBetSlipResponse {
  const normalizedText = String(rawText || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  const lines = normalizedText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      isBetSlip: false,
      extractionMode: 'ocr',
      title: 'Bilhete importado',
      competition: 'Bilhete importado',
      leagueSlug: 'world',
      stake: 0,
      totalOdd: 1,
      potentialReturn: 0,
      status: 'pending',
      legs: [],
      notes:
        'Não foi possível detectar texto legível nesta imagem. Envie um print mais nítido ou preencha manualmente.',
    };
  }

  const bookmaker = detectBookmaker(normalizedText);

  // Locate all match header lines
  interface MatchAnchor {
    lineIdx: number;
    homeTeam: string;
    awayTeam: string;
  }

  const anchors: MatchAnchor[] = [];
  const seenPairs = new Set<string>();

  for (let i = 0; i < lines.length; i += 1) {
    const parsed = parseMatchLine(lines[i]);
    if (!parsed) continue;
    const pairKey = `${normalizeForMatch(parsed.homeTeam)}::${normalizeForMatch(parsed.awayTeam)}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    anchors.push({
      lineIdx: i,
      homeTeam: parsed.homeTeam,
      awayTeam: parsed.awayTeam,
    });
  }

  // Locate where footer financial section starts so we don't mix stake/return into the last leg
  let footerStartIdx = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    if (
      /\b(valor\s*(?:da\s*)?apost|valor\s*simulado|stake|odd\s*total|cotac[aã]o\s*total|cota[cç][oõ]es\s*totais|retorno\s*potencial|ganhos?\s*potenciais|poss[ií]vel\s*retorno)\b/i.test(
        lines[i]
      )
    ) {
      if (anchors.length > 0 && i > anchors[anchors.length - 1].lineIdx) {
        footerStartIdx = i;
        break;
      }
    }
  }

  const legs: ParsedBetSlipLeg[] = anchors.slice(0, 15).map((anchor, idx) => {
    const nextBoundary =
      idx + 1 < anchors.length
        ? anchors[idx + 1].lineIdx
        : Math.min(lines.length, footerStartIdx);

    const prevLines = lines.slice(Math.max(0, anchor.lineIdx - 2), anchor.lineIdx);
    const afterLines = lines.slice(anchor.lineIdx + 1, Math.min(nextBoundary, anchor.lineIdx + 6));
    const contextLines = [...prevLines, lines[anchor.lineIdx], ...afterLines];

    let competition = 'Futebol';
    for (const l of [...prevLines.slice().reverse(), ...afterLines]) {
      const comp = detectCompetition(l);
      if (comp) {
        competition = comp;
        break;
      }
    }

    let dateLabel = 'Importado';
    for (const l of contextLines) {
      const foundDate = detectDateLabel(l);
      if (foundDate) {
        dateLabel = foundDate;
        break;
      }
    }

    const marketLabel = extractMarketFromBlock(
      afterLines.length > 0 ? afterLines : [lines[anchor.lineIdx]],
      anchor.homeTeam,
      anchor.awayTeam
    );

    const odd = extractOddFromBlock(
      afterLines.length > 0 ? afterLines : [lines[anchor.lineIdx]]
    );

    const status = detectStatusInText(afterLines.join(' '));

    return {
      homeTeam: anchor.homeTeam,
      awayTeam: anchor.awayTeam,
      homeShortCode: makeShortCode(anchor.homeTeam),
      awayShortCode: makeShortCode(anchor.awayTeam),
      competition,
      dateLabel,
      marketLabel,
      odd,
      status,
    };
  });

  if (legs.length === 0) {
    return {
      isBetSlip: false,
      extractionMode: 'ocr',
      bookmaker,
      title: 'Bilhete importado',
      competition: 'Bilhete importado',
      leagueSlug: 'world',
      stake: 0,
      totalOdd: 1,
      potentialReturn: 0,
      status: 'pending',
      legs: [],
      notes:
        'O OCR local leu a imagem, mas não encontrou confrontos no formato "Time A x Time B". Tente recortar a área dos jogos ou preencha manualmente.',
    };
  }

  // Extract financial totals
  const footerText =
    footerStartIdx < lines.length ? lines.slice(footerStartIdx).join('\n') : normalizedText;

  let stake =
    extractLabeledAmount(
      footerText,
      /(?:valor\s*(?:da\s*)?apost(?:a|ado)|valor\s*simulado|aposta\s*total|stake|valor)\s*[:=]?\s*(?:r\$)?\s*([\d.,]+)/i
    ) ||
    extractLabeledAmount(
      normalizedText,
      /(?:valor\s*(?:da\s*)?apost(?:a|ado)|stake)\s*[:=]?\s*(?:r\$)?\s*([\d.,]+)/i
    );

  let totalOdd =
    extractLabeledAmount(
      footerText,
      /(?:odd\s*total|odds?\s*totais|cotac[aã]o\s*total|cota[cç][oõ]es\s*totais|cota\s*total|total\s*odd)\s*[:=@]?\s*(\d{1,3}[.,]\d{1,2})/i
    ) ||
    extractLabeledAmount(
      normalizedText,
      /(?:odd\s*total|cotac[aã]o\s*total)\s*[:=@]?\s*(\d{1,3}[.,]\d{1,2})/i
    );

  let potentialReturn =
    extractLabeledAmount(
      footerText,
      /(?:retorno\s*(?:potencial|alvo|previsto)?|ganhos?\s*(?:potenciais|totais)?|poss[ií]vel\s*retorno|pagamento)\s*[:=]?\s*(?:r\$)?\s*([\d.,]+)/i
    ) ||
    extractLabeledAmount(
      normalizedText,
      /(?:retorno\s*potencial|ganhos?\s*potenciais)\s*[:=]?\s*(?:r\$)?\s*([\d.,]+)/i
    );

  if (legs.length === 1 && legs[0].odd <= 0 && totalOdd >= 1.01) {
    legs[0].odd = totalOdd;
  }

  const productOfOdds = legs.reduce(
    (acc, l) => (l.odd >= 1.01 ? acc * l.odd : acc),
    1
  );
  if (totalOdd < 1.01) {
    if (productOfOdds >= 1.01) {
      totalOdd = Number(productOfOdds.toFixed(2));
    } else if (stake > 0 && potentialReturn > stake) {
      totalOdd = Number((potentialReturn / stake).toFixed(2));
    } else {
      totalOdd = 1;
    }
  }

  if (stake <= 0 && potentialReturn > 0 && totalOdd > 1) {
    stake = Number((potentialReturn / totalOdd).toFixed(2));
  }
  if (potentialReturn <= 0 && stake > 0 && totalOdd >= 1) {
    potentialReturn = Number((stake * totalOdd).toFixed(2));
  }

  let status: MultipleTipStatus = detectStatusInText(footerText);
  if (status === 'pending') {
    if (legs.some((l) => l.status === 'lost')) status = 'lost';
    else if (legs.every((l) => l.status === 'won')) status = 'won';
  } else if (status === 'won' && legs.every((l) => l.status === 'pending')) {
    for (const l of legs) l.status = 'won';
  }

  const distinctComps = Array.from(
    new Set(legs.map((l) => l.competition).filter((c) => c && c.toLowerCase() !== 'futebol'))
  );

  const title =
    distinctComps.length === 1
      ? distinctComps[0]
      : bookmaker
        ? `${legs.length === 1 ? 'Aposta simples' : 'Múltipla'} · ${bookmaker}`
        : legs.length === 1
          ? 'Aposta simples importada'
          : 'Múltipla importada';

  return {
    isBetSlip: true,
    extractionMode: 'ocr',
    bookmaker,
    title,
    competition: title,
    leagueSlug: 'world',
    stake,
    totalOdd,
    potentialReturn,
    status,
    legs,
    notes: 'Leitura realizada via OCR local. Confira os campos abaixo antes de salvar.',
  };
}
