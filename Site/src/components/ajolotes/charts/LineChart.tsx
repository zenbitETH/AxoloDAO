// Hand-rolled SVG line chart, ported from the prototype's charts.jsx and
// extended with the waterQuality MultiSeriesChart's responsive ResizeObserver
// pattern so it scales cleanly inside the modal at any width.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Locale } from '../types';
import { s } from '../strings';

export interface LineChartSeries {
  name: string;
  data: { date: string; value: number | null }[];
  color?: string;
}

interface Props {
  locale: Locale;
  series: LineChartSeries[];
  accent: string;
  height?: number;
  yLabel?: string;
  format?: (v: number) => string;
}

const PAD = { l: 40, r: 14, b: 26 };

export default function LineChart({
  locale,
  series,
  accent,
  height = 200,
  yLabel,
  format = (v) => String(v),
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);

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

  const padTop = series.length > 1 ? 28 : 14;

  const flat = useMemo(
    () => series.flatMap((sr) => sr.data).filter((d) => d.value != null && !Number.isNaN(d.value)),
    [series],
  );

  if (flat.length < 1) {
    return (
      <div
        ref={wrapRef}
        class="grid place-items-center rounded-xl border border-dashed border-[var(--wq-divider)] bg-[var(--wq-cell-bg)] text-sm text-[var(--wq-ink-muted)]"
        style={{ height }}
      >
        {s(locale, 'biometria.empty')}
      </div>
    );
  }

  const dates = useMemo(() => [...new Set(flat.map((d) => d.date))].sort(), [flat]);
  const xAt = (d: string) => {
    const i = dates.indexOf(d);
    if (dates.length === 1) return PAD.l + (width - PAD.l - PAD.r) / 2;
    return PAD.l + (i / (dates.length - 1)) * (width - PAD.l - PAD.r);
  };

  const { yMin, yMax } = useMemo(() => {
    const vals = flat.map((d) => +(d.value as number));
    let mn = Math.min(...vals);
    let mx = Math.max(...vals);
    if (mn === mx) {
      mn -= 1;
      mx += 1;
    }
    const p = (mx - mn) * 0.15;
    return { yMin: mn - p, yMax: mx + p };
  }, [flat]);

  const yAt = (v: number) => padTop + (1 - (v - yMin) / (yMax - yMin)) * (height - padTop - PAD.b);

  const yTicks: number[] = [];
  for (let i = 0; i <= 3; i++) yTicks.push(yMin + (i / 3) * (yMax - yMin));

  const xTickIdxs: number[] = [];
  const xTickCount = 4;
  if (dates.length <= xTickCount) {
    dates.forEach((_, i) => xTickIdxs.push(i));
  } else {
    for (let i = 0; i < xTickCount; i++) {
      xTickIdxs.push(Math.round((i / (xTickCount - 1)) * (dates.length - 1)));
    }
  }

  return (
    <div ref={wrapRef} class="block w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        class="block w-full select-none"
      >
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={yAt(v)} x2={width - PAD.r} y2={yAt(v)} stroke="var(--wq-divider)" stroke-width="1" />
            <text
              x={PAD.l - 6}
              y={yAt(v) + 3}
              text-anchor="end"
              fill="var(--wq-ink-muted)"
              style="font-family: var(--font-mono, ui-monospace); font-size: 10px;"
            >
              {format(v)}
            </text>
          </g>
        ))}
        {xTickIdxs.map((i) => (
          <text
            key={i}
            x={xAt(dates[i])}
            y={height - 8}
            text-anchor="middle"
            fill="var(--wq-ink-muted)"
            style="font-family: var(--font-mono, ui-monospace); font-size: 10px;"
          >
            {dates[i].slice(5)}
          </text>
        ))}
        {series.map((sr, si) => {
          const pts = sr.data
            .filter((d) => d.value != null && !Number.isNaN(d.value))
            .map((d) => ({ x: xAt(d.date), y: yAt(+(d.value as number)), v: d.value as number, date: d.date }));
          if (pts.length === 0) return null;
          const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
          const color = sr.color ?? accent;
          return (
            <g key={si}>
              <path
                d={path}
                fill="none"
                stroke={color}
                stroke-width="2"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill={color}>
                  <title>{`${p.date}: ${format(p.v)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {series.length > 1 && (
          <g transform={`translate(${PAD.l}, 12)`}>
            {series.map((sr, i) => (
              <g key={i} transform={`translate(${i * 64}, 0)`}>
                <rect x="0" y="-7" width="10" height="3" fill={sr.color ?? accent} rx="1" />
                <text x="14" y="-3" fill="var(--wq-ink)" style="font-family: var(--font-body, system-ui); font-size: 11px; font-weight: 600;">
                  {sr.name}
                </text>
              </g>
            ))}
          </g>
        )}
        {yLabel && (
          <text x="8" y={padTop + 4} fill="var(--wq-ink-muted)" style="font-family: var(--font-body, system-ui); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">
            {yLabel}
          </text>
        )}
      </svg>
    </div>
  );
}
