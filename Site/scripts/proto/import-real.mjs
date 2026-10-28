// PROTOTYPE: turns Site & Data's phase-0 bundle (b38afe8b0710-{atlas,hidrografia,rangos}, listing hash 5b54bfa9…e419) into the files the redesign reads, in public/atlas/real/.
// It checks every file against the bundle's own sha256 listing first and refuses on a mismatch. Run:
//   BUNDLE=~/.cache/axolodao-datos/open/entities DATOS=~/Documents/GitHub/the data repository node scripts/proto/import-real.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'polygon-clipping';

const B = process.env.BUNDLE, PREFIX = process.env.PREFIX ?? 'b38afe8b0710';
const DATOS = process.env.DATOS;
const RP = process.env.RANGOS ?? PREFIX;          // the ranges and localities may come from a newer delivery than the atlas files
const OUT = 'public/atlas/real';
mkdirSync(OUT, { recursive: true });
const rd = (p) => readFileSync(join(B, p), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const rj = (p) => JSON.parse(readFileSync(join(B, p), 'utf8'));

// -- the bundle's own listing: sha256 of every file, and the sha256 of the listing
const LISTING = process.env.LISTING ?? PREFIX;      // a delivery's listing can cover more than one bundle prefix
const listing = readFileSync(join(B, `${LISTING}-paquete.sha256.txt`), 'utf8');
const rootHash = createHash('sha256').update(listing).digest('hex');
let bad = 0;
for (const line of listing.split('\n').filter(Boolean)) {
  const [sha, path] = line.split(/\s+/);
  if (createHash('sha256').update(readFileSync(join(B, path))).digest('hex') !== sha) { console.error('MISMATCH', path); bad++; }
}
if (bad) { console.error(`REFUSED: ${bad} file(s) differ from the listing`); process.exit(1); }
console.log(`bundle ok: ${listing.split('\n').filter(Boolean).length} files, listing sha256 ${rootHash}`);

const slugOf = (t) => t.slug.replace(/^ambystoma_/, '');
const taxa = Object.fromEntries(rd(`${RP}-rangos/exportable/taxa.jsonl`).map((t) => [t.id, slugOf(t)]));
// the labels of habitats, threats, prey groups and life stages come WITH the bundle (draft/etiquetas-*.json, grupos-presa.json), es/en/pt; a code with no label in a language refuses the import
const LANGS = ['es', 'en', 'pt'];
const etiquetas = (nombre, d) => { for (const [k, v] of Object.entries(d)) for (const l of LANGS) if (!v?.[l]) { console.error(`REFUSED: ${nombre} «${k}» has no ${l} label`); process.exit(1); } return d; };
const eHabitat = etiquetas('etiquetas-habitat', rj(`${PREFIX}-atlas/draft/etiquetas-habitat.json`));
const eAmenaza = etiquetas('etiquetas-amenaza', rj(`${PREFIX}-atlas/draft/etiquetas-amenaza.json`));
const eEtapa = etiquetas('etiquetas-etapa', rj(`${PREFIX}-atlas/draft/etiquetas-etapa.json`));
const gruposPresa = rj(`${PREFIX}-atlas/draft/grupos-presa.json`);
for (const [k, v] of Object.entries(gruposPresa)) etiquetas(`grupos-presa.${k}`, v.etiquetas ? { [k]: v.etiquetas } : { [k]: {} });
const codigos = JSON.parse(readFileSync(join(DATOS, 'context/datos/atlas/codigos.json'), 'utf8'));

// -- sources: a short citation (first surname and year) built from each source's own citation
const citas = (() => { try { return rj(`${PREFIX}-atlas/draft/citas-cortas.json`); } catch { return {}; } })();   // Site & Data's real short citations, {sourceId: «Autor, año»}
const fuentes = {};
// A short citation is Site & Data's (citas-cortas.json), never made here: a source without one makes the import fail (see `sinCorta` below).
for (const s of rd(`${PREFIX}-atlas/draft/sources.jsonl`)) fuentes[s.id] = { key: s.sourceKey, title: s.title, cite: citas[s.id] ?? null };
// the morphometrics bundle carries the sources of the Mexican measures; their short citations are in the same citas-cortas.json
const MORF = process.env.MORF ?? 'ac636ddc721f-morfometria';
for (const m of readFileSync(join(B, `${MORF}/sources.jsonl`), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))) if (!fuentes[m.id]) fuentes[m.id] = { key: m.sourceKey, title: m.title, cite: citas[m.id] ?? null };
const porClave = Object.fromEntries(Object.values(fuentes).map((f) => [f.key, f]));
const sinCorta = new Set();
const src = (id, page) => ({ cite: fuentes[id]?.cite ?? (sinCorta.add(id), id), title: fuentes[id]?.title ?? null, page: page ?? null });

