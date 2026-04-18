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
  feeding?: string;
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
    description: 'Descripción', habitat: 'Hábitat', distribution: 'Ubicación', threats: 'Amenazas', references: 'Referencias',
    feeding: 'Alimentación',
    nstates: 'estados', endemic: 'Endémica de México', protected: 'Presente en ANP', viewFull: 'Ver ficha completa', close: 'Cerrar',
    iucnFilter: 'Estatus IUCN', clear: 'Limpiar',
  },
  en: {
    map: 'Map', grid: 'Species', all: 'All', states: 'States', search: 'Search species...',
    description: 'Description', habitat: 'Habitat', distribution: 'Location', threats: 'Threats', references: 'References',
    feeding: 'Diet',
    nstates: 'states', endemic: 'Endemic to Mexico', protected: 'Found in ANP', viewFull: 'Open full profile', close: 'Close',
    iucnFilter: 'IUCN status', clear: 'Clear',
  },
  pt: {
    map: 'Mapa', grid: 'Espécies', all: 'Todas', states: 'Estados', search: 'Buscar espécie...',
    description: 'Descrição', habitat: 'Hábitat', distribution: 'Localização', threats: 'Ameaças', references: 'Referências',
    feeding: 'Alimentação',
    nstates: 'estados', endemic: 'Endêmica do México', protected: 'Presente em ANP', viewFull: 'Ver ficha completa', close: 'Fechar',
    iucnFilter: 'Status IUCN', clear: 'Limpar',
  },
};

interface BBox { x: number; y: number; w: number; h: number }

interface Props {
  species: SpeciesItem[];
  mapSvgUrl: string;
  bboxesUrl: string;
  locale: 'es' | 'en' | 'pt';
  speciesPathBase: string; // e.g. '/especies/' or '/en/especies/'
  legendNote?: string;
}

// Species whose distributions are localized enough to merit zooming into a single state region.
// Areas spanning multiple states (velasci/rosaceum/mavortium/silvense/ordinarium) stay zoomed-out.
// Group IUCN codes into the 3 user-facing buckets (merged legend + filter).
const IUCN_GROUPS = [
  { key: 'endangered',      codes: ['CR', 'EN'],             color: '#E85D75',
    labels: { es: 'En peligro',        en: 'Endangered',       pt: 'Em perigo' } },
  { key: 'stable',          codes: ['VU', 'NT', 'LC'],       color: '#009C9C',
    labels: { es: 'En estado estable', en: 'Stable',           pt: 'Em estado estável' } },
  { key: 'data-deficient',  codes: ['DD', 'NE'],             color: '#D4925F',
    labels: { es: 'Poco conocidas',    en: 'Data deficient',   pt: 'Pouco conhecidas' } },
] as const;
type IucnGroupKey = typeof IUCN_GROUPS[number]['key'];

const XOLOTLCALLI_ONSITE = new Set(['andersoni', 'dumerili', 'mexicanum']);
const ONSITE_LABELS: Record<'es' | 'en' | 'pt', string> = {
  es: 'Disponibles en línea y en el BioMuseo Xolotlcalli',
  en: 'Available online and onsite at BioMuseo Xolotlcalli',
  pt: 'Disponíveis online e no BioMuseo Xolotlcalli',
};

const LOCALIZED_FOR_ZOOM: Record<string, string[]> = {
  // Map species slug -> state codes whose union we zoom into.
  altamirani:    ['CMX', 'MEX', 'MOR'],
  amblycephalum: ['MIC'],
  andersoni:     ['MIC'],
  bombypellum:   ['MEX', 'MIC'],
  dumerili:      ['MIC'],
  flavipiperatum:['JAL'],
  granulosum:    ['MEX'],
  leorae:        ['MEX', 'PUE'],
  lermaense:     ['MEX'],
  mexicanum:     ['CMX', 'MEX', 'MOR'],
  ordinarium:    ['MEX', 'MIC'],
  rivulare:      ['MEX', 'GRO'],
  rosaceum:      ['CHH', 'DUR', 'JAL', 'NAY', 'SIN', 'SON', 'ZAC'],
  silvense:      ['DUR'],
  mavortium:     ['CHH', 'COA', 'SON', 'NLE', 'TAM'],
  velasci:       ['AGU', 'CHH', 'CMX', 'COA', 'DUR', 'GUA', 'HID', 'JAL', 'MEX', 'MIC', 'NLE', 'PUE', 'QUE', 'SLP', 'SON', 'TAM', 'TLA', 'VER', 'ZAC'],
  taylori:       ['PUE'],
};

