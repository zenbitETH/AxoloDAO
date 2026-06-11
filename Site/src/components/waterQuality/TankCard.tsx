import { useEffect } from 'preact/hooks';
import type {
  Locale,
  Measurement,
  ParameterCatalogEntry,
  Tank,
  TimeWindow,
} from './types';
import { speciesLabel, STRINGS } from './strings';
import { AM_AQUARIUMS } from './amAquariums';
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
  // When the AM detail is opened from a QR/hash deep-link (#AM1 … #AM-larvas),
  // the targeted aquarium anchor so its tile scrolls into view and pulses.
  focusedAquarium?: string | null;
}

const TONE_COLOR: Record<TimelineTone, string> = {
  ok:    '#10B981',
  warn:  '#FBBF24',
  alarm: '#F43F5E',
  muted: 'rgba(128,128,128,0.55)',
};

// Bundle stores pecera as "AM1".."AM4" / "AM Larvas", while tank IDs in the
// water-quality data are "AM 1", "AM 2", and the unified "AM". Match by prefix
// for the AM family (AM unified gets everything that starts with AM); for AA and
// AD an exact match is sufficient.
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

// Visible deep-link chip for a station / aquarium. Clicking sets the URL hash
// (e.g. #AM1) — the dashboard's hashchange listener opens + focuses it, and the
// address bar then carries the shareable /xolotlcalli#AM1 link the QR encodes.
function AnchorChip({ anchor, title }: { anchor: string; title: string }) {
  return (
    <a
      href={`#${anchor}`}
      title={title}
      class="inline-flex items-center gap-1 rounded-md border border-[var(--wq-divider)] bg-[var(--wq-cell-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--wq-ink-muted)] no-underline transition hover:text-[var(--wq-ink)]"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      #{anchor}
    </a>
  );
}

// Shared "en cuarentena" badge — rendered by both the flat specimen list and the
// AM per-aquarium tiles so the wording, color and a11y stay in one place. `size`
// only changes the footprint (flat list = sm, denser AM tile = xs).
function CuarentenaRibbon({ size = 'sm' }: { size?: 'sm' | 'xs' }) {
  const footprint = size === 'xs' ? 'w-full text-[8px]' : 'w-16 text-[9px]';
  return (
    <span class={`aj-ribbon aj-state-pulse mt-1 inline-flex items-center justify-center rounded-md bg-rosa px-1 py-0.5 font-display font-extrabold uppercase tracking-[0.04em] leading-tight text-marfil shadow-[0_2px_6px_rgba(7,31,41,0.35)] ${footprint}`}>
      En cuarentena
    </span>
  );
}