// -- the sheet: traits, profiles, interactions
const fichas = {};
const F = (slug) => (fichas[slug] ??= { desc: null, diet: null, dietCaptive: null, habitat: [], elevation: null, lifeForm: null, regeneration: null, threat: [], cites: null, prey: [] });
for (const t of rd(`${PREFIX}-atlas/draft/taxon_traits.jsonl`)) {
  const f = F(taxa[t.taxonId]);
  const s = src(t.sourceId, t.page);
  if (t.trait === 'habitat') { let h = f.habitat.find((x) => x.code === t.value); if (!h) f.habitat.push((h = { code: t.value, label: eHabitat[t.value] ?? (console.error(`REFUSED: habitat code ${t.value} has no label in the bundle`), process.exit(1)), src: [] })); h.src.push(s); }
  else if (t.trait === 'main_threat') { let h = f.threat.find((x) => x.code === t.value); if (!h) f.threat.push((h = { code: t.value, label: eAmenaza[t.value] ?? (console.error(`REFUSED: threat code ${t.value} has no label in the bundle`), process.exit(1)), src: [] })); h.src.push(s); }
  else if (t.trait === 'life_form') { f.lifeForm ??= { values: {}, src: [] }; (f.lifeForm.values[t.value] ??= []).push(s); }
  else if (t.trait === 'regeneration') { f.regeneration ??= { src: [] }; f.regeneration.src.push(s); }
  else if (t.trait === 'cites_appendix') f.cites = { value: t.value, src: s, note: t.note ?? null };
  else if (t.trait === 'elevation_min_m' || t.trait === 'elevation_max_m') {
    f.elevation ??= { items: {} };
    const k = `${t.sourceId}|${t.page}`; const it = (f.elevation.items[k] ??= { src: s, min: null, max: null, note: t.note ?? null });
    it[t.trait === 'elevation_min_m' ? 'min' : 'max'] = Number(t.value);
  }
}
for (const f of Object.values(fichas)) if (f.elevation) f.elevation.items = Object.values(f.elevation.items);
for (const p of rd(`${PREFIX}-atlas/draft/taxon_profiles.jsonl`)) {
  const f = F(taxa[p.taxonId]);
  if (p.field === 'description') (f.desc ??= {})[p.locale] = p.body;
  else if (p.field === 'diet') f.diet = { es: p.body, review: p.review, src: fuentes[p.sourceId]?.cite ?? null };
  else if (p.field === 'diet_captive') f.dietCaptive = { es: p.body, review: p.review, src: fuentes[p.sourceId]?.cite ?? null };
}
// the prey-group labels come with the data (draft/grupos-presa.json: GBIF key → etiquetas {es,en,pt}), never from this script; a null group is the file's «otros»
const GRUPO = { 0: gruposPresa.otros.etiquetas, ...Object.fromEntries(Object.entries(gruposPresa).filter(([k]) => k !== 'otros').map(([k, v]) => [+k, v.etiquetas])) };   // key → {es, en, pt}
for (const i of rd(`${PREFIX}-atlas/draft/taxon_interactions.jsonl`)) {
  const f = F(taxa[i.taxonId]);
  if (i.targetGbifKey == null || !GRUPO[i.targetGbifKey]) continue;   // a row that targets a named taxon or a taxon id is placed by the sidecar below
  let g = f.prey.find((x) => x.key === i.targetGbifKey);
  if (!g) f.prey.push((g = { key: i.targetGbifKey, name: GRUPO[i.targetGbifKey], contexts: [] }));
  if (!g.contexts.includes(i.context)) g.contexts.push(i.context);
}

