import React from 'react';

export type CompetitionFlagRegion =
  | 'BRA'
  | 'ENG'
  | 'ESP'
  | 'ITA'
  | 'GER'
  | 'FRA'
  | 'POR'
  | 'NED'
  | 'BEL'
  | 'TUR'
  | 'SCO'
  | 'NOR'
  | 'DEN'
  | 'SWE'
  | 'RUS'
  | 'GRE'
  | 'AUT'
  | 'ARG'
  | 'MEX'
  | 'COL'
  | 'URU'
  | 'CHI'
  | 'PAR'
  | 'ECU'
  | 'PER'
  | 'USA'
  | 'JPN'
  | 'KSA'
  | 'AUS'
  | 'CHN'
  | 'IND'
  | 'RSA'
  | 'EUR'
  | 'SAM'
  | 'NAM'
  | 'ASI'
  | 'AFR'
  | 'INT';

export function resolveCompetitionRegion(
  leagueSlug?: string,
  competition?: string
): CompetitionFlagRegion {
  const slug = (leagueSlug || '').toLowerCase().trim();
  if (slug) {
    if (slug.startsWith('bra.')) return 'BRA';
    if (slug.startsWith('eng.')) return 'ENG';
    if (slug.startsWith('esp.')) return 'ESP';
    if (slug.startsWith('ita.')) return 'ITA';
    if (slug.startsWith('ger.')) return 'GER';
    if (slug.startsWith('fra.')) return 'FRA';
    if (slug.startsWith('por.')) return 'POR';
    if (slug.startsWith('ned.')) return 'NED';
    if (slug.startsWith('bel.')) return 'BEL';
    if (slug.startsWith('tur.')) return 'TUR';
    if (slug.startsWith('sco.')) return 'SCO';
    if (slug.startsWith('nor.')) return 'NOR';
    if (slug.startsWith('den.')) return 'DEN';
    if (slug.startsWith('swe.')) return 'SWE';
    if (slug.startsWith('rus.')) return 'RUS';
    if (slug.startsWith('gre.')) return 'GRE';
    if (slug.startsWith('aut.')) return 'AUT';
    if (slug.startsWith('arg.')) return 'ARG';
    if (slug.startsWith('mex.')) return 'MEX';
    if (slug.startsWith('col.')) return 'COL';
    if (slug.startsWith('uru.')) return 'URU';
    if (slug.startsWith('chi.')) return 'CHI';
    if (slug.startsWith('par.')) return 'PAR';
    if (slug.startsWith('ecu.')) return 'ECU';
    if (slug.startsWith('per.')) return 'PER';
    if (slug.startsWith('usa.')) return 'USA';
    if (slug.startsWith('jpn.')) return 'JPN';
    if (slug.startsWith('ksa.')) return 'KSA';
    if (slug.startsWith('aus.')) return 'AUS';
    if (slug.startsWith('chn.')) return 'CHN';
    if (slug.startsWith('ind.')) return 'IND';
    if (slug.startsWith('rsa.')) return 'RSA';
    if (slug.startsWith('uefa.') || slug === 'fifa.worldq.uefa') return 'EUR';
    if (slug.startsWith('conmebol.') || slug === 'fifa.worldq.conmebol') {
      return 'SAM';
    }
    if (
      slug.startsWith('concacaf.') ||
      slug === 'fifa.worldq.concacaf' ||
      slug.startsWith('crc.') ||
      slug.startsWith('hon.') ||
      slug.startsWith('gua.') ||
      slug.startsWith('slv.')
    ) {
      return 'NAM';
    }
    if (slug.startsWith('afc.') || slug === 'fifa.worldq.afc') return 'ASI';
    if (slug.startsWith('caf.') || slug === 'fifa.worldq.caf') return 'AFR';
    if (
      slug === 'today' ||
      slug === 'tomorrow' ||
      slug === 'world' ||
      slug.startsWith('fifa.')
    ) {
      return 'INT';
    }
  }

  const text = (competition || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (!text) return 'INT';

  if (
    /brasileir|serie [abc]|copa do brasil|paulist|carioc|mineiro|gaucho|nordeste|brasil/.test(
      text
    )
  ) {
    return 'BRA';
  }
  if (/premier league.*(ingl|eng)|ingles|england|fa cup|efl|championship|league one|national league/.test(text)) {
    return 'ENG';
  }
  if (/la liga|espanh|spain|copa del rey|copa do rei.*esp|rainha/.test(text)) {
    return 'ESP';
  }
  if (/serie [ab].*ital|itali|coppa italia/.test(text)) {
    return 'ITA';
  }
  if (/bundesliga.*alem|2\. bundesliga|alem|germany|dfb/.test(text)) {
    return 'GER';
  }
  if (/ligue [12]|premiere ligue|franca|french|coupe de france/.test(text)) {
    return 'FRA';
  }
  if (/portug|primeira liga|taca de portugal/.test(text)) {
    return 'POR';
  }
  if (/eredivisie|eerste divisie|holand|dutch/.test(text)) {
    return 'NED';
  }
  if (/belg|pro league/.test(text)) {
    return 'BEL';
  }
  if (/turqu|super lig/.test(text)) {
    return 'TUR';
  }
  if (/escocia|scottish/.test(text)) {
    return 'SCO';
  }
  if (/norueg|norweg|eliteserien/.test(text)) {
    return 'NOR';
  }
  if (/dinamarc|danish|superliga/.test(text)) {
    return 'DEN';
  }
  if (/suec|swed|allsvenskan/.test(text)) {
    return 'SWE';
  }
  if (/russ/.test(text)) {
    return 'RUS';
  }
  if (/grec|greek/.test(text)) {
    return 'GRE';
  }
  if (/austria/.test(text)) {
    return 'AUT';
  }
  if (/argentin|liga profesional|copa de la liga/.test(text)) {
    return 'ARG';
  }
  if (/liga mx|mexic/.test(text)) {
    return 'MEX';
  }
  if (/colomb/.test(text)) {
    return 'COL';
  }
  if (/urugu/.test(text)) {
    return 'URU';
  }
  if (/chilen|chile/.test(text)) {
    return 'CHI';
  }
  if (/paragu/.test(text)) {
    return 'PAR';
  }
  if (/equador|ecuador|ligapro/.test(text)) {
    return 'ECU';
  }
  if (/peru/.test(text)) {
    return 'PER';
  }
  if (/mls|estados unidos|major league soccer|usl/.test(text)) {
    return 'USA';
  }
  if (/j\.league|j league|japon|japan/.test(text)) {
    return 'JPN';
  }
  if (/saudi|arabia/.test(text)) {
    return 'KSA';
  }
  if (/austr[aá]l|a-league/.test(text)) {
    return 'AUS';
  }
  if (/china|chinese/.test(text)) {
    return 'CHN';
  }
  if (/indian|india/.test(text)) {
    return 'IND';
  }
  if (/africa do sul|south africa/.test(text)) {
    return 'RSA';
  }
  if (/champions league|europa league|conference league|nations league|uefa|eurocopa/.test(text)) {
    return 'EUR';
  }
  if (/libertadores|sul-americana|sudamericana|conmebol|copa america|recopa/.test(text)) {
    return 'SAM';
  }
  if (/concacaf|costa rica|honduras|guatemala|el salvador/.test(text)) {
    return 'NAM';
  }
  if (/afc/.test(text)) {
    return 'ASI';
  }
  if (/caf|african/.test(text)) {
    return 'AFR';
  }

  return 'INT';
}

const REGION_LABELS: Record<CompetitionFlagRegion, string> = {
  BRA: 'Brasil',
  ENG: 'Inglaterra',
  ESP: 'Espanha',
  ITA: 'Itália',
  GER: 'Alemanha',
  FRA: 'França',
  POR: 'Portugal',
  NED: 'Holanda',
  BEL: 'Bélgica',
  TUR: 'Turquia',
  SCO: 'Escócia',
  NOR: 'Noruega',
  DEN: 'Dinamarca',
  SWE: 'Suécia',
  RUS: 'Rússia',
  GRE: 'Grécia',
  AUT: 'Áustria',
  ARG: 'Argentina',
  MEX: 'México',
  COL: 'Colômbia',
  URU: 'Uruguai',
  CHI: 'Chile',
  PAR: 'Paraguai',
  ECU: 'Equador',
  PER: 'Peru',
  USA: 'Estados Unidos',
  JPN: 'Japão',
  KSA: 'Arábia Saudita',
  AUS: 'Austrália',
  CHN: 'China',
  IND: 'Índia',
  RSA: 'África do Sul',
  EUR: 'Europa (UEFA)',
  SAM: 'América do Sul (CONMEBOL)',
  NAM: 'América do Norte e Central',
  ASI: 'Ásia (AFC)',
  AFR: 'África (CAF)',
  INT: 'Internacional',
};

interface CompetitionFlagProps {
  leagueSlug?: string;
  competition?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const CompetitionFlag: React.FC<CompetitionFlagProps> = ({
  leagueSlug,
  competition,
  size = 'sm',
  className = '',
}) => {
  const region = resolveCompetitionRegion(leagueSlug, competition);
  const label = REGION_LABELS[region];
  const dims = size === 'md' ? 'w-5 h-3.5' : 'w-4 h-[11px]';

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-[3px] overflow-hidden ring-1 ring-slate-900/15 dark:ring-white/20 shadow-[0_0.5px_1px_rgba(0,0,0,0.08)] ${dims} ${className}`}
      title={competition ? `${competition} (${label})` : label}
      aria-label={`Bandeira: ${label}`}
    >
      {region === 'BRA' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#009C3B" />
          <polygon points="12,2 21.5,8 12,14 2.5,8" fill="#FFDF00" />
          <circle cx="12" cy="8" r="3.4" fill="#002776" />
          <path d="M8.8 7.5 Q12 6.4 15.2 8.4" fill="none" stroke="#FFFFFF" strokeWidth="0.7" />
        </svg>
      )}

      {region === 'ENG' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#FFFFFF" />
          <rect x="10.2" y="0" width="3.6" height="16" fill="#CF142B" />
          <rect x="0" y="6.2" width="24" height="3.6" fill="#CF142B" />
        </svg>
      )}

      {region === 'ESP' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="4" y="0" fill="#AA151B" />
          <rect width="24" height="8" y="4" fill="#F1BF00" />
          <rect width="24" height="4" y="12" fill="#AA151B" />
          <rect x="5" y="5.5" width="3" height="5" rx="0.8" fill="#AA151B" opacity="0.85" />
        </svg>
      )}

      {region === 'ITA' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect x="0" width="8" height="16" fill="#009246" />
          <rect x="8" width="8" height="16" fill="#FFFFFF" />
          <rect x="16" width="8" height="16" fill="#CE2B37" />
        </svg>
      )}

      {region === 'GER' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect y="0" width="24" height="5.34" fill="#111827" />
          <rect y="5.33" width="24" height="5.34" fill="#DD0000" />
          <rect y="10.66" width="24" height="5.34" fill="#FFCE00" />
        </svg>
      )}

      {region === 'FRA' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect x="0" width="8" height="16" fill="#0055A4" />
          <rect x="8" width="8" height="16" fill="#FFFFFF" />
          <rect x="16" width="8" height="16" fill="#EF4135" />
        </svg>
      )}

      {region === 'POR' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect x="0" width="9.6" height="16" fill="#006600" />
          <rect x="9.6" width="14.4" height="16" fill="#FF0000" />
          <circle cx="9.6" cy="8" r="2.6" fill="#FFCC00" />
          <rect x="8.6" y="6.8" width="2" height="2.4" rx="0.4" fill="#FFFFFF" />
        </svg>
      )}

      {region === 'NED' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect y="0" width="24" height="5.34" fill="#AE1C28" />
          <rect y="5.33" width="24" height="5.34" fill="#FFFFFF" />
          <rect y="10.66" width="24" height="5.34" fill="#21468B" />
        </svg>
      )}

      {region === 'BEL' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect x="0" width="8" height="16" fill="#111827" />
          <rect x="8" width="8" height="16" fill="#FDDA24" />
          <rect x="16" width="8" height="16" fill="#EF3340" />
        </svg>
      )}

      {region === 'TUR' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#E30A17" />
          <circle cx="9.8" cy="8" r="4" fill="#FFFFFF" />
          <circle cx="11" cy="8" r="3.2" fill="#E30A17" />
          <circle cx="14.5" cy="8" r="1.1" fill="#FFFFFF" />
        </svg>
      )}

      {region === 'SCO' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#005EB8" />
          <line x1="0" y1="0" x2="24" y2="16" stroke="#FFFFFF" strokeWidth="2.8" />
          <line x1="24" y1="0" x2="0" y2="16" stroke="#FFFFFF" strokeWidth="2.8" />
        </svg>
      )}

      {region === 'NOR' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#BA0C2F" />
          <rect x="6.5" y="0" width="4" height="16" fill="#FFFFFF" />
          <rect x="0" y="6" width="24" height="4" fill="#FFFFFF" />
          <rect x="7.5" y="0" width="2" height="16" fill="#00205B" />
          <rect x="0" y="7" width="24" height="2" fill="#00205B" />
        </svg>
      )}

      {region === 'DEN' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#C8102E" />
          <rect x="7" y="0" width="3" height="16" fill="#FFFFFF" />
          <rect x="0" y="6.5" width="24" height="3" fill="#FFFFFF" />
        </svg>
      )}

      {region === 'SWE' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#006AA7" />
          <rect x="7" y="0" width="3.2" height="16" fill="#FECC02" />
          <rect x="0" y="6.4" width="24" height="3.2" fill="#FECC02" />
        </svg>
      )}

      {region === 'RUS' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect y="0" width="24" height="5.34" fill="#FFFFFF" />
          <rect y="5.33" width="24" height="5.34" fill="#0039A6" />
          <rect y="10.66" width="24" height="5.34" fill="#D52B1E" />
        </svg>
      )}

      {region === 'GRE' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#0D5EAF" />
          <rect y="2" width="24" height="1.8" fill="#FFFFFF" />
          <rect y="5.6" width="24" height="1.8" fill="#FFFFFF" />
          <rect y="9.2" width="24" height="1.8" fill="#FFFFFF" />
          <rect y="12.8" width="24" height="1.8" fill="#FFFFFF" />
          <rect width="9" height="9" fill="#0D5EAF" />
          <rect x="3.6" y="0" width="1.8" height="9" fill="#FFFFFF" />
          <rect x="0" y="3.6" width="9" height="1.8" fill="#FFFFFF" />
        </svg>
      )}

      {region === 'AUT' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect y="0" width="24" height="5.34" fill="#ED2939" />
          <rect y="5.33" width="24" height="5.34" fill="#FFFFFF" />
          <rect y="10.66" width="24" height="5.34" fill="#ED2939" />
        </svg>
      )}

      {region === 'ARG' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect y="0" width="24" height="5.34" fill="#74ACDF" />
          <rect y="5.33" width="24" height="5.34" fill="#FFFFFF" />
          <rect y="10.66" width="24" height="5.34" fill="#74ACDF" />
          <circle cx="12" cy="8" r="1.8" fill="#F6B40E" />
        </svg>
      )}

      {region === 'MEX' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect x="0" width="8" height="16" fill="#006847" />
          <rect x="8" width="8" height="16" fill="#FFFFFF" />
          <rect x="16" width="8" height="16" fill="#CE1126" />
          <circle cx="12" cy="8" r="1.7" fill="#7C532A" />
        </svg>
      )}

      {region === 'COL' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect y="0" width="24" height="8" fill="#FCD116" />
          <rect y="8" width="24" height="4" fill="#003893" />
          <rect y="12" width="24" height="4" fill="#CE1126" />
        </svg>
      )}

      {region === 'URU' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#FFFFFF" />
          <rect y="2" width="24" height="2" fill="#0038A8" />
          <rect y="6" width="24" height="2" fill="#0038A8" />
          <rect y="10" width="24" height="2" fill="#0038A8" />
          <rect y="14" width="24" height="2" fill="#0038A8" />
          <rect width="9" height="8" fill="#FFFFFF" />
          <circle cx="4.5" cy="4" r="2" fill="#FCD116" />
        </svg>
      )}

      {region === 'CHI' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect y="0" width="24" height="8" fill="#FFFFFF" />
          <rect y="8" width="24" height="8" fill="#D52B1E" />
          <rect width="9" height="8" fill="#0039A6" />
          <circle cx="4.5" cy="4" r="1.5" fill="#FFFFFF" />
        </svg>
      )}

      {region === 'PAR' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect y="0" width="24" height="5.34" fill="#D52B1E" />
          <rect y="5.33" width="24" height="5.34" fill="#FFFFFF" />
          <rect y="10.66" width="24" height="5.34" fill="#0038A8" />
          <circle cx="12" cy="8" r="1.4" fill="#D52B1E" />
        </svg>
      )}

      {region === 'ECU' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect y="0" width="24" height="8" fill="#FFD100" />
          <rect y="8" width="24" height="4" fill="#034EA2" />
          <rect y="12" width="24" height="4" fill="#ED1C24" />
          <circle cx="12" cy="8" r="1.4" fill="#7C532A" />
        </svg>
      )}

      {region === 'PER' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect x="0" width="8" height="16" fill="#D91023" />
          <rect x="8" width="8" height="16" fill="#FFFFFF" />
          <rect x="16" width="8" height="16" fill="#D91023" />
        </svg>
      )}

      {region === 'USA' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#FFFFFF" />
          <rect y="0" width="24" height="2.3" fill="#B22234" />
          <rect y="4.6" width="24" height="2.3" fill="#B22234" />
          <rect y="9.2" width="24" height="2.3" fill="#B22234" />
          <rect y="13.7" width="24" height="2.3" fill="#B22234" />
          <rect x="0" y="0" width="10.5" height="9.2" fill="#3C3B6E" />
          <circle cx="3" cy="2.6" r="0.6" fill="#FFFFFF" />
          <circle cx="5.5" cy="2.6" r="0.6" fill="#FFFFFF" />
          <circle cx="8" cy="2.6" r="0.6" fill="#FFFFFF" />
          <circle cx="4.2" cy="4.8" r="0.6" fill="#FFFFFF" />
          <circle cx="6.8" cy="4.8" r="0.6" fill="#FFFFFF" />
          <circle cx="3" cy="7" r="0.6" fill="#FFFFFF" />
          <circle cx="5.5" cy="7" r="0.6" fill="#FFFFFF" />
          <circle cx="8" cy="7" r="0.6" fill="#FFFFFF" />
        </svg>
      )}

      {region === 'JPN' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#FFFFFF" />
          <circle cx="12" cy="8" r="4.2" fill="#BC002D" />
        </svg>
      )}

      {region === 'KSA' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#006C35" />
          <rect x="6" y="6" width="12" height="1.5" rx="0.6" fill="#FFFFFF" />
          <rect x="7" y="9.5" width="10" height="1.2" rx="0.5" fill="#FFFFFF" />
        </svg>
      )}

      {region === 'AUS' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#00008B" />
          <rect width="10" height="7" fill="#012169" />
          <rect x="4.2" y="0" width="1.6" height="7" fill="#FFFFFF" />
          <rect x="0" y="2.7" width="10" height="1.6" fill="#FFFFFF" />
          <rect x="4.5" y="0" width="1" height="7" fill="#C8102E" />
          <rect x="0" y="3" width="10" height="1" fill="#C8102E" />
          <circle cx="17.5" cy="4.5" r="0.9" fill="#FFFFFF" />
          <circle cx="19.5" cy="8" r="0.9" fill="#FFFFFF" />
          <circle cx="16.5" cy="11.5" r="0.9" fill="#FFFFFF" />
          <circle cx="5" cy="11.5" r="1.2" fill="#FFFFFF" />
        </svg>
      )}

      {region === 'CHN' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#DE2910" />
          <circle cx="5" cy="5" r="2" fill="#FFDE00" />
          <circle cx="9.2" cy="2.8" r="0.7" fill="#FFDE00" />
          <circle cx="10.5" cy="4.8" r="0.7" fill="#FFDE00" />
          <circle cx="10.2" cy="7" r="0.7" fill="#FFDE00" />
          <circle cx="8.8" cy="8.5" r="0.7" fill="#FFDE00" />
        </svg>
      )}

      {region === 'IND' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect y="0" width="24" height="5.34" fill="#FF9933" />
          <rect y="5.33" width="24" height="5.34" fill="#FFFFFF" />
          <rect y="10.66" width="24" height="5.34" fill="#138808" />
          <circle cx="12" cy="8" r="1.8" fill="none" stroke="#000080" strokeWidth="0.8" />
        </svg>
      )}

      {region === 'RSA' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect y="0" width="24" height="8" fill="#E03C31" />
          <rect y="8" width="24" height="8" fill="#001489" />
          <polygon points="0,2 10,8 0,14" fill="#111827" stroke="#FFB81C" strokeWidth="1" />
          <path d="M0,0 L11,8 L24,8 M0,16 L11,8" stroke="#007749" strokeWidth="2.5" fill="none" />
        </svg>
      )}

      {region === 'EUR' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#003399" />
          <circle cx="12" cy="3.2" r="0.7" fill="#FFCC00" />
          <circle cx="15.4" cy="4.6" r="0.7" fill="#FFCC00" />
          <circle cx="16.8" cy="8" r="0.7" fill="#FFCC00" />
          <circle cx="15.4" cy="11.4" r="0.7" fill="#FFCC00" />
          <circle cx="12" cy="12.8" r="0.7" fill="#FFCC00" />
          <circle cx="8.6" cy="11.4" r="0.7" fill="#FFCC00" />
          <circle cx="7.2" cy="8" r="0.7" fill="#FFCC00" />
          <circle cx="8.6" cy="4.6" r="0.7" fill="#FFCC00" />
        </svg>
      )}

      {region === 'SAM' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#0B3B60" />
          <rect y="12.5" width="24" height="3.5" fill="#059669" />
          <path
            d="M11 2.8 L14.5 5.2 L13.8 8.8 L11.5 11.4 L10.2 9.4 L9.5 6 Z"
            fill="#FBBF24"
          />
          <circle cx="5.5" cy="5.5" r="0.8" fill="#FFFFFF" />
          <circle cx="18" cy="4.5" r="0.7" fill="#FFFFFF" />
          <circle cx="17.5" cy="9.5" r="0.8" fill="#FFFFFF" />
        </svg>
      )}

      {region === 'NAM' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#1E3A8A" />
          <path d="M5 4 L13 4 L11 9 L14 13 L8 11 L6 7 Z" fill="#38BDF8" />
          <circle cx="18" cy="5" r="1" fill="#FBBF24" />
        </svg>
      )}

      {region === 'ASI' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#0F172A" />
          <circle cx="12" cy="8" r="4.5" fill="#EA580C" />
          <circle cx="12" cy="8" r="2.2" fill="#FACC15" />
        </svg>
      )}

      {region === 'AFR' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#065F46" />
          <path d="M8 3 L15 4 L17 8 L13 13 L10 10 L7 7 Z" fill="#F59E0B" />
        </svg>
      )}

      {region === 'INT' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect width="24" height="16" fill="#0F766E" />
          <circle cx="12" cy="8" r="5" fill="#0284C7" stroke="#FFFFFF" strokeWidth="0.9" />
          <ellipse
            cx="12"
            cy="8"
            rx="2.3"
            ry="5"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="0.75"
          />
          <line x1="7" y1="8" x2="17" y2="8" stroke="#FFFFFF" strokeWidth="0.75" />
        </svg>
      )}
    </span>
  );
};
