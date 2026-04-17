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

interface BBox { x: number; y: number; w: number; h: number }

interface Props {
  species: SpeciesItem[];
  mapSvgUrl: string;
  bboxesUrl: string;
  locale: 'es' | 'en' | 'pt';
  speciesPathBase: string; // e.g. '/especies/' or '/en/especies/'
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
const ONSITE_BADGE: Record<'es' | 'en' | 'pt', string> = {
  es: 'En vivo · Xolotlcalli',
  en: 'Live · Xolotlcalli',
  pt: 'Ao vivo · Xolotlcalli',
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
  mexicanum:     ['CMX'],
  ordinarium:    ['MEX', 'MIC'],
  rivulare:      ['MEX', 'GRO'],
  taylori:       ['PUE'],
};

export default function SpeciesExplorer({ species, mapSvgUrl, bboxesUrl, locale, speciesPathBase }: Props) {
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
  const renderCard = (s: SpeciesItem) => (
    <button
      type="button"
      key={s.slug}
      onClick={() => setSelected(s)}
      onMouseEnter={() => setHoveredSpecies(s.slug)}
      onMouseLeave={() => setHoveredSpecies(null)}
      onFocus={() => setHoveredSpecies(s.slug)}
      onBlur={() => setHoveredSpecies(null)}
      class="glass glass-hover group flex flex-col items-start gap-2 rounded-2xl p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
    >
      <div
        class="h-3 w-3 rounded-full transition-transform duration-200 group-hover:scale-125"
        style={{ backgroundColor: s.accentColor ?? '#009C9C', boxShadow: `0 0 12px ${s.accentColor ?? '#009C9C'}aa` }}
      />
      <div class="font-display text-lg italic leading-tight text-white transition-colors duration-200 group-hover:text-teal">
        A. {s.slug}
      </div>
      {s.commonNames[0] && (
        <div class="line-clamp-1 text-sm text-white/70 transition-colors duration-200 group-hover:text-white">
          {s.commonNames[0]}
        </div>
      )}
      <div class="mt-auto text-xs text-white/45">{s.states.length} {tx.nstates}</div>
    </button>
  );

  return (
    <div class="container-wide">
      {/* Merged legend + IUCN group filter */}
      <div class="mb-6 grid gap-3 sm:grid-cols-4">
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
          return (
            <button
              type="button"
              key={g.key}
              onClick={() => setIucnGroupFilter(active ? null : g.key)}
              class={`flex items-baseline gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${active ? 'border-white/30 bg-white/[0.06]' : 'border-white/10 bg-white/[0.03] hover:border-white/30'}`}
              style={active ? `box-shadow: 0 0 0 2px ${g.color}55` : ''}
              title={g.codes.join(' · ')}
            >
              <span class="font-display text-3xl font-extrabold leading-none" style={`color:${g.color}`}>{groupCounts[g.key]}</span>
              <span class="font-display text-sm leading-tight" style={`color:${g.color}`}>{g.labels[locale]}</span>
            </button>
          );
        })}
      </div>

      {/* Search + clear */}
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-2 text-xs text-white/55">
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
        <input
          type="search"
          value={search}
          onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
          placeholder={tx.search}
          class="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm placeholder:text-white/40 focus:border-teal focus:outline-none sm:w-64"
        />
      </div>

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
                  zoomBBox={zoomBBox}
                  onStateHover={setHoveredState}
                  onStateClick={handleStateClick}
                  className="h-full w-full"
                />
              ) : (
                <div class="flex h-full w-full items-center justify-center text-white/40 text-sm">…</div>
              )}
            </div>
            <div class="mt-2 min-h-[1.25rem] text-center text-xs text-white/60">
              {hoveredState ? (
                <>
                  <strong class="text-teal">{STATE_LABELS_ES[hoveredState]}</strong>
                  {' · '}
                  {species.filter((s) => s.states.includes(hoveredState)).length} {locale === 'es' ? 'especies' : locale === 'en' ? 'species' : 'espécies'}
                </>
              ) : focusedSpecies ? (
                <span class="italic">A. {focusedSpecies}</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Species column — featured Xolotlcalli trio first, then the rest */}
        <div class={`${view === 'grid' ? 'block' : 'hidden'} lg:col-span-2 lg:block space-y-5`}>
          {featuredFiltered.length > 0 && (
            <section class="rounded-3xl border border-teal/30 bg-teal/[0.06] p-4 shadow-neon-teal/30">
              <header class="mb-3 flex items-start justify-between gap-2">
                <h3 class="font-display text-sm leading-tight text-teal">{ONSITE_LABELS[locale]}</h3>
                <span class="badge-teal shrink-0 whitespace-nowrap">{ONSITE_BADGE[locale]}</span>
              </header>
              <div class="grid grid-cols-3 gap-3">
                {featuredFiltered.map(renderCard)}
              </div>
            </section>
          )}
          {restFiltered.length > 0 && (
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
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
