// The atlas data the build carries: read from the hub at build time, with the committed files as the fallback. Plain ESM, so the build
// endpoint (src/pages/atlas/datos/[archivo].ts) and scripts/test-atlas.mjs share it.
//
// Three files, each with its own fallback: a file the hub cannot give in full, or gives in a shape that fails a check, is the committed one.
//   especies-por-estado.json            the hub layer `especies-por-estado` (PACE 2018 presence, names only)
//   estados-metricas.json               the committed metric list, each metric's values from /v1/states/metrics?key= when the hub has it
//   instalaciones-catalogadas.geojson   the hub layer `instalaciones-catalogadas`, every point an INEGI centroid of the committed table
//   admin1.geojson, especies-atlas.json, especies-localidades.geojson   the genus atlas, from /v1/admin1.geojson and /v1/species (src/lib/atlasGenus.mjs)
// Every answer says where it came from (`fuente`: `hub` or `archivo`, and per metric in `fuentes`). The layer cards (titles, notes,
// licences) stay in public/atlas/layers/manifest.json: their wording is the site's, not the hub's.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { capasDelRegistro, desenvolver, getJson } from './hubLive.mjs';
import { admin1DelHub, genusDelHub } from './atlasGenus.mjs';
import { diferencias, METRICAS_ARCHIVO } from './atlasParidad.mjs';

/** The hub names a source by its key on every row, but gives the source's title only where a species, a profile, a measurement or a presence row is its own (a status row carries the key and a citation, no title). Every key the hub's rows cite
 *  that the hub did not name is named from the committed file, which has the title the page prints, so a hub build prints what a file build prints. A key the committed file does not have stays unnamed (the build's parity check then fails). */
export function completarFuentes(g, comprometidas) {
  const citadas = new Set();
  for (const e of g.atlas.especies) { for (const k of [e.source, e.profile?.source, ...e.categories.map((c) => c.source), ...e.morphometrics.map((m) => m.source)]) if (k) citadas.add(k); }
  for (const filas of Object.values(g.atlas.presencia)) for (const f of filas) if (f[2]) citadas.add(f[2]);
  for (const f of g.localidades.features) if (f.properties.sourceKey) citadas.add(f.properties.sourceKey);
  const delArchivo = new Map(comprometidas.map((f) => [f.key, f]));
  const nombradas = [], completadas = [];
  const fuentes = g.atlas.fuentes.map((f) => {
    const c = delArchivo.get(f.key);
    // the hub names a source by key, title and citation; the publisher and the address (printed in the Fuentes tab) it does not serve yet: they come from the committed file, by key, only where the hub has none
    if (c && ((!f.publisher && c.publisher) || (!f.url && c.url))) { completadas.push(f.key); return { ...f, publisher: f.publisher ?? c.publisher ?? null, url: f.url ?? c.url ?? null }; }
    return f;
  });
  const tiene = new Set(fuentes.map((f) => f.key));
  for (const f of comprometidas) if (citadas.has(f.key) && !tiene.has(f.key)) { fuentes.push(f); nombradas.push(f.key); }
  fuentes.sort((a, b) => a.key.localeCompare(b.key));
  return { ...g, atlas: { ...g.atlas, fuentes }, completadas: { nombradas, completadas } };
}
/** The hub gave a file in full and it differs from the committed one: a strict build stops with this, never falls back. */
export class ErrorDeParidad extends Error {}
export const ARCHIVOS = ['especies-por-estado.json', 'estados-metricas.json', 'instalaciones-catalogadas.geojson', 'especies-atlas.json', 'especies-localidades.geojson', 'admin1.geojson'];
/** The genus files come from the hub's /v1/species and /v1/admin1 routes (src/lib/atlasGenus.mjs); the committed files are the fallback, written by
 *  scripts/import-atlas-species.mjs from Site & Data's bundles. The two species files share one read of the routes. */
