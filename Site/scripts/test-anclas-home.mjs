// Every in-page link on the three home pages lands somewhere: each href="#x", or href="<the page's own path>#x" (the header writes
// "/#…", "/en/#…"), has an element with id="x" on the same page. A link to an anchor that no section carries does nothing when pressed.   node scripts/test-anclas-home.mjs [--dist <dir>]   (after the build)
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGINAS = ['index.html', 'en/index.html', 'pt/index.html'];
const RUTA = { 'index.html': '/', 'en/index.html': '/en/', 'pt/index.html': '/pt/' };

/** The anchors on a page (served at `ruta`) whose target id is missing. */
export function anclasSueltas(html, ruta) {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const propia = ruta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const enlaces = [...html.matchAll(new RegExp(`\\shref="(?:${propia})?#([^"]*)"`, 'g'))].map((m) => m[1]);
  return [...new Set(enlaces)].filter((a) => a !== '' && !ids.has(a));
}

function revisar(dist) {
  const malas = [];
  for (const p of PAGINAS) {
    const f = join(dist, p);
    if (!existsSync(f)) { malas.push(`${p}: no está en el dist`); continue; }
    for (const a of anclasSueltas(readFileSync(f, 'utf8'), RUTA[p])) malas.push(`${p}: href="${RUTA[p]}#${a}" o "#${a}" sin id="${a}"`);
  }
  return malas;
}

let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };

// self-test: a planted page with a loose anchor is caught, a page whose anchors all land passes
const plantado = mkdtempSync(join(tmpdir(), 'anclas-'));
for (const p of PAGINAS) { mkdirSync(dirname(join(plantado, p)), { recursive: true }); writeFileSync(join(plantado, p), `<a href="#a">x</a><a href="#b">y</a><a href="${RUTA[p]}#c">z</a><a href="/otra/#d">w</a><section id="a"></section>`); }
ok(revisar(plantado).length === 6, 'planted: «#b» and «<own path>#c» with no target are caught on each page; «/otra/#d» is another page\'s');
for (const p of PAGINAS) writeFileSync(join(plantado, p), '<a href="#a">x</a><a href="#">top</a><section id="a"></section>');
ok(revisar(plantado).length === 0, 'planted: anchors that land (and a bare #) pass');
rmSync(plantado, { recursive: true, force: true });

const i = process.argv.indexOf('--dist');
const malas = revisar(i > 0 ? resolve(process.argv[i + 1]) : join(SITE, 'dist'));
ok(malas.length === 0, `every in-page link on the home pages has its target${malas.length ? `:\n      ${malas.join('\n      ')}` : ''}`);

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
