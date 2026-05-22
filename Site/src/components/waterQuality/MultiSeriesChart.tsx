import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Locale, ParameterCatalogEntry, ParamKey } from './types';
import { formatNumber, formatShortDate, formatWeekDate, paramLabel } from './strings';
import { statusOf } from './status';

export interface ChartSeries {
  tankId: string;
  label: string;
  color: string;
  dashed?: boolean;
  brighter?: boolean;
  // each point: { date ISO, value (nullable) }
  points: { date: string; value: number | null }[];
}

interface Props {
  locale: Locale;
  paramKey: ParamKey;
  unit: string;
  series: ChartSeries[];
  catalog: ParameterCatalogEntry[]; // used to look up min/max per (tank,param)
  height?: number;
  showSafeBand?: boolean;
  // Sync hover across charts (e.g. all small-multiples in detail view)
  highlightDate?: string | null;
  onHighlight?: (date: string | null) => void;
  showLegend?: boolean;
  showTitle?: boolean;
  // Optional ink color override (single-series detail charts use the tank tone)
  ink?: string;
  // dark-mode friendly band stroke
  bandColor?: string;
}

const PAD = { top: 18, right: 14, bottom: 28, left: 44 };

export default function MultiSeriesChart({
  locale,
  paramKey,
  unit,
  series,
  catalog,
  height = 240,
  showSafeBand = false,
  highlightDate,
  onHighlight,
  showLegend = true,
  showTitle = true,
  ink,
  bandColor,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [internalHover, setInternalHover] = useState<string | null>(null);

  // Track container width for responsive sizing
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.max(280, Math.min(1200, e.contentRect.width));
        setWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Date axis: union of all series dates, sorted ascending
  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const s of series) for (const p of s.points) set.add(p.date);
    return [...set].sort();
  }, [series]);

  // Per-series fast lookup
  const byDate = useMemo(() => {
    const map = new Map<string, Map<string, number | null>>();
    for (const s of series) {
      const d = new Map<string, number | null>();
      for (const p of s.points) d.set(p.date, p.value);
      map.set(s.tankId, d);
    }
    return map;
  }, [series]);

  // Y-domain: span across all values + (optionally) catalog limits
  const { yMin, yMax } = useMemo(() => {
    const vals: number[] = [];
    for (const s of series) {
      for (const p of s.points) if (p.value != null) vals.push(p.value);
    }
    if (showSafeBand) {
      for (const c of catalog) {
        if (c.key !== paramKey) continue;
        if (c.min != null) vals.push(c.min);
        if (c.max != null) vals.push(c.max);
      }
    }
    if (vals.length === 0) return { yMin: 0, yMax: 1 };
    let mn = Math.min(...vals);
    let mx = Math.max(...vals);
    if (mx === mn) {
      const pad = Math.max(Math.abs(mx) * 0.1, 1);
      mn -= pad; mx += pad;
    }
    const pad = (mx - mn) * 0.12;
    return { yMin: mn - pad, yMax: mx + pad };
  }, [series, catalog, paramKey, showSafeBand]);

  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const innerH = Math.max(1, height - PAD.top - PAD.bottom);

  const xAt = (i: number) => {
    if (dates.length <= 1) return PAD.left + innerW / 2;
    return PAD.left + (i / (dates.length - 1)) * innerW;
  };
  const yAt = (v: number) => {
    return PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
  };

  // Active hover date (controlled by parent or internal)
  const hoverDate = highlightDate !== undefined ? highlightDate : internalHover;
  const hoverIdx = hoverDate ? dates.indexOf(hoverDate) : -1;

  function handlePointer(e: PointerEvent) {
    if (dates.length === 0) return;
    const svg = (e.currentTarget as SVGSVGElement);
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    // Snap to nearest data index
    let bestIdx = 0;
    let best = Infinity;
    for (let i = 0; i < dates.length; i++) {
      const dx = Math.abs(x - xAt(i));
      if (dx < best) { best = dx; bestIdx = i; }
    }
    const d = dates[bestIdx] ?? null;
    setInternalHover(d);
    onHighlight?.(d);
  }
  function handleLeave() {
    setInternalHover(null);
    onHighlight?.(null);
  }

  // Catalog lookup (for status pip in tooltip rows)
  const catBy = useMemo(() => {
    const m = new Map<string, ParameterCatalogEntry>();
    for (const c of catalog) {
      if (c.key === paramKey) m.set(c.tankId, c);
    }
    return m;
  }, [catalog, paramKey]);

  // Compose line path strings. Null/missing weeks are skipped but do NOT break
  // the line — the next valid point bridges across the gap with an L command so
  // each station's series renders as one continuous polyline.
  function linePath(s: ChartSeries): string {
    const lookup = byDate.get(s.tankId);
    if (!lookup) return '';
    let cmd: string[] = [];
    let prevHadValue = false;
    dates.forEach((d, i) => {
      const v = lookup.get(d);
      if (v == null) return;
      cmd.push(`${prevHadValue ? 'L' : 'M'} ${xAt(i).toFixed(2)} ${yAt(v).toFixed(2)}`);
      prevHadValue = true;
    });
    return cmd.join(' ');
  }

  const ticks = computeTicks(yMin, yMax);

  // Tooltip rows (when hovering). Filter AM family by AM_UNIFICATION so the
  // tooltip only lists the relevant tanks for that date: post-cutoff hides
  // the historic AM 1 / AM 2 split, pre-cutoff hides the unified AM row.
  const AM_UNIFICATION = '2026-04-28';
  const tooltipRows = hoverIdx >= 0
    ? series
        .filter((s) => {
          const d = dates[hoverIdx];
          if (d >= AM_UNIFICATION && (s.tankId === 'AM 1' || s.tankId === 'AM 2')) return false;
          if (d <  AM_UNIFICATION && s.tankId === 'AM') return false;
          return true;
        })
        .map((s) => {
          const v = byDate.get(s.tankId)?.get(dates[hoverIdx]) ?? null;
          const cat = catBy.get(s.tankId);
          const status = statusOf(v, cat?.min ?? null, cat?.max ?? null);
          return { tankId: s.tankId, label: s.label, color: s.color, value: v, status };
        })
    : [];

  return (
    <div ref={wrapRef} class="relative w-full">
      {showTitle && (
        <div class="mb-1.5 flex items-baseline justify-between gap-3">
          <div class="font-display text-[var(--wq-ink)]" style={ink ? { color: ink } : undefined}>
            <span class="text-base font-semibold">{paramLabel(locale, paramKey)}</span>
            <span class="ml-2 text-xs opacity-60">{unit}</span>
          </div>
          {hoverDate && (
            <div class="font-body text-xs tabular-nums text-[var(--wq-ink-muted)]">
              {formatWeekDate(locale, hoverDate)}
            </div>
          )}
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        class="block w-full select-none touch-none"
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        onPointerLeave={handleLeave}
        role="img"
        aria-label={paramLabel(locale, paramKey)}
      >
        {/* y-axis grid */}
        {ticks.map((tv) => (
          <g key={tv}>
            <line
              x1={PAD.left}
              x2={PAD.left + innerW}
              y1={yAt(tv)}
              y2={yAt(tv)}
              stroke="var(--wq-divider)"
              stroke-width={1}
              shape-rendering="crispEdges"
            />
            <text
              x={PAD.left - 6}
              y={yAt(tv) + 3}
              text-anchor="end"
              font-size="10"
              fill="var(--wq-ink-muted)"
              class="tabular-nums"
            >
              {formatNumber(tv, paramKey)}
            </text>
          </g>
        ))}

        {/* x-axis label endpoints */}
        {dates.length > 0 && (
          <>
            <text x={PAD.left} y={height - 8} font-size="10" fill="var(--wq-ink-muted)" text-anchor="start">
              {formatShortDate(locale, dates[0])}
            </text>
            {dates.length > 1 && (
              <text x={PAD.left + innerW} y={height - 8} font-size="10" fill="var(--wq-ink-muted)" text-anchor="end">
                {formatShortDate(locale, dates[dates.length - 1])}
              </text>
            )}
          </>
        )}

        {/* Optional safe-range band (single-series mode) */}
        {showSafeBand && catalog.length > 0 && series.length === 1 && (
          (() => {
            const c = catBy.get(series[0].tankId);
            if (!c || c.min == null || c.max == null) return null;
            const y1 = yAt(c.max);
            const y2 = yAt(c.min);
            return (
              <rect
                x={PAD.left}
                y={Math.min(y1, y2)}
                width={innerW}
                height={Math.abs(y2 - y1)}
                fill={bandColor ?? series[0].color}
                opacity={0.12}
              />
            );
          })()
        )}

        {/* Series lines */}
        {series.map((s) => {
          const path = linePath(s);
          if (!path) return null;
          const stroke = s.color;
          return (
            <g key={s.tankId}>
              <path
                d={path}
                fill="none"
                stroke={stroke}
                stroke-width={s.brighter ? 2.4 : 2}
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-dasharray={s.dashed ? '6 4' : undefined}
                opacity={s.brighter ? 0.95 : 0.92}
              />
              {/* points */}
              {dates.map((d, i) => {
                const v = byDate.get(s.tankId)?.get(d);
                if (v == null) return null;
                const isHover = i === hoverIdx;
                return (
                  <circle
                    cx={xAt(i)}
                    cy={yAt(v)}
                    r={isHover ? 4.5 : (dates.length > 25 ? 1.5 : 2.5)}
                    fill={stroke}
                    stroke="var(--wq-surface)"
                    stroke-width={isHover ? 2 : 1}
                  >
                    <title>{`${s.label}: ${formatNumber(v, paramKey)} ${unit}`}</title>
                  </circle>
                );
              })}
            </g>
          );
        })}

        {/* Hover crosshair */}
        {hoverIdx >= 0 && (
          <line
            x1={xAt(hoverIdx)}
            x2={xAt(hoverIdx)}
            y1={PAD.top}
            y2={PAD.top + innerH}
            stroke="var(--wq-ink)"
            stroke-width={1}
            stroke-dasharray="3 3"
            opacity={0.45}
            pointer-events="none"
          />
        )}
      </svg>

      {/* Legend */}
      {showLegend && series.length > 1 && (
        <ul class="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-[var(--wq-ink-muted)]">
          {series.map((s) => (
            <li class="inline-flex items-center gap-1.5">
              <span
                class="inline-block h-0.5 w-5"
                style={{
                  backgroundColor: s.color,
                  borderTop: s.dashed ? `2px dashed ${s.color}` : 'none',
                  height: s.dashed ? 0 : 2,
                }}
              />
              <span class="font-body">{s.label}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Floating multi-series tooltip (visible on hover) */}
      {tooltipRows.length > 0 && hoverIdx >= 0 && (
        <div
          class="pointer-events-none absolute z-10 rounded-lg border border-[var(--wq-divider)] bg-[var(--wq-surface)] px-3 py-2 text-xs shadow-xl"
          style={{
            left: clampTooltipLeft(xAt(hoverIdx), width, 180),
            top: PAD.top - 4,
            transform: 'translate(-50%, 0)',
            minWidth: 132,
          }}
        >
          <div class="mb-1 font-display text-[10px] uppercase tracking-wider text-[var(--wq-ink-muted)] tabular-nums">
            {formatWeekDate(locale, dates[hoverIdx])}
          </div>
          <ul class="space-y-0.5">
            {tooltipRows.map((r) => (
              <li class="flex items-center justify-between gap-3">
                <span class="inline-flex items-center gap-1.5 font-body text-[var(--wq-ink)]">
                  <span
                    class="inline-block h-2 w-2 rounded-sm"
                    style={{ backgroundColor: r.color }}
                  />
                  {r.label}
                </span>
                <span class="inline-flex items-center gap-1 tabular-nums text-[var(--wq-ink)]">
                  {r.value == null ? '—' : formatNumber(r.value, paramKey)}
                  <span class="opacity-50">{unit}</span>
                  {r.value != null && (
                    <span
                      class={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${
                        r.status === 'ok' ? 'bg-emerald-500'
                        : r.status === 'warn' ? 'bg-amber-400'
                        : 'bg-rose-500'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function computeTicks(min: number, max: number, count = 4): number[] {
  if (max <= min) return [min];
  const range = max - min;
  const rough = range / (count - 1);
  // Round step to a "nice" number
  const exp = Math.floor(Math.log10(rough));
  const base = Math.pow(10, exp);
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * base);
  const step = candidates.find((c) => c >= rough) ?? base * 10;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out.length >= 2 ? out : [min, max];
}

function clampTooltipLeft(x: number, totalW: number, ttW: number): number {
  const half = ttW / 2;
  if (x - half < 4) return half + 4;
  if (x + half > totalW - 4) return totalW - half - 4;
  return x;
}
