// The share card of every species page of the atlas: `npm run og:especies` (a real Chrome; set CHROME_PATH if it is elsewhere).
// /atlas/<slug>/ carries /og/atlas/<slug>.jpg as its og:image: what a chat or a social network shows for a link, read without running
// the page. One 1200×630 JPEG per species in public/og/atlas/, plus manifest.json, which records what each card was made from (its
// image, its name, its IUCN category, its label and credit), so scripts/test-atlas-especie.mjs can tell a card that no longer matches
// the atlas. The cards are committed: the site's build does not need Chrome. Run it again when a species, its image or its category
// changes. The card is in Spanish for every language of the page.
//
// The species' image is the one its card in the atlas shows, framed the same way, and it keeps that card's label («Ilustración
// generada con IA»). A CC BY base photo is credited on the card itself; the other base photos are credited where the atlas credits
// them (the card's «Créditos de imagen» line and /atlas/tablas/).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { leerAtlas } from '../src/lib/atlasLectura.mjs';
import { HERO_FOCUS_X, HERO_FOCUS_Y, HERO_IMAGE_FILE } from '../src/components/species/heroImages.ts';
import { IUCN_COLORS, IUCN_LABELS } from '../src/components/species/strings.ts';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(SITE, 'public/og/atlas');
const ANCHO = 1200, ALTO = 630;

const { especies } = await leerAtlas('especies-atlas.json', { publica: process.env.PUBLIC_HUB_URL ?? '' });
const creditos = JSON.parse(readFileSync(join(SITE, 'src/data/creditos-imagenes.json'), 'utf8'));
const comunes = (slug) => {
  const f = join(SITE, 'src/content/species', `${slug}.yaml`);
  return existsSync(f) ? (parse(readFileSync(f, 'utf8')).commonNames ?? []) : [];
};
const iucnDe = (e) => e.categories?.find((c) => c.system === 'iucn' && c.scope === 'global')?.category ?? null;
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The credit a card must carry: a CC BY base photo names its author and licence, and says it was changed. */
const creditoDe = (c) => (c && /^CC BY/.test(c.licencia) ? `Foto base: ${c.autor}, ${c.licencia}, modificada` : null);

const logo = `data:image/svg+xml;base64,${readFileSync(join(SITE, 'public/logos/AxoloDAO.svg')).toString('base64')}`;

