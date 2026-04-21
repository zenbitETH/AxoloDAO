import type { Locale } from './types';
import { formatWeekDate, STRINGS } from './strings';

interface Props {
  locale: Locale;
  weekIso: string;
  logoSrc?: string;
}

export default function CoverHeader({
  locale,
  weekIso,
  logoSrc = '/logos/Xolotlcalli.svg',
}: Props) {
  const t = STRINGS[locale];
  return (
    <div class="rounded-2xl bg-cream px-5 py-6 text-center shadow-sm ring-1 ring-choco/10 sm:px-8 sm:py-8">
      <p class="font-display text-2xl text-choco sm:text-3xl">{t.coverTitle}</p>
      <p class="font-display text-lg text-choco/70 sm:text-xl">{t.coverSubtitle}</p>
      <p class="mt-1 font-body text-sm text-choco/60">
        {formatWeekDate(locale, weekIso)}
      </p>
      <div class="mt-5 grid place-items-center">
        <img src={logoSrc} alt="Biomuseo Xolotlcalli" class="h-14 w-auto opacity-90" />
      </div>
    </div>
  );
}
