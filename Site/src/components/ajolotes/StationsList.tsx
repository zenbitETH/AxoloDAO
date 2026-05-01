import type { Ejemplar, Locale, SpeciesCode } from './types';
import { type ThemeMode, stationOf, STATION_ORDER, SPECIES_ORDER } from './theme';
import { s } from './strings';
import EjemplarCard from './EjemplarCard';

interface Props {
  ejemplares: Ejemplar[];
  showLarvario: boolean;
  searchEmptyQuery: string;
  theme: ThemeMode;
  locale: Locale;
  selectedSpecies: SpeciesCode | null;
  onSelect: (ej: Ejemplar) => void;
}

export default function StationsList({
  ejemplares,
  showLarvario,
  searchEmptyQuery,
  theme,
  locale,
  selectedSpecies,
  onSelect,
}: Props) {
  const visible = ejemplares.filter(
    (e) => showLarvario || stationOf(e.pecera) !== 'Larvario',
  );

  // Default sort: species (catalogue order) → station → pecera number → alias.
  // When a species pill is active, that species floats to the front and the
  // rest keeps the same secondary order so the layout stays predictable.
  const sorted = [...visible].sort((a, b) => {
    if (selectedSpecies) {
      const ap = a.especie === selectedSpecies ? 0 : 1;
      const bp = b.especie === selectedSpecies ? 0 : 1;
      if (ap !== bp) return ap - bp;
    }
    const ea = SPECIES_ORDER.indexOf(a.especie);
    const eb = SPECIES_ORDER.indexOf(b.especie);
    if (ea !== eb) return ea - eb;
    const sa = STATION_ORDER.indexOf(stationOf(a.pecera));
    const sb = STATION_ORDER.indexOf(stationOf(b.pecera));
    if (sa !== sb) return sa - sb;
    const pa = String(a.pecera ?? '');
    const pb = String(b.pecera ?? '');
    const cmp = pa.localeCompare(pb, undefined, { numeric: true });
    if (cmp !== 0) return cmp;
    return a.alias.localeCompare(b.alias);
  });

  if (sorted.length === 0) {
    return (
      <main class="mx-auto max-w-[1240px] px-6 pb-20 pt-4">
        <p class="m-0 py-5 text-center text-sm text-[var(--wq-ink-muted)]">
          {s(locale, 'empty.search').replace('{q}', searchEmptyQuery)}
        </p>
      </main>
    );
  }

  return (
    <main class="mx-auto max-w-[1240px] px-6 pb-20 pt-4">
      <div
        class="grid gap-3.5"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
      >
        {sorted.map((e) => {
          const emphasis: 'neutral' | 'highlighted' | 'dimmed' = !selectedSpecies
            ? 'neutral'
            : e.especie === selectedSpecies
              ? 'highlighted'
              : 'dimmed';
          return (
            <EjemplarCard
              key={e.id ?? e.alias}
              ej={e}
              theme={theme}
              locale={locale}
              emphasis={emphasis}
              onClick={onSelect}
            />
          );
        })}
      </div>
    </main>
  );
}
