import type {
  Locale,
  Measurement,
  ParameterCatalogEntry,
  ParamKey,
  Tank,
} from './types';
import { PARAM_KEYS } from './types';
import { formatNumber, formatUnit, paramLabel } from './strings';
import { statusOf, trendOf } from './status';
import { StatusBadge } from './StatusBadge';
import type { Ejemplar } from '../ajolotes/types';
import { residentsInCuarentena } from './cuarentena';
import EjemplarPhoto from '../ajolotes/EjemplarPhoto';

interface Props {
  locale: Locale;
  tanks: Tank[];
  measurements: Measurement[];         // current-week rows
  prevMeasurements: Measurement[];      // previous Monday week rows
  catalog: ParameterCatalogEntry[];
  ejemplares: Ejemplar[];
  onTankSelect: (tankId: string) => void;
  onParamFocus: (k: ParamKey) => void;
  activeParam?: ParamKey | null;
}

// Pick the latest row per tank from a slice (handles multiple daily rows)
function latestByTank(rows: Measurement[]): Map<string, Measurement> {
  const out = new Map<string, Measurement>();
  for (const m of rows) {
    const prev = out.get(m.tankId);
    if (!prev || (m.date + (m.time ?? '')) > (prev.date + (prev.time ?? ''))) {
      out.set(m.tankId, m);
    }
  }
  return out;
}

