import React, { useId } from 'react';
import { TeamCrest } from './TeamCrest.tsx';

export interface MiniPitchTeam {
  name: string;
  shortCode: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
}

export interface MiniPitchProps {
  homeTeam: MiniPitchTeam;
  awayTeam: MiniPitchTeam;
  variant?: 'compact' | 'hero';
  expectedGoalsHome?: number | null;
  expectedGoalsAway?: number | null;
  homeWinPct?: number | null;
  drawPct?: number | null;
  awayWinPct?: number | null;
  homePossessionPct?: number | null;
  awayPossessionPct?: number | null;
  homeShots?: number | null;
  awayShots?: number | null;
  homeShotsOnTarget?: number | null;
  awayShotsOnTarget?: number | null;
  expectedCardsTotal?: number | null;
  expectedCornersTotal?: number | null;
  score?: { homeGoals: number; awayGoals: number } | null;
  isLive?: boolean;
  centerLabel?: string;
  className?: string;
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(15, Math.min(85, Math.round(value)));
}

function computeTerritorialShare(props: MiniPitchProps): {
  homeShare: number;
  awayShare: number;
  basisLabel: string | null;
} {
  if (
    typeof props.homePossessionPct === 'number' &&
    typeof props.awayPossessionPct === 'number' &&
    props.homePossessionPct + props.awayPossessionPct > 0
  ) {
    const total = props.homePossessionPct + props.awayPossessionPct;
    const homeShare = clampPct((props.homePossessionPct / total) * 100);
    return {
      homeShare,
      awayShare: 100 - homeShare,
      basisLabel: `Posse ${Math.round(props.homePossessionPct)}% · ${Math.round(
        props.awayPossessionPct
      )}%`,
    };
  }

  if (
    typeof props.expectedGoalsHome === 'number' &&
    typeof props.expectedGoalsAway === 'number' &&
    props.expectedGoalsHome + props.expectedGoalsAway > 0
  ) {
    const total = props.expectedGoalsHome + props.expectedGoalsAway;
    const homeShare = clampPct((props.expectedGoalsHome / total) * 100);
    return {
      homeShare,
      awayShare: 100 - homeShare,
      basisLabel: `Pressão xG ${homeShare}% · ${100 - homeShare}%`,
    };
  }

  if (
    typeof props.homeWinPct === 'number' &&
    typeof props.awayWinPct === 'number' &&
    props.homeWinPct + props.awayWinPct > 0
  ) {
    const total = props.homeWinPct + props.awayWinPct;
    const homeShare = clampPct((props.homeWinPct / total) * 100);
    return {
      homeShare,
      awayShare: 100 - homeShare,
      basisLabel: `Força 1X2 ${homeShare}% · ${100 - homeShare}%`,
    };
  }

  return { homeShare: 50, awayShare: 50, basisLabel: null };
}

