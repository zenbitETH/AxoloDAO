import type { Ejemplar, Locale } from './types';
import { genderSymbol, type ThemeMode, accent as accentFor, stationOf } from './theme';
import { genderTitle, s } from './strings';
import { classifyStage } from './stage';
import EjemplarPhoto from './EjemplarPhoto';
import StageChip from './StageChip';

interface Props {
  ej: Ejemplar;
  theme: ThemeMode;
  locale: Locale;
  // 'highlighted' = matches the active species pill, 'dimmed' = doesn't.
  // 'neutral' = no species filter applied. Default neutral.
  emphasis?: 'neutral' | 'highlighted' | 'dimmed';
  onClick: (ej: Ejemplar) => void;
}

const GENDER_CLASS: Record<'♀' | '♂' | '(?)', string> = {
  '♀':   'text-[#D67BA8] dark:text-[#F4A6CB] text-[1.15em] font-semibold',
  '♂':   'text-[#4FA3D1] dark:text-[#7AC0E8] text-[1.15em] font-semibold',
  '(?)': 'text-[var(--wq-ink-muted)] text-[0.78em] tracking-tight font-medium ml-1',
};

// Mirrors the carousel's `specimenRibbons` map (Context/carousel/scripts/
// generate-weekly.ts). Keyed by exact alias from bundle.json. Update weekly.
const SPECIMEN_RIBBONS: Record<string, string> = {
  Panchita: 'En cuarentena',
  Rómulo: 'En cuarentena',
  Chocoroll: 'En cuarentena',
};

function peceraLabel(locale: Locale, pecera: string | null | undefined): string {
  const raw = (pecera ?? '').trim();
  if (!raw) return '—';
  const station = stationOf(raw);
  if (station === 'AM') return `${s(locale, 'pecera.aquarium')} ${raw}`;
  if (station === 'AA' || station === 'AD') return `${s(locale, 'pecera.station')} ${raw}`;
  return raw;
}

export default function EjemplarCard({ ej, theme, locale, emphasis = 'neutral', onClick }: Props) {
  const ac = accentFor(ej.especie, theme);
  const sym = genderSymbol(ej.genero);
  const gTitle = genderTitle(locale, ej.genero);
  const stage = classifyStage(ej.lt, ej.estadio);

  const dimmed = emphasis === 'dimmed';
  const highlighted = emphasis === 'highlighted';

  // Hover beats dim — curators can still inspect a non-matching card without
  // clearing the species pill. The hover lift / press feedback are gated to
  // hover-capable pointers so touch devices don't trigger sticky :hover.
  const stateClass = dimmed
    ? 'opacity-40 saturate-[0.55] [@media(hover:hover)]:hover:opacity-100 [@media(hover:hover)]:hover:saturate-100'
    : highlighted
      ? '-translate-y-[2px] scale-[1.015]'
      : '';

  return (
    <button
      type="button"
      onClick={() => onClick(ej)}
      style={{
        borderTopColor: ac,
        ['--accent' as string]: ac,
        boxShadow: highlighted
          ? `0 18px 36px ${ac}33, 0 0 0 1px ${ac}66`
          : undefined,
      }}
      class={`aj-card-button group flex w-full cursor-pointer flex-col overflow-hidden rounded-3xl border border-[var(--wq-divider)] border-t-[3px] bg-[var(--wq-cell-bg)] text-left text-[var(--wq-ink)] transition-[transform,opacity,box-shadow,border-color] duration-[220ms] ease-[cubic-bezier(0.23,1,0.32,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 active:scale-[0.985] [@media(hover:hover)]:hover:-translate-y-[2px] [@media(hover:hover)]:hover:border-[color:var(--accent)] [@media(hover:hover)]:hover:shadow-[0_14px_32px_rgba(0,0,0,0.18)] ${stateClass}`}
      aria-label={ej.alias}
    >
      {/* Photo hero — square, fills card width */}
      <div class="relative aspect-square w-full overflow-hidden bg-[var(--wq-row-bg)]">
        <EjemplarPhoto alias={ej.alias} accent={ac} fill />
        {SPECIMEN_RIBBONS[ej.alias] && (
          <span class="aj-ribbon absolute right-2 top-2 whitespace-nowrap rounded-full bg-rosa px-3 py-1 font-display text-[10px] font-extrabold uppercase tracking-[0.14em] text-marfil shadow-[0_6px_14px_rgba(7,31,41,0.45),inset_0_-1px_0_rgba(0,0,0,0.18)]">
            {SPECIMEN_RIBBONS[ej.alias]}
          </span>
        )}
      </div>

      {/* Info row */}
      <div class="flex flex-col gap-1.5 p-4">
        <h3 class="m-0 flex items-baseline justify-between gap-2 font-display text-[1.15rem] font-bold leading-tight tracking-tight text-[var(--wq-ink)]">
          <span class="min-w-0 truncate">{ej.alias}</span>
          <span class={GENDER_CLASS[sym]} title={gTitle} aria-label={gTitle}>
            {sym}
          </span>
        </h3>
        {ej.fenotipo && (
          <p class="m-0 truncate text-xs italic text-[var(--wq-ink-muted)]">
            {ej.fenotipo}
          </p>
        )}
        <span
          class="min-w-0 truncate font-display text-xs italic"
          style={{ color: ac }}
        >
          {ej.especie}
        </span>
        <div class="mt-1 flex flex-wrap items-center gap-1.5">
          <StageChip stage={stage} accent={ac} locale={locale} />
          <span
            class="whitespace-nowrap rounded-full px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.03em] shadow-sm"
            style={{ backgroundColor: ac, color: '#F6EFE0' }}
          >
            {peceraLabel(locale, ej.pecera)}
          </span>
        </div>
        {ej.id && (
          <div
            class="aj-semarnat mt-0.5 flex w-full items-center gap-1.5 whitespace-nowrap rounded border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-2 py-1"
            title={s(locale, 'card.semarnat.tooltip')}
          >
            <span class="shrink-0 text-[9px] font-semibold uppercase tracking-[0.04em] text-[var(--wq-ink-muted)]">
              {s(locale, 'card.semarnat')}
            </span>
            <span class="ml-auto font-mono font-semibold leading-none tracking-[-0.02em] text-[var(--wq-ink)]">
              {ej.id}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
