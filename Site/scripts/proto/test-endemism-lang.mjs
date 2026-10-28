// The endemism line, the presence-group labels and the division word in es, en and pt, for species of Mexico, the US and Canada.
// Expected strings are written out here, in the words the communications team gave (the communications repository fe84e42) with the preposition built in; the countries a species
// has are read from the presence groups the sheet itself draws, so the expectation does not come from the code under test.
//   node scripts/proto/test-endemism-lang.mjs http://127.0.0.1:4456
const { chromium } = await import('playwright-core');
const base = process.argv[2];
let fallos = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fallos++; };
const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });

const L = {
  es: { path: '/atlas/', only: { MX: 'Endémica de México', US: 'Endémica de los Estados Unidos', CA: 'Endémica de Canadá' }, onlyDet: { MX: 'Sólo se registra en México', US: 'Sólo se registra en los Estados Unidos', CA: 'Sólo se registra en Canadá' },
    multi: (n) => `En ${n} países`, multiDet: { 'MX,US': 'Se registra en México y en los Estados Unidos', 'MX,US,CA': 'Se registra en México, en los Estados Unidos y en Canadá', 'US,CA': 'Se registra en los Estados Unidos y en Canadá' }, groups: { MX: 'Estados de México', US: 'Estados de los Estados Unidos', CA: 'Provincias de Canadá' }, chipRemove: { MX: 'Quitar el filtro de estado', CA: 'Quitar el filtro de provincia' } },
  en: { path: '/en/atlas/', only: { MX: 'Endemic to Mexico', US: 'Endemic to the United States', CA: 'Endemic to Canada' }, onlyDet: { MX: 'Recorded only in Mexico', US: 'Recorded only in the United States', CA: 'Recorded only in Canada' },
    multi: (n) => `In ${n} countries`, multiDet: { 'MX,US': 'Recorded in Mexico and in the United States', 'MX,US,CA': 'Recorded in Mexico, in the United States, and in Canada', 'US,CA': 'Recorded in the United States and in Canada' }, groups: { MX: 'States in Mexico', US: 'States in the United States', CA: 'Provinces in Canada' }, chipRemove: { MX: 'Remove the state filter', CA: 'Remove the province filter' } },
  pt: { path: '/pt/atlas/', only: { MX: 'Endêmica do México', US: 'Endêmica dos Estados Unidos', CA: 'Endêmica do Canadá' }, onlyDet: { MX: 'Registrada só no México', US: 'Registrada só nos Estados Unidos', CA: 'Registrada só no Canadá' },
    multi: (n) => `Em ${n} países`, multiDet: { 'MX,US': 'Registrada no México e nos Estados Unidos', 'MX,US,CA': 'Registrada no México, nos Estados Unidos e no Canadá', 'US,CA': 'Registrada nos Estados Unidos e no Canadá' }, groups: { MX: 'Estados do México', US: 'Estados dos Estados Unidos', CA: 'Províncias do Canadá' }, chipRemove: { MX: 'Remover o filtro de estado', CA: 'Remover o filtro de província' } },
};

