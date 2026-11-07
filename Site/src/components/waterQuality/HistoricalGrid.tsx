import { useState } from 'preact/hooks';
import type {
  Locale,
  Measurement,
  ParameterCatalogEntry,
  ParamKey,
  Tank,
} from './types';
import { PARAM_KEYS } from './types';
import MultiSeriesChart from './MultiSeriesChart';

interface Props {
  locale: Locale;
  tank: Tank;
  measurements: Measurement[];
  catalogForTank: ParameterCatalogEntry[];
  // Themed accent (resolved by parent TankCard using useTheme()).
  accent: string;
}

export default function HistoricalGrid({ locale, tank, measurements, catalogForTank, accent }: Props) {
  const catBy = new Map<ParamKey, ParameterCatalogEntry>();
  for (const c of catalogForTank) catBy.set(c.key, c);

  // Sync hover across all charts in this grid
  const [highlight, setHighlight] = useState<string | null>(null);

  // Require at least one measurement for the parameter; parameters with no
  // historical data (e.g. TDS, when the team hasn't started logging it) would
  // produce an empty chart and are dropped.
  const visibleKeys = PARAM_KEYS.filter((k) =>
    measurements.some((m) => m.values[k] != null),
  );

  return (
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visibleKeys.map((k) => {
        const cat = catBy.get(k);
        const points = measurements
          .map((m) => ({ date: m.date, value: m.values[k] ?? null }))
          .sort((a, b) => a.date.localeCompare(b.date));
        return (
          <div
            key={k}
            class="rounded-xl bg-[var(--wq-cell-bg)] p-3 ring-1 ring-[var(--wq-divider)]"
          >
            <MultiSeriesChart
              locale={locale}
              paramKey={k}
              unit={cat?.unit ?? ''}
              series={[{
                tankId: tank.id,
                label: tank.id,
                color: accent,
                points,
              }]}
              catalog={catalogForTank}
              height={150}
              showSafeBand={true}
              showLegend={false}
              showTitle={true}
              highlightDate={highlight}
              onHighlight={setHighlight}
              ink={accent}
              bandColor={accent}
            />
          </div>
        );
      })}
    </div>
  );
}
