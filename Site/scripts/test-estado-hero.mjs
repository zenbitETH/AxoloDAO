// The hero's decision (lib/estadoHero.mjs) on a fixture that reaches state A, and one case for each condition that must drop it to B.
// Shared by the build and the post-build check, so a mutant of the A logic shows here.   node scripts/test-estado-hero.mjs
import { ARCHIVOS } from '../src/lib/atlasSnapshot.mjs';
import { decidir, FRESCURA_DIAS, leidoEl } from '../src/lib/estadoHero.mjs';

let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };

const DIA = 24 * 60 * 60 * 1000;
const AHORA = Date.parse('2026-10-22T13:00:00Z');
const h = (c) => `0x${c.repeat(64)}`;
const B = {
  genero: { id: '944f8dbc53b0-genero', manifestSha256: h('1'), datos: 'load:species-atlas, load:taxa' },
  localidades: { id: 'a1d128c4bf4c-localidades', manifestSha256: h('2'), datos: 'load:species-atlas' },
  perfiles: { id: '735c7b3021a1-perfiles', manifestSha256: h('3'), datos: 'load:species-atlas' },
  morfometria: { id: 'a1d128c4bf4c-morfometria', manifestSha256: h('4'), datos: 'load:species-atlas' },
  admin1: { id: '4216080f8b97-admin1', manifestSha256: h('5'), datos: 'load:species-atlas' },
  capas: { id: '5e8591b04e51', manifestSha256: h('6'), datos: 'load:layers, load:species-states' },
};
const foto = (cambio = {}) => ({ lectura: { resultado: 'coincide' }, cubre: Object.values(B), noCubiertos: [], leidoEl: new Date(AHORA - DIA).toISOString(), ...cambio });
// what each served file is built from, as the atlas import writes it
const DE = {
  'especies-atlas.json': [B.genero, B.perfiles, B.morfometria, B.localidades], 'especies-localidades.geojson': [B.genero, B.localidades],
  'admin1.geojson': [B.admin1], 'especies-por-estado.json': [B.capas], 'estados-metricas.json': [B.capas], 'instalaciones-catalogadas.geojson': [B.capas],
};
const servidos = (cambio = {}) => Object.fromEntries(ARCHIVOS.map((n) => [n, {
  fuente: 'hub', paridadHub: true, generadoDe: { bundles: DE[n].map(({ id, manifestSha256 }) => ({ id, manifestSha256 })) }, ...cambio[n] }]));

const a = decidir({ snapshot: foto(), servidos: servidos(), ahora: AHORA });
ok(a.estado === 'A' && a.alcance === 'atlas' && a.leido === AHORA - DIA && a.problemas.length === 0, 'fixture: a fresh «coincide» over a strict hub read of the covered bundles is state A, «el atlas», with its read date');

const b = (descripcion, entrada) => {
  const d = decidir({ snapshot: foto(), servidos: servidos(), ahora: AHORA, ...entrada });
  ok(d.estado === 'B' && d.leido === null && d.problemas.length > 0, `${descripcion}: state B (${d.problemas[0] ?? 'no reason given'})`);
};
b('no snapshot', { snapshot: undefined });
b('the snapshot does not read «coincide»', { snapshot: foto({ lectura: { resultado: 'no coincide' } }) });
b(`read ${FRESCURA_DIAS} days and one hour before the build`, { snapshot: foto({ leidoEl: new Date(AHORA - FRESCURA_DIAS * DIA - 3600e3).toISOString() }) });
b('read two hours in the future', { snapshot: foto({ leidoEl: new Date(AHORA + 2 * 3600e3).toISOString() }) });
b('no read date', { snapshot: foto({ leidoEl: undefined }) });
b('a file from the committed copy (fuente «archivo»), even if it says paridadHub', { servidos: servidos({ 'admin1.geojson': { fuente: 'archivo' } }) });
b('a hub file without paridadHub', { servidos: servidos({ 'especies-atlas.json': { paridadHub: undefined } }) });
b('a file built from a stale bundle', { servidos: servidos({ 'especies-localidades.geojson': { generadoDe: { bundles: [{ id: B.localidades.id, manifestSha256: h('9') }] } } }) });
b('a file without its provenance', { servidos: servidos({ 'estados-metricas.json': { generadoDe: undefined } }) });
b('a file the build does not serve', { servidos: Object.fromEntries(Object.entries(servidos()).filter(([n]) => n !== 'admin1.geojson')) });
b('a snapshot that covers neither species nor localities', { snapshot: foto({ cubre: [B.admin1, B.capas] }) });

const parcial = decidir({ snapshot: foto({ noCubiertos: [{ id: 'x' }] }), servidos: servidos(), ahora: AHORA });
ok(parcial.estado === 'A' && parcial.alcance === 'especies', 'a snapshot with a bundle left out keeps A when the served files are covered, with «las especies del atlas»');
const borde = decidir({ snapshot: foto({ leidoEl: new Date(AHORA - FRESCURA_DIAS * DIA).toISOString() }), servidos: servidos(), ahora: AHORA });
ok(borde.estado === 'A', `read exactly ${FRESCURA_DIAS} days before the build: still fresh`);
ok(leidoEl({ lectura: { leidoEl: '2026-10-22T11:54:17.948Z' } }) === Date.parse('2026-10-22T11:54:17.948Z') && leidoEl({ leidoEl: 'ayer' }) === null, 'the read date is taken from leidoEl (top level or inside lectura) and must parse');

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
