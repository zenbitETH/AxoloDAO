// Body-condition score gauge — five pips, fills from 1..5.

interface Props {
  value: number | string | null | undefined;
  accent: string;
  noDataLabel: string;
}

export default function BCSGauge({ value, accent, noDataLabel }: Props) {
  const raw = value == null || value === '' ? null : Number(value);
  const v = raw == null || Number.isNaN(raw) ? null : Math.max(1, Math.min(5, raw));
  return (
    <div class="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = v != null && n <= v;
        return (
          <div
            key={n}
            class="h-[22px] w-[18px] rounded-[3px] border-[1.5px]"
            style={
              on
                ? { backgroundColor: accent, borderColor: accent }
                : { backgroundColor: 'transparent', borderColor: 'var(--wq-divider)' }
            }
          />
        );
      })}
      <span class="ml-1.5 font-mono text-[11px] text-[var(--wq-ink-muted)]">
        {v != null ? `${v}/5` : noDataLabel}
      </span>
    </div>
  );
}
