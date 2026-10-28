// The text of the «Instalaciones catalogadas» layer behind its info button, in a real browser: in the tooltip and not in the row, a real button with its label and aria-describedby, open on hover and on keyboard focus, toggled by a tap or a click, closed by Escape and by a press outside, and inside the panel at phone width.
//   node scripts/proto/test-info-capa.mjs http://127.0.0.1:4456 [folder for screenshots]
const { chromium } = await import('playwright-core');
const base = process.argv[2], fotos = process.argv[3];
let fallos = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fallos++; };
const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const abrir = async (ruta, opc = {}) => {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 }, ...opc }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(`${base}${ruta}`); await p.waitForSelector('[data-atlas][data-ready="1"]', { timeout: 60000 }); await p.waitForTimeout(800);
  await p.click('[data-group-btn="especies"]'); await p.waitForSelector('#at-indice');
  await p.click('#ptab-instalaciones'); await p.waitForTimeout(400);
  return { ctx, p, errs };
};
const TEXTOS = {
  '/atlas/': { etiqueta: 'Información de la capa', nota: 'Catalogadas desde fuentes públicas; no es un registro ni una verificación. Cada ícono marca el municipio (o el estado), no la dirección.', aviso: /^Directorio compilado de fuentes públicas\..*hola@zenbit\.mx; respondemos en diez días hábiles$/s },
  '/en/atlas/': { etiqueta: 'Layer information', nota: 'Cataloged from public sources; this is not a registry or a verification. Each icon marks the municipality (or the state), not the address.', aviso: /hola@zenbit\.mx/ },
  '/pt/atlas/': { etiqueta: 'Informações da camada', nota: 'Catalogadas a partir de fontes públicas; não é um registro nem uma verificação. Cada ícone marca o município (ou o estado), não o endereço.', aviso: /hola@zenbit\.mx/ },
};
const visible = (p) => p.$eval('[data-info="instalaciones-catalogadas"] [data-info-tip]', (e) => getComputedStyle(e).visibility === 'visible' && getComputedStyle(e).opacity !== '0').catch(() => false);   // a tooltip gone with its panel is not visible
const FILA = '.at-opt[data-layer="instalaciones-catalogadas"]';
/** A transition and a busy machine: wait up to two seconds for the tooltip to be visible (or hidden) instead of a fixed pause. */
const esperar = async (p, queVisible) => { for (let i = 0; i < 40; i++) { if ((await visible(p)) === queVisible) return queVisible; await p.waitForTimeout(50); } return visible(p); };

