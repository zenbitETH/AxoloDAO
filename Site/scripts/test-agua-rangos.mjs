#!/usr/bin/env node
/**
 * test-agua-rangos.mjs: los rangos de agua del museo son rangos generales de manejo, no una regla que decida nada.
 *
 * Criterio de maggia IP (7-oct): los rangos de src/data/water-quality/parameters.json y sus insignias se quedan con tres condiciones, y esta
 * prueba es roja ante cada una:
 *   a) ningún código ni dato público junta parámetros en una alerta «crítica» que bloquee o suspenda una captura o un envío;
 *   b) cada fila de rango cita su fuente (literatura o protocolo del museo); la fila sin una lleva «referencia operativa del piloto»;
 *   c) una lectura de agua fuera de su rango dice «Fuera de rango», nunca «clínica», «alarma» ni «alerta crítica».
 * Antes de mirar el sitio demuestra que cada comprobación se pone roja con su positivo conocido y deja pasar su texto legítimo.
 *
 * Uso (desde Site/):  npm run test:agua-rangos   (si hay dist/, también revisa la página del agua construida)
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const SITE = resolve(new URL('..', import.meta.url).pathname);
const FUENTE_POR_DEFECTO = 'referencia operativa del piloto';

// ---- b) la fuente de cada rango -------------------------------------------------------------------------------------------------------
export function filasSinFuente(filas) {
  return filas.filter((f) => typeof f.fuente !== 'string' || f.fuente.trim().length < 3).map((f) => `${f.tankId}/${f.key}`);
}

// ---- c) cómo se llama una lectura fuera de rango --------------------------------------------------------------------------------------
const PALABRA_PROHIBIDA = /cl[ií]nic[ao]s?|alarm[aeo]s?|alertas?\s+cr[ií]ticas?|critical\s+alert|cr[ií]tic[oa]s?\b/i;
export function palabrasProhibidas(texto) {
  return texto.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => PALABRA_PROHIBIDA.test(l)).map(([i, l]) => `línea ${i}: ${l.trim().slice(0, 100)}`);
}
/** Las líneas de las cadenas del agua (todo waterQuality/strings.ts) y las del recorrido de agua del postmortem (claves pm.*). */
export function cadenasDeAgua(archivo, texto) {
  if (/waterQuality\/strings\.ts$/.test(archivo)) return texto;
  if (/ajolotes\/strings\.ts$/.test(archivo)) return texto.split('\n').filter((l) => /^\s*'pm\./.test(l)).join('\n');
  return '';
}

const UMBRAL = /umbral|threshold|limiar/i;

// ---- a) una alerta crítica que bloquea ------------------------------------------------------------------------------------------------
const GATE = /(?:critical|cr[ií]tic[ao]|alarm[ae]?)[^\n]{0,120}(?:disabled|preventDefault|bloque|(?<![-\w])block|suspend|impid)|(?:disabled|preventDefault|bloque|(?<![-\w])block|suspend|impid)[^\n]{0,120}(?:critical|cr[ií]tic[ao]|alarm[ae]?)/i;
export function bloqueaPorAlerta(texto) {
  return texto.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => GATE.test(l) && !/endangered|peligro|\/\/|^\s*\*/.test(l)).map(([i, l]) => `línea ${i}: ${l.trim().slice(0, 100)}`);
}

// ---- Las reglas de aviso de la simulación -----------------------------------------------------------------------------------------------
// Criterio de maggia IP (7-oct): son avisos de un solo parámetro, escalamiento por tiempo, latido de medición y clip a bitácora; nunca una regla
// de varios parámetros, nunca una consecuencia que suspenda capturas o registros, siempre «reglas de aviso» (nunca «umbrales por especie»), y la
// cronología es un hecho medido: no se compara «con avisos» contra «lo que pasó sin ellos» ni se comenta lo que pasó.
const PARAMETROS = /amon[ií]aco|nitrito|nitrato|\bph\b|temperatura|conductividad|fosfato|dureza|ox[ií]geno|\bgh\b|\bkh\b/gi;
export function problemasDeUnaRegla(regla) {
  const out = [];
  const t = String(regla?.text ?? '');
  const params = new Set((t.match(PARAMETROS) ?? []).map((x) => x.toLowerCase().replace('í', 'i')));
  if (params.size > 1) out.push('una regla junta más de un parámetro');
  if (/suspend|detiene|bloque|impide|no se (?:permite|puede) (?:capturar|registrar)/i.test(t)) out.push('una consecuencia que suspende o bloquea capturas o registros');
  if (/direcci[oó]n cl[ií]nica/i.test(t)) out.push('escala a una persona por su cargo («la persona responsable» es la forma)');
  if (/umbrales? por especie|thresholds? by species/i.test(t)) out.push('«umbrales por especie» (se llaman reglas de aviso)');
  if (regla && ('real' in regla)) out.push('un comentario «real» junto a la regla');
  return out;
}
export function problemasDeLaSimulacion(sim) {
  const out = [];
  if (!sim || typeof sim !== 'object') return ['sin simulación'];
  for (const k of Object.keys(sim)) if (!['reglas', 'cronologia'].includes(k)) out.push(`la simulación trae «${k}»: sólo reglas y cronología medida (no se compara con «lo que pasó sin ellas»)`);
  for (const r of sim.reglas ?? []) for (const p of problemasDeUnaRegla(r)) out.push(`${r.d}: ${p}`);
  const c = sim.cronologia;
  if (!c || !('senal' in c) || !('accion' in c) || Object.keys(c).length !== 2) out.push('la cronología es «primera señal registrada» y «primera acción registrada», y nada más');
  return out;
}

