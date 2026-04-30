import type { Ejemplar, Locale, SpeciesCode } from './types';
import { type ThemeMode, stationOf, STATION_ORDER, SPECIES_ORDER } from './theme';
import { s } from './strings';
import EjemplarCard from './EjemplarCard';
import StationHeader from './StationHeader';

interface Props {
  ejemplares: Ejemplar[];
  groupBy: 'station' | 'species';
  showLarvario: boolean;
  searchEmptyQuery: string;
  theme: ThemeMode;
  locale: Locale;
  onSelect: (ej: Ejemplar) => void;
}

interface Group {
  key: string;
  ejemplares: Ejemplar[];
  speciesForHeader: SpeciesCode;
}

export default function StationsList({
  ejemplares,
  groupBy,
  showLarvario,
  searchEmptyQuery,
  theme,
  locale,
  onSelect,
}: Props) {
  // Bucket
  const buckets = new Map<string, Ejemplar[]>();
  for (const e of ejemplares) {
    const key = groupBy === 'station' ? stationOf(e.pecera) : e.especie;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(e);
  }

  // Order
  const order = groupBy === 'station' ? STATION_ORDER : SPECIES_ORDER;
  const orderedKeys: string[] = [
    ...order.filter((k) => buckets.has(k)),
    ...[...buckets.keys()].filter((k) => !(order as readonly string[]).includes(k)),
  ];

  const groups: Group[] = orderedKeys.map((key) => {
    let list = buckets.get(key)!;
    // AM peceras numerically sorted within their flat grid
    if (groupBy === 'station' && key === 'AM') {
      list = [...list].sort((a, b) =>
        String(a.pecera ?? '').localeCompare(String(b.pecera ?? ''), undefined, { numeric: true }),
      );
    }
    return {
      key,
      ejemplares: list,
      speciesForHeader: groupBy === 'station' ? list[0].especie : (key as SpeciesCode),
    };
  });

  const visible = groups.filter((g) => showLarvario || g.key !== 'Larvario');

  if (visible.length === 0) {
    return (
      <main class="mx-auto max-w-[1240px] px-6 pb-20 pt-4">
        <p class="m-0 py-5 text-center text-sm text-[var(--wq-ink-muted)]">
          {s(locale, 'empty.search').replace('{q}', searchEmptyQuery)}
        </p>
      </main>
    );
  }

  return (
    <main class="mx-auto grid max-w-[1240px] grid-cols-1 gap-14 px-6 pb-20 pt-4">
      {visible.map((g) => (
        <section key={g.key}>
          <StationHeader
            groupKey={g.key}
            count={g.ejemplares.length}
            species={g.speciesForHeader}
            theme={theme}
            locale={locale}
          />
          <div class="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {g.ejemplares.map((e) => (
              <EjemplarCard
                key={e.id ?? e.alias}
                ej={e}
                theme={theme}
                locale={locale}
                onClick={onSelect}
              />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
