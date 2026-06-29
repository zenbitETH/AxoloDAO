import type { Locale } from './types';
import { STRINGS } from './strings';

interface Props {
  locale: Locale;
  mondaysOnly: boolean;
  onMondaysToggle: (v: boolean) => void;
}

// "Solo lunes" data-scope toggle, colocated with the date selector and sized to
// match the test-type chip (same line height + text size).
export default function ViewToggle({ locale, mondaysOnly, onMondaysToggle }: Props) {
  const t = STRINGS[locale];
  return (
    <label class="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[var(--wq-surface-2)] px-3 py-1 text-xs text-[var(--wq-ink)] shadow-sm ring-1 ring-[var(--wq-divider)]">
      <input
        type="checkbox"
        checked={mondaysOnly}
        onChange={(e) => onMondaysToggle((e.target as HTMLInputElement).checked)}
        class="h-3.5 w-3.5 accent-current"
      />
      <span class="font-body">{mondaysOnly ? t.mondaysOnly : t.allMeasurements}</span>
    </label>
  );
}
