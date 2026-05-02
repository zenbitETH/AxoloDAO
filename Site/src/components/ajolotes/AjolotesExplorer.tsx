import { useMemo, useState } from 'preact/hooks';
import type { Bundle, Ejemplar, Locale, SpeciesCode } from './types';
import type { Measurement } from '../waterQuality/types';
import { useTheme, SPECIES_ORDER, stationOf } from './theme';
import CoverHeader from './CoverHeader';
import Toolbar from './Toolbar';
import StationsList from './StationsList';
import EjemplarTable from './EjemplarTable';
import BajasView from './BajasView';
import EjemplarModal from './EjemplarModal';
import TweaksPanel from './TweaksPanel';

interface Props {
  locale: Locale;
  bundle: Bundle;
  water: Measurement[];
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

// Drop unnamed larva-of-A.mexicanum entries from the public Bajas wall.
const isLarvaBaja = (b: { nombre: string | null }) =>
  /^larva\b/i.test((b.nombre ?? '').trim());

const isAjolobebe = (e: Ejemplar) =>
  (e.alias ?? '').toLowerCase().includes('ajolobebe');

export default function AjolotesExplorer({ locale, bundle, water, paths }: Props) {
  const theme = useTheme();
  const [view, setView] = useState<'ejemplares' | 'bajas'>('ejemplares');
  const [viewDensity, setViewDensity] = useState<'gallery' | 'list'>('gallery');
  const [search, setSearch] = useState('');
  const [showLarvario, setShowLarvario] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesCode | null>(null);
  const [active, setActive] = useState<Ejemplar | null>(null);

  const visibleBajas = useMemo(
    () => bundle.bajas.filter((b) => !isLarvaBaja(b)),
    [bundle.bajas],
  );

  // Per-species counts exclude the unnamed ajolobebes so the cover cards
  // reflect named, individually-tracked specimens. The total cell still
  // shows the raw count so curators see the full ledger at a glance.
  const speciesCounts = useMemo(() => {
    const out: Record<SpeciesCode, number> = {
      'A. andersoni': 0,
      'A. mexicanum': 0,
      'A. dumerilii': 0,
    };
    for (const e of bundle.ejemplares) {
      if (isAjolobebe(e)) continue;
      if (SPECIES_ORDER.includes(e.especie)) out[e.especie] += 1;
    }
    return out;
  }, [bundle.ejemplares]);

  // Total mirrors what's actually rendered in the gallery: the unnamed
  // ajolobebes + Larvario station are gated behind the "showLarvario" tweak,
  // so the cover number shouldn't pre-count them when they're hidden.
  const totals = useMemo(
    () => ({
      total: bundle.ejemplares.filter(
        (e) => showLarvario || (!isAjolobebe(e) && stationOf(e.pecera) !== 'Larvario'),
      ).length,
      bajas: visibleBajas.length,
    }),
    [bundle.ejemplares, visibleBajas, showLarvario],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bundle.ejemplares.filter((e) => {
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
  }, [bundle.ejemplares, search, showLarvario]);

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
        <BajasView bajas={bundle.bajas} locale={locale} onBack={() => setView('ejemplares')} />
      )}

      {active && (
        <EjemplarModal
          ej={active}
          bundle={bundle}
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
