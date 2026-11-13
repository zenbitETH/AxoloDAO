// The atlas on every screen: `npm run build`, then `node scripts/test-atlas-pantallas.mjs` (or `npm run test:atlas:pantallas`).
// The map is the page: nothing scrolls under it at any size, the stage is the viewport, the open sheets and drawers stay inside it,
// the legend opens as a sheet on a phone or a portrait tablet, and the tables live on /atlas/tablas/, one link away from the layer switches.
// It reads the built folder (dist, or the one given with --dist <folder>) through a local server and a real Chrome (CHROME_PATH or the usual places).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { servirEstatico } from './lib/servir-estatico.mjs';
import { esHoja } from '../src/lib/atlasPantalla.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--dist');
const dist = i > 0 ? resolve(process.argv[i + 1]) : join(SITE, 'dist');
let fallos = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fallos++; };

// the screens: phones upright and on their side, a tablet both ways, laptops, a vertical monitor, desktops and an ultrawide
export const PANTALLAS = [[360, 740], [390, 844], [844, 390], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1080, 1920], [1920, 1080], [2560, 1440], [3440, 1440]];

if (!existsSync(join(dist, 'atlas/index.html'))) { console.error(`no built atlas in ${dist}: run \`npm run build\` first`); process.exit(1); }
const chrome = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean).find((c) => existsSync(c));
if (!chrome) { console.error('no Chrome or Chromium found: set CHROME_PATH'); process.exit(1); }
const { chromium } = await import('playwright-core');
const { servidor, base } = await servirEstatico(dist);
const navegador = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

// the boxes of the page: whether it scrolls, the stage, an open sheet or drawer, the legend
const medir = (page) => page.evaluate(() => {
  const caja = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height }; };
  const d = document.documentElement;
  return { vw: innerWidth, vh: innerHeight, sh: Math.max(d.scrollHeight, document.body.scrollHeight), sw: Math.max(d.scrollWidth, document.body.scrollWidth),
    stage: caja('.at-stage'), indice: caja('#at-indice'), detalle: caja('#at-detalle'), leyenda: caja('#at-legend:not([hidden])'), header: caja('.site-header'),
    tablas: document.querySelector('[data-atlas-tablas]')?.getAttribute('href') ?? null, pie: !!document.querySelector('footer') };
});
// wait until every finite animation and transition has ended (a sheet sliding in is measured where it lands, not half way); an endless one, a pulse, is not waited for
const quieto = (page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().endTime === Infinity), null, { timeout: 5000 }).catch(() => {});
const dentro = (b, m) => !!b && b.top >= -1 && b.left >= -1 && b.bottom <= m.vh + 1 && b.right <= m.vw + 1;

