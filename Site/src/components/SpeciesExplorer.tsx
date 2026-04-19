import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
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
    iucnFilter: 'Estatus IUCN', clear: 'Limpiar', searchAria: 'Buscar especie',
    tapAgain: 'Toca de nuevo para ver la ficha',
  },
  en: {
    map: 'Map', grid: 'Species', all: 'All', states: 'States', search: 'Search species...',
    description: 'Description', habitat: 'Habitat', distribution: 'Location', threats: 'Threats', references: 'References',
    feeding: 'Diet',
    nstates: 'states', endemic: 'Endemic to Mexico', protected: 'Found in ANP', viewFull: 'Open full profile', close: 'Close',
    iucnFilter: 'IUCN status', clear: 'Clear', searchAria: 'Search species',
    tapAgain: 'Tap again to open the profile',
  },
  pt: {
    map: 'Mapa', grid: 'Espécies', all: 'Todas', states: 'Estados', search: 'Buscar espécie...',
    description: 'Descrição', habitat: 'Hábitat', distribution: 'Localização', threats: 'Ameaças', references: 'Referências',
    feeding: 'Alimentação',
    nstates: 'estados', endemic: 'Endêmica do México', protected: 'Presente em ANP', viewFull: 'Ver ficha completa', close: 'Fechar',
    iucnFilter: 'Status IUCN', clear: 'Limpar', searchAria: 'Buscar espécie',
    tapAgain: 'Toque novamente para abrir a ficha',
  },
};

interface BBox { x: number; y: number; w: number; h: number }

interface Props {
  species: SpeciesItem[];
  mapSvgUrl: string;
  bboxesUrl: string;
  locale: 'es' | 'en' | 'pt';
  speciesPathBase: string;
  legendNote?: string;
}

const IUCN_GROUPS = [
  { key: 'endangered',      codes: ['CR', 'EN'],             color: '#E85D75',
    labels: { es: 'En peligro',        en: 'Endangered',       pt: 'Em perigo' } },
  { key: 'stable',          codes: ['VU', 'NT', 'LC'],       color: '#009C9C',
    labels: { es: 'En estado estable', en: 'Stable',           pt: 'Em estado estável' } },
  { key: 'data-deficient',  codes: ['DD', 'NE'],             color: '#D4925F',
    labels: { es: 'Poco conocidas',    en: 'Data deficient',   pt: 'Pouco conhecidas' } },
] as const;
type IucnGroupKey = typeof IUCN_GROUPS[number]['key'];

const XOLOTLCALLI_ONSITE = new Set(['andersoni', 'dumerilii', 'mexicanum']);
const ONSITE_LABELS: Record<'es' | 'en' | 'pt', string> = {
  es: 'Disponibles en línea y en el BioMuseo Xolotlcalli',
  en: 'Available online and onsite at BioMuseo Xolotlcalli',
  pt: 'Disponíveis online e no BioMuseo Xolotlcalli',
};

const LOCALIZED_FOR_ZOOM: Record<string, string[]> = {
  altamirani:    ['CMX', 'MEX', 'MOR'],
  amblycephalum: ['MIC'],
  andersoni:     ['MIC'],
  bombypellum:   ['MEX', 'MIC'],
  dumerilii:     ['MIC'],
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

const HERO_IMAGE_FILE: Record<string, string> = {
  andersoni: 'andersoni.png',
  dumerilii: 'dumerilii.png',
  mexicanum: 'mexicanum.png',
  velasci: 'velasci.png',
};

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function smoothScrollTo(el: HTMLElement | null) {
  if (!el) return;
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  });
}

