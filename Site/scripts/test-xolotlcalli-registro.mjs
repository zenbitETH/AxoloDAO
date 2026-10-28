// The Xolotlcalli registry files (scripts/xolotlcalli-registro.mjs) carry nothing the IP review rules out, and the bytes are what the sources give.
//   1. the committed files are byte for byte what the script derives from AxoloDAO 7757599 and the pinned pilot card;
//   2. the listing parses, names every served file with its sha256, and nothing else is served;
//   3. no JSON key of any file belongs to a denied class (weight, length, cause, necropsy, hash, photo, treatment, feeding), and no value names one;
//   4. no specimen name under embargo (the site's digests, lib/xlsx-utils.mjs EMBARGO_SHA256);
//   5. no alias or organism id of the replay that the public data never published (the replay's private alias lists, local only);
//   6. no byte of any file carries a local path, a private repository, the booth database or a generator record (lib/barridoBinario.mjs).
// A failure names its class and the file, never the matched text. The names of people are checked by the keyed test:
//   AXOLODAO_PERSONAS_CLAVE=… node scripts/test-no-personal-data.mjs public/xolotlcalli/datos/huella
//   node scripts/test-xolotlcalli-registro.mjs   (BRAIN_HUB_DATOS set; REPLAY_PRIVADO overrides where the replay's private lists are read)
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hallazgosBinarios } from './lib/barridoBinario.mjs';
import { scanTree } from './lib/embargo-scan.mjs';
import { leerListado, verificarHuella } from './lib/huella.mjs';
import { EMBARGO_SHA256 } from './lib/xlsx-utils.mjs';
import { BUNDLE, COMMIT_SITIO, SALIDA } from './xolotlcalli-registro.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPLAY_PRIVADO = process.env.REPLAY_PRIVADO ?? join(homedir(), '.cache/axolodao-datos/control-operativo/replay/6544ee3-semilla-b6f206d/private');

/** The denied classes: a JSON key that matches one fails, and so does a value that names one of the word classes. */
export const CLASES = [
  ['peso/weight', /peso|weight/i, /\b(?:peso|weight)/i],
  ['longitud/length', /longitud|length/i, null],
  ['causa/cause', /causa|cause/i, /\b(?:causa|cause)\b/i],
  ['necropsia', /necrop/i, /necrop/i],
  ['sha256 de un ejemplar', /sha256/i, null],
  ['foto/photo/img', /foto|photo|img/i, null],
  ['terapéutica', /terap/i, /terap[eé]ut/i],
  ['alimentación', /aliment/i, /aliment/i],
];
// a key of a denied class that is not about a specimen: the tanks' own dimensions (estanques.json, system.dimensions.lengthCm)
const PERMITIDAS = [['estanques.json', 'system.dimensions.lengthCm']];
const todos = (d) => readdirSync(d).flatMap((n) => { const f = join(d, n); return statSync(f).isDirectory() ? todos(f) : [f]; });
const leerJson = (f) => (f.endsWith('.jsonl') ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : JSON.parse(readFileSync(f, 'utf8')));

/** Each denied class found in a folder's JSON files, as «file: class (key|value)», never the text. */
export function clasesNegadas(dir) {
  const out = new Set();
  for (const f of todos(dir).filter((x) => /\.jsonl?$/.test(x))) {
    const rel = f.slice(dir.length + 1);
    const anda = (o, ruta = '') => {
      if (Array.isArray(o)) return o.forEach((v) => anda(v, ruta));
      if (o && typeof o === 'object') return Object.entries(o).forEach(([k, v]) => {
        const aqui = ruta ? `${ruta}.${k}` : k;
        const permitida = PERMITIDAS.some(([a, r]) => rel.endsWith(a) && r === aqui);
        if (!permitida) for (const [c, rk] of CLASES) if (rk.test(k)) out.add(`${rel}: ${c} (clave)`);
        anda(v, aqui);
      });
      if (typeof o === 'string') for (const [c, , rv] of CLASES) if (rv && rv.test(o)) out.add(`${rel}: ${c} (valor)`);
    };
    anda(leerJson(f));
  }
  return [...out];
}

