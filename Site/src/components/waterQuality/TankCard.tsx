import type {
  Locale,
  Measurement,
  ParameterCatalogEntry,
  Tank,
} from './types';
import { speciesLabel, STRINGS } from './strings';
import ParameterTable from './ParameterTable';
import HistoricalGrid from './HistoricalGrid';

interface Props {
  locale: Locale;
  tank: Tank;
  prev: Measurement | null;
  curr: Measurement | null;
  history: Measurement[]; // pre-filtered: this tank, within time window
  catalogForTank: ParameterCatalogEntry[];
  onBack: () => void;
}

export default function TankCard({
  locale,
  tank,
  prev,
  curr,
  history,
  catalogForTank,
  onBack,
}: Props) {
  const t = STRINGS[locale];
  const note = tank.note?.[locale];

  return (
    <article
      class="overflow-hidden rounded-2xl text-cream shadow-lg ring-1 ring-black/5"
      style={{ backgroundColor: tank.accentColor }}
    >
      <header class="flex items-start justify-between gap-4 px-6 pt-6">
        <div>
          <p class="font-display text-xs uppercase tracking-wider text-cream/75">
            {t.coverTitle}
          </p>
          <h2 class="mt-1 font-display text-2xl leading-tight">{tank.displayName}</h2>
          {tank.scientificName && (
            <p class="mt-0.5 font-body text-sm italic text-cream/85">
              {tank.scientificName}
            </p>
          )}
          <p class="mt-0.5 font-body text-xs text-cream/70">
            {speciesLabel(locale, tank.speciesCode)}
            {tank.volumeL ? ` · ${tank.volumeL} L` : ''}
          </p>
          {note && (
            <p class="mt-2 inline-flex rounded-md bg-black/15 px-2 py-0.5 font-body text-[11px] text-cream/90">
              {note}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onBack}
          class="rounded-full bg-black/20 px-3 py-1.5 font-body text-xs text-cream/90 transition hover:bg-black/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cream"
        >
          ← {t.back}
        </button>
      </header>

      <div class="px-4 py-4 sm:px-6">
        <ParameterTable
          locale={locale}
          tank={tank}
          prev={prev}
          curr={curr}
          catalogForTank={catalogForTank}
        />
      </div>

      <section class="border-t border-black/10 bg-cream/90 px-4 py-5 text-choco sm:px-6">
        <div class="mb-3 flex items-baseline justify-between">
          <h3 class="font-display text-lg">{t.historyTitle}</h3>
          <span class="font-body text-xs text-choco/60">{history.length} ·</span>
        </div>
        {history.length === 0 ? (
          <p class="rounded-lg bg-cream px-3 py-4 text-sm text-choco/70">
            {t.historyEmpty}
          </p>
        ) : (
          <HistoricalGrid
            locale={locale}
            tank={tank}
            measurements={history}
            catalogForTank={catalogForTank}
          />
        )}
      </section>
    </article>
  );
}
