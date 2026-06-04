import { useEffect, useMemo, useState } from 'preact/hooks';
import type {
  Locale,
  Measurement,
  ParameterCatalogEntry,
  ParamKey,
  Tank,
  TimeWindow,
} from './types';
import { PARAM_KEYS } from './types';
import { STRINGS } from './strings';
import { statusOf } from './status';
import CoverHeader from './CoverHeader';
import ViewToggle from './ViewToggle';
import TankGrid from './TankGrid';
import TankCard from './TankCard';
import RotatingHeroChart from './RotatingHeroChart';
import { AM_AQUARIUM_BY_ANCHOR } from './amAquariums';
import type { BitacoraEntry, Ejemplar } from '../ajolotes/types';
import { useBackToClose } from '../useBackToClose';

interface Props {
  locale: Locale;
  tanks: Tank[];
  parameters: ParameterCatalogEntry[];
  mondays: Measurement[];
  ejemplares: Ejemplar[];
  bitacora: BitacoraEntry[];
  allDataUrl: string;
}

// AM 1 + AM 2 were physically unified into a single 360 L recirculating system
// on 2026-04-28. Pre-cutoff weeks render two AM columns; from this date the
// dashboard collapses to a single "AM" column. The chart still receives the
// full primary-tank list so a window straddling the cutoff shows AM 1 + AM 2
// lines ending and the AM line beginning.
const AM_UNIFICATION = '2026-04-28';

