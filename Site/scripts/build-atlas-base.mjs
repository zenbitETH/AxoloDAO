// Atlas base geometry: Natural Earth 1:10m admin-1 (public domain).
//   node scripts/build-atlas-base.mjs [--ne <dir with the .shp>] [--admin1 <admin1.geojson>]
// Two outputs from two inputs:
//   src/data/atlas-snapshot/admin1.geojson   the 96 admin-1 units of Mexico, the United States and Canada for the MapLibre atlas,
//                                        from Site & Data's admin1.geojson (Natural Earth 1:10m v5.1.1, mapshaper 0.7.80, Visvalingam 8%
//                                        keep-shapes, islands under 50 km² removed, 0.001°; iso = ISO 3166-2 with MX-DIF mapped to MX-CMX,
//                                        inegiCve the bridge to the INEGI state code). Property names are the hub's /v1/admin1.geojson ones. The file is pinned by its sha256 below: a different
//                                        file stops the build until the pin is changed on purpose.
//   src/data/atlas/mx-estados-svg.json   Mexico's 32 states as d3-geo geoConicConformal paths, for build-time SVG maps, from Natural Earth
//                                        itself, cached OUTSIDE git (~/.cache/axolodao-atlas) and downloaded when missing.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoConicConformal, geoPath } from 'd3-geo';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(homedir(), '.cache', 'axolodao-atlas');
const NE_URL = 'https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip';
const MAX_BYTES = 400 * 1024;
const ADMIN1_SHA256 = '1fa6495a026f03e0db89a7358b327b6d0d0bc850bd882f2ee0ac7c9061a988a0';
const ADMIN1_DEFAULT = join(homedir(), '.cache', 'axolodao-datos', 'open', 'entities', '2fc53762746a-admin1', 'admin1.geojson');
const ADMIN1_MAX_BYTES = 300 * 1024;

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};

async function neShapefile() {
  const dir = arg('--ne') ?? join(CACHE, 'ne_10m_admin_1');
  const shp = join(dir, 'ne_10m_admin_1_states_provinces.shp');
  if (existsSync(shp)) return shp;
  mkdirSync(CACHE, { recursive: true });
  const zip = join(CACHE, 'ne_10m_admin_1.zip');
  if (!existsSync(zip)) {
    const r = await fetch(NE_URL);
    if (!r.ok) throw new Error(`Natural Earth download failed: ${r.status}`);
    writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
  }
  execFileSync('unzip', ['-o', '-q', zip, '-d', dir]);
  return shp;
}

// Entity table (INEGI): cve_ent, iso (MX-XXX), abrev, nombre. Natural Earth still calls the capital MX-DIF.
const entidades = readFileSync(join(SITE, 'scripts/fixtures/entidades.csv'), 'utf8').trim().split('\n').slice(1).map((l) => {
  const [cve_ent, iso, abrev, nombre] = l.split(',');
  return { cve_ent, iso, abrev, nombre };
});
const NE_TO_ISO = { 'MX-DIF': 'MX-CMX' };

const shp = await neShapefile();
const work = mkdtempSync(join(tmpdir(), 'atlas-'));
const out = join(work, 'mx.geojson');
const mapshaper = join(SITE, 'node_modules/.bin/mapshaper');
let pct = Number(arg("--simplify") ?? 15);
let geo;
for (;;) {
  execFileSync(mapshaper, [shp, '-filter', 'adm0_a3 == "MEX" && !!name', '-simplify', 'visvalingam', `${pct}%`, 'keep-shapes',
    '-filter-fields', 'iso_3166_2,name', '-o', out, 'format=geojson', 'precision=0.001', 'force'], { stdio: 'pipe' });
  geo = JSON.parse(readFileSync(out, 'utf8'));
  const compact = JSON.stringify(shape(geo));
  if (Buffer.byteLength(compact) <= MAX_BYTES || pct <= 0.5) break;
  pct = Math.round(pct * 0.75 * 100) / 100;
}

function shape(g) {
  const features = g.features.map((f) => {
    const iso = NE_TO_ISO[f.properties.iso_3166_2] ?? f.properties.iso_3166_2;
    const e = entidades.find((x) => x.iso === iso);
    if (!e) throw new Error(`Natural Earth feature ${f.properties.iso_3166_2} has no entry in entidades.csv`);
    return { type: 'Feature', properties: { iso, cve_ent: e.cve_ent, nombre: e.nombre }, geometry: f.geometry };
  });
  features.sort((a, b) => a.properties.cve_ent.localeCompare(b.properties.cve_ent));
  return { type: 'FeatureCollection', features };
}