const GENUS = ['especies-atlas.json', 'especies-localidades.geojson'];
const lecturas = new WeakMap();
const unaVez = (fetchFn, clave, f) => {
  const delFetch = lecturas.get(fetchFn) ?? lecturas.set(fetchFn, new Map()).get(fetchFn);
  if (!delFetch.has(clave)) delFetch.set(clave, f());
  return delFetch.get(clave);
};
/** The properties a facility may carry: the list scripts/import-atlas-layers.mjs writes, and nothing else. */
export const PERMITIDAS = ['id', 'nombre', 'tipo_recinto', 'tipo_legal', 'tipo_legal_fuente', 'iso', 'cve_ent', 'cve_mun', 'municipio', 'estado', 'nivel', 'especies',
  'exhibicion_publica', 'estado_operacion', 'estado_fecha', 'verificacion'];
const ISO = /^MX-[A-Z]{3}$/;
const DECIMAL = /^-?\d+(\.\d+)?$/;
const base = (hubUrl) => hubUrl.replace(/\/$/, '');

/** A layer's GeoJSON from the hub, only if its bytes are the ones the list pins and its features carry only the properties the list names. */
export async function capaVerificada(hubUrl, slug, { ms = 15000, fetchFn = globalThis.fetch } = {}) {
  const capa = (await capasDelRegistro(hubUrl, { ms, fetchFn })).find((l) => l.slug === slug);
  if (!capa) throw new Error(`the hub does not serve ${slug}`);
  if (typeof capa.geojson !== 'string' || !capa.geojson.startsWith('/v1/layers/')) throw new Error(`${slug}: no GeoJSON path under /v1/layers/`);
  if (!/^0x[0-9a-f]{64}$/.test(capa.geojsonSha256 ?? '') || !Array.isArray(capa.properties)) throw new Error(`${slug}: no geojsonSha256 or properties`);
  const ctl = new AbortController();
  const reloj = setTimeout(() => ctl.abort(), ms);
  let cuerpo;
  try {
    const r = await fetchFn(`${base(hubUrl)}${capa.geojson}`, { signal: ctl.signal });
    if (!r.ok) throw new Error(`${slug}: ${r.status}`);
    cuerpo = await r.text();
  } finally {
    clearTimeout(reloj);
  }
  if (`0x${createHash('sha256').update(cuerpo, 'utf8').digest('hex')}` !== capa.geojsonSha256) throw new Error(`${slug}: the bytes are not the ones the list pins`);
  const fc = JSON.parse(cuerpo);
  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features) || Object.keys(fc).some((k) => k !== 'type' && k !== 'features')) throw new Error(`${slug}: not a plain FeatureCollection`);
  const declaradas = new Set(capa.properties);
  for (const f of fc.features) for (const k of Object.keys(f.properties ?? {})) if (!declaradas.has(k)) throw new Error(`${slug}: property ${k} is not declared`);
  return fc;
}

/** One metric per state from the hub: `{ 'MX-CMX': 56, ... }`, or null when the hub has no rows for it. */
export async function metricaDelHub(hubUrl, key, { ms = 15000, fetchFn = globalThis.fetch } = {}) {
  const d = desenvolver(await getJson(`${base(hubUrl)}/v1/states/metrics?key=${encodeURIComponent(key)}`, ms, fetchFn));
  if (!d || d.key !== key || !Array.isArray(d.states)) throw new Error(`${key}: not a StateMetrics answer`);
  if (!d.states.length) return null;
  const out = {};
  for (const s of d.states) {
    if (!ISO.test(s.state ?? '') || typeof s.value !== 'string' || !DECIMAL.test(s.value) || s.state in out) throw new Error(`${key}: a row out of shape`);
    out[s.state] = Number(s.value);
  }
  return out;
}

const leerCsv = (texto) => {
  const [cab, ...filas] = texto.trim().split('\n');
  const cols = cab.split(',');
  return filas.map((l) => {
    const out = []; let cur = '', q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur);
    return Object.fromEntries(cols.map((c, i) => [c, out[i]]));
  });
};

/** The committed files and the INEGI centroid table, read from the site. */
export function archivosDelSitio(raiz) {
  const leer = (p) => JSON.parse(readFileSync(join(raiz, p), 'utf8'));
  const centroides = new Map(leerCsv(readFileSync(join(raiz, 'scripts/fixtures/centroides-inegi.csv'), 'utf8')).map((r) => [`${r.cve_ent}|${r.cve_mun}`, r]));
  return {
    centroides,
    archivo: Object.fromEntries(ARCHIVOS.map((a) => [a, leer(`src/data/atlas-snapshot/${a}`)])),
  };
}

