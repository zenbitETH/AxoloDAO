import type {
  Locale,
  Measurement,
  ParameterCatalogEntry,
  ParamKey,
  Tank,
} from './types';
import { PARAM_KEYS } from './types';
import { formatNumber, formatUnit, paramLabel, speciesLabel, STRINGS } from './strings';
import { statusOf } from './status';

interface Props {
  locale: Locale;
  tanks: Tank[];               // primary tanks only
  measurements: Measurement[]; // all rows for the selected week (mondays only here)
  catalog: ParameterCatalogEntry[];
  onTankSelect: (tankId: string) => void;
}

export default function TankGrid({ locale, tanks, measurements, catalog, onTankSelect }: Props) {
  const t = STRINGS[locale];

  // Index catalog by tank+key for quick min/max lookup
  const catByTankParam = new Map<string, ParameterCatalogEntry>();
  for (const c of catalog) catByTankParam.set(`${c.tankId}|${c.key}`, c);

  // Most recent measurement for each tank within the current week pool
  const latestByTank = new Map<string, Measurement>();
  for (const m of measurements) {
    const prev = latestByTank.get(m.tankId);
    if (!prev || (m.date + (m.time ?? '')) > (prev.date + (prev.time ?? ''))) {
      latestByTank.set(m.tankId, m);
    }
  }

  // Show only parameters where we have at least one measurement or catalog
  const visibleKeys = PARAM_KEYS.filter((k) =>
    tanks.some((tk) =>
      latestByTank.get(tk.id)?.values[k] != null ||
      catByTankParam.has(`${tk.id}|${k}`),
    ),
  );

  return (
    <div class="overflow-x-auto -mx-4 sm:mx-0">
      <div class="min-w-[640px] px-4 sm:min-w-0 sm:px-0">
        <div
          class="grid gap-2"
          style={{
            gridTemplateColumns: `minmax(150px, 1.3fr) repeat(${tanks.length}, minmax(120px, 1fr))`,
          }}
        >
          {/* Header row */}
          <div />
          {tanks.map((tk) => (
            <button
              key={tk.id}
              type="button"
              onClick={() => onTankSelect(tk.id)}
              class="group flex flex-col items-start rounded-xl px-3 py-2 text-left text-cream shadow-sm ring-1 ring-black/10 transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-choco"
              style={{ backgroundColor: tk.accentColor }}
              aria-label={`${tk.displayName} — ver detalle`}
            >
              <span class="font-display text-sm leading-tight">{tk.displayName}</span>
              {tk.scientificName && (
                <span class="font-body text-[11px] italic text-cream/85">
                  {tk.scientificName}
                </span>
              )}
            </button>
          ))}

          {/* Parameter rows */}
          {visibleKeys.map((k) => (
            <>
              <div
                key={`label-${k}`}
                class="flex items-center rounded-xl bg-choco/90 px-3 py-2 font-display text-sm text-cream"
              >
                {paramLabel(locale, k)}
              </div>
              {tanks.map((tk) => {
                const m = latestByTank.get(tk.id);
                const v = m?.values[k] ?? null;
                const cat = catByTankParam.get(`${tk.id}|${k}`);
                const status = statusOf(v, cat?.min ?? null, cat?.max ?? null);
                const border =
                  status === 'alarm'
                    ? 'ring-2 ring-red-500/50'
                    : status === 'warn'
                    ? 'ring-2 ring-amber-400/60'
                    : 'ring-1 ring-black/10';
                return (
                  <button
                    key={`${tk.id}-${k}`}
                    type="button"
                    onClick={() => onTankSelect(tk.id)}
                    class={`flex flex-col rounded-xl px-3 py-2 text-left text-cream shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-choco ${border}`}
                    style={{ backgroundColor: tk.accentColor }}
                  >
                    <span class="font-body text-base font-semibold tabular-nums">
                      {formatNumber(v, k)}{' '}
                      <span class="text-xs font-normal text-cream/80">
                        {formatUnit(cat?.unit ?? '')}
                      </span>
                    </span>
                  </button>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
