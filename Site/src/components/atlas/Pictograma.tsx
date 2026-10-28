import { ICONOS, TIPOS_RECINTO, FIGURAS_LEGALES } from '@/lib/atlasInstalaciones.mjs';
import { COLOR_UMA, COLOR_PIMVS, COLOR_CREMA, COLOR_MAR, COLOR_CERRADA } from './Marcadores';

export interface EtiquetasInstalaciones {
  tipo_recinto: Record<string, Record<string, string>>;
  tipo_legal: Record<string, Record<string, string>>;
  siglas: Record<string, Record<string, string>>;
}

/** The marker of a facility type as the legend and the filter chips show it: the same backing, ring and pictogram the map draws. */
export function Pictograma(p: { tipo: string; figura?: string; cerrada?: boolean; lado?: number }) {
  const r = 14, V = 2 * r + 6, c = V / 2, lado = p.lado ?? 20, esc = 20 / 24;
  const cerrada = !!p.cerrada, figura = p.figura ?? 'ninguna';
  const tinta = cerrada ? COLOR_CERRADA : COLOR_MAR;
  const fondo = cerrada ? { fill: 'none', stroke: COLOR_CERRADA, 'stroke-width': 2 }
    : { fill: COLOR_CREMA, stroke: figura === 'uma' ? COLOR_UMA : figura === 'pimvs' ? COLOR_PIMVS : COLOR_MAR, 'stroke-width': figura === 'ninguna' ? 1.2 : 3 };
  return (
    <svg class="at-pict" width={lado} height={lado} viewBox={`0 0 ${V} ${V}`} aria-hidden="true" focusable="false">
      <circle cx={c} cy={c} r={r} {...(fondo as any)} />
      <g transform={`translate(${c - 12 * esc} ${c - 12 * esc}) scale(${esc})`} fill="none" stroke={tinta} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        {((ICONOS as any)[p.tipo] ?? (ICONOS as any).otro).map((q: any) => <path d={q.d} transform={q.t ? `matrix(${q.t.join(' ')})` : undefined} />)}
      </g>
    </svg>
  );
}

/** The ring of a legal figure alone, for the legend: teal for a UMA, ochre for a PIMVS, the thin ink one for none. */
export function AnilloFigura(p: { figura: string; lado?: number }) {
  const lado = p.lado ?? 20, r = 14, V = 34, c = 17;
  const color = p.figura === 'uma' ? COLOR_UMA : p.figura === 'pimvs' ? COLOR_PIMVS : COLOR_MAR;
  return (
    <svg class="at-pict" width={lado} height={lado} viewBox={`0 0 ${V} ${V}`} aria-hidden="true" focusable="false">
      <circle cx={c} cy={c} r={r} fill={COLOR_CREMA} stroke={color} stroke-width={p.figura === 'ninguna' ? 1.2 : 3} />
    </svg>
  );
}

const nombre = (e: EtiquetasInstalaciones | null, tabla: 'tipo_recinto' | 'tipo_legal' | 'siglas', codigo: string, locale: string) => e?.[tabla]?.[codigo]?.[locale] ?? codigo;

/** What the legal figure of a group of markers is called: the acronym (a UMA of any kind, a PIMVS) or «no data on the legal figure» (the data says «no consta»). */
export const etiquetaFigura = (e: EtiquetasInstalaciones | null, figura: string, locale: string) => (figura === 'ninguna' ? nombre(e, 'tipo_legal', 'desconocido', locale) : figura === 'uma' ? 'UMA' : 'PIMVS');
export const expansionFigura = (e: EtiquetasInstalaciones | null, figura: string, locale: string) => (figura === 'uma' ? e?.siglas?.UMA?.[locale] : figura === 'pimvs' ? e?.siglas?.PIMVS?.[locale] : undefined);
export const etiquetaTipo = (e: EtiquetasInstalaciones | null, tipo: string, locale: string) => nombre(e, 'tipo_recinto', tipo, locale);
export const etiquetaLegal = (e: EtiquetasInstalaciones | null, codigo: string, locale: string) => nombre(e, 'tipo_legal', codigo, locale);

interface FiltrosProps {
  etiquetas: EtiquetasInstalaciones | null;
  locale: string;
  /** the types and the legal figures the data carries, with how many facilities each has */
  tipos: Record<string, number>;
  figuras: Record<string, number>;
  /** the ones switched off (everything is on by default) */
  ocultosTipo: Set<string>;
  ocultasFigura: Set<string>;
  onTipo: (t: string) => void;
  onFigura: (f: string) => void;
  tituloTipo: string;
  tituloFigura: string;
}

/** Two rows of chips in the facilities card: one filters by type, one by legal figure. A chip is its marker and its name; all are on by default. */
export function FiltrosInstalaciones(p: FiltrosProps) {
  const chip = (activo: boolean, onClick: () => void, icono: preact.ComponentChildren, texto: string, n: number, titulo?: string, datos?: Record<string, string>) => (
    <button type="button" class="at-chip" aria-pressed={activo ? 'true' : 'false'} title={titulo ? `${texto}: ${titulo}` : texto} {...datos} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}>
      {icono}<span>{texto}</span><small>{n}</small>
    </button>
  );
  return (
    <div class="at-chips-wrap" data-inst-filtros onClick={(e) => e.stopPropagation()}>
      <div class="at-chips" role="group" aria-label={p.tituloTipo} data-chips="tipo">
        {TIPOS_RECINTO.filter((t) => p.tipos[t]).map((t) => chip(!p.ocultosTipo.has(t), () => p.onTipo(t), <Pictograma tipo={t} lado={18} />, etiquetaTipo(p.etiquetas, t, p.locale), p.tipos[t], undefined, { 'data-tipo': t }))}
      </div>
      <div class="at-chips" role="group" aria-label={p.tituloFigura} data-chips="figura">
        {FIGURAS_LEGALES.filter((f) => p.figuras[f]).map((f) => chip(!p.ocultasFigura.has(f), () => p.onFigura(f), <AnilloFigura figura={f} lado={16} />, etiquetaFigura(p.etiquetas, f, p.locale), p.figuras[f], expansionFigura(p.etiquetas, f, p.locale), { 'data-figura': f }))}
      </div>
    </div>
  );
}