// the prey NAMED by the sources, under their group (draft/presas-nombradas.json): the item as the source names it, wild and captive, with its name in each language (nombre, nombre_en, nombre_pt); a null group is «Otros». Names only: no frequency, no amount.
{
  let nombres = [];
  try { nombres = rj(`${PREFIX}-atlas/draft/presas-nombradas.json`); } catch { nombres = []; }
  for (const r of nombres) {
    const f = F(taxa[r.taxonId]); const key = r.grupo ?? 0;
    if (!GRUPO[key]) { console.error(`REFUSED: prey group ${key} of «${r.nombre}» has no name in the importer`); process.exit(1); }
    let g = f.prey.find((x) => x.key === key);
    if (!g) f.prey.push((g = { key, name: GRUPO[key], contexts: [] }));
    if (!g.contexts.includes(r.context)) g.contexts.push(r.context);
    const l = ((g.nombres ??= {})[r.context] ??= []);
    if (!r.nombre_en || !r.nombre_pt) { console.error(`REFUSED: prey name «${r.nombre}» has no ${!r.nombre_en ? 'en' : 'pt'} name`); process.exit(1); }
    if (!l.some((n) => n.es === r.nombre)) l.push({ es: r.nombre, en: r.nombre_en, pt: r.nombre_pt });
  }
}
// -- measures: TaxonMorphometricRow rows from the morphometrics bundle (Mexican species) and from the atlas bundle's draft/taxon_morphometrics.jsonl (the dossier measures of the others).
// A row's note (for example «sólo el holotipo») is in draft/notas-medidas.json, keyed «taxonId|measure|stage|sex|sourceId»..
const medidas = {};
const filasM = [...rd(`${MORF}/taxon_morphometrics.jsonl`), ...rd(`${PREFIX}-atlas/draft/taxon_morphometrics.jsonl`)];
const citaId = (id) => fuentes[id]?.cite ?? (sinCorta.add(id), id);
const notas = rj(`${PREFIX}-atlas/draft/notas-medidas.json`);
for (const r of filasM) (medidas[taxa[r.taxonId]] ??= []).push({ measure: r.measure, stage: r.stage, sex: r.sex, mean: r.mean, min: r.min, max: r.max, n: r.n, uom: r.uom, source: citaId(r.sourceId), note: notas[[r.taxonId, r.measure, r.stage, r.sex, r.sourceId].join('|')] });
for (const [slug, rows] of Object.entries(medidas)) F(slug).medidas = rows.map((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined && v !== null && v !== 'any')));

