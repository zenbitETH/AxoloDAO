// Repeats the first point-tooltip check (leorae, a textured point) N times in fresh pages and prints what it saw when it fails. Usage: node scripts/proto/test-tooltip-loop.mjs http://127.0.0.1:4456 [N]
const { chromium } = await import('playwright-core');
const base = process.argv[2], N = +(process.argv[3] ?? 20);
const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let bien = 0; const fallos = [];
for (let i = 1; i <= N; i++) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 1000 } }); const p = await ctx.newPage();
  try {
    await p.goto(`${base}/atlas/`); await p.waitForSelector('[data-atlas][data-ready="1"]');
    await p.evaluate(() => { window.__log = []; addEventListener('scroll', () => window.__log.push([Math.round(performance.now()), Math.round(scrollY), (document.activeElement?.className?.toString() ?? '').slice(0, 24), document.activeElement?.id ?? ''])); });
    await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice'); await p.waitForTimeout(700); await p.click('[data-species-row="leorae"]'); await p.waitForSelector('#at-detalle');
    await p.waitForFunction(() => new Promise((r) => { const m = document.querySelector('[data-map]').__map; if (!m.isMoving()) setTimeout(() => r(!m.isMoving()), 700); else r(false); }), null, { timeout: 15000 });
    const d = await p.evaluate(async () => { const m = document.querySelector('[data-map]').__map; const fc = await (await fetch('/atlas/datos/especies-localidades.geojson')).json(); const f = fc.features.find((x) => x.properties.slug === 'leorae'); const r = f.geometry.coordinates[0], xs = r.map((q) => q[0]), ys = r.map((q) => q[1]); const c = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; m.jumpTo({ center: c, zoom: 9 }); window.scrollTo(0, 0); window.__c = c; return c; });
    for (let k = 0; k < 6; k++) { await p.waitForTimeout(900); const quieto = await p.evaluate(() => { const m = document.querySelector('[data-map]').__map; return !m.isMoving() && m.loaded() && Math.abs(m.getZoom() - 9) < 0.01; }); if (quieto) break; await p.evaluate(() => document.querySelector('[data-map]').__map.jumpTo({ center: window.__c, zoom: 9 })); }
    const [x, y] = await p.evaluate((c) => { const m = document.querySelector('[data-map]').__map; const r = document.querySelector('[data-map]').getBoundingClientRect(); const q = m.project(c); return [r.left + q.x, r.top + q.y]; }, d);
    await p.evaluate((xy) => { window.__xy = xy; }, [x, y]);
    let visto = null;
    for (let intento = 0; intento < 8; intento++) { await p.mouse.move(x - 60, y + 80); await p.mouse.move(x, y, { steps: 4 }); try { await p.waitForSelector('.at-ptip', { timeout: 1500 }); break; } catch { /* again */ } }
    visto = await p.evaluate(() => ({ tip: document.querySelector('.at-ptip')?.textContent ?? null, ring: !!document.querySelector('.at-ping .at-ring'), img: document.querySelector('[data-map]').__map.hasImage('pt-leorae'), rendered: document.querySelector('[data-map]').__map.queryRenderedFeatures({ layers: ['localidades-punto-trama'] }).length, log: window.__log.slice(0, 4), moving: document.querySelector('[data-map]').__map.isMoving(), sy: Math.round(scrollY), enPunto: (() => { const e = document.elementFromPoint(window.__xy[0], window.__xy[1]); return e ? (e.className?.toString?.() ?? e.tagName).slice(0, 40) : null; })(), pos: (() => { const m = document.querySelector('[data-map]').__map; const q = m.project(window.__c); const f = m.queryRenderedFeatures([[q.x - 12, q.y - 12], [q.x + 12, q.y + 12]], { layers: ['localidades-punto-trama'] }).length; return { x: Math.round(q.x), y: Math.round(q.y), f, zoom: m.getZoom().toFixed(2) }; })() }));
    if (visto.ring && visto.tip?.includes('ubicación generalizada (~50 km)')) bien++; else fallos.push(`run ${i}: ${JSON.stringify(visto)}`);
  } catch (e) { fallos.push(`run ${i}: ${e.message.split('\n')[0]}`); }
  await ctx.close();
}
console.log(`${bien}/${N}`); fallos.forEach((f) => console.log('FAIL', f));
await nav.close(); process.exit(bien === N ? 0 : 1);
