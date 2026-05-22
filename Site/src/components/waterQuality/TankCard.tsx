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
import type { BitacoraEntry, Ejemplar } from '../ajolotes/types';
import { speciesToWq } from '../ajolotes/types';
import { aliasSlug, ejemplarPhotoUrl } from '../ajolotes/photos';
import AjoloteAvatar from '../ajolotes/AjoloteAvatar';
import { filterBitacoraByTank, buildTankTimeline, type TimelineTone } from '../../lib/timeline';

interface Props {
  locale: Locale;
  tank: Tank;
  prev: Measurement | null;
  curr: Measurement | null;
  history: Measurement[];
  catalogForTank: ParameterCatalogEntry[];
  ejemplares: Ejemplar[];
  bitacora: BitacoraEntry[];
  onBack: () => void;
  window: TimeWindow;
  onWindowChange: (w: TimeWindow) => void;
}

const TONE_COLOR: Record<TimelineTone, string> = {
  ok:    '#10B981',
  warn:  '#FBBF24',
  alarm: '#F43F5E',
  muted: 'rgba(128,128,128,0.55)',
};

// Bundle stores pecera as "AM 1.1", "AM 1.2", "AM 2.1" etc., while tank IDs in
// the water-quality data are "AM 1", "AM 2", and the unified "AM". Match by
// prefix for the AM family (AM unified gets everything that starts with AM);
// for AA and AD an exact match is sufficient.
function SystemTile({
  title,
  value,
  sub,
  accent,
}: {
  title: string;
  value: string | null;
  sub?: string | null;
  accent: string;
}) {
  return (
    <div class="rounded-lg border border-[var(--wq-divider)] bg-[var(--wq-cell-bg)] px-3 py-2.5">
      <p class="m-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
        {title}
      </p>
      <p
        class="m-0 mt-1 text-sm font-medium"
        style={{ color: value ? accent : 'var(--wq-ink-muted)' }}
      >
        {value ?? '—'}
      </p>
      {sub && (
        <p class="m-0 mt-0.5 text-[10px] text-[var(--wq-ink-muted)]">{sub}</p>
      )}
    </div>
  );
}

function ejemplarBelongsToTank(pecera: string | null, tankId: string): boolean {
  if (!pecera) return false;
  const p = pecera.trim();
  if (tankId === 'AM') return p.startsWith('AM');
  if (tankId === 'AM 1' || tankId === 'AM 2') return p.startsWith(tankId);
  return p === tankId;
}

// Route ejemplares with pecera === 'Cuarentena' to their species' station so
// curators see who is currently out of the tank with the rest of the colony.
// Larvae stay grouped under Larvario (so they don't pollute the AM detail).
function ejemplarInCuarentenaForTank(ej: Ejemplar, tankId: string): boolean {
  if ((ej.pecera ?? '').trim() !== 'Cuarentena') return false;
  const code = speciesToWq(ej.especie);
  if (code === 'andersoni' && tankId === 'AA') return true;
  if (code === 'mexicanum' && tankId === 'AM') return true;
  if (code === 'dumerilii' && tankId === 'AD') return true;
  return false;
}

