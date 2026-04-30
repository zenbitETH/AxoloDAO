import type { Locale, SpeciesCode } from './types';
import { type ThemeMode, accent as accentFor } from './theme';
import { commonName, s } from './strings';

const STATION_VOLUMES: Record<string, string> = {
  AA: '106 L',
  AM: '5 peceras · 335 L',
  AD: '252 L',
};

const STATION_KEYS = new Set(['AA', 'AM', 'AD', 'Larvario']);

interface Props {
  groupKey: string;          // 'AA' | 'AM' | 'AD' | 'Larvario' | 'A. andersoni' | 'A. mexicanum' | 'A. dumerilii'
  count: number;
  species: SpeciesCode;       // representative species for accent + scientific-name line
  theme: ThemeMode;
  locale: Locale;
}

export default function StationHeader({ groupKey, count, species, theme, locale }: Props) {
  const ac = accentFor(species, theme);
  const cName = commonName(locale, species);
  const isStation = STATION_KEYS.has(groupKey);
  const title = isStation ? s(locale, `station.${groupKey}`) : species;
  const pill = isStation ? groupKey : groupKey.split(' ').slice(-1)[0]; // "A. andersoni" → "andersoni"
  const vol = STATION_VOLUMES[groupKey];
  const showAmNote = groupKey === 'AM';
  return (
    <div
      class="mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-dashed border-[var(--wq-divider)] pb-3.5"
      style={{ ['--accent' as string]: ac }}
    >
      <div class="flex items-start gap-3.5">
        <span
          class="self-start rounded-full px-3.5 py-1.5 font-display text-sm font-bold uppercase tracking-[0.04em]"
          style={{ backgroundColor: ac, color: '#F6EFE0' }}
        >
          {pill}
        </span>
        <div>
          <h2 class="m-0 font-display text-2xl font-bold tracking-tight text-[var(--wq-ink)]">
            {title}
          </h2>
          <p class="mt-1 text-sm text-[var(--wq-ink-muted)]">
            <em style={{ color: ac, fontStyle: 'italic' }}>{species}</em>
            {cName && <span class="opacity-85"> · {cName}</span>}
            {vol && <span class="opacity-85"> · {vol}</span>}
          </p>
          {showAmNote && (
            <p
              class="mt-2 inline-block rounded-xl px-2.5 py-1 text-xs"
              style={{ color: ac, backgroundColor: `${ac}1F` }}
            >
              {s(locale, 'station.AM.note')}
            </p>
          )}
        </div>
      </div>
      <span
        class="rounded-full border px-3.5 py-1.5 font-display text-sm font-semibold"
        style={{ borderColor: `${ac}55`, color: ac }}
      >
        {count}{' '}
        <small class="font-normal opacity-80">
          {count === 1 ? s(locale, 'station.count.one') : s(locale, 'station.count.many')}
        </small>
      </span>
    </div>
  );
}
