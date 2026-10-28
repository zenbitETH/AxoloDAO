// The axolodao.org build (PUBLIC_ATLAS_SITIO=1, `npm run build:sitio`) in a real browser: the pilot's card with the ruled public wording, the form-(b) treasury row, the ENS label, the 8 signed clips,
// the museum page link, no demo banner, and the museum's name only where it was ruled.
//   node scripts/proto/test-sitio.mjs http://127.0.0.1:4466
const { chromium } = await import('playwright-core');
const base = process.argv[2];
let fallos = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fallos++; };
const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const NOMBRE = 'Museo de Ajolotes Xolotlcalli (2025–2026)', CITA = ['Bio', 'museo'].join('') + ' Xolotlcalli (2025–2026)';
const pedidos = [];
const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 }, colorScheme: 'dark' });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('request', (r) => pedidos.push(r.url()));
await p.goto(`${base}/atlas/?ficha=piloto`); await p.waitForSelector('#at-carta', { timeout: 30000 }); await p.waitForTimeout(1000);
const texto = () => p.$eval('#at-carta', (e) => e.innerText.replace(/\s+/g, ' '));
ok(await p.$('[data-demo-banner], .demo-banner') === null, 'no demo banner');
ok((await p.$eval('#at-carta-t', (e) => e.firstChild.textContent.trim())) === NOMBRE, `the card is titled «${NOMBRE}»`);
ok(await p.$eval('[data-xs-pagina]', (a) => a.getAttribute('href')) === '/xolotlcalli/', 'Resumen: «Página del museo» links to /xolotlcalli/');
// Resumen: grouped tiles, each one value, one label and at most one caption; the ruled captions are on the page; the long wording is in Indicadores
const tit = await p.$$eval('#at-carta [data-carta-panel="resumen"] h4', (n) => n.map((e) => e.textContent.trim()));
ok(tit.join() === 'Operación,Especies,Indicadores,Datos y verificación', `Resumen has the four groups (${tit.join(' | ')})`);
const res = await texto();
ok(await p.$eval('#at-carta [data-carta-panel="resumen"]', (e) => e.closest('.at-panel').scrollHeight <= e.closest('.at-panel').clientHeight + 1), 'Resumen fits one screen at 1400×900, without scrolling');
ok(!/Fuente:/.test(res) && !/Unidades del sistema/.test(res) && !/En cadena/.test(res.replace(/\ben cadena\b/g, '')) && (await p.$('#at-carta [data-carta-panel="resumen"] [data-xs-cadena]')) === null, 'no «Fuente:» line, no «Unidades del sistema» sentence and no En cadena block in Resumen');
const t = await p.$$eval('#at-carta [data-carta-panel="resumen"] .at-xt', (n) => n.map((e) => ({ k: e.dataset.xsDato, t: e.innerText.replace(/\s+/g, ' ').trim(), og: !!e.querySelector('.at-og-i') })));
const get = (k) => t.find((x) => x.k === k)?.t ?? '';
ok(/^Periodo 24 oct 2025 → 22 sep 2026 49 semanas$/.test(get('Periodo de operación')) && /^Sistemas AM AA AD$/.test(get('Sistemas de agua')) && /^Lecturas públicas 572 corte al 14-sep-2026$|^Lecturas públicas 572 corte al/.test(get('Registros públicos')), `Operación and data tiles read as briefed (${get('Periodo de operación')} | ${get('Sistemas de agua')} | ${get('Registros públicos')})`);
ok(/^IRC v1 53 análisis de Zenbit · 30-sep-2026/.test(get('irc')) && /^Supervivencia 37\.0 % proporción simple, 24-oct-2025 a 25-sep-2026 · no es la métrica del Estándar/.test(get('supervivencia')), `IRC and survival are big-number tiles with the ruled captions (${get('irc')} | ${get('supervivencia')})`);
const pie = await p.$eval('[data-xs-cifras-pie]', (e) => e.textContent.trim()).catch(() => '');
ok(pie === 'Cifras calculadas por Zenbit; no expresan la opinión del museo ni de quienes participaron.' && !/pendiente de dictamen|no publicado|histórico, no anclado/i.test(res), 'one footnote line under the figure tiles; never «pendiente de dictamen · no publicado» or «histórico, no anclado»');
ok(t.every((x) => x.t.split(' ').length < 40) && (await p.$$eval('#at-carta [data-carta-panel="resumen"] .at-xt .at-og-i', (n) => n.length)) >= 3, 'tiles have no sentences, and the origin is an icon in the corner');
ok(/Clips confirmados 8/.test(get('Clips confirmados')) && /^Tesorería en cadena$/.test(get('Tesorería')), 'confirmed clips 8 and the treasury «en cadena» tiles');
// the full figure wording is in Indicadores, and in each tile's tooltip
await p.click('#ctab-indicadores'); await p.waitForTimeout(400);
const lineas = await p.$$eval('[data-xs-cifra-linea]', (n) => n.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
const aviso = await p.$eval('[data-xs-cifras-aviso]', (e) => e.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');
ok(/^IRC v1: 53 — análisis de Zenbit sobre los registros del Museo de Ajolotes Xolotlcalli \(2025–2026\); calculado el 30 de septiembre de 2026$/.test(lineas[0] ?? '') && /^Supervivencia: 37\.0 % — proporción simple/.test(lineas[1] ?? '') && aviso === 'Cifras calculadas por Zenbit. No expresan la opinión del Museo de Ajolotes Xolotlcalli ni de quienes participaron en él', 'Indicadores keeps the IP review\'s full wording, with the defined name');
// Fondos y cadena: the legend, ENS with its label, the whole-Safe treasury as a table, no full address in visible text
await p.click('#ctab-fondos'); await p.waitForTimeout(500);
ok(await p.$('[data-xs-leyenda]') !== null && (await p.$$('[data-xs-leyenda] .at-og')).length === 3, 'Fondos y cadena opens with a one-row legend of the three origin words');
const cadena = await p.evaluate(() => [...document.querySelectorAll('#at-carta [data-xs-cadena]')].map((e) => ({ id: e.getAttribute('data-xs-cadena'), t: e.textContent.replace(/\s+/g, ' ') })));
ok(cadena.map((f) => f.id).join() === 'ens,tesoreria,xovi,semanal', `En cadena rows: ${cadena.map((f) => f.id).join(', ')}`);
ok(/identificador histórico del Piloto \(2025–2026\)/.test(cadena[0]?.t ?? '') && /Tesorería de AxoloDAO \(treasury\.axolodao\.eth\)/.test(cadena[1]?.t ?? '') && /Trazabilidad de movimientos en cadena/.test(cadena[1]?.t ?? '') && /Sólo movimientos en cadena; no incluye pagos en efectivo ni bancarios/.test(cadena[1]?.t ?? ''), 'the ENS row carries «identificador histórico del Piloto (2025–2026)», and the treasury row is the whole Safe with the IP review\'s nota (never the demo row)');
ok(await p.$('[data-xs-cadena="tesoreria"] table.at-xs-tbl') !== null && (await p.$$eval('[data-xs-cadena="tesoreria"] details.at-xs-tx summary', (n) => n.every((e) => /^ver \d+ tx$/.test(e.textContent.trim())) && n.length > 10)), 'the treasury is a table (category | amount | links) and each line\'s transactions are one «ver N tx» disclosure');
const visibles = await p.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll('script, style, noscript').forEach((n) => n.remove()); return c.textContent; });
ok(!/0x[0-9a-fA-F]{40}/.test(visibles) && !/firmante/.test(visibles.replace(/Aportación \(firmante\)/g, '')) && !/destinatari|recipient|beneficiari/i.test(visibles), 'no full address in visible text; «firmante» only as the ruled category');
const enlacesAddr = await p.$$eval('#at-carta a[data-contraparte]', (n) => n.map((a) => a.href));
ok(enlacesAddr.length > 0 && enlacesAddr.every((h) => /^https:\/\/(optimistic\.etherscan\.io|etherscan\.io|basescan\.org)\/address\/0x[0-9a-fA-F]{40}$/.test(h)), `every full address is in an explorer link, opened on click (${enlacesAddr.length} counterparty links)`);
// the camera flew to Querétaro with the card
const cam = await p.evaluate(() => { const m = document.querySelector('[data-map]').__map; const c = m.getCenter(); return { z: m.getZoom(), lng: c.lng, lat: c.lat }; });
ok(cam.z > 6 && Math.abs(cam.lat - 20.7) < 3 && Math.abs(cam.lng + 100.4) < 5, `the camera flew to Querétaro when the card opened (zoom ${cam.z.toFixed(1)}, ${cam.lat.toFixed(1)}, ${cam.lng.toFixed(1)})`);
// Indicadores: the water heading with the defined name
await p.click('#ctab-indicadores'); await p.waitForTimeout(400);
ok((await texto()).includes(`Mediciones de agua del ${NOMBRE}`), 'Indicadores: the water heading uses the defined name');
// Clips: the 8 signed clips, grouped by behaviour, each opening in a new tab
await p.click('#ctab-clips'); await p.waitForTimeout(500);
const clips = await p.$$eval('[data-xs-clip]', (n) => n.map((a) => ({ t: a.target, r: a.rel, h: a.href })));
ok(clips.length === 8 && clips.every((c) => c.t === '_blank' && /noopener/.test(c.r) && /^https:\/\//.test(c.h)), `the 8 signed clips (${clips.length}), each opening in a new tab`);
ok((await p.$$('#at-carta [data-carta-panel="clips"] section[aria-label^="Comportamiento"]')).length >= 1 && !/Sin clips públicos todavía/.test(await texto()), 'grouped by behaviour');
// Fuentes: the agreement's citation, exactly, once, and the former name nowhere else on the page
await p.click('#ctab-fuentes'); await p.waitForTimeout(400);
const fuentes = await p.$$eval('#at-carta .at-xs-lista li', (n) => n.map((e) => e.innerText.trim()));
const html = await p.content();
ok(fuentes.filter((f) => f === CITA).length === 1 && html.split(CITA).length === 2 && !new RegExp(['bio', 'museo'].join(''), 'i').test(html.split(CITA).join('')), 'Fuentes carries the agreement\'s citation exactly once and the former name appears nowhere else on the page');
// the name only in the card title, the directory row and the ENS row: never the page title, meta, og, JSON-LD or alt
const cabeza = await p.evaluate(() => ({ titulo: document.title, metas: [...document.querySelectorAll('meta')].map((m) => m.content).join(' '), ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent).join(' '), alts: [...document.querySelectorAll('img[alt]')].map((i) => i.alt).join(' ') }));
const NOM = /xolotlcalli|museo de ajolotes/i;
ok(!NOM.test(cabeza.titulo) && !NOM.test(cabeza.metas) && !NOM.test(cabeza.ld) && !NOM.test(cabeza.alts), 'the name is in no page title, meta, og, JSON-LD or alt text');
// nothing leaves the origin but the layout's fonts; the only data files are the site's own
const origenesPermitidos = new Set([new URL(base).origin, 'https://fonts.googleapis.com', 'https://fonts.gstatic.com']);
const fuera = [...new Set(pedidos.map((u) => new URL(u)).filter((u) => ['http:', 'https:'].includes(u.protocol)).map((u) => u.origin))].filter((o) => !origenesPermitidos.has(o));   // review 6: whole origins (scheme, host, port), not host names
ok(fuera.length === 0, `requests to another origin than this one and the layout's fonts: ${fuera.join(', ') || 'none'}`);
ok(errs.length === 0, `no page error${errs.length ? ': ' + errs[0] : ''}`);
// the pilot's files are served only by this profile: the three data files answer here
for (const f of ['xolotlcalli-ficha.json', 'xolotlcalli-clips.json', 'xolotlcalli-cadena.json']) ok((await p.request.get(`${base}/atlas/real/${f}`)).ok(), `${f} is served by the site build`);
ok(!(await (await p.request.get(`${base}/atlas/real/xolotlcalli-clips-aprobados.json`)).ok()) && !(await (await p.request.get(`${base}/atlas/real/organizacion-ciclo.json`)).ok()), 'no approved-clips list and no cycle file is served');
// the atlas fingerprint: the listing byte for byte, each listed file one by one, the index with the NC licences, no archive
{
  const lis = await (await p.request.get(`${base}/atlas/datos/huella/listado-stand.txt`)).text();
  const lineas = lis.split('\n').filter((l) => /^[0-9a-f]{64}  /.test(l)).map((l) => ({ sha: l.slice(0, 64), ruta: l.slice(66) }));
  ok(lis.startsWith('zenbit-listado-stand v1\n') && lineas.length > 100, `/atlas/datos/huella/listado-stand.txt is the listing (${lineas.length} files)`);
  const muestra = [lineas[0], lineas[Math.floor(lineas.length / 2)], lineas[lineas.length - 1], ...lineas.filter((l) => /\/layers\/(umas-centroides|calidad-agua-2013)\.geojson$/.test(l.ruta))];
  const bien = [];
  for (const l of muestra) { const r = await p.request.get(`${base}/atlas/datos/huella/${l.ruta}`); const b = await r.body(); bien.push(r.ok() && (await import('node:crypto')).createHash('sha256').update(b).digest('hex') === l.sha); }
  ok(bien.every(Boolean), `each sampled listed file (${muestra.length}, the NC layers among them) is served byte for byte`);
  const idx = await (await p.request.get(`${base}/atlas/datos/huella/index.html`)).text();
  const nc = (capa) => new RegExp(`${capa}\\.geojson<\\/a> <code>[0-9a-f]{64}<\\/code><br><span data-licencia="nc">Licencia: <a [^>]*>CC BY-NC 2\\.5 MX<\\/a> \\(no comercial\\)<\\/span>`).test(idx);
  ok(nc('umas-centroides') && nc('calidad-agua-2013') && /admin1\.jsonl<\/a> <code>[0-9a-f]{64}<\/code> · <a href="\/atlas\/datos\/huella\/4216080f8b97-admin1\/licences\.jsonl" data-licencia="paquete">/.test(idx) && !/datos abiertos/i.test(idx),
    'the index shows each CC BY-NC layer with «CC BY-NC 2.5 MX (no comercial)» on a line of its own, links every other file to its bundle\'s licences, and never says «datos abiertos»');
  // review 7: the index works at both URL forms: every link is absolute and answers, and the title carries the site name
  for (const forma of ['/atlas/datos/huella/', '/atlas/datos/huella']) {
    const r = await p.request.get(`${base}${forma}`); const t = await r.text();
    const hrefs = [...t.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => !/^https?:/.test(h));
    const muestraH = [hrefs[0], hrefs[Math.floor(hrefs.length / 2)], hrefs[hrefs.length - 1]];
    const respuestas = await Promise.all(muestraH.map(async (h) => (await p.request.get(new URL(h, `${base}${forma}`).href)).ok()));
    ok(r.ok() && hrefs.length > 100 && hrefs.every((h) => h.startsWith('/atlas/datos/huella/')) && respuestas.every(Boolean) && /<title>Huella de los datos del atlas — AxoloDAO<\/title>/.test(t), `${forma}: the index answers, its ${hrefs.length} links are absolute and the sampled ones resolve, and the title is «… — AxoloDAO»`);
  }
  ok(!(await p.request.get(`${base}/atlas/datos/huella/huella.zip`)).ok() && !(await p.request.get(`${base}/atlas/datos/huella/0b63ee1244d6-localidades/cambios.json`)).ok(), 'no archive is served, and a file the listing does not name (cambios.json of the localities folder) is not served');
}
// item 21: the Spanish-only card says so on the English and Portuguese pages
for (const loc of ['/en', '/pt']) {
  const c = await nav.newContext({ viewport: { width: 1400, height: 900 } }); const q = await c.newPage();
  await q.goto(`${base}${loc}/atlas/?ficha=piloto`); await q.waitForSelector('#at-carta', { timeout: 30000 });
  ok((await q.getAttribute('#at-carta', 'lang')) === 'es' && (await q.evaluate(() => document.documentElement.lang)) === loc.slice(1), `${loc}/atlas/: the card is lang="es" inside a ${loc.slice(1)} page`);
  await c.close();
}
// item 16 on the card: the count and «ver» links are at least 24 px at 360
{
  const c = await nav.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true }); const q = await c.newPage();
  await q.goto(`${base}/atlas/?ficha=piloto`); await q.waitForSelector('#at-carta', { timeout: 30000 }); await q.waitForTimeout(1500);
  const cajas = await q.$$eval('#at-carta .at-xt-enlace', (n) => n.map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.height), Math.round(b.width)]; }));
  ok(cajas.length >= 2 && cajas.every(([h, w]) => h >= 24 && w >= 24), `at 360 px the card's count and «ver» links are at least 24×24 px (${cajas.map((a) => a.join('×')).join(', ')})`);
  await c.close();
}
// founder: the public build never says «Sólo para revisión: no se publica todavía»
{
  const c = await nav.newContext({ viewport: { width: 1400, height: 900 } }); const q = await c.newPage();
  await q.goto(`${base}/atlas/?especie=opacum`); await q.waitForSelector('#at-detalle', { timeout: 30000 }); await q.waitForTimeout(1200);
  const txt = await q.evaluate(() => document.body.innerText);
  ok(/Envolvente de registros de GBIF/.test(txt) && !/revisión|no se publica todavía/i.test(txt), 'opacum on the public build: the GBIF envelope is in the legend and the «para revisión» note is not');
  await c.close();
}
await ctx.close(); await nav.close();
console.log(fallos ? `${fallos} FAILED` : 'all passed');
process.exit(fallos ? 1 : 0);
