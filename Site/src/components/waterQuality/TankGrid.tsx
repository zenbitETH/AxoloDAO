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

interface Props {
  locale: Locale;
  tanks: Tank[];
  measurements: Measurement[];         // current-week rows
  prevMeasurements: Measurement[];      // previous Monday week rows
  catalog: ParameterCatalogEntry[];
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
  onTankSelect,
  onParamFocus,
  activeParam,
}: Props) {
  const catBy = new Map<string, ParameterCatalogEntry>();
  for (const c of catalog) catBy.set(`${c.tankId}|${c.key}`, c);

  const latest = latestByTank(measurements);
  const prevLatest = latestByTank(prevMeasurements);

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
          {/* Header row — tank cards */}
          <div />
          {tanks.map((tk) => (
            <button
              key={tk.id}
              type="button"
              onClick={() => onTankSelect(tk.id)}
              class="wq-on-accent group flex flex-col items-start rounded-xl px-3.5 py-2.5 text-left shadow-sm ring-1 ring-black/10 transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wq-ink)]"
              style={{ backgroundColor: tk.accentColor }}
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
          {visibleKeys.map((k) => (
            <>
              <button
                type="button"
                key={`label-${k}`}
                onClick={() => onParamFocus(k)}
                aria-pressed={activeParam === k}
                class={`flex items-center rounded-xl px-3.5 py-2.5 text-left font-display text-[15px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wq-ink)] ${
                  activeParam === k
                    ? 'bg-[var(--wq-ink)] text-[var(--wq-surface)] shadow-sm'
                    : 'bg-choco/90 text-cream hover:bg-[var(--wq-ink)]'
                }`}
                title="Ver gráfica de este parámetro"
              >
                {paramLabel(locale, k)}
              </button>
              {tanks.map((tk) => {
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
                  <div
                    key={`${tk.id}-${k}`}
                    class={`wq-on-accent relative flex flex-col justify-between rounded-xl px-3.5 py-2.5 text-left shadow-sm ${ringCls}`}
                    style={{ backgroundColor: tk.accentColor }}
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
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
