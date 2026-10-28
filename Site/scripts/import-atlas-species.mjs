// The species layers of the atlas, from Site & Data's final bundles (hub entity shape), checked against their manifests.
//   node scripts/import-atlas-species.mjs [--dir <entities directory>]
// Reads (default ~/.cache/axolodao-datos/open/entities) the five bundles pinned below, re-hashes every file against its manifest, and writes
//   src/data/atlas-snapshot/especies-atlas.json        the 32 taxa: names, countries, status categories, presence by ISO 3166-2 with its evidence,
//                                                  morphometrics, draft profiles and the sources they cite
//   src/data/atlas-snapshot/especies-localidades.geojson   localities, as the hub serves them: a 0.5° cell is its square polygon (the cell's
//                                                  lon/lat is its south-west corner), a named water body is a point. Nothing finer exists.
//                                                  Feature properties are the hub's: generalization, name, source (title), citation, licence, plus the slug.
// The hub's /v1/species routes give the same content (src/lib/atlasSnapshot.mjs will read them when they land); until then these files ARE the snapshot.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALCANCES_DE_ESTATUS, categoriaVisible, citaUicn } from '../src/lib/atlasSpecies.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const DIR = arg('--dir') ?? join(homedir(), '.cache', 'axolodao-datos', 'open', 'entities');
const BUNDLES = { genero: '944f8dbc53b0-genero', localidades: 'a1d128c4bf4c-localidades', perfiles: '735c7b3021a1-perfiles', morfometria: 'a1d128c4bf4c-morfometria' };

const filas = (texto) => texto.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
function leerBundle(nombre) {
  const raiz = join(DIR, BUNDLES[nombre]);
  const manifest = JSON.parse(readFileSync(join(raiz, 'manifest.json'), 'utf8'));
  const datos = {};
  for (const f of manifest.files) {
    const bytes = readFileSync(join(raiz, f.path));
    const sha = `0x${createHash('sha256').update(bytes).digest('hex')}`;
    if (sha !== f.sha256) throw new Error(`${BUNDLES[nombre]}/${f.path}: sha256 ${sha} is not the manifest's ${f.sha256}`);
    const rows = filas(bytes.toString('utf8'));
    if (rows.length !== f.rows) throw new Error(`${BUNDLES[nombre]}/${f.path}: ${rows.length} rows, the manifest says ${f.rows}`);
    datos[f.name] = rows;
  }
  return { manifest, datos };
}

const corto = (s) => s.replace(/^ambystoma_/, '');
const g = leerBundle('genero'), l = leerBundle('localidades'), p = leerBundle('perfiles'), m = leerBundle('morfometria');
const taxa = g.datos.taxa;
if (taxa.length !== 32) throw new Error(`expected 32 taxa, got ${taxa.length}`);
const slugDe = new Map(taxa.map((t) => [t.id, corto(t.slug)]));
const fuentes = new Map();
for (const b of [g, l, p, m]) for (const s of b.datos.sources ?? []) fuentes.set(s.id, s);
const clave = (id) => fuentes.get(id)?.sourceKey ?? null;
const usadas = new Set();
const cita = (id) => { const k = clave(id); if (k) usadas.add(id); return k; };

// the status categories a card shows: the global and country ones (NatureServe's state-level ranks stay in the hub)
// (the selection lives in src/lib/atlasSpecies.mjs, shared with the hub reader, so a hub build renders exactly what a file build renders)
const SCOPES = ALCANCES_DE_ESTATUS;
const categorias = {};
for (const s of g.datos.taxon_status) if (categoriaVisible(s)) (categorias[slugDe.get(s.taxonId)] ??= []).push({ system: s.system, scope: s.scope, category: s.category, citation: citaUicn(s), source: cita(s.sourceId) });
const presencia = {};
const EVIDENCIAS = new Set(['present', 'historical', 'extirpated', 'introduced', 'weak', 'literature']);
for (const r of g.datos.taxon_admin1) {
  if (!/^(MX|US|CA)-[A-Z0-9]{2,3}$/.test(r.iso) || !EVIDENCIAS.has(r.evidence)) throw new Error(`a presence row out of shape: ${JSON.stringify(r)}`);
  (presencia[slugDe.get(r.taxonId)] ??= []).push([r.iso, r.evidence, cita(r.sourceId)]);
}
for (const k of Object.keys(presencia)) presencia[k].sort((a, b) => a[0].localeCompare(b[0]));

