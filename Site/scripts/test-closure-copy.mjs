// Prueba de la copia de cierre: el museo cerró para siempre, así que su aviso va en pasado y no nombra una reapertura,
// obras, un evento de un aliado, la cuarentena ni una fecha que no sea la del cierre. Usa las mismas reglas que el build
// (src/lib/closure-copy.ts, sin imports). Se ejecuta con: npm run test:closure-copy
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closureCopyViolations } from '../src/lib/closure-copy.ts';
import { contarSupervivencia } from '../src/lib/survival-core.mjs';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOTA = 'Supervivencia del 24 de octubre de 2025, día de la apertura, al 25 de septiembre de 2026: proporción de ejemplares vivos entre los incluidos en el registro del museo. Incluye una baja del 23 de septiembre de 2026, ocurrida después del cierre al público (22 de septiembre), con los ejemplares bajo custodia del museo.';
const { closedOn } = JSON.parse(readFileSync(join(SITE, 'src/data/closure.json'), 'utf8'));
let fallos = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fallos++; };

console.log('1 · las reglas ven rojo con cada defecto (una mutación por regla)');
const casos = [
  ['reabre el sábado 24 de octubre', 'reapertura'],
  ['cerrado por remodelación', 'obras'],
  ['reopens on 24 October', 'una fecha o reapertura'],
  ['todos los ajolotes en cuarentena', 'cuarentena'],
  ['volverá pronto', 'futuro vago'],
  ['cerró el 23 de septiembre de 2026', 'otra fecha de cierre'],
];
for (const [texto, que] of casos) ok(closureCopyViolations(texto, closedOn).length > 0, `rechaza «${texto}» (${que})`);

console.log('\n2 · las reglas dejan pasar la frase correcta');
for (const texto of ['El Museo de Ajolotes Xolotlcalli cerró sus puertas el 22 de septiembre de 2026.', 'The museum closed its doors on 22 September 2026.', 'O museu fechou as portas em 22 de setembro de 2026.']) {
  ok(closureCopyViolations(texto, closedOn).length === 0, `acepta «${texto}»`);
}

console.log('\n3 · la copia de cierre del sitio (closure.* en src/i18n/strings.ts)');
const strings = readFileSync(join(SITE, 'src/i18n/strings.ts'), 'utf8');
const entradas = [...strings.matchAll(/'(closure\.[a-z.]+)':\s*'((?:[^'\\]|\\.)*)'/g)];
ok(entradas.length >= 6, `se encontraron ${entradas.length} cadenas closure.* (3 idiomas, texto y enlace)`);
for (const [, clave, texto] of entradas) ok(closureCopyViolations(texto, closedOn).length === 0, `${clave}: «${texto}»`);
ok(!/closure\.quarantine/.test(strings), 'no queda ninguna cadena closure.quarantine.*');

console.log('\n4 · las rutas nuevas (/kiosko, /atlas, /manifiesto, /organizaciones) no hablan de una reapertura');
const rutas = ['kiosko', 'atlas', 'manifiesto', 'organizaciones'];
const PROHIBIDO = /reabr|reapertura|reabertura|reopen|remodel|renovat|ndali|cuarentena|quarantine/i;
function archivos(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? archivos(p) : [p]; });
}
let vistos = 0;
for (const r of rutas) {
  for (const base of ['src/pages', 'src/pages/en', 'src/pages/pt']) {
    for (const f of archivos(join(SITE, base, r)).concat(existsSync(join(SITE, base, `${r}.astro`)) ? [join(SITE, base, `${r}.astro`)] : [])) {
      vistos++;
      ok(!PROHIBIDO.test(readFileSync(f, 'utf8')), f.replace(SITE + '/', ''));
    }
  }
}
console.log(`  (${vistos} archivos de rutas nuevas revisados; sólo cuenta la copia de esas rutas, no content/members ni el pie de página)`);