function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
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
  ejemplares,
  bitacora,
  allDataUrl,
}: Props) {
  const t = STRINGS[locale];
  const primaryTanks = useMemo(() => tanks.filter((tk) => tk.primary), [tanks]);

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
  const [focusedParam, setFocusedParam] = useState<ParamKey | null>(null);
  const [focusedAquarium, setFocusedAquarium] = useState<string | null>(null);

  const [allData, setAllData] = useState<Measurement[] | null>(null);
  const [allDataLoading, setAllDataLoading] = useState(false);

  // Date-aware tank visibility for the dashboard grid: pre-cutoff weeks show
  // AM 1 + AM 2 separately; post-cutoff weeks collapse to AM. The chart still
  // receives the full primary-tank list so a window straddling the cutoff
  // renders all three series.
  const visibleTanksForWeek = useMemo(() => {
    const post = weekIso >= AM_UNIFICATION;
    return primaryTanks.filter((tk) =>
      post ? tk.id !== 'AM 1' && tk.id !== 'AM 2' : tk.id !== 'AM',
    );
  }, [primaryTanks, weekIso]);

  // Deep-link entry from the ajolotes detail view: `?tank=AA&param=ph` jumps
  // straight to that station and parameter on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tankParam = params.get('tank');
    const paramParam = params.get('param') as ParamKey | null;
    if (tankParam && tanks.some((t) => t.id === tankParam)) {
      setTankId(tankParam);
      setView('detail');
      if (paramParam && PARAM_KEYS.includes(paramParam)) {
        setFocusedParam(paramParam);
      }
    }
    // Once consumed, clean the URL so a refresh doesn't re-trigger.
    if (tankParam || paramParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete('tank');
      url.searchParams.delete('param');
      window.history.replaceState({}, '', url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // QR / hash deep-link entry: `#AA`, `#AD`, `#AM` open that tank; `#AM1`…`#AM5`
  // and `#AM-larvas` open the AM detail focused on that aquarium tile. Mirrors
  // the ajolotes explorer hash pattern so printed QR codes resolve on load.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const openFromHash = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (!hash) return;
      const aquarium = AM_AQUARIUM_BY_ANCHOR[hash];
      if (aquarium) {
        setTankId('AM');
        setFocusedAquarium(aquarium.anchor);
        setView('detail');
        return;
      }
      if (tanks.some((t) => t.id === hash)) {
        setTankId(hash);
        setFocusedAquarium(null);
        setView('detail');
      }
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const weekMeasurements = useMemo(() => {
    const start = weekIso;
    const end = shiftWeek(weekIso, 1);
    return sourceMeasurements.filter((m) => m.date >= start && m.date < end);
  }, [sourceMeasurements, weekIso]);

  const prevWeekIso = useMemo(() => shiftWeek(weekIso, -1), [weekIso]);
  const prevWeekMeasurements = useMemo(() => {
    const start = prevWeekIso;
    const end = shiftWeek(prevWeekIso, 1);
    return sourceMeasurements.filter((m) => m.date >= start && m.date < end);
  }, [sourceMeasurements, prevWeekIso]);

  const weekIdx = mondayWeeks.indexOf(weekIso);
  const canPrev = weekIdx > 0;
  const canNext = weekIdx >= 0 && weekIdx < mondayWeeks.length - 1;

  function onPrev() { if (canPrev) setWeekIso(mondayWeeks[weekIdx - 1]); }
  function onNext() { if (canNext) setWeekIso(mondayWeeks[weekIdx + 1]); }

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

  // Weekly status summary (all primary tanks × all params for this week)
  const weekSummary = useMemo(() => {
    let ok = 0, warn = 0, alarm = 0;
    const latestByTank = new Map<string, Measurement>();
    for (const m of weekMeasurements) {
      const prev = latestByTank.get(m.tankId);
      if (!prev || (m.date + (m.time ?? '')) > (prev.date + (prev.time ?? ''))) {
        latestByTank.set(m.tankId, m);
      }
    }
    for (const tk of primaryTanks) {
      const m = latestByTank.get(tk.id);
      if (!m) continue;
      for (const k of PARAM_KEYS) {
        const cat = parameters.find((p) => p.tankId === tk.id && p.key === k);
        if (!cat) continue;
        const v = m.values[k];
        if (v == null) continue;
        const s = statusOf(v, cat.min, cat.max);
        if (s === 'ok') ok++;
        else if (s === 'warn') warn++;
        else alarm++;
      }
    }
    return { ok, warn, alarm };
  }, [weekMeasurements, parameters, primaryTanks]);

  // Latest measurement in the selected week (for author metadata)
  const latestOfWeek = useMemo<Measurement | null>(() => {
    if (weekMeasurements.length === 0) return null;
    return [...weekMeasurements].sort((a, b) =>
      (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')),
    )[0];
  }, [weekMeasurements]);

  const selectedTank = tankId ? tanks.find((tk) => tk.id === tankId) ?? null : null;
  const catalogForSelected = useMemo(
    () => (selectedTank ? parameters.filter((p) => p.tankId === selectedTank.id) : []),
    [parameters, selectedTank],
  );

  const currForDetail = useMemo(() => {
    if (!selectedTank) return null;
    const inWeek = weekMeasurements.filter((m) => m.tankId === selectedTank.id);
    inWeek.sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
    return inWeek[inWeek.length - 1] ?? null;
  }, [weekMeasurements, selectedTank]);

  const prevForDetail = useMemo(() => {
    if (!selectedTank) return null;
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
    const weeks = timeWindow === 'all' ? Number.POSITIVE_INFINITY : (timeWindow as number);
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
    setFocusedAquarium(null);
    setView('detail');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function onBack() {
    setView('overview');
  }

  useBackToClose(view === 'detail', onBack, 'axolodao:wq-detail');

  return (
    <section class="relative mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {/* Overview */}
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
        <div class="mb-6">
          <CoverHeader
            locale={locale}
            weekIso={weekIso}
            canPrev={canPrev}
            canNext={canNext}
            onPrev={onPrev}
            onNext={onNext}
            latest={latestOfWeek}
            summary={weekSummary}
          />
        </div>

        {/* Tank grid */}
        {weekMeasurements.length === 0 ? (
          <p class="rounded-xl bg-[var(--wq-cell-bg)] px-4 py-6 text-center font-body text-sm text-[var(--wq-ink-muted)] shadow-sm ring-1 ring-[var(--wq-divider)]">
            {t.emptyWeek}
          </p>
        ) : (
          <TankGrid
            locale={locale}
            tanks={visibleTanksForWeek}
            measurements={weekMeasurements}
            prevMeasurements={prevWeekMeasurements}
            catalog={parameters}
            ejemplares={ejemplares}
            onTankSelect={onTankSelect}
            onParamFocus={(k) => setFocusedParam(k)}
            activeParam={focusedParam}
          />
        )}

        {/* Trend chart + view toggle, below the table */}
        <div class="mt-6 flex justify-end sm:mt-8">
          <ViewToggle
            locale={locale}
            mondaysOnly={mondaysOnly}
            onMondaysToggle={setMondaysOnly}
          />
        </div>
        <div class="mt-3">
          <RotatingHeroChart
            locale={locale}
            tanks={primaryTanks}
            measurements={sourceMeasurements}
            catalog={parameters}
            bitacora={bitacora}
            focusedParam={focusedParam}
            onFocusChange={setFocusedParam}
          />
        </div>

        {allDataLoading && (
          <p class="mt-3 text-right font-body text-xs text-[var(--wq-ink-muted)]">{t.loading}</p>
        )}
      </div>

      {/* Detail */}
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
            ejemplares={ejemplares}
            bitacora={bitacora}
            onBack={onBack}
            window={timeWindow}
            onWindowChange={setTimeWindow}
            focusedAquarium={focusedAquarium}
          />
        )}
      </div>
    </section>
  );
}