export default function SpeciesExplorer({ species, mapSvgUrl, bboxesUrl, locale, speciesPathBase, legendNote }: Props) {
  const tx = STRINGS[locale];

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
  const [pinnedSpecies, setPinnedSpecies] = useState<string | null>(null);
  const [primedSpecies, setPrimedSpecies] = useState<string | null>(null);
  const [isCoarse, setIsCoarse] = useState(false);
  const [compact, setCompact] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(pointer: coarse)');
    setIsCoarse(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsCoarse(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 1023px)');
    let raf = 0;
    let lastCompact = false;
    const COMPACT_AT = 560;
    const EXPAND_AT = 460;
    const check = () => {
      raf = 0;
      if (!mq.matches) {
        if (lastCompact) { lastCompact = false; setCompact(false); }
        return;
      }
      const y = window.scrollY;
      const next = lastCompact ? y > EXPAND_AT : y > COMPACT_AT;
      if (next !== lastCompact) {
        lastCompact = next;
        setCompact(next);
      }
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(check);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    mq.addEventListener?.('change', check);
    check();
    return () => {
      window.removeEventListener('scroll', onScroll);
      mq.removeEventListener?.('change', check);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

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

  const highlightedStates = useMemo(() => {
    if (hoveredSpecies) {
      const sp = species.find((s) => s.slug === hoveredSpecies);
      return sp ? sp.states : [];
    }
    if (selected) return selected.states;
    if (pinnedSpecies) {
      const sp = species.find((s) => s.slug === pinnedSpecies);
      if (sp) return sp.states;
    }
    if (hoveredState) return [hoveredState];
    if (stateFilter) return [stateFilter];
    return [];
  }, [hoveredSpecies, hoveredState, selected, pinnedSpecies, stateFilter, species]);

  const activeStates = useMemo(() => {
    const set = new Set<string>();
    for (const s of filtered) for (const c of s.states) set.add(c);
    return [...set];
  }, [filtered]);

  const focusedSpecies = selected?.slug ?? hoveredSpecies ?? pinnedSpecies ?? null;
  const focusedAccent = useMemo(() => {
    if (!focusedSpecies) return undefined;
    return species.find((s) => s.slug === focusedSpecies)?.accentColor;
  }, [focusedSpecies, species]);

  // When a species is focused, force the map out of compact mode so the zoom
  // has real-estate to render. Otherwise auto-scrolling the list into view
  // would trip `compact = true` and kill the zoom.
  const effectiveCompact = compact && !focusedSpecies;

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
      return;
    }
    setStateFilter(code);
    clearFocus();
    if (isCoarse) {
      window.setTimeout(() => smoothScrollTo(gridRef.current), 120);
    }
  }

  function clearFocus() {
    setPinnedSpecies(null);
    setPrimedSpecies(null);
    setHoveredSpecies(null);
  }

  function handleGroupFilter(key: IucnGroupKey | null) {
    setIucnGroupFilter(key);
    clearFocus();
    if (isCoarse && key !== null) {
      window.setTimeout(() => smoothScrollTo(mapRef.current), 50);
    }
  }

  // Double-tap / click model:
  //   - Desktop: hover already primes the map (CSS :hover handles the glow).
  //     Click opens the modal directly.
  //   - Mobile: first tap primes (pulses, pans map, reveals "tap again" hint);
  //     second tap on the same card opens the sheet.
  function handleCardTap(s: SpeciesItem) {
    if (isCoarse) {
      if (primedSpecies === s.slug) {
        setSelected(s);
        setPrimedSpecies(null);
        return;
      }
      setPrimedSpecies(s.slug);
      setPinnedSpecies(s.slug);
      setHoveredSpecies(s.slug);
      window.setTimeout(() => smoothScrollTo(mapRef.current), 40);
    } else {
      setSelected(s);
      setPinnedSpecies(s.slug);
    }
  }

  function handleSheetClose() {
    setSelected(null);
    clearFocus();
  }

  function clearAll() {
    setIucnGroupFilter(null);
    setStateFilter(null);
    setSearch('');
    clearFocus();
  }

  const hasActiveFilter = Boolean(iucnGroupFilter || stateFilter || search);

  const iucnGroupColor = (code?: string) => {
    if (!code) return '#888';
    for (const g of IUCN_GROUPS) {
      if ((g.codes as readonly string[]).includes(code)) return g.color;
    }
    return '#888';
  };

  const renderCard = (s: SpeciesItem) => (
    <SpeciesCard
      key={s.slug}
      sp={s}
      badgeColor={iucnGroupColor(s.iucn)}
      iucnLabel={s.iucn ? IUCN_LABELS[s.iucn]?.[locale] : undefined}
      nstates={tx.nstates}
      tapAgainLabel={tx.tapAgain}
      isCoarse={isCoarse}
      primed={primedSpecies === s.slug}
      onHover={setHoveredSpecies}
      onTap={() => handleCardTap(s)}
    />
  );

  const subtitleByLocale: Record<'es' | 'en' | 'pt', string> = {
    es: 'Navega por especie o por estado en el mapa interactivo de México.',
    en: 'Browse by species or by state on the interactive map of Mexico.',
    pt: 'Navegue por espécie ou por estado no mapa interativo do México.',
  };

  return (
    <div class="container-wide">
      {/* Subtitle + search: search collapses behind a 🔍 icon on mobile. */}
      <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-white/75">{subtitleByLocale[locale]}</p>
        <div class="flex items-center justify-end gap-2">
          {!searchOpen && !search && (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={tx.searchAria}
              class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition-colors hover:border-white/30 hover:text-white sm:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>
          )}
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            onBlur={() => { if (!search) setSearchOpen(false); }}
            placeholder={tx.search}
            aria-label={tx.searchAria}
            class={`rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm placeholder:text-white/40 focus:border-teal focus:outline-none sm:block sm:w-72 ${(searchOpen || search) ? 'block w-full' : 'hidden'}`}
          />
        </div>
      </div>

      {/* Legend + IUCN filter: 2 cols on mobile, 4 cols on sm+ */}
      <div class="mb-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <button
          type="button"
          onClick={() => handleGroupFilter(null)}
          class={`flex items-baseline gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors sm:gap-3 sm:px-4 sm:py-3 ${iucnGroupFilter === null ? 'border-white/60 bg-white/10' : 'border-white/10 bg-white/[0.03] hover:border-white/30'}`}
        >
          <span class="font-display text-2xl font-extrabold leading-none text-white sm:text-3xl">{species.length}</span>
          <span class="font-display text-sm leading-tight text-white">{tx.all}</span>
        </button>
        {IUCN_GROUPS.map((g) => {
          const active = iucnGroupFilter === g.key;
          const isEndangered = g.key === 'endangered';
          return (
            <button
              type="button"
              key={g.key}
              onClick={() => handleGroupFilter(active ? null : g.key)}
              class={`flex items-baseline gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors sm:gap-3 sm:px-4 sm:py-3 ${active ? 'border-white/30 bg-white/[0.06]' : 'border-white/10 bg-white/[0.03] hover:border-white/30'}`}
              style={active ? `box-shadow: 0 0 0 2px ${g.color}55` : ''}
              title={g.codes.join(' · ')}
            >
              <span class="font-display text-2xl font-extrabold leading-none sm:text-3xl" style={`color:${g.color}`}>
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
        <div class="mb-4 flex items-start justify-end gap-2 text-[11px] italic text-white/55">
          <button
            type="button"
            onClick={() => setLegendOpen(v => !v)}
            aria-expanded={legendOpen}
            class="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 not-italic text-white/65 transition-colors hover:border-white/30 hover:text-white sm:hidden"
          >
            <span class="font-bold" style="color:#E85D75">*</span>
            <span class="text-[10px] font-semibold tracking-wide">UICN</span>
          </button>
          <span class={legendOpen ? 'block flex-1 text-left sm:text-right' : 'hidden sm:block sm:text-right'}>
            {legendNote}
          </span>
        </div>
      )}

      {/* Active-filter chips */}
      {(stateFilter || hasActiveFilter) && (
        <div class="mb-4 flex flex-wrap items-center gap-2 text-xs text-white/55">
          {stateFilter && (
            <span class="inline-flex items-center gap-2 rounded-full bg-teal/15 px-3 py-1 text-teal">
              {STATE_LABELS_ES[stateFilter]}
              <button type="button" onClick={() => setStateFilter(null)} class="text-teal/80 hover:text-white">×</button>
            </span>
          )}
          {pinnedSpecies && !selected && (
            <span class="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-white/80">
              A. {pinnedSpecies}
              <button type="button" onClick={() => setPinnedSpecies(null)} class="text-white/60 hover:text-white">×</button>
            </span>
          )}
          {hasActiveFilter && (
            <button type="button" onClick={clearAll} class="underline hover:text-white">
              {tx.clear}
            </button>
          )}
        </div>
      )}

      <div class="grid gap-6 lg:grid-cols-5 lg:items-start">
        {/* Sticky map on both mobile and desktop */}
        <div ref={mapRef} class="sticky top-20 z-20 lg:top-24 lg:col-span-3">
          <div class={`species-map-surface overflow-hidden rounded-3xl border border-white/10 p-3 sm:p-4 ${effectiveCompact ? 'species-map-compact' : ''} ${focusedSpecies ? 'species-map-zoomed' : ''}`}>
            <div
              class="species-map-aspect mx-auto flex w-full items-center justify-center"
            >
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
            <div class="species-map-label mt-3 min-h-[2rem] text-center">
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

        {/* Species list */}
        <div ref={gridRef} class="lg:col-span-2 space-y-5">
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
        <SpeciesDetailSheet
          sp={selected}
          locale={locale}
          onClose={handleSheetClose}
          speciesPathBase={speciesPathBase}
          isCoarse={isCoarse}
        />
      )}
    </div>
  );
}

// ============================================================================
// SpeciesCard — encapsulates per-card touch / pointer logic.
// ============================================================================

interface CardProps {
  sp: SpeciesItem;
  badgeColor: string;
  iucnLabel?: string;
  nstates: string;
  tapAgainLabel: string;
  isCoarse: boolean;
  primed: boolean;
  onHover: (slug: string | null) => void;
  onTap: () => void;
}

function SpeciesCard({ sp, badgeColor, iucnLabel, nstates, tapAgainLabel, isCoarse, primed, onHover, onTap }: CardProps) {
  const accent = sp.accentColor ?? '#009C9C';
  // Parse #RRGGBB into "r g b" for CSS custom property.
  const pulseRgb = (() => {
    const m = /^#?([0-9a-f]{6})$/i.exec(accent);
    if (!m) return '0 156 156';
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
  })();

  return (
    <button
      type="button"
      onClick={onTap}
      onMouseEnter={isCoarse ? undefined : () => onHover(sp.slug)}
      onMouseLeave={isCoarse ? undefined : () => onHover(null)}
      onFocus={() => onHover(sp.slug)}
      onBlur={() => onHover(null)}
      aria-pressed={primed || undefined}
      class={`species-card ${primed ? 'species-card--primed' : ''} glass glass-hover group flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-transform duration-200 hover:-translate-y-0.5`}
      style={`--pulse-rgb: ${pulseRgb}`}
    >
      <div
        class="species-card-dot h-4 w-4 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-125"
        style={{ backgroundColor: accent, boxShadow: `0 0 12px ${accent}aa` }}
      />
      <div class="min-w-0 flex-1">
        <div class="species-card-name font-display text-lg italic leading-tight text-white transition-colors duration-200 group-hover:text-teal">
          A. {sp.slug}
        </div>
        {sp.commonNames[0] && (
          <div class="truncate text-sm text-white/70 transition-colors duration-200 group-hover:text-white">
            {sp.commonNames[0]}
          </div>
        )}
        <div class="species-card-hint mt-1 text-[11px] italic tracking-wide text-white/55">
          ↗ {tapAgainLabel}
        </div>
      </div>
      <div class="flex shrink-0 flex-col items-end gap-1 text-right">
        {sp.iucn && (
          <span
            class="rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider"
            style={{ borderColor: `${badgeColor}66`, backgroundColor: `${badgeColor}22`, color: badgeColor }}
            title={iucnLabel}
          >
            {sp.iucn}
          </span>
        )}
        <span class="text-[10px] text-white/45">{sp.states.length} {nstates}</span>
      </div>
    </button>
  );
}

// ============================================================================
// SpeciesDetailSheet — bottom drawer on touch / small viewports, centered
// modal on desktop. Keeps the map visible at the "half" snap point.
// ============================================================================

interface SheetProps {
  sp: SpeciesItem;
  locale: 'es' | 'en' | 'pt';
  onClose: () => void;
  speciesPathBase: string;
  isCoarse: boolean;
}

type Snap = 'half' | 'full';

function SpeciesDetailSheet({ sp, locale, onClose, speciesPathBase, isCoarse }: SheetProps) {
  const tx = STRINGS[locale];
  const [isDrawer, setIsDrawer] = useState(isCoarse);
  const [snap, setSnap] = useState<Snap>('half');
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ y: number; time: number } | null>(null);
  const lastDrag = useRef<{ y: number; time: number } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsDrawer(mq.matches || isCoarse);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, [isCoarse]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const triggerCloseRef = useRef<() => void>(() => {});

  function triggerClose() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, 260);
  }
  triggerCloseRef.current = triggerClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') triggerCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (isDrawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isDrawer]);

  function onHandleDown(e: PointerEvent) {
    setIsDragging(true);
    const now = performance.now();
    dragStart.current = { y: e.clientY, time: now };
    lastDrag.current = { y: e.clientY, time: now };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function onHandleMove(e: PointerEvent) {
    if (!dragStart.current) return;
    const delta = e.clientY - dragStart.current.y;
    const clamped = snap === 'half' ? Math.max(delta, -window.innerHeight * 0.45) : delta;
    setDragOffset(clamped);
    lastDrag.current = { y: e.clientY, time: performance.now() };
  }
  function onHandleUp() {
    if (!dragStart.current) return;
    const delta = dragOffset;
    const vh = window.innerHeight;
    const elapsed = (lastDrag.current?.time ?? 0) - dragStart.current.time;
    const velocity = elapsed > 0 ? delta / elapsed : 0;

    if (snap === 'half') {
      if (delta < -vh * 0.12 || velocity < -0.5) {
        setSnap('full');
      } else if (delta > vh * 0.18 || velocity > 0.5) {
        triggerClose();
      }
    } else {
      if (delta > vh * 0.50 || velocity > 0.8) {
        triggerClose();
      } else if (delta > vh * 0.22 || velocity > 0.4) {
        setSnap('half');
      }
    }
    setDragOffset(0);
    setIsDragging(false);
    dragStart.current = null;
    lastDrag.current = null;
  }

  const content = <DetailBody sp={sp} locale={locale} speciesPathBase={speciesPathBase} />;

  if (!isDrawer) {
    return (
      <div
        class="fixed inset-0 z-[100] flex items-center justify-center bg-dark-navy/80 p-2 backdrop-blur-md sm:p-6"
        role="dialog"
        aria-modal="true"
        onClick={triggerClose}
      >
        <div
          class="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-mid-navy shadow-neon-teal"
          style={`max-height: 92vh; opacity: ${closing ? 0 : 1}; transform: ${entered && !closing ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(12px)'}; transition: transform 220ms cubic-bezier(0.23, 1, 0.32, 1), opacity 220ms ease-out;`}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={triggerClose} class="absolute right-3 top-3 z-10 rounded-full border border-white/15 bg-dark-navy/80 px-3 py-1 text-sm font-medium text-white/80 hover:bg-white/10">
            {tx.close}
          </button>
          <div class="max-h-[92vh] overflow-y-auto">{content}</div>
        </div>
      </div>
    );
  }

  const sheetHeight = snap === 'half' ? '58vh' : '92vh';
  const offscreen = !entered || closing;
  const translate = offscreen ? '100%' : `${dragOffset}px`;

  return (
    <div class="fixed inset-0 z-[100] pointer-events-none">
      {(snap === 'full' && !closing) && (
        <div
          class="absolute inset-0 bg-dark-navy/55 backdrop-blur-sm pointer-events-auto transition-opacity duration-200"
          style={`opacity: ${entered ? 1 : 0}`}
          onClick={() => setSnap('half')}
        />
      )}
      <div
        class={`species-sheet ${isDragging ? 'species-sheet--dragging' : ''} absolute inset-x-0 bottom-0 flex flex-col pointer-events-auto rounded-t-3xl border-t border-white/10 bg-mid-navy shadow-[0_-12px_40px_rgba(7,31,41,0.5)]`}
        style={`height: ${sheetHeight}; transform: translateY(${translate});`}
        role="dialog"
        aria-modal={snap === 'full' ? 'true' : 'false'}
      >
        <div
          class="species-sheet-handle relative flex h-8 shrink-0 items-center justify-center rounded-t-3xl bg-mid-navy"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <div class="h-1.5 w-10 rounded-full bg-white/30" />
          <button
            type="button"
            onClick={triggerClose}
            aria-label={tx.close}
            class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-dark-navy/60 px-2 py-0.5 text-[11px] font-medium text-white/75 hover:bg-white/10"
          >
            {tx.close}
          </button>
        </div>
        <div class="flex-1 overflow-y-auto">
          {content}
        </div>
      </div>
    </div>
  );
}

