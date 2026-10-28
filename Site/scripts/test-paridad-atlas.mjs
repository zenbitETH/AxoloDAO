// State A's parity condition (lib/paridadAtlas.mjs; review, 22-oct): every served atlas file names its bundles, each in `cubre` with the
// same manifest hash, and in a hub build the hub parity passed.   node scripts/test-paridad-atlas.mjs
import { ARCHIVOS } from '../src/lib/atlasSnapshot.mjs';
import { paridad } from '../src/lib/paridadAtlas.mjs';

let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };

const h = (c) => `0x${c.repeat(64)}`;
const LOC = { id: 'a1d128c4bf4c-localidades', manifestSha256: h('a') };
const GEN = { id: '944f8dbc53b0-genero', manifestSha256: h('b') };
const CAPAS = { id: '5e8591b04e51', manifestSha256: h('c') };
const foto = { lectura: { resultado: 'coincide' }, cubre: [LOC, GEN, CAPAS].map((b) => ({ ...b, datos: 'load:species-atlas' })), noCubiertos: [] };
// every served file, each from the bundles it names
const servidos = (cambio = {}) => Object.fromEntries(ARCHIVOS.map((n) => [n, { fuente: 'archivo', generadoDe: { bundles: [GEN, LOC] }, ...cambio[n] }]));

ok(paridad(servidos(), foto).ok, 'every file names bundles that the attestation covers, with the same hashes: parity holds');

const viejo = paridad(servidos({ 'especies-localidades.geojson': { generadoDe: { bundles: [{ ...LOC, manifestSha256: h('d') }] } } }), foto);
ok(!viejo.ok && viejo.problemas.some((p) => p.includes('otro manifiesto')), 'a file built from a stale bundle (same id, another manifest): no parity');

const sinCampo = paridad(servidos({ 'admin1.geojson': { generadoDe: undefined } }), foto);
ok(!sinCampo.ok && sinCampo.problemas.some((p) => p.startsWith('admin1.geojson') && p.includes('generadoDe.bundles')), 'a file without its provenance field: no parity');

const vacio = paridad(servidos({ 'admin1.geojson': { generadoDe: { bundles: [] } } }), foto);
ok(!vacio.ok, 'a file whose provenance lists no bundle: no parity');

const ajeno = paridad(servidos({ 'estados-metricas.json': { generadoDe: { bundles: [{ id: 'f1f0345e09b6', manifestSha256: h('e') }] } } }), foto);
ok(!ajeno.ok && ajeno.problemas.some((p) => p.includes('no cubre')), 'a file built from a bundle the attestation does not cover: no parity');

const falta = servidos(); delete falta['especies-atlas.json'];
ok(!paridad(falta, foto).ok, 'a declared file the build does not serve: no parity');

ok(!paridad(servidos({ 'admin1.geojson': { generadoDe: { bundles: [{ id: LOC.id }] } } }), foto).ok, 'a provenance entry without its manifest hash: no parity');
ok(paridad(servidos({ 'admin1.geojson': { generadoDe: { bundles: [{ ...LOC, manifestSha256: LOC.manifestSha256.toUpperCase().replace('0X', '0x') }] } } }), foto).ok,
  'hash case does not matter');

ok(!paridad(servidos(), foto, { hub: true }).ok, 'a hub build whose files do not say the hub parity passed: no parity');
ok(paridad(servidos(Object.fromEntries(ARCHIVOS.map((n) => [n, { paridadHub: true }]))), foto, { hub: true }).ok, 'a hub build with the hub parity passed on every file: parity holds');
ok(!paridad(servidos(), undefined).ok, 'no snapshot: no parity');

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
