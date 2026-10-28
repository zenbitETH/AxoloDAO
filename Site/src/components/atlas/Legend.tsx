import { useEffect, useRef } from 'preact/hooks';
import { claseDeEvidencia } from '@/lib/atlasSpecies.mjs';
import { RAMPA, RAMPA_INST, SIN_DATO } from '@/lib/atlasStyle.mjs';
import type { AtlasText } from '@/lib/atlasText';
import type { UiText } from './uiText';
import { fondoMuestra } from './IndexDrawer';
import { Pictograma, AnilloFigura, etiquetaTipo, etiquetaFigura, expansionFigura, type EtiquetasInstalaciones } from './Pictograma';
import { TIPOS_RECINTO, FIGURAS_LEGALES } from '@/lib/atlasInstalaciones.mjs';
import type { Colorear, Item } from './types';

const hexa = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
export { hexa };

interface Props {
  ui: UiText;
  text: AtlasText;
  colorear: Colorear;
  etiqueta: string;
  min: number;
  max: number;
  /** the species the map shows now, and what it carries */
  vista: Item | null;
  evidencias: string[];
  /** its range features (area or lake marker), with their source lines */
  rango: any[];
  /** the key of the colour by region: one gradient per class, from the palette */
  rampas: Record<string, string>;
  /** the shown species has locality points; its states are drawn as an outline (it has an area, a lake or a drawn cell) */
  /** the texture of the species on show (hatching, dots, cross-hatch), if its colour sits close to a neighbour's: its swatches wear it */
  trama?: 'rayas' | 'puntos' | 'cuadros';
  conPuntos: boolean;
  conAreas?: boolean;
  /** the attested named water bodies of the species shown */
  lagos?: any[];
  estadosComoLinea: boolean;
  /** the source of each point row drawn: its short citation, the page and corroboration where the point was read off a printed map */
  /** the public builds (axolodao.org, the stand) never show the «for review only» note */
  ocultarRevision?: boolean;
  fuentesPuntos: { corta: string; sitio: boolean; pagina: number | null; corroborado: string | null }[];
  instalaciones: boolean;
  /** the facility types and legal figures the data carries, and their labels (data, es en pt) */
  instTipos: string[];
  instFiguras: string[];
  etiquetasInst: EtiquetasInstalaciones | null;
  locale: string;
  abierta: boolean;
  onToggle: () => void;
}

