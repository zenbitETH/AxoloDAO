// Lista (dashboard) view — single table, all ejemplares scannable at once.
// Click a row to open the same modal the gallery cards open.

import type { Ejemplar, Locale, SpeciesCode } from './types';
import { genderSymbol, type ThemeMode, accent as accentFor, stationOf, STATION_ORDER, SPECIES_ORDER } from './theme';
import { genderTitle, s } from './strings';
import { classifyStage } from './stage';
import EjemplarPhoto from './EjemplarPhoto';
import StageChip from './StageChip';

interface Props {
  ejemplares: Ejemplar[];
  showLarvario: boolean;
  searchEmptyQuery: string;
  theme: ThemeMode;
  locale: Locale;
  selectedSpecies: SpeciesCode | null;
  onSelect: (ej: Ejemplar) => void;
}

const GENDER_CLASS: Record<'♀' | '♂' | '(?)', string> = {
  '♀':   'text-[#D67BA8] dark:text-[#F4A6CB]',
  '♂':   'text-[#4FA3D1] dark:text-[#7AC0E8]',
  '(?)': 'text-[var(--wq-ink-muted)] text-[0.85em]',
};

export default function EjemplarTable({
  ejemplares,
  showLarvario,
  searchEmptyQuery,
  theme,
  locale,
  selectedSpecies,
  onSelect,
}: Props) {
  const sorted = [...ejemplares]
    .filter((e) => showLarvario || stationOf(e.pecera) !== 'Larvario')
    .sort((a, b) => {
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
      return String(a.pecera ?? '').localeCompare(
        String(b.pecera ?? ''),
        undefined,
        { numeric: true },
      );
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
      <div class="overflow-x-auto rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-cell-bg)]">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr>
              {[
                'resumen.alias',
                'resumen.pecera',
                'resumen.especie',
                'resumen.fenotipo',
                'resumen.estadio',
              ].map((k, i) => (
                <th
                  key={k}
                  class={`whitespace-nowrap border-b border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)] ${
                    i === 0 ? 'pl-4' : ''
                  }`}
                >
                  {s(locale, k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((ej) => {
              const ac = accentFor(ej.especie, theme);
              const sym = genderSymbol(ej.genero);
              const stage = classifyStage(ej.lt, ej.estadio);
              const station = stationOf(ej.pecera);
              const peceraPrefix =
                station === 'AM'
                  ? s(locale, 'pecera.aquarium')
                  : station === 'AA' || station === 'AD'
                    ? s(locale, 'pecera.station')
                    : '';
              const dimmed = !!selectedSpecies && ej.especie !== selectedSpecies;
              const highlighted = !!selectedSpecies && ej.especie === selectedSpecies;
              return (
                <tr
                  key={ej.id ?? ej.alias}
                  onClick={() => onSelect(ej)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(ej);
                    }
                  }}
                  style={
                    highlighted
                      ? { boxShadow: `inset 3px 0 0 0 ${ac}` }
                      : undefined
                  }
                  class={`cursor-pointer transition-[opacity,filter,background-color,box-shadow] duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--wq-row-bg)] focus:outline-none focus-visible:bg-[var(--wq-row-bg)] ${
                    dimmed
                      ? 'opacity-35 saturate-[0.5] hover:opacity-100 hover:saturate-100'
                      : ''
                  }`}
                  aria-label={ej.alias}
                >
                  <td class="border-b border-[var(--wq-divider)] py-2 pl-4 pr-3">
                    <span class="flex items-center gap-2.5">
                      <EjemplarPhoto alias={ej.alias} accent={ac} size={32} />
                      <span class="flex min-w-0 flex-col">
                        <span class="flex items-baseline gap-1.5 font-display text-[0.95rem] font-bold leading-tight tracking-tight text-[var(--wq-ink)]">
                          <span class="truncate">{ej.alias}</span>
                          <span class={GENDER_CLASS[sym]} title={genderTitle(locale, ej.genero)}>
                            {sym}
                          </span>
                          {(ej.pecera ?? '').trim() === 'Cuarentena' && (
                            <span class="aj-ribbon aj-state-pulse ml-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-rosa px-2 py-0.5 font-display text-[9px] font-extrabold uppercase tracking-[0.08em] text-marfil shadow-[0_2px_6px_rgba(7,31,41,0.35)]">
                              <span class="inline-block h-1.5 w-1.5 rounded-full bg-marfil" aria-hidden="true" />
                              {s(locale, 'modal.ribbon.cuarentena')}
                            </span>
                          )}
                        </span>
                        {ej.id && (
                          <span class="font-mono text-[10px] text-[var(--wq-ink-muted)]">
                            {ej.id}
                          </span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td class="border-b border-[var(--wq-divider)] px-3 py-2">
                    <span
                      class="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-[0.04em] shadow-sm"
                      style={{ backgroundColor: ac, color: '#F6EFE0' }}
                    >
                      {peceraPrefix ? `${peceraPrefix} ${ej.pecera}` : ej.pecera || '—'}
                    </span>
                  </td>
                  <td class="border-b border-[var(--wq-divider)] px-3 py-2 text-[var(--wq-ink)]">
                    <span style={{ color: ac, fontStyle: 'italic' }}>{ej.especie}</span>
                  </td>
                  <td class="max-w-[260px] truncate border-b border-[var(--wq-divider)] px-3 py-2 text-[var(--wq-ink-muted)]">
                    {ej.fenotipo || '—'}
                  </td>
                  <td class="border-b border-[var(--wq-divider)] px-3 py-2">
                    <StageChip stage={stage} accent={ac} locale={locale} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
