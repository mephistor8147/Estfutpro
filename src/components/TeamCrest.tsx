import React from 'react';

interface TeamCrestProps {
  name: string;
  shortCode: string;
  primaryColor: string;
  secondaryColor: string;
  size?: 'sm' | 'md' | 'lg';
}

export const TeamCrest: React.FC<TeamCrestProps> = ({
  name,
  shortCode,
  primaryColor,
  secondaryColor,
  size = 'md',
}) => {
  const dimensions =
    size === 'lg' ? 'w-14 h-16' : size === 'sm' ? 'w-8 h-9' : 'w-11 h-12';
  const fontSize =
    size === 'lg' ? 'text-[13px]' : size === 'sm' ? 'text-[9px]' : 'text-[11px]';

  const clipId = `shield-${shortCode}-${primaryColor.replace('#', '')}-${size}`;

  return (
    <div
      className={`relative shrink-0 flex items-center justify-center select-none ${dimensions}`}
      aria-label={`Escudo de ${name}`}
    >
      <svg
        viewBox="0 0 44 50"
        className="w-full h-full drop-shadow-xs"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId}>
            <path d="M22 2L40 8.5V23.5C40 35.2 31.8 44.6 22 48C12.2 44.6 4 35.2 4 23.5V8.5L22 2Z" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <rect x="0" y="0" width="44" height="50" fill={primaryColor} />
          <path
            d="M-6 36L50 6L50 18L-6 48Z"
            fill={secondaryColor}
            fillOpacity="0.22"
          />
          <rect
            x="0"
            y="0"
            width="44"
            height="10"
            fill={secondaryColor}
            fillOpacity="0.14"
          />
        </g>
        <path
          d="M22 2L40 8.5V23.5C40 35.2 31.8 44.6 22 48C12.2 44.6 4 35.2 4 23.5V8.5L22 2Z"
          fill="none"
          stroke="rgba(15, 23, 42, 0.16)"
          strokeWidth="1.5"
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-mono font-semibold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] ${fontSize}`}
      >
        {shortCode.slice(0, 3).toUpperCase()}
      </span>
    </div>
  );
};
