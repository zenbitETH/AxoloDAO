import type {
  Locale,
  Measurement,
  ParameterCatalogEntry,
  ParamKey,
  Tank,
} from './types';
import { PARAM_KEYS } from './types';
import { formatNumber, formatUnit, paramLabel, STRINGS } from './strings';
import { statusOf, trendOf } from './status';
import TrendIndicator from './TrendIndicator';

interface Props {
  locale: Locale;
  tank: Tank;
  prev: Measurement | null;
  curr: Measurement | null;
  catalogForTank: ParameterCatalogEntry[];
}

export default function ParameterTable({ locale, tank, prev, curr, catalogForTank }: Props) {
  const t = STRINGS[locale];
  const catalogByKey = new Map<ParamKey, ParameterCatalogEntry>();
  for (const c of catalogForTank) catalogByKey.set(c.key, c);

  // Skip parameters for which we have neither a catalog entry nor any data —
  // keeps the table focused on what the team actually tracks for this tank.
  const visibleKeys = PARAM_KEYS.filter((k) => {
    const cat = catalogByKey.get(k);
    const hasData = (prev?.values[k] ?? null) != null || (curr?.values[k] ?? null) != null;
    return !!cat || hasData;
  });

  return (
    <div class="flex flex-col gap-1">
      <div class="grid grid-cols-[1fr_repeat(3,auto)] items-center gap-x-3 gap-y-1 px-3 pb-1 text-[11px] uppercase tracking-wide text-cream/70">
        <span />
        <span class="text-right">{t.prevWeek}</span>
        <span class="text-right">{t.thisWeek}</span>
        <span class="text-center">{t.indicator}</span>
      </div>

      {visibleKeys.map((k) => {
        const cat = catalogByKey.get(k);
        const prevVal = prev?.values[k] ?? null;
        const currVal = curr?.values[k] ?? null;
        const status = statusOf(currVal, cat?.min ?? null, cat?.max ?? null);
        const trend = trendOf(prevVal, currVal);
        const unit = formatUnit(cat?.unit ?? '');
        return (
          <div
            key={k}
            class="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 rounded-xl bg-cream/95 px-3 py-2 text-choco"
          >
            <span class="font-display text-sm">
              {paramLabel(locale, k)}
            </span>
            <span class="font-body text-sm tabular-nums text-choco/70">
              <span class="mr-1">{formatNumber(prevVal, k)}</span>
              <span class="text-xs text-choco/45">{unit}</span>
            </span>
            <span class="font-body text-sm tabular-nums">
              <span class="mr-1 font-semibold">{formatNumber(currVal, k)}</span>
              <span class="text-xs text-choco/45">{unit}</span>
            </span>
            <TrendIndicator trend={trend} status={status} size="sm" />
          </div>
        );
      })}

      {!curr && (
        <p class="mt-2 rounded-lg bg-cream/80 px-3 py-2 text-sm text-choco/70">
          {t.emptyWeek}
        </p>
      )}
    </div>
  );
}