export default function SpeciesExplorer({ species, mapSvgUrl, bboxesUrl, locale, speciesPathBase, legendNote }: Props) {
  const tx = STRINGS[locale];
  const [view, setView] = useState<'map' | 'grid'>('map');
  const [mapSvg, setMapSvg] = useState<string | null>(null);
  const [bboxes, setBboxes] = useState<Record<string, BBox>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(mapSvgUrl)
      .then((r) => r.text())
      .then((txt) => { if (!cancelled) setMapSvg(txt); })
      .catch(() => { if (!cancelled) setMapSvg(''); });
    return () => { cancelled = true; };
  }, [mapSvgUrl]);

  useEffect(() => {
    let cancelled = false;
    fetch(bboxesUrl)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setBboxes(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [bboxesUrl]);
  const [iucnGroupFilter, setIucnGroupFilter] = useState<IucnGroupKey | null>(null);
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [hoveredSpecies, setHoveredSpecies] = useState<string | null>(null);
  const [selected, setSelected] = useState<SpeciesItem | null>(null);

  const groupCodes = useMemo(() => {
    if (!iucnGroupFilter) return null;
    const g = IUCN_GROUPS.find((x) => x.key === iucnGroupFilter);
    return g ? new Set<string>(g.codes) : null;
  }, [iucnGroupFilter]);

  const filtered = useMemo(() => {
    return species.filter((s) => {
      if (groupCodes && (!s.iucn || !groupCodes.has(s.iucn))) return false;
      if (stateFilter && !s.states.includes(stateFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [s.scientificName, ...s.commonNames].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [species, groupCodes, stateFilter, search]);

  const groupCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const g of IUCN_GROUPS) {
      out[g.key] = species.filter((s) => s.iucn && (g.codes as readonly string[]).includes(s.iucn)).length;
    }
    return out;
  }, [species]);

  const featuredFiltered = filtered.filter((s) => XOLOTLCALLI_ONSITE.has(s.slug));
  const restFiltered = filtered.filter((s) => !XOLOTLCALLI_ONSITE.has(s.slug));

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

  // Species being focused on the map (highest priority: modal > hovered card > nothing)
  const focusedSpecies = selected?.slug ?? hoveredSpecies ?? null;
  const focusedAccent = useMemo(() => {
    if (!focusedSpecies) return undefined;
    return species.find((s) => s.slug === focusedSpecies)?.accentColor;
  }, [focusedSpecies, species]);

  // Compute zoom bbox: union of bboxes of LOCALIZED_FOR_ZOOM[focused].
  const zoomBBox = useMemo<BBox | null>(() => {
    if (!focusedSpecies) return null;
    const codes = LOCALIZED_FOR_ZOOM[focusedSpecies];
    if (!codes || !codes.length) return null;
    const boxes = codes.map((c) => bboxes[c]).filter(Boolean) as BBox[];
    if (!boxes.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of boxes) {
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y + b.h > maxY) maxY = b.y + b.h;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [focusedSpecies, bboxes]);

  function handleStateClick(code: string) {
    if (stateFilter === code) {
      setStateFilter(null);
    } else {
      setStateFilter(code);
      setView('grid');
    }
  }

  const hasActiveFilter = Boolean(iucnGroupFilter || stateFilter || search);

  // Map IUCN code to the merged-legend category color (rosa/teal/ocre) for card badges.
  const iucnGroupColor = (code?: string) => {
    if (!code) return '#888';
    for (const g of IUCN_GROUPS) {
      if ((g.codes as readonly string[]).includes(code)) return g.color;
    }
    return '#888';
  };

  const renderCard = (s: SpeciesItem) => {
    const badgeColor = iucnGroupColor(s.iucn);
    return (
      <button
        type="button"
        key={s.slug}
        onClick={() => setSelected(s)}
        onMouseEnter={() => setHoveredSpecies(s.slug)}
        onMouseLeave={() => setHoveredSpecies(null)}
        onFocus={() => setHoveredSpecies(s.slug)}
        onBlur={() => setHoveredSpecies(null)}
        class="glass glass-hover group flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
      >
        <div
          class="h-4 w-4 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-125"
          style={{ backgroundColor: s.accentColor ?? '#009C9C', boxShadow: `0 0 12px ${s.accentColor ?? '#009C9C'}aa` }}
        />
        <div class="min-w-0 flex-1">
          <div class="font-display text-lg italic leading-tight text-white transition-colors duration-200 group-hover:text-teal">
            A. {s.slug}
          </div>
          {s.commonNames[0] && (
            <div class="truncate text-sm text-white/70 transition-colors duration-200 group-hover:text-white">
              {s.commonNames[0]}
            </div>
          )}
        </div>
        <div class="flex shrink-0 flex-col items-end gap-1 text-right">
          {s.iucn && (
            <span
              class="rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider"
              style={{ borderColor: `${badgeColor}66`, backgroundColor: `${badgeColor}22`, color: badgeColor }}
              title={IUCN_LABELS[s.iucn]?.[locale]}
            >
              {s.iucn}
            </span>
          )}
          <span class="text-[10px] text-white/45">{s.states.length} {tx.nstates}</span>
        </div>
      </button>
    );
  };

  const subtitleByLocale: Record<'es' | 'en' | 'pt', string> = {
    es: 'Navega por especie o por estado en el mapa interactivo de México.',
    en: 'Browse by species or by state on the interactive map of Mexico.',
    pt: 'Navegue por espécie ou por estado no mapa interativo do México.',
  };

  return (
    <div class="container-wide">
      {/* Instruction subtitle + search (same row on desktop, stacked on mobile) */}
      <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-white/75">{subtitleByLocale[locale]}</p>
        <input
          type="search"
          value={search}
          onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
          placeholder={tx.search}
          class="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm placeholder:text-white/40 focus:border-teal focus:outline-none sm:w-72"
        />
      </div>

      {/* Merged legend + IUCN group filter */}
      <div class="mb-2 grid gap-3 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setIucnGroupFilter(null)}
          class={`flex items-baseline gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${iucnGroupFilter === null ? 'border-white/60 bg-white/10' : 'border-white/10 bg-white/[0.03] hover:border-white/30'}`}
        >
          <span class="font-display text-3xl font-extrabold leading-none text-white">{species.length}</span>
          <span class="font-display text-sm leading-tight text-white">{tx.all}</span>
        </button>
        {IUCN_GROUPS.map((g) => {
          const active = iucnGroupFilter === g.key;
          const isEndangered = g.key === 'endangered';
          return (
            <button
              type="button"
              key={g.key}
              onClick={() => setIucnGroupFilter(active ? null : g.key)}
              class={`flex items-baseline gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${active ? 'border-white/30 bg-white/[0.06]' : 'border-white/10 bg-white/[0.03] hover:border-white/30'}`}
              style={active ? `box-shadow: 0 0 0 2px ${g.color}55` : ''}
              title={g.codes.join(' · ')}
            >
              <span class="font-display text-3xl font-extrabold leading-none" style={`color:${g.color}`}>
                {groupCounts[g.key]}
                {isEndangered && <sup class="ml-0.5 text-base font-bold" style={`color:${g.color}`}>*</sup>}
              </span>
              <span class="flex flex-col items-start leading-tight" style={`color:${g.color}`}>
                <span class="font-display text-sm">{g.labels[locale]}</span>
                <span class="mt-0.5 text-[10px] font-semibold tracking-[0.15em] opacity-75">{g.codes.join(' · ')}</span>
              </span>
            </button>
          );
        })}
      </div>
      {legendNote && (
        <p class="mb-6 text-right text-[11px] italic text-white/50">{legendNote}</p>
      )}

      {/* Active-filter chips row (only when something is filtering) */}
      {(stateFilter || hasActiveFilter) && (
        <div class="mb-4 flex flex-wrap items-center gap-2 text-xs text-white/55">
          {stateFilter && (
            <span class="inline-flex items-center gap-2 rounded-full bg-teal/15 px-3 py-1 text-teal">
              {STATE_LABELS_ES[stateFilter]}
              <button type="button" onClick={() => setStateFilter(null)} class="text-teal/80 hover:text-white">×</button>
            </span>
          )}
          {hasActiveFilter && (
            <button type="button" onClick={() => { setIucnGroupFilter(null); setStateFilter(null); setSearch(''); }} class="underline hover:text-white">
              {tx.clear}
            </button>
          )}
        </div>
      )}

      {/* Mobile view toggle */}
      <div class="mb-4 flex justify-center lg:hidden">
        <div class="flex rounded-full border border-white/15 bg-white/5 p-0.5 text-xs font-semibold">
          <button type="button" onClick={() => setView('map')} class={`rounded-full px-4 py-1.5 ${view === 'map' ? 'bg-teal text-dark-navy' : 'text-white/70'}`}>{tx.map}</button>
          <button type="button" onClick={() => setView('grid')} class={`rounded-full px-4 py-1.5 ${view === 'grid' ? 'bg-teal text-dark-navy' : 'text-white/70'}`}>{tx.grid}</button>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-5 lg:items-start">
        {/* Map column — on desktop, sticky and tall so zoomed regions get vertical room */}
        <div class={`${view === 'map' ? 'block' : 'hidden'} lg:col-span-3 lg:block lg:sticky lg:top-24`}>
          <div class="glass overflow-hidden rounded-3xl p-3 sm:p-4">
            <div class="mx-auto flex w-full items-center justify-center" style="aspect-ratio: 4 / 5; max-height: calc(100vh - 9rem);">
              {mapSvg ? (
                <MexicoMap
                  svgMarkup={mapSvg}
                  highlightedStates={highlightedStates}
                  activeStates={hasActiveFilter ? activeStates : []}
                  focusedSpecies={focusedSpecies}
                  filteredSlugs={hasActiveFilter ? filtered.map((s) => s.slug) : null}
                  highlightColor={focusedAccent}
                  zoomBBox={zoomBBox}
                  onStateHover={setHoveredState}
                  onStateClick={handleStateClick}
                  className="h-full w-full"
                />
              ) : (
                <div class="flex h-full w-full items-center justify-center text-white/40 text-sm">…</div>
              )}
            </div>
            <div class="mt-3 min-h-[2rem] text-center">
              {hoveredState ? (
                <div class="text-sm text-white/70">
                  <strong class="text-teal">{STATE_LABELS_ES[hoveredState]}</strong>
                  {' · '}
                  {species.filter((s) => s.states.includes(hoveredState)).length} {locale === 'es' ? 'especies' : locale === 'en' ? 'species' : 'espécies'}
                </div>
              ) : focusedSpecies ? (
                <div
                  class="font-display text-2xl italic"
                  style={{ color: focusedAccent ?? '#009C9C' }}
                >
                  A. {focusedSpecies}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Species column — featured Xolotlcalli trio first, then the rest */}
        <div class={`${view === 'grid' ? 'block' : 'hidden'} lg:col-span-2 lg:block space-y-5`}>
          {featuredFiltered.length > 0 && (
            <section class="rounded-3xl border border-teal/30 bg-teal/[0.06] p-4 shadow-neon-teal/30">
              <header class="mb-3">
                <span class="badge-teal inline-flex">{ONSITE_LABELS[locale]}</span>
              </header>
              <div class="flex flex-col gap-2.5">
                {featuredFiltered.map(renderCard)}
              </div>
            </section>
          )}
          {restFiltered.length > 0 && (
            <div class="flex flex-col gap-2.5">
              {restFiltered.map(renderCard)}
            </div>
          )}
          {filtered.length === 0 && (
            <div class="py-12 text-center text-sm text-white/50">
              {locale === 'es' ? 'Sin resultados.' : locale === 'en' ? 'No results.' : 'Sem resultados.'}
            </div>
          )}
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

// Slug -> filename in /public/species/ for the 4 species that have a hero image.
// Dumerili's slug is "dumerili" (single i) but the file was exported as "dumerilii.png".
const HERO_IMAGE_FILE: Record<string, string> = {
  andersoni: 'andersoni.png',
  dumerili: 'dumerilii.png',
  mexicanum: 'mexicanum.png',
  velasci: 'velasci.png',
};

function SpeciesModal({ sp, locale, onClose, speciesPathBase }: ModalProps) {
  const tx = STRINGS[locale];
  const heroImage = HERO_IMAGE_FILE[sp.slug];
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
          <div class="relative w-full overflow-hidden bg-gradient-to-br from-mid-navy via-navy to-dark-navy">
            {heroImage ? (
              // Show the full illustration end-to-end horizontally; height adapts to the
              // image's own aspect ratio so nothing is cropped sideways.
              <img
                src={`/species/${heroImage}`}
                alt={sp.scientificName}
                class="block h-auto w-full"
                loading="eager"
              />
            ) : (
              <div
                class="flex h-52 w-full items-center justify-center sm:h-64"
                style={{ background: `radial-gradient(circle at center, ${sp.accentColor ?? '#009C9C'}40, transparent 70%)` }}
              >
                <div
                  class="h-24 w-24 rounded-full"
                  style={{ backgroundColor: sp.accentColor ?? '#009C9C', boxShadow: `0 0 32px ${sp.accentColor ?? '#009C9C'}80` }}
                />
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
            {sp.feeding && <Block title={tx.feeding} body={sp.feeding} />}
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
