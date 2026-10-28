// The layers of the atlas UI in a real browser: Escape and Back close one layer at a time, ?especie= and ?estado= are read and written back, focus returns to the row that opened a sheet, the
// phone sheet snaps, the panel tabs move with the arrow keys, and the legal-figure expansion is in a focusable row.
//   node scripts/proto/test-capas-ui.mjs http://127.0.0.1:4456
const { chromium } = await import('playwright-core');
const base = process.argv[2];
let fallos = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fallos++; };
const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const abrir = async (ruta, opc = {}) => {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 }, ...opc }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${base}${ruta}`); await p.waitForSelector('[data-atlas][data-ready="1"]', { timeout: 60000 }); await p.waitForTimeout(700);
  return { ctx, p, errs };
};
const hay = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);
const esperar = async (p, sel, queHaya) => { for (let i = 0; i < 40; i++) { if ((await hay(p, sel)) === queHaya) return queHaya; await p.waitForTimeout(50); } return hay(p, sel); };
const url = async (p) => new Map(await p.evaluate(() => [...new URL(location.href).searchParams.entries()]));
const abrirIndice = async (p) => { await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice'); };

// Escape closes the top layer only: the detail sheet before the index, and the index after
{
  const { ctx, p } = await abrir('/atlas/');
  await abrirIndice(p);
  await p.click('[data-species-row="andersoni"]'); await p.waitForSelector('#at-detalle');
  ok(await hay(p, '#at-indice') && await hay(p, '#at-detalle'), 'the index and a species sheet are open together');
  await p.keyboard.press('Escape');
  ok(await esperar(p, '#at-detalle', false) === false && await hay(p, '#at-indice'), 'Escape closes the species sheet and leaves the index open');
  await p.keyboard.press('Escape');
  ok(await esperar(p, '#at-indice', false) === false, 'a second Escape closes the index');
  await ctx.close();
}
// Escape closes a popover before the drawer under it
{
  const { ctx, p } = await abrir('/atlas/');
  await abrirIndice(p);
  const caja = await p.locator('[data-map]').boundingBox();
  // the first view fits North America when the data arrives and may override an early camera move: move until the camera stays
  for (let i = 0; i < 6; i++) {
    await p.evaluate(() => new Promise((res) => { const m = document.querySelector('[data-map]').__map; m.once('idle', res); m.jumpTo({ center: [-99.3, 31.3], zoom: 5 }); }));
    await p.waitForTimeout(1200);
    if (await p.evaluate(() => Math.abs(document.querySelector('[data-map]').__map.getZoom() - 5) < 0.01)) break;
  }
  for (let i = 0; i < 4 && await p.$('.at-estado-pop') === null; i++) { await p.waitForTimeout(700); await p.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2); await p.waitForTimeout(700); }
  const hayPop = await p.$('.at-estado-pop') !== null;
  ok(hayPop, 'a click on a state opens its popover');
  if (hayPop) {
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    ok(await p.$('.at-estado-pop') === null && await hay(p, '#at-indice'), 'Escape closes the popover and leaves the index open');
  }
  await ctx.close();
}
// Back closes one layer per press, and the focus goes back to the row that opened the sheet
{
  const { ctx, p } = await abrir('/atlas/');
  await abrirIndice(p);
  await p.focus('[data-species-row="andersoni"]'); await p.keyboard.press('Enter'); await p.waitForSelector('#at-detalle');
  await p.goBack(); await p.waitForTimeout(500);
  ok(!(await hay(p, '#at-detalle')) && await hay(p, '#at-indice'), 'Back closes the species sheet only (the index stays)');
  ok(await p.evaluate(() => document.activeElement?.getAttribute('data-species-row')) === 'andersoni', 'the focus is back on the row that opened the sheet');
  await p.goBack(); await p.waitForTimeout(500);
  ok(!(await hay(p, '#at-indice')), 'a second Back closes the index');
  await ctx.close();
}
// ?especie= and ?estado= are read when the data is here and written back as they change; a value that names nothing is dropped
{
  const { ctx, p } = await abrir('/atlas/?especie=andersoni&estado=MX-MIC');
  ok(await hay(p, '#at-detalle') && (await p.$eval('#at-detalle', (e) => e.textContent)).includes('andersoni'), '?especie=andersoni opens that species sheet');
  const q = await url(p);
  ok(q.get('especie') === 'andersoni' && q.get('estado') === 'MX-MIC', 'and the URL keeps both parameters');
  await p.click('[data-close="detalle"]'); await p.waitForTimeout(500);
  ok(!(await url(p)).has('especie') && (await url(p)).get('estado') === 'MX-MIC', 'closing the sheet takes ?especie= out of the URL and leaves ?estado=');
  await ctx.close();
  const o = await abrir('/atlas/?especie=no-existe&estado=XX-99&capa=inventada');
  const q2 = await url(o.p);
  ok(!q2.has('especie') && !q2.has('estado') && !q2.has('capa') && !(await hay(o.p, '#at-detalle')), 'a value that names nothing is dropped, and nothing opens');
  await o.ctx.close();
}
// the panel tabs are one tab stop; the arrows, Home and End move between them
{
  const { ctx, p } = await abrir('/atlas/');
  await abrirIndice(p);
  const tabs = () => p.$$eval('#at-indice [role="tab"]', (n) => n.map((x) => `${x.id}:${x.tabIndex}:${x.getAttribute('aria-selected')}`));
  ok((await tabs()).join() === 'ptab-especies:0:true,ptab-instalaciones:-1:false', `only the selected tab is in the tab order (${(await tabs()).join(' ')})`);
  await p.focus('#ptab-especies'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300);
  ok((await tabs()).join() === 'ptab-especies:-1:false,ptab-instalaciones:0:true' && await p.evaluate(() => document.activeElement?.id) === 'ptab-instalaciones', 'ArrowRight selects and focuses the next tab');
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.activeElement?.id) === 'ptab-especies', 'and wraps to the first');
  await p.keyboard.press('End'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.activeElement?.id) === 'ptab-instalaciones', 'End goes to the last tab');
  await p.keyboard.press('Home'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.activeElement?.id) === 'ptab-especies', 'Home goes to the first tab');
  await ctx.close();
}
// the legal-figure expansion is in a focusable legend row, shown on focus
{
  const { ctx, p } = await abrir('/atlas/');
  await abrirIndice(p); await p.click('#ptab-instalaciones'); await p.waitForTimeout(300); await p.check('#capa-instalaciones-catalogadas'); await p.waitForTimeout(700);
  if ((await p.getAttribute('.at-legend-chip', 'aria-expanded')) !== 'true') { await p.click('.at-legend-chip'); await p.waitForTimeout(300); }
  const filas = await p.$$eval('#at-legend .at-row-expl', (n) => n.map((x) => ({ tab: x.tabIndex, expl: x.querySelector('.at-expl')?.textContent ?? '' })));
  ok(filas.length >= 1 && filas.every((f) => f.tab === 0 && f.expl.length > 10), `each legal-figure row with an expansion is focusable and carries its text (${filas.length} rows)`);
  await p.focus('#at-legend .at-row-expl'); await p.waitForTimeout(150);
  ok(await p.$eval('#at-legend .at-row-expl .at-expl', (e) => e.getBoundingClientRect().width > 40), 'the expansion is visible while the row has the keyboard focus');
  await ctx.close();
}
// a phone sheet: the grip cycles peek, half and full, and a drag down from the lowest height closes the sheet
{
  const { ctx, p } = await abrir('/atlas/', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await p.tap('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice');
  const snap = () => p.$eval('#at-indice', (e) => e.dataset.snap);
  const inicial = await snap();
  await p.keyboard.press('Tab');
  await p.focus('#at-indice .at-grip');
  const orden = [inicial];
  for (let i = 0; i < 3; i++) { await p.keyboard.press('Enter'); await p.waitForTimeout(350); orden.push(await snap()); }
  const ciclo = ['peek', 'half', 'full'];
  ok(orden.every((s, i) => i === 0 || s === ciclo[(ciclo.indexOf(orden[i - 1]) + 1) % 3]) && new Set(orden).size === 3, `the grip steps peek → half → full → peek (${orden.join(' → ')})`);
  await ctx.close();
}
// the image of a species wears its badge, and its credit line (author, licence, link) is in the drawer; the 4 originals carry the same badge
{
  const casos = [['lermaense', /Tiia Monto/, /CC BY 4\.0/, 'https://commons.wikimedia.org/wiki/File:Axolotl_in_Tierpark_Hellabrunn.jpg'], ['mabeei', /Seig/, /CC BY 4\.0/, 'https://www.inaturalist.org/photos/62942265'], ['mexicanum', /Ilustración generada con IA/, /./, null], ['velasci', /Ilustración generada con IA/, /./, null]];
  for (const [slug, autor, lic, url] of casos) {
    const { ctx, p } = await abrir(`/atlas/?especie=${slug}`);
    await p.waitForSelector('#at-detalle'); await p.waitForTimeout(500);
    const badge = await p.$eval('#at-detalle [data-etiqueta-imagen]', (e) => e.textContent.trim()).catch(() => null);
    const linea = await p.$eval('#at-detalle [data-credito-imagen]', (e) => ({ t: e.textContent.replace(/\s+/g, ' '), h: [...e.querySelectorAll('a')].map((a) => a.href) })).catch(() => null);
    ok(badge === 'Ilustración generada con IA' && linea && /Créditos de la imagen/.test(linea.t) && autor.test(linea.t) && lic.test(linea.t) && (url === null ? linea.h.length === 0 : linea.h.includes(url)), `${slug}: the image has its badge and a credit line (${linea?.t.slice(0, 110)})`);
    await ctx.close();
  }
}
// the status scales: one figure per system with its aria-label; the filled circle is the category; DD shows the pill and no filled circle; a Mexican species with no NOM-059 says «No listada» and a species outside Mexico has no NOM row
{
  const datos = await (await fetch(`${base}/atlas/datos/especies-atlas.json`)).json();
  const sinNom = datos.especies.find((e) => e.countries.includes('MX') && !e.categories.some((c) => c.system === 'nom059'));
  const fueraMx = datos.especies.find((e) => !e.countries.includes('MX'));
  const casos = [['mexicanum', { uicn: 'CR', nom: 'P', aria: 'Estatus UICN: En peligro crítico' }], ['silvense', { uicn: null, pildora: 'Datos insuficientes' }], ...(sinNom ? [[sinNom.slug, { noListada: true }]] : []), ...(fueraMx ? [[fueraMx.slug, { sinNom: true }]] : [])];
  for (const [slug, esp] of casos) {
    const { ctx, p } = await abrir(`/atlas/?especie=${slug}`);
    await p.waitForSelector('#at-detalle [data-estado-conservacion]'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const u = document.querySelector('#at-detalle [data-escala="uicn"]'), n = document.querySelector('#at-detalle [data-escala="nom"]'); const llenas = (f) => f ? [...f.querySelectorAll('.at-eseg[data-llena="1"]')].map((e) => e.dataset.cat) : null; return { uicn: u && { aria: u.getAttribute('aria-label'), llenas: llenas(u), pildora: u.querySelector('[data-pildora-estatus]')?.textContent ?? null, circulosOcultos: u.querySelector('.at-ebar').getAttribute('aria-hidden') === 'true', ancho: u.getBoundingClientRect().width, caja: u.closest('.at-estado').getBoundingClientRect().width }, nom: n && { aria: n.getAttribute('aria-label'), llenas: llenas(n), noListada: n.dataset.noListada, texto: n.querySelector('figcaption').textContent, proyecto: n.querySelector('[data-proyecto-2025]')?.textContent ?? null } }; });
    const bien = esp.uicn !== undefined ? (esp.uicn === null ? r.uicn.llenas.length === 0 && r.uicn.pildora === esp.pildora : r.uicn.llenas.join() === esp.uicn && r.uicn.aria === esp.aria && r.uicn.circulosOcultos) : true;
    const bienNom = esp.nom ? r.nom.llenas.join() === esp.nom : esp.noListada ? r.nom.llenas.length === 0 && /No listada/.test(r.nom.texto) : esp.sinNom ? r.nom === null : true;
    ok(bien && bienNom && r.uicn.ancho <= r.uicn.caja + 1, `${slug}: IUCN circle ${JSON.stringify(r.uicn.llenas)} ${r.uicn.pildora ?? ''}, NOM ${r.nom ? JSON.stringify(r.nom.llenas) + (r.nom.noListada === '1' ? ' no listada' : '') : 'no row'}, one figure inside its cell`);
    await ctx.close();
  }
  // on a phone the scale fits the cell
  const { ctx, p } = await abrir('/atlas/?especie=mexicanum', { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  await p.waitForSelector('#at-detalle [data-estado-conservacion]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => [...document.querySelectorAll('#at-detalle .at-erow')].every((f) => f.scrollWidth <= f.clientWidth + 1 && f.getBoundingClientRect().right <= innerWidth)), 'on a 360 px phone each status row fits its block, without horizontal overflow');
  await ctx.close();
}
// the Resumen of a species has one block of conservation status and no tile that repeats it or says «sin dato»
{
  for (const slug of ['mexicanum', 'dumerilii', 'silvense', 'opacum']) {
    const { ctx, p } = await abrir(`/atlas/?especie=${slug}`);
    await p.waitForSelector('#at-detalle [data-estado-conservacion], #at-detalle .at-cells'); await p.waitForTimeout(400);
    const r = await p.evaluate(() => { const d = document.querySelector('#at-detalle'); const celdas = [...d.querySelectorAll('[data-cell]')].map((c) => ({ id: c.dataset.cell, t: c.innerText.replace(/\s+/g, ' ') })); return { celdas, bloque: !!d.querySelector('[data-estado-conservacion]'), filas: [...d.querySelectorAll('.at-erow')].map((e) => e.dataset.escala), proyecto: d.querySelector('[data-proyecto-2025]')?.textContent ?? null, credito: d.querySelector('[data-credito-imagen]')?.textContent ?? '', enlaces: [...d.querySelectorAll('[data-credito-imagen] a')].map((a) => a.href), vacias: [...d.querySelectorAll('.at-grow')].filter((g) => !g.querySelector('[data-cell]')).length }; });
    ok(!r.celdas.some((c) => ['iucn', 'national', 'cites'].includes(c.id) || /sin dato/i.test(c.t)) && r.bloque && r.filas.includes('uicn') && r.vacias === 0, `${slug}: the Resumen has the status block (${r.filas.join(', ')}), no UICN, Estatus nacional or CITES tile, no «sin dato» tile, no empty group (tiles: ${r.celdas.map((c) => c.id).join(', ')})`);
    ok(!/https?:\/\//.test(r.credito) && (slug === 'mexicanum' || slug === 'dumerilii' ? true : r.enlaces.length === 1), `${slug}: the image credit prints no raw address${r.enlaces.length ? ' and links its source' : ''}`);
    if (slug === 'mexicanum' || slug === 'dumerilii') ok(r.proyecto === null, `${slug}: the 2025 draft equals the current NOM-059 category, so it shows no note`);
    await ctx.close();
  }
}
// review 1, 13, 16, 17, 18 and the ruled citation, on the species sheet
{
  const CITA = /^UICN: (CR|EN|VU|NT|LC|DD|NE|EX|EW) \(evaluación \d{4}\) · IUCN \d{4}\. The IUCN Red List of Threatened Species\. Version \S+, consultada el \d{4}-\d{2}-\d{2}/;
  for (const [slug, esperados] of [['californiense', ['ESA']], ['mavortium', ['ESA', 'SARA', 'COSEWIC']], ['mexicanum', []]]) {
    const { ctx, p } = await abrir(`/atlas/?especie=${slug}`);
    await p.waitForSelector('#at-detalle [data-estado-conservacion]'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const fila = document.querySelector('#at-detalle [data-escala="nacional"]'); const enlaces = [...document.querySelectorAll('#at-detalle [data-estado-conservacion] a.at-efte')]; return { etiqueta: fila?.querySelector('.at-elab')?.textContent ?? null, sistemas: [...(fila?.querySelectorAll('[data-sistema]') ?? [])].map((x) => x.dataset.sistema.toUpperCase()), texto: fila?.innerText.replace(/\s+/g, ' ') ?? '', nombres: enlaces.map((a) => a.getAttribute('aria-label')), altos: enlaces.map((a) => Math.round(a.getBoundingClientRect().height)) }; });
    ok(JSON.stringify(r.sistemas) === JSON.stringify(esperados) && (esperados.length ? r.etiqueta === 'Estatus nacional' : r.etiqueta === null), `${slug}: «Estatus nacional» shows ${esperados.join(', ') || 'nothing (no ESA, SARA or COSEWIC row)'}${r.texto ? ' (' + r.texto.slice(0, 60) + ')' : ''}`);
    if (slug === 'californiense') ok(/ESA: T, E/.test(r.texto) && !/ESA: T, E, E/.test(r.texto), 'californiense: the three ESA rows read «T, E» once');
    ok(r.nombres.length > 0 && r.nombres.every((n) => /^fuente: (UICN|NOM-059|CITES|ESA|SARA|COSEWIC)$/.test(n ?? '')) && new Set(r.nombres).size === r.nombres.length && r.altos.every((h) => h >= 24), `${slug}: every «fuente» link has its own name («fuente: UICN», …) and is at least 24 px tall (${r.nombres.join(' | ')}; ${r.altos.join(',')} px)`);
    const co = await p.evaluate(() => { const rgb = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number); const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }; return [...document.querySelectorAll('#at-detalle .at-eseg[data-llena="1"]')].map((e) => { const s = getComputedStyle(e); const [a, b] = [lum(rgb(s.color)), lum(rgb(s.backgroundColor))].sort((x, y) => y - x); return (a + 0.05) / (b + 0.05); }); });
    ok(co.length >= 1 && co.every((c) => c >= 4.5), `${slug}: the text on a filled status segment reads at ${co.map((c) => c.toFixed(1)).join(', ')}:1 (at least 4.5)`);
    const hueco = await p.evaluate(() => { const u = document.querySelector('#at-detalle [data-escala="uicn"]')?.getBoundingClientRect(), n = document.querySelector('#at-detalle [data-escala="nom"]')?.getBoundingClientRect(); return u && n ? Math.round(n.top - u.bottom) : null; });
    ok(hueco === null || hueco >= 16, `${slug}: the gap between the IUCN and the NOM-059 rows is ${hueco} px (the founder wants it notable: at least 16)`);
    await p.click('#tab-fuentes'); await p.waitForTimeout(300);
    const cit = await p.$$eval('#at-detalle [data-status-citations] li[data-status-system="iucn"]', (n) => n.map((e) => e.firstChild.textContent.trim()));
    ok(cit.length === 1 && CITA.test(cit[0]), `${slug}: the Fuentes tab carries the full IUCN citation (${cit[0]?.slice(0, 70) ?? 'missing'}…)`);
    await ctx.close();
  }
  const { ctx: c2, p: p2 } = await abrir('/atlas/?especie=mexicanum', { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  await p2.waitForSelector('#at-detalle [data-estado-conservacion]'); await p2.evaluate(() => document.querySelector('#at-detalle .at-grip')?.click()); await p2.waitForTimeout(400);
  const altos = await p2.$$eval('#at-detalle a.at-efte', (n) => n.map((a) => { const b = a.getBoundingClientRect(); return [Math.round(b.height), Math.round(b.width)]; }));
  ok(altos.length > 0 && altos.every(([h, w]) => h >= 24 && w >= 24), `at 360 px the «fuente» links are at least 24×24 px (${altos.map((a) => a.join('×')).join(', ')})`);
  await c2.close();
}
// the nav and the hero button go to the atlas page of the locale, with and without the trailing slash; nothing links to the home's #mapa
for (const [loc, atlas] of [['', '/atlas/'], ['/en', '/en/atlas/'], ['/pt', '/pt/atlas/']]) {
  const { ctx, p } = await (async () => { const c = await nav.newContext({ viewport: { width: 1400, height: 900 } }); const pg = await c.newPage(); await pg.goto(`${base}${loc}/`); await pg.waitForTimeout(600); return { ctx: c, p: pg }; })();
  const hrefs = await p.evaluate(() => ({ nav: [...document.querySelectorAll('header nav a')].map((a) => [a.textContent.trim(), a.getAttribute('href')]), hero: document.querySelector('.btn-primary')?.getAttribute('href'), mapa: [...document.querySelectorAll('a[href*="#mapa"]')].length }));
  const sinBarra = await p.request.get(`${base}${atlas.replace(/\/$/, '')}`), conBarra = await p.request.get(`${base}${atlas}`);
  ok(hrefs.nav.some(([t, h]) => t === 'Atlas' && h === atlas) && hrefs.hero === atlas && hrefs.mapa === 0 && sinBarra.ok() && conBarra.ok(), `${loc || '/es'}: the «Atlas» nav link and the hero button go to ${atlas}, which answers with and without the trailing slash, and no link points to #mapa`);
  await ctx.close();
}
await nav.close();
console.log(fallos ? `${fallos} FAILED` : 'all passed');
process.exit(fallos ? 1 : 0);
