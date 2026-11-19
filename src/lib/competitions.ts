export interface MultipleCompetitionOption {
  slug: string;
  label: string;
  region: 'destaques' | 'brasil_regional' | 'americas' | 'europa' | 'mundo';
}

export const MULTIPLE_COMPETITIONS: MultipleCompetitionOption[] = [
  { slug: 'today', label: 'Jogos de Hoje (Mundial)', region: 'destaques' },
  { slug: 'tomorrow', label: 'Jogos de Amanhã (Mundial)', region: 'destaques' },
  { slug: 'world', label: 'Todo o Mundo (Misto)', region: 'destaques' },
  { slug: 'bra.1', label: 'Brasileirão Série A', region: 'destaques' },
  { slug: 'uefa.champions', label: 'UEFA Champions League', region: 'destaques' },

  // Brasil — Nacionais e Regionais
  { slug: 'bra.copa_do_brazil', label: 'Copa do Brasil', region: 'brasil_regional' },
  { slug: 'bra.camp.paulista', label: 'Campeonato Paulista', region: 'brasil_regional' },
  { slug: 'bra.camp.carioca', label: 'Campeonato Carioca', region: 'brasil_regional' },
  { slug: 'bra.camp.mineiro', label: 'Campeonato Mineiro', region: 'brasil_regional' },
  { slug: 'bra.camp.gaucho', label: 'Campeonato Gaúcho', region: 'brasil_regional' },
  { slug: 'bra.copa_do_nordeste', label: 'Copa do Nordeste', region: 'brasil_regional' },
  { slug: 'bra.2', label: 'Brasileirão Série B', region: 'brasil_regional' },
  { slug: 'bra.3', label: 'Brasileirão Série C', region: 'brasil_regional' },

  // Europa & Seleções
  { slug: 'eng.1', label: 'Premier League (Inglaterra)', region: 'europa' },
  { slug: 'eng.2', label: 'EFL Championship (Inglaterra)', region: 'europa' },
  { slug: 'esp.1', label: 'La Liga (Espanha)', region: 'europa' },
  { slug: 'ita.1', label: 'Serie A (Itália)', region: 'europa' },
  { slug: 'ger.1', label: 'Bundesliga (Alemanha)', region: 'europa' },
  { slug: 'fra.1', label: 'Ligue 1 (França)', region: 'europa' },
  { slug: 'por.1', label: 'Liga Portugal', region: 'europa' },
  { slug: 'ned.1', label: 'Eredivisie (Holanda)', region: 'europa' },
  { slug: 'bel.1', label: 'Pro League (Bélgica)', region: 'europa' },
  { slug: 'tur.1', label: 'Süper Lig (Turquia)', region: 'europa' },
  { slug: 'sco.1', label: 'Premiership (Escócia)', region: 'europa' },
  { slug: 'uefa.europa', label: 'UEFA Europa League', region: 'europa' },
  { slug: 'uefa.europa.conf', label: 'UEFA Conference League', region: 'europa' },
  { slug: 'uefa.nations', label: 'UEFA Nations League', region: 'europa' },

  // Américas & Mundo
  { slug: 'conmebol.libertadores', label: 'Copa Libertadores', region: 'americas' },
  { slug: 'conmebol.sudamericana', label: 'Copa Sul-Americana', region: 'americas' },
  { slug: 'arg.1', label: 'Liga Profesional Argentina', region: 'americas' },
  { slug: 'mex.1', label: 'Liga MX (México)', region: 'americas' },
  { slug: 'col.1', label: 'Primera A (Colômbia)', region: 'americas' },
  { slug: 'uru.1', label: 'Campeonato Uruguaio', region: 'americas' },
  { slug: 'chi.1', label: 'Campeonato Chileno', region: 'americas' },
  { slug: 'usa.1', label: 'MLS (Estados Unidos)', region: 'mundo' },
  { slug: 'ksa.1', label: 'Saudi Pro League (Arábia Saudita)', region: 'mundo' },
  { slug: 'jpn.1', label: 'J.League (Japão)', region: 'mundo' },
  { slug: 'aus.1', label: 'A-League (Austrália)', region: 'mundo' },
  { slug: 'afc.champions', label: 'AFC Champions League', region: 'mundo' },
];

export const MULTIPLE_COMPETITION_SET = new Set(
  MULTIPLE_COMPETITIONS.map((c) => c.slug)
);
