// The species detail's keyboard and screen-reader behaviour in the atlas (/especies/ is the atlas on its species view), in a real browser on the built site (run `npm run build` first).
//   node scripts/test-species-sheet.mjs            (CHROME_PATH or the usual places; DIST=path for another build)
// The detail is a dialog named by its heading (aria-labelledby), takes focus when it opens and gives it back to the index row that opened it when it
// closes, by Escape or by its button: in the desktop drawer and in the phone sheet. It is not modal: the map beside it stays usable, so Tab is not trapped.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(process.env.DIST ?? join(SITE, 'dist'));
let fails = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails++; };

const chrome = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean).find((c) => existsSync(c));
if (!chrome) { console.error('no Chrome or Chromium found: set CHROME_PATH'); process.exit(1); }
const { chromium } = await import('playwright-core');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const servidor = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(dist, p);
  if (!f.startsWith(dist) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': tipos[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${servidor.address().port}`;
const navegador = await chromium.launch({ executablePath: chrome });

const SLUG = 'mexicanum';
const dentro = (page) => page.evaluate(() => { const d = document.querySelector('#at-detalle'); return !!d && d.contains(document.activeElement); });
const enFila = (page) => page.evaluate((s) => document.activeElement === document.querySelector(`[data-species-row="${s}"]`), SLUG);

async function abrir(contexto) {
  const ctx = await navegador.newContext(contexto);
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  await page.goto(`${base}/especies/`, { waitUntil: 'load' });
  await page.waitForSelector(`[data-species-row="${SLUG}"]`, { timeout: 30000 });
  await page.waitForTimeout(600);
  return { ctx, page, errores };
}

async function nombrado(page) {
  return page.evaluate(() => {
    const d = document.querySelector('#at-detalle');
    if (!d) return null;
    const id = d.getAttribute('aria-labelledby');
    const t = id ? document.getElementById(id) : null;
    return { rol: d.getAttribute('role'), id, text: t?.textContent?.trim() ?? null, heading: t?.tagName ?? null, modal: d.getAttribute('aria-modal') };
  });
}

console.log('desktop: /especies/ opens on the index, the detail is a named dialog');
{
  const { ctx, page, errores } = await abrir({ viewport: { width: 1400, height: 1000 } });
  ok(await page.getAttribute('[data-atlas]', 'data-vista') === 'especies' && await page.locator('#at-indice').count() === 1, '/especies/ is the atlas with the species index open from the start');
  ok(await page.locator('[data-species-card]').count() === 0, 'and the old card grid and its map are gone');
  await page.focus(`[data-species-row="${SLUG}"]`);
  await page.keyboard.press('Enter');
  await page.waitForSelector('#at-detalle');
  await page.waitForTimeout(350);
  const n = await nombrado(page);
  ok(n && n.rol === 'dialog' && n.id && n.text === `Ambystoma ${SLUG}` && n.heading === 'H2', `the detail is a dialog named by its heading (aria-labelledby → «${n?.text}»)`);
  ok(n && n.modal === null, 'it is not modal: the map beside it stays usable');
  ok(await dentro(page), 'focus is inside it when it opens');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#at-detalle', { state: 'detached' });
  await page.waitForTimeout(200);
  ok(await enFila(page), 'Escape closes it and focus is back on the index row that opened it');
  // a click opens it too, and closing by the button gives focus back as well
  await page.click(`[data-species-row="${SLUG}"]`);
  await page.waitForSelector('#at-detalle');
  await page.waitForTimeout(350);
  await page.click('[data-close="detalle"]');
  await page.waitForSelector('#at-detalle', { state: 'detached' });
  await page.waitForTimeout(200);
  ok(await enFila(page), 'the close button returns focus to the row too');
  ok(errores.length === 0, `no page error (${errores[0] ?? 'none'})`);
  await ctx.close();
}

console.log('phone: the sheet');
{
  const { ctx, page, errores } = await abrir({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.tap(`[data-species-row="${SLUG}"]`);
  await page.waitForTimeout(500);
  await page.tap(`[data-species-row="${SLUG}"]`);
  await page.waitForSelector('#at-detalle');
  await page.waitForTimeout(450);
  const n = await nombrado(page);
  ok(n && n.rol === 'dialog' && n.id && n.text === `Ambystoma ${SLUG}`, `the sheet is named by its heading (→ «${n?.text}»)`);
  ok(n && n.modal === null, 'it is not modal: the map behind stays usable');
  ok(await dentro(page), 'focus is inside it when it opens');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#at-detalle', { state: 'detached' });
  await page.waitForTimeout(250);
  ok(await page.locator('#at-indice').count() === 1, 'Escape closes it and the index sheet is back');
  ok(errores.length === 0, `no page error (${errores[0] ?? 'none'})`);
  await ctx.close();
}

await navegador.close();
servidor.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
