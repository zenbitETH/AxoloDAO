// A page of its own for every species of the atlas, to share: `npm run build`, then `node scripts/test-atlas-especie.mjs`
// (or `npm run test:atlas:especie`).
// /atlas/<slug>/ (and /en/, /pt/) is the atlas with that species' card open and expanded: on a phone the sheet takes the screen,
// which is what a link in an Instagram story opens into. A chat or a social network reads the page's preview without running it, so
// each page carries its own card in its HTML: og:image is /og/atlas/<slug>.jpg, 1200×630, made by scripts/og-especies.mjs from the
// species' image in the atlas, with that image's label («Ilustración generada con IA») and, for a CC BY base photo, its author.
// Leaving the species (another one, or closing the card) moves the address back to /atlas/?especie=…, so a copied link never names
// one species and shows another. It reads the built folder (dist, or --dist <folder>) and, for the browser part, a real Chrome.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { servirEstatico } from './lib/servir-estatico.mjs';
import { urlDelAtlas } from '../src/lib/atlasUrl.mjs';
import { HERO_IMAGE_FILE } from '../src/components/species/heroImages.ts';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--dist');
const dist = i > 0 ? resolve(process.argv[i + 1]) : join(SITE, 'dist');
let fallos = 0;
const ok = (cond, msg) => { if (!cond) { console.log(`  ✗ ${msg}`); fallos++; } return cond; };
const dice = (msg) => console.log(`  ✓ ${msg}`);

// -- the address, as a rule: the species' own page keeps its clean path; leaving the species goes back to the atlas with a query
const u = (o) => urlDelAtlas({ pathname: '/atlas/mexicanum/', search: '', hash: '', atlas: '/atlas/', especieInicial: 'mexicanum', propia: true, capa: 'especies', estado: null, ...o });
const casos = [
  [u({ especie: 'mexicanum' }), { url: '/atlas/mexicanum/', propia: true }, 'its own species: the path stays clean'],
  [u({ especie: 'mexicanum', estado: 'MX-MEX' }), { url: '/atlas/mexicanum/?estado=MX-MEX', propia: true }, 'a state on its page keeps the path'],
  [u({ especie: 'lermaense' }), { url: '/atlas/?especie=lermaense', propia: false }, 'another species: back to the atlas'],
  [u({ especie: null }), { url: '/atlas/', propia: false }, 'the card closed: back to the atlas'],
  [u({ propia: false, pathname: '/atlas/', search: '?especie=lermaense', especie: 'mexicanum' }), { url: '/atlas/?especie=mexicanum', propia: false }, 'once left, the page stays the atlas'],
  [u({ propia: false, especie: null }), { url: '/atlas/', propia: false }, 'Back to the species path, once left: still the atlas'],
  [u({ pathname: '/en/atlas/mexicanum/', atlas: '/en/atlas/', especie: 'lermaense' }), { url: '/en/atlas/?especie=lermaense', propia: false }, 'in English, back to the English atlas'],
  [u({ especieInicial: null, propia: false, pathname: '/atlas/', especie: 'mexicanum' }), { url: '/atlas/?especie=mexicanum', propia: false }, 'the plain atlas writes its query as before'],
];
for (const [got, want, msg] of casos) ok(got.url === want.url && got.propia === want.propia, `${msg}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`) && dice(msg);

// -- the built pages: the corpus first
if (!existsSync(join(dist, 'atlas/index.html'))) { console.error(`no built atlas in ${dist}: run \`npm run build\` first`); process.exit(1); }
const especies = JSON.parse(readFileSync(join(dist, 'atlas/datos/especies-atlas.json'), 'utf8')).especies;
ok(especies.length >= 30, `the atlas carries its species (${especies.length})`) && dice(`${especies.length} species in the atlas`);
const creditos = JSON.parse(readFileSync(join(SITE, 'src/data/creditos-imagenes.json'), 'utf8'));
const manifiestoRuta = join(SITE, 'public/og/atlas/manifest.json');
const manifiesto = existsSync(manifiestoRuta) ? JSON.parse(readFileSync(manifiestoRuta, 'utf8')) : {};
ok(existsSync(manifiestoRuta), 'public/og/atlas/manifest.json records how each card was made');

