/**
 * CoinIcon — иконка игровой монеты (валюта Warmingtea).
 * Однотонная, наследует цвет через currentColor; размер по умолчанию 1em,
 * чтобы вставать в строку текста на месте прежнего глифа «●».
 */
interface CoinIconProps {
  size?: number | string;
  className?: string;
}

export function CoinIcon({ size = '1em', className }: CoinIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      style={{ verticalAlign: '-0.15em', flexShrink: 0 }}
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="8.5" />
      {/* Звезда «вырезана» полупрозрачным тёмным — читается на янтаре в обеих темах */}
      <path
        d="M10 5 L11.37 8.05 L14.7 8.4 L12.2 10.64 L12.9 13.9 L10 12.2 L7.1 13.9 L7.8 10.64 L5.3 8.4 L8.63 8.05 Z"
        fill="rgba(0,0,0,0.24)"
      />
    </svg>
  );
}
