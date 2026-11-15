export interface MultipleCompetitionOption {
  slug: string;
  label: string;
  region: 'destaques' | 'americas' | 'europa' | 'mundo';
}

export const MULTIPLE_COMPETITIONS: MultipleCompetitionOption[] = [
  { slug: 'bra.1', label: 'Brasileirão Série A', region: 'destaques' },
  { slug: 'world', label: 'Principais do Mundo (Misto)', region: 'destaques' },
  { slug: 'uefa.champions', label: 'UEFA Champions League', region: 'destaques' },
  { slug: 'eng.1', label: 'Premier League (Inglaterra)', region: 'europa' },
  { slug: 'esp.1', label: 'La Liga (Espanha)', region: 'europa' },
  { slug: 'ita.1', label: 'Serie A (Itália)', region: 'europa' },
  { slug: 'ger.1', label: 'Bundesliga (Alemanha)', region: 'europa' },
  { slug: 'fra.1', label: 'Ligue 1 (França)', region: 'europa' },
  { slug: 'por.1', label: 'Liga Portugal', region: 'europa' },
  { slug: 'uefa.europa', label: 'UEFA Europa League', region: 'europa' },
  { slug: 'conmebol.libertadores', label: 'Copa Libertadores', region: 'americas' },
  { slug: 'conmebol.sudamericana', label: 'Copa Sul-Americana', region: 'americas' },
  { slug: 'bra.2', label: 'Brasileirão Série B', region: 'americas' },
  { slug: 'arg.1', label: 'Liga Profesional Argentina', region: 'americas' },
  { slug: 'usa.1', label: 'MLS (Estados Unidos)', region: 'mundo' },
];

export const MULTIPLE_COMPETITION_SET = new Set(
  MULTIPLE_COMPETITIONS.map((c) => c.slug)
);
