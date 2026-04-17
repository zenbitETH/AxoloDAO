import { useEffect, useMemo, useState } from 'preact/hooks';
import MexicoMap from './MexicoMap';

export interface SpeciesItem {
  slug: string;
  scientificName: string;
  commonNames: string[];
  states: string[];
  iucn?: string;
  nom059?: string | null;
  description?: string;
  habitat?: string;
  distribution?: string;
  threats?: string;
  references: string[];
  anp: string[];
  accentColor?: string;
  endemic: boolean;
  hasHeroCard: boolean;
}

const STATE_LABELS_ES: Record<string, string> = {
  AGU: 'Aguascalientes', BCN: 'Baja California', BCS: 'Baja California Sur', CAM: 'Campeche',
  CHH: 'Chihuahua', CHP: 'Chiapas', CMX: 'Ciudad de México', COA: 'Coahuila', COL: 'Colima',
  DUR: 'Durango', GRO: 'Guerrero', GUA: 'Guanajuato', HID: 'Hidalgo', JAL: 'Jalisco',
  MEX: 'Estado de México', MIC: 'Michoacán', MOR: 'Morelos', NAY: 'Nayarit', NLE: 'Nuevo León',
  OAX: 'Oaxaca', PUE: 'Puebla', QUE: 'Querétaro', ROO: 'Quintana Roo', SIN: 'Sinaloa',
  SLP: 'San Luis Potosí', SON: 'Sonora', TAB: 'Tabasco', TAM: 'Tamaulipas', TLA: 'Tlaxcala',
  VER: 'Veracruz', YUC: 'Yucatán', ZAC: 'Zacatecas',
};

const IUCN_COLORS: Record<string, string> = {
  CR: '#E85D75', EN: '#D4925F', VU: '#F4E8C8', NT: '#9CCC9C',
  LC: '#009C9C', DD: '#888', NE: '#666',
};

const IUCN_LABELS: Record<string, Record<'es' | 'en' | 'pt', string>> = {
  CR: { es: 'En peligro crítico', en: 'Critically endangered', pt: 'Criticamente ameaçada' },
  EN: { es: 'En peligro', en: 'Endangered', pt: 'Em perigo' },
  VU: { es: 'Vulnerable', en: 'Vulnerable', pt: 'Vulnerável' },
  NT: { es: 'Casi amenazada', en: 'Near threatened', pt: 'Quase ameaçada' },
  LC: { es: 'Preocupación menor', en: 'Least concern', pt: 'Menor preocupação' },
  DD: { es: 'Datos deficientes', en: 'Data deficient', pt: 'Dados insuficientes' },
  NE: { es: 'No evaluada', en: 'Not evaluated', pt: 'Não avaliada' },
};

const STRINGS: Record<'es' | 'en' | 'pt', Record<string, string>> = {
  es: {
    map: 'Mapa', grid: 'Especies', all: 'Todas', states: 'Estados', search: 'Buscar especie...',
    description: 'Descripción', habitat: 'Hábitat', distribution: 'Distribución', threats: 'Amenazas', references: 'Referencias',
    nstates: 'estados', endemic: 'Endémica de México', protected: 'Presente en ANP', viewFull: 'Ver ficha completa', close: 'Cerrar',
    iucnFilter: 'Estatus IUCN', clear: 'Limpiar',
  },
  en: {
    map: 'Map', grid: 'Species', all: 'All', states: 'States', search: 'Search species...',
    description: 'Description', habitat: 'Habitat', distribution: 'Distribution', threats: 'Threats', references: 'References',
    nstates: 'states', endemic: 'Endemic to Mexico', protected: 'Found in ANP', viewFull: 'Open full profile', close: 'Close',
    iucnFilter: 'IUCN status', clear: 'Clear',
  },
  pt: {
    map: 'Mapa', grid: 'Espécies', all: 'Todas', states: 'Estados', search: 'Buscar espécie...',
    description: 'Descrição', habitat: 'Hábitat', distribution: 'Distribuição', threats: 'Ameaças', references: 'Referências',
    nstates: 'estados', endemic: 'Endêmica do México', protected: 'Presente em ANP', viewFull: 'Ver ficha completa', close: 'Fechar',
    iucnFilter: 'Status IUCN', clear: 'Limpar',
  },
};

