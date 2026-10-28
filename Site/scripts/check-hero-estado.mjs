// After every build (astro.config.mjs runs it on the build's own output; a failure fails the build): the home claims only what this
// build can back. On each of the three home pages:
//   - every atlas data file the route declares is in <dist>/atlas/datos/, not empty and valid JSON. The home says «datos abiertos» in
//     more places than its title (the description, the atlas section), so no page ships without those files, whatever its title says;
//   - the state (A or B) and the scope («especies» or «atlas») are decided again from the snapshot and the served files, with the
//     build's own rule (lib/estadoHero.mjs: «coincide», read within 7 days, a strict hub read of the covered bundles);
//   - the h1 is exactly that state's title and the subtitle exactly that state's subtitle, figures filled from the inventories; neither
//     is empty;
//   - state A shows those two texts and nothing else (the 22-oct ruling): no onchain line and no read date; below its buttons, the text link
//     «… →» to the fingerprint page (/atlas/datos/huella/);
//   - state B shows its onchain line for the scope, exactly, no read date and no link to the fingerprint page.
//   node --experimental-strip-types scripts/check-hero-estado.mjs [--dist <dir>]   checks a built site (default: dist/)
//   node --experimental-strip-types scripts/check-hero-estado.mjs --autoprueba     plants pages that must fail, and one state-A site that must pass
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { t } from '../src/i18n/strings.ts';
import { ARCHIVOS } from '../src/lib/atlasSnapshot.mjs';
import { cifrasDe, llenar } from '../src/lib/cifrasHome.mjs';
import { decidir } from '../src/lib/estadoHero.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGINAS = { es: 'index.html', en: 'en/index.html', pt: 'pt/index.html' };
const RUTA_DATOS = join(SITE, 'src/pages/atlas/datos/[archivo].ts');
const leerJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const CIFRAS = cifrasDe({
  cadena: leerJson(join(SITE, 'src/data/inventario/inventario-cadena-xolotlcalli.json')),
  atlas: leerJson(join(SITE, 'src/data/inventario/inventario-atlas.json')),
  taquilla: leerJson(join(SITE, 'src/data/inventario/taquilla-home.json')),
});

