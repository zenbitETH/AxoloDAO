// Repeats the rivulare legend-provenance check N times in fresh pages (default 20), waiting only on the legend's own ready signal. Usage: node scripts/proto/test-legend-provenance.mjs http://127.0.0.1:4456 [N]
const { chromium } = await import('playwright-core');
const base = process.argv[2], N = +(process.argv[3] ?? 20);
const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let bien = 0; const fallos = [];
for (let i = 1; i <= N; i++) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 1000 } }); const p = await ctx.newPage();
  try {
    await p.goto(`${base}/atlas/`); await p.waitForSelector('[data-atlas][data-ready="1"]');
    await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice'); await p.click('[data-species-row="rivulare"]'); await p.waitForSelector('#at-detalle');
    await p.waitForSelector('[data-legend][data-legend-for="rivulare"][data-legend-ready="1"]', { state: 'attached', timeout: 15000 });
    const l = await p.$eval('[data-legend]', (n) => n.textContent);
    const ok = l.includes('PACE Ambystoma 2018, p. 43') && l.split('p. 43').length === 2 && !l.includes('leído del mapa impreso') && l.includes('Legorreta-Balbuena') && !l.includes('corroborado') && !l.includes('celdas de 0.5° de');   // the sources are the ones the attested file names for rivulare's cells
    if (ok) bien++; else fallos.push(`run ${i}: ${l.slice(0, 300)}`);
  } catch (e) { fallos.push(`run ${i}: ${e.message.split('\n')[0]}`); }
  await ctx.close();
}
console.log(`${bien}/${N}`); fallos.forEach((f) => console.log('FAIL', f));
await nav.close(); process.exit(bien === N ? 0 : 1);