const vistos = { MX: 0, US: 0, CA: 0, multi: 0, conCA: 0 };
for (const [loc, T] of Object.entries(L)) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${base}${T.path}`); await p.waitForSelector('[data-atlas][data-ready="1"]', { timeout: 60000 }); await p.waitForTimeout(800);
  await p.click('[data-group-btn="especies"]'); await p.waitForSelector('[data-species-row]');
  const slugs = await p.$$eval('[data-species-row]', (n) => n.map((x) => x.dataset.speciesRow));
  const malos = [];
  for (const slug of slugs) {
    await p.click(`[data-species-row="${slug}"]`); await p.waitForSelector('#at-detalle'); await p.waitForTimeout(750);
    await p.evaluate(() => scrollTo(0, 0));
    const paises = await p.$$eval('#at-detalle .at-pgrp[data-country]', (n) => n.map((x) => x.dataset.country));
    const valor = await p.$eval('[data-cell="endemism"] .at-cv', (n) => n.textContent.trim());
    await p.click('[data-cell="endemism"]'); await p.waitForTimeout(150);
    const det = await p.$eval('[data-cell-detail="endemism"] p', (n) => n.textContent.trim());
    if (paises.includes('CA')) vistos.conCA++;
    if (paises.length === 1) {
      const c = paises[0]; vistos[c]++;
      if (valor !== T.only[c] || det !== T.onlyDet[c]) malos.push(`${slug}: «${valor}» / «${det}» (expected «${T.only[c]}» / «${T.onlyDet[c]}»)`);
    } else {
      vistos.multi++;
      const k = paises.join(',');
      if (valor !== T.multi(paises.length) || det !== T.multiDet[k]) malos.push(`${slug} [${k}]: «${valor}» / «${det}» (expected «${T.multi(paises.length)}» / «${T.multiDet[k]}»)`);
    }
    // the group buttons carry the label with the country's preposition and division word (only drawn when the sheet folds the groups)
    for (const b of await p.$$('#at-detalle button.at-pcountry[aria-label]')) {
      const c = await (await b.evaluateHandle((n) => n.closest('.at-pgrp'))).evaluate((n) => n.dataset.country);
      const a = await b.getAttribute('aria-label');
      if (a !== T.groups[c]) malos.push(`${slug}: group label «${a}» (expected «${T.groups[c]}»)`);
    }
    await p.click('[data-close="detalle"]'); await p.waitForTimeout(500);
  }
  ok(slugs.length === 32 && malos.length === 0, `${loc}: the endemism value and line, and the group labels, are right for ${slugs.length} species${malos.length ? '\n  ' + malos.join('\n  ') : ''}`);

  // the measurement label of the dimension line
  if (loc === 'pt') {
    await p.click(`[data-species-row="${slugs[0]}"]`); await p.waitForSelector('#at-detalle'); await p.waitForTimeout(750);
    await p.click('#tab-medidas'); await p.waitForTimeout(300);
    const t = await p.evaluate(() => document.querySelector('#at-detalle').textContent);
    ok(!/\bCRC\b|\bLHC\b|\bCFC\b/.test(t) && t.includes('Comprimento focinho-cloaca'), 'pt: the measurements tab spells «Comprimento focinho-cloaca» in full, with no abbreviation');
    await p.click('[data-close="detalle"]'); await p.waitForTimeout(500);
  }

  // the named prey show in the language of the page
  {
    const real = await p.evaluate(async () => { const f = await (await fetch('/atlas/real/fichas.json')).json(); return f.tigrinum.prey.filter((g) => g.nombres).map((g) => ({ key: g.key, nombres: g.nombres })); });
    await p.click('[data-species-row="tigrinum"]'); await p.waitForSelector('#at-detalle'); await p.click('#tab-alimentacion'); await p.waitForTimeout(500);
    const falta = [];
    for (const g of real) for (const c of ['wild', 'captive']) { const t = await p.$eval(`[data-prey-group="${g.key}"]`, (n, c) => n.querySelector(`[data-prey-ctx="${c}"]`)?.textContent ?? '', c); for (const n of g.nombres[c] ?? []) if (!t.includes(n[loc])) falta.push(`${loc}: «${n[loc]}»`); }
    ok(real.length > 0 && falta.length === 0, `${loc}: tigrinum's named prey show in ${loc}${falta.length ? ' — missing ' + falta.join(', ') : ''}`);
    await p.click('[data-close="detalle"]'); await p.waitForTimeout(500);
  }

  // the state chip of the index: the province in Canada, the state elsewhere
  for (const [iso, pais] of [['MX-MEX', 'MX'], ['CA-ON', 'CA']]) {
    const q = await ctx.newPage(); q.on('pageerror', (e) => errs.push(e.message));
    await q.goto(`${base}${T.path}?estado=${iso}`); await q.waitForSelector('[data-atlas][data-ready="1"]', { timeout: 60000 }); await q.waitForTimeout(900);
    const a = await q.$eval('[data-estado-chip] .at-x', (n) => n.getAttribute('aria-label')).catch(() => null);
    ok(a === T.chipRemove[pais], `${loc}: the chip's remove button for ${iso} reads «${a}»`);
    await q.close();
  }
  ok(errs.length === 0, `${loc}: no page errors${errs.length ? ': ' + errs[0] : ''}`);
  await ctx.close();
}
ok(vistos.MX > 0 && vistos.US > 0 && vistos.conCA > 0 && vistos.multi > 0, `species seen per country: ${JSON.stringify(vistos)}`);
await nav.close();
console.log(fallos ? `${fallos} FAILED` : 'ALL OK');
process.exit(fallos ? 1 : 0);
