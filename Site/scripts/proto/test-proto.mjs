// PROTOTYPE smoke test of the redesign (phase 0). Usage: node scripts/proto/test-proto.mjs http://127.0.0.1:4456
// It drives Chrome against the served build and checks B1-B4, the NC rule, the sheet's tabs, grid and contrast, UICN/IUCN by language, and the console.
const { chromium } = await import('playwright-core');
const base = process.argv[2];
let fallos = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fallos++; };
const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [], malas = {}, fuera = {};   // every response of 400 or more and every request to another host, over all the pages the suite opens
const abrir = async (url, o = { viewport: { width: 1400, height: 1000 } }) => { const ctx = await nav.newContext(o); const p = await ctx.newPage(); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message)); p.on('response', (r) => { if (r.status() >= 400) { const k = `${r.status()} ${new URL(r.url()).pathname}`; malas[k] = (malas[k] ?? 0) + 1; if (!/_vercel\/insights/.test(r.url())) errs.push(`${r.status()} ${r.url()}`); } }); p.on('request', (r) => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && !/^(data|blob):/.test(r.url())) fuera[u.hostname] = (fuera[u.hostname] ?? 0) + 1; }); await p.goto(`${base}${url}`); await p.waitForSelector('[data-atlas][data-ready="1"]', { timeout: 60000 }); await p.waitForTimeout(800); return { ctx, p }; };
const estados = (p) => p.evaluate(async () => { const m = document.querySelector('[data-map]').__map; const isos = (await (await fetch('/atlas/datos/admin1.geojson')).json()).features.map((f) => f.properties.iso); const o = {}; for (const id of isos) o[id] = m.getFeatureState({ source: 'estados', id }); return o; });
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const rgbHex = (s) => '#' + s.match(/\d+/g).slice(0, 3).map((x) => (+x).toString(16).padStart(2, '0')).join('');
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((u, v) => v - u); return (x + 0.05) / (y + 0.05); };

