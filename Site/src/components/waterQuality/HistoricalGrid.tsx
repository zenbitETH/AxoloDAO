import type {
  Locale,
  Measurement,
  ParameterCatalogEntry,
  ParamKey,
  Tank,
} from './types';
import { PARAM_KEYS } from './types';
import ParameterChart from './ParameterChart';

interface Props {
  locale: Locale;
  tank: Tank;
  measurements: Measurement[]; // already filtered to tank + window
  catalogForTank: ParameterCatalogEntry[];
}

export default function HistoricalGrid({ locale, tank, measurements, catalogForTank }: Props) {
  const catalogByKey = new Map<ParamKey, ParameterCatalogEntry>();
  for (const c of catalogForTank) catalogByKey.set(c.key, c);

  // Only include parameters that have at least one measurement in this window
  // or a catalog entry.
  const visibleKeys = PARAM_KEYS.filter((k) => {
    const hasData = measurements.some((m) => m.values[k] != null);
    return hasData || catalogByKey.has(k);
  });

  return (
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visibleKeys.map((k) => {
        const cat = catalogByKey.get(k);
        return (
          <div
            key={k}
            class="rounded-xl border border-choco/10 bg-cream/80 px-3 py-3"
          >
            <ParameterChart
              locale={locale}
              paramKey={k}
              unit={cat?.unit ?? ''}
              measurements={measurements}
              catalog={cat}
              accentColor={tank.accentColor}
            />
          </div>
        );
      })}
    </div>
  );
}
