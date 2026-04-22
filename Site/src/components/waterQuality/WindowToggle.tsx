import type { Locale, TimeWindow } from './types';
import { STRINGS } from './strings';

interface Props {
  locale: Locale;
  window: TimeWindow;
  onWindowChange: (w: TimeWindow) => void;
}

const WINDOWS: TimeWindow[] = [4, 12, 26, 'all'];

// Compact pill selector for the historical-chart time window. Renders next
// to the Histórico title inside TankCard, where it actually has visual effect.
export default function WindowToggle({ locale, window, onWindowChange }: Props) {
  const t = STRINGS[locale];
  return (
    <div class="inline-flex items-center rounded-full bg-[var(--wq-surface-2)] p-1 shadow-sm ring-1 ring-[var(--wq-divider)]">
      <span class="px-2 font-body text-xs uppercase tracking-wider text-[var(--wq-ink-muted)]">
        {t.windowLabel}
      </span>
      {WINDOWS.map((w) => {
        const selected = window === w;
        const label = t[`window.${w}` as keyof typeof t] ?? String(w);
        return (
          <button
            key={String(w)}
            type="button"
            onClick={() => onWindowChange(w)}
            class={`rounded-full px-3 py-1 font-body text-xs transition ${
              selected
                ? 'bg-[var(--wq-ink)] text-[var(--wq-surface)]'
                : 'text-[var(--wq-ink)]/70 hover:text-[var(--wq-ink)]'
            }`}
            aria-pressed={selected}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
