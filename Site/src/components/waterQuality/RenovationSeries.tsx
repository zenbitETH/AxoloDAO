import { useEffect, useMemo, useState } from 'preact/hooks';
import MultiSeriesChart, { type ChartSeries } from './MultiSeriesChart';
import type { Locale, ParamKey, ParameterCatalogEntry, RenovationSeriesData } from './types';
import { PARAM_KEYS } from './types';
import { STRINGS, formatNumber, formatShortDate, paramLabel } from './strings';
import { useTheme } from './theme';

interface Props {
  locale: Locale;
  series: RenovationSeriesData;
  // Only used to look up each parameter's unit. Its ranges belong to the tanks from before
  // the closure and are never drawn or compared here.
  catalog: ParameterCatalogEntry[];
}

// One colour per station, by the station's slot (its place in the allowlist), never cycled
// (data-water.mjs refuses a fourth station). Checked with the dataviz palette validator on
// --wq-surface-2 and --wq-cell-bg in each theme, all pairs: lightness band, chroma, CVD and
// the normal-vision floor pass. One contrast warning: dark #AD448B is 2.5:1 on the dark
// cards, which the validator allows only with a table view, and the table below always
// shows every reading; a lighter magenta clears 3:1 but fails CVD against teal. Each colour
// is at least 14 CIEDE2000 from every species accent on the page and at least 11 from the
// alert roses (the chart's and the quarantine pill's), so a system is never read as a species;
// no fourth hue clears these bars.
const STATION_COLORS = {
  light: ['#008F8F', '#6A5AA8', '#A33069'],
  dark: ['#14A09C', '#8E7ED6', '#AD448B'],
} as const;

const PARAM_SHORT: Record<ParamKey, string> = {
  temp: 'Temp', nh3: 'NH₃', no2: 'NO₂', no3: 'NO₃', gh: 'GH',
  kh: 'KH', ph: 'pH', po4: 'PO₄', cond: 'Cond', tds: 'TDS',
};

