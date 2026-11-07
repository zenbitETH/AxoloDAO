// Embargo: the committed digests are keyed (HMAC-SHA256 with AXOLODAO_PERSONAS_CLAVE) with no keyless fallback, and neither the source nor the
// built site carries a withheld name. The mechanism is tested with a test key and a synthetic name; the committed file is read with the real key,
// and without it this test fails closed. It prints counts, never a matched name: a path that matches carries it (--rutas lists the paths locally).
//   AXOLODAO_PERSONAS_CLAVE=… node scripts/test-embargo.mjs            digests, matching, the committed file and the source scan
//   AXOLODAO_PERSONAS_CLAVE=… node scripts/test-embargo.mjs --dist     also scans dist/ (run the build first)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { embargoDigest, leerEmbargo, mentionsEmbargoed } from './lib/embargo.mjs';
import { scanTree } from './lib/embargo-scan.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RUTAS = process.argv.includes('--rutas');
let failed = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) failed++; };
/** True when `f` throws (and, given `re`, with a message that matches it). */
const lanza = (f, re) => { try { f(); return false; } catch (e) { return re ? re.test(e.message) : true; } };
const rutas = (hits) => (RUTAS && hits.length ? `: ${hits.join(', ')}` : '');

const claveReal = process.env.AXOLODAO_PERSONAS_CLAVE;
const CLAVE_DE_PRUEBA = 'cd'.repeat(32);   // 32 bytes that are not the real key
const OTRA_CLAVE = 'ef'.repeat(32);
const tmp = mkdtempSync(join(tmpdir(), 'embargo-'));
try {
  process.env.AXOLODAO_PERSONAS_CLAVE = CLAVE_DE_PRUEBA;
  // A synthetic word stands in for the withheld name, so the mechanism is tested without writing it down.
  const probe = new Set([embargoDigest('Zzfixtura')]);

  console.log('digests, with a test key');
  ok([...probe].every((d) => /^[0-9a-f]{64}$/.test(d)), 'a digest is a hex HMAC-SHA256');
  // A mid-word accent: a final one is split off by the word split alone, so it does not prove the accent fold.
  ok(probe.has(embargoDigest('zzfixtura')) && probe.has(embargoDigest('ZZFIXTURÁ')) && probe.has(embargoDigest('zzfíxtura')), 'the digest folds case and accents');

  console.log('matching');
  ok(probe.has(embargoDigest('Zzfixtura')) && probe.has(embargoDigest('  zzfixturá ')), 'an alias in any case or accent is matched');
  ok(!probe.has(embargoDigest('Zzfixtura 2')) && !probe.has(embargoDigest('Zzotra')), 'a different alias is not');
  ok(mentionsEmbargoed('visto junto a zzfixtura, ayer', probe) && mentionsEmbargoed('ZZFIXTURA.', probe), 'free text that names it is matched');
  ok(!mentionsEmbargoed('zzfixturas', probe) && !mentionsEmbargoed('xzzfixtura', probe), 'no substring matching');
  ok(mentionsEmbargoed('a dos palabras', new Set([embargoDigest('dos palabras')])), 'a two-word phrase is matched');
  ok(lanza(() => mentionsEmbargoed('zzfixtura')), 'matching without the embargo digests throws, it never passes');

  console.log('scanner');
  const arbol = join(tmp, 'arbol');
  mkdirSync(join(arbol, 'photos'), { recursive: true });
  writeFileSync(join(arbol, 'photos', 'zzfixtura.webp'), 'x');
  writeFileSync(join(arbol, 'a.js'), 'const k = {zzfixtura: 1};');
  writeFileSync(join(arbol, 'b.json'), '{"nota":"ok"}');
  ok(JSON.stringify(scanTree(arbol, probe).sort()) === JSON.stringify(['a.js', join('photos', 'zzfixtura.webp')]), 'finds a path hit and a content hit, and only those');
  ok(lanza(() => scanTree(arbol, new Set())), 'the scanner refuses an empty set of digests');

  console.log('the rehash writes the forms the scanner compares');
  const nombres = join(tmp, 'nombres.txt');
  writeFileSync(nombres, 'Zzfixtura\nZzpar Zzdos\n# a comment\n', { mode: 0o600 });
  const salida = join(tmp, 'embargo-huellas.json');
  const rehash = (origen, destino) => spawnSync(process.execPath, [join(ROOT, 'scripts/embargo-rehash.mjs'), origen, '--salida', destino], { encoding: 'utf8' });
  const r = rehash(nombres, salida);
  let escrito = new Set(['0'.repeat(64)]);
  ok(r.status === 0 && !lanza(() => { escrito = leerEmbargo(salida); }), `embargo-rehash.mjs writes a file that loads with its key (exit ${r.status})`);
  ok(escrito.size === 2 && mentionsEmbargoed('visto junto a zzfixtura', escrito) && mentionsEmbargoed('con zzpar zzdos ayer', escrito), 'what it writes matches a one-word and a two-word name in free text');
  ok(!/zzfixtura|zzpar|zzdos/i.test(`${r.stdout}${r.stderr}`), 'it prints no name');
  writeFileSync(join(tmp, 'tres.txt'), 'zzuno zzdos zztres\n');
  const r3 = rehash(join(tmp, 'tres.txt'), join(tmp, 'tres.json'));
  ok(r3.status !== 0 && !existsSync(join(tmp, 'tres.json')), 'a name of three words is refused (the scanner compares words and pairs, so it would never match)');

  console.log('the committed file, every way it can be wrong');
  const valido = JSON.parse(readFileSync(salida, 'utf8'));
  const escribir = (n, o) => { const f = join(tmp, n); writeFileSync(f, JSON.stringify(o)); return f; };
  ok(lanza(() => leerEmbargo(join(tmp, 'no-existe.json')), /does not exist.*embargo-rehash\.mjs/), 'a missing file throws, with the command that writes it');
  ok(lanza(() => leerEmbargo(escribir('sha.json', { ...valido, formato: 'sha256' })), /hmac-sha256 format/), 'a file in another format throws: there is no sha256 fallback');
  ok(lanza(() => leerEmbargo(escribir('vacio.json', { ...valido, huellas: [] })), /no hmac-sha256 digests/), 'a file with no digests throws');
  ok(lanza(() => leerEmbargo(escribir('sin-centinela.json', { ...valido, centinela: undefined })), /sentinel/), 'a file with no key sentinel throws');
  process.env.AXOLODAO_PERSONAS_CLAVE = OTRA_CLAVE;
  ok(lanza(() => leerEmbargo(salida), /not the key/), 'another valid key throws (the sentinel differs), so a wrong key never lets everything pass');
  delete process.env.AXOLODAO_PERSONAS_CLAVE;
  ok(lanza(() => leerEmbargo(salida)) && lanza(() => embargoDigest('zzfixtura')), 'without the key, reading the embargo and taking a digest throw');
  const debiles = ['clave-de-prueba-que-no-es-la-real', 'abcd', 'ab'.repeat(31), '0'.repeat(63)];
  ok(debiles.every((d) => { process.env.AXOLODAO_PERSONAS_CLAVE = d; return lanza(() => leerEmbargo(salida)) && lanza(() => embargoDigest('zzfixtura')); }), `a weak key throws (${debiles.length} weak keys)`);
} finally {
  if (claveReal === undefined) delete process.env.AXOLODAO_PERSONAS_CLAVE; else process.env.AXOLODAO_PERSONAS_CLAVE = claveReal;
  rmSync(tmp, { recursive: true, force: true });
}

