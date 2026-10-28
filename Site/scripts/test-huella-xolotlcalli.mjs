// The Xolotlcalli registry fingerprint page (lib/huellaXolotlcalli.mjs): unsigned, it claims nothing is registered; signed, it names the
// network, the attestation UID, the transaction with its block and the attester, and only an attestation of THIS listing is accepted. Either
// way it says what is onchain and what is not, carries the verification sentence verbatim, and gives every file a licence.
//   node scripts/test-huella-xolotlcalli.mjs [--dist <dir>]   (after build:sitio)
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { archivosSinLicencia, leerListado } from './lib/huella.mjs';
import { firmaVigente } from '../src/lib/firmasRetiradas.mjs';
import { ATESTADOR_DATOS, FRASE, LIMITES, LINEA_ANCLAS, MOSTRAR_LIMITES, paginaXolotlcalli, problemasDeLaAtestacion, problemasDeLasAnclas } from './lib/huellaXolotlcalli.mjs';
import { SALIDA } from './xolotlcalli-registro.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--dist');
const DIST = i > 0 ? resolve(process.argv[i + 1]) : join(SITE, 'dist');
let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };
const texto = (h) => String(h ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const sha = (b) => `0x${createHash('sha256').update(b).digest('hex')}`;

const bytes = readFileSync(join(SALIDA, 'listado-stand.txt'));
const listado = leerListado(bytes.toString('utf8'));
const h = (c) => `0x${c.repeat(64)}`;
// a stand-in for the data attester (attester.axolodao.eth once it exists), and the retired key that signed the 22-23 Oct files
const FIRMANTE = '0x1111111111111111111111111111111111111111', RETIRADA = '0xeCB4C1245665e8A1F43826355aaB0Dd6bF336e05';
const AT = { red: 'sepolia', uid: h('a'), tx: h('b'), bloque: 123, atestador: FIRMANTE, atestadorNombre: 'Firmante de prueba', contentSha256: sha(bytes), retrievedAt: 1792734384 };
// confirmed weekly anchors: 48 ISO weeks from 2025-W44 to 2026-W39, each with its own uid
const SEMANAS = (() => { const out = []; let y = 2025, w = 44; while (out.length < 48) { out.push(`${y}-W${String(w).padStart(2, '0')}`); w++; if (y === 2025 && w > 52) { y = 2026; w = 1; } } return out; })();
const ANCLAS = { atestador: FIRMANTE, txs: [h('1'), h('2'), h('3')], bloques: [1, 2, 3], anclas: SEMANAS.map((semana, k) => ({ semana, uid: `0x${k.toString(16).padStart(64, '0')}` })), primera: '2025-W44', ultima: '2026-W39', cuenta: 48 };

/** What a page says against what it must, for an attestation or none. */
export function problemasDeLaPagina(html, at, anclas = null) {
  const mal = [];
  if ((/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '') !== 'Huella de los registros del museo — AxoloDAO') mal.push('the title is not the approved one');
  if (texto(/<h1>([\s\S]*?)<\/h1>/.exec(html)?.[1]) !== 'Huella de los registros del Museo de Ajolotes Xolotlcalli (2025–2026)') mal.push('the h1 is not the approved one');
  if (/piloto/i.test(/<title>[^<]*<\/title>|<h1>[\s\S]*?<\/h1>/.exec(html)?.[0] ?? '') || /Xolotlcalli/.test(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '')) mal.push('«piloto» in the title or h1, or the museum name in the title');
  const intro = (html.match(/<section data-huella-intro>([\s\S]*?)<\/section>/) ?? [])[1] ?? '';
  if (!intro) return ['no intro'];
  if (at) {
    if (texto((intro.match(/<p data-huella-red>([\s\S]*?)<\/p>/) ?? [])[1]) !== 'Huella registrada en Ethereum, red de prueba Sepolia.') mal.push('no Sepolia line');
    if (!intro.includes(`https://sepolia.easscan.org/attestation/view/${at.uid}`)) mal.push('no UID link');
    if (!intro.includes(`https://sepolia.etherscan.io/tx/${at.tx}`) || !texto(intro).includes(`(bloque ${at.bloque})`)) mal.push('no tx link with its block');
    if (!intro.includes(`https://sepolia.etherscan.io/address/${at.atestador}`)) mal.push('no attester');
    if (!/<li>la huella de estos archivos;<\/li>/.test(intro)) mal.push('the onchain list does not name these files');
    if (texto((intro.match(/<p data-huella-compilacion>([\s\S]*?)<\/p>/) ?? [])[1]) !== 'Fecha de compilación: 22-oct-2026') mal.push('no compilation date');
  } else {
    if (/registrada en Ethereum|data-huella-red|easscan|etherscan/.test(intro)) mal.push('an unsigned page claims a registration');
    if (!/data-huella-pendiente/.test(intro)) mal.push('an unsigned page does not say it is not registered yet');
    if (/la huella de estos archivos/.test(intro)) mal.push('an unsigned page lists these files as onchain');
  }
  if (!/<h2>Qué está onchain<\/h2>/.test(intro) || !/<h2>Qué queda fuera de la cadena<\/h2>/.test(intro)) mal.push('the two headings are missing');
  if (texto((intro.match(/<p data-huella-alcance>([\s\S]*?)<\/p>/) ?? [])[1]) !== FRASE) mal.push('the verification sentence is not verbatim');
  if (MOSTRAR_LIMITES && texto((intro.match(/<p data-huella-limites>([\s\S]*?)<\/p>/) ?? [])[1]) !== LIMITES) mal.push('the limits sentence is not verbatim');
  if (!/<li>los registros mismos, que el sitio sirve archivo por archivo aquí abajo\.<\/li>/.test(intro)) mal.push('the off-chain list does not name the records');
  const conAnclas = intro.includes(`<li>${LINEA_ANCLAS};</li>`);
  if (anclas && !conAnclas) mal.push('confirmed anchors, and no anchors line');
  if (!anclas && /anclas semanales/.test(intro)) mal.push('an anchors line with no confirmed anchors');
  return mal;
}

// planted
const sinFirma = paginaXolotlcalli(listado, null, { confirmaciones: 1, sha256Listado: sha(bytes) });
const firmada = paginaXolotlcalli(listado, AT, { confirmaciones: 1, sha256Listado: sha(bytes) });
ok(problemasDeLaPagina(sinFirma, null).length === 0, `planted: unsigned, the page claims nothing is registered${problemasDeLaPagina(sinFirma, null).length ? ` (${problemasDeLaPagina(sinFirma, null).join('; ')})` : ''}`);
ok(problemasDeLaPagina(firmada, AT).length === 0, `planted: signed, the page names Sepolia, the UID, the tx with its block and the attester${problemasDeLaPagina(firmada, AT).length ? ` (${problemasDeLaPagina(firmada, AT).join('; ')})` : ''}`);
ok(problemasDeLaPagina(sinFirma, AT).length > 0 && problemasDeLaPagina(firmada, null).length > 0, 'planted: each check refuses the other state\'s page');
ok(firmada.includes('<p data-huella-compilacion>Fecha de compilación: 22-oct-2026</p>'), 'planted: retrievedAt reads «22-oct-2026» (Mexico City; in UTC it is already the 23rd)');
ok(problemasDeLaAtestacion({ ...AT, retrievedAt: undefined }, bytes).some((m) => /retrievedAt/.test(m)), 'planted: a signed attestation without retrievedAt is refused');
const conAnclas = paginaXolotlcalli(listado, AT, { confirmaciones: 1, sha256Listado: sha(bytes), anclas: ANCLAS });
ok(problemasDeLasAnclas(ANCLAS, { atestador: FIRMANTE }).length === 0 && problemasDeLaPagina(conAnclas, AT, ANCLAS).length === 0 && conAnclas.includes('<li>las anclas semanales del registro de Xolotlcalli: 48 semanas, de 2025-W44 a 2026-W39, reproducidas en octubre de 2026 desde el registro histórico;</li>'),
  'planted: confirmed anchors add the approved line, word for word');
ok(problemasDeLaPagina(firmada, AT, ANCLAS).length > 0 && problemasDeLaPagina(conAnclas, AT, null).length > 0, 'planted: the anchors line appears exactly when the anchors are confirmed');
for (const [que, cambio] of [
  ['47 weeks', { anclas: ANCLAS.anclas.slice(1), primera: '2025-W45' }],
  ['a repeated week', { anclas: ANCLAS.anclas.map((a, k) => (k === 5 ? { ...a, semana: ANCLAS.anclas[4].semana } : a)) }],
  ['another attester (the atlas signer)', { atestador: '0xcf1aeb4152f01e7643f772f4a08e0e791160b96b' }],
  ['2 transactions', { txs: ANCLAS.txs.slice(1), bloques: [1, 2] }],
  ['a repeated uid', { anclas: ANCLAS.anclas.map((a, k) => (k === 7 ? { ...a, uid: ANCLAS.anclas[6].uid } : a)) }],
  ['a range the line does not name', { primera: '2025-W43' }],
  ['the retired key, even named as the attester', { atestador: RETIRADA }],
]) ok(problemasDeLasAnclas({ ...ANCLAS, ...cambio }, { atestador: cambio.atestador === RETIRADA ? RETIRADA : FIRMANTE }).length > 0, `planted: an anchors file with ${que} is refused`);
ok(ATESTADOR_DATOS === null ? problemasDeLasAnclas(ANCLAS).length > 0 : true, 'planted: with no data attester published, no anchors file is accepted');
ok(problemasDeLaAtestacion({ ...AT, atestador: RETIRADA }, bytes).some((m) => /current key/.test(m)), 'planted: an attestation signed by the retired key is refused');
const porFirmar = paginaXolotlcalli(listado, null, { confirmaciones: 1, sha256Listado: sha(bytes), porVolverAFirmar: true });
ok(problemasDeLaPagina(porFirmar, null).length === 0 && porFirmar.includes('pendientes de volver a firmarse en cadena') && !/0xecb4|zenbit\.axolodao\.eth/i.test(porFirmar), 'planted: withdrawn signatures, the page says they wait to be signed again and names no retired key or name');
ok(firmada.includes('<li>la confirmación de un clip de prueba;</li>') && paginaXolotlcalli(listado, null, { confirmaciones: 2, sha256Listado: sha(bytes) }).includes('<li>las confirmaciones de clips;</li>'), 'planted: the clip confirmations follow the count');
ok((() => { try { paginaXolotlcalli(listado, null, { sha256Listado: sha(bytes) }); return false; } catch { return true; } })(), 'planted: a page with no count of confirmations is refused');
ok(problemasDeLaAtestacion(AT, bytes).length === 0, 'planted: an attestation of this listing on Sepolia is accepted');
ok(problemasDeLaAtestacion({ ...AT, contentSha256: h('c') }, bytes).some((m) => /another listing/.test(m)), 'planted: an attestation of another listing is refused');
ok(problemasDeLaAtestacion({ ...AT, red: 'base' }, bytes).length > 0 && problemasDeLaAtestacion({ ...AT, atestador: '0x12' }, bytes).length > 0 && problemasDeLaAtestacion({ ...AT, bloque: 0 }, bytes).length > 0, 'planted: another network, a malformed attester or no block is refused');
ok(archivosSinLicencia(firmada, listado).length === 0, `planted: every one of the ${listado.archivos.length} files shows its licence`);
ok(archivosSinLicencia(firmada.replace(/ · <a [^>]*data-licencia="paquete">[^<]*<\/a>/, ''), listado).length === 1, 'planted: a file whose licence was dropped is caught');

// the built page
const pagina = join(DIST, 'xolotlcalli/datos/huella/index.html');
if (!existsSync(pagina)) ok(false, `${pagina.slice(DIST.length + 1)} is in the build`);
else {
  const html = readFileSync(pagina, 'utf8');
  const rutaAt = join(SITE, 'src/data/atestacion-xolotlcalli.json');
  // as the build reads them: a file signed by a retired key counts as absent
  const vigente = (f) => { const x = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; return x && firmaVigente(x.atestador) ? x : null; };
  const at = vigente(rutaAt);
  const rutaAnclas = join(SITE, 'src/data/anclas-xolotlcalli.json');
  const p = problemasDeLaPagina(html, at, vigente(rutaAnclas));
  ok(p.length === 0, `xolotlcalli/datos/huella/index.html: the intro is right for ${at ? 'the signed attestation' : 'an unsigned listing'}${p.length ? ` (${p.join('; ')})` : ''}`);
  ok(archivosSinLicencia(html, listado).length === 0 && listado.archivos.every((a) => html.includes(`<code>${a.sha256}</code>`)), `xolotlcalli/datos/huella/index.html: all ${listado.archivos.length} files with their sha256 and licence`);
  ok(readFileSync(join(DIST, 'xolotlcalli/datos/huella/listado-stand.txt')).equals(bytes), 'the served listing is the frozen one, byte for byte');
}

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