console.log('\n5 · lo que el museo ya no hace no se dice en presente (biografías, noticias, tasa de supervivencia)');
// Cada regla se prueba contra su positivo y su texto legítimo antes de mirar el sitio.
const CUIDADO_EN_PRESENTE = /\b(?:cuidamos|alimentamos|vigilamos|monitoreamos|atendemos|tenemos a)\b/i;
const PROMESA_DE_ADOPCION = /adopci[oó]n|adopt|ado[cç][aã]o|recompensa|reward/i;
ok(CUIDADO_EN_PRESENTE.test('la cuidamos con especial atención') && !CUIDADO_EN_PRESENTE.test('la cuidábamos con especial atención'), 'la regla del cuidado en presente ve rojo con «cuidamos» y deja pasar «cuidábamos»');
ok(PROMESA_DE_ADOPCION.test('con adopción a distancia y recompensas') && PROMESA_DE_ADOPCION.test('remote adoption') && !PROMESA_DE_ADOPCION.test('un suscriptor fundador de Xovi apadrinó a la Larva 1'), 'la regla de la promesa de adopción ve rojo y deja pasar el hecho pasado');
const bundle = JSON.parse(readFileSync(join(SITE, 'src/data/ajolotes/bundle.json'), 'utf8'));
const bios = bundle.ejemplares.flatMap((e) => [e.descripcion?.breve, e.descripcion?.extendida]).filter(Boolean);
ok(bios.length >= 10, `se leyeron ${bios.length} biografías`);
ok(bios.every((b) => !CUIDADO_EN_PRESENTE.test(b)), 'ninguna biografía dice que el museo cuida, alimenta o vigila en presente');
const noticias = archivos(join(SITE, 'src/content/news')).filter((f) => f.endsWith('.yaml'));
ok(noticias.length >= 20, `se leyeron ${noticias.length} pies del Pulso`);
for (const f of noticias) ok(!PROMESA_DE_ADOPCION.test(readFileSync(f, 'utf8')), `${f.replace(SITE + '/', '')}: sin promesa de adopción ni de recompensa`);

