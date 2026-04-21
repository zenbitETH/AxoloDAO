import type { Locale, Measurement, ParameterCatalogEntry, ParamKey } from './types';
import { formatNumber, formatShortDate, paramLabel, STRINGS } from './strings';

interface Props {
  locale: Locale;
  paramKey: ParamKey;
  unit: string;
  measurements: Measurement[];  // pre-filtered: this tank, within time window
  catalog: ParameterCatalogEntry | undefined;
  accentColor: string;
  width?: number;
  height?: number;
  compact?: boolean;
}

const PAD = { top: 12, right: 10, bottom: 22, left: 40 };

export default function ParameterChart({
  locale,
  paramKey,
  unit,
  measurements,
  catalog,
  accentColor,
  width = 320,
  height = 150,
  compact = false,
}: Props) {
  const t = STRINGS[locale];
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const points = measurements
    .map((m) => ({ t: m.date + 'T' + (m.time ?? '00:00'), v: m.values[paramKey] }))
    .filter((p): p is { t: string; v: number } => p.v != null);

  const values = points.map((p) => p.v);
  const min = catalog?.min ?? null;
  const max = catalog?.max ?? null;
  const target = catalog?.target ?? null;

  // Y domain padding: include safe range + observed values with headroom
  const candidates: number[] = [...values];
  if (min != null) candidates.push(min);
  if (max != null) candidates.push(max);
  if (target != null) candidates.push(target);
  const rawMin = candidates.length ? Math.min(...candidates) : 0;
  const rawMax = candidates.length ? Math.max(...candidates) : 1;
  const span = rawMax - rawMin || Math.max(Math.abs(rawMax), 1) * 0.25;
  const yMin = rawMin - span * 0.1;
  const yMax = rawMax + span * 0.1;

  // X domain: by index (not real time), since Monday cadence is ~weekly
  const n = points.length;
  const xAt = (i: number) =>
    n <= 1 ? PAD.left + innerW / 2 : PAD.left + (i / (n - 1)) * innerW;
  const yAt = (v: number) =>
    PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  const bandY = min != null ? yAt(max ?? yMax) : null;
  const bandH =
    min != null && max != null
      ? Math.max(0, yAt(min) - yAt(max))
      : 0;

  const linePath = points.length
    ? points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(p.v).toFixed(2)}`)
        .join(' ')
    : '';

  const latest = points[points.length - 1];
  const firstDate = measurements[0]?.date;
  const lastDate = measurements[measurements.length - 1]?.date;

  if (points.length === 0) {
    return (
      <div class="flex flex-col gap-1">
        <div class="flex items-baseline justify-between">
          <div class="font-display text-sm text-choco/80">{paramLabel(locale, paramKey)}</div>
          <div class="text-xs text-choco/50">{unit}</div>
        </div>
        <div
          class="grid place-items-center rounded-lg border border-choco/10 bg-white/40 text-xs text-choco/50"
          style={{ height: `${height}px` }}
        >
          {t.historyEmpty}
        </div>
      </div>
    );
  }

  return (
    <div class="flex flex-col gap-1">
      <div class="flex items-baseline justify-between gap-2">
        <div class="font-display text-sm text-choco/80">{paramLabel(locale, paramKey)}</div>
        <div class="font-body text-sm text-choco">
          <span class="font-semibold">{formatNumber(latest.v, paramKey)}</span>
          <span class="ml-1 text-xs text-choco/50">{unit}</span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        class="w-full h-auto"
        role="img"
        aria-label={`${paramLabel(locale, paramKey)} — ${formatNumber(latest.v, paramKey)} ${unit}`}
      >
        {/* Safe-range band */}
        {bandY != null && bandH > 0 && (
          <rect
            x={PAD.left}
            y={bandY}
            width={innerW}
            height={bandH}
            fill={accentColor}
            opacity={0.14}
          />
        )}

        {/* Target line (dashed) */}
        {target != null && (
          <line
            x1={PAD.left}
            x2={PAD.left + innerW}
            y1={yAt(target)}
            y2={yAt(target)}
            stroke={accentColor}
            stroke-width={1}
            stroke-dasharray="3 3"
            opacity={0.6}
          />
        )}

        {/* Y-axis min/max labels */}
        {min != null && (
          <text
            x={PAD.left - 6}
            y={yAt(min) + 3}
            text-anchor="end"
            class="fill-choco/50"
            font-size="10"
          >
            {formatNumber(min, paramKey)}
          </text>
        )}
        {max != null && (
          <text
            x={PAD.left - 6}
            y={yAt(max) + 3}
            text-anchor="end"
            class="fill-choco/50"
            font-size="10"
          >
            {formatNumber(max, paramKey)}
          </text>
        )}

        {/* Line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#4A3628"
            stroke-width={2}
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        )}

        {/* Points */}
        {points.map((p, i) => (
          <circle
            cx={xAt(i)}
            cy={yAt(p.v)}
            r={n > 30 ? 1.8 : 2.6}
            fill={accentColor}
            stroke="#F6EFE0"
            stroke-width={1}
          >
            <title>{`${measurements[i]?.date} — ${formatNumber(p.v, paramKey)} ${unit}`}</title>
          </circle>
        ))}

        {/* X-axis date labels */}
        {!compact && firstDate && (
          <text
            x={PAD.left}
            y={height - 6}
            text-anchor="start"
            class="fill-choco/50"
            font-size="10"
          >
            {formatShortDate(locale, firstDate)}
          </text>
        )}
        {!compact && lastDate && firstDate !== lastDate && (
          <text
            x={PAD.left + innerW}
            y={height - 6}
            text-anchor="end"
            class="fill-choco/50"
            font-size="10"
          >
            {formatShortDate(locale, lastDate)}
          </text>
        )}
      </svg>
    </div>
  );
}
