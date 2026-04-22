import type { Locale } from './types';
import { STRINGS } from './strings';

interface Props {
  locale: Locale;
  mondaysOnly: boolean;
  onMondaysToggle: (v: boolean) => void;
}

// Top-level "Solo lunes" toggle. Affects both the overview cell values and
// the detail historical charts. The time-window selector used to live here
// too but moved into TankCard so it sits next to the charts it controls.
export default function ViewToggle({ locale, mondaysOnly, onMondaysToggle }: Props) {
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
    </div>
  );
}
