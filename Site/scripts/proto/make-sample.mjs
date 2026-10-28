// PROTOTYPE ONLY. Builds the SAMPLE data the redesign prototype reads, in the shapes of §5 of the plan (TaxonRangeRow, TaxonTraitRow, the grid).
// Nothing here is a finding: the range polygons are the 0.5° cells of the committed bundle, merged, then smoothed with a seeded jitter and Chaikin corner cutting,
// so they LOOK like the curves the real ranges will have. Site & Data's real polygons replace them.
// Run: node scripts/proto/make-sample.mjs   (writes public/atlas/sample/*)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import pc from 'polygon-clipping';
import simplify from 'simplify-js';

const R = (p) => JSON.parse(readFileSync(p, 'utf8'));
const out = 'public/atlas/sample';
mkdirSync(out, { recursive: true });
const loc = R('src/data/atlas-snapshot/especies-localidades.geojson');
const bundle = R('src/data/atlas-snapshot/especies-atlas.json');
const admin1 = R('src/data/atlas-snapshot/admin1.geojson');

// -- seeded noise
const hash = (s) => { let h = 0x811c9dc5; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
const prng = (seed) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32; };

const densify = (ring, step) => {
  const o = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const [a, b] = [ring[i], ring[i + 1]];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) o.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return o;
};
const chaikin = (pts, it) => {
  for (let k = 0; k < it; k++) {
    const n = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; n.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]); }
    pts = n;
  }
  return pts;
};
const smoothRing = (ring, slug, { amp = 0.09, step = 0.25, it = 3 } = {}) => {
  const rnd = prng(hash(slug));
  // low-frequency wobble: a few random phases, so neighbouring vertices move together (a curve, not static)
  const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  const pts = densify(ring, step).map(([x, y], i) => [x + amp * (Math.sin(x * 3.1 + ph[0]) + 0.6 * Math.sin(y * 4.7 + ph[1])), y + amp * (Math.cos(y * 3.7 + ph[2]) + 0.6 * Math.sin(x * 5.3 + ph[0]))]);
  const s = chaikin(pts, it).map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]);
  return [...s, s[0]];
};

// -- ranges: Mexican cells merged and smoothed; mavortium merged with its US/CA states into one polygon
const porSlug = {};
for (const f of loc.features) if (f.geometry.type === 'Polygon') (porSlug[f.properties.slug] ??= []).push(f.geometry.coordinates);
const units = new Map(admin1.features.map((f) => [f.properties.iso, f]));
const presence = bundle.presencia;
const features = [];
// D7 (founder, 18-oct): the site map's curves may feed ONLY altamirani, mavortium, ordinarium, rosaceum and velasci (silvense is held until the founder answers).
// They are labelled «distribución potencial», credited «no es un mapa oficial» with the PACE 2018 citation. Every other species keeps its 0.5° cells, drawn as they are today.
const POTENCIAL = new Set(['altamirani', 'mavortium', 'ordinarium', 'rosaceum', 'velasci']);
const metaOf = (slug) => POTENCIAL.has(slug)
  ? { slug, kind: 'range', potential: true, method: 'sample-smoothed-cells', fuentes: slug === 'mavortium'
      ? [{ name: 'Mapa de especies del sitio, curvas suavizadas (muestra)', credit: 'No es un mapa oficial. PACE Ambystoma 2018.' }, { name: 'USGS Gap Analysis Project, Species Range Maps CONUS_2001, doi:10.5066/F7Q81B3R', credit: 'Dominio público (muestra: aún no cargado)' }, { name: 'ECCC, Range Map extents, Species at Risk, Canada', credit: 'Open Government Licence - Canada (muestra: aún no cargado)' }]
      : [{ name: 'Mapa de especies del sitio, curvas suavizadas (muestra)', credit: 'No es un mapa oficial. PACE Ambystoma 2018.' }] }
  : { slug, kind: 'range', potential: false, method: 'cells-0.5deg', fuentes: [{ name: 'Mapa de especies del sitio (public/map/mexico-interactive.svg), celdas de 0.5°', credit: 'AxoloDAO' }] };