const norm = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/** The replay's aliases and organism ids that the site's public data never published, read from the replay's private lists. */
export function aliasPrivados(privado, textoPublico) {
  const filas = (n) => readFileSync(join(privado, n), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const pub = norm(textoPublico);
  return [...filas('organism_aliases.jsonl').map((a) => a.alias), ...filas('organisms.jsonl').map((o) => o.id)].map((x) => norm(x).trim()).filter((x) => x && !pub.includes(x));
}
/** The files of a folder that carry one of those aliases as a whole word, never the alias. */
export const conAliasPrivado = (dir, alias) => todos(dir).filter((f) => {
  const t = norm(readFileSync(f, 'utf8'));
  return alias.some((a) => new RegExp(`(?<![a-z0-9])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`).test(t));
}).map((f) => f.slice(dir.length + 1));

let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };

// ---- planted: each class caught by name, never by its text ----------------------------------------------------------------------------------
{
  const d = mkdtempSync(join(tmpdir(), 'xolo-'));
  const planta = (n, o) => writeFileSync(join(d, n), JSON.stringify(o));
  planta('a.json', { ejemplares: [{ id: 'x', peso: 12 }] });
  planta('b.json', { filas: [{ nota: 'murió por Causa desconocida' }] });
  planta('c.json', { fotoUrl: 'x.webp', sha256: 'ab' });
  planta('d.json', { texto: 'tratamiento terapéutico y alimentación' });
  writeFileSync(join(d, 'e.jsonl'), `${JSON.stringify({ largoLongitud: 3 })}\n`);
  const h = clasesNegadas(d);
  for (const [c, nombre] of [['peso/weight', 'a.json'], ['causa/cause', 'b.json'], ['foto/photo/img', 'c.json'], ['sha256 de un ejemplar', 'c.json'], ['terapéutica', 'd.json'], ['alimentación', 'd.json'], ['longitud/length', 'e.jsonl']]) {
    ok(h.some((x) => x.startsWith(`${nombre}: ${c}`)), `planted: ${c} in ${nombre} is caught`);
  }
  ok(!h.some((x) => /desconocida|x\.webp|terapéutico y/.test(x)), 'planted: a failure names its class, never the text');
  planta('limpio.json', { ejemplares: [{ id: 'x', estado: 'baja', estadoFecha: '2026-01-01', historial: [{ fecha: '2026-01-01', anterior: 'vivo', nuevo: 'baja' }] }] });
  ok(!clasesNegadas(d).some((x) => x.startsWith('limpio.json')), 'planted: a death as a status with a date passes');
  planta('estanques.json', [{ id: 'AA', system: { dimensions: { lengthCm: 55 } } }]); planta('otro.json', [{ system: { dimensions: { lengthCm: 55 } } }]);
  const t = clasesNegadas(d);
  ok(!t.some((x) => x.startsWith('estanques.json')) && t.some((x) => x.startsWith('otro.json: longitud/length')), 'planted: a tank\'s own length passes only at its path in estanques.json');
  rmSync(d, { recursive: true, force: true });
  const e = mkdtempSync(join(tmpdir(), 'xolo-alias-'));
  writeFileSync(join(e, 'p.json'), JSON.stringify({ nombre: 'Quetzal' })); writeFileSync(join(e, 'q.json'), JSON.stringify({ nombre: 'Quetzalito' }));
  ok(JSON.stringify(conAliasPrivado(e, ['quetzal'])) === JSON.stringify(['p.json']), 'planted: a private alias is caught as a whole word, and the file is named');
  rmSync(e, { recursive: true, force: true });
}

