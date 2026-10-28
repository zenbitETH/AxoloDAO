// The genus atlas's data from the hub's routes (feat/hub-taxa-na), checked, in the shape the committed snapshot has
// (src/data/atlas-snapshot/especies-atlas.json, especies-localidades.geojson, admin1.geojson; scripts/import-atlas-species.mjs writes those from Site & Data's bundles).
// Anything that does not check out throws; src/lib/atlasSnapshot.mjs then falls back to the committed files, so a bad hub never reaches the page.
import { createHash } from 'node:crypto';
import { desenvolver, getJson } from './hubLive.mjs';
import { categoriaVisible, validarLocalidades } from './atlasSpecies.mjs';

const SLUG = /^[a-z0-9_-]{1,64}$/;
const SISTEMAS = new Set(['iucn', 'nom059', 'proy_nom059_2025', 'natureserve', 'cosewic', 'sara', 'esa']);
const ISO = /^(MX|US|CA)-[A-Z0-9]{2,3}$/;
const EVIDENCIAS = new Set(['present', 'historical', 'extirpated', 'introduced', 'weak', 'literature']);
const base = (hubUrl) => hubUrl.replace(/\/$/, '');
const corto = (slug) => slug.replace(/^ambystoma_/, '');
const CLAVE = /^[a-z0-9][a-z0-9._-]{0,120}$/;
export const ADMIN1_TOPE = 300 * 1024;

async function texto(url, { ms, fetchFn }) {
  const ctl = new AbortController();
  const reloj = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetchFn(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return { cuerpo: await r.text(), etag: r.headers.get('etag') };
  } finally { clearTimeout(reloj); }
}
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

/** Each feature's geometry exactly as the hub stored it (it never re-serializes it), by scanning the braces: the geometry's own bytes AND the JSON whitespace (space, tab, newline, return) between its closing brace and the feature's closing brace.
 *  The hub pins the stored bytes, which end with a newline, so those are the bytes hashed. Any other byte after the geometry (a comma and another key, text) is not a stored geometry: it throws. */
export function geometriasCrudas(cuerpo) {
  const out = [];
  let desde = 0;
  for (;;) {
    const i = cuerpo.indexOf('"geometry":', desde);
    if (i === -1) break;
    let j = cuerpo.indexOf('{', i);
    const inicio = j;
    let prof = 0;
    for (; j < cuerpo.length; j++) { const c = cuerpo[j]; if (c === '{') prof++; else if (c === '}' && --prof === 0) break; }
    let k = j + 1;
    while (k < cuerpo.length && ' \t\n\r'.includes(cuerpo[k])) k++;
    if (cuerpo[k] !== '}') throw new Error('admin1: unexpected bytes after a geometry');
    out.push(cuerpo.slice(inicio, k));
    desde = k;
  }
  return out;
}

