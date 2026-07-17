import type { Baja, Bundle, Locale } from './types';
import { s } from './strings';
import EjemplarPhoto from './EjemplarPhoto';
import { deriveMemorial, necroStatus, type WeightPoint } from './memorial';

interface Props {
  baja: Baja;
  bundle: Bundle;
  locale: Locale;
  onSelect: (baja: Baja) => void;
}

// Memorial accent — a muted sepia/brown that reads as "in memoriam" across the
// whole wall, independent of the specimen's species palette.
const MEM = '#8B6F47';

const isFilled = (v: unknown): v is string | number =>
  v != null && v !== 'NA' && v !== '';

// Compact weight-history sparkline. Rendered only when there are ≥2 points, so
// bajas with a single (or no) historial entry simply omit it. The SVG scales
// uniformly (width:100% + height:auto, default preserveAspectRatio) so the end
// marker stays a round dot and the line keeps its proportion at any card width —
// NOT preserveAspectRatio="none", which stretches the viewBox and turns the dot
// into a floating ellipse.
function Sparkline({ points, color }: { points: WeightPoint[]; color: string }) {
  if (points.length < 2) return null;
  const w = 320;
  const h = 44;
  const pad = 5;
  const ys = points.map((p) => p.peso);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanY = maxY - minY || 1;
  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (p.peso - minY) / spanY) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [firstX] = coords[0];
  const [lastX, lastY] = coords[coords.length - 1];
  const area = `${line} L${lastX.toFixed(1)} ${h - pad} L${firstX.toFixed(1)} ${h - pad} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`${points[0].peso} → ${points[points.length - 1].peso} g`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <path d={area} fill={color} opacity="0.1" />
      <path
        d={line}
        fill="none"
        stroke={color}
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
        opacity="0.9"
      />
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="3.2" fill={color} />
    </svg>
  );
}

export default function BajaCard({ baja, bundle, locale, onSelect }: Props) {
  const m = deriveMemorial(bundle, baja);
  const fmt = (v: unknown): string => (!isFilled(v) ? '—' : String(v));
  const { done: necroDone, pending: necroPending, text: necropcia } = necroStatus(baja);

  // Accessible "clickable card": the card is an <article> with its content in
  // normal flow (so the heading, cause, weight, etc. stay in the a11y tree),
  // and a single stretched <button> (absolute inset-0) is the click/tab target.
  // This avoids nesting flow content inside a <button> (invalid HTML) and the
  // aria-label swallowing all the card text.
  return (
    <article class="group relative flex w-full flex-col gap-3 rounded-xl border border-[var(--wq-divider)] bg-[var(--wq-surface)] p-4 transition-[border-color,box-shadow] duration-200 hover:border-[#8B6F47] hover:shadow-[0_8px_24px_rgba(7,31,41,0.12)] has-[button:focus-visible]:outline has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-offset-2 has-[button:focus-visible]:outline-[#8B6F47]">
      <span
        class="pointer-events-none absolute inset-x-0 top-0 h-[3px] rounded-t-xl opacity-40"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${MEM} 50%, transparent 100%)` }}
        aria-hidden="true"
      />
      <header class="flex items-center gap-3">
        <span
          class="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--wq-divider)] bg-[var(--wq-row-bg)]"
          style={{ filter: 'grayscale(0.5) sepia(0.12)' }}
          aria-hidden="true"
        >
          <EjemplarPhoto alias={baja.nombre} accent={MEM} size={48} />
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="m-0 flex items-center gap-1.5 font-display text-[1.1rem] font-bold tracking-tight text-[var(--wq-ink)]">
            <span class="truncate">{baja.nombre}</span>
            <span class="shrink-0 text-sm" aria-hidden="true">🕯️</span>
          </h3>
          <p class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--wq-ink-muted)]">
            <span class="font-mono font-semibold text-[var(--wq-ink)]">{baja.fecha || '—'}</span>
            {baja.edad && <span class="opacity-50" aria-hidden="true">·</span>}
            {baja.edad && <span>{baja.edad}</span>}
          </p>
        </div>
      </header>

      <div class="grid grid-cols-2 gap-2 rounded-lg bg-[var(--wq-row-bg)] p-2.5">
        <div class="flex flex-col gap-0.5">
          <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
            {s(locale, 'bajas.peso')}
          </span>
          <span class="font-display text-[1.1rem] font-bold text-[var(--wq-ink)]">
            {fmt(baja.peso)}
            {isFilled(baja.peso) && <small class="ml-0.5 text-[0.65em] font-medium opacity-70">g</small>}
          </span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
            {s(locale, 'bajas.longitud')}
          </span>
          <span class="font-display text-[1.1rem] font-bold text-[var(--wq-ink)]">
            {fmt(baja.longitud)}
            {isFilled(baja.longitud) && <small class="ml-0.5 text-[0.65em] font-medium opacity-70">cm</small>}
          </span>
        </div>
      </div>

      {m.weightSeries.length >= 2 && (
        <div class="flex flex-col gap-1">
          <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
            {s(locale, 'bajas.memorial.weightTrend')}
          </span>
          <Sparkline points={m.weightSeries} color={MEM} />
        </div>
      )}

      <div class="flex flex-col gap-1 border-t border-dashed border-[var(--wq-divider)] pt-2">
        <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
          {s(locale, 'bajas.causa')}
        </span>
        <span class="text-sm leading-snug text-[var(--wq-ink)]">{baja.causa || '—'}</span>
      </div>

      <footer class="flex items-center justify-between gap-2">
        <span class="shrink-0 text-[11px] font-medium text-[var(--wq-ink-muted)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {s(locale, 'bajas.open')} →
        </span>
        <span
          class={`inline-flex min-w-0 max-w-[62%] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
            necroDone
              ? 'border-[#10B981]/40 text-[#10B981]'
              : necroPending
                ? 'border-[#FBBF24]/40 text-[#FBBF24]'
                : 'border-[var(--wq-divider)] bg-[var(--wq-row-bg)] text-[var(--wq-ink-muted)]'
          }`}
        >
          <span
            class="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: necroDone ? '#10B981' : necroPending ? '#FBBF24' : 'currentColor' }}
          />
          <span class="truncate">
            {necroDone
              ? s(locale, 'bajas.necro.done') + necropcia
              : necroPending
                ? s(locale, 'bajas.necro.pending')
                : s(locale, 'bajas.necro.none')}
          </span>
        </span>
      </footer>

      <button
        type="button"
        onClick={() => onSelect(baja)}
        aria-label={`${s(locale, 'bajas.open')}: ${baja.nombre}`}
        class="aj-press absolute inset-0 z-[1] rounded-xl focus-visible:outline-none active:scale-[0.99]"
      />
    </article>
  );
}
