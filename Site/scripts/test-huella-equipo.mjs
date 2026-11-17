// The Equipo fingerprint page (lib/huellaEquipo.mjs): unsigned, it claims nothing is registered; signed, it names the network, the attestation,
// the transaction with its block and the attester, and only an attestation of THIS listing is accepted. Either way it carries maggia's four
// lines (17-nov-2026) and the verification sentence verbatim, never the first fingerprint's LIMITES sentence nor anything about causes of death,
// and gives every file a licence. The served folder holds exactly the listed files.
//   node scripts/test-huella-equipo.mjs
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { archivosSinLicencia, leerListado, verificarHuella } from './lib/huella.mjs';
import { CUBRE, FUERA, H1, NATURALEZA, REPARTO, paginaEquipo } from './lib/huellaEquipo.mjs';
import { ATESTADOR_DATOS, FRASE, LIMITES, problemasDeLaAtestacion } from './lib/huellaXolotlcalli.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(SITE, 'public/xolotlcalli/datos/huella-equipo');
let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };
const texto = (h) => String(h ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const sha = (b) => `0x${createHash('sha256').update(b).digest('hex')}`;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const bytes = readFileSync(join(DIR, 'listado-stand.txt'));
const listado = leerListado(bytes.toString('utf8'));
const h = (c) => `0x${c.repeat(64)}`;
const FIRMANTE = ATESTADOR_DATOS;
const AT = { red: 'sepolia', uid: h('a'), tx: h('b'), bloque: 123, atestador: FIRMANTE, contentSha256: sha(bytes), retrievedAt: 1795392000 };

console.log('the served folder');
ok(verificarHuella({ listadoRuta: join(DIR, 'listado-stand.txt'), salida: DIR }).length === 0, 'every listed file is served with its bytes and nothing unlisted is served');
ok(listado.archivos.length === 4, 'four files: the log, the chat, the licence and the manifest');

for (const [nombre, at] of [['unsigned', null], ['signed', AT]]) {
  console.log(`the page, ${nombre}`);
  const html = paginaEquipo(listado, at, { sha256Listado: sha(bytes) });
  const intro = texto((html.match(/<section data-huella-intro>([\s\S]*?)<\/section>/) ?? [])[1]);
  ok(texto(/<h1>([\s\S]*?)<\/h1>/.exec(html)?.[1]) === H1, 'the h1');
  for (const [l, t] of [['covers', CUBRE], ['leaves out', FUERA], ['placement', REPARTO], ['frozen copy', NATURALEZA], ['verification', FRASE]]) ok(intro.includes(texto(esc(t))), `maggia's «${l}» line, verbatim`);
  ok(!html.includes(esc(LIMITES)) && !intro.includes(texto(esc(LIMITES))), 'never the first fingerprint\'s LIMITES sentence');
  ok(!/causas? de (la )?baja/i.test(texto(html)), 'nothing about causes of death, either way');
  ok(archivosSinLicencia(html, listado).length === 0, 'every file shows its licence');
  if (at) {
    ok(intro.includes('Sepolia') && intro.includes(AT.uid) && intro.includes(AT.tx) && intro.includes('bloque 123'), 'names the network, the attestation, the transaction and its block');
    ok(!/todavía no está registrada/.test(intro), 'does not say it waits');
  } else {
    ok(/todavía no está registrada en cadena/.test(intro) && !/atestación 0x/i.test(intro) && !intro.includes('Sepolia.'), 'claims nothing is registered');
    ok(/nada de esta página, todavía/.test(intro), 'nothing onchain yet');
  }
}

console.log('the attestation');
ok(problemasDeLaAtestacion(AT, bytes).length === 0, 'an attestation of this listing passes');
ok(problemasDeLaAtestacion({ ...AT, contentSha256: h('c') }, bytes).some((m) => /another listing/.test(m)), 'control: an attestation of another listing is refused');
ok(problemasDeLaAtestacion(AT, Buffer.concat([bytes, Buffer.from(' ')])).some((m) => /another listing/.test(m)), 'control: one byte more in the listing is refused');

console.log('the licence page');
const L = await import('./lib/licenciaXolotlcalli.mjs');
ok(L.problemasDeLaLicencia({ publicada: null, contacto: null }).length === 2, 'without date and mailbox it cannot ship');
let lanza = false; try { L.paginaLicencia({ publicada: null, contacto: null }); } catch { lanza = true; }
ok(lanza, 'and the page refuses to render');
ok(L.problemasDeLaLicencia({ publicada: '2026-11-18', contacto: 'Nombre Persona' }).length === 1, 'control: a name is not a mailbox');
const lic = L.paginaLicencia({ publicada: '2026-11-18', contacto: 'datos@example.org' });
ok(texto(lic).includes('hacer todo lo anterior sólo con fines no comerciales.') && texto(lic).includes('Esta licencia no autoriza ningún uso comercial.'), 'variant B′: non-commercial, verbatim');
ok(texto(lic).includes('Si no cumples la cláusula 3, o usas los archivos con fines comerciales, el permiso termina para ti.'), 'clause 6: commercial use also ends the permission (maggia, second round)');
ok(!/escribe a Zenbit/i.test(lic), 'no promise of a commercial licence from Zenbit');
ok(lic.includes(L.BUNDLES.equipo) && listado.bundles.some((b) => b.id === L.BUNDLES.equipo), 'names the Equipo bundle that is served');
for (const [n, at] of [['unsigned', null], ['signed', AT]]) ok(paginaEquipo(listado, at, { sha256Listado: sha(bytes) }).includes('href="/xolotlcalli/datos/licencia/"'), `the Equipo page (${n}) links the licence`);

if (fallas) { console.error(`\n${fallas} failing`); process.exit(1); }
console.log('\nthe Equipo fingerprint page says what it must');
