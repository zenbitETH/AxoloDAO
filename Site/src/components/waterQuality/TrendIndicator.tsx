import type { Status, Trend } from './types';

interface Props {
  trend: Trend;
  status: Status;
  size?: 'sm' | 'md';
}

// Reference slides use ▲ ▼ = paired with ✓ (green) or ⚠ (yellow).
// We fold warn + alarm into a single yellow caution; the precise status is
// still conveyed through the card colouring and the aria label.
export default function TrendIndicator({ trend, status, size = 'md' }: Props) {
  const trendChar = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '=';
  const ok = status === 'ok';
  const tile = size === 'sm' ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-sm';
  const arrowBg = ok ? 'bg-choco/70 text-cream' : 'bg-choco/60 text-cream';
  const checkBg = ok
    ? 'bg-emerald-500/90 text-white'
    : 'bg-amber-400 text-choco';

  const label =
    status === 'ok'
      ? 'Dentro de rango'
      : status === 'warn'
      ? 'Cerca del límite'
      : 'Fuera de rango';

  return (
    <div class="inline-flex items-center gap-1" aria-label={label}>
      <span
        class={`${tile} grid place-items-center rounded-md font-semibold ${arrowBg}`}
        aria-hidden="true"
      >
        {trendChar}
      </span>
      <span
        class={`${tile} grid place-items-center rounded-md font-semibold ${checkBg}`}
        aria-hidden="true"
      >
        {ok ? '✓' : '!'}
      </span>
    </div>
  );
}
