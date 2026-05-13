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
import type { Ejemplar } from '../ajolotes/types';
import { aliasSlug, ejemplarPhotoUrl } from '../ajolotes/photos';
import AjoloteAvatar from '../ajolotes/AjoloteAvatar';

interface Props {
  locale: Locale;
  tank: Tank;
  prev: Measurement | null;
  curr: Measurement | null;
  history: Measurement[];
  catalogForTank: ParameterCatalogEntry[];
  ejemplares: Ejemplar[];
  onBack: () => void;
  window: TimeWindow;
  onWindowChange: (w: TimeWindow) => void;
}

// Bundle stores pecera as "AM 1.1", "AM 1.2", "AM 2.1" etc., while tank IDs in
// the water-quality data are "AM 1", "AM 2", and the unified "AM". Match by
// prefix for the AM family (AM unified gets everything that starts with AM);
// for AA and AD an exact match is sufficient.
function ejemplarBelongsToTank(pecera: string | null, tankId: string): boolean {
  if (!pecera) return false;
  const p = pecera.trim();
  if (tankId === 'AM') return p.startsWith('AM');
  if (tankId === 'AM 1' || tankId === 'AM 2') return p.startsWith(tankId);
  return p === tankId;
}

export default function TankCard({
  locale,
  tank,
  prev,
  curr,
  history,
  catalogForTank,
  ejemplares,
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

      {(() => {
        const inTank = ejemplares.filter((e) => ejemplarBelongsToTank(e.pecera, tank.id));
        if (inTank.length === 0) return null;
        return (
          <section class="border-t border-[var(--wq-divider)] px-4 py-5 sm:px-6">
            <h3 class="mb-3 font-display text-lg" style={{ color: accent }}>
              {t.specimensTitle}
            </h3>
            <ul class="flex flex-wrap gap-x-4 gap-y-3">
              {inTank.map((e) => {
                const photo = ejemplarPhotoUrl(e.alias);
                const slug = aliasSlug(e.alias);
                return (
                  <li key={e.id ?? e.alias}>
                    <a
                      href={`/xolotlcalli/ajolotes#${slug}`}
                      class="group flex w-[72px] flex-col items-center text-center focus:outline-none"
                      aria-label={e.alias}
                    >
                      <span
                        class="block overflow-hidden rounded-full ring-1 transition group-hover:ring-2 group-focus-visible:ring-2"
                        style={{
                          width: 64,
                          height: 64,
                          borderColor: `${accent}55`,
                          // @ts-ignore — Preact accepts CSS var-style overrides via style
                          '--tw-ring-color': accent,
                        }}
                      >
                        {photo ? (
                          <img
                            src={photo}
                            alt={e.alias}
                            width={64}
                            height={64}
                            loading="lazy"
                            class="h-full w-full object-cover"
                          />
                        ) : (
                          <AjoloteAvatar alias={e.alias} size={64} accent={accent} />
                        )}
                      </span>
                      <span class="mt-1.5 font-body text-[11px] leading-tight text-[var(--wq-ink)] group-hover:underline">
                        {e.alias}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })()}

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
