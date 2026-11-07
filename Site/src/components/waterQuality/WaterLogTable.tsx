import { useMemo, useState } from 'preact/hooks';
import type { Locale, Measurement, ParamKey, Tank } from './types';
import { PARAM_KEYS } from './types';
import { STRINGS, formatShortDate, formatNumber } from './strings';

interface Props {
  locale: Locale;
  tanks: Tank[];               // primary tanks (used for naming)
  measurements: Measurement[]; // source measurements (mondays-only or all)
  weekIso: string;             // unused for scoping now; kept for API stability
}

const PAGE_SIZE = 20;

// Short column headers for the comparison grid (the full labels are too wide).
const PARAM_SHORT: Record<ParamKey, string> = {
  temp: 'Temp', nh3: 'NH₃', no2: 'NO₂', no3: 'NO₃', gh: 'GH',
  kh: 'KH', ph: 'pH', po4: 'PO₄', cond: 'Cond', tds: 'TDS',
};

const SPECIES_ACCENT: Record<string, string> = { AA: '#B87333', AM: '#2C5F7C', AD: '#3E6B4A' };

// A scannable, paginated log of weekly water tests, the ajolotes list view's
// counterpart for the tanks.
export default function WaterLogTable({ locale, tanks, measurements }: Props) {
  const t = STRINGS[locale];
  const [page, setPage] = useState(0);

  const tankName = (id: string) => tanks.find((tk) => tk.id === id)?.displayName ?? id;
  // Species accent from an exact tank id, else from the id's species prefix.
  const accentFor = (s: string) => {
    const tank = tanks.find((tk) => tk.id === s);
    if (tank?.accentColor) return tank.accentColor;
    const u = s.trim().toUpperCase();
    if (u.startsWith('AA')) return SPECIES_ACCENT.AA;
    if (u.startsWith('AM')) return SPECIES_ACCENT.AM;
    if (u.startsWith('AD')) return SPECIES_ACCENT.AD;
    return '#6B7280';
  };

  const testRows = useMemo(
    () => [...measurements].sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? ''))),
    [measurements],
  );

  // Only show parameter columns that actually carry data.
  const activeParams = useMemo<ParamKey[]>(
    () => PARAM_KEYS.filter((k) => testRows.some((m) => m.values[k] != null)),
    [testRows],
  );

  const total = testRows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const pagedTests = testRows.slice(start, start + PAGE_SIZE);
  const colSpan = 3 + activeParams.length;

  const dateCell = (date: string) => (
    <td class="whitespace-nowrap border-b border-[var(--wq-divider)] py-2 pl-4 pr-3 font-mono text-[12px] text-[var(--wq-ink)]">
      {formatShortDate(locale, date)} <span class="text-[var(--wq-ink-muted)]">{date.slice(0, 4)}</span>
    </td>
  );
  const peceraCell = (label: string, color: string) => (
    <td class="border-b border-[var(--wq-divider)] px-3 py-2">
      <span
        class="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-[0.04em] shadow-sm"
        style={{ backgroundColor: color, color: '#F6EFE0' }}
      >
        {label}
      </span>
    </td>
  );
  const th = (label: string, opts: { first?: boolean; num?: boolean } = {}) => (
    <th
      class={`whitespace-nowrap border-b border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)] ${
        opts.first ? 'pl-4 text-left' : opts.num ? 'text-right' : 'text-left'
      }`}
    >
      {label}
    </th>
  );

  return (
    <section class="mt-8">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 class="font-display text-lg text-[var(--wq-ink)]">{t.logTitle}</h3>
      </div>

      <div class="overflow-x-auto rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-cell-bg)]">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr>
              {th(t.logColDate, { first: true })}
              {th(t.logColTank)}
              {activeParams.map((k) => th(PARAM_SHORT[k], { num: true }))}
            </tr>
          </thead>
          <tbody>
            {total === 0 ? (
              <tr>
                <td colSpan={colSpan} class="px-4 py-6 text-center text-sm text-[var(--wq-ink-muted)]">
                  {t.logEmpty}
                </td>
              </tr>
            ) : (
              pagedTests.map((m, i) => (
                <tr key={`${m.tankId}-${m.date}-${i}`} class="transition-colors hover:bg-[var(--wq-row-bg)]">
                  {dateCell(m.date)}
                  {peceraCell(tankName(m.tankId), accentFor(m.tankId))}
                  {activeParams.map((k) => {
                    const v = m.values[k];
                    const alarm = m.alarms.includes(k);
                    return (
                      <td
                        key={k}
                        class={`border-b border-[var(--wq-divider)] px-3 py-2 text-right font-mono text-[12px] tabular-nums ${
                          v == null
                            ? 'text-[var(--wq-ink-muted)]/50'
                            : alarm
                              ? 'font-bold text-rose-500'
                              : 'text-[var(--wq-ink)]'
                        }`}
                      >
                        {formatNumber(v, k)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE && (
        <div class="mt-3 flex items-center justify-end gap-3 font-body text-xs text-[var(--wq-ink-muted)]">
          <span class="tabular-nums">{start + 1}–{Math.min(start + PAGE_SIZE, total)} / {total}</span>
          <div class="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
              aria-label={t.navPrev}
              class="grid h-7 w-7 place-items-center rounded-full ring-1 ring-[var(--wq-divider)] transition hover:bg-[var(--wq-row-bg)] disabled:pointer-events-none disabled:opacity-30"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
            <span class="tabular-nums">{safePage + 1} / {pageCount}</span>
            <button
              type="button"
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label={t.navNext}
              class="grid h-7 w-7 place-items-center rounded-full ring-1 ring-[var(--wq-divider)] transition hover:bg-[var(--wq-row-bg)] disabled:pointer-events-none disabled:opacity-30"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
