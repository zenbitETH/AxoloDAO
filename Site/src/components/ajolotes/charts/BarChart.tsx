import { useEffect, useRef, useState } from 'preact/hooks';
import type { Locale } from '../types';

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  locale: Locale;
  data: BarDatum[];
  accent: string;
  height?: number;
  format?: (v: number) => string;
  emptyLabel?: string;
}

const PAD = { l: 36, r: 14, t: 14, b: 26 };

export default function BarChart({
  data,
  accent,
  height = 180,
  format = (v) => String(v),
  emptyLabel = '—',
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

  if (!data.length) {
    return (
      <div
        ref={wrapRef}
        class="grid place-items-center rounded-xl border border-dashed border-[var(--wq-divider)] bg-[var(--wq-cell-bg)] text-sm text-[var(--wq-ink-muted)]"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  const vals = data.map((d) => +d.value || 0);
  const yMax = Math.max(...vals, 0.5) * 1.15;
  const bw = (width - PAD.l - PAD.r) / data.length;
  const yAt = (v: number) => PAD.t + (1 - v / yMax) * (height - PAD.t - PAD.b);
  const yTicks = [0, yMax / 2, yMax];
  const step = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div ref={wrapRef} class="block w-full">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} class="block w-full select-none">
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
        {data.map((d, i) => {
          const x = PAD.l + i * bw;
          const v = +d.value || 0;
          const y = yAt(v);
          const h = height - PAD.b - y;
          const c = d.color ?? accent;
          return (
            <g key={i}>
              <rect
                x={x + 1.5}
                y={y}
                width={Math.max(2, bw - 3)}
                height={Math.max(1, h)}
                fill={c}
                opacity="0.85"
                rx="2"
              >
                <title>{`${d.label}: ${format(v)}`}</title>
              </rect>
              {i % step === 0 && (
                <text
                  x={x + bw / 2}
                  y={height - 8}
                  text-anchor="middle"
                  fill="var(--wq-ink-muted)"
                  style="font-family: var(--font-mono, ui-monospace); font-size: 10px;"
                >
                  {String(d.label).slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