export default function TankGrid({
  locale,
  tanks,
  measurements,
  prevMeasurements,
  catalog,
  ejemplares,
  onTankSelect,
  onParamFocus,
  activeParam,
}: Props) {
  const catBy = new Map<string, ParameterCatalogEntry>();
  for (const c of catalog) catBy.set(`${c.tankId}|${c.key}`, c);

  const latest = latestByTank(measurements);
  const prevLatest = latestByTank(prevMeasurements);

  // When a tank's resident is in cuarentena and the tank has no measurement
  // this week, we cover the entire column with a single card instead of
  // showing N empty cells. Build a tankId → resident map once.
  const cuarentenaByTank = new Map<string, { alias: string }>();
  for (const r of residentsInCuarentena(ejemplares)) {
    if (!latest.get(r.homeTankId)) {
      cuarentenaByTank.set(r.homeTankId, { alias: r.alias });
    }
  }

  // Only show parameter rows that actually have data in the current or previous
  // week — a catalog entry alone (e.g. TDS, which the team hasn't started
  // logging) would render an empty row.
  const visibleKeys = PARAM_KEYS.filter((k) =>
    tanks.some(
      (tk) =>
        latest.get(tk.id)?.values[k] != null ||
        prevLatest.get(tk.id)?.values[k] != null,
    ),
  );

  return (
    <div class="-mx-4 overflow-x-auto sm:mx-0 sm:overflow-visible">
      <div class="min-w-[760px] px-4 py-1 sm:min-w-0 sm:px-1">
        <div
          class="grid gap-2.5"
          style={{
            gridTemplateColumns: `minmax(150px, 1.1fr) repeat(${tanks.length}, minmax(168px, 1fr))`,
          }}
        >
          {/* Header row — tank cards. All cells use explicit grid placement so
              the cuarentena overlay below (which also uses explicit placement
              spanning rows 1/-1 in its column) cannot bump tanks out of their
              intended columns via auto-flow displacement. */}
          {tanks.map((tk, tIdx) => (
            <button
              key={tk.id}
              type="button"
              onClick={() => onTankSelect(tk.id)}
              class="wq-on-accent group flex flex-col items-start rounded-xl px-3.5 py-2.5 text-left shadow-sm ring-1 ring-black/10 transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wq-ink)]"
              style={{
                backgroundColor: tk.accentColor,
                gridColumnStart: String(tIdx + 2),
                gridRowStart: '1',
              }}
              aria-label={`${tk.displayName} — ver detalle`}
            >
              <span class="font-display text-base leading-tight">{tk.displayName}</span>
              {tk.scientificName && (
                <span class="font-body text-xs italic opacity-90">
                  {tk.scientificName}
                </span>
              )}
            </button>
          ))}

          {/* Parameter rows */}
          {visibleKeys.map((k, kIdx) => (
            <>
              <button
                type="button"
                key={`label-${k}`}
                onClick={() => onParamFocus(k)}
                aria-pressed={activeParam === k}
                class={`flex items-center rounded-xl px-3.5 py-2.5 text-left font-display text-[15px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wq-ink)] ${
                  activeParam === k
                    ? 'bg-[var(--wq-ink)] text-[var(--wq-surface)] shadow-sm'
                    : 'bg-choco/90 text-cream hover:bg-choco dark:hover:bg-choco'
                }`}
                style={{ gridColumnStart: '1', gridRowStart: String(kIdx + 2) }}
                title="Ver gráfica de este parámetro"
              >
                {paramLabel(locale, k)}
              </button>
              {tanks.map((tk, tIdx) => {
                const m = latest.get(tk.id);
                const pm = prevLatest.get(tk.id);
                const v = m?.values[k] ?? null;
                const prev = pm?.values[k] ?? null;
                const cat = catBy.get(`${tk.id}|${k}`);
                const status = statusOf(v, cat?.min ?? null, cat?.max ?? null);
                const trend = trendOf(prev, v);
                const unit = formatUnit(cat?.unit ?? '');
                const ringCls =
                  status === 'alarm'
                    ? 'ring-2 ring-rose-400/90 shadow-[0_0_0_3px_rgba(244,63,94,0.18)]'
                    : status === 'warn'
                    ? 'ring-2 ring-amber-300/80'
                    : 'ring-1 ring-black/10';
                return (
                  <button
                    type="button"
                    key={`${tk.id}-${k}`}
                    onClick={() => onTankSelect(tk.id)}
                    aria-label={`${tk.displayName} · ${paramLabel(locale, k)} — ver detalle`}
                    class={`wq-on-accent group relative flex flex-col justify-between rounded-xl px-3.5 py-2.5 text-left shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wq-ink)] ${ringCls}`}
                    style={{
                      backgroundColor: tk.accentColor,
                      gridColumnStart: String(tIdx + 2),
                      gridRowStart: String(kIdx + 2),
                    }}
                  >
                    <div class="flex items-start justify-between gap-2">
                      <span class="font-body text-xl font-semibold tabular-nums leading-tight">
                        {formatNumber(v, k)}
                        {unit && (
                          <span class="ml-1 text-[11px] font-normal opacity-80">{unit}</span>
                        )}
                      </span>
                      <StatusBadge trend={trend} status={status} size="xs" variant="on-accent" />
                    </div>
                    <div class="mt-1.5 font-body text-[11px] leading-tight tabular-nums opacity-80">
                      {cat?.min != null || cat?.max != null ? (
                        <>
                          <span>min {cat.min != null ? formatNumber(cat.min, k) : '—'}</span>
                          <span class="mx-1 opacity-60">·</span>
                          <span>max {cat.max != null ? formatNumber(cat.max, k) : '—'}</span>
                        </>
                      ) : (
                        <span class="opacity-60">sin rango</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </>
          ))}

          {/* Cuarentena cover cards — translucent + backdrop-blurred wash
              over the affected column. The underlying tank header and
              parameter cells render normally so the dashboard's column
              rhythm is preserved; the wash signals "this column is on hold"
              without removing it from the grid. Row span is explicit
              (header row + every parameter row) because `grid-row: 1 / -1`
              collapses to a single row when grid-template-rows is implicit. */}
          {tanks.map((tk, idx) => {
            const resident = cuarentenaByTank.get(tk.id);
            if (!resident) return null;
            const totalRows = visibleKeys.length + 1;
            return (
              <div
                key={`cuarentena-${tk.id}`}
                class="pointer-events-none rounded-2xl flex flex-col items-center justify-center gap-3 text-center font-display text-marfil shadow-[0_8px_24px_rgba(7,31,41,0.45),inset_0_-2px_0_rgba(0,0,0,0.18)]"
                style={{
                  gridColumnStart: String(idx + 2),
                  gridRowStart: '1',
                  gridRowEnd: `span ${totalRows}`,
                  alignSelf: 'stretch',
                  backgroundColor: 'rgba(232, 93, 117, 0.78)',
                  backdropFilter: 'blur(6px)',
                  WebkitBackdropFilter: 'blur(6px)',
                }}
              >
                <EjemplarPhoto alias={resident.alias} accent="#E85D75" size={64} />
                <span class="text-sm font-extrabold uppercase tracking-[0.12em] leading-tight px-3">
                  {resident.alias} en cuarentena
                </span>
                <span class="font-body text-[11px] opacity-90 leading-snug px-3">
                  Sin medición esta semana
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
