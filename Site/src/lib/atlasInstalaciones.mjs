// What kind of place a facility is, for the map: its tipo_recinto is the PICTOGRAM of its marker, and its legal figure (tipo_legal) a ring on the backing of the marker.
// Pure data and names, no drawing: the markers are drawn in the browser (components/atlas/Marcadores.ts) from the paths of iconosInstalaciones.mjs, and the legend and the filters read the same lists.
import { ICONOS } from './iconosInstalaciones.mjs';

export { ICONOS };
/** The tipo_recinto values, in the legend's order. A value the data carries and this list does not is drawn with the «otro» pictogram, never dropped. */
export const TIPOS_RECINTO = Object.keys(ICONOS);
/** The legal figures the marker tells apart: any UMA, PIMVS, and «no data» (the data says «no consta»). */
export const FIGURAS_LEGALES = ['uma', 'pimvs', 'ninguna'];

export const tipoDe = (props) => (ICONOS[props.tipo_recinto] ? props.tipo_recinto : 'otro');
export function figuraDe(props) {
  const t = String(props.tipo_legal ?? '');
  if (/^uma/.test(t)) return 'uma';
  if (t === 'pimvs') return 'pimvs';
  return 'ninguna';
}
/** The code the legal-figure labels are keyed by (etiquetas-instalaciones.json): «no consta» is «desconocido». */
export const codigoLegalDe = (props) => { const t = String(props.tipo_legal ?? ''); return !t || t === 'no consta' ? 'desconocido' : t; };
/** A closed row keeps its pictogram, greyed and on a hollow backing; open and unknown rows are drawn full. */
export const cerradaDe = (props) => props.estado_operacion === 'cerrado';

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// Screen offsets. A facility is drawn at the INEGI centroid of its municipality, so facilities of one municipality (or of two close ones) would sit on top of each other.
// They are moved on the SCREEN only: the offset is a pixel value handed to the marker layers (`icon-offset`); the GeoJSON, its coordinates and anything exported never change.

/** Facilities sharing one coordinate fan out around it: two side by side, three or more on a ring. */
export function abanico(coords) {
  const grupos = new Map();
  coords.forEach((c, i) => { const k = c.join(','); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(i); });
  const out = coords.map(() => [0, 0]);
  for (const idx of grupos.values()) {
    const n = idx.length;
    if (n === 1) continue;
    if (n === 2) { out[idx[0]] = [-17, 0]; out[idx[1]] = [17, 0]; continue; }
    const r = Math.max(22, (n * 31) / (2 * Math.PI));
    idx.forEach((i, j) => { const a = -Math.PI / 2 + (2 * Math.PI * j) / n; out[i] = [Math.round(r * Math.cos(a)), Math.round(r * Math.sin(a))]; });
  }
  return out;
}

/** Keeps markers at least `d` px apart: starts from each marker's fan-out position (anchor + fan) and pushes close pairs apart, never further than `max` px from the anchor.
 *  `anclas` are the projected screen positions of the centroids, `coords` their geographic coordinates (equal coordinates fan out first). Returns the offset of each marker from its anchor, in whole pixels. */
export function separar(anclas, coords, d = 30, max = 90, vueltas = 60) {
  const fan = abanico(coords);
  const p = anclas.map((a, i) => [a[0] + fan[i][0], a[1] + fan[i][1]]);
  for (let v = 0; v < vueltas; v++) {
    let movido = false;
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
      let dx = p[j][0] - p[i][0], dy = p[j][1] - p[i][1], dist = Math.hypot(dx, dy);
      if (dist >= d) continue;
      if (dist < 0.01) { dx = Math.cos(i + j); dy = Math.sin(i + j); dist = 1; }
      const e = (d - dist) / 2, ux = dx / dist, uy = dy / dist;
      p[i][0] -= ux * e; p[i][1] -= uy * e; p[j][0] += ux * e; p[j][1] += uy * e; movido = true;
    }
    for (let i = 0; i < p.length; i++) {
      const ox = p[i][0] - anclas[i][0], oy = p[i][1] - anclas[i][1], h = Math.hypot(ox, oy);
      if (h > max) { p[i][0] = anclas[i][0] + (ox * max) / h; p[i][1] = anclas[i][1] + (oy * max) / h; }
    }
    if (!movido) break;
  }
  return p.map((q, i) => [Math.round(q[0] - anclas[i][0]), Math.round(q[1] - anclas[i][1])]);
}

/** The features for the marker layers: the same features, each with its type, its legal figure and its screen offset in its properties. The geometry of every feature is the one it came with, untouched. */
export function prepararInstalaciones(fc, desp) {
  return { ...fc, features: fc.features.map((f, i) => ({ type: f.type, geometry: f.geometry, properties: { ...f.properties, tipo: tipoDe(f.properties), figura: figuraDe(f.properties), desp: desp[i] ?? [0, 0] } })) };
}

/** One point per place that has an open or unknown facility: the halo of a municipality is drawn once, not once per facility. */
export function lugares(fc) {
  const m = new Map();
  for (const f of fc.features) { const k = f.geometry.coordinates.join(','); if (!cerradaDe(f.properties)) m.set(k, { type: 'Feature', geometry: f.geometry, properties: {} }); }
  return { type: 'FeatureCollection', features: [...m.values()] };
}

/** The facilities that name a species in their `especies` text («A. mexicanum», «Ambystoma mexicanum»), counted once each, by the accepted name AND by every synonym the table maps to it. */
export function instalacionesDeEspecie(features, epiteto, sinonimos = {}) {
  const nombres = [epiteto, ...Object.keys(sinonimos).filter((k) => sinonimos[k] === epiteto)].map((n) => n.replace(/[^\w]/g, ''));
  const re = new RegExp(`(A\\.|Ambystoma)\\s*(${nombres.join('|')})\\b`, 'i');
  return new Set(features.filter((f) => re.test(f.properties.especies ?? '')).map((f) => f.properties.id)).size;
}
