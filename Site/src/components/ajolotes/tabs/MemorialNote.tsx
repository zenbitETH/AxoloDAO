import type { Locale } from '../types';
import { s } from '../strings';

// One line at the top of a detail tab when the specimen has died: these are records of
// a life that ended, and the insight the tab holds is said in words before the charts.

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const dMem = (d: string) => `${+d.slice(8, 10)} ${MES[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;

export default function MemorialNote({ death, insight, locale }: { death: string | null; insight?: string | null; locale: Locale }) {
  return (
    <p class="m-0 mb-3.5 rounded-xl border-l-[3px] border-[var(--wq-ink-muted)] bg-[var(--wq-row-bg)] px-3 py-2 text-[13px] leading-snug text-[var(--wq-ink)]">
      <span class="text-[var(--wq-ink-muted)]">{death ? s(locale, 'memorial.note').replace('{d}', dMem(death)) : s(locale, 'memorial.noteNoDate')}</span>
      {insight && <> {insight}</>}
    </p>
  );
}

/** Largest fall from the heaviest earlier weigh-in to the last one, if any. */
export function weightDrop(rows: { fecha: string; peso?: number | null }[]) {
  const ps = rows.filter((r) => r.fecha && r.peso != null).map((r) => ({ d: r.fecha, g: +(r.peso as number) })).sort((a, b) => a.d.localeCompare(b.d));
  if (ps.length < 2) return null;
  const last = ps[ps.length - 1];
  const peak = ps.slice(0, -1).reduce((m, p) => (p.g > m.g ? p : m));
  if (last.g >= peak.g) return null;
  return { from: peak, to: last, g: +(peak.g - last.g).toFixed(1), pct: Math.round(((peak.g - last.g) / peak.g) * 100) };
}

/** Longest stretch between two consecutive feeding records. */
export function feedingGap(rows: { fecha?: string | null }[]) {
  const ds = [...new Set(rows.map((r) => r.fecha).filter(Boolean) as string[])].sort();
  let gap: { from: string; to: string; n: number } | null = null;
  for (let i = 1; i < ds.length; i++) {
    const n = Math.round((Date.parse(ds[i]) - Date.parse(ds[i - 1])) / 864e5);
    if (n >= 5 && (!gap || n > gap.n)) gap = { from: ds[i - 1], to: ds[i], n };
  }
  return gap;
}