export default function TankCard({
  locale,
  tank,
  prev,
  curr,
  history,
  catalogForTank,
  ejemplares,
  bitacora,
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

      {tank.system && (
        <details class="group border-t border-[var(--wq-divider)] px-4 sm:px-6">
          <summary
            class="flex cursor-pointer list-none items-center justify-between gap-3 py-3 font-display text-sm font-semibold transition-colors hover:text-[var(--wq-ink)]"
            style={{ color: accent }}
          >
            <span class="flex items-center gap-2">
              {t.systemTitle}
              <span class="text-[10px] font-normal uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
                {tank.system.dimensions.lengthCm ? `${tank.system.dimensions.lengthCm}×${tank.system.dimensions.widthCm}×${tank.system.dimensions.heightNominalCm} cm` : ''}
              </span>
            </span>
            <span class="text-[var(--wq-ink-muted)] transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
          </summary>
          <div class="grid gap-3 pb-4 sm:grid-cols-2">
            <SystemTile title={t.systemTankType} value={tank.system.tankType} accent={accent} />
            <SystemTile title={t.systemSubstrate} value={tank.system.substrate} accent={accent} />
            <SystemTile
              title={t.systemFilter}
              value={[tank.system.filter.type, tank.system.filter.description, tank.system.filter.flow].filter(Boolean).join(' · ') || null}
              sub={tank.system.filter.lastMaintenance ? `${t.systemLastMaint}: ${tank.system.filter.lastMaintenance}` : null}
              accent={accent}
            />
            <SystemTile
              title={t.systemCooling}
              value={[tank.system.cooling.type, tank.system.cooling.capacity].filter(Boolean).join(' · ') || null}
              sub={[
                tank.system.cooling.setpoint ? `${t.systemSetpoint}: ${tank.system.cooling.setpoint}` : null,
                tank.system.cooling.lastMaintenance ? `${t.systemLastMaint}: ${tank.system.cooling.lastMaintenance}` : null,
              ].filter(Boolean).join(' · ') || null}
              accent={accent}
            />
            <SystemTile
              title={t.systemAeration}
              value={[tank.system.aeration.type, tank.system.aeration.airflow].filter(Boolean).join(' · ') || null}
              accent={accent}
            />
          </div>
        </details>
      )}

      {(() => {
        const inTank = ejemplares.filter(
          (e) => ejemplarBelongsToTank(e.pecera, tank.id) || ejemplarInCuarentenaForTank(e, tank.id),
        );
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
                const inCuarentena = (e.pecera ?? '').trim() === 'Cuarentena';
                return (
                  <li key={e.id ?? e.alias}>
                    <a
                      href={`/xolotlcalli/ajolotes#${slug}`}
                      class="group flex w-[72px] flex-col items-center text-center focus:outline-none"
                      aria-label={inCuarentena ? `${e.alias} — en cuarentena` : e.alias}
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
                            class={`h-full w-full object-cover ${inCuarentena ? 'opacity-85 saturate-[0.75]' : ''}`}
                          />
                        ) : (
                          <AjoloteAvatar alias={e.alias} size={64} accent={accent} />
                        )}
                      </span>
                      {inCuarentena && (
                        <span class="aj-ribbon aj-state-pulse mt-1 inline-flex w-16 items-center justify-center rounded-md bg-rosa px-1 py-0.5 font-display text-[9px] font-extrabold uppercase tracking-[0.04em] leading-tight text-marfil shadow-[0_2px_6px_rgba(7,31,41,0.35)]">
                          En cuarentena
                        </span>
                      )}
                      <span class="mt-1 font-body text-[11px] leading-tight text-[var(--wq-ink)] group-hover:underline">
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

      {(() => {
        // Eventos del sistema panel shows only system-level entries — incidents,
        // accidents and maintenance. Ejemplar-tagged events (Accidente / Incidencia
        // de Ejemplar) and shift operations (Apertura / Cierre de turno) belong
        // on the per-ejemplar timeline, not on the tank detail.
        const tankBitacora = filterBitacoraByTank(bitacora, tank.id).filter((b) => {
          const cat = (b.categoria ?? '').toLowerCase();
          if (!cat) return !b.alias;
          if (/sistema|mantenimiento/.test(cat)) return true;
          return false;
        });
        const tankEvents = buildTankTimeline({
          tankId: tank.id,
          bitacora: tankBitacora,
        }).reverse().slice(0, 6);
        if (tankEvents.length === 0) return null;
        return (
          <section class="border-t border-[var(--wq-divider)] px-4 py-5 sm:px-6">
            <h3 class="mb-3 font-display text-lg" style={{ color: accent }}>
              {t.bitacoraTankTitle}
            </h3>
            <ol class="m-0 list-none space-y-2 p-0">
              {tankEvents.map((ev) => (
                <li
                  key={ev.id}
                  class="flex items-start gap-3 rounded-lg border border-[var(--wq-divider)] bg-[var(--wq-cell-bg)] p-2.5"
                >
                  <span
                    class="mt-1.5 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: TONE_COLOR[ev.tone] }}
                    aria-hidden="true"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2 text-[11px] text-[var(--wq-ink-muted)] tabular-nums">
                      <span>{ev.date}{ev.time ? ` · ${ev.time}` : ''}</span>
                      {ev.categoria && (
                        <span
                          class="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]"
                          style={{ color: accent, borderColor: `${accent}40`, backgroundColor: `${accent}10` }}
                        >
                          {ev.categoria}
                        </span>
                      )}
                      {ev.alias && (
                        <span class="rounded-full bg-[var(--wq-row-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--wq-ink-muted)]">
                          {ev.alias}
                        </span>
                      )}
                    </div>
                    <p class="m-0 mt-1 text-sm text-[var(--wq-ink)]">{ev.title}</p>
                    {ev.authors.main && (
                      <p class="m-0 mt-0.5 font-mono text-[10px] text-[var(--wq-ink-muted)]">
                        {ev.authors.main.replace('.axolodao.eth', '')}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
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
