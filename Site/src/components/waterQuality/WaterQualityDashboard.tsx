import { useEffect, useMemo, useState } from 'preact/hooks';
import type {
  Locale,
  Measurement,
  ParameterCatalogEntry,
  Tank,
  TimeWindow,
} from './types';
import { STRINGS } from './strings';
import CoverHeader from './CoverHeader';
import WeekNav from './WeekNav';
import ViewToggle from './ViewToggle';
import TankGrid from './TankGrid';
import TankCard from './TankCard';

interface Props {
  locale: Locale;
  tanks: Tank[];
  parameters: ParameterCatalogEntry[];
  mondays: Measurement[];        // inlined at build time
  allDataUrl: string;            // lazy-fetched when user toggles all measurements
}

// Week helpers: all weeks keyed by the Monday of that week (ISO date).
function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay(); // 0=Sun, 1=Mon, ...
  const delta = dow === 0 ? -6 : 1 - dow;
  date.setDate(date.getDate() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftWeek(iso: string, weeks: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + weeks * 7);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function WaterQualityDashboard({
  locale,
  tanks,
  parameters,
  mondays,
  allDataUrl,
}: Props) {
  const t = STRINGS[locale];

  const primaryTanks = useMemo(() => tanks.filter((tk) => tk.primary), [tanks]);

  // All unique Monday ISO dates across mondays-only data, ascending.
  const mondayWeeks = useMemo(() => {
    const set = new Set<string>();
    for (const m of mondays) set.add(mondayOf(m.date));
    return [...set].sort();
  }, [mondays]);

  const [view, setView] = useState<'overview' | 'detail'>('overview');
  const [weekIso, setWeekIso] = useState<string>(
    () => mondayWeeks[mondayWeeks.length - 1] ?? mondayOf(new Date().toISOString().slice(0, 10)),
  );
  const [tankId, setTankId] = useState<string | null>(null);
  const [mondaysOnly, setMondaysOnly] = useState(true);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(12);

  const [allData, setAllData] = useState<Measurement[] | null>(null);
  const [allDataLoading, setAllDataLoading] = useState(false);

  useEffect(() => {
    if (mondaysOnly || allData || allDataLoading) return;
    setAllDataLoading(true);
    fetch(allDataUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data: Measurement[]) => setAllData(data))
      .catch((e) => console.warn('[wq] failed to load all measurements', e))
      .finally(() => setAllDataLoading(false));
  }, [mondaysOnly, allData, allDataLoading, allDataUrl]);

  const sourceMeasurements: Measurement[] = useMemo(() => {
    if (mondaysOnly || !allData) return mondays;
    return allData;
  }, [mondaysOnly, mondays, allData]);

  // Overview: all rows dated on the selected week (between weekIso Monday and +6 days).
  const weekMeasurements = useMemo(() => {
    const start = weekIso;
    const end = shiftWeek(weekIso, 1);
    return sourceMeasurements.filter(
      (m) => m.date >= start && m.date < end,
    );
  }, [sourceMeasurements, weekIso]);

  const weekIdx = mondayWeeks.indexOf(weekIso);
  const canPrev = weekIdx > 0;
  const canNext = weekIdx >= 0 && weekIdx < mondayWeeks.length - 1;

  function onPrev() {
    if (canPrev) setWeekIso(mondayWeeks[weekIdx - 1]);
  }
  function onNext() {
    if (canNext) setWeekIso(mondayWeeks[weekIdx + 1]);
  }

  // Keyboard arrow navigation (only when overview visible)
  useEffect(() => {
    if (view !== 'overview') return;
    const handler = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).matches('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, weekIdx, mondayWeeks]);

  const selectedTank = tankId ? tanks.find((tk) => tk.id === tankId) ?? null : null;
  const catalogForSelected = useMemo(
    () => (selectedTank ? parameters.filter((p) => p.tankId === selectedTank.id) : []),
    [parameters, selectedTank],
  );

  // For the detail view, pick current-week measurement + previous-week
  const currForDetail = useMemo(() => {
    if (!selectedTank) return null;
    const inWeek = weekMeasurements.filter((m) => m.tankId === selectedTank.id);
    // take latest in week
    inWeek.sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
    return inWeek[inWeek.length - 1] ?? null;
  }, [weekMeasurements, selectedTank]);

  const prevForDetail = useMemo(() => {
    if (!selectedTank) return null;
    // previous Monday in the available mondays list (from source)
    const priorWeek = mondayWeeks[weekIdx - 1];
    if (!priorWeek) return null;
    const start = priorWeek;
    const end = shiftWeek(priorWeek, 1);
    const inWeek = sourceMeasurements.filter(
      (m) => m.tankId === selectedTank.id && m.date >= start && m.date < end,
    );
    inWeek.sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
    return inWeek[inWeek.length - 1] ?? null;
  }, [sourceMeasurements, selectedTank, mondayWeeks, weekIdx]);

  const historyForDetail = useMemo(() => {
    if (!selectedTank) return [];
    const weeks =
      timeWindow === 'all'
        ? Number.POSITIVE_INFINITY
        : (timeWindow as number);
    const cutoff = shiftWeek(weekIso, -Math.ceil(weeks));
    return sourceMeasurements
      .filter(
        (m) =>
          m.tankId === selectedTank.id &&
          (timeWindow === 'all' || m.date >= cutoff) &&
          m.date <= shiftWeek(weekIso, 1),
      )
      .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
  }, [sourceMeasurements, selectedTank, timeWindow, weekIso]);

  function onTankSelect(id: string) {
    setTankId(id);
    setView('detail');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
  function onBack() {
    setView('overview');
  }

  return (
    <section
      data-theme="light"
      class="relative mx-auto max-w-6xl px-4 py-8 sm:py-10"
      style={{ backgroundColor: '#F6EFE0' }}
    >
      {/* Controls row */}
      <div class="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="w-full sm:w-auto">
          <WeekNav
            locale={locale}
            weekIso={weekIso}
            canPrev={canPrev}
            canNext={canNext}
            onPrev={onPrev}
            onNext={onNext}
          />
        </div>
        <ViewToggle
          locale={locale}
          view={view}
          mondaysOnly={mondaysOnly}
          window={timeWindow}
          showWindow={true}
          onMondaysToggle={setMondaysOnly}
          onWindowChange={setTimeWindow}
        />
      </div>

      {/* Views (crossfade via CSS). We always render both so transitions are smooth. */}
      <div
        class="transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
        style={{
          opacity: view === 'overview' ? 1 : 0,
          transform: view === 'overview' ? 'translateY(0)' : 'translateY(-8px)',
          pointerEvents: view === 'overview' ? 'auto' : 'none',
          position: view === 'overview' ? 'relative' : 'absolute',
          inset: view === 'overview' ? 'auto' : 0,
        }}
        aria-hidden={view !== 'overview'}
      >
        <div class="mb-5">
          <CoverHeader locale={locale} weekIso={weekIso} />
        </div>

        {weekMeasurements.length === 0 ? (
          <p class="rounded-xl bg-cream px-4 py-6 text-center font-body text-sm text-choco/70 shadow-sm ring-1 ring-choco/10">
            {t.emptyWeek}
          </p>
        ) : (
          <TankGrid
            locale={locale}
            tanks={primaryTanks}
            measurements={weekMeasurements}
            catalog={parameters}
            onTankSelect={onTankSelect}
          />
        )}

        {allDataLoading && (
          <p class="mt-3 text-right font-body text-xs text-choco/60">{t.loading}</p>
        )}
      </div>

      <div
        class="transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
        style={{
          opacity: view === 'detail' ? 1 : 0,
          transform: view === 'detail' ? 'translateY(0)' : 'translateY(8px)',
          pointerEvents: view === 'detail' ? 'auto' : 'none',
          position: view === 'detail' ? 'relative' : 'absolute',
          inset: view === 'detail' ? 'auto' : 0,
        }}
        aria-hidden={view !== 'detail'}
      >
        {selectedTank && (
          <TankCard
            locale={locale}
            tank={selectedTank}
            prev={prevForDetail}
            curr={currForDetail}
            history={historyForDetail}
            catalogForTank={catalogForSelected}
            onBack={onBack}
          />
        )}
      </div>
    </section>
  );
}