const perfil = {};
for (const r of p.datos.taxon_profiles) {
  const s = slugDe.get(r.taxonId);
  if (!s) continue;                                  // a taxon that is a synonym now (A. subsalsum under velasci): no sheet
  ((perfil[s] ??= { draft: true, source: null }).campos ??= {})[r.field] = { ...(perfil[s].campos?.[r.field] ?? {}), [r.locale]: r.body };
  perfil[s].draft = perfil[s].draft && r.review === 'draft';
  perfil[s].source = cita(r.sourceId);
}
const morfo = {};
for (const r of m.datos.taxon_morphometrics.filter((x) => slugDe.has(x.taxonId))) (morfo[slugDe.get(r.taxonId)] ??= []).push({ measure: r.measure, stage: r.stage, sex: r.sex, ...Object.fromEntries(['mean', 'min', 'max', 'n'].filter((k) => r[k] !== undefined).map((k) => [k, r[k]])), uom: r.uom, source: cita(r.sourceId) });

const especies = taxa.map((t) => {
  const s = corto(t.slug);
  const paises = [...new Set((presencia[s] ?? []).filter((x) => ['present', 'literature', 'weak'].includes(x[1])).map((x) => x[0].slice(0, 2)))].sort();
  return { slug: s, scientificName: t.scientificName, authorship: t.authorship ?? null, aswAccepted: t.aswAccepted ? corto(t.aswAccepted) : null, countries: paises,
    categories: categorias[s] ?? [], morphometrics: morfo[s] ?? [], profile: perfil[s] ?? null, source: cita(t.sourceId) };
}).sort((a, b) => a.slug.localeCompare(b.slug));

// localities, as the hub serves them
const cuadrado = (lon, lat, d) => [[[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d], [lon, lat]]];
const features = [];
for (const r of l.datos.taxon_localities) {
  const slug = slugDe.get(r.taxonId);
  if (!slug) continue;
  const fuente = fuentes.get(r.sourceId);
  cita(r.sourceId);
  // the hub's feature: generalization, name, sourceKey, source title, citation, licence (+ the species slug, which the hub carries in the URL)
  const props = { slug, generalization: r.generalization, name: r.generalization === 'named_water_body' ? r.name : null, sourceKey: clave(r.sourceId), source: fuente?.title ?? null, citation: fuente?.citation ?? null, licence: r.licenceSpdx };
  if (r.generalization === '0.5deg') features.push({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: cuadrado(r.cell.lon, r.cell.lat, 0.5) } });
  else if (r.generalization === 'named_water_body') features.push({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [r.rep.lon, r.rep.lat] } });
  else throw new Error(`a locality of generalization ${r.generalization} is not drawn here (0.5deg cells and named water bodies only)`);
}
features.sort((a, b) => a.properties.slug.localeCompare(b.properties.slug) || a.geometry.coordinates.toString().localeCompare(b.geometry.coordinates.toString()));

const licencias = new Map([g, l, p, m].flatMap((b) => b.datos.licences ?? []).map((x) => [x.spdx, x]));
const fuentesUsadas = [...usadas].map((id) => fuentes.get(id)).filter(Boolean).map((s) => ({ key: s.sourceKey, title: s.title, publisher: s.publisher ?? null, url: s.url ?? null, citation: s.citation ?? null, licence: s.licenceSpdx, citeOnly: licencias.get(s.licenceSpdx)?.commercialOk === false }))
  .sort((a, b) => a.key.localeCompare(b.key));
const out = { generadoDe: Object.fromEntries(Object.entries(BUNDLES).map(([k, v]) => [k, { dir: v, gitSha: ({ genero: g, localidades: l, perfiles: p, morfometria: m })[k].manifest.gitSha }])), fuentes: fuentesUsadas, especies, presencia };
mkdirSync(join(SITE, 'src/data/atlas-snapshot'), { recursive: true });
writeFileSync(join(SITE, 'src/data/atlas-snapshot/especies-atlas.json'), JSON.stringify(out) + '\n');
writeFileSync(join(SITE, 'src/data/atlas-snapshot/especies-localidades.geojson'), JSON.stringify({ type: 'FeatureCollection', features }) + '\n');
const tam = (f) => statSync(join(SITE, 'src/data/atlas-snapshot', f)).size;
console.log(`especies-atlas.json: ${especies.length} taxa, ${Object.values(presencia).reduce((n, x) => n + x.length, 0)} presence rows, ${fuentesUsadas.length} sources, ${tam('especies-atlas.json')} bytes`);
console.log(`especies-localidades.geojson: ${features.length} localities (${features.filter((f) => f.properties.generalization === '0.5deg').length} cells, ${features.filter((f) => f.properties.generalization === 'named_water_body').length} lakes), ${tam('especies-localidades.geojson')} bytes`);