for (const [slug, polys] of Object.entries(porSlug)) {
  let geom;
  if (slug === 'mavortium') {
    const states = (presence.mavortium ?? []).filter(([iso, ev]) => (ev === 'present' || ev === 'literature') && units.has(iso)).map(([iso]) => units.get(iso).geometry);
    const parts = states.map((g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)).flat();
    // simplify each state before the union so the blob stays range-like, not state-like
    const simp = parts.map((poly) => poly.map((r) => simplify(r.map(([x, y]) => ({ x, y })), 0.6, true).map((p) => [p.x, p.y])));
    geom = pc.union(...simp.filter((p) => p[0].length > 3), ...polys.map((p) => [p]));
  } else geom = pc.union(...polys.map((p) => [p]));
  const mp = POTENCIAL.has(slug) ? geom.map((poly) => poly.map((r, i) => smoothRing(r, `${slug}${i}`, slug === 'mavortium' ? { amp: 0.25, step: 0.8, it: 3 } : {}))) : geom;
  // keep the largest ring of each polygon as the outer one; holes are dropped (a range is not drawn with holes in this sample)
  const polys2 = mp.map((p) => [p[0]]);
  features.push({ type: 'Feature', properties: metaOf(slug), geometry: polys2.length === 1 ? { type: 'Polygon', coordinates: polys2[0] } : { type: 'MultiPolygon', coordinates: polys2 } });
}
// the single-lake species stay markers (IP review, 18-oct: a lake outline, or a 0.1° named marker; no drawn polygon)
const lagos = loc.features.filter((f) => f.geometry.type === 'Point').map((f) => ({ type: 'Feature', properties: { slug: f.properties.slug, kind: 'lake', name: f.properties.name }, geometry: f.geometry }));
writeFileSync(`${out}/rangos-muestra.geojson`, JSON.stringify({ type: 'FeatureCollection', features: [...features, ...lagos] }));

// -- neighbours: two ranges that overlap or come within 0.3° of each other (vertices), lakes within 0.6° of a range
const verts = (g) => (g.type === 'Point' ? [g.coordinates] : (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).flat(2).filter((c) => typeof c[0] === 'number' && c.length === 2));
const polysOf = (f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : []);
const all = [...features, ...lagos];
const near = {};
const minD = (A, B) => { let m = 1e9; for (const a of A) for (const b of B) { const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (d < m) m = d; } return m; };
for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
  const [a, b] = [all[i], all[j]];
  if (a.properties.slug === b.properties.slug) continue;
  const va = verts(a.geometry), vb = verts(b.geometry);
  const [pa, pb] = [polysOf(a), polysOf(b)];
  let touch = minD(va, vb) < (a.geometry.type === 'Point' || b.geometry.type === 'Point' ? 0.6 : 0.3);
  if (!touch && pa.length && pb.length) { try { touch = pc.intersection(pa, pb).length > 0; } catch { /* degenerate */ } }
  if (!touch && (a.geometry.type === 'Point') !== (b.geometry.type === 'Point')) {
    const [pt, poly] = a.geometry.type === 'Point' ? [a, pb] : [b, pa];
    // a lake marker inside a range
    const [x, y] = pt.geometry.coordinates;
    try { touch = pc.intersection(poly, [[[[x - 0.05, y - 0.05], [x + 0.05, y - 0.05], [x + 0.05, y + 0.05], [x - 0.05, y + 0.05], [x - 0.05, y - 0.05]]]]).length > 0; } catch { /* */ }
  }
  if (touch) { (near[a.properties.slug] ??= new Set()).add(b.properties.slug); (near[b.properties.slug] ??= new Set()).add(a.properties.slug); }
}
writeFileSync(`${out}/vecinos-muestra.json`, JSON.stringify(Object.fromEntries(Object.entries(near).map(([k, v]) => [k, [...v].sort()])), null, 1));

// -- water: Natural Earth 50m rivers and lakes (public domain), clipped to North America and simplified
const BOX = [-170, 5, -50, 75];
const inBox = (c) => c[0] >= BOX[0] && c[0] <= BOX[2] && c[1] >= BOX[1] && c[1] <= BOX[3];
const thin = (coords, tol) => simplify(coords.map(([x, y]) => ({ x, y })), tol, true).map((p) => [+p.x.toFixed(2), +p.y.toFixed(2)]);
const ne = (n) => R(`${process.env.NE_DIR}/${n}.geojson`);
const rios = ne('ne_50m_rivers_lake_centerlines').features.filter((f) => f.geometry && verts(f.geometry).some(inBox));
const wf = [];
for (const f of rios) {
  const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const l of lines) { const t = thin(l.filter(inBox), 0.03); if (t.length > 1) wf.push({ type: 'Feature', properties: { kind: 'river', name: f.properties.name ?? null }, geometry: { type: 'LineString', coordinates: t } }); }
}
for (const f of ne('ne_50m_lakes').features) {
  if (!f.geometry || !verts(f.geometry).some(inBox)) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const keep = polys.map((p) => [thin(p[0], 0.03)]).filter((p) => p[0].length > 3);
  if (keep.length) wf.push({ type: 'Feature', properties: { kind: 'lake', name: f.properties.name ?? null }, geometry: { type: 'MultiPolygon', coordinates: keep } });
}
writeFileSync(`${out}/agua-muestra.geojson`, JSON.stringify({ type: 'FeatureCollection', features: wf }));

