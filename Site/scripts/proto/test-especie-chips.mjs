// A species named in a facility popup wears the map's own species chip: the colour and texture of its range (the index swatch's), the index label, the index status badge, italic; a click opens its drawer; a synonym resolves to its accepted species and an unknown name stays plain text.
//   node scripts/proto/test-especie-chips.mjs http://127.0.0.1:4456
const { chromium } = await import('playwright-core');
import { leerIndice, leerChips, enElMapa, igualAlIndice } from './lib-especies.mjs';
const base = process.argv[2];
let fallos = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fallos++; };
const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const abrir = async (ruta, rutas = {}) => {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  for (const [patron, fn] of Object.entries(rutas)) await p.route(patron, fn);
  await p.goto(`${base}${ruta}`); await p.waitForSelector('[data-atlas][data-ready="1"]', { timeout: 60000 }); await p.waitForTimeout(800);
  await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice'); await p.waitForTimeout(400);
  return { ctx, p, errs };
};
const encender = async (p) => { await p.click('#ptab-instalaciones'); await p.waitForTimeout(300); if (!(await p.$eval('#capa-instalaciones-catalogadas', (e) => e.checked))) await p.click('#capa-instalaciones-catalogadas'); await p.waitForTimeout(900); };
const posDe = (cap) => `() => { const m = document.querySelector('[data-map]').__map; const f = m.queryRenderedFeatures({ layers: ['instalaciones-puntos'] }).find((x) => ${cap}); if (!f) return null; const a = m.project(f.geometry.coordinates); const d = typeof f.properties.desp === 'string' ? JSON.parse(f.properties.desp) : f.properties.desp; const r = document.querySelector('[data-map]').getBoundingClientRect(); return [r.left + a.x + d[0], r.top + a.y + d[1]]; }`;
const clicEnFila = async (p, cap, centro, zoom = 10) => {
  await p.evaluate(([c, z]) => document.querySelector('[data-map]').__map.jumpTo({ center: c, zoom: z }), [centro, zoom]); await p.waitForTimeout(1500);
  const pt = await p.evaluate(eval(posDe(cap))); if (!pt) return false;
  await p.mouse.click(pt[0], pt[1]); await p.waitForTimeout(800); return true;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  // 1 · real rows: the species of the first facility of the data that names more than one
  const datos = await (await fetch(`${base}/atlas/datos/instalaciones-catalogadas.geojson`)).json();
  const fila = datos.features.find((f) => f.properties.especies && f.properties.especies.split(';').length >= 2 && !f.properties.estado_fecha);
  const [lon, lat] = fila.geometry.coordinates; const nombres = fila.properties.especies.split(';').map((x) => x.trim());
  {
    const { ctx, p, errs } = await abrir('/atlas/');
    const indice = await leerIndice(p);
    await encender(p);
    ok(await clicEnFila(p, `x.properties.id === '${fila.properties.id}'`, [lon, lat]), `a facility with ${nombres.length} species opens its popup`);
    const chips = await leerChips(p, '.atlas-popup');
    ok(chips.length >= nombres.length && chips.every((c) => c.boton), `the popup lists its species as chips (${chips.map((c) => c.label).join(', ')})`);
    ok(chips.every((c) => igualAlIndice(c, indice[c.slug])), 'every chip equals its row of the index: colour, texture, label «A. <name>», status badge, italic');
    let enMapa = true; for (const c of chips) enMapa = enMapa && await enElMapa(p, c.slug, indice[c.slug].accent);
    ok(enMapa, 'and its colour is the one the map paints that species\' range with');
    const c0 = chips[0], i0 = indice[c0.slug];
    ok(igualAlIndice(c0, i0) && !igualAlIndice({ ...c0, color: 'rgb(1, 2, 3)' }, i0) && !igualAlIndice({ ...c0, fondo: 'none|rgb(1, 2, 3)' }, i0) && !igualAlIndice({ ...c0, label: 'Ambystoma ' + c0.slug }, i0) && !igualAlIndice({ ...c0, italic: 'normal' }, i0) && !igualAlIndice({ ...c0, badge: 'XX|rgb(0, 0, 0)' }, i0), 'the comparison goes RED on a chip with another colour, another swatch, another label, no italic, or another badge');
    const primero = chips[0];
    await p.click(`.atlas-popup [data-species-chip="${primero.slug}"]`); await p.waitForTimeout(900);
    const det = await p.$eval('#at-detalle', (n) => n.innerText.replace(/\s+/g, ' ')).catch(() => '');
    ok(new RegExp(`Ambystoma ${primero.slug}`, 'i').test(det) && (await p.$('.atlas-popup')) === null, `a click opens the drawer of ${primero.label} and closes the popup`);
    ok(errs.length === 0, `no page errors (${errs.join(' | ')})`);
    await ctx.close();
  }
  // the synonym table of the layers manifest comes from the genus bundle: subsalsum is a synonym of velasci, and a species the atlas lists is never a synonym of another
  {
    const m = await (await fetch(`${base}/atlas/layers/manifest.json`)).json();
    const atlas = await (await fetch(`${base}/atlas/datos/especies-atlas.json`)).json();
    const propias = new Set(atlas.especies.map((e) => e.slug));
    ok(m.sinonimos?.subsalsum === 'velasci' && !('granulosum' in m.sinonimos) && !('taylori' in m.sinonimos) && Object.keys(m.sinonimos).every((k) => !propias.has(k)) && Object.values(m.sinonimos).every((v) => propias.has(v)), `the manifest's synonyms (${Object.keys(m.sinonimos).length}) map only names that are not atlas species to atlas species: subsalsum → velasci, and granulosum and taylori never map to another`);
  }
  // 2 · a synonym and an unknown name, on a synthetic row at the same place
  {
    const sintetica = JSON.parse(JSON.stringify(fila)); sintetica.properties = { ...sintetica.properties, id: 'x-prueba-especies', nombre: 'Prueba de especies', especies: 'Ambystoma subsalsum;Ambystoma fantasma;Ambystoma mexicanum;Ambystoma granulosum;Ambystoma taylori' };
    const servir = async (r) => { const original = await (await r.fetch()).json(); original.features.push(sintetica); await r.fulfill({ json: original }); };
    const { ctx, p } = await abrir('/atlas/', { '**/atlas/datos/instalaciones-catalogadas.geojson': servir, '**/atlas/datos/instalaciones-catalogadas.geojson': servir });
    const indice = await leerIndice(p);
    await encender(p);
    ok(await clicEnFila(p, `x.properties.id === 'x-prueba-especies'`, [lon, lat]), 'the synthetic row opens its popup');
    const chips = await leerChips(p, '.atlas-popup');
    ok(chips.map((c) => c.slug).join() === 'velasci,mexicanum,granulosum,taylori' && chips.every((c) => igualAlIndice(c, indice[c.slug])), `a synonym (subsalsum) shows as its accepted species, with that species' own colour and label (${chips.map((c) => c.label).join(', ')})`);
    ok(chips.find((c) => c.slug === 'granulosum')?.label === 'A. granulosum' && chips.find((c) => c.slug === 'taylori')?.label === 'A. taylori', 'granulosum and taylori are atlas species (PACE 2018): a row that names them shows their own chips, never another species');
    const plano = await p.$$eval('.atlas-popup [data-species-plain]', (n) => n.map((e) => ({ t: e.textContent, italic: getComputedStyle(e).fontStyle, boton: e.tagName === 'BUTTON', swatch: !!e.querySelector('.at-sw') })));
    ok(plano.length === 1 && plano[0].t === 'Ambystoma fantasma' && plano[0].italic === 'italic' && !plano[0].boton && !plano[0].swatch, 'a name the atlas does not know stays as plain italic text, with no colour and no click');
    await ctx.close();
  }
  await nav.close();
  console.log(fallos ? `${fallos} FAILED` : 'all passed'); process.exit(fallos ? 1 : 0);
}