export const MiniPitch: React.FC<MiniPitchProps> = (props) => {
  const {
    homeTeam,
    awayTeam,
    variant = 'compact',
    expectedGoalsHome,
    expectedGoalsAway,
    homeWinPct,
    drawPct,
    awayWinPct,
    homeShots,
    awayShots,
    homeShotsOnTarget,
    awayShotsOnTarget,
    expectedCardsTotal,
    expectedCornersTotal,
    score,
    isLive = false,
    centerLabel,
    className = '',
  } = props;

  const uid = useId().replace(/:/g, '');
  const { homeShare, awayShare, basisLabel } = computeTerritorialShare(props);

  const hasXg =
    typeof expectedGoalsHome === 'number' && typeof expectedGoalsAway === 'number';
  const hasShots = typeof homeShots === 'number' && typeof awayShots === 'number';
  const hasShotsOnTarget =
    typeof homeShotsOnTarget === 'number' && typeof awayShotsOnTarget === 'number';

  const homeShort = (homeTeam.shortCode || homeTeam.name).slice(0, 3).toUpperCase();
  const awayShort = (awayTeam.shortCode || awayTeam.name).slice(0, 3).toUpperCase();

  const isHero = variant === 'hero';

  return (
    <div
      role="img"
      aria-label={`Mini campo: ${homeTeam.name} contra ${awayTeam.name}${
        score ? `, placar ${score.homeGoals} a ${score.awayGoals}` : ''
      }`}
      className={`relative rounded-xl overflow-hidden border border-emerald-900/35 dark:border-emerald-700/40 bg-[#14532D] select-none ${
        isHero ? 'min-h-[154px] sm:min-h-[170px]' : 'h-[70px]'
      } ${className}`}
    >
      {/* Mowed Grass & Official Pitch Markings SVG */}
      <svg
        viewBox="0 0 360 140"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        <defs>
          <radialGradient id={`vignette-${uid}`} cx="50%" cy="50%" r="72%">
            <stop offset="55%" stopColor="#052E16" stopOpacity="0" />
            <stop offset="100%" stopColor="#052E16" stopOpacity="0.45" />
          </radialGradient>
          <linearGradient id={`home-atk-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34D399" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#34D399" stopOpacity="0.20" />
          </linearGradient>
          <linearGradient id={`away-atk-${uid}`} x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.20" />
          </linearGradient>
        </defs>

        {/* Base Turf */}
        <rect x="0" y="0" width="360" height="140" fill="#14532D" />

        {/* Mowed Grass Vertical Stripes */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => (
          <rect
            key={idx}
            x={idx * 45}
            y="0"
            width="45"
            height="140"
            fill={idx % 2 === 0 ? '#166534' : '#15803D'}
            fillOpacity="0.58"
          />
        ))}

        {/* Subtle Attacking Pressure Halves */}
        {hasXg && (
          <>
            <rect
              x="14"
              y="10"
              width="166"
              height="120"
              fill={`url(#home-atk-${uid})`}
              opacity={0.35 + (homeShare / 100) * 0.55}
            />
            <rect
              x="180"
              y="10"
              width="166"
              height="120"
              fill={`url(#away-atk-${uid})`}
              opacity={0.35 + (awayShare / 100) * 0.55}
            />
          </>
        )}

        {/* Outer Vignette */}
        <rect x="0" y="0" width="360" height="140" fill={`url(#vignette-${uid})`} />

        {/* White Pitch Chalk Lines */}
        <g
          fill="none"
          stroke="#ECFDF5"
          strokeOpacity="0.52"
          strokeWidth={isHero ? '1.35' : '1.6'}
        >
          {/* Outer Touchlines */}
          <rect x="14" y="10" width="332" height="120" rx="2" />

          {/* Halfway Line */}
          <line x1="180" y1="10" x2="180" y2="130" />

          {/* Center Circle & Spot */}
          <circle cx="180" cy="70" r="24" />
          <circle cx="180" cy="70" r="2.2" fill="#ECFDF5" fillOpacity="0.65" />

          {/* Left Penalty Area & 6-Yard Goal Box */}
          <rect x="14" y="31" width="44" height="78" />
          <rect x="14" y="49" width="16" height="42" />
          <circle cx="44" cy="70" r="1.6" fill="#ECFDF5" fillOpacity="0.6" />
          <path d="M 58 53 A 22 22 0 0 1 58 87" />

          {/* Right Penalty Area & 6-Yard Goal Box */}
          <rect x="302" y="31" width="44" height="78" />
          <rect x="330" y="49" width="16" height="42" />
          <circle cx="316" cy="70" r="1.6" fill="#ECFDF5" fillOpacity="0.6" />
          <path d="M 302 53 A 22 22 0 0 0 302 87" />

          {/* Left & Right Goal Nets */}
          <rect x="7" y="55" width="7" height="30" strokeOpacity="0.45" />
          <rect x="346" y="55" width="7" height="30" strokeOpacity="0.45" />

          {/* Corner Arcs */}
          <path d="M 14 16 A 6 6 0 0 0 20 10" />
          <path d="M 340 10 A 6 6 0 0 0 346 16" />
          <path d="M 14 124 A 6 6 0 0 1 20 130" />
          <path d="M 340 130 A 6 6 0 0 1 346 124" />
        </g>

        {/* Subtle Directional Attack Vectors in Hero Mode */}
        {isHero && (
          <g strokeOpacity="0.45" strokeWidth="1.5" fill="none">
            <path d="M 118 70 L 146 70 M 141 65 L 146 70 L 141 75" stroke="#6EE7B7" />
            <path d="M 242 70 L 214 70 M 219 65 L 214 70 L 219 75" stroke="#93C5FD" />
          </g>
        )}
      </svg>

      {/* Foreground Content Layer */}
      {isHero ? (
        <div className="relative z-10 flex flex-col justify-between min-h-[154px] sm:min-h-[170px] p-3 sm:p-4">
          {/* Top Quiet Status Strip inside Pitch */}
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-emerald-50/90">
            <span className="font-semibold text-emerald-200">
              Mandante{hasXg ? ` · xG ${expectedGoalsHome!.toFixed(2)}` : ''}
            </span>
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 font-sans font-bold text-rose-200">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse shrink-0"
                  aria-hidden="true"
                />
                <span>AO VIVO</span>
              </span>
            ) : basisLabel ? (
              <span className="text-emerald-100/85">{basisLabel}</span>
            ) : null}
            <span className="font-semibold text-sky-200">
              {hasXg ? `xG ${expectedGoalsAway!.toFixed(2)} · ` : ''}Visitante
            </span>
          </div>

          {/* Center Pitch Lineup: Home Half · Center Circle · Away Half */}
          <div className="my-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
            {/* Home Side */}
            <div className="flex items-center justify-center sm:justify-start gap-2.5 min-w-0 sm:pl-3">
              <div className="rounded-full bg-white/95 dark:bg-slate-950/85 p-1 shadow-sm ring-2 ring-emerald-300/60 shrink-0">
                <TeamCrest
                  name={homeTeam.name}
                  shortCode={homeShort}
                  primaryColor={homeTeam.primaryColor || '#0F766E'}
                  secondaryColor={homeTeam.secondaryColor || '#FFFFFF'}
                  logoUrl={homeTeam.logoUrl}
                  size="sm"
                />
              </div>
              <div className="min-w-0 hidden min-[380px]:block">
                <div className="font-mono text-xs sm:text-sm font-bold text-white drop-shadow-xs truncate">
                  {homeShort}
                </div>
                {typeof homeWinPct === 'number' && (
                  <div className="font-mono tabular-nums text-[11px] font-semibold text-emerald-200">
                    {homeWinPct}% vitória
                  </div>
                )}
              </div>
            </div>

            {/* Center Circle Badge */}
            <div className="flex flex-col items-center justify-center shrink-0">
              <div className="min-w-[60px] px-3 py-1.5 rounded-full bg-slate-950/80 border border-white/25 text-center shadow-sm backdrop-blur-[2px]">
                {score ? (
                  <span className="font-mono tabular-nums text-base sm:text-lg font-bold text-white leading-none">
                    {score.homeGoals} × {score.awayGoals}
                  </span>
                ) : (
                  <span className="font-mono tabular-nums text-xs sm:text-sm font-bold text-white tracking-wider leading-none">
                    {centerLabel || 'VS'}
                  </span>
                )}
              </div>
              {typeof drawPct === 'number' && (
                <span className="mt-1 font-mono tabular-nums text-[10px] font-semibold text-amber-200 drop-shadow-xs">
                  Empate {drawPct}%
                </span>
              )}
            </div>

            {/* Away Side */}
            <div className="flex items-center justify-center sm:justify-end gap-2.5 min-w-0 sm:pr-3">
              <div className="min-w-0 text-right hidden min-[380px]:block">
                <div className="font-mono text-xs sm:text-sm font-bold text-white drop-shadow-xs truncate">
                  {awayShort}
                </div>
                {typeof awayWinPct === 'number' && (
                  <div className="font-mono tabular-nums text-[11px] font-semibold text-sky-200">
                    {awayWinPct}% vitória
                  </div>
                )}
              </div>
              <div className="rounded-full bg-white/95 dark:bg-slate-950/85 p-1 shadow-sm ring-2 ring-sky-300/60 shrink-0">
                <TeamCrest
                  name={awayTeam.name}
                  shortCode={awayShort}
                  primaryColor={awayTeam.primaryColor || '#1D4ED8'}
                  secondaryColor={awayTeam.secondaryColor || '#FFFFFF'}
                  logoUrl={awayTeam.logoUrl}
                  size="sm"
                />
              </div>
            </div>
          </div>

          {/* Bottom Territorial Bar + Complementary Match Telemetry */}
          <div className="space-y-1.5">
            <svg
              viewBox="0 0 100 3"
              preserveAspectRatio="none"
              aria-hidden="true"
              className="w-full h-1.5 rounded-full overflow-hidden bg-slate-950/50"
            >
              <rect x="0" y="0" width={homeShare} height="3" fill="#34D399" />
              <rect x={homeShare} y="0" width={awayShare} height="3" fill="#60A5FA" />
            </svg>

            {(hasShots ||
              hasShotsOnTarget ||
              typeof expectedCornersTotal === 'number' ||
              typeof expectedCardsTotal === 'number') && (
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[11px] font-mono tabular-nums text-emerald-50/90">
                {hasShots && (
                  <span>
                    Chutes {homeShots} × {awayShots}
                  </span>
                )}
                {hasShotsOnTarget && (
                  <span>
                    No gol {homeShotsOnTarget} × {awayShotsOnTarget}
                  </span>
                )}
                {typeof expectedCornersTotal === 'number' && (
                  <span>
                    Escanteios est. {expectedCornersTotal.toFixed(1).replace('.', ',')}
                  </span>
                )}
                {typeof expectedCardsTotal === 'number' && (
                  <span>
                    Cartões est. {expectedCardsTotal.toFixed(1).replace('.', ',')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="relative z-10 h-full flex flex-col justify-between px-2.5 py-1.5">
          <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 min-w-0">
            {/* Home Half */}
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="rounded-full bg-white/95 dark:bg-slate-950/85 p-0.5 shadow-xs ring-1 ring-emerald-300/60 shrink-0">
                <TeamCrest
                  name={homeTeam.name}
                  shortCode={homeShort}
                  primaryColor={homeTeam.primaryColor || '#0F766E'}
                  secondaryColor={homeTeam.secondaryColor || '#FFFFFF'}
                  logoUrl={homeTeam.logoUrl}
                  size="xs"
                />
              </div>
              <div className="min-w-0 leading-tight">
                <div className="font-mono text-[11px] font-bold text-white drop-shadow-xs truncate">
                  {homeShort}
                </div>
                {typeof expectedGoalsHome === 'number' && (
                  <div className="font-mono tabular-nums text-[10px] font-semibold text-emerald-200">
                    xG {expectedGoalsHome.toFixed(1)}
                  </div>
                )}
              </div>
            </div>

            {/* Center Spot Score or VS */}
            <div className="flex items-center justify-center shrink-0">
              <span
                className={`px-2 py-0.5 rounded-full font-mono tabular-nums text-[11px] font-bold border shadow-xs ${
                  isLive
                    ? 'bg-rose-950/90 border-rose-300/60 text-rose-100'
                    : 'bg-slate-950/80 border-white/25 text-white'
                }`}
              >
                {score
                  ? `${score.homeGoals} × ${score.awayGoals}`
                  : centerLabel || 'VS'}
              </span>
            </div>

            {/* Away Half */}
            <div className="flex items-center justify-end gap-1.5 min-w-0">
              <div className="min-w-0 text-right leading-tight">
                <div className="font-mono text-[11px] font-bold text-white drop-shadow-xs truncate">
                  {awayShort}
                </div>
                {typeof expectedGoalsAway === 'number' && (
                  <div className="font-mono tabular-nums text-[10px] font-semibold text-sky-200">
                    xG {expectedGoalsAway.toFixed(1)}
                  </div>
                )}
              </div>
              <div className="rounded-full bg-white/95 dark:bg-slate-950/85 p-0.5 shadow-xs ring-1 ring-sky-300/60 shrink-0">
                <TeamCrest
                  name={awayTeam.name}
                  shortCode={awayShort}
                  primaryColor={awayTeam.primaryColor || '#1D4ED8'}
                  secondaryColor={awayTeam.secondaryColor || '#FFFFFF'}
                  logoUrl={awayTeam.logoUrl}
                  size="xs"
                />
              </div>
            </div>
          </div>

          {/* Bottom Pressure Strip when xG or 1X2 is available */}
          {(hasXg || typeof homeWinPct === 'number') && (
            <svg
              viewBox="0 0 100 2"
              preserveAspectRatio="none"
              aria-hidden="true"
              className="w-full h-1 rounded-full overflow-hidden bg-slate-950/50 shrink-0"
            >
              <rect x="0" y="0" width={homeShare} height="2" fill="#34D399" />
              <rect x={homeShare} y="0" width={awayShare} height="2" fill="#60A5FA" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
};