const texto = (html) => (html ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

/** What the home must say for a decision, in `locale`: its title, its subtitle, in state B only its onchain line (null in state A), and in state A only the fingerprint link's text (null in state B). */
export function esperado(decision, locale, { datosEnLinea = existsSync(RUTA_DATOS) } = {}) {
  const a = decision.estado === 'A';
  const clave = a ? 'hero.title' : datosEnLinea ? 'hero.title.b.conDatos' : 'hero.title.b.sinDatos';
  return {
    titulo: llenar(t(locale, clave), locale, CIFRAS),
    subtitulo: t(locale, a ? 'hero.subtitle.a' : 'hero.subtitle.b'),
    linea: a ? null : t(locale, `hero.onchain.b.${decision.alcance}`)
      .replace('{confirmaciones}', t(locale, CIFRAS.clips === 1 ? 'hero.onchain.confirmaciones.uno' : 'hero.onchain.confirmaciones.varias')),
    verifica: a ? `${t(locale, 'hero.verifica')} →` : null,
  };
}

/** The problems of a built site against a snapshot, at time `ahora`; an empty list means the home claims only what it can back. */
export function revisarDist(dist, { snapshot, ahora = Date.now() } = {}) {
  const problemas = [];
  const servidos = {};
  for (const a of ARCHIVOS) {
    const f = join(dist, 'atlas', 'datos', a);
    if (!existsSync(f)) { problemas.push(`atlas/datos/${a}: no está en el build`); continue; }
    if (statSync(f).size === 0) { problemas.push(`atlas/datos/${a}: está vacío`); continue; }
    try { servidos[a] = leerJson(f); } catch { problemas.push(`atlas/datos/${a}: no es JSON`); }
  }
  const decision = decidir({ snapshot, servidos, ahora });
  for (const [locale, pagina] of Object.entries(PAGINAS)) {
    const f = join(dist, pagina);
    if (!existsSync(f)) { problemas.push(`${pagina}: no está en el build`); continue; }
    const html = readFileSync(f, 'utf8');
    const h1 = texto((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ?? [])[1]);
    const subtitulo = texto((html.match(/<p[^>]*\bhero-subtitle\b[^>]*>([\s\S]*?)<\/p>/) ?? [])[1]);
    const conLinea = /data-hero-onchain/.test(html);
    const linea = texto((html.match(/<p[^>]*data-hero-onchain[^>]*>([\s\S]*?)<\/p>/) ?? [])[1]);
    const e = esperado(decision, locale);
    if (!h1) problemas.push(`${pagina}: el título está vacío`);
    else if (h1 !== e.titulo) problemas.push(`${pagina}: el título dice «${h1}» y el estado ${decision.estado} pide «${e.titulo}»`);
    if (!subtitulo) problemas.push(`${pagina}: el subtítulo está vacío`);
    else if (subtitulo !== e.subtitulo) problemas.push(`${pagina}: el subtítulo dice «${subtitulo}» y el estado ${decision.estado} pide «${e.subtitulo}»`);
    if (e.linea === null) { if (conLinea) problemas.push(`${pagina}: el estado A no lleva línea onchain, y la página la trae`); }
    else if (!linea) problemas.push(`${pagina}: la línea onchain está vacía`);
    else if (linea !== e.linea) problemas.push(`${pagina}: la línea onchain no es la del estado ${decision.estado} y el alcance «${decision.alcance}»`);
    const enlace = html.match(/<a\s[^>]*data-hero-verifica[^>]*>([\s\S]*?)<\/a>/);
    if (e.verifica === null) { if (enlace) problemas.push(`${pagina}: el estado B no lleva el enlace a la huella, y la página lo trae`); }
    else if (!enlace) problemas.push(`${pagina}: el estado A lleva el enlace «${e.verifica}» a la huella, y la página no lo trae`);
    else if (texto(enlace[1]) !== e.verifica || !/href="\/atlas\/datos\/huella\/"/.test(enlace[0])) problemas.push(`${pagina}: el enlace a la huella dice «${texto(enlace[1])}» o no lleva a /atlas/datos/huella/`);
    const hero = html.slice(html.indexOf('hero-title'), html.indexOf('</section>', html.indexOf('hero-title')));   // from the h1 to the end of the hero's section
    if (/data-hero-leido/.test(html) || /<time\b/.test(hero)) problemas.push(`${pagina}: el hero no lleva fecha de lectura, y la página la trae`);
  }
  return { problemas, decision };
}

// ---- self-test: planted sites that must fail, and a state-A site that must pass --------------------------------------------------------
function autoprueba() {
  let fallas = 0;
  const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };
  const AHORA = Date.parse('2026-10-22T13:00:00Z');
  const h = (c) => `0x${c.repeat(64)}`;
  const bundles = ['944f8dbc53b0-genero', 'a1d128c4bf4c-localidades', '735c7b3021a1-perfiles', 'a1d128c4bf4c-morfometria', '4216080f8b97-admin1']
    .map((id, i) => ({ id, manifestSha256: h(String(i + 1)), datos: 'load:species-atlas' }))
    .concat([{ id: '5e8591b04e51', manifestSha256: h('6'), datos: 'load:layers, load:species-states' }]);
  const foto = (cambio = {}) => ({ lectura: { resultado: 'coincide' }, cubre: bundles, noCubiertos: [], leidoEl: new Date(AHORA - 86400000).toISOString(), ...cambio });
  const archivo = { fuente: 'hub', paridadHub: true, generadoDe: { bundles: bundles.slice(0, 2).map(({ id, manifestSha256 }) => ({ id, manifestSha256 })) } };

  // a site as the build would write it for a decision, then one change planted in it
  const sitio = ({ decision, datos = archivo, cambio = () => {} }) => {
    const d = mkdtempSync(join(tmpdir(), 'hero-'));
    mkdirSync(join(d, 'atlas', 'datos'), { recursive: true });
    for (const a of ARCHIVOS) writeFileSync(join(d, 'atlas', 'datos', a), JSON.stringify(datos));
    for (const [locale, pagina] of Object.entries(PAGINAS)) {
      const e = esperado(decision, locale);
      mkdirSync(dirname(join(d, pagina)), { recursive: true });
      writeFileSync(join(d, pagina), `<section><h1 class="hero-title">${e.titulo.replace('Ambystoma', '<i>Ambystoma</i>')}</h1>` +
        `<p class="hero-subtitle mx-auto">${e.subtitulo.replace('Ambystoma', '<i>Ambystoma</i>')}</p>` +
        (e.linea === null ? '' : `<p class="hero-onchain" data-hero-onchain>${e.linea}</p>`) +
        (e.verifica === null ? '' : `<a href="/atlas/datos/huella/" data-hero-verifica>${e.verifica.replace(' →', ' <span aria-hidden="true">→</span>')}</a>`) + '</section>');
    }
    cambio(d);
    return d;
  };
  const caso = (descripcion, debeFallar, { snapshot, decision, datos, cambio }) => {
    const d = sitio({ decision, datos, cambio });
    const { problemas } = revisarDist(d, { snapshot, ahora: AHORA });
    rmSync(d, { recursive: true, force: true });
    ok(debeFallar ? problemas.length > 0 : problemas.length === 0, `${descripcion}${problemas.length ? ` (${problemas[0]})` : ''}`);
  };
  const A = { estado: 'A', alcance: 'atlas', leido: AHORA - 86400000 };
  const B = { estado: 'B', alcance: 'especies', leido: null };
  const B_ARCHIVO = { fuente: 'archivo', generadoDe: archivo.generadoDe };

  caso('state A: a fresh «coincide» over a strict hub read of the covered bundles passes', false, { snapshot: foto(), decision: A });
  caso('state B with no snapshot passes', false, { snapshot: undefined, decision: B, datos: B_ARCHIVO });
  caso('planted: state A pages with no snapshot fail', true, { snapshot: undefined, decision: A });
  caso('planted: state A pages over a snapshot read 8 days ago fail', true, { snapshot: foto({ leidoEl: new Date(AHORA - 8 * 86400000).toISOString() }), decision: A });
  caso('planted: state A pages over files from the committed copy fail', true, { snapshot: foto(), decision: A, datos: B_ARCHIVO });
  const LINEA_A_VIEJA = 'Onchain: el atlas (la huella de sus datos, en Ethereum, red de prueba Sepolia), la tesorería, los nombres ENS, como axolodao.eth, y la confirmación de un clip de prueba.';
  const enHero = (d, pagina, html) => { const f = join(d, pagina); writeFileSync(f, readFileSync(f, 'utf8').replace('</section>', `${html}</section>`)); };
  caso('planted: a state A page with an onchain line fails', true, { snapshot: foto(), decision: A, cambio: (d) => enHero(d, 'index.html', `<p class="hero-onchain" data-hero-onchain>${LINEA_A_VIEJA}</p>`) });
  caso('planted: a state A page with the read date fails', true, { snapshot: foto(), decision: A, cambio: (d) => enHero(d, 'en/index.html', '<p data-hero-leido><time datetime="2026-10-21">Oct 21, 2026</time></p>') });
  caso('planted: a state A page with state B\'s subtitle fails', true, { snapshot: foto(), decision: A,
    cambio: (d) => { const f = join(d, 'pt/index.html'); writeFileSync(f, readFileSync(f, 'utf8').replace(/<p class="hero-subtitle[^>]*>[\s\S]*?<\/p>/, `<p class="hero-subtitle">${t('pt', 'hero.subtitle.b')}</p>`)); } });
  caso('planted: a state B page without its onchain line fails', true, { snapshot: undefined, decision: B, datos: B_ARCHIVO,
    cambio: (d) => { const f = join(d, 'index.html'); writeFileSync(f, readFileSync(f, 'utf8').replace(/<p class="hero-onchain"[\s\S]*?<\/p>/, '')); } });
  caso('planted: a state A page without the link to the fingerprint page fails', true, { snapshot: foto(), decision: A,
    cambio: (d) => { const f = join(d, 'index.html'); writeFileSync(f, readFileSync(f, 'utf8').replace(/<a [^>]*data-hero-verifica[\s\S]*?<\/a>/, '')); } });
  caso('planted: a state A link that leads elsewhere fails', true, { snapshot: foto(), decision: A,
    cambio: (d) => { const f = join(d, 'en/index.html'); writeFileSync(f, readFileSync(f, 'utf8').replace('href="/atlas/datos/huella/"', 'href="/atlas/"')); } });
  caso('planted: a state B page with the link to the fingerprint page fails', true, { snapshot: undefined, decision: B, datos: B_ARCHIVO,
    cambio: (d) => enHero(d, 'pt/index.html', '<a href="/atlas/datos/huella/" data-hero-verifica>Como se verifica →</a>') });
  caso('planted: a state B page with a read date fails', true, { snapshot: undefined, decision: B, datos: B_ARCHIVO, cambio: (d) => enHero(d, 'index.html', '<p data-hero-leido><time datetime="2026-10-21">21 oct 2026</time></p>') });
  // state A names no scope; state B's onchain line does, so «el atlas» there needs every bundle covered
  caso('planted: state B\'s «el atlas» line while the snapshot leaves a bundle out fails', true,
    { snapshot: foto({ lectura: { resultado: 'no coincide' }, noCubiertos: [{ id: 'x' }] }), decision: { ...B, alcance: 'atlas' }, datos: B_ARCHIVO });
  caso('planted: an empty title fails', true, { snapshot: undefined, decision: B, datos: B_ARCHIVO, cambio: (d) => writeFileSync(join(d, 'en/index.html'), '<section><h1></h1><p class="hero-subtitle">x</p><p data-hero-onchain>x</p></section>') });
  caso('planted: a missing atlas data file fails', true, { snapshot: undefined, decision: B, datos: B_ARCHIVO, cambio: (d) => rmSync(join(d, 'atlas/datos/admin1.geojson')) });
  caso('planted: an empty atlas data file fails', true, { snapshot: undefined, decision: B, datos: B_ARCHIVO, cambio: (d) => writeFileSync(join(d, 'atlas/datos/especies-atlas.json'), '') });
  caso('planted: a title with another figure fails', true, { snapshot: undefined, decision: B, datos: B_ARCHIVO,
    cambio: (d) => { const f = join(d, 'pt/index.html'); writeFileSync(f, readFileSync(f, 'utf8').replace('32', '33')); } });
  return fallas;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--autoprueba')) {
    const fallas = autoprueba();
    console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
    process.exit(fallas ? 1 : 0);
  }
  const i = process.argv.indexOf('--dist');
  const dist = i > 0 ? resolve(process.argv[i + 1]) : join(SITE, 'dist');
  const ATESTACION = join(SITE, 'src/data/atestacion-atlas.json');
  const snapshot = existsSync(ATESTACION) ? leerJson(ATESTACION) : undefined;
  const { problemas, decision } = revisarDist(dist, { snapshot });
  console.log(`[hero] estado ${decision.estado} · alcance ${decision.alcance} · ${problemas.length ? 'FALLA' : 'ok'}`);
  if (decision.estado === 'B' && decision.problemas.length) console.log(`  por qué B: ${decision.problemas.join('; ')}`);
  for (const p of problemas) console.log(`  ✗ ${p}`);
  process.exit(problemas.length ? 1 : 0);
}
