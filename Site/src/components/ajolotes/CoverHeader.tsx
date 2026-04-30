import type { Locale } from './types';
import { s } from './strings';

interface Props {
  locale: Locale;
  totalEjemplares: number;
  totalEspecies: number;
  totalBajas: number;
  view: 'ejemplares' | 'bajas';
  onToggleBajas: () => void;
  waterPath: string;
}

export default function CoverHeader({
  locale,
  totalEjemplares,
  totalEspecies,
  totalBajas,
  view,
  onToggleBajas,
  waterPath,
}: Props) {
  return (
    <section class="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-8 px-6 pb-2 pt-9 sm:flex-row">
      <div class="max-w-[720px]">
        <p class="m-0 mb-2.5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
          <span
            class="inline-block h-1.5 w-1.5 rounded-full bg-teal"
            style={{ boxShadow: '0 0 8px var(--teal, #009C9C)' }}
            aria-hidden="true"
          />
          {s(locale, 'cover.eyebrow')}
        </p>
        <h1 class="m-0 mb-2 font-display text-4xl font-bold leading-[1.05] tracking-tight text-[var(--wq-ink)] sm:text-5xl">
          {s(locale, 'cover.title')}
        </h1>
        <p class="m-0 max-w-[56ch] text-base leading-relaxed text-[var(--wq-ink-muted)] sm:text-lg">
          {s(locale, 'cover.sub')}
        </p>
        <a
          href={waterPath}
          class="mt-3.5 inline-flex items-center gap-1 rounded-full border border-[var(--wq-divider)] px-3.5 py-1.5 text-sm text-[var(--wq-ink)] transition-colors duration-200 hover:bg-[var(--wq-row-bg)]"
        >
          ← {s(locale, 'cover.toWater')}
        </a>
      </div>
      <div class="grid w-full min-w-[260px] grid-cols-3 gap-2.5 sm:w-auto">
        <div class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-3.5">
          <div class="font-display text-3xl font-bold leading-none text-[var(--wq-ink)]">
            {totalEjemplares}
          </div>
          <div class="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
            {s(locale, 'cover.glance.ejemplares')}
          </div>
        </div>
        <div class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-3.5">
          <div class="font-display text-3xl font-bold leading-none text-[var(--wq-ink)]">
            {totalEspecies}
          </div>
          <div class="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
            {s(locale, 'cover.glance.especies')}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleBajas}
          class={`rounded-2xl border bg-[var(--wq-row-bg)] p-3.5 text-left text-[var(--wq-ink)] transition-all duration-200 hover:-translate-y-px hover:border-teal/60 ${
            view === 'bajas'
              ? 'border-teal/60 bg-[var(--wq-surface)]'
              : 'border-[var(--wq-divider)]'
          }`}
          title={s(locale, 'cover.glance.bajas')}
        >
          <div class="font-display text-3xl font-bold leading-none text-[var(--wq-ink)]">
            {totalBajas}
          </div>
          <div class="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
            {s(locale, 'cover.glance.bajas')}
          </div>
        </button>
      </div>
    </section>
  );
}
