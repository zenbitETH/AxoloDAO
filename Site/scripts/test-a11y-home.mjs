// The accessibility rules of the home page:
//   - the weeks strip in the data section is decoration for a screen reader (the caption above it already counts the weeks in words):
//     on every built home page it carries aria-hidden="true" and no label of its own;
//   - the atlas section's figure, bars and icons take the theme's text token, never a typed colour, so they keep their contrast in both
//     themes (≥ 4.5:1 for the figure, ≥ 3:1 for the bars on their track);
//   - every link that opens a new tab, the site header's included, says so to a screen reader, in the page's language: as hidden text
//     inside the link, or at the end of its aria-label when it has one (which replaces its content);
//   - the clip number in the data panel has its label for a screen reader («Clip 259»).
//   node scripts/test-a11y-home.mjs [--dist <dir>]   (after the build; default dist/)
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const iDist = process.argv.indexOf('--dist');
const DIST = iDist > 0 ? resolve(process.argv[iDist + 1]) : join(SITE, 'dist');

/** The weeks strip's opening tag on a built page, or null. */
export const tira = (html) => (html.match(/<ol[^>]*class="[^"]*\btira\b[^"]*"[^>]*>/) ?? [])[0] ?? null;
/** The colours typed in a component's <style> block. */
export const coloresEscritos = (fuente) => [...((fuente.match(/<style>([\s\S]*?)<\/style>/) ?? [])[1] ?? '').matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/g)].map((m) => m[0]);

// the approved phrases (strings.ts: a11y.nuevaPestana, home.datos.cadena.hoy.clip)
const NUEVA = { 'index.html': 'se abre en una pestaña nueva', 'en/index.html': 'opens in a new tab', 'pt/index.html': 'abre em uma nova aba' };
const CLIP = { 'index.html': 'Clip', 'en/index.html': 'Clip', 'pt/index.html': 'Clipe' };

/** The new-tab links of a page that do not tell a screen reader they open a new tab. */
export function sinAviso(html, frase) {
  const malos = [];
  for (const m of html.matchAll(/<a\s[^>]*target="_blank"[^>]*>([\s\S]*?)<\/a>/g)) {
    const apertura = m[0].slice(0, m[0].indexOf('>') + 1);
    const etiqueta = (apertura.match(/aria-label="([^"]*)"/) ?? [])[1];
    const oculto = [...m[1].matchAll(/<span[^>]*class="[^"]*\bsr-only\b[^"]*"[^>]*>([^<]*)<\/span>/g)].map((x) => x[1]).join(' ');
    const dice = etiqueta !== undefined ? etiqueta.trim().endsWith(frase) : oculto.includes(frase);
    if (!dice) malos.push((apertura.match(/href="([^"]*)"/) ?? [])[1] ?? apertura.slice(0, 60));
  }
  return malos;
}

let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };

// self-test
ok(tira('<ol class="tira mt-6" aria-label="2025-W43 – 2026-W39">') !== null && !/aria-hidden="true"/.test(tira('<ol class="tira mt-6" aria-label="x">')), 'planted: a labelled strip is found and is not hidden');
ok(coloresEscritos('<style> .cifra { color: #3cc7c7; } .b { background: rgba(0, 1, 2, .5); } </style>').length === 2, 'planted: a typed hex and a typed rgb() are found');
ok(coloresEscritos('<style> .cifra { color: var(--texto-teal); } .p { background: rgba(var(--text-rgb), 0.1); } </style>').length === 0, 'planted: tokens pass');

for (const pagina of ['index.html', 'en/index.html', 'pt/index.html']) {
  const t = tira(readFileSync(join(DIST, pagina), 'utf8'));
  ok(t !== null && /aria-hidden="true"/.test(t) && !/aria-label/.test(t), `${pagina}: the weeks strip is hidden from screen readers`);
}
ok(sinAviso('<a href="https://a" target="_blank">A</a>', 'opens in a new tab').length === 1, 'planted: a new-tab link without the phrase is caught');
ok(sinAviso('<header class="site-header x"><a href="https://h" target="_blank">H</a></header>', 'opens in a new tab').length === 1,
  'planted: a link in the site header is checked like any other');
ok(sinAviso('<a href="https://a" target="_blank" aria-label="Post">x<span class="sr-only"> opens in a new tab</span></a>', 'opens in a new tab').length === 1,
  'planted: hidden text under an aria-label (which replaces it) does not count');
ok(sinAviso('<a href="https://a" target="_blank">A<span class="sr-only"> opens in a new tab</span></a><a target="_blank" href="https://b" aria-label="Post, opens in a new tab">x</a>', 'opens in a new tab').length === 0,
  'planted: hidden text, or the end of an aria-label, passes');
for (const [pagina, frase] of Object.entries(NUEVA)) {
  const html = readFileSync(join(DIST, pagina), 'utf8');
  const malos = sinAviso(html, frase);
  ok(malos.length === 0, `${pagina}: every new-tab link says «${frase}»${malos.length ? ` (missing on ${malos.length}: ${malos.slice(0, 4).join(', ')}…)` : ''}`);
  const dt = (html.match(/<dl[^>]*huellas[\s\S]*?<\/dl>/) ?? [''])[0];
  ok(new RegExp(`<span class="sr-only"[^>]*>${CLIP[pagina]}<\\/span>\\s*259`).test(dt), `${pagina}: the clip number reads «${CLIP[pagina]} 259» to a screen reader`);
}
const escritos = coloresEscritos(readFileSync(join(SITE, 'src/components/home/AtlasHome.astro'), 'utf8'));
ok(escritos.length === 0, `AtlasHome's styles take tokens, not typed colours${escritos.length ? ` (${escritos.join(', ')})` : ''}`);

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