// -- ranges: what the atlas view shows is the solo-atlas rows (atlas: true) and the exportable rows with atlas: true
const features = [];
const lagos = rj(`${process.env.HIDRO ?? PREFIX}-hidrografia/layers/hidrografia-lagos.geojson`);
const rios = rj(`${process.env.HIDRO ?? PREFIX}-hidrografia/layers/hidrografia-rios.geojson`);
const poligono = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const credito = (r) => r.sources.map((s) => ({ name: s.attribution, credit: s.licence }));
const dibujadas = new Set();
for (const dir of ['solo-atlas', 'exportable']) {
  for (const r of rd(`${RP}-rangos/${dir}/taxon_ranges.jsonl`)) {
    if (r.atlas !== true) continue;
    const slug = taxa[r.taxonId];
    if (dir === 'exportable' && dibujadas.has(slug)) continue;
    if (r.kind === 'drawn') {
      const g = rj(`${RP}-rangos/${dir}/${r.geometryPath}`);
      const geom = g.type === 'FeatureCollection' ? g.features[0].geometry : g.type === 'Feature' ? g.geometry : g;
      features.push({ type: 'Feature', properties: { slug, kind: 'range', potential: !!r.potential, method: r.method, tolerance: r.toleranceDeg, fuentes: credito(r) }, geometry: geom });
      dibujadas.add(slug);
    } else if (r.kind === 'whole_lake') {
      if (r.shown?.as === 'outline') {
        const nombre = r.shown.featureRef.split('name=')[1];
        const lago = lagos.features.find((f) => f.properties.nombre === nombre);
        if (!lago) throw new Error(`lake outline ${nombre} is not in the hydrography layer`);
        features.push({ type: 'Feature', properties: { slug, kind: 'range', potential: false, method: 'lake_outline', name: nombre, fuentes: credito(r) }, geometry: lago.geometry });
      }   // a whole-lake MARKER is drawn from marcadores-lagos.json, at the lake's centroid, not from this row's cell
      if (r.shown?.as === 'outline') dibujadas.add(slug);
    }
  }
}
// the species with no drawn range keep their localities: the merged 0.5° cells as an area, and a named water body as a marker
const loc = rd(`${RP}-rangos/exportable/taxon_localities.jsonl`);
const celdas = {};
const puntosLoc = [];
const loc0 = null;
// The cells of six species are not point localities: they are the original site map's six BLOBS rasterized to 0.5°. Site & Data's origen-localidades.json says which row is which:
// «mapa-mancha» (a blob cell: an area, never a dot), «mapa-punto» (one of the map's dots) or «literatura» (a cell moved to its source). Only the last two are drawn as dots.
const LOC = process.env.LOC ?? '2f88c5b3fcca-localidades';
const origen = rj(`${LOC}/origen-localidades.json`);
// the short citation of a locality's source is Site & Data's (citas-cortas.json of the atlas and of the ranges bundle); a printed-map source («…-mapa-<especie>-p<N>») takes its parent's («pace-ambystoma-2018»)
const citasLoc = { ...citas, ...(() => { try { return rj(`${RP}-rangos/exportable/citas-cortas.json`); } catch { return {}; } })(), ...(() => { try { return rj(`${LOC}/citas-cortas.json`); } catch { return {}; } })() };   // the localities bundle's own file wins
const fuentesLocRows = rd(`${LOC}/sources.jsonl`);
const fuentesLocPorId = Object.fromEntries(fuentesLocRows.map((s) => [s.id, s]));
const cortaDe = (s) => {
  if (citasLoc[s.id]) return citasLoc[s.id];
  const padre = fuentesLocRows.filter((o) => o.id !== s.id && s.sourceKey.startsWith(`${o.sourceKey}-`)).sort((a, b) => b.sourceKey.length - a.sourceKey.length)[0];
  return padre ? citasLoc[padre.id] ?? null : null;
};
const fuentesPuntos = {};
// how each point row is drawn (Site & Data's dibujo-localidades.json, keyed by row id): the state (ISO), the method, the point to draw it at, whether the state is highlighted, and for a point read off a printed map its provenance
let dibujo = {}; try { dibujo = rj(`${LOC}/dibujo-localidades.json`); } catch { dibujo = {}; }
// (sin-punto.json is no longer written: it was phase-0 reasoning, not data, and the site does not serve it)
const centroides = new Map(readFileSync(join(DATOS, 'context/datos/geografia/centroides-inegi.csv'), 'utf8').split('\n').slice(1).filter(Boolean).map((r) => { const f = r.split(','); return [`${f[0]}-${f[1]}`, { nombre: f[2], lon: +f[4], lat: +f[5] }]; }));
for (const l of loc) {
  const slug = taxa[l.taxonId];
  if (l.generalization === 'named_water_body') continue;      // never drawn at its `rep` point (0.01°): see marcadores-lagos.json below
  const origenLoc = origen[l.id]?.origen;
  if (!origenLoc) { console.error(`REFUSED: locality ${l.id} (${slug}) has no entry in origen-localidades.json`); process.exit(1); }
  // a municipality locality (a source names the municipality): ONE point at INEGI's municipal centroid (the table the facilities layer uses), never a 0.5° cell
  if (l.generalization === 'municipality') {
    const c = centroides.get(`${l.cveEnt}-${l.cveMun}`);
    if (!c) { console.error(`REFUSED: municipality ${l.cveEnt}-${l.cveMun} (${slug}) is not in centroides-inegi.csv`); process.exit(1); }
    puntosLoc.push({ type: 'Feature', properties: { slug, kind: 'locality', generalization: 'municipality', municipio: c.nombre, cve: `${l.cveEnt}-${l.cveMun}` }, geometry: { type: 'Point', coordinates: [c.lon, c.lat] } });
    continue;
  }
  if (origenLoc !== 'mapa-mancha') {
    const d = dibujo[l.id];
    if (Object.keys(dibujo).length && !d?.punto) { console.error(`REFUSED: point locality ${l.id} (${slug}) has no punto in dibujo-localidades.json`); process.exit(1); }
    const zona = d?.metodo === 'centroide de celda ∩ estado' || !!d?.lectura;   // a ZONE marker (not a pin): the state name only, never a place
    const fs = fuentesLocPorId[l.sourceId]; const corta = fs ? cortaDe(fs) : null;
    if (!fs || !corta) { console.error(`REFUSED: the source of locality ${l.id} (${slug}) has no short citation in citas-cortas.json`); process.exit(1); }
    (fuentesPuntos[slug] ??= []).push({ estado: d?.estado ?? null, corta, completa: fs.citation ?? fs.title, sitio: fs.sourceKey === 'axolodao-sitio-mapa', pagina: d?.lectura?.pagina ?? null, corroborado: d?.lectura?.corroboradoPor ?? null, difiere: !!d?.fuentesDifieren });
    puntosLoc.push({ type: 'Feature', properties: { slug, kind: 'locality', generalization: l.generalization, ...(d ? { estado: d.estado ?? null, metodo: d.metodo, zona, resaltarEstado: !!d.resaltarEstado, difiere: !!d.fuentesDifieren, ...(d.lectura ? { lecturaPagina: d.lectura.pagina ?? null, lecturaCorroborado: d.lectura.corroboradoPor ?? null } : {}) } : {}) },
      geometry: { type: 'Point', coordinates: d?.punto ? [d.punto[0], d.punto[1]] : [+(l.cell.lon + 0.25).toFixed(3), +(l.cell.lat + 0.25).toFixed(3)] } });
  }
  if (dibujadas.has(slug)) continue;
  (celdas[slug] ??= []).push([[[l.cell.lon, l.cell.lat], [l.cell.lon + 0.5, l.cell.lat], [l.cell.lon + 0.5, l.cell.lat + 0.5], [l.cell.lon, l.cell.lat + 0.5], [l.cell.lon, l.cell.lat]]]);
}
// where the sources of a species DIFFER about a locality (dibujo-localidades.json `fuentesDifieren`): each row with its own citation, for the species sheet. The citation is the row's source as Site & Data gives it (no short form made here).
{
  const fuentesLoc = Object.fromEntries(rd(`${LOC}/sources.jsonl`).map((s) => [s.id, s]));
  const porId = Object.fromEntries(loc.map((l) => [l.id, l]));
  const out = {};
  for (const [id, d] of Object.entries(dibujo)) {
    if (!d.fuentesDifieren) continue;
    const slug = taxa[porId[id].taxonId];
    const e = (out[slug] ??= { diferencia: d.fuentesDifieren.nota, filas: [] });
    for (const rid of [id, ...(d.fuentesDifieren.otras ?? [])]) {
      if (e.filas.some((f) => f.id === rid)) continue;
      const r = porId[rid], dd = dibujo[rid] ?? {}, s = fuentesLoc[r.sourceId];
      e.filas.push({ id: rid, estado: dd.estado ?? null, corta: s ? cortaDe(s) : null, cita: s?.citation ?? s?.title ?? null, pagina: dd.lectura?.pagina ?? null, corroborado: dd.lectura?.corroboradoPor ?? null });
    }
  }
// (the phase-0 source notes are no longer written: the sources of the localities are the attested file's)
}
writeFileSync(`${OUT}/etapas.json`, JSON.stringify(eEtapa, null, 1));
// (the phase-0 source notes are no longer written: the sources of the localities are the attested file's)
// the lake markers: one 0.1° marker CENTRED on `centroide` (IP review), whole-lake or cited locality; a lake drawn as an outline (dumerilii) comes through taxon_ranges
for (const m of rj(`${RP}-rangos/exportable/marcadores-lagos.json`)) {
  if (m.mostrado !== 'marker') continue;
  features.push({ type: 'Feature', properties: { slug: m.especie, kind: 'lake', wholeRange: m.tipo === 'lago_entero', name: m.lago, cita: m.cita ?? null, fuentes: [{ name: m.cita ? `${porClave[m.cita.fuente]?.cite ?? citasLoc[fuentesLocRows.find((o) => o.sourceKey === m.cita.fuente)?.id] ?? m.cita.fuente}, pág. ${m.cita.pagina}: «${m.cita.texto}»` : `Centroide: ${m.fuenteCentroide}`, credit: m.fuenteCentroide ?? '' }] }, geometry: { type: 'Point', coordinates: [m.centroide.lon, m.centroide.lat] } });
}
for (const [slug, cs] of Object.entries(celdas)) {
  const u = pc.union(...cs);
  features.push({ type: 'Feature', properties: { slug, kind: 'range', potential: false, method: 'cells_0.5deg', localities: true, fuentes: [{ name: 'Mapa de especies del sitio, celdas de 0.5°', credit: 'AxoloDAO' }] }, geometry: u.length === 1 ? { type: 'Polygon', coordinates: u[0] } : { type: 'MultiPolygon', coordinates: u } });
}
writeFileSync(`${OUT}/rangos.geojson`, JSON.stringify({ type: 'FeatureCollection', features }));
// the phase-0 locality points are no longer written to the site: the map's points come from the attested localities (/atlas/datos/especies-localidades.geojson)
console.log('localities', puntosLoc.length, 'species with localities', new Set(puntosLoc.map((f) => f.properties.slug)).size);
console.log('range features', features.length, 'species', new Set(features.map((f) => f.properties.slug)).size);