interface Props {
  species: SpeciesItem[];
  mapSvgUrl: string;
  locale: 'es' | 'en' | 'pt';
  speciesPathBase: string; // e.g. '/especies/' or '/en/especies/'
}

export default function SpeciesExplorer({ species, mapSvgUrl, locale, speciesPathBase }: Props) {
  const tx = STRINGS[locale];
  const [view, setView] = useState<'map' | 'grid'>('map');
  const [mapSvg, setMapSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(mapSvgUrl)
      .then((r) => r.text())
      .then((txt) => { if (!cancelled) setMapSvg(txt); })
      .catch(() => { if (!cancelled) setMapSvg(''); });
    return () => { cancelled = true; };
  }, [mapSvgUrl]);
  const [iucnFilter, setIucnFilter] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [hoveredSpecies, setHoveredSpecies] = useState<string | null>(null);
  const [selected, setSelected] = useState<SpeciesItem | null>(null);

  const filtered = useMemo(() => {
    return species.filter((s) => {
      if (iucnFilter && s.iucn !== iucnFilter) return false;
      if (stateFilter && !s.states.includes(stateFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [s.scientificName, ...s.commonNames].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [species, iucnFilter, stateFilter, search]);

  // States to highlight on the map = states of currently-hovered species, or hovered state's species, or selected state
  const highlightedStates = useMemo(() => {
    if (hoveredSpecies) {
      const sp = species.find((s) => s.slug === hoveredSpecies);
      return sp ? sp.states : [];
    }
    if (selected) return selected.states;
    if (hoveredState) return [hoveredState];
    if (stateFilter) return [stateFilter];
    return [];
  }, [hoveredSpecies, hoveredState, selected, stateFilter, species]);

  const activeStates = useMemo(() => {
    const set = new Set<string>();
    for (const s of filtered) for (const c of s.states) set.add(c);
    return [...set];
  }, [filtered]);

  const iucnOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of species) if (s.iucn) set.add(s.iucn);
    return [...set];
  }, [species]);

  function handleStateClick(code: string) {
    if (stateFilter === code) {
      setStateFilter(null);
    } else {
      setStateFilter(code);
      setView('grid');
    }
  }

  return (
    <div class="container-wide">
      {/* Filter bar */}
      <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-semibold uppercase tracking-wider text-white/60">{tx.iucnFilter}:</span>
          <button
            type="button"
            onClick={() => setIucnFilter(null)}
            class={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${iucnFilter === null ? 'border-teal bg-teal text-dark-navy' : 'border-white/20 text-white/70 hover:border-white/40'}`}
          >
            {tx.all}
          </button>
          {iucnOptions.map((code) => (
            <button
              type="button"
              key={code}
              onClick={() => setIucnFilter(iucnFilter === code ? null : code)}
              class={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${iucnFilter === code ? 'border-teal bg-teal text-dark-navy' : 'border-white/20 text-white/70 hover:border-white/40'}`}
              title={IUCN_LABELS[code]?.[locale]}
            >
              <span class="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: IUCN_COLORS[code] }} /> {code}
            </button>
          ))}
          {(stateFilter || iucnFilter || search) && (
            <button type="button" onClick={() => { setIucnFilter(null); setStateFilter(null); setSearch(''); }} class="ml-2 text-xs text-white/60 underline hover:text-white">
              {tx.clear}
            </button>
          )}
        </div>

        <div class="flex items-center gap-3">
          <input
            type="search"
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            placeholder={tx.search}
            class="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm placeholder:text-white/40 focus:border-teal focus:outline-none lg:w-64"
          />
          <div class="hidden rounded-full border border-white/15 bg-white/5 p-0.5 text-xs font-semibold lg:hidden sm:flex">
            <button type="button" onClick={() => setView('map')} class={`rounded-full px-3 py-1 ${view === 'map' ? 'bg-teal text-dark-navy' : 'text-white/70'}`}>{tx.map}</button>
            <button type="button" onClick={() => setView('grid')} class={`rounded-full px-3 py-1 ${view === 'grid' ? 'bg-teal text-dark-navy' : 'text-white/70'}`}>{tx.grid}</button>
          </div>
        </div>
      </div>

      {stateFilter && (
        <div class="mb-4 inline-flex items-center gap-2 rounded-full bg-teal/15 px-3 py-1 text-xs text-teal">
          <span>{STATE_LABELS_ES[stateFilter]}</span>
          <button type="button" onClick={() => setStateFilter(null)} class="text-teal/80 hover:text-white">×</button>
        </div>
      )}

      {/* Mobile view toggle */}
      <div class="mb-4 flex justify-center sm:hidden">
        <div class="flex rounded-full border border-white/15 bg-white/5 p-0.5 text-xs font-semibold">
          <button type="button" onClick={() => setView('map')} class={`rounded-full px-4 py-1.5 ${view === 'map' ? 'bg-teal text-dark-navy' : 'text-white/70'}`}>{tx.map}</button>
          <button type="button" onClick={() => setView('grid')} class={`rounded-full px-4 py-1.5 ${view === 'grid' ? 'bg-teal text-dark-navy' : 'text-white/70'}`}>{tx.grid}</button>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-5">
        <div class={`${view === 'map' ? 'block' : 'hidden'} lg:col-span-3 lg:block`}>
          <div class="glass mx-auto overflow-hidden rounded-3xl p-4" style="max-width: min(100%, 3840px)">
            <div class="mx-auto" style="aspect-ratio: 7205 / 4735;">
              {mapSvg ? (
                <MexicoMap
                  svgMarkup={mapSvg}
                  highlightedStates={highlightedStates}
                  activeStates={stateFilter || iucnFilter || search ? activeStates : []}
                  onStateHover={setHoveredState}
                  onStateClick={handleStateClick}
                  className="h-full w-full"
                />
              ) : (
                <div class="flex h-full w-full items-center justify-center text-white/40 text-sm">…</div>
              )}
            </div>
            {hoveredState && (
              <div class="mt-2 text-center text-sm text-white/70">
                <strong class="text-teal">{STATE_LABELS_ES[hoveredState]}</strong>
                {' · '}
                {species.filter((s) => s.states.includes(hoveredState)).length} {locale === 'es' ? 'especies' : locale === 'en' ? 'species' : 'espécies'}
              </div>
            )}
          </div>
        </div>

        <div class={`${view === 'grid' ? 'block' : 'hidden'} lg:col-span-2 lg:block`}>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            {filtered.map((s) => (
              <button
                type="button"
                key={s.slug}
                onClick={() => setSelected(s)}
                onMouseEnter={() => setHoveredSpecies(s.slug)}
                onMouseLeave={() => setHoveredSpecies(null)}
                onFocus={() => setHoveredSpecies(s.slug)}
                onBlur={() => setHoveredSpecies(null)}
                class="glass glass-hover group flex flex-col items-start gap-2 rounded-2xl p-3 text-left"
              >
                <div class="flex w-full items-center justify-between">
                  <div class="h-3 w-3 rounded-full" style={{ backgroundColor: s.accentColor ?? '#009C9C' }} />
                  {s.iucn && (
                    <span class="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: `${IUCN_COLORS[s.iucn]}30`, color: IUCN_COLORS[s.iucn] }}>{s.iucn}</span>
                  )}
                </div>
                <div class="font-display text-sm leading-tight italic">A. {s.slug}</div>
                {s.commonNames[0] && <div class="line-clamp-2 text-[11px] text-white/60">{s.commonNames[0]}</div>}
                <div class="mt-1 text-[10px] text-white/50">{s.states.length} {tx.nstates}</div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div class="col-span-full py-12 text-center text-sm text-white/50">
                {locale === 'es' ? 'Sin resultados.' : locale === 'en' ? 'No results.' : 'Sem resultados.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <SpeciesModal sp={selected} locale={locale} onClose={() => setSelected(null)} speciesPathBase={speciesPathBase} />
      )}
    </div>
  );
}