export function Legend(p: Props) {
  const { ui } = p;
  // a ready signal for whoever reads the legend (tests included): '1' once the legend of THIS species has been committed to the page, '0' while it is being replaced
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => { const e = caja.current; if (e) e.dataset.legendReady = '1'; return () => { if (e) e.dataset.legendReady = '0'; }; });
  const sw = (bg: string, round = false) => <i class={`at-sw${round ? ' at-round' : ''}`} style={{ background: bg }} />;
  const fila = (...k: preact.ComponentChildren[]) => <div class="at-row">{k}</div>;
  const v = p.vista;
  // the source block is built from what is DRAWN: the credit of the drawn area (or lake), then each source of the drawn points once (short citation; the page and corroboration where a point was read off a printed map)
  const fuenteRango = p.rango.find((f) => f.properties.kind === 'range' && f.properties.method !== 'lake_outline');   // a lake outline carries no source line of its own: the attested lake does
  const lineas = [...new Map(p.fuentesPuntos.map((r) => [`${r.corta}|${r.pagina}`, r])).values()];
  const clases = new Set(p.evidencias.map(claseDeEvidencia));
  const area = p.rango.find((f) => f.properties.kind === 'range');
  const lago = (p.lagos ?? [])[0];
  const rampa = p.colorear === 'metrica' ? RAMPA_INST : RAMPA;
  // a state colouring is not drawn while a species is shown, so its legend waits too
  const conRampa = p.colorear !== 'ninguno' && !v;
  return (
    <div class="at-legend-wrap">
      <button type="button" class="at-legend-chip" aria-expanded={p.abierta ? 'true' : 'false'} aria-controls="at-legend" onClick={p.onToggle}>{ui.legendChip}</button>
      <div id="at-legend" ref={caja} data-legend-for={v?.slug ?? ''} data-legend-ready="0" class="at-legend" aria-label={p.text.legend} data-legend hidden={!p.abierta}>
        {conRampa && (
          <>
            <div class="at-lt">{p.etiqueta}</div>
            <div class="at-ramp">{rampa.map((c: string) => <i style={{ background: c }} />)}</div>
            <div class="at-row"><span>{p.min}</span><span style={{ marginLeft: 'auto' }}>{p.max}</span></div>
            {fila(sw(SIN_DATO), p.text.noData)}
          </>
        )}
        {v ? (
          <>
            <div class="at-lt at-spn">{v.t.scientificName}</div>
            {/* one line per thing drawn, and no two swatches alike: the area (its kind as text), the states as an outline when the species has an area, a point, a lake */}
            {area && fila(sw(p.trama ? fondoMuestra(v.accent, p.trama) : hexa(v.accent, 0.5)), area.properties.potential ? ui.legendPotential : area.properties.method === 'gbif_envelope' ? ui.legendEnvelope : area.properties.method === 'lake_outline' ? ui.legendLakeOutline : ui.legendArea)}
            {!p.ocultarRevision && area?.properties.method === 'gbif_envelope' && <div class="at-row"><span class="at-review">{ui.legendReviewOnly}</span></div>}
            {p.estadosComoLinea ? (
              <>
                {clases.has('strong') && fila(<i class="at-sw at-line" style={{ borderColor: v.accent }} />, ui.legendPresent)}
                {clases.has('weak') && fila(<i class="at-sw at-line" style={{ borderColor: v.accent, borderTopStyle: 'dashed' }} />, ui.legendWeak)}
                {clases.has('other') && fila(<i class="at-sw at-line" style={{ borderColor: hexa(v.accent, 0.5), borderTopStyle: 'dotted' }} />, ui.legendOther)}
              </>
            ) : (
              <>
                {clases.has('strong') && fila(sw(hexa(v.accent, 0.55)), ui.legendPresent)}
                {clases.has('weak') && fila(sw(`repeating-linear-gradient(135deg, ${v.accent} 0 2px, #06171e 2px 4px)`), ui.legendWeak)}
                {clases.has('other') && fila(sw(hexa(v.accent, 0.38)), ui.legendOther)}
              </>
            )}
            {p.conPuntos && fila(sw(p.trama ? fondoMuestra(v.accent, p.trama) : v.accent, true), ui.legendLocality)}
            {p.conAreas && fila(<i class="at-sw at-ringed" style={{ background: p.trama ? fondoMuestra(v.accent, p.trama) : hexa(v.accent, 0.5), borderColor: v.accent }} />, ui.legendCellsArea)}
            {lago && fila(<i class="at-sw at-round at-ringed" style={{ background: v.accent }} />, `${ui.legendLocalityCited}: ${lago.properties.name}`)}
            {((fuenteRango?.properties.fuentes?.length ?? 0) > 0 || lineas.length > 0) && (
              <div class="at-src" data-range-source>
                <div class="at-lt">{(fuenteRango?.properties.fuentes?.length ?? 0) > 0 ? (lineas.length > 0 ? ui.sourcesBoth : ui.rangeSource) : ui.sourcesPoints}</div>
                {(fuenteRango?.properties.fuentes ?? []).map((f: any) => <p><b>{f.name}</b><br />{f.credit}</p>)}
                {lineas.map((r) => <p data-fuente-punto><b>{r.corta}</b>{r.pagina && !r.corta.includes(`p. ${r.pagina}`) ? `, p. ${r.pagina}` : ''}</p>)}
              </div>
            )}
          </>
        ) : (p.colorear === 'ninguno' && (
          <>
            {fila(sw(p.rampas.ca), ui.legendGeoCA)}
            {fila(sw(p.rampas.us), ui.legendGeoUS)}
            {fila(sw(p.rampas.mx), ui.legendGeoMX)}
            {fila(sw(p.rampas.tres), ui.legendGeoAll)}
          </>
        ))}
        {p.instalaciones && TIPOS_RECINTO.filter((t) => p.instTipos.includes(t)).map((t) => fila(<Pictograma tipo={t} lado={20} />, etiquetaTipo(p.etiquetasInst, t, p.locale)))}
        {p.instalaciones && FIGURAS_LEGALES.filter((f) => p.instFiguras.includes(f)).map((f) => { const expl = expansionFigura(p.etiquetasInst, f, p.locale); return <div class={expl ? 'at-row at-row-expl' : 'at-row'} data-figura={f} tabIndex={expl ? 0 : undefined} title={expl}><AnilloFigura figura={f} lado={20} />{etiquetaFigura(p.etiquetasInst, f, p.locale)}{expl && <span class="at-expl">{expl}</span>}</div>; })}
        {p.instalaciones && fila(<Pictograma tipo="otro" cerrada lado={20} />, ui.closedAt)}
      </div>
    </div>
  );
}
