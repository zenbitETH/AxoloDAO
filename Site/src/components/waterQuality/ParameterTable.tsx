import type {
  Locale,
  Measurement,
  ParameterCatalogEntry,
  ParamKey,
} from './types';
import { PARAM_KEYS } from './types';
import { formatNumber, formatUnit, paramLabel, STRINGS } from './strings';
import { statusOf, trendOf } from './status';
import { StatusBadge } from './StatusBadge';

interface Props {
  locale: Locale;
  prev: Measurement | null;
  curr: Measurement | null;
  catalogForTank: ParameterCatalogEntry[];
  // Resolved tank accent for the active theme (passed down from TankCard).
  accent: string;
}

export default function ParameterTable({
  locale,
  prev,
  curr,
  catalogForTank,
  accent,
}: Props) {
  const t = STRINGS[locale];
  const catBy = new Map<ParamKey, ParameterCatalogEntry>();
  for (const c of catalogForTank) catBy.set(c.key, c);

  const visibleKeys = PARAM_KEYS.filter((k) => {
    const cat = catBy.get(k);
    const hasData =
      (prev?.values[k] ?? null) != null || (curr?.values[k] ?? null) != null;
    return !!cat || hasData;
  });

  const rows = visibleKeys.map((k) => {
    const cat = catBy.get(k);
    const prevVal = prev?.values[k] ?? null;
    const currVal = curr?.values[k] ?? null;
    const status = statusOf(currVal, cat?.min ?? null, cat?.max ?? null);
    const trend = trendOf(prevVal, currVal);
    const unit = formatUnit(cat?.unit ?? '');

    const range =
      cat && (cat.min != null || cat.max != null)
        ? `${cat.min != null ? formatNumber(cat.min, k) : '—'}–${cat.max != null ? formatNumber(cat.max, k) : '—'}`
        : '—';

    const statusRing =
      status === 'alarm'
        ? 'ring-1 ring-rose-400/70 shadow-[0_0_0_2px_rgba(244,63,94,0.14)]'
        : status === 'warn'
        ? 'ring-1 ring-amber-300/70'
        : 'ring-1 ring-[var(--wq-divider)]';

    return { k, cat, prevVal, currVal, status, trend, unit, range, statusRing };
  });

  return (
    <>
      {/* Mobile layout — stacked card per parameter */}
      <div class="space-y-2 sm:hidden">
        {rows.map(({ k, currVal, prevVal, status, trend, unit, range, statusRing }) => (
          <div key={k} class={`rounded-xl bg-[var(--wq-cell-bg)] px-3 py-2.5 ${statusRing}`}>
            <div class="flex items-center justify-between gap-3">
              <span class="font-display text-sm" style={{ color: accent }}>
                {paramLabel(locale, k)}
              </span>
              <div class="flex items-center gap-2">
                <span
                  class="font-body text-base font-semibold tabular-nums whitespace-nowrap"
                  style={{ color: accent }}
                >
                  {formatNumber(currVal, k)}
                  {unit && (
                    <span class="ml-1 text-[10px] font-normal opacity-70">{unit}</span>
                  )}
                </span>
                <StatusBadge trend={trend} status={status} size="sm" />
              </div>
            </div>
            <div class="mt-1 flex items-center justify-between gap-3 font-body text-[11px] tabular-nums text-[var(--wq-ink-muted)]">
              <span class="whitespace-nowrap">
                <span class="opacity-60">Rango </span>
                {range}
                {unit && <span class="ml-0.5 opacity-60">{unit}</span>}
              </span>
              <span class="whitespace-nowrap">
                <span class="opacity-60">{t.prevWeek.toLowerCase()} </span>
                {formatNumber(prevVal, k)}
              </span>
            </div>
          </div>
        ))}
        {!curr && (
          <p class="rounded-lg bg-[var(--wq-cell-bg)] px-3 py-2 text-sm text-[var(--wq-ink-muted)]">
            {t.emptyWeek}
          </p>
        )}
      </div>

      {/* Desktop layout — full 5-column grid */}
      <div class="wq-param-grid hidden sm:grid sm:grid-cols-[minmax(160px,1.4fr)_minmax(110px,auto)_minmax(88px,auto)_minmax(88px,auto)_auto] sm:items-center sm:gap-x-4 sm:gap-y-1.5">
        {/* Header row */}
        <div class="col-span-full grid grid-cols-subgrid px-3 pb-1 text-[10px] uppercase tracking-wider text-[var(--wq-ink-muted)]">
          <span />
          <span class="text-right">Rango</span>
          <span class="text-right">{t.prevWeek}</span>
          <span class="text-right">{t.thisWeek}</span>
          <span class="text-center">{t.indicator}</span>
        </div>

        {rows.map(({ k, currVal, prevVal, status, trend, unit, range, statusRing }) => (
          <div
            key={k}
            class={`col-span-full grid grid-cols-subgrid items-center rounded-xl bg-[var(--wq-cell-bg)] px-3 py-2 ${statusRing}`}
          >
            <span class="font-display text-sm" style={{ color: accent }}>
              {paramLabel(locale, k)}
            </span>
            <span class="text-right font-body text-[11px] tabular-nums text-[var(--wq-ink-muted)] whitespace-nowrap">
              {range}
              <span class="ml-1 opacity-60">{unit}</span>
            </span>
            <span
              class="text-right font-body text-sm tabular-nums whitespace-nowrap"
              style={{ color: accent, opacity: 0.62 }}
            >
              {formatNumber(prevVal, k)}
              <span class="ml-1 text-[10px] opacity-80">{unit}</span>
            </span>
            <span
              class="text-right font-body text-base font-semibold tabular-nums whitespace-nowrap"
              style={{ color: accent }}
            >
              {formatNumber(currVal, k)}
              <span class="ml-1 text-[10px] font-normal opacity-70">{unit}</span>
            </span>
            <div class="justify-self-center">
              <StatusBadge trend={trend} status={status} size="sm" />
            </div>
          </div>
        ))}

        {!curr && (
          <p class="col-span-full mt-2 rounded-lg bg-[var(--wq-cell-bg)] px-3 py-2 text-sm text-[var(--wq-ink-muted)]">
            {t.emptyWeek}
          </p>
        )}
      </div>
    </>
  );
}
