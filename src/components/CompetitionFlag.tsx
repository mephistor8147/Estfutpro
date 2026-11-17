import React from 'react';

export type CompetitionFlagRegion =
  | 'BRA'
  | 'ENG'
  | 'ESP'
  | 'ITA'
  | 'GER'
  | 'FRA'
  | 'POR'
  | 'ARG'
  | 'USA'
  | 'EUR'
  | 'SAM'
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
    if (slug.startsWith('arg.')) return 'ARG';
    if (slug.startsWith('usa.')) return 'USA';
    if (slug.startsWith('uefa.')) return 'EUR';
    if (slug.startsWith('conmebol.') || slug === 'fifa.worldq.conmebol') {
      return 'SAM';
    }
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
  if (/premier league|ingles|england|fa cup|efl|championship/.test(text)) {
    return 'ENG';
  }
  if (/la liga|espanh|spain|copa del rey/.test(text)) {
    return 'ESP';
  }
  if (/serie a.*ital|itali|coppa italia/.test(text)) {
    return 'ITA';
  }
  if (/bundesliga|alem|germany|dfb/.test(text)) {
    return 'GER';
  }
  if (/ligue 1|franca|french|coupe de france/.test(text)) {
    return 'FRA';
  }
  if (/portug|primeira liga|taca de portugal/.test(text)) {
    return 'POR';
  }
  if (/argentin|liga profesional|copa de la liga/.test(text)) {
    return 'ARG';
  }
  if (/mls|estados unidos|major league soccer/.test(text)) {
    return 'USA';
  }
  if (/champions league|europa league|conference league|nations league|uefa|eurocopa/.test(text)) {
    return 'EUR';
  }
  if (/libertadores|sul-americana|sudamericana|conmebol|copa america/.test(text)) {
    return 'SAM';
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
  ARG: 'Argentina',
  USA: 'Estados Unidos',
  EUR: 'Europa (UEFA)',
  SAM: 'América do Sul (CONMEBOL)',
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

      {region === 'ARG' && (
        <svg viewBox="0 0 24 16" className="w-full h-full block" aria-hidden="true">
          <rect y="0" width="24" height="5.34" fill="#74ACDF" />
          <rect y="5.33" width="24" height="5.34" fill="#FFFFFF" />
          <rect y="10.66" width="24" height="5.34" fill="#74ACDF" />
          <circle cx="12" cy="8" r="1.8" fill="#F6B40E" />
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
