import { IUCN_GROUPS } from '@/components/species/strings';
import { Grip } from './Grip';
import { MarcaEspecie } from './EspecieChip';
import { fondoMuestra, type Trama } from './muestra';
import { CapIcons, CapLegend, type Capacidades } from './CapIcons';
import type { UiText } from './uiText';
import type { Item, Locale, Snap } from './types';

export type Agrupar = 'pais' | 'iucn' | 'az';
export type { Trama };
export { fondoMuestra };

interface Props {
  ui: UiText;
  locale: Locale;
  items: Item[];
  /** the species the filters leave, in order */
  lista: Item[];
  especie: string | null;
  preview: string | null;
  q: string;
  iucn: string | null;
  grupo: Agrupar;
  estadoNombre: string | null;
  /** the iso of the chosen unit: its country picks the division word (estado, provincia) */
  estadoIso: string | null;
  filtrosAbiertos: boolean;
  snap: Snap;
  phone: boolean;
  /** richness colours the states (B2): off by default */
  riqueza: boolean;
  onRiqueza: () => void;
  /** map layers that live in the species list (state boundaries, rivers and lakes): off by default */
  capas: { id: string; label: string; checked: boolean }[];
  onCapa: (id: string) => void;
  onQ: (q: string) => void;
  onIucn: (k: string | null) => void;
  onGrupo: (g: Agrupar) => void;
  onQuitarEstado: () => void;
  onFiltros: () => void;
  onPreview: (slug: string | null) => void;
  onPick: (slug: string) => void;
  onTap: (slug: string) => void;
  onSnap: (s: Snap) => void;
  onClose: () => void;
  /** the panel has two tabs: the species and the facilities (the layers); the body of the second comes from the HUD cards */
  panel: 'especies' | 'instalaciones';
  onPanel: (t: 'especies' | 'instalaciones') => void;
  tituloInstalaciones: string;
  cuerpoInstalaciones: preact.ComponentChildren;
  /** what each species can do (read from its grid traits) and the texture of the species whose colour sits close to a neighbour's */
  capacidades: Record<string, Capacidades>;
  tramas: Record<string, Trama>;
}

export function agrupar(lista: Item[], grupo: Agrupar, ui: UiText, locale: Locale): [string, Item[]][] {
  if (grupo === 'az') return [['A–Z', lista]];
  if (grupo === 'iucn') return IUCN_GROUPS.map((g) => [`${g.labels[locale]} · ${g.codes.join(' ')}`, lista.filter((s) => (g.codes as readonly string[]).includes(s.iucn ?? ''))] as [string, Item[]]).filter(([, l]) => l.length);
  // México; Estados Unidos (US only); Estados Unidos y Canadá; México, Estados Unidos y Canadá. A–Z inside each (the list arrives sorted).
  const mx = lista.filter((s) => s.countries.length === 1 && s.countries[0] === 'MX');
  const us = lista.filter((s) => s.countries.length === 1 && s.countries[0] === 'US');
  const na = lista.filter((s) => !s.countries.includes('MX') && s.countries.length > 1);
  const ambos = lista.filter((s) => s.countries.includes('MX') && s.countries.length > 1);
  return ([[ui.groupMX, mx], [ui.groupUS, us], [ui.groupNA, na], [ui.groupBoth, ambos]] as [string, Item[]][]).filter(([, l]) => l.length);
}

