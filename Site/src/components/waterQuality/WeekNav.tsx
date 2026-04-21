import type { Locale } from './types';
import { formatWeekDate, STRINGS } from './strings';

interface Props {
  locale: Locale;
  weekIso: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export default function WeekNav({ locale, weekIso, canPrev, canNext, onPrev, onNext }: Props) {
  const t = STRINGS[locale];
  return (
    <div class="flex items-center justify-between gap-3 rounded-full bg-cream px-2 py-2 shadow-sm ring-1 ring-choco/10">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label={t.navPrev}
        class="grid h-9 w-9 place-items-center rounded-full text-choco transition hover:bg-choco/10 disabled:pointer-events-none disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-choco"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <div class="flex flex-col items-center leading-tight">
        <span class="font-body text-[11px] uppercase tracking-wider text-choco/50">
          {t.week}
        </span>
        <span class="font-display text-base text-choco">
          {formatWeekDate(locale, weekIso)}
        </span>
      </div>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        aria-label={t.navNext}
        class="grid h-9 w-9 place-items-center rounded-full text-choco transition hover:bg-choco/10 disabled:pointer-events-none disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-choco"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  );
}
