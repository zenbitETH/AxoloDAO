import type { Baja, Locale } from './types';
import { s } from './strings';

interface Props {
  baja: Baja;
  locale: Locale;
}

const isFilled = (v: unknown): v is string | number =>
  v != null && v !== 'NA' && v !== '';

export default function BajaCard({ baja, locale }: Props) {
  const fmt = (v: unknown): string =>
    !isFilled(v) ? '—' : String(v);
  const necropcia = String(baja.necropcia ?? '').trim();
  const necroDone = isFilled(baja.necropcia) && !/proceso/i.test(necropcia);
  const necroPending = /proceso/i.test(necropcia);

  return (
    <article class="relative flex flex-col gap-3 rounded-xl border border-[var(--wq-divider)] bg-[var(--wq-surface)] p-4 transition-colors duration-200 hover:border-[#8B6F47]">
      <span
        class="pointer-events-none absolute inset-x-0 top-0 h-[3px] rounded-t-xl opacity-40"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #8B6F47 50%, transparent 100%)' }}
        aria-hidden="true"
      />
      <header class="flex items-center gap-3">
        <span
          class="grid h-11 w-11 place-items-center rounded-full border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] text-[28px]"
          style={{ filter: 'grayscale(0.3)' }}
          aria-hidden="true"
        >
          🪦
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="m-0 font-display text-[1.1rem] font-bold tracking-tight text-[var(--wq-ink)]">
            {baja.nombre}
          </h3>
          <p class="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--wq-ink-muted)]">
            <span class="font-mono font-semibold text-[var(--wq-ink)]">{baja.fecha || '—'}</span>
            {baja.edad && <span class="opacity-50">·</span>}
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
      <div class="flex flex-col gap-1 border-t border-dashed border-[var(--wq-divider)] pt-1">
        <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
          {s(locale, 'bajas.causa')}
        </span>
        <span class="text-sm leading-snug text-[var(--wq-ink)]">{baja.causa || '—'}</span>
      </div>
      <footer class="flex justify-end">
        <span
          class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
            necroDone
              ? 'border-[#10B981]/40 text-[#10B981]'
              : necroPending
              ? 'border-[#FBBF24]/40 text-[#FBBF24]'
              : 'border-[var(--wq-divider)] bg-[var(--wq-row-bg)] text-[var(--wq-ink-muted)]'
          }`}
        >
          <span
            class="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: necroDone ? '#10B981' : necroPending ? '#FBBF24' : 'currentColor',
            }}
          />
          {necroDone
            ? s(locale, 'bajas.necro.done') + necropcia
            : necroPending
            ? s(locale, 'bajas.necro.pending')
            : s(locale, 'bajas.necro.none')}
        </span>
      </footer>
    </article>
  );
}
