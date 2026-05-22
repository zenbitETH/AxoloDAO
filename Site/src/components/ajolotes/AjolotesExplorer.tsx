import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Baja, BitacoraEntry, Bundle, Ejemplar, Locale, SpeciesCode } from './types';
import type { Measurement } from '../waterQuality/types';
import { useTheme, SPECIES_ORDER, stationOf } from './theme';
import { aliasSlug } from './photos';
import CoverHeader from './CoverHeader';
import Toolbar from './Toolbar';
import StationsList from './StationsList';
import EjemplarTable from './EjemplarTable';
import BajasView from './BajasView';
import EjemplarModal from './EjemplarModal';
import TweaksPanel from './TweaksPanel';
import { useBackToClose } from '../useBackToClose';

interface Props {
  locale: Locale;
  bundle: Bundle;
  water: Measurement[];
  bitacora: BitacoraEntry[];      // bitacora-recent.json eagerly imported by the page shell
  // Locale-aware paths injected by the page shell so links keep their prefixes
  paths: {
    waterPath: string;            // back-link to the Xolotlcalli water dashboard
    ajolotesByLocale: Record<Locale, string>;
  };
}

// Apply theme by writing to <html> + localStorage so the global ThemeToggle
// stays in sync. Pinning to 'dark' or 'light' overrides the 'auto' default.
function applyTheme(t: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = t;
  document.documentElement.dataset.themeMode = t;
  try {
    localStorage.setItem('axolodao-theme', t);
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

// Public Bajas wall is curated to named, individually-tracked specimens that
// are part of the current Xolotlcalli memorial scope. The xlsx contains
// historical entries (Golden, Moka, Guajolote, Jaffy) plus unnamed mexicanum
// larvae; these are filtered here rather than removed from source so the raw
// operativo file stays the system of record. Update this list when curators
// add a new memorialized specimen.
const BAJAS_VISIBLE_NAMES = new Set(['Loncho', 'Leucistica']);
const isVisibleBaja = (b: { nombre: string | null }) =>
  BAJAS_VISIBLE_NAMES.has((b.nombre ?? '').trim());

// Aliases hidden from the live Ajolotes Explorer because the specimens are
// no longer in the colony: Leucistica passed (memorial in Bajas); Ajolobebe 3
// and 4 did not survive (their deaths are reflected in the larvae bajas which
// the public wall already filters out). Cleared once the Monday xlsx update
// drops them from the active ejemplares sheet.
const EJEMPLARES_HIDDEN_ALIASES = new Set(['Leucistica', 'Ajolobebe 3', 'Ajolobebe 4']);
const isHiddenEjemplar = (e: Ejemplar) =>
  EJEMPLARES_HIDDEN_ALIASES.has((e.alias ?? '').trim());

const isAjolobebe = (e: Ejemplar) =>
  (e.alias ?? '').toLowerCase().includes('ajolobebe');

// Synthesize a Baja entry for Leucistica from her latest ejemplar snapshot
// when the xlsx has not yet recorded her death. Becomes a no-op once the
// Monday update adds her to the bajas sheet.
function synthLeucisticaBaja(ejemplares: Ejemplar[]): Baja | null {
  const e = ejemplares.find((x) => (x.alias ?? '').trim() === 'Leucistica');
  if (!e) return null;
  return {
    fecha: null,
    nombre: 'Leucistica',
    peso: e.peso,
    longitud: e.lt,
    edad: e.edad,
    causa: null,
    necropcia: null,
  };
}

export default function AjolotesExplorer({ locale, bundle, water, bitacora, paths }: Props) {
  const theme = useTheme();
  const [view, setView] = useState<'ejemplares' | 'bajas'>('ejemplares');
  const [viewDensity, setViewDensity] = useState<'gallery' | 'list'>('gallery');
  const [search, setSearch] = useState('');
  // Default ON so the surviving larvae (Ajolobebe 1 + 2) appear in the main
  // gallery without requiring the curator tweak. The unsurvived siblings are
  // already excluded via EJEMPLARES_HIDDEN_ALIASES, so this gate is now only
  // a curator-side power-user toggle, not a public-default safeguard.
  const [showLarvario, setShowLarvario] = useState(true);
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesCode | null>(null);
  const [active, setActive] = useState<Ejemplar | null>(null);

  // Back-button / back-gesture closes overlay-like views (ejemplar modal,
  // bajas view) — same idiom as the mobile menu in Header.astro.
  useBackToClose(active !== null, () => setActive(null), 'axolodao:ejemplar-modal');
  useBackToClose(view === 'bajas', () => setView('ejemplares'), 'axolodao:bajas-view');

  // Drop deceased / off-colony specimens before any downstream component
  // sees them. Source xlsx still carries them; this filter is the boundary.
  const liveEjemplares = useMemo<Ejemplar[]>(
    () => bundle.ejemplares.filter((e: Ejemplar) => !isHiddenEjemplar(e)),
    [bundle.ejemplares],
  );

  // Curated public memorial: Loncho + Leucistica. If the xlsx has not yet
  // recorded Leucistica's death, synthesize an entry from her ejemplar row
  // (next Monday's xlsx update will shadow this synthetic entry).
  const visibleBajas = useMemo<Baja[]>(() => {
    const fromData = bundle.bajas.filter(isVisibleBaja);
    const hasLeucistica = fromData.some((b: Baja) => (b.nombre ?? '').trim() === 'Leucistica');
    if (hasLeucistica) return fromData;
    const synth = synthLeucisticaBaja(bundle.ejemplares);
    return synth ? [...fromData, synth] : fromData;
  }, [bundle.bajas, bundle.ejemplares]);

  // Per-species counts mirror exactly what the gallery renders, so the cover
  // cards always agree with `totals.total`. When the Larvario tweak is off,
  // ajolobebes (and any other Larvario-station specimens) are excluded from
  // both this breakdown and the total.
  const speciesCounts = useMemo(() => {
    const out: Record<SpeciesCode, number> = {
      'A. andersoni': 0,
      'A. mexicanum': 0,
      'A. dumerilii': 0,
    };
    for (const e of liveEjemplares) {
      if (!showLarvario && (isAjolobebe(e) || stationOf(e.pecera) === 'Larvario')) continue;
      if (SPECIES_ORDER.includes(e.especie)) out[e.especie] += 1;
    }
    return out;
  }, [liveEjemplares, showLarvario]);

  // Total mirrors what's actually rendered in the gallery: the unnamed
  // ajolobebes + Larvario station are gated behind the "showLarvario" tweak,
  // so the cover number shouldn't pre-count them when they're hidden.
  const totals = useMemo(
    () => ({
      total: liveEjemplares.filter(
        (e) => showLarvario || (!isAjolobebe(e) && stationOf(e.pecera) !== 'Larvario'),
      ).length,
      bajas: visibleBajas.length,
    }),
    [liveEjemplares, visibleBajas, showLarvario],
  );

  // Deep-link: when the page loads with #<alias-slug> (e.g. linked from the
  // species map modal), open that ejemplar's detail. Also listen for in-page
  // hashchange so navigating between hashes on the same page works.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const openFromHash = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (!hash) return;
      const match = liveEjemplares.find(
        (e) => e.alias && aliasSlug(e.alias) === hash,
      );
      if (match) setActive(match);
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, [liveEjemplares]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return liveEjemplares.filter((e) => {
      if (!showLarvario && isAjolobebe(e)) return false;
      if (!q) return true;
      return (
        (e.alias ?? '').toLowerCase().includes(q) ||
        (e.id ?? '').toLowerCase().includes(q) ||
        (e.pecera ?? '').toLowerCase().includes(q) ||
        (e.especie ?? '').toLowerCase().includes(q) ||
        (e.fenotipo ?? '').toLowerCase().includes(q)
      );
    });
  }, [liveEjemplares, search, showLarvario]);

  const setBajasView = () => setView((v) => (v === 'bajas' ? 'ejemplares' : 'bajas'));

  return (
    <>
      {view === 'ejemplares' && (
        <CoverHeader
          locale={locale}
          theme={theme}
          totalEjemplares={totals.total}
          totalBajas={totals.bajas}
          speciesCounts={speciesCounts}
          selectedSpecies={selectedSpecies}
          onSelectSpecies={setSelectedSpecies}
          view={view}
          onToggleBajas={setBajasView}
          waterPath={paths.waterPath}
        />
      )}

      {view === 'ejemplares' && (
        <Toolbar
          locale={locale}
          viewDensity={viewDensity}
          onViewDensity={setViewDensity}
          search={search}
          onSearch={setSearch}
        />
      )}

      {view === 'ejemplares' && viewDensity === 'gallery' && (
        <StationsList
          ejemplares={filtered}
          showLarvario={showLarvario}
          searchEmptyQuery={search}
          theme={theme}
          locale={locale}
          selectedSpecies={selectedSpecies}
          onSelect={setActive}
        />
      )}

      {view === 'ejemplares' && viewDensity === 'list' && (
        <EjemplarTable
          ejemplares={filtered}
          showLarvario={showLarvario}
          searchEmptyQuery={search}
          theme={theme}
          locale={locale}
          selectedSpecies={selectedSpecies}
          onSelect={setActive}
        />
      )}

      {view === 'bajas' && (
        <BajasView bajas={visibleBajas} locale={locale} onBack={() => setView('ejemplares')} />
      )}

      {active && (
        <EjemplarModal
          ej={active}
          bundle={bundle}
          bitacora={bitacora}
          theme={theme}
          locale={locale}
          water={water}
          waterPath={paths.waterPath}
          onClose={() => setActive(null)}
        />
      )}

      <TweaksPanel
        locale={locale}
        theme={theme}
        showLarvario={showLarvario}
        onTheme={applyTheme}
        onLarvario={setShowLarvario}
        pathFor={(l) => paths.ajolotesByLocale[l]}
      />
    </>
  );
}