// ---- El detector se prueba a sí mismo -------------------------------------------------------------------------------------------------
const falla = (m) => { console.error(`✗ ${m}`); process.exit(2); };
if (filasSinFuente([{ tankId: 'AA', key: 'temp' }]).length !== 1) falla('una fila sin fuente pasa');
if (filasSinFuente([{ tankId: 'AA', key: 'temp', fuente: '  ' }]).length !== 1) falla('una fuente en blanco pasa');
if (filasSinFuente([{ tankId: 'AA', key: 'temp', fuente: FUENTE_POR_DEFECTO }, { tankId: 'AA', key: 'ph', fuente: 'Protocolo del museo, hoja de manejo v2' }]).length) falla('una fila con fuente no pasa');
for (const t of ["statusAlarm: 'Alarma clínica'", "label: 'ALARMA CLÍNICA'", "tip: 'Alerta crítica de agua'", "status: 'Critical alert'", "x: 'Estado clínico del agua'", "x: 'alarmas'"]) {
  if (!palabrasProhibidas(t).length) falla(`la palabra prohibida pasa: ${t}`);
}
for (const t of ["statusAlarm: 'Fuera de rango'", "statusAlarm: 'Out of range'", "statusAlarm: 'Fora do intervalo'", "x: 'Sin lecturas fuera de rango'"]) {
  if (palabrasProhibidas(t).length) falla(`un texto legítimo se marca: ${t}`);
}
for (const t of ["<button disabled={status === 'alarm'}>", 'if (critical) { e.preventDefault(); }', 'const bloqueado = alertaCritica;', 'submit.disabled = hasCriticalAlert;', 'suspendCapture(alarma)']) {
  if (!bloqueaPorAlerta(t).length) falla(`una alerta que bloquea pasa: ${t}`);
}
for (const t of ["const alarm = m.alarms.includes(k);", '<span class="inline-block h-2" style={{ background: e.critical ? 1 : 2 }} />', "CR: { es: 'En peligro crítico', en: 'Critically endangered' }", "<button disabled={sending || noToken}>", "// critical rows stay visible"]) {
  if (bloqueaPorAlerta(t).length) falla(`un texto legítimo se marca como bloqueo: ${t}`);
}
if (!UMBRAL.test('umbrales compartidos') || !UMBRAL.test('thresholds shared') || UMBRAL.test('rangos de referencia compartidos')) falla('el detector de «umbral» no se prueba a sí mismo');
for (const r of [{ d: 'x', text: 'Amoníaco y nitritos sobre cero → aviso' }, { d: 'x', text: 'Amoníaco sobre cero → suspende capturas' }, { d: 'x', text: 'Señal sin respuesta en 48 h → escala a dirección clínica.' }, { d: 'x', text: 'Amoníaco sobre cero → aviso', real: 'El silencio no se notó.' }, { d: 'x', text: 'umbrales por especie' }]) {
  if (!problemasDeUnaRegla(r).length) falla(`una regla de aviso que no debe pasar pasa: ${r.text}`);
}
for (const r of [{ d: 'x', text: 'Amoníaco sobre cero → aviso al veterinario en minutos.' }, { d: 'x', text: 'Señal sin respuesta en 48 h → escala a la persona responsable.' }, { d: 'x', text: 'Sin medición del agua en 7 días → aviso.' }]) {
  if (problemasDeUnaRegla(r).length) falla(`una regla de aviso legítima se marca: ${r.text}`);
}
if (!problemasDeLaSimulacion({ reglas: [], cronologia: { senal: null, accion: null }, con: { n: '≤ 48 h' } }).length || !problemasDeLaSimulacion({ reglas: [] }).length || problemasDeLaSimulacion({ reglas: [], cronologia: { senal: '2026-01-01', accion: null } }).length) falla('la simulación no se prueba bien: una comparación «con avisos» pasa, o falta la cronología y pasa');
console.log('  ✓ el detector ve sus positivos conocidos y deja pasar sus textos legítimos');

// ---- El sitio ---------------------------------------------------------------------------------------------------------------------------
function* archivos(dir) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.git') continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) yield* archivos(p);
    else yield p;
  }
}
const fallos = [];