try {
  for (const [ancho, alto] of PANTALLAS) {
    const hoja = esHoja(ancho, alto);
    const etiqueta = `${ancho}×${alto} (${hoja ? 'sheets' : 'drawers'})`;
    const tactil = ancho < 900 && Math.min(ancho, alto) < 500;
    const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, ...(tactil ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    const page = await ctx.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await page.route('**/*', (r) => (['127.0.0.1', 'localhost'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort()));
    await page.goto(`${base}/atlas/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-atlas][data-ready="1"]', { timeout: 60000 });
    await quieto(page);
    let m = await medir(page);
    ok(m.sh <= m.vh + 1 && m.sw <= m.vw + 1, `${etiqueta}: the page does not scroll (content ${m.sw}×${m.sh} in ${m.vw}×${m.vh})`);
    ok(!!m.stage && Math.abs(m.stage.top) <= 1 && Math.abs(m.stage.h - m.vh) <= 1, `${etiqueta}: the map stage is the viewport (top ${m.stage?.top}, height ${m.stage?.h})`);
    ok(!m.pie, `${etiqueta}: no site footer under the map`);
    // the species index: inside the stage, below the header, with the tables link beside the layer switches
    if (!m.indice) { await page.click('[data-group-btn="especies"]'); await page.waitForSelector('#at-indice'); }
    await quieto(page);
    m = await medir(page);
    ok(dentro(m.indice, m) && m.indice.top >= (m.header?.bottom ?? 0) - 1, `${etiqueta}: the species index is inside the screen and below the header (${m.indice && Math.round(m.indice.top)}–${m.indice && Math.round(m.indice.bottom)})`);
    ok(!!m.tablas && /^\/(en\/|pt\/)?atlas\/tablas\/(\?|$)/.test(m.tablas), `${etiqueta}: the index links to the tables page (${m.tablas})`);
    // a species: its sheet or drawer stays inside the screen
    await page.goto(`${base}/atlas/?especie=mexicanum`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-atlas][data-ready="1"]', { timeout: 60000 });
    await page.waitForSelector('#at-detalle', { timeout: 15000 }).catch(() => {});
    await quieto(page);
    m = await medir(page);
    ok(dentro(m.detalle, m) && m.sh <= m.vh + 1, `${etiqueta}: the species sheet is inside the screen and the page still does not scroll`);
    // the legend: a sheet docked at the bottom on a phone or a portrait tablet, a box under the header elsewhere; never past the screen
    if (hoja) {
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      if (await page.locator('#at-indice').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    }
    const chip = page.locator('.at-legend-chip');
    if (await chip.count() && await chip.isVisible() && await page.locator('#at-legend[hidden]').count()) { await chip.click(); }
    await quieto(page);
    m = await medir(page);
    ok(dentro(m.leyenda, m), `${etiqueta}: the legend is inside the screen`);
    if (hoja) ok(!!m.leyenda && Math.abs(m.leyenda.bottom - m.vh) <= 2 && m.leyenda.top >= (m.header?.bottom ?? 0) - 1, `${etiqueta}: the legend is a sheet docked at the bottom, below the header (${m.leyenda && Math.round(m.leyenda.top)}–${m.leyenda && Math.round(m.leyenda.bottom)})`);
    // and as wide as the screen on a phone, or the centered 640 px column on an upright tablet
    if (hoja) ok(!!m.leyenda && m.leyenda.right - m.leyenda.left >= Math.min(m.vw, 640) - 2, `${etiqueta}: the legend sheet spans the screen (${m.leyenda && Math.round(m.leyenda.left)}–${m.leyenda && Math.round(m.leyenda.right)} of ${m.vw})`);
    // the map threw nothing while it opened, fitted a species and opened the legend (a drawer width the camera cannot read is NaN)
    ok(errores.length === 0, `${etiqueta}: no page error on the map (${[...new Set(errores)].join(' | ') || 'none'})`);
    // the tables page answers and carries the tables
    const t = await page.goto(`${base}/atlas/tablas/`, { waitUntil: 'domcontentloaded' });
    const filas = await page.$$eval('[data-tabla] tbody tr', (r) => r.length).catch(() => 0);
    ok(t?.status() === 200 && filas > 0, `${etiqueta}: /atlas/tablas/ answers with its tables (${filas} rows)`);
    const ancha = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    ok(t?.status() === 200 && ancha, `${etiqueta}: the tables page does not scroll sideways (a wide table scrolls inside its own box)`);
    await ctx.close();
  }
  // the three languages carry the page, with its way back to the map
  for (const p of ['atlas/tablas', 'en/atlas/tablas', 'pt/atlas/tablas']) {
    const f = join(dist, p, 'index.html');
    const html = existsSync(f) ? readFileSync(f, 'utf8') : '';
    ok(/data-freshness="\d{4}-\d{2}-\d{2}"/.test(html) && /data-volver-mapa/.test(html) && /data-facilities-table/.test(html), `/${p}/ has the data date, the way back to the map and the facilities table`);
  }
} finally {
  await navegador.close();
  servidor.close();
}
console.log(fallos ? `\n${fallos} check(s) failed` : '\nall checks passed');
process.exit(fallos ? 1 : 0);