// The renovation series: readings from the closure on, from their own stations. It shares
// no state, colour, range or axis with the series from before the closure.
export default function RenovationSeries({ locale, series, catalog }: Props) {
  const t = STRINGS[locale];
  const theme = useTheme();
  // The page is rendered on the server in the light palette, and hydration keeps those
  // attributes. Until mounted, render light too, so the first client render matches and
  // the switch to the real theme is a change Preact patches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { stations, readings } = series;

  const activeParams = useMemo<ParamKey[]>(
    () => PARAM_KEYS.filter((k) => readings.some((r) => r.values[k] != null)),
    [readings],
  );
  // A parameter gets a chart only once it has two dates: one day of readings is a table,
  // not a trend. The table keeps every parameter.
  const chartParams = useMemo<ParamKey[]>(
    () => activeParams.filter((k) => new Set(readings.filter((r) => r.values[k] != null).map((r) => r.date)).size >= 2),
    [activeParams, readings],
  );
  const [picked, setPicked] = useState<ParamKey | null>(null);
  const paramKey = picked && chartParams.includes(picked) ? picked : chartParams[0];

  const colorOf = useMemo(() => {
    const palette = STATION_COLORS[mounted ? theme : 'light'];
    return new Map(stations.map((s) => [s.id, palette[s.slot]]));
  }, [stations, theme, mounted]);
  const labelOf = useMemo(() => new Map(stations.map((s) => [s.id, s.label])), [stations]);

  // The chart keys points by date, so a station measured twice in a day shows its latest
  // reading of that day (readings arrive sorted by date and time).
  const chartSeries = useMemo<ChartSeries[]>(() => {
    if (!paramKey) return [];
    return stations.map((s) => {
      const byDate = new Map<string, number | null>();
      for (const r of readings) {
        if (r.stationId === s.id && r.values[paramKey] != null) byDate.set(r.date, r.values[paramKey]);
      }
      return {
        tankId: `renovation:${s.id}`,
        label: s.label,
        color: colorOf.get(s.id) ?? 'var(--wq-ink)',
        points: [...byDate].map(([date, value]) => ({ date, value })),
      };
    });
  }, [stations, readings, paramKey, colorOf]);

  const unit = catalog.find((c) => c.key === paramKey)?.unit ?? '';
  const rows = useMemo(
    () => [...readings].sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? ''))),
    [readings],
  );

  if (readings.length === 0) return null;
  const showChart = paramKey != null;

  const th = 'whitespace-nowrap border-b border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-3 py-2.5 text-[11px] font-semibold text-[var(--wq-ink-muted)]';
  const td = 'whitespace-nowrap border-b border-[var(--wq-divider)] px-3 py-2 tabular-nums text-[var(--wq-ink)]';

  return (
    <section class="mt-10" aria-labelledby="renovation-series-title">
      <header class="mb-3 max-w-3xl">
        <h3 id="renovation-series-title" class="scroll-mt-28 font-display text-xl text-[var(--wq-ink)]">
          {t.renovationTitle}
        </h3>
        <p class="mt-1 font-body text-sm leading-relaxed text-[var(--wq-ink-muted)]">{t.renovationNote}</p>
      </header>

      {paramKey && (
        <div class="rounded-2xl bg-[var(--wq-surface-2)] p-4 shadow-sm ring-1 ring-[var(--wq-divider)] sm:p-5">
          {chartParams.length > 1 && (
            <div class="mb-3 flex gap-1.5 overflow-x-auto whitespace-nowrap" role="group" aria-label={t.indicator}>
              {chartParams.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPicked(k)}
                  aria-pressed={k === paramKey}
                  class={`rounded-full px-3 py-1 font-body text-xs transition ${
                    k === paramKey
                      ? 'bg-[var(--wq-ink)] text-[var(--wq-surface)] shadow-sm'
                      : 'text-[var(--wq-ink)]/70 hover:text-[var(--wq-ink)]'
                  }`}
                >
                  {paramLabel(locale, k)}
                </button>
              ))}
            </div>
          )}
          <MultiSeriesChart
            locale={locale}
            paramKey={paramKey}
            unit={unit}
            series={chartSeries}
            catalog={[]}
            height={240}
            showSafeBand={false}
            showStatus={false}
            showLegend={true}
            showTitle={true}
          />
        </div>
      )}

      <div class={`${showChart ? 'mt-4 ' : ''}overflow-x-auto rounded-2xl ring-1 ring-[var(--wq-divider)]`}>
        <table class="w-full border-collapse font-body text-xs">
          <caption class="sr-only">{`${t.renovationTitle}. ${t.renovationNote}`}</caption>
          <thead>
            <tr>
              <th scope="col" class={`${th} pl-4 text-left`}>{t.logColDate}</th>
              <th scope="col" class={`${th} text-left`}>{t.renovationColStation}</th>
              {activeParams.map((k) => (
                <th key={k} scope="col" class={`${th} text-right`}>{PARAM_SHORT[k]}</th>
              ))}
              <th scope="col" class={`${th} text-left`}>{t.logColAuthor}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.date}-${r.time ?? ''}-${r.stationId}-${i}`}>
                <td class={`${td} pl-4`}>
                  {formatShortDate(locale, r.date)}
                  {r.time && <span class="ml-1.5 text-[var(--wq-ink-muted)]">{r.time}</span>}
                </td>
                <td class={td}>
                  <span class="inline-flex items-center gap-1.5">
                    <span class="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: colorOf.get(r.stationId) }} aria-hidden="true" />
                    {labelOf.get(r.stationId) ?? r.stationId}
                  </span>
                </td>
                {activeParams.map((k) => (
                  <td key={k} class={`${td} text-right`}>
                    {r.values[k] == null ? '—' : formatNumber(r.values[k], k)}
                  </td>
                ))}
                <td class={`${td} text-[var(--wq-ink-muted)]`}>{r.authors.main ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