const fc = shape(geo);
const isos = new Set(fc.features.map((f) => f.properties.iso));
const faltan = entidades.filter((e) => !isos.has(e.iso)).map((e) => e.iso);
if (fc.features.length !== 32 || faltan.length) throw new Error(`expected 32 states, got ${fc.features.length}; missing ${faltan.join(',')}`);

mkdirSync(join(SITE, 'public/atlas'), { recursive: true });
mkdirSync(join(SITE, 'src/data/atlas'), { recursive: true });

// -- the admin-1 base of the atlas: delivered, pinned, checked, and written with the properties the atlas reads
const admin1Path = arg('--admin1') ?? ADMIN1_DEFAULT;
const admin1Raw = readFileSync(admin1Path);
const admin1Sha = createHash('sha256').update(admin1Raw).digest('hex');
if (admin1Sha !== ADMIN1_SHA256) throw new Error(`${admin1Path} has sha256 ${admin1Sha}, not the pinned ${ADMIN1_SHA256}`);
const admin1 = JSON.parse(admin1Raw.toString('utf8'));
const unidades = admin1.features.map((f) => {
  const p = f.properties;
  if (!/^(MX|US|CA)-[A-Z0-9]{2,3}$/.test(p.iso) || p.country !== p.iso.slice(0, 2) || !p.name_es || !p.name_en) throw new Error(`admin1: a bad unit ${JSON.stringify(p)}`);
  if (!['Polygon', 'MultiPolygon'].includes(f.geometry?.type)) throw new Error(`admin1: ${p.iso} has no polygon`);
  const props = { iso: p.iso, country: p.country, nameEs: p.name_es, nameEn: p.name_en, inegiCve: null };
  if (p.country === 'MX') {
    const e = entidades.find((x) => x.iso === p.iso);
    if (!e || e.cve_ent !== p.inegi_cve) throw new Error(`admin1: ${p.iso} does not match the INEGI entity table`);
    props.inegiCve = Number(e.cve_ent);
  } else if (p.inegi_cve !== undefined) throw new Error(`admin1: ${p.iso} carries an INEGI code`);
  return { type: 'Feature', properties: props, geometry: f.geometry };
}).sort((a, b) => a.properties.iso.localeCompare(b.properties.iso));
const cuenta = (c) => unidades.filter((u) => u.properties.country === c).length;
if (unidades.length !== 96 || cuenta('MX') !== 32 || cuenta('US') !== 51 || cuenta('CA') !== 13 || new Set(unidades.map((u) => u.properties.iso)).size !== 96) throw new Error('admin1: expected 96 unique units (MX 32, US 51, CA 13)');
const admin1Out = JSON.stringify({ type: 'FeatureCollection', features: unidades }) + '\n';
if (Buffer.byteLength(admin1Out) > ADMIN1_MAX_BYTES) throw new Error(`admin1.geojson is ${Buffer.byteLength(admin1Out)} bytes, over ${ADMIN1_MAX_BYTES}`);
writeFileSync(join(SITE, 'src/data/atlas-snapshot/admin1.geojson'), admin1Out);

const W = 800, H = 540;
// d3-geo reads polygons on the sphere: exterior rings must run clockwise, and GeoJSON (RFC 7946, what mapshaper writes) runs them counter-clockwise.
const alReves = (g) => ({ ...g, coordinates: g.type === 'Polygon' ? g.coordinates.map((r) => [...r].reverse()) : g.coordinates.map((p) => p.map((r) => [...r].reverse())) });
const projection = geoConicConformal().parallels([17.5, 29.5]).rotate([102, 0]).fitSize([W, H], { type: 'FeatureCollection', features: fc.features.map((f) => ({ type: 'Feature', geometry: alReves(f.geometry) })) });
const path = geoPath(projection).digits(1);
const svg = { viewBox: `0 0 ${W} ${H}`, projection: 'geoConicConformal parallels [17.5, 29.5] rotate [102, 0]', source: 'Natural Earth 1:10m admin-1 (public domain)',
  states: fc.features.map((f) => ({ ...f.properties, d: path({ type: 'Feature', geometry: alReves(f.geometry) }) })) };
writeFileSync(join(SITE, 'src/data/atlas/mx-estados-svg.json'), JSON.stringify(svg) + '\n');
console.log(`admin1.geojson: ${unidades.length} units, ${statSync(join(SITE, 'src/data/atlas-snapshot/admin1.geojson')).size} bytes`);
console.log(`mx-estados-svg.json: ${svg.states.length} paths, ${statSync(join(SITE, 'src/data/atlas/mx-estados-svg.json')).size} bytes`);
