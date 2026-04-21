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
      <label class="flex cursor-pointer items-center gap-2 rounded-full bg-cream px-3 py-1.5 text-sm text-choco shadow-sm ring-1 ring-choco/10">
        <input
          type="checkbox"
          checked={mondaysOnly}
          onChange={(e) => onMondaysToggle((e.target as HTMLInputElement).checked)}
          class="h-4 w-4 accent-choco"
        />
        <span class="font-body">
          {mondaysOnly ? t.mondaysOnly : t.allMeasurements}
        </span>
      </label>

      {showWindow && view === 'detail' && (
        <div class="inline-flex items-center rounded-full bg-cream p-1 shadow-sm ring-1 ring-choco/10">
          <span class="px-2 font-body text-xs uppercase tracking-wider text-choco/50">
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
                    ? 'bg-choco text-cream'
                    : 'text-choco/70 hover:text-choco'
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