/** /v1/admin1.geojson, whole and verified: the ETag is the body's sha256, and each geometry's own sha256 is the one /v1/admin1 lists. */
export async function admin1DelHub(hubUrl, { ms = 20000, fetchFn = globalThis.fetch, entidades = null } = {}) {
  const { cuerpo, etag } = await texto(`${base(hubUrl)}/v1/admin1.geojson`, { ms, fetchFn });
  if (Buffer.byteLength(cuerpo) > ADMIN1_TOPE * 4) throw new Error('admin1: the body is far over the size the page budgets for');
  const esperado = (etag ?? '').replace(/^W\//, '').replace(/"/g, '').replace(/^0x/, '');
  if (!esperado || esperado !== sha(cuerpo)) throw new Error('admin1: the ETag is not the body\'s sha256');
  const fc = JSON.parse(cuerpo);
  const lista = desenvolver(await getJson(`${base(hubUrl)}/v1/admin1`, ms, fetchFn));
  if (!Array.isArray(fc.features) || !Array.isArray(lista) || fc.features.length !== lista.length) throw new Error('admin1: the list and the geometry disagree');
  const shas = new Map(lista.map((u) => [u.iso, String(u.geometrySha256).replace(/^0x/, '')]));
  const crudas = geometriasCrudas(cuerpo);
  if (crudas.length !== fc.features.length) throw new Error('admin1: could not read every geometry');
  const props = (f) => f.properties ?? {};
  fc.features.forEach((f, n) => {
    const p = props(f);
    if (!ISO.test(p.iso ?? '') || p.country !== p.iso.slice(0, 2) || !p.nameEs || !p.nameEn) throw new Error(`admin1: a unit out of shape (${p.iso})`);
    if (!['Polygon', 'MultiPolygon'].includes(f.geometry?.type)) throw new Error(`admin1: ${p.iso} is not a polygon`);
    if (shas.get(p.iso) !== sha(crudas[n])) throw new Error(`admin1: ${p.iso}'s geometry is not the bytes the list pins`);
  });
  const isos = fc.features.map((f) => f.properties.iso);
  const cuenta = (c) => fc.features.filter((f) => f.properties.country === c).length;
  if (new Set(isos).size !== isos.length || cuenta('MX') !== 32 || cuenta('US') !== 51 || cuenta('CA') !== 13) throw new Error('admin1: expected 96 unique units (MX 32, US 51, CA 13)');
  if (entidades && ![...entidades].every((i) => isos.includes(i))) throw new Error('admin1: a Mexican state of the INEGI table is missing');
  return { type: 'FeatureCollection', features: fc.features.map((f) => ({ type: 'Feature', properties: { iso: f.properties.iso, country: f.properties.country, nameEs: f.properties.nameEs, nameEn: f.properties.nameEn, inegiCve: f.properties.inegiCve ?? null }, geometry: f.geometry })) };
}

/** The species routes, put into the committed snapshot's two files. `unidades` (optional) is the set of the 96 admin-1 keys a presence row may name. */
export async function genusDelHub(hubUrl, { ms = 15000, fetchFn = globalThis.fetch, unidades = null } = {}) {
  const raiz = base(hubUrl);
  const lista = desenvolver(await getJson(`${raiz}/v1/species`, ms, fetchFn));
  if (!Array.isArray(lista) || lista.length === 0) throw new Error('species: an empty or malformed list');
  const fuentes = new Map();
  // a source is named by the hub's stable key (the stored sourceKey); one that has none is not one this build can cite, so the whole read falls back
  const anotar = (fuente, licencia) => {
    if (!fuente) return null;
    const k = fuente.key;
    if (typeof k !== 'string' || !CLAVE.test(k) || !fuente.title) throw new Error('a source without a stable key or a title');
    if (!fuentes.has(k)) fuentes.set(k, { key: k, title: fuente.title, publisher: fuente.publisher ?? null, url: fuente.url ?? null, citation: fuente.citation ?? null, licence: licencia?.spdx ?? null, citeOnly: licencia?.commercialOk === false });
    return k;
  };
  const especies = [], presencia = {}, features = [];
  const una = async (resumen) => {
    if (!SLUG.test(resumen?.slug ?? '') || typeof resumen.scientificName !== 'string') throw new Error('species: a taxon out of shape');
    const slugLargo = resumen.slug, slug = corto(slugLargo);
    const [d, p, l] = await Promise.all([
      getJson(`${raiz}/v1/species/${slugLargo}`, ms, fetchFn).then(desenvolver),
      getJson(`${raiz}/v1/species/${slugLargo}/presence`, ms, fetchFn).then(desenvolver),
      getJson(`${raiz}/v1/species/${slugLargo}/localities.geojson`, ms, fetchFn),
    ]);
    if (d?.slug !== slugLargo || p?.slug !== slugLargo || !Array.isArray(p.presence) || l?.type !== 'FeatureCollection' || !Array.isArray(l.features)) throw new Error(`${slugLargo}: an answer out of shape`);
    const filas = [];
    for (const r of p.presence) {
      if (!ISO.test(r.iso ?? '') || (unidades && !unidades.has(r.iso)) || !EVIDENCIAS.has(r.evidence)) throw new Error(`${slugLargo}: a presence row out of shape`);
      filas.push([r.iso, r.evidence, anotar(r.source, r.licence)]);
    }
    filas.sort((a, b) => a[0].localeCompare(b[0]));
    presencia[slug] = filas;
    for (const f of l.features) features.push({ type: 'Feature', properties: { slug, generalization: f.properties?.generalization, name: f.properties?.name ?? null, sourceKey: f.properties?.sourceKey ?? null, source: f.properties?.source ?? null, citation: f.properties?.citation ?? null, licence: f.properties?.licence ?? null }, geometry: f.geometry });
    const campos = {};
    let borrador = true, fuentePerfil = null;
    for (const r of d.profile ?? []) { (campos[r.field] ??= {})[r.locale] = r.body; borrador = borrador && r.draft === true; fuentePerfil = anotar(r.source, r.licence) ?? fuentePerfil; }
    especies.push({
      slug, scientificName: d.scientificName, authorship: d.authorship ?? null, aswAccepted: d.aswAccepted ? corto(d.aswAccepted) : null, countries: [...(d.countries ?? [])].sort(),
      categories: (d.categories ?? []).filter((c) => SISTEMAS.has(c.system) && categoriaVisible(c)).map((c) => ({ system: c.system, scope: c.scope, category: c.category, citation: c.citation ?? null, source: c.sourceKey ?? null })),
      morphometrics: (d.morphometrics ?? []).map((m) => ({ measure: m.measure, stage: m.stage, sex: m.sex, ...Object.fromEntries(['mean', 'min', 'max', 'n'].filter((k) => m[k] !== null && m[k] !== undefined).map((k) => [k, m[k]])), uom: m.uom, source: anotar(m.source, m.licence) })),
      profile: Object.keys(campos).length ? { draft: borrador, source: fuentePerfil, campos } : null, source: anotar(d.source, d.licence),
    });
  };
  for (let i = 0; i < lista.length; i += 6) await Promise.all(lista.slice(i, i + 6).map(una));
  especies.sort((a, b) => a.slug.localeCompare(b.slug));
  features.sort((a, b) => a.properties.slug.localeCompare(b.properties.slug) || String(a.geometry?.coordinates).localeCompare(String(b.geometry?.coordinates)));
  const localidades = { type: 'FeatureCollection', features };
  const motivos = validarLocalidades(localidades);
  if (motivos.length) throw new Error(`localities: ${motivos[0]}`);
  return { atlas: { generadoDe: { origen: 'hub de Zenbit System' }, fuentes: [...fuentes.values()].sort((a, b) => a.key.localeCompare(b.key)), especies, presencia }, localidades };
}
