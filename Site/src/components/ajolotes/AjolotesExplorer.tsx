import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Bundle, Ejemplar, Locale } from './types';
import { useTheme } from './theme';
import CoverHeader from './CoverHeader';
import Toolbar from './Toolbar';
import StationsList from './StationsList';
import BajasView from './BajasView';
import EjemplarModal from './EjemplarModal';
import TweaksPanel from './TweaksPanel';

interface Props {
  locale: Locale;
  bundle: Bundle;
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

export default function AjolotesExplorer({ locale, bundle, paths }: Props) {
  const theme = useTheme();
  const [view, setView] = useState<'ejemplares' | 'bajas'>('ejemplares');
  const [groupBy, setGroupBy] = useState<'station' | 'species'>('station');
  const [search, setSearch] = useState('');
  const [showLarvario, setShowLarvario] = useState(true);
  const [active, setActive] = useState<Ejemplar | null>(null);

  const totals = useMemo(() => {
    const especies = new Set(bundle.ejemplares.map((e) => e.especie));
    return {
      total: bundle.ejemplares.length,
      especies: especies.size,
      bajas: bundle.bajas.length,
    };
  }, [bundle]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bundle.ejemplares.filter((e) => {
      if (!showLarvario && (e.alias ?? '').toLowerCase().includes('ajolobebe')) return false;
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

  // Reset search when group-by flips, matches the prototype's behaviour.
  useEffect(() => {
    setSearch('');
  }, [groupBy]);

  return (
    <>
      {view === 'ejemplares' && (
        <CoverHeader
          locale={locale}
          totalEjemplares={totals.total}
          totalEspecies={totals.especies}
          totalBajas={totals.bajas}
          view={view}
          onToggleBajas={setBajasView}
          waterPath={paths.waterPath}
        />
      )}

      {view === 'ejemplares' && (
        <Toolbar
          locale={locale}
          groupBy={groupBy}
          onGroupBy={setGroupBy}
          search={search}
          onSearch={setSearch}
        />
      )}

      {view === 'ejemplares' && (
        <StationsList
          ejemplares={filtered}
          groupBy={groupBy}
          showLarvario={showLarvario}
          searchEmptyQuery={search}
          theme={theme}
          locale={locale}
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
          onClose={() => setActive(null)}
        />
      )}

      <TweaksPanel
        locale={locale}
        theme={theme}
        groupBy={groupBy}
        showLarvario={showLarvario}
        onTheme={applyTheme}
        onGroupBy={setGroupBy}
        onLarvario={setShowLarvario}
        pathFor={(l) => paths.ajolotesByLocale[l]}
      />
    </>
  );
}