// -- neighbours: ranges that overlap or come within 0.3° (vertices); a marker within 0.6°
const verts = (g) => (g.type === 'Point' ? [g.coordinates] : poligono(g).flat(2).filter((c) => typeof c[0] === 'number' && c.length === 2));
const near = {};
const rs = features.filter((f) => f.properties.kind === 'range' || f.properties.kind === 'lake');
const bb = (v) => v.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [1e9, 1e9, -1e9, -1e9]);
const cache = rs.map((f) => { const v = verts(f.geometry); return { f, v: v.length > 600 ? v.filter((_, i) => i % Math.ceil(v.length / 600) === 0) : v, box: bb(v) }; });
for (let i = 0; i < cache.length; i++) for (let j = i + 1; j < cache.length; j++) {
  const [a, b] = [cache[i], cache[j]];
  if (a.f.properties.slug === b.f.properties.slug) continue;
  const pad = a.f.geometry.type === 'Point' || b.f.geometry.type === 'Point' ? 0.6 : 0.3;
  if (a.box[2] + pad < b.box[0] || b.box[2] + pad < a.box[0] || a.box[3] + pad < b.box[1] || b.box[3] + pad < a.box[1]) continue;
  let touch = false;
  for (const p of a.v) { for (const q of b.v) if (Math.hypot(p[0] - q[0], p[1] - q[1]) < pad) { touch = true; break; } if (touch) break; }
  if (!touch && a.f.geometry.type !== 'Point' && b.f.geometry.type !== 'Point') { try { touch = pc.intersection(poligono(a.f.geometry), poligono(b.f.geometry)).length > 0; } catch { /* degenerate */ } }
  if (touch) { (near[a.f.properties.slug] ??= new Set()).add(b.f.properties.slug); (near[b.f.properties.slug] ??= new Set()).add(a.f.properties.slug); }
}
writeFileSync(`${OUT}/vecinos.json`, JSON.stringify(Object.fromEntries(Object.entries(near).map(([k, v]) => [k, [...v].sort()])), null, 1));

