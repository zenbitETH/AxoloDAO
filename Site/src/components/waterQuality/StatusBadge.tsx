import type { ParamKey, Status, Trend } from './types';
import { formatNumber } from './strings';

interface StatusBadgeProps {
  trend: Trend;
  status: Status;
  size?: 'xs' | 'sm' | 'md';
  // 'on-accent' = sitting on a saturated tank-colored cell (use cream text)
  // 'on-surface' = sitting on a cream / dark-charcoal surface (use themed text)
  variant?: 'on-accent' | 'on-surface';
}

export function StatusBadge({
  trend,
  status,
  size = 'sm',
  variant = 'on-surface',
}: StatusBadgeProps) {
  const tile =
    size === 'xs' ? 'h-5 w-5 text-[10px]'
    : size === 'sm' ? 'h-6 w-6 text-xs'
    : 'h-7 w-7 text-sm';

  const trendChar = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '–';

  // Trend chip picks a tone that reads against its parent surface.
  // NB: `text-white` would be reinterpreted as dark navy in light mode via a
  // global override, so the on-accent variant uses `text-cream` explicitly.
  const trendBg =
    variant === 'on-accent'
      ? 'bg-white/25 text-cream'
      : 'bg-[var(--wq-ink)]/10 text-[var(--wq-ink)]';

  // Status pip stays the same across variants — it's a solid semantic color
  // (green / amber / rose) that reads clearly against anything.
  let pipBg: string;
  let pipChar: string;
  if (status === 'ok') {
    pipBg = 'bg-emerald-500 text-white';
    pipChar = '✓';
  } else if (status === 'warn') {
    pipBg = 'bg-amber-400 text-choco';
    pipChar = '!';
  } else {
    pipBg = 'bg-rose-500 text-white wq-pulse';
    pipChar = '!';
  }

  const ariaLabel =
    status === 'alarm' ? 'Fuera de rango' : status === 'warn' ? 'Cerca del límite' : 'Dentro de rango';

  return (
    <span class="inline-flex items-center gap-1" aria-label={ariaLabel}>
      <span class={`${tile} grid place-items-center rounded-md font-semibold ${trendBg}`} aria-hidden="true">
        {trendChar}
      </span>
      <span class={`${tile} grid place-items-center rounded-md font-semibold ${pipBg}`} aria-hidden="true">
        {pipChar}
      </span>
    </span>
  );
}

interface RangeChipProps {
  min: number | null | undefined;
  max: number | null | undefined;
  unit: string;
  paramKey: ParamKey;
  tone?: 'muted' | 'accent';
  accentColor?: string;
}

export function RangeChip({ min, max, unit, paramKey, tone = 'muted', accentColor }: RangeChipProps) {
  if (min == null && max == null) return null;
  const a = min == null ? '—' : formatNumber(min, paramKey);
  const b = max == null ? '—' : formatNumber(max, paramKey);

  const cls = tone === 'accent'
    ? 'bg-current/10 text-current'
    : 'bg-choco/10 text-choco/65 dark:bg-cream/10 dark:text-cream/70';

  return (
    <span
      class={`inline-flex items-baseline gap-1 rounded-md px-1.5 py-px text-[10px] font-body tabular-nums ${cls}`}
      style={tone === 'accent' && accentColor ? { color: accentColor, backgroundColor: `${accentColor}1F` } : undefined}
      title={`Rango seguro: ${a} – ${b} ${unit}`}
    >
      <span>{a}</span>
      <span class="opacity-60">–</span>
      <span>{b}</span>
      <span class="opacity-60">{unit}</span>
    </span>
  );
}
