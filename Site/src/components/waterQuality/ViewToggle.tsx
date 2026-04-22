import type { Locale, TimeWindow } from './types';
import { STRINGS } from './strings';

interface Props {
  locale: Locale;
  view: 'overview' | 'detail';
  mondaysOnly: boolean;
  window: TimeWindow;
  showWindow: boolean;
  onMondaysToggle: (v: boolean) => void;
  onWindowChange: (w: TimeWindow) => void;
}

const WINDOWS: TimeWindow[] = [4, 12, 26, 'all'];

export default function ViewToggle({
  locale,
  view,
  mondaysOnly,
  window,
  showWindow,
  onMondaysToggle,
  onWindowChange,
}: Props) {
  const t = STRINGS[locale];
  return (
    <div class="flex flex-wrap items-center gap-3">
      <label class="flex cursor-pointer items-center gap-2 rounded-full bg-[var(--wq-surface-2)] px-3 py-1.5 text-sm text-[var(--wq-ink)] shadow-sm ring-1 ring-[var(--wq-divider)]">
        <input
          type="checkbox"
          checked={mondaysOnly}
          onChange={(e) => onMondaysToggle((e.target as HTMLInputElement).checked)}
          class="h-4 w-4 accent-current"
        />
        <span class="font-body">
          {mondaysOnly ? t.mondaysOnly : t.allMeasurements}
        </span>
      </label>

      {showWindow && view === 'detail' && (
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
      )}
    </div>
  );
}