const parametrosF = join(SITE, 'src/data/water-quality/parameters.json');
if (!existsSync(parametrosF)) fallos.push('falta src/data/water-quality/parameters.json (falla hacia lo cerrado)');
else {
  const filas = JSON.parse(readFileSync(parametrosF, 'utf8'));
  if (!Array.isArray(filas) || filas.length < 10) fallos.push(`parameters.json: ${Array.isArray(filas) ? filas.length : 'no es una lista'} fila(s); se esperan los rangos de los sistemas`);
  else for (const f of filasSinFuente(filas)) fallos.push(`b) parameters.json: el rango ${f} no cita su fuente (ni «${FUENTE_POR_DEFECTO}»)`);
}

let cadenas = 0;
for (const rel of ['src/components/waterQuality/strings.ts', 'src/components/ajolotes/strings.ts']) {
  const f = join(SITE, rel);
  if (!existsSync(f)) { fallos.push(`falta ${rel} (falla hacia lo cerrado)`); continue; }
  const t = cadenasDeAgua(f, readFileSync(f, 'utf8'));
  if (!t.trim()) fallos.push(`${rel}: no se encontraron cadenas del agua que revisar`);
  cadenas += t.split('\n').length;
  for (const p of palabrasProhibidas(t)) fallos.push(`c) ${rel} ${p}: una lectura de agua dice «Fuera de rango», no «clínica», «alarma» ni «alerta crítica»`);
}

// Los rangos se llaman «rangos de referencia», no «umbrales» (ni thresholds, limiares): un umbral decide, un rango de referencia describe.
for (const rel of ['src/data/water-quality/tanks.json']) {
  const f = join(SITE, rel);
  if (!existsSync(f)) { fallos.push(`falta ${rel} (falla hacia lo cerrado)`); continue; }
  if (UMBRAL.test(readFileSync(f, 'utf8'))) fallos.push(`c) ${rel}: dice «umbral», «threshold» o «limiar»; son «rangos de referencia»`);
}

const forenseF = join(SITE, 'public/data/ajolotes/bajas-forense.json');
let reglasVistas = 0;
if (!existsSync(forenseF)) fallos.push('falta public/data/ajolotes/bajas-forense.json (falla hacia lo cerrado)');
else {
  for (const sp of JSON.parse(readFileSync(forenseF, 'utf8')).especimenes ?? []) {
    if (!sp.relato?.simulacion) continue;
    reglasVistas += sp.relato.simulacion.reglas?.length ?? 0;
    for (const p of problemasDeLaSimulacion(sp.relato.simulacion)) fallos.push(`reglas de aviso (${sp.alias}): ${p}`);
  }
  if (reglasVistas < 5) fallos.push(`reglas de aviso: sólo ${reglasVistas} regla(s) revisada(s); se esperan las de la simulación`);
}
for (const [rel, re, que] of [['src/components/ajolotes/strings.ts', /'pm\.r\.simTitle': '[^']*(?:Reglas de aviso|alert rules|Regras de aviso)[^']*'/gi, 'el título de la simulación dice «reglas de aviso» en los tres idiomas']]) {
  const f = join(SITE, rel);
  const n = existsSync(f) ? (readFileSync(f, 'utf8').match(re) ?? []).length : 0;
  if (n < 3) fallos.push(`${rel}: ${que} (${n} de 3)`);
}

let codigo = 0;
for (const raiz of ['src', 'public']) {
  const d = join(SITE, raiz);
  if (!existsSync(d)) { fallos.push(`falta ${raiz}/ (falla hacia lo cerrado)`); continue; }
  for (const f of archivos(d)) {
    if (!['.ts', '.tsx', '.astro', '.mjs', '.js', '.json'].includes(extname(f))) continue;
    codigo++;
    for (const p of bloqueaPorAlerta(readFileSync(f, 'utf8'))) fallos.push(`a) ${relative(SITE, f)} ${p}: una alerta crítica no bloquea ni suspende una captura o un envío`);
  }
}
if (codigo < 50) fallos.push(`a) sólo ${codigo} archivos de código y datos revisados; se esperan más`);

// La página del agua construida: la insignia dice «Fuera de rango».
let paginas = 0;
for (const rel of ['dist/xolotlcalli/index.html', 'dist/en/xolotlcalli/index.html', 'dist/pt/xolotlcalli/index.html']) {
  const f = join(SITE, rel);
  if (!existsSync(f)) continue;
  paginas++;
  const html = readFileSync(f, 'utf8').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');
  if (/alarma\s+cl[ií]nica|clinical\s+alarm|alerta\s+cr[ií]tica/i.test(html)) fallos.push(`c) ${rel}: la página del agua dice «alarma clínica» o «alerta crítica»`);
}

if (fallos.length) {
  console.error(`\n✗ ${fallos.length} problema(s):`);
  for (const x of [...new Set(fallos)].slice(0, 40)) console.error(`  - ${x}`);
  process.exit(1);
}
console.log(`  ✓ cada rango cita su fuente, ${cadenas} líneas de cadenas del agua sin «clínica», «alarma» ni «alerta crítica», ${codigo} archivos sin una alerta que bloquee${paginas ? `, ${paginas} página(s) construida(s)` : ''}\n\nlos rangos de agua son de manejo, no deciden nada`);
