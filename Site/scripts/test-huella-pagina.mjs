// The fingerprint page (/atlas/datos/huella/, scripts/lib/huella.mjs paginaIndice) opens with what the attestation is and what it is not
// (the 22-oct ruling): the Sepolia line with the attestation UID and its transaction with the block, what is onchain, what stays off the
// chain, and one sentence verbatim; the clip confirmations in the singular or the plural by the inventory's count. Below it, every listed file
// shows its licence: its own on a line of its own for a CC BY-NC layer, a link to its bundle's licences.jsonl otherwise. Planted pages first,
// then the built page.
//   node scripts/test-huella-pagina.mjs [--dist <dir>]   (after build:sitio)
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { archivosSinLicencia, CONFIRMACIONES, leerListado, paginaIndice } from './lib/huella.mjs';
import { cifrasDe } from '../src/lib/cifrasHome.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--dist');
const DIST = i > 0 ? resolve(process.argv[i + 1]) : join(SITE, 'dist');

let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };

const LINEA = 'Huella registrada en Ethereum, red de prueba Sepolia.';
const onchain = (n) => ['la huella de los datos del atlas', n === 1 ? 'la confirmación de un clip de prueba' : 'las confirmaciones de clips', 'la tesorería', 'los nombres ENS (axolodao.eth)'];
const DESPUES = 'Más adelante: las métricas semanales.';
const FUERA = 'los datos mismos, que el sitio lee del hub de Zenbit System y sirve archivo por archivo aquí abajo';
const FRASE = 'La verificación comprueba que los archivos no cambiaron desde que se registró su huella; no certifica que sus fuentes sean exactas.';
const texto = (h) => String(h ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** What the page's intro says against what it must say, for an attestation and a count of clip confirmations; an empty list means it is all there, in order, above the file list. */
export function problemasDeLaIntro(html, at, confirmaciones) {
  const mal = [];
  const intro = (html.match(/<section data-huella-intro>([\s\S]*?)<\/section>/) ?? [])[1];
  if (!intro) return ['no intro (section data-huella-intro)'];
  if (html.indexOf('data-huella-intro') > html.indexOf('<ul>')) mal.push('the intro is not above the file list');
  if (texto((intro.match(/<p data-huella-red>([\s\S]*?)<\/p>/) ?? [])[1]) !== LINEA) mal.push(`the first line is not «${LINEA}»`);
  if (intro.indexOf('data-huella-red') > intro.indexOf('<h2')) mal.push('the Sepolia line is not the first line');
  if (!intro.includes(`href="https://sepolia.easscan.org/attestation/view/${at.uid}"`) || !intro.includes(`>${at.uid}</a>`)) mal.push('the attestation UID is not there with its link');
  if (!intro.includes(`href="https://sepolia.etherscan.io/tx/${at.tx}"`)) mal.push('the transaction link on sepolia.etherscan.io is not there');
  if (!new RegExp(`bloque ${at.bloque}\\b`).test(texto(intro))) mal.push(`the block ${at.bloque} is not there`);
  const lista = (attr) => [...((intro.match(new RegExp(`<ul ${attr}>([\\s\\S]*?)</ul>`)) ?? [])[1] ?? '').matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => texto(m[1]).replace(/[;.]$/, ''));
  const items = lista('data-huella-onchain');
  if (JSON.stringify(items) !== JSON.stringify(onchain(confirmaciones))) mal.push(`«Qué está onchain» lists ${JSON.stringify(items)}`);
  if (!/<h2[^>]*>Qué está onchain<\/h2>/.test(intro)) mal.push('no heading «Qué está onchain»');
  if (!texto(intro).includes(DESPUES)) mal.push(`no «${DESPUES}»`);
  if (!/<h2[^>]*>Qué queda fuera de la cadena<\/h2>/.test(intro)) mal.push('no heading «Qué queda fuera de la cadena»');
  if (JSON.stringify(lista('data-huella-fuera')) !== JSON.stringify([FUERA])) mal.push('«Qué queda fuera de la cadena» does not list the data itself');
  if (texto((intro.match(/<p data-huella-alcance>([\s\S]*?)<\/p>/) ?? [])[1]) !== FRASE) mal.push('the verification sentence is not there verbatim');
  return mal;
}

// planted: a listing, an attestation, and the page built from them
const AT = { red: 'sepolia', uid: `0x${'a'.repeat(64)}`, tx: `0x${'b'.repeat(64)}`, bloque: 123, contentSha256: `0x${'c'.repeat(64)}`, easscan: `https://sepolia.easscan.org/attestation/view/0x${'a'.repeat(64)}` };
const f = (c) => c.repeat(64);
const LISTADO = { bundles: [{ id: 'a-b1', manifest: f('d') }, { id: 'c-b2', manifest: f('1') }], archivos: [
  { sha256: f('d'), ruta: 'a-b1/manifest.json' }, { sha256: f('e'), ruta: 'a-b1/datos.jsonl' }, { sha256: f('2'), ruta: 'a-b1/licences.jsonl' },
  { sha256: f('1'), ruta: 'c-b2/manifest.json' }, { sha256: f('3'), ruta: 'c-b2/layers/uno.geojson' }, { sha256: f('4'), ruta: 'c-b2/licences.jsonl' }] };
const NC = new Map([['c-b2/layers/uno.geojson', { spdx: 'CC-BY-NC-2.5-MX', nombre: 'CC BY-NC 2.5 MX', url: 'https://creativecommons.org/licenses/by-nc/2.5/mx/' }]]);
const pagina = paginaIndice(LISTADO, NC, AT, { confirmaciones: 1 });
const p0 = problemasDeLaIntro(pagina, AT, 1);
ok(p0.length === 0, `planted: the page for an attestation has the whole intro above the list${p0.length ? ` (${p0.join('; ')})` : ''}`);
ok([...pagina.matchAll(/<li><a href="\/atlas\/datos\/huella\/a-b1\//g)].length === 3 && pagina.includes(`<code>${f('e')}</code>`), 'planted: the file list is still every listed file with its sha256');
ok(!/data-huella-intro/.test(paginaIndice(LISTADO, NC, null)), 'planted: without an attestation the page says nothing is registered (no intro)');
ok(!paginaIndice(LISTADO, NC, { ...AT, red: 'base' }).includes('sepolia.etherscan.io'), 'planted: an attestation on another network gets no Sepolia link');
ok(problemasDeLaIntro(pagina.replace('no certifica que sus fuentes sean exactas', 'certifica sus fuentes'), AT, 1).length > 0, 'planted: a changed verification sentence is caught');
ok(problemasDeLaIntro(pagina.replace('<li>la tesorería;</li>', ''), AT, 1).length > 0, 'planted: a missing onchain item is caught');
// the clip confirmations follow the count, with the hero's own phrases
ok(pagina.includes('<li>la confirmación de un clip de prueba;</li>') && !pagina.includes('las confirmaciones de clips'), 'planted: one confirmation reads «la confirmación de un clip de prueba»');
const dos = paginaIndice(LISTADO, NC, AT, { confirmaciones: 2 });
ok(dos.includes('<li>las confirmaciones de clips;</li>') && problemasDeLaIntro(dos, AT, 2).length === 0 && problemasDeLaIntro(dos, AT, 1).length > 0, 'planted: two confirmations read «las confirmaciones de clips», and the singular check refuses it');
ok((() => { try { paginaIndice(LISTADO, NC, AT); return false; } catch { return true; } })(), 'planted: a Sepolia page with no count of confirmations is refused, never guessed');
const cadenas = readFileSync(join(SITE, 'src/i18n/strings.ts'), 'utf8');
const es = (k) => (cadenas.match(new RegExp(`'${k.replace(/\./g, '\\.')}': '([^']*)'`)) ?? [])[1];
ok(es('hero.onchain.confirmaciones.uno') === CONFIRMACIONES.uno && es('hero.onchain.confirmaciones.varias') === CONFIRMACIONES.varias, 'the two phrases are the hero\'s own (strings.ts, es)');
// every listed file shows a licence
ok(archivosSinLicencia(pagina, LISTADO).length === 0, 'planted: every listed file shows a licence (its own, or its bundle\'s licences.jsonl)');
ok(/uno\.geojson<\/a> <code>[0-9a-f]{64}<\/code><br><span data-licencia="nc">Licencia: <a [^>]*>CC BY-NC 2\.5 MX<\/a> \(no comercial\)<\/span>/.test(pagina), 'planted: a CC BY-NC layer shows «CC BY-NC 2.5 MX (no comercial)» on a line of its own');
ok(/datos\.jsonl<\/a> <code>[0-9a-f]{64}<\/code> · <a href="\/atlas\/datos\/huella\/a-b1\/licences\.jsonl" data-licencia="paquete">licencias del paquete<\/a>/.test(pagina), 'planted: any other file links to its bundle\'s licences.jsonl');
ok(JSON.stringify(archivosSinLicencia(pagina.replace(/(datos\.jsonl<\/a> <code>[0-9a-f]{64}<\/code>) · <a [^>]*data-licencia="paquete">[^<]*<\/a>/, '$1'), LISTADO)) === JSON.stringify(['a-b1/datos.jsonl']), 'planted: a file whose licence was dropped is caught, by name');
const sinLic = { bundles: [{ id: 'a-b1', manifest: f('d') }], archivos: [{ sha256: f('d'), ruta: 'a-b1/manifest.json' }, { sha256: f('e'), ruta: 'a-b1/datos.jsonl' }] };
ok(archivosSinLicencia(paginaIndice(sinLic, new Map(), null), sinLic).length === 2, 'planted: a bundle that lists no licences.jsonl leaves its files with no licence, and they are caught');

// the built page, against the attestation the site commits and the listing it serves
const html = readFileSync(join(DIST, 'atlas/datos/huella/index.html'), 'utf8');
const at = JSON.parse(readFileSync(join(SITE, 'src/data/atestacion-atlas.json'), 'utf8'));
const leerInv = (n) => JSON.parse(readFileSync(join(SITE, 'src/data/inventario', n), 'utf8'));
const { clips } = cifrasDe({ cadena: leerInv('inventario-cadena-xolotlcalli.json'), atlas: leerInv('inventario-atlas.json'), taquilla: leerInv('taquilla-home.json') });
const pb = problemasDeLaIntro(html, at, clips);
ok(pb.length === 0, `atlas/datos/huella/index.html: the intro is all there${pb.length ? ` (${pb.join('; ')})` : ''}`);
const listado = leerListado(readFileSync(join(DIST, 'atlas/datos/huella/listado-stand.txt'), 'utf8'));
ok(listado.archivos.every((a) => html.includes(`<a href="/atlas/datos/huella/${a.ruta}">`) && html.includes(`<code>${a.sha256}</code>`)), `atlas/datos/huella/index.html: every one of the ${listado.archivos.length} listed files keeps its link and its sha256`);
const sin = archivosSinLicencia(html, listado);
ok(sin.length === 0, `atlas/datos/huella/index.html: every one of the ${listado.archivos.length} listed files shows its licence${sin.length ? ` (none on ${sin.length}: ${sin.slice(0, 3).join(', ')}…)` : ''}`);
const nc = [...html.matchAll(/<br><span data-licencia="nc">([\s\S]*?)<\/span>/g)].map((m) => texto(m[1]));
ok(nc.length > 0 && nc.every((t) => t === 'Licencia: CC BY-NC 2.5 MX (no comercial)'), `atlas/datos/huella/index.html: each non-commercial layer (${nc.length}) reads «CC BY-NC 2.5 MX (no comercial)» on a line of its own`);

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