console.log('\n6 · la tasa de supervivencia lleva su periodo: hasta el 25 de septiembre de 2026, con la baja bajo custodia');
const survival = readFileSync(join(SITE, 'src/lib/survival.ts'), 'utf8');
const FIN = /FIN_DE_LA_CUENTA = '(\d{4}-\d{2}-\d{2})'/.exec(survival)?.[1];
ok(FIN === '2026-09-25' && /CLOSED_ON[^\n]*closure\.closedOn/.test(survival) && /until: string = FIN_DE_LA_CUENTA/.test(survival) && !/\bCORTE\b/.test(survival), 'la cuenta termina el 2026-09-25 (FIN_DE_LA_CUENTA) y el cierre sigue siendo closure.json');
{
  // La tasa es una función del periodo: se prueba con casos inventados y con el paquete real.
  const b = (vivos, bajas, snaps = []) => ({ ejemplares: Array.from({ length: vivos }, (_, i) => ({ i })), bajas, bajasSnapshots: snaps });
  const P = { since: '2025-10-24', until: '2026-09-22' };
  const base = contarSupervivencia(b(10, [{ nombre: 'A', fecha: '2026-01-10' }, { nombre: 'B', fecha: '2026-09-22' }]), P);
  ok(base.vivos === 10 && base.bajas === 2 && Math.abs(base.tasa - 10 / 12) < 1e-12, 'una muerte en el último día del periodo cuenta como baja');
  const despues = contarSupervivencia(b(10, [{ nombre: 'A', fecha: '2026-01-10' }, { nombre: 'L', fecha: '2026-09-23' }]), P);
  ok(despues.vivos === 11 && despues.bajas === 1 && !despues.fechas.includes('2026-09-23'), 'una muerte un día después del cierre estaba viva al cierre: suma a los vivos y no a las bajas');
  ok(contarSupervivencia(b(10, [{ nombre: 'L', fecha: '2026-09-23' }]), { ...P, until: '2026-10-01' }).bajas === 1, 'mover el cierre al 1 de octubre recalcula: esa muerte pasa a ser baja del periodo');
  ok(contarSupervivencia(b(10, [{ nombre: 'Antes', fecha: '2025-10-23' }]), P).bajas === 0, 'una muerte anterior a la apertura no es del museo');
  const snap = contarSupervivencia(b(10, [], [{ alias: 'S1' }, { alias: 'S2' }]), { ...P, fixes: { S2: '2026-09-23' } });
  ok(snap.vivos === 11 && snap.bajas === 1, 'un ejemplar fallecido sin fila de baja suma una vez, en el lado del cierre que le toca por su fecha curada');
  ok(contarSupervivencia(b(10, [{ nombre: 'Sin fecha' }]), P).bajas === 1, 'una baja sin fecha cuenta como baja del periodo');
  ok(contarSupervivencia(b(10, [{ nombre: 'A', fecha: '2026-01-10' }], [{ alias: 'A' }, { alias: 'S' }]), P).bajas === 2, 'una baja de un registro sin fila en la hoja suma una vez, no dos');
  ok(contarSupervivencia(b(10, [{ nombre: 'Andersoni 1', fecha: '2026-09-05' }]), { ...P, fixes: { 'Andersoni 1': '2026-09-30' } }).vivos === 11, 'las fechas corregidas se usan para decidir en qué lado del cierre cae una muerte');
  const real = JSON.parse(readFileSync(join(SITE, 'src/data/ajolotes/bundle.json'), 'utf8'));
  const memorial = readFileSync(join(SITE, 'src/components/ajolotes/memorial.ts'), 'utf8');
  const fixes = Object.fromEntries([...memorial.slice(memorial.indexOf('BAJA_FECHA_FIX')).split('};')[0].matchAll(/(?:'([^']+)'|(\w+)):\s*'(\d{4}-\d{2}-\d{2})'/g)].map((m) => [m[1] ?? m[2], m[3]]));
  const sv = contarSupervivencia(real, { since: '2025-10-24', until: FIN, fixes });
  ok(sv.fechas.filter(Boolean).every((f) => f >= '2025-10-24' && f <= FIN), `cada muerte con fecha en la cuenta cae dentro de 24 oct 2025 a ${FIN}`);
  ok(sv.vivos === 10 && sv.bajas === 17 && sv.total === 27 && (sv.tasa * 100).toFixed(1) === '37.0', `la cifra de este paquete es exactamente 37.0 % (10 de 27): sale ${(sv.tasa * 100).toFixed(1)} %`);
  const nombres = new Set(real.bajas.map((x) => (x.nombre ?? '').trim()));
  const despuesReal = [...real.bajas, ...(real.bajasSnapshots ?? []).filter((x) => !nombres.has((x.alias ?? '').trim()))].filter((x) => (fixes[(x.nombre ?? x.alias ?? '').trim()] ?? x.fecha) > FIN).length;
  ok(sv.vivos === real.ejemplares.length + despuesReal && sv.total === sv.vivos + sv.bajas && Math.abs(sv.tasa - sv.vivos / sv.total) < 1e-12, `la tasa del paquete real sale del periodo: ${sv.vivos} vivos al 25 de septiembre, ${sv.bajas} bajas, ${(sv.tasa * 100).toFixed(1)} %`);
}
ok(/OPENING = '2025-10-24'/.test(survival), 'el periodo empieza el día de la apertura');
ok(/larvae and the unnamed groups/.test(readFileSync(join(SITE, 'src/lib/survival-core.mjs'), 'utf8')), 'el código dice qué cuentan las bajas sin fecha');
for (const f of ['src/components/SurvivalStat.astro', 'src/components/ajolotes/BajasView.tsx', 'src/components/ajolotes/CoverHeader.tsx']) {
  ok(/periodoDeSupervivencia\(/.test(readFileSync(join(SITE, f), 'utf8')), `${f}: la cifra de supervivencia muestra su periodo`);
}
const dist = join(SITE, 'dist');
if (existsSync(join(dist, 'xolotlcalli/ajolotes/index.html'))) {
  const [y, m, d] = FIN.split('-').map(Number);
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const esperado = `24 oct 2025 – ${d} ${MES[m - 1]} ${y}`;
  const html = readFileSync(join(dist, 'xolotlcalli/ajolotes/index.html'), 'utf8');
  ok(html.includes(esperado), `la página construida de los ejemplares dice «${esperado}» junto a la tasa`);
}

// Una sola cifra: la que dibuja la página del cierre es la que sale de los datos, con su método y su corte al lado.
// Con --dist lee la página construida (npm run build antes); sin dist construido, --dist falla.
if (process.argv.includes('--dist')) {
  console.log('\n· el encabezado ya no enlaza a Xolotlcalli (las páginas siguen)');
  for (const pag of ['index.html', 'en/index.html', 'pt/index.html']) {
    const ruta = join(SITE, 'dist', pag);
    const encabezado = existsSync(ruta) ? /<header[\s\S]*?<\/header>/.exec(readFileSync(ruta, 'utf8'))?.[0] ?? '' : '';
    ok(encabezado.length > 0 && !/href="[^"]*\/xolotlcalli\//.test(encabezado), `dist/${pag}: el encabezado no lleva enlace a /xolotlcalli/`);
  }
  for (const pag of ['index.html', 'en/index.html', 'pt/index.html']) {
    const ruta = join(SITE, 'dist', pag);
    const html = existsSync(ruta) ? readFileSync(ruta, 'utf8') : '';
    const portada = /<section[^>]*>(?:(?!<\/section>)[\s\S])*?hero-subtitle[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
    ok(portada.length > 0 && !/href="[^"]*\/xolotlcalli\/ajolotes\//.test(portada), `dist/${pag}: la portada no lleva el botón a los ejemplares en custodia`);
  }
  ok(existsSync(join(SITE, 'dist/xolotlcalli/index.html')) && existsSync(join(SITE, 'dist/xolotlcalli/ajolotes/index.html')), 'las páginas /xolotlcalli/ y /xolotlcalli/ajolotes/ siguen construyéndose');
  console.log('\n· el sitio construido no nombra a Ndali ni tiene la sección de nodos');
  const enDist = [];
  const recorrer = (d) => { for (const n of readdirSync(d)) { const r = join(d, n); statSync(r).isDirectory() ? recorrer(r) : enDist.push(r); } };
  recorrer(join(SITE, 'dist'));
  const conNombre = enDist.filter((r) => /ndali/i.test(r.slice(SITE.length)));
  ok(conNombre.length === 0, `ningún archivo de dist se llama como Ndali${conNombre.length ? `: ${conNombre.map((r) => r.slice(SITE.length + 1)).join(', ')}` : ''}`);
  const TEXTO = /\.(html|js|mjs|css|json|xml|txt|svg|webmanifest)$/i;
  const conTexto = enDist.filter((r) => TEXTO.test(r) && /ndali/i.test(readFileSync(r, 'utf8')));
  ok(conTexto.length === 0, `ningún archivo de dist dice «ndali»${conTexto.length ? `: ${conTexto.map((r) => r.slice(SITE.length + 1)).join(', ')}` : ''}`);
  for (const pag of ['index.html', 'en/index.html', 'pt/index.html']) {
    const html = readFileSync(join(SITE, 'dist', pag), 'utf8');
    ok(!/id="members"/.test(html) && !/Nodos de AxoloDAO|AxoloDAO nodes|Nós da AxoloDAO/.test(html), `dist/${pag}: sin la sección «Nodos de AxoloDAO»`);
  }
  console.log('\n· la tasa de la página construida es la de los datos');
  const pagina = join(SITE, 'dist/xolotlcalli/index.html');
  ok(existsSync(pagina), 'dist/xolotlcalli/index.html existe (corre el build antes)');
  if (existsSync(pagina)) {
    const html = readFileSync(pagina, 'utf8');
    const bundle = JSON.parse(readFileSync(join(SITE, 'src/data/ajolotes/bundle.json'), 'utf8'));
    const memorial = readFileSync(join(SITE, 'src/components/ajolotes/memorial.ts'), 'utf8');
    const fixes = Object.fromEntries([...memorial.slice(memorial.indexOf('BAJA_FECHA_FIX')).split('};')[0].matchAll(/(?:'([^']+)'|(\w+)):\s*'(\d{4}-\d{2}-\d{2})'/g)].map((m) => [m[1] ?? m[2], m[3]]));
    const sv = contarSupervivencia(bundle, { since: '2025-10-24', until: FIN, fixes });
    const esperada = `${(sv.tasa * 100).toLocaleString('es-MX', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;
    const enPagina = /data-supervivencia[^>]*>([^<]+)</.exec(html)?.[1]?.trim();
    ok(enPagina === esperada, `la página dice ${enPagina ?? 'nada'} y los datos ${esperada}`);
    const nota = /data-supervivencia-nota[^>]*>([^<]+)</.exec(html)?.[1] ?? '';
    ok(enPagina === '37.0 %', `la página dice exactamente 37.0 %: dice ${enPagina}`);
    ok(nota === NOTA, 'la nota de maggia, tal cual, acompaña a la cifra');
  }
}

console.log('\n7 · el registro de ejemplares: la copia de maggia, sin «custodia» en presente ni un estado en presente');
// La copia aprobada para la página del registro (es, en, pt). La columna pt sigue pendiente de lectura por una persona.
const COPIA = {
 "titulo": {
  "es": "Registro de ejemplares del Museo de Ajolotes Xolotlcalli (2025–2026)",
  "en": "Specimen register of the Museo de Ajolotes Xolotlcalli (2025–2026)",
  "pt": "Registro de exemplares do Museo de Ajolotes Xolotlcalli (2025–2026)"
 },
 "subtitulo": {
  "es": "Archivo del registro de cada ejemplar durante la operación del museo, de octubre de 2025 a septiembre de 2026: biometría, historial médico y alimentación.",
  "en": "Archive of each specimen's record while the museum operated, from October 2025 to September 2026: biometrics, medical history and feeding.",
  "pt": "Arquivo do registro de cada exemplar durante o funcionamento do museu, de outubro de 2025 a setembro de 2026: biometria, histórico médico e alimentação."
 },
 "entrada": {
  "es": "El Museo de Ajolotes Xolotlcalli cerró sus puertas al público en septiembre de 2026. Gracias a todas las personas que lo visitaron entre octubre de 2025 y septiembre de 2026. Los registros de ese periodo se conservan como archivo.",
  "en": "The Museo de Ajolotes Xolotlcalli closed to the public in September 2026. Thank you to everyone who visited between October 2025 and September 2026. The records from that period are kept as an archive.",
  "pt": "O Museo de Ajolotes Xolotlcalli fechou as portas ao público em setembro de 2026. Obrigado a todas as pessoas que o visitaram entre outubro de 2025 e setembro de 2026. Os registros desse período são conservados como arquivo."
 },
 "preguntas": {
  "es": "Las preguntas sobre los ejemplares o sobre el cierre las atiende el propio museo.",
  "en": "Questions about the specimens or the closure are answered by the museum itself.",
  "pt": "As perguntas sobre os exemplares ou sobre o fechamento são respondidas pelo próprio museu."
 },
 "boton": {
  "es": "Ver el registro de ejemplares →",
  "en": "See the specimen register →",
  "pt": "Ver o registro de exemplares →"
 },
 "vivo": {
  "es": "Vivo al cierre del registro (25 sep 2026)",
  "en": "Alive when the register closed (25 Sep 2026)",
  "pt": "Vivo no encerramento do registro (25 set. 2026)"
 },
 "baja": {
  "es": "Baja · {fecha}",
  "en": "Death · {fecha}",
  "pt": "Óbito · {fecha}"
 },
 "postmortem": {
  "es": "Después del cierre al público",
  "en": "After the closure to the public",
  "pt": "Após o fechamento ao público"
 },
 "nota": {
  "es": "Supervivencia del 24 de octubre de 2025, día de la apertura, al 25 de septiembre de 2026: proporción de ejemplares vivos entre los incluidos en el registro del museo. Incluye una baja del 23 de septiembre de 2026, ocurrida después del cierre al público (22 de septiembre), con los ejemplares bajo custodia del museo.",
  "en": "Survival from 24 October 2025, opening day, to 25 September 2026: share of specimens alive among those in the museum's register. Includes one death on 23 September 2026, after the closure to the public (22 September), while the specimens were in the museum's care.",
  "pt": "Sobrevivência de 24 de outubro de 2025, dia da abertura, a 25 de setembro de 2026: proporção de exemplares vivos entre os incluídos no registro do museu. Inclui um óbito em 23 de setembro de 2026, ocorrido após o fechamento ao público (22 de setembro), com os exemplares sob os cuidados do museu."
 },
 "fuente": {
  "es": "Fuente: Museo de Ajolotes Xolotlcalli (2025–2026)",
  "en": "Source: Museo de Ajolotes Xolotlcalli (2025–2026)",
  "pt": "Fonte: Museo de Ajolotes Xolotlcalli (2025–2026)"
 }
};
const tabla = (archivo) => {
  const texto = readFileSync(join(SITE, archivo), 'utf8');
  const i = { es: texto.indexOf('  es: {'), en: texto.indexOf('  en: {'), pt: texto.indexOf('  pt: {') };
  const tramo = { es: texto.slice(i.es, i.en), en: texto.slice(i.en, i.pt), pt: texto.slice(i.pt) };
  return Object.fromEntries(Object.entries(tramo).map(([l, t]) => [l, Object.fromEntries([...t.matchAll(/'([a-zA-Z0-9.]+)':\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => [m[1], m[2].replace(/\\'/g, "'")]))]));
};
const sitio = tabla('src/i18n/strings.ts');
const ajolotes = tabla('src/components/ajolotes/strings.ts');
const CLAVES = [[sitio, 'ajolotes.title', 'titulo'], [sitio, 'ajolotes.subtitle', 'subtitulo'], [sitio, 'ajolotes.cta', 'boton'],
  [ajolotes, 'cover.title', 'titulo'], [ajolotes, 'cover.sub', 'subtitulo'], [ajolotes, 'cover.lead', 'entrada'], [ajolotes, 'cover.preguntas', 'preguntas'],
  [ajolotes, 'cover.fuente', 'fuente'], [ajolotes, 'modal.status.vivo', 'vivo'], [ajolotes, 'bajas.status', 'baja'], [ajolotes, 'pm.custody', 'postmortem']];
for (const l of ['es', 'en', 'pt']) {
  for (const [t, clave, pieza] of CLAVES) ok(t[l][clave] === COPIA[pieza][l], `${l} ${clave} es la copia aprobada`);
}
const CUSTODIA = /custodi|custody|custódia/i;
const ESTADO_SUELTO = /^(vivo|viva|alive|en cuarentena|in quarantine|em quarentena)$/i;
for (const [nombre, t] of [['i18n/strings.ts', sitio], ['ajolotes/strings.ts', ajolotes]]) {
  for (const l of ['es', 'en', 'pt']) {
    const malas = Object.entries(t[l]).filter(([, v]) => CUSTODIA.test(v)).map(([k]) => k);
    ok(malas.length === 0, `${nombre} ${l}: ninguna cadena dice «custodia»${malas.length ? `: ${malas.join(', ')}` : ''}`);
    const sueltas = Object.entries(t[l]).filter(([, v]) => ESTADO_SUELTO.test(v.trim())).map(([k]) => k);
    ok(sueltas.length === 0, `${nombre} ${l}: ningún estado en presente${sueltas.length ? `: ${sueltas.join(', ')}` : ''}`);
  }
}
const survivalTs = readFileSync(join(SITE, 'src/lib/survival.ts'), 'utf8');
for (const l of ['es', 'en', 'pt']) ok(survivalTs.includes(`'${COPIA.nota[l].replace(/'/g, "\\'")}'`), `${l}: la nota de supervivencia es la aprobada`);
if (process.argv.includes('--dist')) {
  const PAGINAS = { es: 'xolotlcalli/ajolotes/index.html', en: 'en/xolotlcalli/ajolotes/index.html', pt: 'pt/xolotlcalli/ajolotes/index.html' };
  const texto = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  for (const [l, pag] of Object.entries(PAGINAS)) {
    const ruta = join(SITE, 'dist', pag);
    const t = existsSync(ruta) ? texto(readFileSync(ruta, 'utf8')) : '';
    for (const pieza of ['titulo', 'subtitulo', 'entrada', 'preguntas', 'fuente']) ok(t.includes(COPIA[pieza][l]), `dist/${pag}: lleva ${pieza}`);
  }
  for (const pag of [...Object.values(PAGINAS), 'index.html', 'en/index.html', 'pt/index.html', 'xolotlcalli/index.html', 'en/xolotlcalli/index.html', 'pt/xolotlcalli/index.html']) {
    const ruta = join(SITE, 'dist', pag);
    if (!existsSync(ruta)) { ok(false, `dist/${pag} existe`); continue; }
    let t = texto(readFileSync(ruta, 'utf8'));
    for (const l of ['es', 'en', 'pt']) t = t.split(COPIA.nota[l]).join(' ');
    ok(!CUSTODIA.test(t), `dist/${pag}: «custodia» sólo aparece dentro de la nota de supervivencia`);
    ok(!/>\s*(Vivo|Viva|Alive)\s*</.test(readFileSync(ruta, 'utf8')), `dist/${pag}: ningún estado «Vivo» suelto`);
  }
}

console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO VERDE');
process.exit(fallos ? 1 : 0);
