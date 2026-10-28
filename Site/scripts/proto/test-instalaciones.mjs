// The facility markers in a real browser: a pictogram per type, the legal figure on the ring, chips that filter, the legend, the popup, the clusters below zoom 9 and the screen-only fan-out.
//   node scripts/proto/test-instalaciones.mjs http://127.0.0.1:4456
const { chromium } = await import('playwright-core');
import { FILA_PILOTO } from '../lib/fila-piloto.mjs';
const base = process.argv[2];
let fallos = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fallos++; };
const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const abrir = async (ruta) => {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(`${base}${ruta}`); await p.waitForSelector('[data-atlas][data-ready="1"]', { timeout: 60000 }); await p.waitForTimeout(800);
  await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice'); await p.click('#ptab-instalaciones'); await p.waitForTimeout(300);
  await p.click('#capa-instalaciones-catalogadas'); await p.waitForTimeout(900);
  return { ctx, p, errs };
};
const mapa = (p, f, a) => p.evaluate(f, a);

{
  const { ctx, p, errs } = await abrir('/atlas/');
  const tipos = await p.$$eval('[data-chips="tipo"] .at-chip', (n) => n.map((x) => x.dataset.tipo));
  const figuras = await p.$$eval('[data-chips="figura"] .at-chip', (n) => n.map((x) => x.dataset.figura));
  const datos = await (await p.request.get(`${base}/atlas/datos/instalaciones-catalogadas.geojson`)).json();
  const deLosDatos = [...new Set(datos.features.map((f) => f.properties.tipo_recinto).filter(Boolean))].sort();
  ok(JSON.stringify([...tipos].sort()) === JSON.stringify(deLosDatos) && figuras.join() === 'uma,pimvs,ninguna', `a chip per facility type in the data (${tipos.length}) and per legal figure (${figuras.join(', ')})`);
  ok(await p.$$eval('[data-chips] .at-chip', (n) => n.every((x) => x.getAttribute('aria-pressed') === 'true')), 'every chip is on by default');
  // a closed row (the pilot's) is given no type and no legal figure: it is in no chip's count and no chip switches it off
  const cerradas = datos.features.filter((f) => f.properties.estado_operacion === 'cerrado').length;
  const suma = (g) => p.$$eval(`[data-chips="${g}"] .at-chip small`, (n) => n.reduce((a, x) => a + Number(x.textContent), 0));
  ok(cerradas >= 1 && await suma('tipo') === datos.features.length - cerradas && await suma('figura') === datos.features.length - cerradas, `the chips count the ${datos.features.length - cerradas} open and unknown rows, not the ${cerradas} closed (types ${await suma('tipo')}, figures ${await suma('figura')})`);
  const total = await mapa(p, () => { const m = document.querySelector('[data-map]').__map; m.jumpTo({ center: [-99.1, 19.5], zoom: 10 }); return 0; }); await p.waitForTimeout(1800);
  const dibujadas = () => mapa(p, () => document.querySelector('[data-map]').__map.queryRenderedFeatures({ layers: ['instalaciones-puntos'] }).length);
  const n0 = await dibujadas();
  ok(n0 > 20, `at zoom 10 over CDMX and Edomex ${n0} markers are drawn, each on its own`);
  // the markers keep their distance: project each one with its offset and measure
  const sep = await mapa(p, () => { const m = document.querySelector('[data-map]').__map; const fs = m.queryRenderedFeatures({ layers: ['instalaciones-puntos'] }); const u = new Map(); for (const f of fs) u.set(f.properties.id, f); const q = [...u.values()].map((f) => { const a = m.project(f.geometry.coordinates); const d = typeof f.properties.desp === 'string' ? JSON.parse(f.properties.desp) : f.properties.desp; return [a.x + d[0], a.y + d[1]]; }); let min = 1e9; for (let i = 0; i < q.length; i++) for (let j = i + 1; j < q.length; j++) min = Math.min(min, Math.hypot(q[i][0] - q[j][0], q[i][1] - q[j][1])); return { n: q.length, min }; });
  ok(sep.min >= 28, `no two markers on screen are closer than 28 px (${sep.n} markers, nearest ${sep.min.toFixed(1)} px)`);
  // the offsets are screen-only: the source's coordinates are the file's
  const iguales = await mapa(p, async () => { const m = document.querySelector('[data-map]').__map; const r = await (await fetch('/atlas/datos/instalaciones-catalogadas.geojson')).json(); const por = new Map(r.features.map((f) => [f.properties.id, f.geometry.coordinates.join()])); const fs = m.querySourceFeatures('instalaciones').filter((f) => !f.properties.point_count); return fs.length > 0 && fs.every((f) => por.get(f.properties.id) === f.geometry.coordinates.map((v) => Math.round(v * 1e4) / 1e4).join()); });
  ok(iguales, 'the coordinates the map holds for every facility are the file\'s (the spread is on the screen only)');
  // a chip switches a type off, and back on
  await p.click('[data-chips="tipo"] [data-tipo="ajolotario"]'); await p.waitForTimeout(900);
  const sinAj = await mapa(p, () => document.querySelector('[data-map]').__map.queryRenderedFeatures({ layers: ['instalaciones-puntos'] }).filter((f) => f.properties.tipo === 'ajolotario').length);
  ok(sinAj === 0 && await p.$eval('[data-chips="tipo"] [data-tipo="ajolotario"]', (n) => n.getAttribute('aria-pressed')) === 'false', 'a chip switched off removes its type from the map');
  await p.click('[data-chips="tipo"] [data-tipo="ajolotario"]'); await p.waitForTimeout(900);
  ok((await dibujadas()) === n0, 'and switching it on brings the markers back');
  await p.click('[data-chips="figura"] [data-figura="uma"]'); await p.waitForTimeout(900);
  const sinUma = await mapa(p, () => document.querySelector('[data-map]').__map.queryRenderedFeatures({ layers: ['instalaciones-puntos'] }).filter((f) => f.properties.figura === 'uma').length);
  ok(sinUma === 0, 'the legal-figure chip filters too'); await p.click('[data-chips="figura"] [data-figura="uma"]'); await p.waitForTimeout(600);
  // the legend lists the types of the data with their names, and the closed ring
  await p.click('.at-legend-chip'); await p.waitForTimeout(300);
  const filas = await p.$$eval('#at-legend .at-row', (n) => n.map((x) => { const c = x.cloneNode(true); c.querySelectorAll('.at-expl').forEach((e) => e.remove()); return c.textContent.trim(); }));   // the label of a row, without the expansion a screen reader also reads
  ok(['Museo', 'Ajolotario', 'Acuario', 'Zoológico', 'UMA', 'PIMVS', 'Sin dato de figura legal', 'cerrado'].every((t) => filas.includes(t)) && await p.$$eval('#at-legend .at-pict', (n) => n.length) >= 15, `the legend shows each type present and each legal figure with its marker (${filas.length} rows)`);
  // the popup of an open row: its type and its legal figure as a tag; the closed row: name, place and date only
  const clic = async (fn, arg) => { const pt = await mapa(p, fn, arg); if (!pt) return null; await p.mouse.click(pt[0], pt[1]); await p.waitForTimeout(700); return p.$eval('.atlas-popup', (n) => n.innerText.replace(/\s+/g, ' ')).catch(() => null); };
  const pos = (cap) => `(slug) => { const m = document.querySelector('[data-map]').__map; const f = m.queryRenderedFeatures({ layers: ['instalaciones-puntos'] }).find((x) => ${cap}); if (!f) return null; const a = m.project(f.geometry.coordinates); const d = typeof f.properties.desp === 'string' ? JSON.parse(f.properties.desp) : f.properties.desp; const r = document.querySelector('[data-map]').getBoundingClientRect(); return [r.left + a.x + d[0], r.top + a.y + d[1]]; }`;
  const abierta = await clic(eval(pos("x.properties.tipo === 'ajolotario' && x.properties.figura === 'ninguna'")));
  ok(abierta && /Ajolotario/.test(abierta) && /Sin dato de figura legal/.test(abierta) && !/cerrado/.test(abierta), `an open row's popup shows its type and its legal figure (${abierta?.slice(0, 120)})`);
  const tag = await p.$eval('.atlas-popup .at-tag', (n) => n.className).catch(() => null);
  ok(/at-tag-ninguna/.test(tag ?? ''), 'the legal figure is a tag');
  await mapa(p, () => { document.querySelector('[data-map]').__map.jumpTo({ center: [-100.4527, 20.7288], zoom: 10 }); }); await p.waitForTimeout(1500);
  const cerrada = await clic(eval(pos("x.properties.id === 'mx-qro-xolotlcalli'")));
  const sinNombre = (cerrada ?? '').replace(FILA_PILOTO.nombre, ''); // the name itself starts with «Museo»: the check is that no facility TYPE label follows it
  ok(cerrada && cerrada.includes(FILA_PILOTO.nombre) && /cerrado · septiembre de 2026/.test(cerrada) && !/\bMuseo\b|UMA|PIMVS|Sin dato|Ambystoma|Verificación/.test(sinNombre), `the closed row's popup stays name, place and date only (${cerrada})`);
  // below zoom 9 the facilities are counts that add up to all of them (a wide view: the source only reports the tiles it has loaded)
  await mapa(p, () => { document.querySelector('[data-map]').__map.jumpTo({ center: [-98, 19.5], zoom: 5 }); }); await p.waitForTimeout(1800);
  const cuentas = await mapa(p, () => { const m = document.querySelector('[data-map]').__map; const fs = m.querySourceFeatures('instalaciones'); const grupos = new Map(), sueltas = new Set(); for (const f of fs) { if (f.properties.point_count) grupos.set(f.properties.cluster_id, f.properties.point_count); else sueltas.add(f.properties.id); } return { cs: [...grupos.values()], sueltas: sueltas.size }; });
  ok(cuentas.cs.length > 0 && cuentas.cs.reduce((a, b) => a + b, 0) + cuentas.sueltas === datos.features.length, `at zoom 5, with all of Mexico in view, the facilities are counts (${cuentas.cs.join(', ')}) plus ${cuentas.sueltas} single markers: ${datos.features.length} in all`);
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs[0] : ''}`);
  await ctx.close();
}
for (const [ruta, museo, tag] of [['/en/atlas/', 'Museum', 'No data on legal status'], ['/pt/atlas/', 'Museu', 'Sem dados sobre a figura legal']]) {
  const { ctx, p, errs } = await abrir(ruta);
  const chips = await p.$$eval('[data-chips] .at-chip span', (n) => n.map((x) => x.textContent));
  ok(chips.includes(museo) && chips.includes('UMA') && chips.includes('PIMVS') && chips.includes(tag), `${ruta}: the chips carry the labels of that language («${museo}», «${tag}»)`);
  ok(errs.length === 0, `${ruta}: no page errors`);
  await ctx.close();
}
await nav.close();
console.log(fallos ? `${fallos} FAILED` : 'ALL OK');
process.exit(fallos ? 1 : 0);
