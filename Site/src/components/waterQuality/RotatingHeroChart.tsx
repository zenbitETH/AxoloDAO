import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type {
  Locale,
  Measurement,
  ParameterCatalogEntry,
  ParamKey,
  Tank,
} from './types';
import { PARAM_KEYS } from './types';
import { paramLabel, STRINGS } from './strings';
import MultiSeriesChart, { type ChartSeries } from './MultiSeriesChart';

interface Props {
  locale: Locale;
  tanks: Tank[];                 // primary tanks only
  measurements: Measurement[];
  catalog: ParameterCatalogEntry[];
  // Focused parameter (from overview cell click). When present, pauses rotation.
  focusedParam?: ParamKey | null;
  onFocusChange?: (k: ParamKey | null) => void;
}

// Each tank gets a fixed line style. AM 2 is the brighter variant with a
// dashed stroke to distinguish it from AM 1 at a glance.
const SERIES_STYLE: Record<string, { color: string; dashed?: boolean; brighter?: boolean }> = {
  'AA':   { color: '#B87333' },
  'AM 1': { color: '#2C5F7C' },
  'AM 2': { color: '#5AA0C8', dashed: true, brighter: true },
  'AD':   { color: '#3E6B4A' },
};

const ROTATION_MS = 5000;

export default function RotatingHeroChart({
  locale,
  tanks,
  measurements,
  catalog,
  focusedParam,
  onFocusChange,
}: Props) {
  const t = STRINGS[locale];

  // Determine which parameters have usable data (at least 2 points across
  // all primary tanks) so we skip dead charts.
  const activeParams = useMemo<ParamKey[]>(() => {
    const keys = PARAM_KEYS.filter((k) => {
      let count = 0;
      for (const m of measurements) {
        if (!tanks.find((t) => t.id === m.tankId)) continue;
        if (m.values[k] != null) count++;
        if (count >= 2) return true;
      }
      return false;
    });
    return keys.length ? keys : PARAM_KEYS;
  }, [measurements, tanks]);

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // React to an externally selected parameter (row click from the grid).
  useEffect(() => {
    if (!focusedParam) return;
    const i = activeParams.indexOf(focusedParam);
    if (i >= 0) {
      setIdx(i);
      setPaused(true);
    }
  }, [focusedParam, activeParams]);

  // Auto-rotate timer, paused while hovering for accessibility
  useEffect(() => {
    if (paused || hovering || activeParams.length <= 1) return;
    const id = window.setInterval(() => {
      setIdx((prev) => (prev + 1) % activeParams.length);
    }, ROTATION_MS);
    return () => window.clearInterval(id);
  }, [paused, hovering, activeParams.length]);

  const currentKey: ParamKey = activeParams[idx] ?? 'temp';

  // Build chart series for the current parameter
  const series = useMemo<ChartSeries[]>(() => {
    return tanks.map((tk) => {
      const style = SERIES_STYLE[tk.id] ?? { color: tk.accentColor };
      const points = measurements
        .filter((m) => m.tankId === tk.id)
        .map((m) => ({ date: m.date, value: m.values[currentKey] ?? null }))
        .sort((a, b) => a.date.localeCompare(b.date));
      return {
        tankId: tk.id,
        label: tk.id,
        color: style.color,
        dashed: style.dashed,
        brighter: style.brighter,
        points,
      };
    });
  }, [tanks, measurements, currentKey]);

  // Unit + display name from catalog (prefer first catalog entry for this param)
  const catEntry = catalog.find((c) => c.key === currentKey);
  const unit = catEntry?.unit ?? '';

  function go(delta: number) {
    setPaused(true);
    setIdx((prev) => (prev + delta + activeParams.length) % activeParams.length);
    onFocusChange?.(null);
  }
  function togglePause() {
    setPaused((p) => !p);
  }

  return (
    <div
      ref={wrapRef}
      class="wq-hero rounded-2xl bg-[var(--wq-surface-2)] p-4 shadow-sm ring-1 ring-[var(--wq-divider)] sm:p-5"
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
    >
      {/* Parameter picker strip */}
      <div class="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label={t.navPrev}
          class="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-[var(--wq-ink)] transition hover:bg-[var(--wq-ink)]/10"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div class="relative flex-1 min-w-0">
          <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none whitespace-nowrap">
            {activeParams.map((k, i) => {
              const selected = i === idx;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setIdx(i); setPaused(true); onFocusChange?.(null); }}
                  class={`rounded-full px-3 py-1 font-body text-xs transition ${
                    selected
                      ? 'bg-[var(--wq-ink)] text-[var(--wq-surface)] shadow-sm'
                      : 'text-[var(--wq-ink)]/70 hover:text-[var(--wq-ink)]'
                  }`}
                  aria-pressed={selected}
                >
                  {paramLabel(locale, k)}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={togglePause}
          aria-label={paused ? 'Play' : 'Pause'}
          class="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-[var(--wq-ink)] transition hover:bg-[var(--wq-ink)]/10"
        >
          {paused ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={() => go(1)}
          aria-label={t.navNext}
          class="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-[var(--wq-ink)] transition hover:bg-[var(--wq-ink)]/10"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>

      {/* Progress dots */}
      <div class="mb-1 flex items-center justify-center gap-1">
        {activeParams.map((k, i) => (
          <span
            key={k}
            class="block h-1 rounded-full bg-[var(--wq-ink)]/20 transition-all"
            style={{
              width: i === idx ? (paused || hovering ? 20 : 28) : 6,
              backgroundColor: i === idx ? 'var(--wq-ink)' : undefined,
            }}
          />
        ))}
      </div>

      {/* Chart */}
      <div class="wq-fade-in" key={currentKey}>
        <MultiSeriesChart
          locale={locale}
          paramKey={currentKey}
          unit={unit}
          series={series}
          catalog={catalog}
          height={260}
          highlightDate={highlight}
          onHighlight={setHighlight}
          showSafeBand={false}
          showLegend={true}
          showTitle={true}
        />
      </div>
    </div>
  );
}
