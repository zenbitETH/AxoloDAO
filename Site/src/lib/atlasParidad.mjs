// A hub build must render exactly what a file build renders: the data read from the hub is compared, file by file and property by property, with the committed file, and any difference names the file and what differs.
// Plain ESM: src/lib/atlasSnapshot.mjs (the build) and scripts/test-atlas.mjs share it.
// Canonical text: object keys sorted, and a list of records (morphometric rows, status rows) compared as a SET (the order a route lists them in is not data); a list of numbers or arrays (a polygon's ring) keeps its order.
const canon = (x) => JSON.stringify(x, (_k, v) => {
  if (Array.isArray(v) && v.length && v.every((e) => e && typeof e === 'object' && !Array.isArray(e))) return v.map((e) => canon(e)).sort();
  return v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v;
});
const sinFuente = ({ fuente: _f, generadoDe: _g, ...resto }) => resto;
const MAX = 6;
/** The build config for strict hub builds: the ONLY metric allowed to stay the committed file's, by name (the hub carries no population figure for it; it is INEGI's). Every other metric must be «hub» or «derivado: <input>». */
export const METRICAS_ARCHIVO = ['uma_por_100k_hab'];
const fuenteAceptada = (id, f) => f === 'hub' || /^derivado: \S+/.test(String(f)) || (METRICAS_ARCHIVO.includes(id) && f === 'archivo: INEGI');

/** Two keyed collections: ids only on one side, and for each id the fields that differ. */
function porClave(a, b, clave, qué) {
  const A = new Map(a.map((x) => [clave(x), x])), B = new Map(b.map((x) => [clave(x), x]));
  const out = [];
  const soloHub = [...B.keys()].filter((k) => !A.has(k)), soloArchivo = [...A.keys()].filter((k) => !B.has(k));
  if (a.length !== b.length || A.size !== a.length || B.size !== b.length) out.push(`${qué}: the hub has ${a.length} and the committed file ${b.length}`);
  if (soloHub.length) out.push(`${qué} only in the hub: ${soloHub.slice(0, MAX).join(', ')}`);
  if (soloArchivo.length) out.push(`${qué} only in the committed file: ${soloArchivo.slice(0, MAX).join(', ')}`);
  for (const [k, x] of A) {
    const y = B.get(k); if (!y) continue;
    const campos = [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((c) => canon(x[c]) !== canon(y[c]));
    if (campos.length) out.push(`${qué} ${k}: ${campos.join(', ')} differ`);
  }
  return out;
}

/** What differs between the hub's `nombre` and the committed one (both as `instantanea` shapes). Empty when they are the same data. */
export function diferencias(nombre, hub, archivo) {
  const h = sinFuente(hub), a = sinFuente(archivo);
  let d = [];
  if (nombre === 'instalaciones-catalogadas.geojson') {
    d = porClave(h.features.map((f) => ({ id: f.properties.id, ...f.properties, __geometry: f.geometry })), a.features.map((f) => ({ id: f.properties.id, ...f.properties, __geometry: f.geometry })), (f) => f.id, 'facility');
  } else if (nombre === 'especies-por-estado.json') {
    d = porClave(Object.entries(h.estados).map(([iso, v]) => ({ iso, v })), Object.entries(a.estados).map(([iso, v]) => ({ iso, v })), (x) => x.iso, 'state');
  } else if (nombre === 'estados-metricas.json') {
    if (canon(h.metricas) !== canon(a.metricas)) d.push('the list of metrics differs');
    for (const m of a.metricas) if (!fuenteAceptada(m.id, h.fuentes?.[m.id])) d.push(`metric ${m.id}: the hub had no values and it is not derived or declared (${h.fuentes?.[m.id] ?? 'none'})`);
    d.push(...porClave(Object.entries(h.estados).map(([iso, v]) => ({ iso, ...v })), Object.entries(a.estados).map(([iso, v]) => ({ iso, ...v })), (x) => x.iso, 'state metrics'));
  } else if (nombre === 'especies-atlas.json') {
    d = [...porClave(h.especies, a.especies, (e) => e.slug, 'species'), ...porClave(h.fuentes, a.fuentes, (f) => f.key, 'source'),
      ...porClave(Object.entries(h.presencia).map(([s, v]) => ({ s, v })), Object.entries(a.presencia).map(([s, v]) => ({ s, v })), (x) => x.s, 'presence')];
  } else if (nombre === 'especies-localidades.geojson') {
    const k = (f) => `${f.properties.slug}|${f.properties.generalization}|${canon(f.geometry)}`;
    d = porClave(h.features.map((f) => ({ id: k(f), ...f.properties, __geometry: f.geometry })), a.features.map((f) => ({ id: k(f), ...f.properties, __geometry: f.geometry })), (f) => f.id, 'locality');
  } else if (nombre === 'admin1.geojson') {
    d = porClave(h.features.map((f) => ({ id: f.properties.iso, ...f.properties, __geometry: f.geometry })), a.features.map((f) => ({ id: f.properties.iso, ...f.properties, __geometry: f.geometry })), (f) => f.id, 'unit');
  } else d = [`no parity rule for ${nombre}`];
  return d;
}