/** A feature as exactly {type, properties, geometry}: whatever else the hub's JSON carries (id, bbox, foreign members) never reaches the page. */
const soloFeature = (f) => ({ type: 'Feature', properties: f.properties, geometry: f.geometry });

function instalacionesValidas(fc, centroides) {
  for (const f of fc.features) {
    const p = f.properties ?? {};
    if (Object.keys(p).some((k) => !PERMITIDAS.includes(k))) return false;
    const c = centroides.get(`${p.cve_ent}|${p.cve_mun ?? ''}`);
    if (f.geometry?.type !== 'Point' || !c || f.geometry.coordinates[0] !== Number(c.lon) || f.geometry.coordinates[1] !== Number(c.lat)) return false;
    if (p.nivel !== (p.cve_mun ? 'municipio' : 'estado')) return false;
  }
  return fc.features.length > 0;
}

/**
 * The file the build writes for `nombre`: from the hub when it gives it in full and every check passes, else the committed one.
 * `aviso` (optional) is told why a file fell back, for the build log.
 */
export async function instantanea(nombre, { hubUrl, sitio, fetchFn = globalThis.fetch, aviso = (_porque) => {}, estricto = false }) {
  const comprometido = sitio.archivo[nombre];
  if (!comprometido) throw new Error(`no snapshot file ${nombre}`);
  // strict (a build with a hub URL): a file that falls back to the committed one stops the build and says which file and why; a file the hub gave in full must also EQUAL the committed one, property by property
  const sinBundles = (gd) => { if (!gd) return gd; const { bundles: _b, ...resto } = gd; return resto; };   // `bundles` is a claim the strict comparison makes; a committed file carries it, a served object only after the comparison passed
  const respaldo = (porque) => { if (hubUrl && estricto) throw new Error(`${nombre}: the hub read fell back to the committed file (${porque})`); if (hubUrl) aviso(`${nombre}: the committed file (${porque})`); const { paridadHub: _ajeno, generadoDe, ...propio } = comprometido; return { ...propio, ...(generadoDe ? { generadoDe: sinBundles(generadoDe) } : {}), fuente: 'archivo' }; };   // a fallback never carries a parity claim, whatever the committed file holds
  const verificado = (datos) => {
    let paridad = false;
    if (estricto) { const d = diferencias(nombre, datos, comprometido); if (d.length) throw new ErrorDeParidad(`${nombre}: the hub's data is not the committed file's: ${d.slice(0, 6).join('; ')}`); paridad = datos.fuente === 'hub'; }
    const { paridadHub: _ajeno, generadoDe: _propio, ...limpio } = datos;
    const gd = comprometido.generadoDe;
    const generadoDe = gd ? { ...sinBundles(gd), ...(datos.fuente === 'hub' ? { origen: 'hub de Zenbit System' } : {}), ...(paridad && gd.bundles ? { bundles: gd.bundles } : {}) } : null;
    return { ...limpio, ...(generadoDe ? { generadoDe } : {}), ...(paridad ? { paridadHub: true } : {}) };   // the provenance (the committed bundles with the manifest hashes the attestation covers) and paridadHub are stamped here and nowhere else
  };
  if (!hubUrl) return respaldo('no hub');
  try {
    if (nombre === 'admin1.geojson') {
      const fc = await unaVez(fetchFn, `admin1|${hubUrl}`, () => admin1DelHub(hubUrl, { fetchFn }));
      return verificado({ ...fc, fuente: 'hub' });
    }
    if (GENUS.includes(nombre)) {
      const g = await unaVez(fetchFn, `genus|${hubUrl}`, async () => completarFuentes(await genusDelHub(hubUrl, { fetchFn, unidades: new Set(sitio.archivo['admin1.geojson'].features.map((f) => f.properties.iso)) }), sitio.archivo['especies-atlas.json'].fuentes));
      if (nombre === 'especies-atlas.json' && (g.completadas.nombradas.length || g.completadas.completadas.length)) aviso(`${nombre}: ${g.completadas.nombradas.length} sources only the status rows cite (${g.completadas.nombradas.join(', ')}) are named, and ${g.completadas.completadas.length} sources get their publisher and address, from the committed file (the hub does not serve them yet)`);
      return verificado({ ...(nombre === 'especies-atlas.json' ? g.atlas : g.localidades), fuente: 'hub' });
    }
    if (nombre === 'especies-por-estado.json') {
      const fc = await capaVerificada(hubUrl, 'especies-por-estado', { fetchFn });
      const estados = {};
      for (const f of fc.features) {
        const { iso, especies } = f.properties ?? {};
        if (!ISO.test(iso ?? '') || !Array.isArray(especies) || !especies.every((e) => typeof e === 'string') || iso in estados) throw new Error('a state out of shape');
        estados[iso] = [...especies].sort();
      }
      if (!Object.keys(estados).length) throw new Error('no states');
      return verificado({ source: comprometido.source, estados: Object.fromEntries(Object.entries(estados).sort()), fuente: 'hub' });
    }
    if (nombre === 'instalaciones-catalogadas.geojson') {
      const fc = await capaVerificada(hubUrl, 'instalaciones-catalogadas', { fetchFn });
      if (!instalacionesValidas(fc, sitio.centroides)) throw new Error('a facility off an INEGI centroid or with an undeclared property');
      return verificado({ type: 'FeatureCollection', features: fc.features.map(soloFeature), fuente: 'hub' });
    }
    // estados-metricas.json: the committed list of metrics; each metric's values from the hub when it has them
    const estados = structuredClone(comprometido.estados);
    const fuentes = {};
    // a metric the hub does not serve is, in a strict build, DERIVED at build from hub-read inputs (named in its fuente) or the one declared committed metric
    const entrada = async (archivo) => { const d = await instantanea(archivo, { hubUrl, sitio, fetchFn, estricto, aviso }); return d.fuente === 'hub' ? d : null; };
    const DERIVADAS = {
      especies_ambystoma_pace: { de: 'especies-por-estado.json', valores: (d) => Object.fromEntries(Object.entries(d.estados).map(([iso, especies]) => [iso, especies.length])) },
      instalaciones_ajolote: { de: 'instalaciones-catalogadas.geojson', valores: (d) => { const c = {}; for (const f of d.features) c[f.properties.iso] = (c[f.properties.iso] ?? 0) + 1; return c; } },
    };
    for (const m of comprometido.metricas) {
      let delHub = null;
      try { delHub = await metricaDelHub(hubUrl, m.id, { fetchFn }); } catch (e) { aviso(`${nombre}: ${m.id} from the committed file (${e.message})`); }
      if (delHub && Object.keys(delHub).every((iso) => iso in estados)) {
        for (const iso of Object.keys(estados)) estados[iso][m.id] = iso in delHub ? delHub[iso] : null;
        fuentes[m.id] = 'hub';
        continue;
      }
      const der = estricto ? DERIVADAS[m.id] : null;
      const insumo = der ? await entrada(der.de).catch(() => null) : null;
      if (der && insumo) {
        const v = der.valores(insumo);
        for (const iso of Object.keys(estados)) estados[iso][m.id] = v[iso] ?? 0;
        fuentes[m.id] = `derivado: ${der.de}`;
      } else fuentes[m.id] = estricto && METRICAS_ARCHIVO.includes(m.id) ? 'archivo: INEGI' : 'archivo';
    }
    const algunaDelHub = Object.values(fuentes).some((f) => f === 'hub' || f.startsWith('derivado'));
    if (estricto && !algunaDelHub) throw new ErrorDeParidad(`${nombre}: no metric came from the hub or was derived from it (a strict build never returns this file from the committed one)`);
    return verificado({ metricas: comprometido.metricas, estados, fuentes, fuente: algunaDelHub ? 'hub' : 'archivo' });
  } catch (e) {
    if (e instanceof ErrorDeParidad) throw e;
    return respaldo(e.message);
  }
}