// -- the grid and the sheet's text, for every species, from the bundle and the verified dossier (e5ce383, read with git show)
const DOSSIER = process.env.DOSSIER_REPO;
const hecho = (slug) => { try { return JSON.parse(execFileSync('git', ['-C', DOSSIER, 'show', `e5ce383:context/datos/dossier/hechos/${slug}.json`], { encoding: 'utf8', maxBuffer: 1e7 })); } catch { return null; } };
const vida = (txt) => (/^neot[eé]nic/.test(txt) ? 'obligada' : /^facultativa/.test(txt) ? 'facultativa' : 'no');
const fichas = {};
for (const e of bundle.especies) {
  const d = hecho(e.slug);
  const fv = d?.hechos.find((h) => h.campo === 'forma_de_vida');
  const v = fv?.valores?.[0];
  const ev = v?.evidencia?.[0];
  const cat = (sys, scope) => e.categories.find((c) => c.system === sys && (!scope || c.scope === scope));
  fichas[e.slug] = {
    neoteny: v ? { value: vida(v.valor), detail: v.valor, state: fv.estado, source: ev.fuente, page: ev.pagina ?? null } : null,
    metamorphosis: v ? { value: vida(v.valor) === 'obligada' ? 'no' : 'yes', detail: v.valor, state: fv.estado, source: ev.fuente, page: ev.pagina ?? null } : null,
    regeneration: { value: 'unstudied', detail: null, source: null, page: null },   // D4 default: no study cited
    iucn: cat('iucn', 'global') ? { value: cat('iucn', 'global').category, source: cat('iucn', 'global').source } : null,
    national: { MX: cat('nom059', 'MX')?.category ?? null, US: cat('esa', 'US')?.category ?? null, CA: e.categories.filter((c) => c.system === 'sara' || c.system === 'cosewic').map((c) => c.category) },
    habitat: null,
  };
}
// sample habitat cells for the two sheets (our own Spanish label for an IUCN Habitats 3.1 code, codes only; no IUCN text)
fichas.andersoni.habitat = { label: 'Laguna permanente', codes: ['5.5'], sample: true };
fichas.mavortium.habitat = { label: 'Lagunas y charcas', codes: ['5.5', '5.7', '5.8'], sample: true };
// elevation and main threat: real where the site or the dossier carries them (two species here), otherwise the cell reads «sin dato»
fichas.andersoni.altitude = { min: 2000, max: 2000, source: 'krebs-brandon-1984', page: null, note: 'localidad tipo, Laguna de Zacapu' };
fichas.mavortium.altitude = { min: 200, max: 1500, source: 'pace-ambystoma-2018', page: '36 (página del PDF)' };
fichas.andersoni.threat = { label: 'Pérdida de hábitat', code: '1.1', sample: true, source: 'aguilar-miguel-2005', page: null };
// ex situ: how many facilities of the committed catalogue name the species (a count, never a place)
const inst = R('src/data/atlas-snapshot/instalaciones-catalogadas.geojson');
for (const e of bundle.especies) {
  const n = new Set(inst.features.filter((f) => new RegExp(`(A\\.|Ambystoma)\\s*${e.slug}\\b`, 'i').test(f.properties.especies ?? '')).map((f) => f.properties.id)).size;
  fichas[e.slug].exsitu = n ? { n, source: 'instalaciones-catalogadas' } : null;
}
writeFileSync(`${out}/fichas-muestra.json`, JSON.stringify(fichas, null, 1));

// no sample feeding text: only the site's own curated text is used (nobody writes a missing one in the prototype)
writeFileSync(`${out}/alimentacion-muestra.json`, '{}\n');
console.log('ranges', features.length, 'lakes', lagos.length, 'water', wf.length, 'neighbours', Object.keys(near).length);

// -- SYNTHETIC points standing in for the two CONABIO CC BY-NC layers (UMA extensivas, water quality 2013), so the prototype can show the NC toggles. Random places inside Mexico, no real site.
{
  const mx = admin1.features.filter((f) => f.properties.iso.startsWith('MX'));
  const rnd = prng(hash('nc-muestra'));
  const inside = (pt, g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some((poly) => { const r = poly[0]; let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > pt[1]) !== (r[j][1] > pt[1]) && pt[0] < ((r[j][0] - r[i][0]) * (pt[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; });
  const make = (n) => { const fs = []; while (fs.length < n) { const pt = [-117 + rnd() * 31, 14.5 + rnd() * 18]; if (mx.some((f) => inside(pt, f.geometry))) fs.push({ type: 'Feature', properties: { sitio: `muestra-${fs.length + 1}` }, geometry: { type: 'Point', coordinates: [+pt[0].toFixed(2), +pt[1].toFixed(2)] } }); } return { type: 'FeatureCollection', features: fs }; };
  writeFileSync(`${out}/nc-uma.geojson`, JSON.stringify(make(140)));
  writeFileSync(`${out}/nc-agua.geojson`, JSON.stringify(make(180)));
}
