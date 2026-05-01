import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
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
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null);

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

  const hover = hoverIdx != null ? data[hoverIdx] : null;

  return (
    <div ref={wrapRef} class="relative block w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        class="block w-full select-none"
        onMouseLeave={() => {
          setHoverIdx(null);
          setTip(null);
        }}
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
        {data.map((d, i) => {
          const x = PAD.l + i * bw;
          const v = +d.value || 0;
          const y = yAt(v);
          const h = height - PAD.b - y;
          const c = d.color ?? accent;
          const active = hoverIdx === i;
          return (
            <g key={i}>
              <rect
                x={x + 1.5}
                y={y}
                width={Math.max(2, bw - 3)}
                height={Math.max(1, h)}
                fill={c}
                opacity={active ? 1 : 0.85}
                rx="2"
                class="aj-bar-rise origin-bottom"
                style={{
                  animationDelay: `${Math.min(i * 18, 360)}ms`,
                  filter: active ? `drop-shadow(0 0 8px ${c})` : undefined,
                  transition: 'opacity 150ms, filter 150ms',
                }}
                onMouseEnter={(ev) => {
                  setHoverIdx(i);
                  setTip({ top: (ev as unknown as MouseEvent).clientY, left: (ev as unknown as MouseEvent).clientX });
                }}
                onMouseMove={(ev) => {
                  setTip({ top: (ev as unknown as MouseEvent).clientY, left: (ev as unknown as MouseEvent).clientX });
                }}
              />
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
      {hover && tip && typeof document !== 'undefined' && createPortal(
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            top: tip.top - 12,
            left: tip.left,
            transform: 'translate(-50%, -100%)',
          }}
          class="pointer-events-none z-[9999] min-w-[110px] rounded-md border border-[var(--wq-divider)] bg-[var(--wq-surface)] px-2.5 py-1.5 text-[11px] shadow-lg"
        >
          <div class="font-mono text-[10px] text-[var(--wq-ink-muted)]">{hover.label}</div>
          <div class="flex items-center justify-between gap-3">
            <span class="inline-flex items-center gap-1.5 text-[var(--wq-ink)]">
              <span class="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: hover.color ?? accent }} />
              {format(+hover.value || 0)}
            </span>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