interface ModalProps {
  sp: SpeciesItem;
  locale: 'es' | 'en' | 'pt';
  onClose: () => void;
  speciesPathBase: string;
}

function SpeciesModal({ sp, locale, onClose, speciesPathBase }: ModalProps) {
  const tx = STRINGS[locale];
  return (
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-dark-navy/80 p-2 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        class="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-mid-navy shadow-neon-teal"
        style="max-height: 92vh"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} class="absolute right-3 top-3 z-10 rounded-full border border-white/15 bg-dark-navy/80 px-3 py-1 text-sm font-medium text-white/80 hover:bg-white/10">
          {tx.close}
        </button>
        <div class="max-h-[92vh] overflow-y-auto">
          <div class="relative h-44 w-full overflow-hidden bg-gradient-to-br from-mid-navy via-navy to-dark-navy sm:h-56">
            {sp.hasHeroCard ? (
              <img
                src={`/species-cards/${sp.slug}.svg`}
                alt={sp.scientificName}
                class="h-full w-full object-cover object-left"
              />
            ) : (
              <div class="flex h-full w-full items-center justify-center" style={{ background: `radial-gradient(circle at center, ${sp.accentColor ?? '#009C9C'}40, transparent 70%)` }}>
                <div class="h-24 w-24 rounded-full" style={{ backgroundColor: sp.accentColor ?? '#009C9C' }} />
              </div>
            )}
          </div>
          <div class="px-6 pb-8 pt-6 sm:px-10">
            <h3 class="font-display text-3xl italic">A. {sp.slug}</h3>
            {sp.commonNames.length > 0 && (
              <p class="mt-1 text-white/70">{sp.commonNames.join(' · ')}</p>
            )}
            <div class="mt-4 flex flex-wrap gap-2">
              {sp.iucn && (
                <span class="badge" style={{ borderColor: `${IUCN_COLORS[sp.iucn]}66`, background: `${IUCN_COLORS[sp.iucn]}1f`, color: IUCN_COLORS[sp.iucn] }}>
                  IUCN · {sp.iucn} — {IUCN_LABELS[sp.iucn]?.[locale]}
                </span>
              )}
              {sp.nom059 && <span class="badge-rosa">NOM-059 · {sp.nom059}</span>}
              <span class="badge-teal">{sp.states.length} {tx.nstates}</span>
              {sp.endemic && <span class="badge-ocre">{tx.endemic}</span>}
              {sp.anp.length > 0 && <span class="badge-teal">{tx.protected}</span>}
            </div>

            {sp.description && (
              <Block title={tx.description} body={sp.description} />
            )}
            {sp.habitat && <Block title={tx.habitat} body={sp.habitat} />}
            {sp.distribution && <Block title={tx.distribution} body={sp.distribution} />}
            {sp.threats && <Block title={tx.threats} body={sp.threats} />}
            {sp.states.length > 0 && (
              <div class="mt-6">
                <h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-teal/80">{tx.states}</h4>
                <div class="flex flex-wrap gap-2">
                  {sp.states.map((c) => (
                    <span key={c} class="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">{STATE_LABELS_ES[c] ?? c}</span>
                  ))}
                </div>
              </div>
            )}
            {sp.references.length > 0 && (
              <details class="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <summary class="cursor-pointer font-semibold text-white/80">{tx.references}</summary>
                <ul class="mt-3 space-y-2 text-xs text-white/65">
                  {sp.references.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </details>
            )}
            <div class="mt-8">
              <a href={`${speciesPathBase}${sp.slug}`} class="btn-secondary">{tx.viewFull}</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <section class="mt-6">
      <h4 class="mb-2 text-xs font-semibold uppercase tracking-wider text-teal/80">{title}</h4>
      <div class="space-y-3 text-sm leading-relaxed text-white/85">
        {body.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </section>
  );
}
