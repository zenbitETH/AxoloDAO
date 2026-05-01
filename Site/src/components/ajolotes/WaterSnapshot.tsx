// Latest water-quality snapshot for the ejemplar's tank. For each parameter
// we read the most recent Monday measurement; if that reading is null we walk
// back to the nearest preceding measurement that has a value, and tag the
// cell as "stale" so curators can tell at a glance which numbers are current.
//
// Each parameter cell links to the Xolotlcalli water dashboard with a
// `?tank=…&param=…` deep-link so curators can pivot from a specimen straight
// to that station's full history.

import { useMemo } from 'preact/hooks';
import type { Locale } from './types';
import { s } from './strings';
import InfoIcon from './InfoIcon';
import type { Measurement, ParamKey } from '../waterQuality/types';
import { stationOf } from './theme';

interface Props {
  pecera: string | null;
  measurements: Measurement[];
  accent: string;
  locale: Locale;
  // Locale-aware base URL for the xolotlcalli dashboard so the deep-link
  // keeps its `/`, `/en/`, or `/pt/` prefix.
  waterPath: string;
}

interface Slot {
  key: ParamKey;
  value: number | null;
  date: string | null;
  stale: boolean;
}

const TRACKED: ParamKey[] = ['temp', 'ph', 'no2', 'no3', 'gh', 'kh'];
const DEC: Partial<Record<ParamKey, number>> = { temp: 1, ph: 1 };
const UNIT: Partial<Record<ParamKey, string>> = {
  temp: '°C',
  ph: '',
  no2: 'mg/L',
  no3: 'mg/L',
  gh: 'mg/L',
  kh: 'mg/L',
};

// Map ejemplar.pecera → water-quality tankId.
// "AA"/"AD" map directly. "AM 1.x" / "AM 2.x" collapse to "AM 1" / "AM 2".
function tankIdFor(pecera: string | null): string | null {
  if (!pecera || pecera === 'NA') return null;
  const trimmed = pecera.trim();
  if (trimmed === 'AA' || trimmed === 'AD') return trimmed;
  const m = trimmed.match(/^(AM\s+\d+)/);
  if (m) return m[1];
  const station = stationOf(trimmed);
  if (station === 'AA' || station === 'AD') return station;
  return null;
}

function fmtValue(v: number | null, key: ParamKey): string {
  if (v == null || Number.isNaN(v)) return '—';
  const d = DEC[key] ?? 2;
  return v.toFixed(d);
}

export default function WaterSnapshot({ pecera, measurements, accent, locale, waterPath }: Props) {
  const tankId = tankIdFor(pecera);

  const { slots, latestDate } = useMemo(() => {
    if (!tankId) return { slots: [] as Slot[], latestDate: null as string | null };
    const tank = measurements
      .filter((m) => m.tankId === tankId)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!tank.length) return { slots: [] as Slot[], latestDate: null as string | null };
    const latest = tank[tank.length - 1];
    const out: Slot[] = TRACKED.map((key) => {
      const fresh = latest.values?.[key];
      if (fresh != null) {
        return { key, value: fresh, date: latest.date, stale: false };
      }
      for (let i = tank.length - 2; i >= 0; i--) {
        const v = tank[i].values?.[key];
        if (v != null) return { key, value: v, date: tank[i].date, stale: true };
      }
      return { key, value: null, date: null, stale: false };
    });
    return { slots: out, latestDate: latest.date };
  }, [tankId, measurements]);

  if (!slots.length) return null;

  const linkFor = (param: ParamKey) =>
    `${waterPath}?tank=${encodeURIComponent(tankId!)}&param=${param}`;

  return (
    <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4">
      <header class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 class="m-0 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
          {s(locale, 'resumen.water.title')}
        </h3>
        {latestDate && (
          <span class="text-xs text-[var(--wq-ink-muted)]">
            {s(locale, 'resumen.water.latest')} {latestDate}
          </span>
        )}
      </header>
      <div class="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
        {slots.map((slot) => {
          const label = s(locale, `water.${slot.key}`);
          const tooltip = s(locale, `water.${slot.key}.tooltip`);
          const showStale = slot.stale && slot.date;
          const titleAttr = showStale
            ? `${s(locale, 'resumen.water.staleTooltip')} ${slot.date} · ${s(locale, 'resumen.water.openStation')}`
            : s(locale, 'resumen.water.openStation');
          return (
            <a
              key={slot.key}
              href={linkFor(slot.key)}
              title={titleAttr}
              class={`aj-water-cell group flex min-w-0 flex-col gap-0.5 rounded-xl p-2.5 no-underline outline-none transition-[background-color,border-color,transform,box-shadow] focus-visible:ring-2 focus-visible:ring-teal/60 ${
                slot.stale
                  ? 'border border-dashed border-[var(--wq-divider)] bg-transparent opacity-65 hover:opacity-100'
                  : 'bg-[var(--wq-cell-bg)]'
              }`}
              style={{
                ['--accent' as string]: accent,
              }}
            >
              <span class="inline-flex items-center justify-between gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
                <span class="inline-flex items-center">
                  {label}
                  <InfoIcon text={tooltip} />
                </span>
                <svg
                  class="aj-water-arrow opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70"
                  width="11"
                  height="11"
                  viewBox="0 0 12 12"
                  aria-hidden="true"
                >
                  <path
                    d="M3.5 8.5 L8 4 M4.5 4 H8 V7.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span
                class={`font-display text-[1.05rem] font-bold leading-tight tabular-nums ${
                  slot.stale ? 'text-[var(--wq-ink-muted)]' : ''
                }`}
                style={!slot.stale ? { color: accent } : undefined}
              >
                {fmtValue(slot.value, slot.key)}
                {UNIT[slot.key] && (
                  <small class="ml-0.5 text-[10px] font-normal opacity-65">{UNIT[slot.key]}</small>
                )}
              </span>
              {showStale && (
                <span class="text-[9px] uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
                  {s(locale, 'resumen.water.stale')} {slot.date}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </section>
  );
}