export function IndexDrawer(p: Props) {
  const { ui } = p;
  const n = p.lista.length === p.items.length ? String(p.items.length) : `${p.lista.length} ${ui.ofTotal} ${p.items.length}`;
  // the two tabs are one tab stop: arrows, Home and End move between them (and select, as the tabs have no cost to open)
  const PESTANAS = ['especies', 'instalaciones'] as const;
  const alTecla = (e: KeyboardEvent) => {
    const i = PESTANAS.indexOf(p.panel as (typeof PESTANAS)[number]);
    const j = e.key === 'ArrowRight' ? (i + 1) % PESTANAS.length : e.key === 'ArrowLeft' ? (i - 1 + PESTANAS.length) % PESTANAS.length : e.key === 'Home' ? 0 : e.key === 'End' ? PESTANAS.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault(); p.onPanel(PESTANAS[j]);
    requestAnimationFrame(() => document.getElementById(`ptab-${PESTANAS[j]}`)?.focus());
  };
  const fila = (s: Item) => {
    let tipo = '';
    return (
      <button type="button" class="at-srow" data-slug={s.slug} data-species-row={s.slug} data-accent={s.accent} aria-current={p.especie === s.slug ? 'true' : undefined} data-preview={p.preview === s.slug ? '1' : '0'} style={{ color: s.accent }}
        onMouseEnter={() => p.onPreview(s.slug)} onFocus={() => p.onPreview(s.slug)} onMouseLeave={() => p.onPreview(null)} onBlur={() => p.onPreview(null)}
        onPointerDown={(e) => { tipo = e.pointerType; }}
        onClick={() => (tipo === 'touch' || (p.phone && tipo !== 'mouse') ? p.onTap(s.slug) : p.onPick(s.slug))}>
        <MarcaEspecie e={{ slug: s.slug, accent: s.accent, trama: p.tramas[s.slug], iucn: s.iucn }} tituloBadge={ui.systems.iucn} extra={p.capacidades[s.slug] && <CapIcons c={p.capacidades[s.slug]} ui={ui} />} />
      </button>
    );
  };
  return (
    <aside id="at-indice" class="at-drawer at-left" role="dialog" aria-label={ui.indexOpen} data-snap={p.snap} data-drawer="indice">
      <Grip label={ui.sheetGrip} snap={p.snap} onSnap={p.onSnap} onClose={p.onClose} />
      <header class="at-dh at-ph">
        <div class="at-ptabs" role="tablist" aria-label={ui.panelTabs} onKeyDown={alTecla}>
          <button type="button" role="tab" id="ptab-especies" class="at-ptab" data-group-btn="especies" tabIndex={p.panel === 'especies' ? 0 : -1} aria-selected={p.panel === 'especies' ? 'true' : 'false'} aria-controls="at-pbody" onClick={() => p.onPanel('especies')}>{ui.hudSpecies} <b>{n}</b></button>
          <button type="button" role="tab" id="ptab-instalaciones" class="at-ptab" data-group-btn="instalaciones" tabIndex={p.panel === 'instalaciones' ? 0 : -1} aria-selected={p.panel === 'instalaciones' ? 'true' : 'false'} aria-controls="at-pbody" onClick={() => p.onPanel('instalaciones')}>{p.tituloInstalaciones}</button>
        </div>
        <button type="button" class="at-x" data-close="indice" aria-label={ui.indexClose} onClick={p.onClose}>×</button>
      </header>
      <div id="at-pbody" class="at-pbody" role="tabpanel" aria-labelledby={`ptab-${p.panel}`}>
      {p.panel === 'instalaciones' ? p.cuerpoInstalaciones : (<>
      <div class="at-dtools">
        <div class="at-ctls" role="group" aria-label={ui.hud}>
          <label class="at-ctl"><input type="checkbox" role="switch" data-richness aria-checked={p.riqueza ? 'true' : 'false'} checked={p.riqueza} onChange={p.onRiqueza} /><i aria-hidden="true" /><span>{ui.richnessToggle}</span></label>
          {p.capas.map((c) => <label class="at-ctl"><input type="checkbox" role="switch" data-capa={c.id} aria-checked={c.checked ? 'true' : 'false'} checked={c.checked} onChange={() => p.onCapa(c.id)} /><i aria-hidden="true" /><span>{c.label}</span></label>)}
        </div>
        <div class="at-qrow">
          <input class="at-q" type="search" placeholder={ui.search} aria-label={ui.searchAria} autocomplete="off" value={p.q} onInput={(e) => p.onQ((e.target as HTMLInputElement).value)} />
          <button type="button" class="at-chip at-filtros-btn" aria-expanded={p.filtrosAbiertos ? 'true' : 'false'} aria-controls="at-filtros" onClick={p.onFiltros}>{ui.filters}</button>
        </div>
        <div id="at-filtros" class={`at-filtros${p.filtrosAbiertos ? ' at-open' : ''}`}>
          <div class="at-segrow">
          <div class="at-seg" role="group" aria-label={ui.groupBy}>
            {([['pais', ui.byCountry], ['iucn', ui.byStatus], ['az', ui.byName]] as [Agrupar, string][]).map(([k, t]) => <button type="button" data-g={k} aria-pressed={p.grupo === k ? 'true' : 'false'} onClick={() => p.onGrupo(k)}>{t}</button>)}
          </div>
            <CapLegend ui={ui} />
          </div>
          {p.grupo === 'iucn' && (
          <div class="at-chips" data-pills role="group" aria-label={ui.iucnGroup}>
            <button type="button" class="at-chip" aria-pressed={p.iucn === null ? 'true' : 'false'} onClick={() => p.onIucn(null)}>{ui.all} {p.items.length}</button>
            {IUCN_GROUPS.map((g) => (
              <button type="button" class="at-chip" aria-pressed={p.iucn === g.key ? 'true' : 'false'} style={p.iucn === g.key ? { color: g.color } : undefined} onClick={() => p.onIucn(p.iucn === g.key ? null : g.key)}>
                {g.labels[p.locale]} {p.items.filter((s) => (g.codes as readonly string[]).includes(s.iucn ?? '')).length}
              </button>
            ))}
          </div>
          )}
        </div>
        {p.estadoNombre && <p class="at-estado-chip" data-estado-chip><span>{p.estadoNombre}<button type="button" class="at-x" style={{ width: '22px', height: '22px', fontSize: '15px' }} aria-label={p.estadoIso?.startsWith('CA') ? ui.removeStateCA : ui.removeState} onClick={p.onQuitarEstado}>×</button></span></p>}
      </div>
      <div class="at-rows" data-rows>
        {!p.lista.length && <p class="at-none">{ui.noMatch}</p>}
        {agrupar(p.lista, p.grupo, ui, p.locale).map(([t, l]) => (
          <section class="at-grp"><h3><span>{t}</span><span>{l.length}</span></h3><div class="at-grid">{l.map(fila)}</div></section>
        ))}
      </div>
      </>)}
      </div>
    </aside>
  );
}