// -- water: the bundle's Natural Earth rivers and lakes, already clipped to the land of Mexico, the United States and Canada by Site & Data (a test checks that nothing lies over Central America or the Caribbean)
const agua = [...lagos.features.map((f) => ({ type: 'Feature', properties: { kind: 'lake', name: f.properties.nombre }, geometry: f.geometry })), ...rios.features.map((f) => ({ type: 'Feature', properties: { kind: 'river', name: f.properties.nombre }, geometry: f.geometry }))];
writeFileSync(`${OUT}/agua.geojson`, JSON.stringify({ type: 'FeatureCollection', features: agua }));
writeFileSync(`${OUT}/fichas.json`, JSON.stringify(fichas));
writeFileSync(`${OUT}/PROCEDENCIA.json`, JSON.stringify({ bundle: PREFIX, listingSha256: rootHash, files: listing.split('\n').filter(Boolean).length, importedBy: 'scripts/proto/import-real.mjs' }, null, 1));
if (sinCorta.size) { console.error(`REFUSED: ${sinCorta.size} source(s) have no short citation in citas-cortas.json: ${[...sinCorta].map((id) => fuentes[id]?.key ?? id).join(', ')}`); process.exit(1); }
console.log('fichas', Object.keys(fichas).length, 'water features', agua.length);