// ---- the site's own specimen files at the source commit carry the classes, so the test can see them ----------------------------------------
{
  const d = mkdtempSync(join(tmpdir(), 'xolo-origen-'));
  for (const f of ['Site/src/data/ajolotes/bundle.json', 'Site/public/data/ajolotes/seguimiento.json', 'Site/public/data/ajolotes/bajas-forense.json']) {
    writeFileSync(join(d, f.split('/').pop()), execFileSync('git', ['-C', SITE, 'show', `${COMMIT_SITIO}:${f}`], { maxBuffer: 1 << 27 }));
  }
  const h = clasesNegadas(d);
  const tiene = (archivo, c) => h.some((x) => x.startsWith(`${archivo}: ${c}`));
  ok(['peso/weight', 'causa/cause', 'necropsia', 'terapéutica', 'alimentación'].every((c) => tiene('bundle.json', c)) && tiene('seguimiento.json', 'peso/weight')
    && ['causa/cause', 'necropsia', 'sha256 de un ejemplar'].every((c) => tiene('bajas-forense.json', c)), `the site's own specimen files at ${COMMIT_SITIO} fail here (bundle: weight, cause, necropsy, treatment, feeding; seguimiento: weight; bajas-forense: cause, necropsy, sha256)`);
  rmSync(d, { recursive: true, force: true });
}

// ---- the committed files ------------------------------------------------------------------------------------------------------------------
const r = spawnSync(process.execPath, [join(SITE, 'scripts/xolotlcalli-registro.mjs'), '--check'], { encoding: 'utf8' });
ok(r.status === 0, `the committed files are byte for byte what AxoloDAO ${COMMIT_SITIO} and the pinned pilot card give${r.status ? ` (${(r.stdout + r.stderr).trim().split('\n').pop()})` : ''}`);
const listadoRuta = join(SALIDA, 'listado-stand.txt');
let listado = null; try { listado = leerListado(readFileSync(listadoRuta, 'utf8')); } catch (e) { ok(false, `the listing parses (${e.message})`); }
if (listado) {
  ok(listado.bundles.length === 1 && listado.bundles[0].id === BUNDLE && listado.archivos.length === 7, `the listing names one bundle (${BUNDLE}) and its 7 files`);
  const mal = verificarHuella({ listadoRuta, salida: SALIDA }).filter((m) => !/^index\.html|^build\.json/.test(m));
  ok(mal.length === 0, `every listed file is served with its listed sha256, and nothing else${mal.length ? ` (${mal.slice(0, 3).join('; ')})` : ''}`);
}
const negadas = clasesNegadas(SALIDA);
ok(negadas.length === 0, `no key or value of a denied class${negadas.length ? `: ${negadas.join('; ')}` : ''}`);
const embargo = scanTree(SALIDA, EMBARGO_SHA256);
const nEmbargo = Array.isArray(embargo) ? embargo.length : (embargo?.hits?.length ?? embargo?.length ?? 0);
ok(nEmbargo === 0, `no specimen name under embargo (digest match)${nEmbargo ? ` in ${nEmbargo} place(s)` : ''}`);
if (!existsSync(join(REPLAY_PRIVADO, 'organism_aliases.jsonl'))) ok(false, 'the replay\'s private alias lists are not on this machine: the alias check cannot run, so it fails closed (set REPLAY_PRIVADO)');
else {
  const fuentes = ['Site/src/data/ajolotes/bundle.json', 'Site/public/data/ajolotes/bajas-forense.json', 'Site/public/data/ajolotes/seguimiento.json'].map((f) => execFileSync('git', ['-C', SITE, 'show', `${COMMIT_SITIO}:${f}`], { maxBuffer: 1 << 27 }).toString('utf8')).join('\n');
  const privados = aliasPrivados(REPLAY_PRIVADO, fuentes);
  const con = conAliasPrivado(SALIDA, privados);
  ok(privados.length > 0 && con.length === 0, `no replay alias or organism id that the public data never published (${privados.length} checked)${con.length ? `: found in ${con.join(', ')}` : ''}`);
}
const binarios = hallazgosBinarios(SALIDA);
ok(binarios.length === 0, `no byte carries a local path, a private repository, the booth database or a generator record${binarios.length ? ` (${binarios.length})` : ''}`);
// the copy a test makes must not be mistaken for the served folder
ok(!readdirSync(SALIDA).some((n) => n.startsWith('xolo-')), 'no planted folder left in the served folder');

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