{
  const { ctx, p, errs } = await abrir('/atlas/');
  const b = await p.$(`${FILA} [data-info] button`);
  ok(b !== null && (await b.evaluate((e) => e.tagName)) === 'BUTTON' && (await b.getAttribute('type')) === 'button', 'the info control is a real <button>');
  ok((await b.getAttribute('aria-label')) === TEXTOS['/atlas/'].etiqueta, 'its aria-label is «Información de la capa»');
  const dby = await b.getAttribute('aria-describedby');
  ok(!!dby && (await p.$eval(`#${dby}`, (e) => e.getAttribute('role'))) === 'tooltip', 'aria-describedby points to the tooltip, which has role tooltip');
  const fila = await p.$eval(FILA, (e) => { const c = e.cloneNode(true); c.querySelectorAll('[data-info-tip]').forEach((n) => n.remove()); return c.innerText.replace(/\s+/g, ' ').trim(); });
  ok(!/Catalogadas desde fuentes|Directorio compilado|hola@zenbit|Cada ícono|diez días/.test(fila) && /Instalaciones catalogadas/.test(fila) && /Datos de la capa/.test(fila), `the row keeps only its name, the switch and «Datos de la capa» (${fila.slice(0, 90)}…)`);
  const [nota, aviso] = await p.$$eval(`${FILA} [data-info-tip] > span`, (n) => n.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  ok(nota === TEXTOS['/atlas/'].nota && TEXTOS['/atlas/'].aviso.test(aviso) && !/círculo/.test(nota), 'the tooltip holds exactly the two paragraphs, with «Cada ícono marca el municipio (o el estado), no la dirección.»');
  ok(await p.$eval(`${FILA} [data-info-tip]`, (e) => getComputedStyle(e).userSelect === 'text' && /hola@zenbit\.mx/.test(e.textContent)), 'the mail address is selectable text inside the tooltip');
  ok(!(await visible(p)), 'closed by default');
  await p.screenshot({ path: fotos ? `${fotos}/info-cerrada.png` : undefined, clip: fotos ? { x: 0, y: 100, width: 520, height: 520 } : undefined }).catch(() => {});
  const caja = await b.boundingBox();
  await p.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2); await p.waitForTimeout(250);
  ok(await visible(p), 'it opens on mouse hover');
  if (fotos) await p.screenshot({ path: `${fotos}/info-abierta.png`, clip: { x: 0, y: 100, width: 520, height: 620 } });
  const tip = await p.$eval(`${FILA} [data-info-tip]`, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.mouse.move(tip.x + tip.w / 2, tip.y + tip.h / 2); await p.waitForTimeout(250);
  ok(await visible(p), 'it stays open while the pointer is on the tooltip, so the mail can be selected');
  await p.mouse.move(900, 500); await p.waitForTimeout(250);
  ok(!(await visible(p)), 'it closes when the pointer leaves');
  const marcada = await p.$eval(`${FILA} input`, (e) => e.checked);
  await b.click(); await p.waitForTimeout(200);
  ok(await visible(p) && (await p.$eval(`${FILA} input`, (e) => e.checked)) === marcada, 'a click opens it and does not switch the layer');
  await b.click(); await p.mouse.move(900, 500); await p.waitForTimeout(200);
  ok(!(await visible(p)), 'a second click closes it');
  await b.click(); await p.mouse.move(900, 500); await p.waitForTimeout(200);
  ok(await visible(p), 'a click keeps it open after the pointer leaves');
  await p.mouse.click(900, 500); await p.waitForTimeout(200);
  ok(!(await visible(p)), 'a press outside closes it');
  await p.focus('body'); await p.keyboard.press('Tab'); await p.evaluate(() => document.querySelector('#ptab-instalaciones')?.focus());
  await p.focus(`${FILA} [data-info] button`); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab'); await p.waitForTimeout(200);
  ok(await visible(p), 'it opens on keyboard focus');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(!(await visible(p)), 'Escape closes it');
  await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(200);
  ok(await visible(p), 'it opens again when focus returns');
  await p.keyboard.press('Tab'); await p.waitForTimeout(200);
  ok(!(await visible(p)), 'it closes when focus leaves');
  await p.click(`${FILA} .at-t`, { position: { x: 4, y: 6 } }); await p.waitForTimeout(150);
  ok((await p.$eval(`${FILA} input`, (e) => e.checked)) !== marcada, 'a click on the layer name still switches the layer');
  ok(errs.length === 0, `no console errors (${errs.join(' | ')})`);
  await ctx.close();
}
// Escape closes the top layer only: with the tooltip open it closes the tooltip and the panel stays; a second Escape closes the panel (a fresh page: no popover is open under them)
{
  const { ctx, p } = await abrir('/atlas/');
  const abierto = () => p.evaluate(() => { const e = document.querySelector('#at-indice'); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; });
  await p.focus(`${FILA} [data-info] button`); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab'); await esperar(p, true);
  ok(await visible(p) && await abierto(), 'the tooltip is open over the open panel');
  await p.keyboard.press('Escape'); await esperar(p, false); await p.waitForTimeout(400);
  ok(!(await visible(p)) && await abierto(), 'Escape closes ONLY the tooltip: the panel stays open under it');
  await p.keyboard.press('Escape'); await p.waitForTimeout(600);
  ok(!(await abierto()), 'a second Escape, with no tooltip open, closes the panel');
  await ctx.close();
}
for (const ruta of ['/en/atlas/', '/pt/atlas/']) {
  const { ctx, p } = await abrir(ruta); const T = TEXTOS[ruta];
  ok((await p.getAttribute(`${FILA} [data-info] button`, 'aria-label')) === T.etiqueta, `${ruta}: the button label is «${T.etiqueta}»`);
  const [nota, aviso] = await p.$$eval(`${FILA} [data-info-tip] > span`, (n) => n.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  ok(nota === T.nota && T.aviso.test(aviso), `${ruta}: the tooltip text is the translation, with the icon wording`);
  await ctx.close();
}
for (const ancho of [1280, 1440]) {
  const { ctx, p } = await abrir('/atlas/', { viewport: { width: ancho, height: 900 } });
  await (await p.$(`${FILA} [data-info] button`)).click(); await esperar(p, true);
  const r = await p.evaluate((f) => { const t = document.querySelector(`${f} [data-info-tip]`).getBoundingClientRect(); const panel = document.querySelector('#at-indice').getBoundingClientRect(); return { l: t.left, r: t.right, t: t.top, b: t.bottom, pl: panel.left, pr: panel.right, pt: panel.top, pb: panel.bottom, vw: innerWidth }; }, FILA);
  ok(await visible(p) && r.l >= r.pl - 0.5 && r.r <= r.pr + 0.5 && r.t >= r.pt - 0.5 && r.b <= r.pb + 0.5 && r.r <= r.vw, `${ancho} px: the open tooltip sits fully inside the panel (${Math.round(r.l)}–${Math.round(r.r)} of the panel ${Math.round(r.pl)}–${Math.round(r.pr)}; ${Math.round(r.t)}–${Math.round(r.b)} of ${Math.round(r.pt)}–${Math.round(r.pb)})`);
  await ctx.close();
}
{
  const { ctx, p } = await abrir('/atlas/', { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  const b = await p.$(`${FILA} [data-info] button`);
  ok(!(await visible(p)), 'phone: closed by default');
  await b.tap(); await p.waitForTimeout(250);
  ok(await visible(p), 'phone: a tap opens it (there is no hover)');
  const r = await p.evaluate((f) => { const t = document.querySelector(`${f} [data-info-tip]`).getBoundingClientRect(); const panel = document.querySelector('#at-indice').getBoundingClientRect(); return { l: t.left, r: t.right, pl: panel.left, pr: panel.right, vw: innerWidth }; }, FILA);
  ok(r.l >= r.pl - 0.5 && r.r <= r.pr + 0.5 && r.l >= 0 && r.r <= r.vw, `phone: the tooltip stays inside the panel (${Math.round(r.l)}–${Math.round(r.r)} in ${Math.round(r.pl)}–${Math.round(r.pr)}, viewport ${r.vw})`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: no horizontal scroll');
  if (fotos) await p.screenshot({ path: `${fotos}/info-telefono.png` });
  await p.tap('#at-indice h2, #at-indice [role="tablist"]').catch(() => {}); await p.waitForTimeout(200);
  await ctx.close();
}
await nav.close();
console.log(fallos ? `${fallos} FAILED` : 'all passed'); process.exit(fallos ? 1 : 0);
