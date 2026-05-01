import type { Locale, SpeciesCode } from './types';
import { type ThemeMode, accent as accentFor, SPECIES_ORDER } from './theme';
import { s } from './strings';

interface Props {
  locale: Locale;
  theme: ThemeMode;
  totalEjemplares: number;
  totalBajas: number;
  speciesCounts: Record<SpeciesCode, number>;
  selectedSpecies: SpeciesCode | null;
  onSelectSpecies: (sp: SpeciesCode | null) => void;
  view: 'ejemplares' | 'bajas';
  onToggleBajas: () => void;
  waterPath: string;
}

export default function CoverHeader({
  locale,
  theme,
  totalEjemplares,
  totalBajas,
  speciesCounts,
  selectedSpecies,
  onSelectSpecies,
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

      <div class="flex w-full min-w-[260px] flex-col gap-2.5 sm:w-auto sm:min-w-[320px]">
        <div class="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onSelectSpecies(null)}
            class={`rounded-2xl border bg-[var(--wq-row-bg)] p-3.5 text-left text-[var(--wq-ink)] transition-[transform,border-color,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] [@media(hover:hover)]:hover:-translate-y-px ${
              selectedSpecies === null && view === 'ejemplares'
                ? 'border-[var(--wq-ink)]'
                : 'border-[var(--wq-divider)] [@media(hover:hover)]:hover:border-[var(--wq-ink)]/60'
            }`}
            aria-pressed={selectedSpecies === null && view === 'ejemplares'}
          >
            <div class="font-display text-3xl font-bold leading-none text-[var(--wq-ink)]">
              {totalEjemplares}
            </div>
            <div class="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
              {s(locale, 'cover.glance.total')}
            </div>
          </button>

          <button
            type="button"
            onClick={onToggleBajas}
            class={`rounded-2xl border bg-[var(--wq-row-bg)] p-3.5 text-left text-[var(--wq-ink)] transition-[transform,border-color,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] [@media(hover:hover)]:hover:-translate-y-px [@media(hover:hover)]:hover:border-teal/60 ${
              view === 'bajas' ? 'border-teal/60 bg-[var(--wq-surface)]' : 'border-[var(--wq-divider)]'
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

        <div class="grid grid-cols-3 gap-2.5">
          {SPECIES_ORDER.map((sp) => {
            const ac = accentFor(sp, theme);
            const active = selectedSpecies === sp && view === 'ejemplares';
            const dimmed =
              !!selectedSpecies && selectedSpecies !== sp && view === 'ejemplares';
            const count = speciesCounts[sp] ?? 0;
            return (
              <button
                key={sp}
                type="button"
                onClick={() => onSelectSpecies(active ? null : sp)}
                aria-pressed={active}
                class={`group rounded-2xl border bg-[var(--wq-row-bg)] p-2.5 text-left transition-[transform,opacity,box-shadow,border-color,background-color] duration-[220ms] ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] [@media(hover:hover)]:hover:-translate-y-px ${
                  dimmed
                    ? 'opacity-50 saturate-[0.6] [@media(hover:hover)]:hover:opacity-100 [@media(hover:hover)]:hover:saturate-100'
                    : ''
                }`}
                style={{
                  borderColor: active ? ac : 'var(--wq-divider)',
                  backgroundColor: active ? `${ac}1A` : undefined,
                  boxShadow: active
                    ? `inset 0 0 0 1px ${ac}, 0 12px 28px ${ac}33`
                    : undefined,
                  transform: active ? 'translateY(-2px) scale(1.03)' : undefined,
                }}
              >
                <div
                  class="font-display text-2xl font-bold leading-none"
                  style={{ color: ac }}
                >
                  {count}
                </div>
                <div
                  class="mt-1 truncate font-display text-[10.5px] font-semibold italic tracking-tight"
                  style={{ color: ac }}
                  title={sp}
                >
                  {sp}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