{
  const { ctx, p } = await abrir('/atlas/');
  // the overview is not empty: every area is drawn in its species colour; there are no dots at the centre of a range (they read as localities and are not data)
  // the map renders its first frames after the data arrives: wait (up to 10 s) for the areas rather than reading one frame, which a busy machine has not drawn yet
  for (let i = 0; i < 50 && !(await p.evaluate(() => document.querySelector('[data-map]').__map.queryRenderedFeatures({ layers: ['rangos-general'] }).length > 0)); i++) await p.waitForTimeout(200);
  { const n = await p.evaluate(() => { const m = document.querySelector('[data-map]').__map; return { areas: m.queryRenderedFeatures({ layers: ['rangos-general'] }).length, dots: m.querySourceFeatures('centros').length, capa: !!m.getLayer('rangos-centro') }; });
    ok(n.areas > 0 && n.dots === 0, `overview: areas drawn (${n.areas} rendered) and ${n.dots} dots at the centre of a range`); }
  // the localities layer is built ONLY from the attested file /atlas/datos/especies-localidades.geojson: every attested 0.5° cell is a zone marker at its centre (a single cell) or part of an area (connected cells),
  // nothing else is added, and the old phase-0 file is never asked for
  { const n = await p.evaluate(async () => {
      const m = document.querySelector('[data-map]').__map; const at = await (await fetch('/atlas/datos/especies-localidades.geojson')).json();
      const datos = m.getSource('puntosLoc').serialize().data.features;   // what the layer was given, not the tile-split copies queryRenderedFeatures would double-count
      const celdas = at.features.filter((f) => f.geometry.type === 'Polygon');
      const puntos = datos.filter((f) => f.properties.kind === 'cell'), areas = datos.filter((f) => f.properties.kind === 'area'), lagos = datos.filter((f) => f.properties.kind === 'lake');
      const centros = celdas.map((f) => { const r = f.geometry.coordinates[0]; const xs = r.map((q) => q[0]), ys = r.map((q) => q[1]); return [f.properties.slug, (Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; });
      return { celdas: celdas.length, enPuntos: puntos.length, enAreas: areas.reduce((a, f) => a + f.properties.cells, 0), sobran: puntos.filter((f) => !centros.some(([sl, x, y]) => sl === f.properties.slug && x === f.geometry.coordinates[0] && y === f.geometry.coordinates[1])).length, zonas: puntos.filter((f) => f.properties.zona !== true).length, lagos: lagos.map((f) => f.properties.name).sort(), lagosFuente: at.features.filter((f) => f.geometry.type === 'Point').map((f) => f.properties.name).sort(), especies: [...new Set(datos.map((f) => f.properties.slug))].sort(), deLaFuente: [...new Set(at.features.map((f) => f.properties.slug))].sort() }; });
    ok(n.celdas === n.enPuntos + n.enAreas && n.sobran === 0 && n.zonas === 0 && JSON.stringify(n.lagos) === JSON.stringify(n.lagosFuente) && n.lagos.length === 2 && JSON.stringify(n.especies) === JSON.stringify(n.deLaFuente), `the ${n.celdas} attested cells are all drawn: ${n.enPuntos} zone markers exactly at a cell centre and ${n.enAreas} cells in joined areas; the lakes are the attested ${n.lagos.join(' and ')}; no species the file does not name`); }
  // a species whose cells come from the attested localities does not also show the 0.5° squares of its range
  { const n = await p.evaluate(() => { const m = document.querySelector('[data-map]').__map; const loc = new Set(m.querySourceFeatures('puntosLoc').map((f) => f.properties.slug)); const cel = [...new Set(m.querySourceFeatures('rangos').filter((f) => f.properties.method === 'cells_0.5deg').map((f) => f.properties.slug))]; return { cel, conLocalidad: cel.filter((x) => loc.has(x)) }; });
    ok(n.conLocalidad.length === 0, `no 0.5° range square under a species' attested cells (${n.conLocalidad.length} found; squares still drawn for: ${n.cel.join(', ') || 'none'})`); }
  // colour: the palette's floors for all 32, the texture covers every close pair, Mexico runs green (west) to red (east)
  { const r = await p.evaluate(async () => { const c = await (await fetch('/atlas/real/colores.json')).json(); return { hues: c.hues, tinta: c.tinta, patron: c.patron, bajos: c.bajos }; });
    const hx = (h) => { const n = parseInt(h.slice(1), 16); const [R, G, B] = [n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s2 = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B); return (Math.atan2(0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s2, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s2) * 180 / Math.PI + 360) % 360; };
    const sl = Object.keys(r.hues);
    ok(sl.every((x) => cr(r.hues[x], '#0f2b35') >= 3) && sl.every((x) => cr(r.hues[x], r.tinta[x]) >= 4.5), `all ${sl.length} fills reach 3:1 on the state fill and every tab ink reaches 4.5:1 on its fill`);
    ok(new Set(Object.values(r.hues)).size === sl.length, `no two species share a colour (${new Set(Object.values(r.hues)).size} of ${sl.length})`);
    const hw = hx(r.hues.rosaceum), he = hx(r.hues.taylori);
    ok(hw >= 110 && hw <= 170 && (he <= 50 || he >= 340), `Mexico runs green in the west (rosaceum, hue ${hw.toFixed(0)}°) to red in the east (taylori, hue ${he.toFixed(0)}°)`);
    ok(r.bajos.length > 0 && r.bajos.every(([a, b]) => (r.patron[a] || r.patron[b]) && !(r.patron[a] && r.patron[b] && r.patron[a] === r.patron[b])), `all ${r.bajos.length} pairs under ΔE 10 carry a texture on at least one species, and never the same texture on both`);
  }
  // B1: the Species button opens the index at once; there is no layer card with three radios
  ok(await p.$('[data-group-btn="especies"]') !== null && await p.$('#at-indice') === null, 'B1 before the click: the Species button exists and the index is closed');
  await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice');
  ok(await p.$('.at-pop') === null && await p.$('input[type="radio"]') === null, 'B1 the click opens the index directly, with no layer card and no radios');
  // the panel: no rail of icon buttons; Especies and Instalaciones are tabs in its header; the panel is wider
  { const t = await p.$$eval('#at-indice [role="tab"]', (n) => n.map((x) => x.id + ':' + x.getAttribute('aria-selected')));
    const w = await p.$eval('#at-indice', (n) => n.getBoundingClientRect().width);
    ok(await p.$('.at-hud') === null && t.join() === 'ptab-especies:true,ptab-instalaciones:false' && w >= 480, `no icon rail: the panel header has the tabs Especies and Instalaciones (${t.join(' ')}), ${Math.round(w)} px wide`);
    await p.click('#ptab-instalaciones'); await p.waitForSelector('#capa-instalaciones-catalogadas');
    ok(await p.$('#ptab-instalaciones[aria-selected="true"]') !== null && await p.$('[data-species-row]') === null, 'the Instalaciones tab shows the facilities layers inside the panel');
    await p.click('#ptab-especies'); await p.waitForSelector('[data-species-row="andersoni"]'); }
  // the three controls are one block with one look, in this order
  { const c = await p.$$eval('.at-ctls .at-ctl', (n) => n.map((x) => { const i = x.querySelector('input').getBoundingClientRect(); return { top: Math.round(x.getBoundingClientRect().top), k: x.querySelector('input').dataset.richness !== undefined ? 'riqueza' : x.querySelector('input').dataset.capa, w: Math.round(i.width), h: Math.round(i.height), t: x.textContent.trim() }; }));
    ok(c.map((x) => x.k).join() === 'riqueza,limites-admin1,rios-lagos' && new Set(c.map((x) => x.w + 'x' + x.h)).size === 1 && c.map((x) => x.t).join('|') === 'Presencia por estado|Límites de estado|Ríos y lagos', `the three controls, one switch style (${c.map((x) => x.t).join(' / ')})`);
    ok(new Set(c.map((x) => x.top)).size === 1, 'the three controls sit on one line at panel width'); }
  // the capability key sits on the right of the País / Estatus / A–Z toggle, on its line, and is gone from the map legend
  { const r = await p.evaluate(() => { const s = document.querySelector('.at-seg').getBoundingClientRect(), k = document.querySelector('.at-segrow [data-cap-legend]').getBoundingClientRect(); return { mismoRenglon: Math.abs((s.top + s.height / 2) - (k.top + k.height / 2)) < 8, aLaDerecha: k.left >= s.right, texto: document.querySelector('[data-cap-legend]').textContent.replace(/\s+/g, ' ').trim(), enLeyenda: !!document.querySelector('[data-legend] [data-cap-legend]') }; });
    ok(r.mismoRenglon && r.aLaDerecha && !r.enLeyenda && r.texto === 'NeoteniaMetamorfosisRegeneración', `the capability key (${r.texto}) is inline to the right of the sort toggle and not in the legend`); }
  // the list: two columns filled top to bottom, the four groups in order, A–Z inside each
  { const g = await p.$$eval('.at-grp', (n) => n.map((x) => ({ t: x.querySelector('h3 span').textContent, filas: [...x.querySelectorAll('[data-species-row]')].map((r) => r.dataset.speciesRow), lefts: [...x.querySelectorAll('[data-species-row]')].map((r) => Math.round(r.getBoundingClientRect().left)) })));
    ok(g.map((x) => x.t).join('|') === 'México|Estados Unidos|Estados Unidos y Canadá|México, Estados Unidos y Canadá', `groups in order: ${g.map((x) => x.t).join(' · ')}`);
    ok(g.every((x) => JSON.stringify(x.filas) === JSON.stringify([...x.filas].sort())) && g.reduce((a, x) => a + x.filas.length, 0) === 32, 'A–Z inside each group; 32 species');
    ok(g.filter((x) => x.filas.length > 2).every((x) => { const L = Math.min(...x.lefts), R = Math.max(...x.lefts), k = x.lefts.filter((v) => v === L).length; return R > L && x.lefts.every((v, i) => v === (i < k ? L : R)) && k === Math.ceil(x.filas.length / 2); }), 'two columns, column-major: the first column fills top to bottom, then the second, inside each group'); }
  // an italic name must not lose the dot of its final «i» (the slant overhangs the advance width and overflow:hidden clipped it)
  { const r = await p.evaluate(() => ['altamirani', 'bishopi', 'mabeei', 'velasci', 'taylori'].map((s) => { const n = document.querySelector(`[data-species-row="${s}"] .at-nm`); const rg = document.createRange(); rg.selectNodeContents(n); const t = rg.getBoundingClientRect(), b = n.getBoundingClientRect(), fs = parseFloat(getComputedStyle(n).fontSize); return { s, entero: n.scrollWidth <= n.clientWidth, espacio: (b.right - t.right) / fs }; }));
    ok(r.every((x) => x.entero && x.espacio >= 0.12), `the names that end in an italic «i» keep their dot: no truncation and room for the overhang (${r.map((x) => `${x.s} ${x.espacio.toFixed(2)}em`).join(', ')})`); }
  // the capability icons are read from the bundle's traits: gills (obligate and facultative), cycle, sparkles; counts pinned
  { const caps = await p.$$eval('[data-species-row]', (n) => Object.fromEntries(n.map((r) => [r.dataset.speciesRow, [...r.querySelectorAll('[data-cap]')].map((c) => c.dataset.cap).sort()])));
    const quien = (k) => Object.keys(caps).filter((x) => caps[x].includes(k)).sort();
    ok(JSON.stringify(quien('neotenia')) === JSON.stringify(['andersoni', 'dumerilii', 'mexicanum', 'taylori']), `gills, obligate neoteny: ${quien('neotenia').join(', ')}`);
    ok(JSON.stringify(quien('facultativa')) === JSON.stringify(['flavipiperatum', 'gracile', 'granulosum', 'lermaense', 'mavortium', 'ordinarium', 'silvense', 'talpoideum', 'velasci']), `gills, facultative neoteny (9): ${quien('facultativa').join(', ')}`);
    ok(quien('metamorfosis').length === 28 && quien('facultativa').every((x) => caps[x].includes('metamorfosis')) && quien('neotenia').every((x) => !caps[x].includes('metamorfosis')), `cycle icon: ${quien('metamorfosis').length} species can metamorphose; each facultative species carries both icons, no obligate one carries the cycle`);
    ok(['altamirani', 'amblycephalum', 'bombypellum', 'leorae', 'rivulare', 'rosaceum', 'tigrinum'].every((x) => caps[x].includes('metamorfosis') && !caps[x].includes('neotenia') && !caps[x].includes('facultativa')), 'the 7 mostly-metamorphic species carry the cycle icon only');
    ok(JSON.stringify(quien('regeneracion')) === JSON.stringify(['andersoni', 'laterale', 'maculatum', 'mexicanum', 'tigrinum']), `sparkles, documented regeneration: ${quien('regeneracion').join(', ')}`);
    const tips = await p.$$eval('[data-species-row="andersoni"] [data-cap]', (n) => n.map((c) => c.title));
    ok(tips.includes('Neotenia: de adulta conserva sus branquias') && tips.includes('Regeneración de patas documentada en estudios') && await p.$eval('[data-species-row="gracile"] [data-cap="facultativa"]', (c) => c.title) === 'Neotenia facultativa: puede transformarse o conservar branquias', 'the tooltips carry the Coms lines'); }
  // textured species: the swatch of a species with a texture carries it; the map has a texture layer and its pictures
  { const sw = await p.$$eval('[data-species-row]', (n) => Object.fromEntries(n.map((r) => [r.dataset.speciesRow, r.querySelector('.at-sw').dataset.trama || ''])));
    const pat = await p.evaluate(async () => (await (await fetch('/atlas/real/colores.json')).json()).patron);
    ok(Object.keys(sw).every((x) => sw[x] === (pat[x] ?? '')) && Object.values(sw).filter(Boolean).length === Object.keys(pat).length, `${Object.keys(pat).length} swatches carry their texture, the rest are plain`);
    const img = await p.evaluate(() => { const m = document.querySelector('[data-map]').__map; return { capas: ['rangos-trama', 'localidades-punto-trama', 'localidades-lago-trama'].every((x) => !!m.getLayer(x)), area: m.hasImage('trama-jeffersonianum'), punto: m.hasImage('pt-amblycephalum') }; });
    ok(img.capas && img.area && img.punto, 'the map draws the texture on areas (jeffersonianum) and on points (amblycephalum)'); }
  // the list: no country dots, room above each section; the overview legend names regions only
  { const r = await p.evaluate(() => ({ puntos: document.querySelectorAll('.at-rg').length, gaps: [...document.querySelectorAll('.at-grp')].slice(1).map((g) => parseFloat(getComputedStyle(g).marginTop)) }));
    ok(r.puntos === 0 && r.gaps.every((v) => v >= 20), `no country dots in the rows (${r.puntos}); ${r.gaps.length} section headings have at least ${Math.min(...r.gaps)} px above them`);
    const l = await p.$$eval('[data-legend] .at-row', (n) => n.map((x) => x.textContent.trim()));
    const todo = await p.$eval('[data-legend]', (n) => n.textContent);
    ok(['Canadá y EE. UU.', 'EE. UU.', 'México', 'México, EE. UU. y Canadá'].every((t) => l.includes(t)) && !/morado|rojo|azulado|verde|trama|por geografía|un color por especie|Qué se dibuja|Capacidades|Distribución potencial|Localidad/i.test(todo) && l.length === 4, 'the overview legend keeps only the four region swatches: no «Qué se dibuja» block, no capability key, no sentence about how the colours were chosen'); }
  // B2: richness is off by default
  ok(await p.$eval('[data-richness]', (n) => n.getAttribute('aria-checked')) === 'false', 'B2 the richness switch is off by default');
  const base0 = await estados(p);
  ok(Object.values(base0).every((s) => s.color === '#0f2b35'), 'B2 off: no state is coloured');
  await p.click('[data-richness]'); await p.waitForTimeout(300);
  const ric = await estados(p);
  ok(Object.values(ric).some((s) => s.color !== '#0f2b35'), 'B2 on: states are coloured by species count');
  // B3 / B4
  await p.hover('[data-species-row="mexicanum"]'); await p.waitForTimeout(500);
  const dur = await estados(p);
  ok(Object.values(dur).every((s) => s.color === '#0f2b35') && Object.values(dur).some((s) => s.vista || s.vistaLinea), 'B3 hovering a species turns the richness colouring off and tints only its own states');
  await p.mouse.move(700, 600); await p.waitForTimeout(500);
  const des = await estados(p);
  ok(JSON.stringify(des) === JSON.stringify(ric), 'B4 leaving the species gives back exactly the richness colouring that was on');
  await p.click('[data-richness]');
  // colour by geography: the class of a species' countries sets its colour (hue by position inside the class: checked on the palette above); every row's swatch carries it
  { const hue = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const [R, G, B] = [r, g, b].map(f); const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s2 = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B); return (Math.atan2(0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s2, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s2) * 180 / Math.PI + 360) % 360; };
    const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const ac = await p.$$eval('[data-species-row]', (ns) => Object.fromEntries(ns.map((n) => [n.dataset.speciesRow, n.dataset.accent])));
    const [hu, hc, ht] = [hue(hexRgb(ac.annulatum)), hue(hexRgb(ac.jeffersonianum)), hue(hexRgb(ac.mavortium))];
    ok(hu >= 190 && hu <= 256, `a US-only species (annulatum) is cyan-teal to deep blue (hue ${hu.toFixed(0)}°)`);
    ok(hc >= 285 || hc <= 15, `a Canada-and-US species (jeffersonianum) is violet to magenta-red (hue ${hc.toFixed(0)}°)`);
    ok(ht >= 40 && ht <= 100, `mavortium (Canada, US and Mexico) is yellow-orange (hue ${ht.toFixed(0)}°)`);
    ok(new Set(Object.values(ac)).size === Object.keys(ac).length && Object.keys(ac).length === 32, `the list carries 32 different colours (${new Set(Object.values(ac)).size})`);
    ok(await p.$('[data-palette-switch]') === null, 'the A and B palette switch is gone'); }
  // the default map has no state or province boundaries; the checkboxes of the species list switch them and the rivers on
  { const vis = (id) => p.evaluate((x) => document.querySelector('[data-map]').__map.getLayoutProperty(x, 'visibility'), id);
    ok(await vis('estados-linea') === 'none' && await p.$eval('[data-capa="limites-admin1"]', (n) => !n.checked), 'the default map draws no state or province boundaries; the checkbox is off');
    await p.click('[data-capa="limites-admin1"]'); await p.waitForTimeout(200);
    ok(await vis('estados-linea') === 'visible', 'the checkbox in the species list switches the boundaries on');
    await p.click('[data-capa="limites-admin1"]');
    ok(await vis('rios-linea') === 'none' && await p.$eval('[data-capa="rios-lagos"]', (n) => !n.checked), 'rivers and lakes are off by default');
    await p.click('[data-capa="rios-lagos"]'); await p.waitForTimeout(200);
    ok(await vis('rios-linea') === 'visible' && await vis('lagos-relleno') === 'visible', 'the checkbox switches the rivers and the lakes on');
    await p.click('[data-capa="rios-lagos"]'); }
  // the water is clipped to the land of Mexico, the United States and Canada: no vertex in Central America or the Caribbean
  { const bad = await p.evaluate(async () => { const g = await (await fetch('/atlas/real/agua.geojson')).json(); let n = 0; const v = (c) => (typeof c[0] === 'number' ? [c] : c.flatMap(v)); for (const f of g.features) for (const [x, y] of v(f.geometry.coordinates)) if (y < 14.3 || (y < 18.4 && x > -88.2)) n++; return n; });
    ok(bad === 0, `no river or lake vertex over Central America or the Caribbean (${bad} found)`); }
  // the status pills show only under the «Estatus» sort; they filter the map too; leaving Estatus clears them
  { const lit = (id) => p.evaluate((x) => { const f = document.querySelector('[data-map]').__map.getFilter(x); const l = JSON.stringify(f).match(/"literal",(\[[^\]]*\])/); return l ? JSON.parse(l[1]) : null; }, id);
    await p.click('.at-filtros-btn').catch(() => {});
    ok(await p.$('[data-pills]') === null, 'in País (the default) the status pills are hidden');
    await p.click('[data-g="az"]'); ok(await p.$('[data-pills]') === null, 'in A–Z the status pills are hidden');
    await p.click('[data-g="iucn"]'); await p.waitForSelector('[data-pills]');
    const todas = (await lit('rangos-general')).length;
    await p.click('.at-chips .at-chip:nth-child(2)'); await p.waitForTimeout(500);
    const filas = await p.$$eval('[data-species-row]', (n) => n.map((x) => x.dataset.speciesRow).sort());
    const mapa = [...(await lit('rangos-general'))].sort();
    ok(todas === 32 && filas.length < 32 && JSON.stringify(filas) === JSON.stringify(mapa), `a status pill filters the map too: ${filas.length} species listed, the map draws the same ${mapa.length}`);
    await p.click('[data-g="pais"]'); await p.waitForTimeout(500);
    ok(await p.$('[data-pills]') === null && (await p.$$('[data-species-row]')).length === 32 && (await lit('rangos-general')).length === 32, 'leaving Estatus hides the pills and clears the filter: 32 listed, 32 on the map');
    await p.click('[data-g="iucn"]'); await p.waitForSelector('[data-pills]'); await p.click('.at-chips .at-chip:nth-child(1)'); await p.waitForTimeout(400);
    ok((await lit('rangos-general')).length === 32, 'the «Todas» pill gives every species back on the map'); await p.click('[data-g="pais"]'); }
  // select, then close: back to what was there
  await p.click('[data-species-row="andersoni"]'); await p.waitForSelector('#at-detalle'); await p.waitForTimeout(500);
  ok(Object.values(await estados(p)).some((s) => s.vista || s.vistaLinea), 'B3 a chosen species stays highlighted while its sheet is open');
  { const lit = (id) => p.evaluate((x) => { const f = document.querySelector('[data-map]').__map.getFilter(x); const l = JSON.stringify(f).match(/"literal",(\[[^\]]*\])/); return l ? JSON.parse(l[1]) : []; }, id);
    const sola = async () => { const g = [...(await lit('rangos-general')), ...(await lit('rangos-trama')), ...(await lit('localidades-punto')), ...(await lit('localidades-punto-trama')), ...(await lit('localidades-lago')), ...(await lit('localidades-lago-trama')), ...(await lit('localidades-area')), ...(await lit('localidades-area-trama'))]; return [...new Set(g)]; };
    { const q = await sola(); ok(q.every((x) => x === 'andersoni') && (await lit('rangos-general')).length === 0, `a chosen species hides every other area and point (the map draws: ${q.join(', ') || 'nothing but its own outline'})`); }
    await p.click('[data-close="detalle"]'); await p.waitForTimeout(500);
    ok((await lit('rangos-general')).length === 32, 'deselecting the species gives the previous view back (all 32 on the map)');
    await p.click('[data-species-row="andersoni"]'); await p.waitForSelector('#at-detalle'); await p.waitForTimeout(400); }
  { const es = await estados(p); ok(Object.values(es).some((s) => s.vistaLinea) && !Object.values(es).some((s) => s.vista), 'a species with a lake (andersoni) shows its states as an outline, not a fill'); }
  ok(await p.$eval('[data-cell="lifeform"] .at-cv', (n) => n.textContent.trim()) === 'Neotenia obligada' && await p.$eval('[data-cell="endemism"] .at-cv', (n) => n.textContent.trim()) === 'Endémica de México', 'grid wording: «Neotenia obligada» and «Endémica de México»');
  // E3: four tabs; E4: grid; E3: AA on the active tab
  ok((await p.$$eval('#at-detalle [role="tab"]', (n) => n.map((x) => x.id))).join() === 'tab-resumen,tab-alimentacion,tab-medidas,tab-fuentes', 'E3 four tabs: Resumen, Alimentación, Medidas, Fuentes');
  ok((await p.$$eval('.at-cell', (n) => n.length)) >= 6 && await p.$$eval('.at-cell', (n) => n.every((c) => !c.dataset.nodata)), 'E4 the grid shows only the tiles that have a value (none says «sin dato»); the status lives in its own block');
  ok(await p.$eval('[data-escala="cites"] .at-enombre', (n) => n.textContent.trim()) === 'No listada', 'E4 the CITES row of the status block reads «No listada» for a species CITES does not list');
  await p.hover('[data-cell="habitat"]'); await p.waitForSelector('[data-cell-detail="habitat"]');
  ok(true, 'E4 hovering a cell shows its detail');
  for (const slug of ['andersoni', 'mavortium', 'velasci']) {
    await p.click('[data-close="detalle"]'); await p.click(`[data-species-row="${slug}"]`); await p.waitForSelector('#at-detalle'); await p.waitForTimeout(300);
    const [bg, fg] = await p.$eval('[role="tab"][aria-selected="true"]', (n) => { const c = getComputedStyle(n); return [c.backgroundColor, c.color]; });
    ok(cr(rgbHex(bg), rgbHex(fg)) >= 4.5, `E3 the active tab of ${slug} reaches AA (${cr(rgbHex(bg), rgbHex(fg)).toFixed(2)}:1)`);
  }
  await p.click('[data-close="detalle"]'); await p.click('[data-species-row="mavortium"]'); await p.waitForSelector('#at-detalle'); await p.waitForTimeout(300);
  ok(await p.$eval('[data-cell="endemism"] .at-cv', (n) => n.textContent.trim()) === 'En 3 países' && await p.$('[data-no-text]') === null, 'mavortium: «En 3 países» and the site\'s own text in the Resumen');
  await p.click('#tab-medidas'); await p.waitForTimeout(200);
  ok((await p.$$eval('[data-cmp] small', (n) => n.map((x) => x.textContent))).every((t) => !/new species|Reptiles of/.test(t) && /\d{4}/.test(t)), 'E6 the comparison captions carry a short citation (author, year), not a source title');
  { const es = await estados(p); ok(Object.values(es).some((s) => s.vistaLinea) && !Object.values(es).some((s) => s.vista), 'mavortium (a range) shows its states as an outline'); }
  await p.click('[data-close="detalle"]'); await p.click('[data-species-row="barbouri"]'); await p.waitForSelector('#at-detalle'); await p.waitForTimeout(300);
  ok(await p.$('[data-no-text]') === null && /salamandra metamórfica/.test(await p.$eval('.at-desc', (n) => n.textContent)), 'a species without site text (barbouri) shows the founder-approved Resumen text');
  await p.click('[data-close="detalle"]'); await p.click('[data-species-row="velasci"]'); await p.waitForSelector('#at-detalle');
  await p.click('[data-close="detalle"]'); await p.click('[data-species-row="amblycephalum"]'); await p.waitForSelector('#at-detalle'); await p.waitForTimeout(300);
  ok(await p.$('[data-cell="altitude"]') === null, 'E4 a tile with nothing cited (altitude of amblycephalum) is not drawn');
  await p.click('[data-close="detalle"]'); await p.click('[data-species-row="velasci"]'); await p.waitForSelector('#at-detalle');
  // the lake wording is only for a species whose whole range is the lake; a locality marker says «Localidad (generalizada)»
  for (const [slug, quieren, noQuieren] of [['andersoni', ['Localidades (celdas de 0.5° unidas)'], ['Zacapu', 'toda su distribución', 'Localidad citada']], ['mexicanum', ['Localidad (generalizada)'], ['Xochimilco', 'toda su distribución', 'Localidad citada', 'página del PDF', 'pág. 38']], ['taylori', ['Localidad citada: Laguna de Alchichica'], ['toda su distribución']], ['dumerilii', ['Contorno del lago', 'Localidad citada: Lago de Pátzcuaro'], []]]) {
    await p.click('[data-close="detalle"]'); await p.click(`[data-species-row="${slug}"]`); await p.waitForSelector('#at-detalle'); await p.waitForTimeout(500);
    const l = await p.$eval('[data-legend]', (n) => n.textContent);
    ok(quieren.every((q) => l.includes(q)) && noQuieren.every((q) => !l.includes(q)) && !l.includes('Áreas que se cruzan'), `legend of ${slug}: ${quieren.map((q) => '«' + q + '»').join(' and ')}, never ${noQuieren.map((q) => '«' + q + '»').join(' or ')}, and no neighbours block`);
    const lagos = await p.$$eval('[data-lake]', (n) => n.map((b) => b.dataset.lake)); const esperado = { taylori: ['Laguna de Alchichica'], dumerilii: ['Lago de Pátzcuaro'] }[slug] ?? [];
    ok(JSON.stringify(lagos) === JSON.stringify(esperado), `${slug}: the lake labels on the map are the attested water bodies (${esperado.join(', ') || 'none'}), never one the range file adds (${lagos.join(', ') || 'none'})`);
  }
  // the legend of a chosen species: each swatch once, no two alike; the area's kind is text; outline-only states, a point and a lake have lines of their own
  for (const [slug, quiere] of [['rosaceum', ['Distribución potencial']], ['leorae', ['Localidad (generalizada)']], ['andersoni', ['Localidades (celdas de 0.5° unidas)']]]) {
    await p.click('[data-close="detalle"]'); await p.click(`[data-species-row="${slug}"]`); await p.waitForSelector('#at-detalle'); await p.waitForTimeout(500);
    const filas = await p.$$eval('[data-legend] .at-row', (n) => n.filter((r) => r.querySelector('.at-sw')).map((r) => ({ sw: r.querySelector('.at-sw').outerHTML.replace(/class="at-sw/, 'class="at-sw'), t: r.textContent.trim() })));
    const sw = filas.map((f) => f.sw);
    ok(new Set(sw).size === sw.length && quiere.every((q) => filas.some((f) => f.t.includes(q))), `legend of ${slug}: ${filas.length} lines, no two swatches alike (${filas.map((f) => f.t).join(' / ')})`);
  }
  { const l = await p.$eval('[data-legend]', (n) => n.textContent); ok(!/Zona de localidades/.test(l), 'a species drawn as points shows no area line (the 0.5° square is not drawn)'); }
  // hovering a species behaves like choosing it: every other species' area and point is hidden; leaving gives the view back (B4)
  { await p.click('[data-close="detalle"]'); await p.waitForTimeout(500);
    const lit = (id) => p.evaluate((x) => { const f = document.querySelector('[data-map]').__map.getFilter(x); const l = JSON.stringify(f).match(/"literal",(\[[^\]]*\])/); return l ? JSON.parse(l[1]) : []; }, id);
    const dibujadas = async () => [...new Set([...(await lit('rangos-general')), ...(await lit('rangos-trama')), ...(await lit('localidades-punto')), ...(await lit('localidades-punto-trama')), ...(await lit('localidades-lago')), ...(await lit('localidades-lago-trama')), ...(await lit('localidades-area')), ...(await lit('localidades-area-trama'))])];
    const antes = (await dibujadas()).length;
    await p.hover('[data-species-row="tigrinum"]'); await p.waitForTimeout(600);
    const rel = await p.evaluate(() => JSON.stringify(document.querySelector('[data-map]').__map.getFilter('rangos-relleno')));
    ok(antes === 32 && (await dibujadas()).every((x) => x === 'tigrinum') && rel.includes('tigrinum'), `hovering tigrinum hides every other species' area and point (${antes} drawn before, ${(await dibujadas()).filter((x) => x !== 'tigrinum').length} others after)`);
    const l = await p.$eval('[data-legend]', (n) => n.textContent); ok(!l.includes('Áreas que se cruzan') && l.includes('Ambystoma tigrinum'), 'the legend of a hovered species has no neighbours block');
    await p.hover('[data-species-row="leorae"]'); await p.waitForTimeout(600);
    ok(JSON.stringify(await dibujadas()) === JSON.stringify(['leorae']) || JSON.stringify(await dibujadas()) === '["leorae"]', 'hovering a species with a point (leorae) draws that point and no other');
    await p.mouse.move(700, 600); await p.waitForTimeout(700);
    ok((await dibujadas()).length === 32, 'leaving the species gives all 32 back on the map');
    await p.click('[data-species-row="velasci"]'); await p.waitForSelector('#at-detalle'); }
  // the «presencia sin localidad publicada» chips and note are gone: that judgement was phase-0 data, and nothing checks it against the attested cells
  { await p.click('[data-close="detalle"]'); await p.click('[data-species-row="rivulare"]'); await p.waitForSelector('#at-detalle'); await p.waitForTimeout(400);
    await p.$$eval('.at-pcountry[aria-expanded="false"]', (n) => n.forEach((x) => x.click())); await p.waitForTimeout(200);
    ok(await p.$('[data-sinloc]') === null && await p.$('[data-sinloc-note]') === null && !(await p.$eval('#at-detalle', (x) => x.textContent)).includes('sin localidad publicada'), 'rivulare: no state is marked «presencia sin localidad publicada»'); }
  await p.click('[data-close="detalle"]'); await p.click('[data-species-row="mexicanum"]'); await p.waitForSelector('#at-detalle'); await p.click('#tab-alimentacion'); await p.waitForTimeout(500);
  await p.click('[data-close="detalle"]'); await p.click('[data-species-row="velasci"]'); await p.waitForSelector('#at-detalle');
  // E2: expand
  await p.click('[data-expand]'); await p.waitForTimeout(400);
  ok(await p.$eval('[data-atlas]', (n) => n.dataset.expanded) === '1', 'E2 the expand button widens the same sheet');
  await p.click('[data-expand]');
  // E1: the scientific name once, no repeated «A. x» line, no authorship in the header
  ok(await p.$eval('#at-det-t', (n) => n.textContent) === 'Ambystoma velasci' && !(await p.$eval('.at-head', (n) => /Baird|Dugès|, \d{4}/.test(n.textContent))), 'E1 the header names the species once and carries no authorship');
  // E6: a missing measure says «sin dato», never a value
  await p.click('[data-close="detalle"]'); await p.click('[data-species-row="andersoni"]'); await p.click('#tab-medidas'); await p.waitForTimeout(300);
  ok(await p.$eval('[data-cota="head"]', (n) => n.dataset.nodata === '1' && /sin dato/.test(n.textContent)), 'E6 a missing measure (head width) is drawn dashed and says «sin dato»');
  await ctx.close();
}
// C: the NC layers (CONABIO) can be switched on in the public atlas, with CONABIO named; never in the kiosk. The CONABIO water sites are hidden entirely; there is no Water and no Context tab.
{
  const { ctx, p } = await abrir('/atlas/');
  ok(await p.$('[data-group-btn="agua"]') === null && await p.$('[data-group-btn="contexto"]') === null, 'there is no Water tab and no Context tab');
  await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice'); await p.click('[data-group-btn="instalaciones"]');
  ok(await p.$('#capa-sitios-conagua-2013') === null, 'the CONABIO water sites (2013) are hidden entirely');
  await p.click('#capa-uma-extensivas'); await p.waitForTimeout(600);
  const at = await p.$$eval('[data-attribution]', (n) => n.map((x) => x.textContent));
  ok(at.some((t) => /CONABIO/.test(t) && !/CONAGUA/.test(t)), 'C3 the NC layer (UMA extensivas) can be switched on and its attribution names CONABIO');
  ok(await p.$('#capa-organizaciones-registradas') !== null && await p.$('[data-group-btn="organizaciones"]') === null, 'C2 organizations are inside the Facilities group; there is no group of their own');
  await ctx.close();
  const k = await abrir('/atlas/?kiosko=1');
  ok(await k.p.$eval('[data-atlas]', (n) => n.dataset.kiosko === '1' && n.dataset.nc === '0'), 'the kiosk starts with the NC layers off');
  await k.p.click('[data-group-btn="especies"]'); await k.p.waitForSelector('#at-indice'); await k.p.click('[data-group-btn="instalaciones"]');
  ok(await k.p.$eval('#capa-uma-extensivas', (n) => n.disabled), 'in the kiosk the NC layer cannot be switched on');
  await k.ctx.close();
}
// a point pulses under the pointer and says what it is: «ubicación generalizada (~50 km)» for a generalised cell, «Localidad citada: <place>» for a named one
{
  const { ctx, p } = await abrir('/atlas/');
  const mover = async (slug, lake, lon) => {
    // the panel slides in: a click during the slide can make the browser scroll the page, so wait it out
    if (!(await p.$('#at-indice'))) { await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice'); await p.waitForTimeout(700); }
    const cerrado = await p.$('[data-close="detalle"]'); if (cerrado) await cerrado.click();
    await p.click(`[data-species-row="${slug}"]`); await p.waitForSelector('#at-detalle');
    await p.waitForFunction(() => new Promise((r) => { const m = document.querySelector('[data-map]').__map; if (!m.isMoving()) setTimeout(() => r(!m.isMoving()), 700); else r(false); }), null, { timeout: 15000 });
    await p.evaluate(() => window.scrollTo(0, 0));
    const d = await p.evaluate(async ({ slug, lake, lon }) => {
      const m = document.querySelector('[data-map]').__map; const fc = await (await fetch('/atlas/datos/especies-localidades.geojson')).json();
      let f = fc.features.find((x) => x.properties.slug === slug && (!lake || x.geometry.type === 'Point') && (lon === undefined || x.geometry.coordinates[0] === lon));
      if (!lake) { const r = f.geometry.coordinates[0], xs = r.map((q) => q[0]), ys = r.map((q) => q[1]); f = { geometry: { coordinates: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] } }; }   // the cell's centre: where its marker is
      m.jumpTo({ center: f.geometry.coordinates, zoom: 9 }); window.__c = f.geometry.coordinates; return f.geometry.coordinates;
    }, { slug, lake, lon });
    // the species may be re-framed by the page a moment after it is chosen: jump again until the camera has stayed where the test put it
    for (let k = 0; k < 6; k++) { await p.waitForTimeout(900); const quieto = await p.evaluate(() => { const m = document.querySelector('[data-map]').__map; return !m.isMoving() && m.loaded() && Math.abs(m.getZoom() - 9) < 0.01; }); if (quieto) break; await p.evaluate(() => document.querySelector('[data-map]').__map.jumpTo({ center: window.__c, zoom: 9 })); }
    await p.evaluate(() => window.scrollTo(0, 0));
    const [x, y] = await p.evaluate((c) => { const m = document.querySelector('[data-map]').__map; const r = document.querySelector('[data-map]').getBoundingClientRect(); const q = m.project(c); return [r.left + q.x, r.top + q.y]; }, d);
    // a textured disc is a picture made on first use, so the first hover can come before the point is drawn: move off and on again until the tooltip is there (the page, not the test, decides when)
    for (let intento = 0; intento < 8; intento++) { await p.mouse.move(x - 60, y + 80); await p.mouse.move(x, y, { steps: 4 }); try { await p.waitForSelector('.at-ptip', { timeout: 1500 }); break; } catch { /* try again */ } }
    await p.waitForTimeout(150);
  };
  await mover('leorae', false);
  ok(await p.$('.at-ping .at-ring') !== null && (await p.$eval('.at-ptip', (n) => n.textContent)).includes('ubicación generalizada (~50 km)'), 'hovering a generalised point pulses and says «ubicación generalizada (~50 km)»');
  // a zone marker is a big disc at this zoom: leave it by the far corner of the map
  { const r = await p.$eval('[data-map]', (n) => { const b = n.getBoundingClientRect(); return [b.left + 8, b.top + 8]; }); await p.mouse.move(r[0], r[1], { steps: 8 }); }
  await p.waitForTimeout(500);
  ok(await p.$('.at-ping') === null, 'the pulse and the tooltip go when the pointer leaves');
  await mover('mexicanum', false);
  { const t = await p.$eval('.at-ptip', (n) => n.dataset.ping + '|' + n.textContent);
    ok(await p.$('.at-ping .at-ring') !== null && t.includes('ubicación generalizada (~50 km)') && !/Estado de México|·/.test(t), 'a zone marker (mexicanum, one attested cell) says «ubicación generalizada (~50 km)» and no state: the attested file carries none'); }
  { const v = await p.$eval('.at-ptip', (n) => { const r = n.getBoundingClientRect(), c = document.querySelector('[data-map]').getBoundingClientRect(); return r.left >= c.left && r.right <= c.right; }); ok(v, 'the tooltip stays inside the map'); }
  ok(await p.$('.at-ptnota') === null, 'no «fuentes difieren» note on a point: the attested file does not say the sources differ');
  await p.mouse.move(700, 900, { steps: 6 }); await p.waitForTimeout(400);
  await mover('dumerilii', true);
  ok(await p.$('.at-ping') !== null && (await p.$eval('.at-ptip', (n) => n.textContent)).includes('Localidad citada: Lago de Pátzcuaro'), 'hovering a named point says «Localidad citada: Lago de Pátzcuaro» (an attested water body)');
  await ctx.close();
}
// «México» is ambiguous: the state is «Estado de México» wherever it is named (chips, citation rows, tooltips), in es, en and pt; the country chip keeps «México»
for (const [loc, estado, pais] of [['', 'Estado de México', 'México'], ['/en', 'State of Mexico', 'Mexico'], ['/pt', 'Estado do México', 'México']]) {
  const { ctx, p } = await abrir(`${loc}/atlas/`);
  await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice'); await p.click('[data-species-row="lermaense"]'); await p.waitForSelector('#at-detalle'); await p.waitForTimeout(600);
  const chips = await p.$$eval('[data-presence] .at-pchip', (n) => n.map((x) => x.textContent.trim()));
  ok(chips.includes(pais) && chips.includes(estado) && !chips.some((c, i) => c === pais && i > chips.indexOf(estado)), `${loc || '/es'}: lermaense's chips are the country «${pais}» and the state «${estado}»`);
  if (loc === '') {
    await p.waitForSelector('[data-legend][data-legend-for="lermaense"][data-legend-ready="1"] [data-fuente-punto]', { state: 'attached', timeout: 15000 });
    const l = await p.$eval('[data-legend]', (n) => n.textContent);
    ok(!l.includes('celdas de 0.5° de') && l.includes('New salamanders from Mexico') && l.includes('PACE Ambystoma 2018, p. 35') && l.split('p. 35').length === 2 && !l.includes('leído del mapa impreso') && !l.includes('corroborado'), 'lermaense: the legend names the sources the attested file names (Taylor 1940; the PACE map p. 35 with «pág. 35» read from its key) and no corroboration line');
    await p.click('#tab-fuentes'); await p.waitForTimeout(300);
    const ft = await p.$eval('[data-points-sources]', (n) => n.textContent);
    ok(ft.includes('Taylor, E. H. 1940. New salamanders from Mexico') && ft.includes('mapa de A. lermaense, p. 35'), 'the Fuentes tab keeps the full references of the drawn points');
    await p.click('[data-close="detalle"]'); await p.click('[data-species-row="leorae"]'); await p.waitForSelector('#at-detalle'); await p.waitForTimeout(500);
    ok((await p.$eval('[data-legend] .at-src .at-lt', (n) => n.textContent)) === 'Fuentes de las localidades', 'a species that draws only points has the legend heading «Fuentes de las localidades»');
    ok((await p.$eval('[data-legend]', (n) => n.textContent)).includes('Mapa de especies del sitio (public/map/mexico-interactive.svg)'), 'leorae: «Mapa de especies del sitio» appears because the attested file names it as the source of its cell');
  }
  await ctx.close();
}
// the «fuentes difieren» block is gone from the sheet: nothing in the attested localities says two sources disagree, and the phase-0 note file is no longer read
for (const [loc, slug] of [['', 'lermaense'], ['', 'andersoni'], ['/en', 'lermaense'], ['/pt', 'andersoni']]) {
  const { ctx, p } = await abrir(`${loc}/atlas/`);
  const pedidos = []; p.on('request', (r) => pedidos.push(r.url()));
  await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice'); await p.click(`[data-species-row="${slug}"]`); await p.waitForSelector('#at-detalle'); await p.waitForTimeout(500);
  ok(await p.$('[data-fuentes-difieren]') === null && await p.$('[data-nota-difiere]') === null, `${loc || '/es'} ${slug}: the sheet has no «sources differ» block`);
  await ctx.close();
}
// a species whose cells all join into areas (andersoni): neither its legend nor its Fuentes tab prints the phase-0 «celdas de 0.5°» source, and both use the same range rule
{
  const { ctx, p } = await abrir('/atlas/');
  await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice'); await p.click('[data-species-row="andersoni"]'); await p.waitForSelector('#at-detalle'); await p.waitForTimeout(600);
  const lg = await p.$eval('[data-legend]', (n) => n.textContent);
  await p.click('#tab-fuentes'); await p.waitForTimeout(300);
  const ft = await p.$eval('#at-detalle', (n) => n.textContent);
  ok(!lg.replace('Localidades (celdas de 0.5° unidas)', '').includes('celdas de 0.5°') && !ft.includes('celdas de 0.5°') && (await p.$$('#at-detalle [data-range-source] li')).length === 0, 'andersoni (all its cells join into areas): the legend and the Fuentes tab carry no range-file «celdas de 0.5°» source, and the sheet lists no range source line');
  await ctx.close();
}
// the sources of the drawn cells come from the attested file: each source once, the page read from its key; and the map never asks for the phase-0 locality or source files
{
  const { ctx, p } = await abrir('/atlas/');
  await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice'); await p.click('[data-species-row="rivulare"]'); await p.waitForSelector('#at-detalle'); await p.waitForSelector('[data-legend][data-legend-for="rivulare"][data-legend-ready="1"]', { state: 'attached' });
  const l = await p.$eval('[data-legend]', (n) => n.textContent);
  ok(l.includes('PACE Ambystoma 2018, p. 43') && l.split('p. 43').length === 2 && !l.includes('leído del mapa impreso') && l.includes('Legorreta-Balbuena') && !l.includes('corroborado') && !l.includes('celdas de 0.5° de'), 'rivulare: the legend names each source the attested file gives for its cells once, with the page read from the key (pág. 43) and no corroboration line' + (l.includes('Legorreta') ? '' : ` [${l.slice(0, 300)}]`));
  ok(l.includes('Localidades (celdas de 0.5° unidas)'), 'rivulare: its joined cells have a legend item that says what they are');
  await ctx.close();
  // a planted point in the old file must not appear, and the old files are not even requested
  const h = await abrir('/atlas/', { viewport: { width: 1400, height: 900 } });
  const pedidos = []; h.p.on('request', (r) => pedidos.push(new URL(r.url()).pathname));
  await h.p.route('**/atlas/real/localidades.geojson', async (r) => r.fulfill({ json: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { slug: 'mexicanum', kind: 'locality', generalization: '0.5deg', zona: true }, geometry: { type: 'Point', coordinates: [-90.123, 10.456] } }] } }));
  await h.p.reload(); await h.p.waitForSelector('[data-atlas][data-ready="1"]'); await h.p.waitForTimeout(1200);
  const hay = await h.p.evaluate(async () => { const m = document.querySelector('[data-map]').__map; const enDatos = JSON.stringify(m.getSource('puntosLoc').serialize().data).includes('-90.123'); m.jumpTo({ center: [-90.123, 10.456], zoom: 6 }); await new Promise((r) => { m.once('idle', r); setTimeout(r, 4000); }); return enDatos || m.querySourceFeatures('puntosLoc').some((f) => JSON.stringify(f.geometry).includes('-90.123')) || m.queryRenderedFeatures({ layers: ['localidades-punto', 'localidades-punto-trama'] }).some((f) => f.properties.slug === 'mexicanum' && Math.abs(f.geometry.coordinates[0] + 90.123) < 0.01); });
  ok(!hay && !pedidos.some((x) => /\/atlas\/real\/(localidades|fuentes-localidades|fuentes-puntos)\.(geo)?json$/.test(x)) && pedidos.includes('/atlas/datos/especies-localidades.geojson'), 'the points layer is built only from /atlas/datos/especies-localidades.geojson: a planted point in the old file does not appear, and neither it nor the phase-0 source notes are requested');
  await h.ctx.close();
}
// a closed place shows only its name, its place and «cerrado · mes de año»; the full-cycle card is built but OFF, and none of its wording renders
{
  const sintetica = { id: 'prueba-cerrada', nombre: 'Lugar de prueba (dato sintético)', tipo_recinto: 'criadero', tipo_legal: 'pimvs', tipo_legal_fuente: 'https://example.org/x', iso: 'MX-MEX', cve_ent: '15', cve_mun: '104', municipio: 'Municipio de prueba', estado: 'Estado de prueba', nivel: 'municipio', especies: 'Ambystoma mexicanum', exhibicion_publica: 'si', estado_operacion: 'cerrado', estado_fecha: '2026-09', verificacion: 'ficha-oficial' };
  const { ctx, p } = await abrir('/atlas/', { viewport: { width: 1400, height: 1000 } });
  await p.route('**/atlas/datos/instalaciones-catalogadas.geojson', async (r) => { const j = await (await r.fetch()).json(); j.features.push({ type: 'Feature', properties: sintetica, geometry: { type: 'Point', coordinates: [-99.17, 19.54] } }); await r.fulfill({ json: j }); });
  await p.reload(); await p.waitForSelector('[data-atlas][data-ready="1"]'); await p.waitForTimeout(800);
  await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice'); await p.click('#ptab-instalaciones'); await p.click('#capa-instalaciones-catalogadas'); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-map]').__map.jumpTo({ center: [-99.17, 19.54], zoom: 9 })); await p.waitForTimeout(900);
  const [x, y] = await p.evaluate(() => { const m = document.querySelector('[data-map]').__map; const r = document.querySelector('[data-map]').getBoundingClientRect(); const q = m.project([-99.17, 19.54]); return [r.left + q.x, r.top + q.y]; });
  await p.mouse.click(x, y); await p.waitForTimeout(500);
  const pop = await p.$eval('.atlas-popup', (n) => n.textContent).catch(() => '');
  ok(pop.includes('cerrado · septiembre de 2026') && pop.includes('Municipio de prueba') && !/Figura legal|Verificación|criadero|pimvs|Ambystoma/.test(pop), `a closed row's popup reads «cerrado · septiembre de 2026» with its place, and no legal figure, type or notes (${pop.slice(0, 90)})`);
  const flag = await p.$eval('[data-atlas]', (n) => n.dataset.ciclo);
  const txt = await p.evaluate(() => document.querySelector('[data-atlas]').innerText.toLowerCase());
  const hallados = ['piloto', '1 organización (texto provisional', 'primera organización registrada', 'ciclo completo', 'fecha de registro', 'fecha de cierre', 'nombre ens', 'ver el cierre', 'xolotlcalli.axolodao.eth'].filter((t) => txt.includes(t));
  ok(flag === '0' && await p.$('[data-ciclo-card]') === null && hallados.length === 0, 'the full-cycle card flag is OFF and none of its wording renders (no «Piloto», «primera organización registrada», «ciclo completo», dates, ENS name or closure link)' + (hallados.length ? ` — found: ${hallados.join(', ')}` : ''));
  await ctx.close();
}
// the header: Xovi's floating island. Home and the scrolling pages: fully transparent at the top in both themes (navy content on the cream page, light on the dark one), glass once scrolled.
// The atlas views: the map runs under the header (stage from y=0), so the island is dark glass from the first pixel in both themes. Language order ES · EN · PT.
for (const esq of ['dark', 'light']) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 700 }, colorScheme: esq }); const p = await ctx.newPage();
  await p.goto(`${base}/`); await p.waitForTimeout(1200);
  await p.evaluate((e) => { document.documentElement.setAttribute('data-theme', e); window.scrollTo(0, 0); }, esq); await p.waitForTimeout(500);
  const top = await p.$eval('.site-island', (n) => { const c = getComputedStyle(n); return { fondo: c.backgroundColor, filtro: c.backdropFilter, scrolled: n.dataset.scrolled, glass: n.dataset.glass ?? '', link: getComputedStyle(n.querySelector('nav a')).color }; });
  const oscuro = /rgb\(7, 31, 41|rgba\(7, 31, 41/.test(top.link);
  ok(top.scrolled === 'false' && top.glass === '' && /rgba\(0, 0, 0, 0\)/.test(top.fondo) && !/blur/.test(top.filtro) && (esq === 'light' ? oscuro : !oscuro), `home, ${esq} theme: the header is fully transparent at the top (no fill, no blur), ${esq === 'light' ? 'navy' : 'light'} links (${top.link})`);
  await p.evaluate(() => window.scrollTo(0, 500)); await p.waitForTimeout(700);
  ok(await p.$eval('.site-island', (n) => n.dataset.scrolled === 'true' && /blur\(16px\)/.test(getComputedStyle(n).backdropFilter) && !/rgba\(0, 0, 0, 0\)/.test(getComputedStyle(n).backgroundColor)), `home, ${esq} theme: liquid glass (blur 16px) once the page is scrolled`);
  await ctx.close();
}
for (const esq of ['dark', 'light']) {
  const { ctx, p } = await abrir('/atlas/', { viewport: { width: 1400, height: 700 }, colorScheme: esq });
  await p.evaluate((e) => { document.documentElement.setAttribute('data-theme', e); window.scrollTo(0, 0); }, esq); await p.waitForTimeout(500);
  const g = await p.evaluate(() => { const i = document.querySelector('.site-island'); const c = getComputedStyle(i); const st = document.querySelector('.at-stage').getBoundingClientRect(); const ctl = document.querySelector('.maplibregl-ctrl-top-right').getBoundingClientRect(); const lg = document.querySelector('.at-legend-wrap').getBoundingClientRect(); return { glass: i.dataset.glass, tone: i.dataset.tone, filtro: c.backdropFilter, fondo: c.backgroundColor, radio: parseFloat(c.borderTopLeftRadius), link: getComputedStyle(i.querySelector('nav a')).color, stageTop: Math.round(st.top), islaBottom: Math.round(i.getBoundingClientRect().bottom), ctlTop: Math.round(ctl.top), legTop: Math.round(lg.top) }; });
  ok(g.glass === '1' && /blur\(16px\)/.test(g.filtro) && !/rgba\(0, 0, 0, 0\)/.test(g.fondo) && !/rgb\(7, 31, 41/.test(g.link), `atlas, ${esq} theme: dark glass island from the first pixel (${g.fondo}), light links (${g.link})`);
  ok(g.stageTop === 0 && g.ctlTop >= g.islaBottom && g.legTop >= g.islaBottom, `atlas, ${esq} theme: the map starts at y=${g.stageTop} under the header; the zoom control (y=${g.ctlTop}) and the legend (y=${g.legTop}) sit below the header (bottom y=${g.islaBottom})`);
  if (esq === 'dark') {
    ok(g.radio >= 28, 'the header is a rounded island, not a bar');
    ok((await p.$$eval('.site-island .rounded-full a', (n) => n.map((x) => x.textContent.trim()).filter((t) => /^(ES|EN|PT)$/.test(t)).join(' '))) === 'ES EN PT', 'language order is ES · EN · PT');
    await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice');
    const d = await p.evaluate(() => { const i = document.querySelector('.site-island').getBoundingClientRect().bottom; return { drawer: document.querySelector('#at-indice').getBoundingClientRect().top >= i, open: true }; });
    ok(d.drawer, 'the species panel opens below the header');
  }
  await ctx.close();
}
// ROUND 4. The legend swatches wear the species' texture; the state outline line is renamed; markers keep one screen size until their real extent passes it (tested through the style spec at zoom 3, 5 and 7)
{
  const { expression, latest } = await import('@maplibre/maplibre-gl-style-spec');
  const { ctx, p } = await abrir('/atlas/');
  const expr = await p.evaluate(() => { const m = document.querySelector('[data-map]').__map; return { r: m.getPaintProperty('localidades-punto', 'circle-radius'), i: m.getLayoutProperty('localidades-punto-trama', 'icon-size') }; });
  const ev = (e, spec, z, zona) => expression.createPropertyExpression(e, spec).value.evaluate({ zoom: z }, { type: 'Point', properties: { zona } });
  const rad = (z, zona) => ev(expr.r, latest.paint_circle['circle-radius'], z, zona);
  const ico = (z, zona) => ev(expr.i, latest.layout_symbol['icon-size'], z, zona);
  const tam = [3, 5, 7].map((z) => ({ z, pt: rad(z, false), zn: rad(z, true), ipt: ico(z, false), izn: ico(z, true) }));
  ok(tam.every((t) => t.pt === 7) && tam.every((t) => Math.abs(t.ipt - 7 / 6) < 1e-6), `point markers keep one size at zoom 3, 5 and 7 (${tam.map((t) => `z${t.z}: ${t.pt} px`).join(', ')})`);
  ok(Math.abs(tam[0].zn - 9) < 0.1 && tam[1].zn > 9 && tam[1].zn < 14 && Math.abs(tam[2].zn - 46.8) < 1.5 && tam.every((t) => t.zn >= t.pt), `zone markers are 9 px (a little larger than a point) at continental zoom and grow to their real ~50 km only above it (${tam.map((t) => `z${t.z}: ${t.zn.toFixed(1)} px`).join(', ')})`);
  ok(tam.every((t) => Math.abs(t.izn - t.zn / 6) < 0.01), 'the textured discs follow the same sizes');
  await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice');
  for (const [slug, texturada] of [['opacum', true], ['annulatum', false]]) {
    await p.click(`[data-species-row="${slug}"]`); await p.waitForSelector(`[data-legend][data-legend-for="${slug}"][data-legend-ready="1"]`, { state: 'attached' });
    const l = await p.$$eval('[data-legend] .at-row', (n) => n.filter((r) => r.querySelector('.at-sw')).map((r) => ({ bg: r.querySelector('.at-sw').style.background, t: r.textContent.trim() })));
    const area = l[0];
    ok(texturada ? /repeating-linear-gradient/.test(area.bg) : !/gradient/.test(area.bg), `${slug}: the area swatch ${texturada ? 'wears its hatching' : 'is plain'} in the legend`);
    ok(l.some((x) => x.t === 'Límite de estado con presencia') && !l.some((x) => x.t === 'Presente'), `${slug}: the state outline line reads «Límite de estado con presencia», no «Presente»`);
    await p.click('[data-close="detalle"]'); await p.waitForTimeout(300);
  }
  await ctx.close();
}
// the sheet: the tab strip and the close button are one line with room after «Fuentes»; the expanded view is a band (image rounded at its bottom-right corner, name) over a full-width panel and nothing scrolls
{
  const { ctx, p } = await abrir('/atlas/', { viewport: { width: 1400, height: 900 } });
  await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice'); await p.click('[data-species-row="mexicanum"]'); await p.waitForSelector('#at-detalle'); await p.waitForTimeout(500);
  const fila = async () => p.evaluate(() => { const f = document.querySelector('#tab-fuentes').getBoundingClientRect(), c = document.querySelector('.at-tabclose').getBoundingClientRect(), t = document.querySelector('#tab-resumen').getBoundingClientRect(); return { mismaLinea: Math.abs((f.top + f.height / 2) - (c.top + c.height / 2)) < 10 && Math.abs(t.top - f.top) < 3, hueco: c.left - f.right }; });
  const a = await fila(); ok(a.mismaLinea && a.hueco >= 12, `the tabs and the close button share one line, ${Math.round(a.hueco)} px between «Fuentes» and the close`);
  await p.click('[data-expand]'); await p.waitForTimeout(600);
  const b = await fila(); ok(b.mismaLinea && b.hueco >= 16, `expanded: tabs and close on one line, ${Math.round(b.hueco)} px after «Fuentes»`);
  const h = await p.evaluate(() => { const hero = document.querySelector('.at-hero'); const cs = getComputedStyle(hero); const d = document.querySelector('.at-desc')?.getBoundingClientRect(); const pn = document.querySelector('.at-panel').getBoundingClientRect(); return { r: parseFloat(cs.borderBottomRightRadius), descAncho: d ? d.width / pn.width : 0, cv: parseFloat(getComputedStyle(document.querySelector('.at-cv')).fontSize) }; });
  ok(h.r >= 20, `the image has a rounded bottom-right corner (${h.r} px)`);
  ok(h.descAncho > 0.85, `the description runs the full width of the panel (${Math.round(h.descAncho * 100)}%)`);
  ok(h.cv >= 15, `the grid-cell text is bigger in the expanded view (${h.cv} px)`);
  const malos = [], desplazan = [];
  for (const slug of ['mexicanum', 'andersoni', 'mavortium', 'leorae', 'dumerilii', 'tigrinum', 'lermaense', 'rivulare', 'barbouri', 'mabeei']) {
    await p.click('[data-close="detalle"]'); await p.click(`[data-species-row="${slug}"]`); await p.waitForSelector('#at-detalle'); await p.waitForTimeout(350);
    if (!(await p.$('#at-detalle[data-expanded="1"]'))) { await p.click('[data-expand]'); await p.waitForTimeout(450); }
    for (const tab of await p.$$eval('#at-detalle [role="tab"]', (n) => n.map((x) => x.id.replace('tab-', '')))) {
      await p.click(`#tab-${tab}`); await p.waitForTimeout(220);
      // the check is about the sheet at rest: a click can scroll the PAGE (a row below the fold, a busy machine), and the sheet keeps its top under the header and loses the height the stage lost
      // (page scrolled 273 px → panel 275 px, the failure seen on a slower machine): measure at the top of the page, and say the scroll if it was not there
      const desplazada = await p.evaluate(() => { const y = scrollY; scrollTo(0, 0); return Math.round(y); });
      await p.waitForTimeout(150);
      // the sheet grows to its expanded size in a transition: measure once the panel has stopped changing (two equal readings 150 ms apart), never in the middle of it
      let r = await p.$eval('.at-panel', (n) => ({ sh: n.scrollHeight, ch: n.clientHeight }));
      for (let i = 0; i < 20; i++) { await p.waitForTimeout(150); const q = await p.$eval('.at-panel', (n) => ({ sh: n.scrollHeight, ch: n.clientHeight })); const quieto = q.sh === r.sh && q.ch === r.ch; r = q; if (quieto) break; }
      // a species with a national-status row (ESA, SARA, COSEWIC) has one more row in the status block: its panel may scroll (the founder wants the strips spaced, not squeezed), and says so
      const conNacional = tab === 'resumen' && await p.$('#at-detalle [data-escala="nacional"]') !== null;
      const deslizable = await p.$eval('.at-panel', (n) => ['auto', 'scroll'].includes(getComputedStyle(n).overflowY));
      if (r.sh > r.ch + 1 && conNacional && deslizable) desplazan.push(`${slug}/${tab} ${r.sh}>${r.ch}`);
      else if (r.sh > r.ch + 1) malos.push(`${slug}/${tab} ${r.sh}>${r.ch}${desplazada ? ` (page was scrolled ${desplazada} px)` : ''}`);
    }
  }
  ok(malos.length === 0, `every tab of ten species fits the expanded view without scrolling at 1400×900, except the Resumen of a species with a national-status row, whose panel scrolls (${desplazan.join(', ') || 'none'})${malos.length ? ': ' + malos.join(', ') : ''}`);
  await ctx.close();
}
// Medidas: the species on screen sits between the smallest (mabeei) and the largest (mavortium), at one scale, in its own colour; the outline is ours and says so
{
  const { ctx, p } = await abrir('/atlas/');
  await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice'); await p.click('[data-species-row="lermaense"]'); await p.waitForSelector('#at-detalle'); await p.click('#tab-medidas'); await p.waitForTimeout(500);
  const c = await p.$$eval('[data-cmp]', (n) => n.map((x) => ({ s: x.dataset.cmp, own: x.dataset.own === '1', ancho: Math.round(x.querySelector('svg')?.getBoundingClientRect().width ?? 0), trazo: x.querySelector('svg g')?.getAttribute('stroke'), acento: getComputedStyle(x).getPropertyValue('--own').trim() })));
  ok(c.map((x) => x.s).join() === 'mabeei,lermaense,mavortium' && c[1].own && c[1].trazo === c[1].acento && c[0].trazo !== c[1].trazo, `the comparison runs mabeei · lermaense (highlighted in its colour ${c[1].trazo}) · mavortium`);
  const L = await p.$$eval('[data-cmp] svg > g', (n) => n.map((g) => Math.round(g.getBoundingClientRect().width)));
  ok(L[0] < L[1] && L[1] < L[2] && Math.abs(L[0] / L[2] - 100 / 385) < 0.05 && Math.abs(L[1] / L[2] - 223 / 385) < 0.05, `the three outlines are at one scale (${L.join(' : ')} for 100 : 223 : 385 mm)`);
  await p.click('[data-close="detalle"]'); await p.click('[data-species-row="mexicanum"]'); await p.waitForSelector('#at-detalle'); await p.click('#tab-medidas'); await p.waitForTimeout(400);
  ok(await p.$eval('[data-cmp="mexicanum"]', (n) => n.dataset.own === '1' && /sin dato/.test(n.textContent)), 'a species with no total length is still in the comparison, highlighted, saying «sin dato»');
  await p.click('#tab-fuentes'); await p.waitForTimeout(300);
  const f = await p.$eval('[data-sil-source]', (n) => n.textContent); const txt = await p.$eval('#at-detalle', (n) => n.textContent);
  ok(f.includes('Contorno propio de Zenbit') && !/médic|medical|veterin/i.test(txt), 'Fuentes says «Contorno propio de Zenbit» and nothing about where the outline came from');
  await ctx.close();
}
// Alimentación: «En cautiverio» wherever the bundle has diet_captive; the prey-names slot lists names under a group (wild and captive) when the bundle carries them
{
  const { ctx, p } = await abrir('/atlas/');
  const conCautiverio = await p.evaluate(async () => { const f = await (await fetch('/atlas/real/fichas.json')).json(); return Object.keys(f).filter((k) => f[k].dietCaptive).sort(); });
  await p.route('**/atlas/real/fichas.json', async (r) => { const j = await (await r.fetch()).json(); const g = j.mexicanum.prey[0]; const nm = (x) => ({ es: x, en: x + ' (en)', pt: x + ' (pt)' }); g.nombres = { wild: [nm('nombre de prueba A'), nm('nombre de prueba B')], captive: [nm('nombre de prueba C')] }; await r.fulfill({ json: j }); });
  await p.reload(); await p.waitForSelector('[data-atlas][data-ready="1"]');
  await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice');
  const faltan = [];
  for (const slug of conCautiverio) {
    await p.click(`[data-species-row="${slug}"]`); await p.waitForSelector('#at-detalle'); await p.click('#tab-alimentacion'); await p.waitForTimeout(300);
    const hs = await p.$$eval('#at-det-panel h4', (n) => n.map((x) => x.textContent.trim()));
    if (!hs.includes('En cautiverio')) faltan.push(slug);
    await p.click('[data-close="detalle"]');
  }
  ok(conCautiverio.length >= 4 && faltan.length === 0, `«En cautiverio» shows for every species whose bundle has diet_captive (${conCautiverio.join(', ')})${faltan.length ? '; missing: ' + faltan.join(', ') : ''}`);
  await p.click('[data-species-row="mexicanum"]'); await p.waitForSelector('#at-detalle'); await p.click('#tab-alimentacion'); await p.waitForTimeout(400);
  const n = await p.$$eval('[data-prey-group="216"] [data-prey-names] p', (x) => x.map((e) => e.dataset.preyCtx + ':' + e.textContent.replace(/\s+/g, ' ').trim()));
  ok(n.length === 2 && n[0].startsWith('wild:') && n[0].includes('nombre de prueba A, nombre de prueba B') && n[1].startsWith('captive:') && n[1].includes('nombre de prueba C'), `the prey-names slot lists the names under their group, wild and captive (${n.join(' | ')})`);
  // the real names (draft/presas-nombradas.json) show under their group for any species, wild and captive, with nothing about frequency or amount
  { await p.unroute('**/atlas/real/fichas.json'); await p.reload(); await p.waitForSelector('[data-atlas][data-ready="1"]');
    await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice');
    const real = await p.evaluate(async () => { const f = await (await fetch('/atlas/real/fichas.json')).json(); return f.tigrinum.prey.filter((g) => g.nombres).map((g) => ({ key: g.key, wild: g.nombres.wild ?? [], captive: g.nombres.captive ?? [] })); });
    await p.click('[data-species-row="tigrinum"]'); await p.waitForSelector('#at-detalle'); await p.click('#tab-alimentacion'); await p.waitForTimeout(400);
    let coincide = real.length > 0;
    for (const g of real) for (const c of ['wild', 'captive']) { const t = await p.$eval(`[data-prey-group="${g.key}"]`, (n, c) => n.querySelector(`[data-prey-ctx="${c}"]`)?.textContent ?? '', c); if (g[c].length ? !g[c].every((x) => t.includes(x.es)) : t !== '') coincide = false; }
    const todo = await p.$eval('#at-det-panel', (n) => n.textContent);
    ok(coincide && !/\d+\s*(veces|g\b|gramos|ml|por semana|diari)/i.test(todo), `tigrinum: the ${real.length} prey groups with names list them as the sources do, wild and captive, with no frequency or amount`); }
  ok(await p.$('#tab-clips') === null, 'the public build has no Clips tab');
  await ctx.close();
}
// the measurement table names a stage by its label (neoténico, metamórfico, …), never by its raw key
{
  const crudo = /\b(paedomorph|metamorph)\b|larva_|adult_/i;
  const { ctx, p } = await abrir('/atlas/');
  await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice'); await p.waitForTimeout(700);
  const slugs = await p.$$eval('[data-species-row]', (n) => n.map((x) => x.dataset.speciesRow));
  const malos = []; let filas = 0;
  for (const slug of slugs) {
    const c = await p.$('[data-close="detalle"]'); if (c) await c.click();
    await p.click(`[data-species-row="${slug}"]`); await p.waitForSelector('#at-detalle'); await p.click('#tab-medidas'); await p.waitForTimeout(150);
    const rot = await p.$$eval('.at-tbl td:first-child', (n) => n.map((x) => x.textContent.trim()));
    filas += rot.length; for (const r of rot) if (crudo.test(r)) malos.push(`${slug}: ${r}`);
  }
  ok(filas > 40 && malos.length === 0, `no measurement row of the ${slugs.length} species carries a raw stage key (${filas} rows)${malos.length ? ': ' + malos.slice(0, 3).join('; ') : ''}`);
  await p.click('[data-close="detalle"]'); await p.click('[data-species-row="lermaense"]'); await p.waitForSelector('#at-detalle'); await p.click('#tab-medidas'); await p.waitForTimeout(250);
  const l = await p.$$eval('.at-tbl td:first-child', (n) => n.map((x) => x.textContent.trim()));
  ok(l.some((x) => x.includes('Longitud hocico-cloaca · neoténico')) && l.some((x) => x.includes('· metamórfico')), `lermaense's rows say «neoténico» and «metamórfico» (${l.slice(0, 2).join(' / ')})`);
  await ctx.close();
  for (const [loc, a, b] of [['/en', 'neotenic', 'metamorphic'], ['/pt', 'neotênico', 'metamórfico']]) {
    const x = await abrir(`${loc}/atlas/`);
    await x.p.click('[data-group-btn="especies"]'); await x.p.waitForSelector('#at-indice'); await x.p.waitForTimeout(700); await x.p.click('[data-species-row="lermaense"]'); await x.p.waitForSelector('#at-detalle'); await x.p.click('#tab-medidas'); await x.p.waitForTimeout(250);
    const r = await x.p.$$eval('.at-tbl td:first-child', (n) => n.map((e) => e.textContent.trim()));
    ok(r.some((e) => e.includes(`· ${a}`)) && r.some((e) => e.includes(`· ${b}`)) && !r.some((e) => crudo.test(e)), `${loc}: the stages read «${a}» and «${b}» (${r.slice(0, 2).join(' / ')})`);
    await x.ctx.close();
  }
}
// the prey-group, habitat and threat labels in en and pt (Coms): the sheet never shows the Spanish label in another language
for (const [loc, grupo, hab, amen] of [['/en', 'Water fleas and brine shrimp', '15.9 canals and ditches', 'dams, water intakes'], ['/pt', "Pulgas-d'água e artêmias", '15.9 canais e valas', 'barragens, captações'], ['', 'Pulgas de agua y artemia', '15.9 canales y zanjas', null]]) {
  const x = await abrir(`${loc}/atlas/`);
  await x.p.click('[data-group-btn="especies"]'); await x.p.waitForSelector('#at-indice'); await x.p.waitForTimeout(700);
  await x.p.click('[data-species-row="tigrinum"]'); await x.p.waitForSelector('#at-detalle'); await x.p.click('#tab-alimentacion'); await x.p.waitForTimeout(350);
  const cap = await x.p.$$eval('[data-prey-group] figcaption', (n) => n.map((e) => e.textContent));
  await x.p.click('[data-close="detalle"]'); await x.p.click('[data-species-row="lermaense"]'); await x.p.waitForSelector('#at-detalle'); await x.p.waitForTimeout(350);
  await x.p.hover('[data-cell="habitat"]'); await x.p.waitForSelector('[data-cell-detail="habitat"]'); const dh = await x.p.$eval('[data-cell-detail="habitat"]', (n) => n.textContent);
  await x.p.hover('[data-cell="threat"]'); await x.p.waitForSelector('[data-cell-detail="threat"]'); const da = await x.p.$eval('[data-cell-detail="threat"]', (n) => n.textContent);
  const conGrupo = cap.some((c) => c.includes(grupo)) || (await x.p.$$eval('[data-prey-group]', (n) => n.map((e) => e.textContent))).some((c) => c.includes(grupo));
  ok(conGrupo && dh.includes(hab) && (amen === null || da.toLowerCase().includes(amen)), `${loc || '/es'}: the prey group «${grupo}», the habitat «${hab}»${amen ? ` and the threat («${amen}…»)` : ''} read in the page's language`);
  await x.ctx.close();
}
// ONE source for the labels: habitat, threat, prey-group and stage labels come with the bundle in es, en and pt (nothing is kept in the UI's own vocabulary), and every code in use has all three
{
  const { readFileSync } = await import('node:fs');
  const txt = readFileSync(new URL('../../src/components/atlas/uiText.ts', import.meta.url), 'utf8');
  const { ctx, p } = await abrir('/atlas/');
  const r = await p.evaluate(async () => {
    const f = await (await fetch('/atlas/real/fichas.json')).json(); const et = await (await fetch('/atlas/real/etapas.json')).json();
    const L = ['es', 'en', 'pt']; const falta = []; let h = 0, a = 0, g = 0;
    for (const v of Object.values(f)) {
      for (const x of v.habitat ?? []) { h++; for (const l of L) if (!x.label?.[l]) falta.push(`habitat ${x.code} ${l}`); }
      for (const x of v.threat ?? []) { a++; for (const l of L) if (!x.label?.[l]) falta.push(`threat ${x.code} ${l}`); }
      for (const x of v.prey ?? []) { g++; for (const l of L) if (!x.name?.[l]) falta.push(`prey ${x.key} ${l}`); }
      for (const m of v.medidas ?? []) if (m.stage && !et[m.stage]) falta.push(`stage ${m.stage}`);
    }
    for (const k of ['larva', 'paedomorph', 'metamorph', 'adult']) for (const l of L) if (!et[k]?.[l]) falta.push(`etapa ${k} ${l}`);
    return { falta, h, a, g, claves: Object.keys(et) };
  });
  ok(r.h > 20 && r.a > 20 && r.g > 30 && r.falta.length === 0, `every habitat (${r.h}), threat (${r.a}), prey-group (${r.g}) and stage label in use has es, en and pt from the bundle${r.falta.length ? '; missing: ' + r.falta.slice(0, 5).join(', ') : ''}`);
  ok(!/habitatLabels|threatLabels|preyGroupNames|\n  stages:/.test(txt) && !r.claves.includes('juvenile'), 'the UI keeps no copy of those vocabularies (one source: the bundle), and no stage «juvenile» that no row uses');
  await ctx.close();
}
// UICN in es and pt, IUCN in en
for (const [loc, esperado] of [['', 'UICN'], ['/pt', 'UICN'], ['/en', 'IUCN']]) {
  const { ctx, p } = await abrir(`${loc}/atlas/`);
  await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice');
  await p.click('[data-species-row="andersoni"]'); await p.waitForSelector('#at-detalle');
  ok(await p.$eval('[data-escala="uicn"] .at-elab', (n) => n.textContent.trim()) === esperado, `${loc || '/es'}: the sheet's status row reads ${esperado}`);
  await p.click('.at-filtros-btn').catch(() => {}); await p.click('[data-g="iucn"]'); await p.waitForSelector('[data-pills]');
  ok(await p.$eval('[data-pills]', (n) => n.getAttribute('aria-label')).then((t) => t.includes(esperado)), `${loc || '/es'}: the index's status group reads ${esperado}`);
  await ctx.close();
}
// phone: three columns
{
  const { ctx, p } = await abrir('/atlas/', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await p.tap('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice');
  await p.tap('[data-species-row="andersoni"]'); await p.waitForTimeout(400);
  ok(await p.$eval('[data-species-row="andersoni"]', (n) => n.dataset.preview) === '1', 'B3 on a phone the first tap shows the species on the map');
  await p.tap('[data-species-row="andersoni"]'); await p.waitForSelector('#at-detalle'); await p.tap('.at-grip'); await p.waitForTimeout(500);
  const ys = await p.$$eval('.at-cell', (n) => n.slice(0, 3).map((x) => Math.round(x.getBoundingClientRect().top)));
  ok(ys.length === 3 && new Set(ys).size === 1, 'E4 on a phone the first row of the grid has 3 columns');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal scroll on a phone');
  await ctx.close();
}
{
  // the instrument seen red: a page that calls out to another host is recorded in `fuera`, and the check below would fail on it (the entry is removed again so the real check judges the real pages)
  const { ctx, p } = await abrir('/atlas/');
  await p.evaluate(() => fetch('https://planted-host.example/ping', { mode: 'no-cors' }).catch(() => {})); await p.waitForTimeout(500);
  ok('planted-host.example' in fuera && !Object.keys(fuera).every((h) => ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(h)), 'planted: a request to another host is recorded and the host check would fail on it');
  delete fuera['planted-host.example'];
  await ctx.close();
}
ok(Object.keys(fuera).every((h) => ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(h)), `requests that leave this machine: ${JSON.stringify(fuera)}; only the site-wide Google Fonts calls, older than this work; any other host fails`);
ok(Object.keys(malas).every((m) => m === '404 /_vercel/insights/script.js'), `responses of 400 or more: ${JSON.stringify(malas)}; only the site-wide /_vercel/insights 404 of a local server, older than this work; any other fails`);
ok(errs.length === 0, `no console errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
await nav.close();
console.log(fallos ? `${fallos} FAILED` : 'all passed');
process.exit(fallos ? 1 : 0);