console.log('the committed embargo, with the real key');
let embargo = null;
try {
  if (!claveReal) throw new Error('AXOLODAO_PERSONAS_CLAVE is not set');
  embargo = leerEmbargo();
} catch (e) { ok(false, `the committed embargo loads (${e.message}): without it no scan can run, so this test fails closed`); }
if (embargo) {
  ok(embargo.size > 0, `src/data/embargo-huellas.json holds ${embargo.size} keyed digest(s) and its sentinel matches the key`);
  ok(!mentionsEmbargoed('un ajolote del museo, su agua y su pecera', embargo), 'the committed set leaves ordinary text alone');
  const fuentes = ['src', 'scripts', 'public'].flatMap((d) => (existsSync(join(ROOT, d)) ? scanTree(join(ROOT, d), embargo).map((x) => join(d, x)) : []));
  ok(fuentes.length === 0, `no source or public file carries a withheld name (${fuentes.length} found${rutas(fuentes)})`);
}

if (process.argv.includes('--dist')) {
  console.log('dist');
  const dist = join(ROOT, 'dist');
  ok(existsSync(dist), 'dist/ exists (run the build first)');
  if (existsSync(dist) && embargo) {
    const d = scanTree(dist, embargo);
    ok(d.length === 0, `the built site carries no row, photo or text of a withheld specimen (${d.length} found${rutas(d)})`);
  }
}

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