function DetailBody({ sp, locale, speciesPathBase }: { sp: SpeciesItem; locale: 'es' | 'en' | 'pt'; speciesPathBase: string }) {
  const tx = STRINGS[locale];
  const heroImage = HERO_IMAGE_FILE[sp.slug];
  return (
    <div>
      <div class="relative w-full overflow-hidden bg-gradient-to-br from-mid-navy via-navy to-dark-navy">
        {heroImage ? (
          <img
            src={`/species/${heroImage}`}
            alt={sp.scientificName}
            width={1482}
            height={954}
            class="block h-auto w-full"
            loading="eager"
            decoding="async"
          />
        ) : (
          <div
            class="flex h-44 w-full items-center justify-center sm:h-64"
            style={{ background: `radial-gradient(circle at center, ${sp.accentColor ?? '#009C9C'}40, transparent 70%)` }}
          >
            <div
              class="h-24 w-24 rounded-full"
              style={{ backgroundColor: sp.accentColor ?? '#009C9C', boxShadow: `0 0 32px ${sp.accentColor ?? '#009C9C'}80` }}
            />
          </div>
        )}
      </div>
      <div class="px-6 pb-10 pt-5 sm:px-10 sm:pt-6">
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

        {sp.description && <Block title={tx.description} body={sp.description} />}
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
