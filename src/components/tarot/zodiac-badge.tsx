import type { ZodiacResult } from '@/lib/zodiac/get-zodiac-sign';

interface ZodiacBadgeProps {
  zodiac: Pick<ZodiacResult, 'sign' | 'symbol' | 'element'>;
  className?: string;
}

const ELEMENT_COLORS: Record<string, string> = {
  Fire: 'text-amber-400 border-amber-400/40 bg-amber-400/10',
  Earth: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
  Air: 'text-sky-400 border-sky-400/40 bg-sky-400/10',
  Water: 'text-indigo-400 border-indigo-400/40 bg-indigo-400/10',
};

export function ZodiacBadge({ zodiac, className = '' }: ZodiacBadgeProps) {
  const colorClass =
    ELEMENT_COLORS[zodiac.element] ?? 'text-amber-400 border-amber-400/40 bg-amber-400/10';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-medium tracking-wide ${colorClass} ${className}`}
      aria-label={`Zodiac sign: ${zodiac.sign}, element: ${zodiac.element}`}
    >
      <span aria-hidden="true">{zodiac.symbol}</span>
      {zodiac.sign}
    </span>
  );
}
