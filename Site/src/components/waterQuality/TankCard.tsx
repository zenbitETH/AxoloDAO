import type {
  Locale,
  Measurement,
  ParameterCatalogEntry,
  Tank,
  TimeWindow,
} from './types';
import { speciesLabel, STRINGS } from './strings';
import ParameterTable from './ParameterTable';
import HistoricalGrid from './HistoricalGrid';
import WindowToggle from './WindowToggle';
import { accentForTheme, useTheme } from './theme';

interface Props {
  locale: Locale;
  tank: Tank;
  prev: Measurement | null;
  curr: Measurement | null;
  history: Measurement[];
  catalogForTank: ParameterCatalogEntry[];
  onBack: () => void;
  window: TimeWindow;
  onWindowChange: (w: TimeWindow) => void;
}

export default function TankCard({
  locale,
  tank,
  prev,
  curr,
  history,
  catalogForTank,
  onBack,
  window: timeWindow,
  onWindowChange,
}: Props) {
  const t = STRINGS[locale];
  const note = tank.note?.[locale];
  const theme = useTheme();
  // Use a brighter accent on dark backgrounds so the tank identity stays
  // legible (the light-mode accents are too dark for a dark surface).
  const accent = accentForTheme(tank.speciesCode, theme, tank.accentColor);
  // The top border always uses the saturated light-mode tone — it's a wide
  // block of color and both themes handle it well.
  const borderAccent = tank.accentColor;

  return (
    <article
      class="overflow-hidden rounded-2xl bg-[var(--wq-surface-2)] shadow-sm ring-1 ring-[var(--wq-divider)]"
      style={{ borderTop: `3px solid ${borderAccent}` }}
    >
      <header class="flex items-start justify-between gap-4 px-5 pt-5 sm:px-7 sm:pt-6">
        <div>
          <p class="font-body text-[11px] uppercase tracking-wider text-[var(--wq-ink-muted)]">
            {t.coverTitle}
          </p>
          <h2 class="mt-1 font-display text-2xl leading-tight sm:text-3xl" style={{ color: accent }}>
            {tank.displayName}
          </h2>
          {tank.scientificName && (
            <p class="mt-0.5 font-body text-sm italic" style={{ color: accent, opacity: 0.8 }}>
              {tank.scientificName}
            </p>
          )}
          <p class="mt-0.5 font-body text-xs text-[var(--wq-ink-muted)]">
            {speciesLabel(locale, tank.speciesCode)}
            {tank.volumeL ? ` · ${tank.volumeL} L` : ''}
          </p>
          {note && (
            <p
              class="mt-2 inline-flex rounded-md px-2 py-0.5 font-body text-[11px]"
              style={{ color: accent, backgroundColor: `${accent}1F` }}
            >
              {note}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onBack}
          class="rounded-full border border-[var(--wq-divider)] bg-[var(--wq-surface)] px-3 py-1.5 font-body text-xs text-[var(--wq-ink)] transition hover:bg-[var(--wq-ink)]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wq-ink)]"
        >
          ← {t.back}
        </button>
      </header>

      <div class="px-4 py-4 sm:px-6 sm:py-5">
        <ParameterTable
          locale={locale}
          prev={prev}
          curr={curr}
          catalogForTank={catalogForTank}
          accent={accent}
        />
      </div>

      <section class="border-t border-[var(--wq-divider)] bg-[var(--wq-surface)] px-4 py-5 sm:px-6">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 class="font-display text-lg" style={{ color: accent }}>
            {t.historyTitle}
          </h3>
          <div class="flex items-center gap-3">
            <WindowToggle
              locale={locale}
              window={timeWindow}
              onWindowChange={onWindowChange}
            />
            <span class="font-body text-xs text-[var(--wq-ink-muted)] tabular-nums">
              {history.length} {t.week.toLowerCase()}s
            </span>
          </div>
        </div>
        {history.length === 0 ? (
          <p class="rounded-lg bg-[var(--wq-cell-bg)] px-3 py-4 text-sm text-[var(--wq-ink-muted)]">
            {t.historyEmpty}
          </p>
        ) : (
          <HistoricalGrid
            locale={locale}
            tank={tank}
            measurements={history}
            catalogForTank={catalogForTank}
            accent={accent}
          />
        )}
      </section>
    </article>
  );
}