/** The width and height of a JPEG, from its first SOF marker. */
const medidaJpeg = (b) => {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  for (let p = 2; p < b.length - 9;) {
    if (b[p] !== 0xff) return null;
    const m = b[p + 1], largo = b.readUInt16BE(p + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: b.readUInt16BE(p + 5), w: b.readUInt16BE(p + 7) };
    p += 2 + largo;
  }
  return null;
};
const meta = (html, prop) => html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`))?.[1] ?? null;
const canonica = (html) => html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]*)"/)?.[1] ?? null;
const desescapar = (s) => s?.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"') ?? s;

let paginas = 0;
for (const e of especies) {
  const jpg = join(dist, 'og/atlas', `${e.slug}.jpg`);
  const dims = existsSync(jpg) ? medidaJpeg(readFileSync(jpg)) : null;
  ok(dims?.w === 1200 && dims?.h === 630, `${e.slug}: og/atlas/${e.slug}.jpg is a 1200×630 JPEG (${dims ? `${dims.w}×${dims.h}` : 'missing'})`);
  const m = manifiesto[e.slug], c = creditos[e.slug];
  ok(!!m, `${e.slug}: the card is in the manifest`);
  // a card made before the atlas changed (a new category, another image) shows what the atlas no longer says
  const iucn = e.categories?.find((x) => x.system === 'iucn' && x.scope === 'global')?.category ?? null;
  const imagen = HERO_IMAGE_FILE[e.slug] ? `species/${HERO_IMAGE_FILE[e.slug]}` : null;
  if (m) ok(m.nombre === e.scientificName && m.iucn === iucn && m.imagen === imagen, `${e.slug}: the card shows what the atlas says (card ${m.nombre}, ${m.iucn}, ${m.imagen}; atlas ${e.scientificName}, ${iucn}, ${imagen}): run npm run og:especies`);
  if (m && c) {
    ok(m.etiqueta === c.etiqueta, `${e.slug}: the card carries the image's label («${m.etiqueta}» ≠ «${c.etiqueta}»)`);
    if (/^CC BY/.test(c.licencia)) ok(m.credito?.includes(c.autor), `${e.slug}: a CC BY base photo credits ${c.autor} on the card`);
  }
  for (const pre of ['', 'en/', 'pt/']) {
    const ruta = join(dist, pre, 'atlas', e.slug, 'index.html');
    if (!ok(existsSync(ruta), `/${pre}atlas/${e.slug}/ is built`)) continue;
    const html = readFileSync(ruta, 'utf8');
    paginas++;
    ok(meta(html, 'og:image') === `https://axolodao.org/og/atlas/${e.slug}.jpg`, `/${pre}atlas/${e.slug}/: og:image is its card (${meta(html, 'og:image')})`);
    ok(meta(html, 'twitter:image') == null || meta(html, 'twitter:image') === `https://axolodao.org/og/atlas/${e.slug}.jpg`, `/${pre}atlas/${e.slug}/: twitter:image agrees`);
    ok(desescapar(meta(html, 'og:title'))?.includes(e.scientificName), `/${pre}atlas/${e.slug}/: og:title names ${e.scientificName}`);
    ok(canonica(html) === `https://axolodao.org/${pre}atlas/${e.slug}/`, `/${pre}atlas/${e.slug}/: canonical is itself (${canonica(html)})`);
    // the island's props, as Astro writes them into the page: {"especieInicial":[0,"<slug>"]}, escaped
    ok(html.includes(`&quot;especieInicial&quot;:[0,&quot;${e.slug}&quot;]`), `/${pre}atlas/${e.slug}/: the atlas opens on ${e.slug}`);
  }
}
ok(paginas === especies.length * 3, `a page per species and language (${paginas} of ${especies.length * 3})`) && dice(`${paginas} species pages, each with its card`);

// -- in a browser: the card opens expanded (the whole screen on a phone), and the address keeps its path
const chrome = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((c) => existsSync(c));
if (!chrome) { console.error('no Chrome or Chromium found: set CHROME_PATH'); process.exit(1); }
if (existsSync(join(dist, 'atlas/mexicanum/index.html'))) {
  const { chromium } = await import('playwright-core');
  const { servidor, base } = await servirEstatico(dist);
  const navegador = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    for (const [w, h, movil] of [[390, 844, true], [1440, 900, false]]) {
      const ctx = await navegador.newContext({ viewport: { width: w, height: h }, ...(movil ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
      const page = await ctx.newPage();
      await page.goto(`${base}/atlas/mexicanum/`, { waitUntil: 'domcontentloaded' });
      const raiz = page.locator('[data-especie]').first();
      await raiz.waitFor({ timeout: 60000 });
      await page.waitForFunction(() => document.querySelector('[data-especie]')?.getAttribute('data-especie') === 'mexicanum', null, { timeout: 60000 }).catch(() => {});
      const st = await page.evaluate(() => { const r = document.querySelector('[data-especie]'); const d = document.querySelector('#at-detalle')?.getBoundingClientRect(); return { especie: r?.getAttribute('data-especie'), detalle: r?.getAttribute('data-detalle'), snap: r?.getAttribute('data-sheet-snap'), ampliada: r?.getAttribute('data-expanded'), alto: d ? d.height : 0, vh: innerHeight, ruta: location.pathname + location.search }; });
      const donde = `${w}×${h}`;
      ok(st.especie === 'mexicanum' && st.detalle === '1', `${donde}: /atlas/mexicanum/ opens on mexicanum's card (${st.especie}, ${st.detalle})`);
      if (movil) ok(st.snap === 'full' && st.alto >= st.vh * 0.85, `${donde}: on a phone the card takes the screen (${st.snap}, ${Math.round(st.alto)} of ${st.vh})`);
      else ok(st.ampliada === '1', `${donde}: on a desktop the card opens expanded (${st.ampliada})`);
      ok(st.ruta === '/atlas/mexicanum/', `${donde}: the address stays /atlas/mexicanum/ (${st.ruta})`) && dice(`${donde}: opens expanded on mexicanum, at its own address`);
      await ctx.close();
    }
  } finally { await navegador.close(); servidor.close(); }
} else ok(false, 'no /atlas/mexicanum/ to open in a browser');

console.log(fallos ? `\n${fallos} check(s) failed` : '\nevery species has its page and its card');
process.exit(fallos ? 1 : 0);