const tarjeta = ({ slug, genero, epiteto, comun, iucn, imagen, foco, etiqueta, credito }) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Montserrat:ital,wght@0,600;0,700;1,600;1,800&display=block">
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${ANCHO}px; height: ${ALTO}px; overflow: hidden; background: #071F29; }
  body { position: relative; font-family: Montserrat, sans-serif; color: #fff; }
  .foto { position: absolute; top: 0; right: 0; width: 700px; height: ${ALTO}px; object-fit: cover; ${foco ? `object-position: ${foco};` : ''} }
  /* the picture melts into the navy under the text, so the name never sits on the animal */
  .velo { position: absolute; top: 0; right: 0; width: 700px; height: ${ALTO}px;
    background: linear-gradient(90deg, #071F29 0%, rgba(7,31,41,.92) 14%, rgba(7,31,41,.55) 30%, rgba(7,31,41,0) 48%); }
  .lado { position: absolute; left: 64px; top: 52px; bottom: 50px; width: 580px; display: flex; flex-direction: column; }
  .marca { display: flex; align-items: center; gap: 18px; }
  .marca img { height: 46px; width: auto; filter: brightness(0) invert(1); }
  .marca span { font: 700 25px/1 'Baloo 2', sans-serif; color: #5FD0CE; padding-top: 4px; }
  .nombre { margin-top: auto; }
  .genero { font: italic 600 38px/1.05 Montserrat, sans-serif; color: #F4E8C8; }
  .epiteto { font: italic 800 104px/1.02 Montserrat, sans-serif; letter-spacing: -0.01em; white-space: nowrap; margin-top: 2px; }
  .comun { margin-top: 14px; font: 700 34px/1.1 'Baloo 2', sans-serif; color: #F4E8C8; }
  .uicn { margin-top: 22px; display: inline-flex; align-self: flex-start; align-items: center; gap: 12px; padding: 8px 18px 8px 8px; border-radius: 999px;
    background: rgba(255,255,255,.08); border: 2px solid ${iucn ? IUCN_COLORS[iucn] : '#888'}; font: 700 24px/1 Montserrat, sans-serif; }
  .uicn b { background: ${iucn ? IUCN_COLORS[iucn] : '#888'}; color: #071F29; border-radius: 999px; padding: 7px 12px 6px; font-size: 20px; }
  .uicn small { font: 600 17px/1 Montserrat, sans-serif; color: rgba(255,255,255,.7); }
  .url { margin-top: auto; font: 600 21px/1 Montserrat, sans-serif; color: rgba(255,255,255,.78); }
  .gen { position: absolute; right: 22px; top: 22px; padding: 7px 14px; border-radius: 999px; background: rgba(0,0,0,.62); color: #fff; font: 600 17px/1.1 Montserrat, sans-serif; }
  .credito { position: absolute; right: 22px; bottom: 20px; max-width: 520px; padding: 5px 12px; border-radius: 8px; background: rgba(0,0,0,.62); color: #fff; font: 600 14px/1.25 Montserrat, sans-serif; text-align: right; }
</style></head>
<body>
  ${imagen ? `<img class="foto" src="${imagen}" alt="">` : ''}
  <div class="velo"></div>
  <div class="lado">
    <div class="marca"><img src="${logo}" alt="AxoloDAO"><span>Atlas de los ajolotes</span></div>
    <div class="nombre">
      <p class="genero">${esc(genero)}</p>
      <p class="epiteto" id="epiteto">${esc(epiteto)}</p>
      ${comun ? `<p class="comun">${esc(comun)}</p>` : ''}
    </div>
    ${iucn ? `<p class="uicn"><b>${iucn}</b>${esc(IUCN_LABELS[iucn]?.es ?? iucn)}<small>UICN</small></p>` : ''}
    <p class="url">axolodao.org/atlas/${esc(slug)}</p>
  </div>
  ${imagen && etiqueta ? `<span class="gen">${esc(etiqueta)}</span>` : ''}
  ${credito ? `<span class="credito">${esc(credito)}</span>` : ''}
</body></html>`;

const chrome = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((c) => existsSync(c));
if (!chrome) { console.error('no Chrome or Chromium found: set CHROME_PATH'); process.exit(1); }
const { chromium } = await import('playwright-core');
const navegador = await chromium.launch({ executablePath: chrome });
mkdirSync(SALIDA, { recursive: true });
const manifiesto = {};
let fallos = 0;
try {
  const page = await navegador.newPage({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 1 });
  for (const e of [...especies].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const [genero, ...resto] = e.scientificName.split(' ');
    const archivoImagen = HERO_IMAGE_FILE[e.slug];
    const rutaImagen = archivoImagen ? join(SITE, 'public/species', archivoImagen) : null;
    const imagen = rutaImagen && existsSync(rutaImagen) ? `data:${MIME[extname(rutaImagen).toLowerCase()]};base64,${readFileSync(rutaImagen).toString('base64')}` : null;
    const c = creditos[e.slug];
    const datos = {
      slug: e.slug, genero, epiteto: resto.join(' '), comun: comunes(e.slug)[0] ?? null, iucn: iucnDe(e), imagen,
      foco: HERO_FOCUS_Y[e.slug] != null ? `${HERO_FOCUS_X[e.slug] ?? 50}% ${HERO_FOCUS_Y[e.slug]}%` : null,
      etiqueta: imagen ? c?.etiqueta ?? null : null, credito: imagen ? creditoDe(c) : null,
    };
    await page.setContent(tarjeta(datos), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    // the fonts are the card's: a card in a fallback face is a wrong card, not a lesser one
    const fuentes = await page.evaluate(() => ['italic 800 60px Montserrat', 'italic 600 38px Montserrat', '700 25px "Baloo 2"'].map((f) => [f, document.fonts.check(f)]));
    const faltan = fuentes.filter(([, ok]) => !ok).map(([f]) => f);
    if (faltan.length) { console.error(`  ✗ ${e.slug}: fonts not loaded (${faltan.join(', ')}); is the network up?`); fallos++; continue; }
    // the species epithet is the card: as large as fits the column, from 112 px down
    const tam = await page.evaluate(() => {
      const el = document.getElementById('epiteto');
      const ancho = el.parentElement.parentElement.clientWidth;
      for (let t = 112; t >= 40; t -= 2) { el.style.fontSize = `${t}px`; if (el.scrollWidth <= ancho) return t; }
      return 40;
    });
    // nothing of the text column may spill out of the card
    const fuera = await page.evaluate(({ W, H }) => [...document.querySelectorAll('.lado *, .gen, .credito')].filter((n) => { const r = n.getBoundingClientRect(); return r.width && (r.left < 0 || r.top < 0 || r.right > W || r.bottom > H); }).map((n) => n.className || n.tagName), { W: ANCHO, H: ALTO });
    if (fuera.length) { console.error(`  ✗ ${e.slug}: ${fuera.join(', ')} spills out of the card`); fallos++; continue; }
    const archivo = `${e.slug}.jpg`;
    writeFileSync(join(SALIDA, archivo), await page.screenshot({ type: 'jpeg', quality: 84, clip: { x: 0, y: 0, width: ANCHO, height: ALTO } }));
    manifiesto[e.slug] = { archivo, imagen: archivoImagen ? `species/${archivoImagen}` : null, nombre: e.scientificName, comun: datos.comun, iucn: datos.iucn, etiqueta: datos.etiqueta, credito: datos.credito, tamEpiteto: tam };
    console.log(`  ✓ ${archivo}  ${e.scientificName}${datos.iucn ? ` (${datos.iucn})` : ''}${datos.imagen ? '' : '  (no image)'}${datos.credito ? `  · ${datos.credito}` : ''}`);
  }
} finally { await navegador.close(); }
writeFileSync(join(SALIDA, 'manifest.json'), `${JSON.stringify(manifiesto, null, 2)}\n`);
console.log(fallos ? `\n${fallos} card(s) not made` : `\n${Object.keys(manifiesto).length} cards in public/og/atlas/`);
process.exit(fallos ? 1 : 0);