function ejemplarBelongsToTank(pecera: string | null, tankId: string): boolean {
  if (!pecera) return false;
  const p = pecera.trim();
  // The unified AM card collects every AM aquarium (AM1–AM4, AM Larvas).
  if (tankId === 'AM') return p.startsWith('AM');
  // Historical AM 1 / AM 2 cards: match space-insensitively so canonical
  // "AM1"/"AM2" peceras still resolve to the pre-unification columns.
  if (tankId === 'AM 1' || tankId === 'AM 2') {
    return p.replace(/\s+/g, '').startsWith(tankId.replace(/\s+/g, ''));
  }
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
  focusedAquarium,
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

  // Scroll the targeted AM aquarium tile into view when the detail was opened
  // from a QR/hash deep-link (#AM1 … #AM-larvas).
  useEffect(() => {
    if (!focusedAquarium || typeof document === 'undefined') return;
    const el = document.getElementById(focusedAquarium);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusedAquarium]);

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
          {['AA', 'AD', 'AM'].includes(tank.id) && (
            <div class="mt-1.5">
              <AnchorChip anchor={tank.id} title={t.anchorLink} />
            </div>
          )}
          {note && (
            <p
              class="mt-2 inline-flex rounded-md px-2 py-0.5 font-body text-[11px]"
              style={{ color: accent, backgroundColor: `${accent}1F` }}
            >
              {note}
            </p>
          )}
        </div>
        <div class="flex flex-shrink-0 items-center gap-2">
          <a
            href="https://xovi-testnet.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-full border border-[var(--wq-divider)] bg-[var(--wq-surface)] px-3 py-1.5 font-body text-xs font-semibold text-[var(--wq-ink)] transition hover:bg-[var(--wq-ink)]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wq-ink)]"
            aria-label={t.xoviClip}
            title={t.xoviClip}
          >
            <img src="/logos/xovi.svg" alt="" width={16} height={16} class="h-4 w-4" />
            {t.xoviClip}
          </a>
          <button
            type="button"
            onClick={onBack}
            class="rounded-full border border-[var(--wq-divider)] bg-[var(--wq-surface)] px-3 py-1.5 font-body text-xs text-[var(--wq-ink)] transition hover:bg-[var(--wq-ink)]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wq-ink)]"
          >
            ← {t.back}
          </button>
        </div>
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
        // AM renders per-aquarium tiles (the section below) instead of a flat
        // list, so each aquarium keeps its own anchor + axolotl distribution.
        if (tank.id === 'AM') return null;
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
                      {inCuarentena && <CuarentenaRibbon size="sm" />}
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

      {tank.id === 'AM' && (
        <section class="border-t border-[var(--wq-divider)] px-4 py-5 sm:px-6">
          <h3 class="mb-3 font-display text-lg" style={{ color: accent }}>
            {t.aquariumsTitle}
          </h3>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AM_AQUARIUMS.map((aq) => {
              // Membership is an exact pecera match. AM animals temporarily in
              // cuarentena keep their home aquarium (set via AM_PECERA, flagged
              // enCuarentena) so they still appear here; a mexicanum left at raw
              // "Cuarentena" and NOT in AM_PECERA would not surface on any tile.
              const members = ejemplares.filter(
                (e) => (e.pecera ?? '').trim() === aq.id,
              );
              const focused = focusedAquarium === aq.anchor;
              return (
                <div
                  key={aq.id}
                  id={aq.anchor}
                  class={`scroll-mt-24 rounded-xl border bg-[var(--wq-cell-bg)] p-3 transition ${focused ? 'aj-state-pulse ring-2' : ''}`}
                  style={{
                    borderColor: focused ? accent : 'var(--wq-divider)',
                    // @ts-ignore — Preact accepts CSS var-style overrides via style
                    '--tw-ring-color': accent,
                  }}
                >
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <span class="font-display text-sm font-semibold" style={{ color: accent }}>
                      {aq.label}
                    </span>
                    <div class="flex items-center gap-1.5">
                      {aq.volumeL != null && (
                        <span class="text-[10px] text-[var(--wq-ink-muted)]">{aq.volumeL} L</span>
                      )}
                      <AnchorChip anchor={aq.anchor} title={t.anchorLink} />
                    </div>
                  </div>
                  {members.length === 0 ? (
                    <p class="m-0 text-[11px] text-[var(--wq-ink-muted)]">—</p>
                  ) : (
                    <ul class="m-0 flex list-none flex-wrap gap-x-3 gap-y-2 p-0">
                      {members.map((e) => {
                        const photo = ejemplarPhotoUrl(e.alias);
                        const slug = aliasSlug(e.alias);
                        const inCuarentena = !!e.enCuarentena;
                        return (
                          <li key={e.id ?? e.alias}>
                            <a
                              href={`/xolotlcalli/ajolotes#${slug}`}
                              class="group flex w-[64px] flex-col items-center text-center focus:outline-none"
                              aria-label={inCuarentena ? `${e.alias} — en cuarentena` : e.alias}
                            >
                              <span
                                class="block overflow-hidden rounded-full ring-1 transition group-hover:ring-2 group-focus-visible:ring-2"
                                style={{
                                  width: 52,
                                  height: 52,
                                  borderColor: `${accent}55`,
                                  // @ts-ignore — Preact accepts CSS var-style overrides via style
                                  '--tw-ring-color': accent,
                                }}
                              >
                                {photo ? (
                                  <img
                                    src={photo}
                                    alt={e.alias}
                                    width={52}
                                    height={52}
                                    loading="lazy"
                                    class={`h-full w-full object-cover ${inCuarentena ? 'opacity-85 saturate-[0.75]' : ''}`}
                                  />
                                ) : (
                                  <AjoloteAvatar alias={e.alias} size={52} accent={accent} />
                                )}
                              </span>
                              {inCuarentena && <CuarentenaRibbon size="xs" />}
                              <span class="mt-1 font-body text-[10px] leading-tight text-[var(--wq-ink)] group-hover:underline">
                                {e.alias}
                              </span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

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
            bitacora={bitacora}
          />
        )}
      </section>
    </article>
  );
}
