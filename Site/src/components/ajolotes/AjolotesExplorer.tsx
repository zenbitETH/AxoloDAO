import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Baja, BitacoraEntry, Bundle, Ejemplar, Locale, SpeciesCode } from './types';
import type { Measurement } from '../waterQuality/types';
import { useTheme, SPECIES_ORDER, stationOf } from './theme';
import { aliasSlug } from './photos';
import { memorialEjemplar } from './memorial';
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
  logoSvg: string;                // Xolotlcalli wordmark, injected by the page shell
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
// are part of the current Xolotlcalli memorial scope. The xlsx also holds
// historical entries (Golden, Moka, Guajolote, Jaffy) plus unnamed mexicanum
// larvae, still under memorial-scope review; these are filtered here rather
// than removed from source so the raw operativo file stays the system of
// record. Update this list when curators memorialize a new specimen.
const BAJAS_VISIBLE_NAMES = new Set(['Loncho', 'Leucistica', 'Panchita', 'Goldy']);

// NOTE: the per-component hidden-alias list that used to live here is gone.
// `bundle.ejemplares` is now the LIVE roster by construction — data-ajolotes.mjs
// filters deceased (Bajas sheet + DECEASED_NOT_IN_BAJAS) and embargoed names at
// ingest, so every consumer inherits it. That matters beyond this file: Xovi and
// the /covers generator fetch the same bundle over HTTPS and never had a copy of
// this list, which is how a deceased specimen was still being offered as a clip
// target. If a deceased specimen reappears here, fix the ingest, not this file.

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

// Synthesize Baja entries for Panchita and Goldy from their latest ejemplar
// snapshot. Panchita is on the operativo Bajas sheet but without a cause yet;
// Goldy is not on it at all. Synthesizing here lets the memorial carry the
// curated cause + biometrics now; these shadow any later xlsx row via the
// synth-preferred merge in visibleBajas. Each becomes removable once the
// operativo records the same fields.
function synthPanchitaBaja(ejemplares: Ejemplar[]): Baja | null {
  const e = ejemplares.find((x) => (x.alias ?? '').trim() === 'Panchita');
  if (!e) return null;
  return {
    fecha: '2026-07-08',
    nombre: 'Panchita',
    peso: e.peso,
    longitud: e.lt,
    edad: e.edad,
    causa: 'Complicaciones por saprolegniasis branquial crónica e infección secundaria',
    necropcia: 'En proceso',
  };
}

function synthGoldyBaja(ejemplares: Ejemplar[]): Baja | null {
  const e = ejemplares.find((x) => (x.alias ?? '').trim() === 'Goldy');
  if (!e) return null;
  return {
    fecha: '2026-07-13',
    nombre: 'Goldy',
    peso: e.peso,
    longitud: e.lt,
    edad: e.edad,
    causa: 'Complicaciones post-parasitosis; caquexia (bajo peso)',
    necropcia: null,
  };
}

// Curated synthetic bajas keyed by name. When a name in BAJAS_VISIBLE_NAMES has
// a synth entry, it is preferred over the raw operativo row so the memorial
// shows the curated cause/biometrics; names without one fall back to the xlsx.
const SYNTH_BAJAS: Record<string, (ejemplares: Ejemplar[]) => Baja | null> = {
  Leucistica: synthLeucisticaBaja,
  Panchita: synthPanchitaBaja,
  Goldy: synthGoldyBaja,
};

export default function AjolotesExplorer({ locale, bundle, water, bitacora, logoSvg, paths }: Props) {
  const theme = useTheme();
  const [view, setView] = useState<'ejemplares' | 'bajas'>('ejemplares');
  const [viewDensity, setViewDensity] = useState<'gallery' | 'list'>('gallery');
  const [search, setSearch] = useState('');
  // Default ON so the surviving larvae (Ajolobebe 1 + 2) appear in the main
  // gallery without requiring the curator tweak. The unsurvived siblings are
  // already excluded by the ingest-level deceased filter, so this gate is only
  // a curator-side power-user toggle, not a public-default safeguard.
  const [showLarvario, setShowLarvario] = useState(true);
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesCode | null>(null);
  // The open profile modal. `baja` is set only when opened from the Bajas wall,
  // which flips the modal into In-Memoriam mode.
  const [active, setActive] = useState<{ ej: Ejemplar; baja?: Baja | null } | null>(null);
  const openEjemplar = (ej: Ejemplar) => setActive({ ej });
  const openBaja = (b: Baja) => setActive({ ej: memorialEjemplar(bundle, b), baja: b });

  // Back-button / back-gesture closes overlay-like views (ejemplar modal,
  // bajas view) — same idiom as the mobile menu in Header.astro.
  useBackToClose(active !== null, () => setActive(null), 'axolodao:ejemplar-modal');
  useBackToClose(view === 'bajas', () => setView('ejemplares'), 'axolodao:bajas-view');

  // `bundle.ejemplares` is already the live roster (see the note above the
  // imports) — kept as a named binding so the downstream reads stay readable.
  const liveEjemplares = bundle.ejemplares;

  // Curated public memorial. For each visible name, prefer a curated synthetic
  // entry (so the wall shows the curated cause + biometrics even when the xlsx
  // row is missing or lacks a cause); otherwise fall back to the operativo row.
  const visibleBajas = useMemo<Baja[]>(() => {
    // The synths read a deceased specimen's LAST snapshot, which the ingest now
    // moves out of the live roster into `bajasSnapshots` — search both, or every
    // synth returns null and Goldy (who has no operativo Bajas row at all)
    // disappears from the memorial entirely.
    const snapshots = [...bundle.ejemplares, ...(bundle.bajasSnapshots ?? [])];
    const out: Baja[] = [];
    for (const nombre of BAJAS_VISIBLE_NAMES) {
      const synth = SYNTH_BAJAS[nombre]?.(snapshots) ?? null;
      if (synth) {
        out.push(synth);
        continue;
      }
      const fromData = bundle.bajas.find((b: Baja) => (b.nombre ?? '').trim() === nombre);
      if (fromData) out.push(fromData);
    }
    return out;
  }, [bundle.bajas, bundle.ejemplares, bundle.bajasSnapshots]);

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
      if (match) {
        setActive({ ej: match });
        return;
      }
      // Deep-link to a memorialized specimen (e.g. #panchita after death): fall
      // back to the Bajas wall so shareable profile links keep resolving.
      const bajaMatch = visibleBajas.find((b) => b.nombre && aliasSlug(b.nombre) === hash);
      if (bajaMatch) setActive({ ej: memorialEjemplar(bundle, bajaMatch), baja: bajaMatch });
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, [liveEjemplares, visibleBajas, bundle]);

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
          logoSvg={logoSvg}
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
          onSelect={openEjemplar}
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
          onSelect={openEjemplar}
        />
      )}

      {view === 'bajas' && (
        <BajasView
          bajas={visibleBajas}
          bundle={bundle}
          locale={locale}
          onBack={() => setView('ejemplares')}
          onSelect={openBaja}
        />
      )}

      {active && (
        <EjemplarModal
          ej={active.ej}
          bundle={bundle}
          bitacora={bitacora}
          theme={theme}
          locale={locale}
          water={water}
          waterPath={paths.waterPath}
          onClose={() => setActive(null)}
          memorial={active.baja != null}
          baja={active.baja ?? null}
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
