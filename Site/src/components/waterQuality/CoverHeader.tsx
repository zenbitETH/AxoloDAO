import type { Locale, Measurement } from './types';
import { formatWeekDate, STRINGS } from './strings';

interface Props {
  locale: Locale;
  weekIso: string;
  // Optional metadata: the freshest measurement of the week
  latest?: Measurement | null;
  summary?: { ok: number; warn: number; alarm: number };
}

export default function CoverHeader({ locale, weekIso, latest, summary }: Props) {
  const t = STRINGS[locale];
  return (
    <div class="flex flex-col items-center gap-2 py-2 text-center">
      <p class="font-display text-2xl text-[var(--wq-ink)] sm:text-3xl">{t.coverTitle}</p>
      <p class="font-display text-base text-[var(--wq-ink)]/70 sm:text-lg">{t.coverSubtitle}</p>
      <p class="font-body text-sm text-[var(--wq-ink)]/55">
        {formatWeekDate(locale, weekIso)}
      </p>
      {latest?.authors?.main && (
        <p class="font-mono text-[11px] text-[var(--wq-ink)]/45">
          {latest.authors.main}
          {latest.authors.secondary ? ` · ${latest.authors.secondary}` : ''}
        </p>
      )}
      {summary && (summary.ok + summary.warn + summary.alarm > 0) && (
        <div class="mt-1 flex flex-wrap items-center justify-center gap-2 text-[11px]">
          <SummaryChip count={summary.ok}    tone="ok"    label={t.statusOk} />
          <SummaryChip count={summary.warn}  tone="warn"  label={t.statusWarn} />
          <SummaryChip count={summary.alarm} tone="alarm" label={t.statusAlarm} />
        </div>
      )}
    </div>
  );
}

function SummaryChip({
  count,
  tone,
  label,
}: {
  count: number;
  tone: 'ok' | 'warn' | 'alarm';
  label: string;
}) {
  if (count === 0) {
    return (
      <span class="inline-flex items-center gap-1 rounded-full bg-[var(--wq-ink)]/5 px-2 py-0.5 font-body text-[var(--wq-ink)]/40 tabular-nums">
        <span class="inline-block h-1.5 w-1.5 rounded-full bg-current/30" aria-hidden="true" />
        0 {label.toLowerCase()}
      </span>
    );
  }
  const dot =
    tone === 'ok' ? 'bg-emerald-500'
    : tone === 'warn' ? 'bg-amber-400'
    : 'bg-rose-500 wq-pulse';
  return (
    <span class="inline-flex items-center gap-1.5 rounded-full bg-[var(--wq-ink)]/6 px-2.5 py-0.5 font-body text-[var(--wq-ink)]/80 tabular-nums">
      <span class={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      <span class="font-semibold">{count}</span>
      <span class="text-[var(--wq-ink)]/55">{label.toLowerCase()}</span>
    </span>
  );
}
