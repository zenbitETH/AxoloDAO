#!/usr/bin/env node
/**
 * data-ajolotes.mjs
 *
 * Reads Context/Control operativo AxoloDAO.xlsx and emits the bundle.json that
 * powers the per-axolotl Ajolotes Explorer:
 *
 *   Site/src/data/ajolotes/bundle.json
 *
 * Sheets consumed:
 *   - Dashboard ejemplares  → ejemplares[]                 (latest snapshot per axolotl)
 *   - Historial medico      → historial[alias][]           (sorted ascending by fecha)
 *   - Plan de alimentación  → planes[alias]                (one plan per axolotl)
 *   - Alimentación 2.0      → alimentacion[alias][]        (sorted ascending by fecha)
 *   - Bajas                 → bajas[]                      (sorted ascending by fecha)
 *
 * The script regenerates bundle.json from scratch each run, so re-running on
 * the same xlsx produces identical output — no merge logic needed.
 *
 * Run manually each Monday after the Biomuseo team updates the xlsx:
 *   npm run data:ajolotes
 */
import XLSX from 'xlsx';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  toIsoDate,
  toTimeFraction,
  toNum,
  toNumOrText,
  toStr,
  findHeaderRow,
  indexOfHeader,
  normalizeAlias,
} from './lib/xlsx-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(SITE_ROOT, '..');
const XLSX_PATH = resolve(REPO_ROOT, 'Context/Control operativo AxoloDAO.xlsx');

const OUT_DIR = resolve(SITE_ROOT, 'src/data/ajolotes');
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Curator overrides for stale Dashboard ejemplares fields. The xlsx is the
// system of record but the dashboard column can lag the actual colony state
// (e.g. a specimen returned from cuarentena before the curator updated the
// sheet). Each override patches a single field after the xlsx is read so the
// next regen does not silently revert the live page. Drop an entry once the
// xlsx catches up.
const EJEMPLAR_OVERRIDES = new Map([
  // Field-level curator patches for stale Dashboard columns. Currently empty —
  // the AM aquarium distribution moved to AM_PECERA below. Add entries here when
  // a non-pecera field lags the live colony state.
]);

// Canonical AM-station aquarium distribution. The xlsx "Ubicación" column carries
// the curator's raw per-animal location (AM 1 / AM 3 / Cuarentena / …), but the
// live museum layout is curated here: four aquariums (AM1–AM4) plus a larvae tank
// (AM Larvas) on one unified recirculating system (consolidated from 5 to 4 —
// two aquariums were merged). This map is the source of truth for the
// per-aquarium detail views, the QR anchors and the Xovi distribution — the UI
// reads `pecera` directly. An animal whose workbook location is "Cuarentena"
// keeps its home aquarium here and is flagged `enCuarentena` below so the tile
// shows it is temporarily out. Keep it in sync with the curator's physical tank
// labels.
const AM_PECERA = new Map([
  ['Tamal de dulce', 'AM1'],
  ['Tascalate',      'AM1'],
  ['Parda',          'AM1'],
  ['La negra',       'AM1'],
  ['Pardo Macho',    'AM2'],
  ['Goldy',          'AM3'],
  ['Chocoroll',      'AM3'],
  ['Martín',         'AM4'],
  ['Limon',          'AM4'],
  ['Larva 1',        'AM Larvas'],
  ['Larva 2',        'AM Larvas'],
]);

// ---------------------------------------------------------------------------
// Main

if (!existsSync(XLSX_PATH)) {
  console.error(`[data-ajolotes] ERROR: xlsx not found at ${XLSX_PATH}`);
  console.error('[data-ajolotes] Place the file at Context/Control operativo AxoloDAO.xlsx and re-run.');
  process.exit(1);
}

console.log(`[data-ajolotes] Reading ${XLSX_PATH}`);
const wb = XLSX.readFile(XLSX_PATH, { cellDates: true });

function sheet(name) {
  const sh = wb.Sheets[name];
  if (!sh) throw new Error(`Sheet "${name}" not found`);
  return XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true, blankrows: false });
}

// --- Ejemplares ------------------------------------------------------------
const dashRows = sheet('Dashboard ejemplares');
// Header row identified by alias + especie (resilient to the 2026 rename of the
// "Pecera actual" column to "Ubicación").
const dashHdrIdx = findHeaderRow(dashRows, ['alias', 'especie']);
if (dashHdrIdx < 0) throw new Error('Dashboard ejemplares: header row not found');
const dashHdr = dashRows[dashHdrIdx];
const D = {
  alias:           indexOfHeader(dashHdr, 'alias'),
  id:              indexOfHeader(dashHdr, 'id de ejemplar'),
  pecera:          indexOfHeader(dashHdr, ['pecera actual', 'ubicación']),
  especie:         indexOfHeader(dashHdr, 'especie'),
  genero:          indexOfHeader(dashHdr, 'género'),
  marcas:          indexOfHeader(dashHdr, 'marcas'),
  fenotipo:        indexOfHeader(dashHdr, 'fenotipo'),
  edad:            indexOfHeader(dashHdr, 'edad'),
  estadio:         indexOfHeader(dashHdr, 'estadio'),
  peso:            indexOfHeader(dashHdr, 'último peso'),
  lt:              indexOfHeader(dashHdr, 'longitud total'),
  lhc:             indexOfHeader(dashHdr, 'longitud hocico'),
  icc:             indexOfHeader(dashHdr, 'último icc'),
  propCabezaCuerpo: indexOfHeader(dashHdr, 'proporción cabeza'),
  propColaCuerpo:   indexOfHeader(dashHdr, 'proporción cola'),
  asimetria:        indexOfHeader(dashHdr, 'asimetría'),
  temp:             indexOfHeader(dashHdr, 'temp in situ'),
  bcs:              indexOfHeader(dashHdr, 'bcs'),
  alertaConductual: indexOfHeader(dashHdr, 'alerta conductual'),
  anomalia:         indexOfHeader(dashHdr, 'anomalía'),
  estadoBio:        indexOfHeader(dashHdr, 'estado'),
  ultimoConsumo:    indexOfHeader(dashHdr, 'último consumo'),
  respuestaAlim:    indexOfHeader(dashHdr, 'respuesta alimentaria'),
  alertaGastrica:   indexOfHeader(dashHdr, 'alerta gástrica'),
};

const ejemplares = [];
const knownAliases = new Set();
for (let r = dashHdrIdx + 1; r < dashRows.length; r++) {
  const row = dashRows[r];
  if (!row || row.every((c) => c == null || c === '')) continue;
  const alias = normalizeAlias(toStr(row[D.alias]));
  if (!alias) continue;
  knownAliases.add(alias);
  ejemplares.push({
    alias,
    id: toStr(row[D.id]),
    pecera: toStr(row[D.pecera]),
    especie: toStr(row[D.especie]),
    genero: toStr(row[D.genero]),
    marcas: toStr(row[D.marcas]),
    fenotipo: toStr(row[D.fenotipo]),
    edad: toStr(row[D.edad]),
    estadio: toStr(row[D.estadio]),
    peso: toNum(row[D.peso]),
    lt: toNum(row[D.lt]),
    lhc: toNum(row[D.lhc]),
    icc: toNum(row[D.icc]),
    propCabezaCuerpo: toNum(row[D.propCabezaCuerpo]),
    propColaCuerpo: toNum(row[D.propColaCuerpo]),
    asimetria: toStr(row[D.asimetria]),
    temp: toNum(row[D.temp]),
    bcs: toNumOrText(row[D.bcs]),
    alertaConductual: toStr(row[D.alertaConductual]) ?? '',
    anomalia: toStr(row[D.anomalia]) ?? '',
    estadoBio: toStr(row[D.estadoBio]),
    ultimoConsumo: toNum(row[D.ultimoConsumo]),
    respuestaAlim: toStr(row[D.respuestaAlim]),
    alertaGastrica: toStr(row[D.alertaGastrica]),
    enCuarentena: false,
  });
}

// Apply curator overrides (see EJEMPLAR_OVERRIDES above) after the xlsx read,
// then normalize AM-station ejemplares to their canonical aquarium (AM_PECERA)
// and collapse the unified A. dumerilii system to canonical "AD".
for (const e of ejemplares) {
  const patch = EJEMPLAR_OVERRIDES.get(e.alias);
  if (patch) Object.assign(e, patch);
  const amPecera = AM_PECERA.get(e.alias);
  if (amPecera) {
    // An AM animal whose workbook location is "Cuarentena" keeps its assigned
    // home aquarium but is flagged so the station tile renders the "en
    // cuarentena" ribbon. Self-clears once the curator moves it back in the xlsx.
    const xlsxLoc = (e.pecera ?? '').trim();
    if (xlsxLoc && xlsxLoc !== amPecera && /cuarentena/i.test(xlsxLoc)) {
      e.enCuarentena = true;
    }
    e.pecera = amPecera;
  } else {
    // The A. dumerilii system is one unified tank: "AD Gral.", "AD 1.1", etc.
    // collapse to canonical "AD" so those ejemplares (e.g. Remo) appear in the
    // AD tank detail. Mirrors normalizeTankId() in data-water.mjs.
    const p = (e.pecera ?? '').trim();
    if (/^AD\b/i.test(p) && p !== 'AD') e.pecera = 'AD';
  }
}
console.log(`[data-ajolotes] ejemplares: ${ejemplares.length}`);

// --- Historial -------------------------------------------------------------
const histRows = sheet('Historial medico');
const histHdrIdx = findHeaderRow(histRows, ['fecha', 'autor principal', 'alias']);
if (histHdrIdx < 0) throw new Error('Historial medico: header row not found');
const histHdr = histRows[histHdrIdx];
const H = {
  fecha:         indexOfHeader(histHdr, 'fecha'),
  autor:         indexOfHeader(histHdr, 'autor principal'),
  autor2:        indexOfHeader(histHdr, 'autor secundario'),
  alias:         indexOfHeader(histHdr, 'alias'),
  temp:          indexOfHeader(histHdr, 'temperatura'),
  peso:          indexOfHeader(histHdr, ['masa corporal', 'peso']),
  lt:            indexOfHeader(histHdr, 'longitud  total'),
  lhc:           indexOfHeader(histHdr, 'longitud  hocico'),
  largoCabeza:   indexOfHeader(histHdr, 'largo  cabeza'),
  anchoCabeza:   indexOfHeader(histHdr, 'ancho cabeza'),
  interaxial:    indexOfHeader(histHdr, 'distancia  interaxial'),
  anchoCuerpo:   indexOfHeader(histHdr, 'ancho cuerpo'),
  tibia:         indexOfHeader(histHdr, 'tibia'),
  femur:         indexOfHeader(histHdr, 'femur'),
  antebrazo:     indexOfHeader(histHdr, 'antebrazo'),
  brazo:         indexOfHeader(histHdr, 'l. brazo'),
  branqIzq:      indexOfHeader(histHdr, 'branquias  izquierda'),
  branqDer:      indexOfHeader(histHdr, 'branquias  derecha'),
  cabeza:        indexOfHeader(histHdr, 'revisión  cabeza'),
  cuerpo:        indexOfHeader(histHdr, 'revisión  cuerpo'),
  extremidades:  indexOfHeader(histHdr, 'revisión  extremidades'),
  cola:          indexOfHeader(histHdr, 'revisión  cola'),
  comportamiento: indexOfHeader(histHdr, 'comportamiento'),
  bcs:           indexOfHeader(histHdr, 'condición  corporal'),
  categoria:     indexOfHeader(histHdr, 'categoría'),
  subcategoria:  indexOfHeader(histHdr, 'subcategoría'),
  tipo:          indexOfHeader(histHdr, 'tipo  específico'),
  justificacion: indexOfHeader(histHdr, 'justificación'),
  notas:         indexOfHeader(histHdr, 'notas'),
};

const historial = {};
let histSkipped = 0;
const histUnknownAliases = new Set();
for (let r = histHdrIdx + 1; r < histRows.length; r++) {
  const row = histRows[r];
  if (!row || row.every((c) => c == null || c === '')) continue;
  const alias = normalizeAlias(toStr(row[H.alias]));
  const fecha = toIsoDate(row[H.fecha]);
  if (!alias || !fecha) { histSkipped++; continue; }
  if (!knownAliases.has(alias) && !histUnknownAliases.has(alias)) {
    histUnknownAliases.add(alias);
  }
  const entry = {
    fecha,
    autor: toStr(row[H.autor]),
    autor2: toStr(row[H.autor2]),
    temp: toNum(row[H.temp]),
    peso: toNum(row[H.peso]),
    lt: toNum(row[H.lt]),
    lhc: toNum(row[H.lhc]),
    largoCabeza: toNum(row[H.largoCabeza]),
    anchoCabeza: toNum(row[H.anchoCabeza]),
    interaxial: toNum(row[H.interaxial]),
    anchoCuerpo: toNum(row[H.anchoCuerpo]),
    tibia: toNum(row[H.tibia]),
    femur: toNum(row[H.femur]),
    antebrazo: toNum(row[H.antebrazo]),
    brazo: toNum(row[H.brazo]),
    branqIzq: toNum(row[H.branqIzq]),
    branqDer: toNum(row[H.branqDer]),
    cabeza: toStr(row[H.cabeza]),
    cuerpo: toStr(row[H.cuerpo]),
    extremidades: toStr(row[H.extremidades]),
    cola: toStr(row[H.cola]),
    comportamiento: toStr(row[H.comportamiento]),
    bcs: toNumOrText(row[H.bcs]),
    categoria: toStr(row[H.categoria]),
    subcategoria: toStr(row[H.subcategoria]),
    tipo: toStr(row[H.tipo]),
    justificacion: toStr(row[H.justificacion]),
    notas: toStr(row[H.notas]),
  };
  (historial[alias] ??= []).push(entry);
}
for (const arr of Object.values(historial)) arr.sort((a, b) => a.fecha.localeCompare(b.fecha));
const histTotal = Object.values(historial).reduce((n, arr) => n + arr.length, 0);
console.log(`[data-ajolotes] historial: ${histTotal} entries across ${Object.keys(historial).length} aliases`);
if (histSkipped) console.warn(`[data-ajolotes]   skipped ${histSkipped} historial rows (missing alias or fecha)`);
if (histUnknownAliases.size) {
  console.warn(`[data-ajolotes]   historial aliases not in Dashboard: ${[...histUnknownAliases].join(', ')}`);
}

// --- Planes ----------------------------------------------------------------
const planRows = sheet('Plan de alimentación');
const planHdrIdx = findHeaderRow(planRows, ['alias', 'frecuencia']);
if (planHdrIdx < 0) throw new Error('Plan de alimentación: header row not found');
const planHdr = planRows[planHdrIdx];
const P = {
  alias:      indexOfHeader(planHdr, 'alias'),
  pecera:     indexOfHeader(planHdr, 'pecera'),
  especie:    indexOfHeader(planHdr, 'especie'),
  estadio:    indexOfHeader(planHdr, 'estadio'),
  dietaBase:  indexOfHeader(planHdr, 'dieta base'),
  planB:      indexOfHeader(planHdr, 'plan b'),
  porcion:    indexOfHeader(planHdr, 'porción'),
  frecuencia: indexOfHeader(planHdr, 'frecuencia'),
  notas:      indexOfHeader(planHdr, 'notas'),
};

const planes = {};
let planUnknown = 0;
for (let r = planHdrIdx + 1; r < planRows.length; r++) {
  const row = planRows[r];
  if (!row || row.every((c) => c == null || c === '')) continue;
  const alias = normalizeAlias(toStr(row[P.alias]));
  if (!alias) continue;
  if (!knownAliases.has(alias)) planUnknown++;
  planes[alias] = {
    pecera: toStr(row[P.pecera]),
    especie: toStr(row[P.especie]),
    estadio: toStr(row[P.estadio]),
    dietaBase: toStr(row[P.dietaBase]),
    planB: toStr(row[P.planB]),
    porcion: toStr(row[P.porcion]),
    frecuencia: toStr(row[P.frecuencia]),
    notas: toStr(row[P.notas]),
  };
}
console.log(`[data-ajolotes] planes: ${Object.keys(planes).length}`);
if (planUnknown) console.warn(`[data-ajolotes]   ${planUnknown} plan rows for aliases not in Dashboard`);

// --- Alimentación ----------------------------------------------------------
const alimRows = sheet('Alimentación 2.0');
const alimHdrIdx = findHeaderRow(alimRows, ['fecha', 'alias', 'racion']);
if (alimHdrIdx < 0) throw new Error('Alimentación 2.0: header row not found');
const alimHdr = alimRows[alimHdrIdx];
// Alimentación 2.0 column B header has been observed to corrupt away from
// 'Hora' (e.g. '\]_Ñ¨P?0'); fall back to position 1 so a single corrupted
// header cell does not drop the time column.
const A = {
  fecha:     indexOfHeader(alimHdr, 'fecha'),
  hora:      (() => {
    const i = indexOfHeader(alimHdr, 'hora');
    return i >= 0 ? i : 1;
  })(),
  autor:     indexOfHeader(alimHdr, 'autor principal'),
  alias:     indexOfHeader(alimHdr, 'alias'),
  tipo:      indexOfHeader(alimHdr, 'tipo de alimento'),
  racion:    indexOfHeader(alimHdr, 'racion'),
  sobrante:  indexOfHeader(alimHdr, 'sobrante'),
  consumo:   indexOfHeader(alimHdr, 'consumo'),
  respuesta: indexOfHeader(alimHdr, 'respuesta'),
};

const alimentacion = {};
let alimSkipped = 0;
const alimUnknownAliases = new Set();
for (let r = alimHdrIdx + 1; r < alimRows.length; r++) {
  const row = alimRows[r];
  if (!row || row.every((c) => c == null || c === '')) continue;
  const rawAlias = toStr(row[A.alias]);
  // Combo entries (e.g. 'Tamal de dulce, Tascalate') stay as a single key but
  // each component is normalized so the join with ejemplares still resolves.
  const alias = rawAlias
    ? rawAlias.split(',').map((s) => normalizeAlias(s.trim())).join(', ')
    : rawAlias;
  const fecha = toIsoDate(row[A.fecha]);
  if (!alias || !fecha) { alimSkipped++; continue; }
  if (!knownAliases.has(alias)) alimUnknownAliases.add(alias);
  const entry = {
    fecha,
    hora: toTimeFraction(row[A.hora]),
    autor: toStr(row[A.autor]),
    tipo: toStr(row[A.tipo]),
    racion: toNum(row[A.racion]),
    sobrante: toNum(row[A.sobrante]),
    consumo: toNum(row[A.consumo]),
    respuesta: toStr(row[A.respuesta]),
  };
  (alimentacion[alias] ??= []).push(entry);
}
for (const arr of Object.values(alimentacion)) arr.sort((a, b) => a.fecha.localeCompare(b.fecha));
const alimTotal = Object.values(alimentacion).reduce((n, arr) => n + arr.length, 0);
console.log(`[data-ajolotes] alimentacion: ${alimTotal} entries across ${Object.keys(alimentacion).length} aliases`);
if (alimSkipped) console.warn(`[data-ajolotes]   skipped ${alimSkipped} alimentacion rows (missing alias or fecha)`);
if (alimUnknownAliases.size) {
  console.warn(`[data-ajolotes]   alimentacion aliases not in Dashboard: ${[...alimUnknownAliases].join(', ')}`);
}

// --- Bajas -----------------------------------------------------------------
const bajaRows = sheet('Bajas');
const bajaHdrIdx = findHeaderRow(bajaRows, ['fecha', 'nombre', 'causa']);
if (bajaHdrIdx < 0) throw new Error('Bajas: header row not found');
const bajaHdr = bajaRows[bajaHdrIdx];
const B = {
  fecha:     indexOfHeader(bajaHdr, 'fecha'),
  nombre:    indexOfHeader(bajaHdr, 'nombre'),
  peso:      indexOfHeader(bajaHdr, 'peso'),
  longitud:  indexOfHeader(bajaHdr, 'longitud'),
  edad:      indexOfHeader(bajaHdr, 'edad'),
  causa:     indexOfHeader(bajaHdr, 'causa'),
  necropcia: indexOfHeader(bajaHdr, 'necropcia'),
};

const bajas = [];
for (let r = bajaHdrIdx + 1; r < bajaRows.length; r++) {
  const row = bajaRows[r];
  if (!row || row.every((c) => c == null || c === '')) continue;
  const nombre = normalizeAlias(toStr(row[B.nombre]));
  if (!nombre) continue;
  bajas.push({
    fecha: toIsoDate(row[B.fecha]),
    nombre,
    peso: toNumOrText(row[B.peso]),
    longitud: toNumOrText(row[B.longitud]),
    edad: toStr(row[B.edad]),
    causa: toStr(row[B.causa]),
    necropcia: toStr(row[B.necropcia]),
  });
}
// Null-fecha rows sort to the end so the timeline starts with the earliest
// confirmed date.
bajas.sort((a, b) => {
  if (a.fecha == null && b.fecha == null) return 0;
  if (a.fecha == null) return 1;
  if (b.fecha == null) return -1;
  return a.fecha.localeCompare(b.fecha);
});
console.log(`[data-ajolotes] bajas: ${bajas.length}`);

// --- Terapéutica y Hospital ------------------------------------------------
// Sheet schema: Fecha | Hora | Autor Principal | Autor Secundario | Alias del
// Ejemplar | Ubicación | Diagnóstico/Motivo | Pruebas de Laboratorio |
// Tratamiento | Dosis | Vía de Administración | Día de Tratamiento (date, not
// number) | Observaciones del Paciente | Estado del Caso. ENS suffixes on
// authors are stripped at render-time (matches Historial behavior).
const teraRows = sheet('Terapéutica y Hospital');
const teraHdrIdx = findHeaderRow(teraRows, ['fecha', 'alias', 'diagnóstico']);
if (teraHdrIdx < 0) throw new Error('Terapéutica y Hospital: header row not found');
const teraHdr = teraRows[teraHdrIdx];
const T = {
  fecha:          indexOfHeader(teraHdr, 'fecha'),
  hora:           indexOfHeader(teraHdr, 'hora'),
  autor:          indexOfHeader(teraHdr, 'autor principal'),
  autor2:         indexOfHeader(teraHdr, 'autor secundario'),
  alias:          indexOfHeader(teraHdr, 'alias'),
  ubicacion:      indexOfHeader(teraHdr, 'ubicación'),
  diagnostico:    indexOfHeader(teraHdr, 'diagnóstico'),
  pruebasLab:     indexOfHeader(teraHdr, ['pruebas de laboratorio', 'pruebas de\nlaboratorio']),
  tratamiento:    indexOfHeader(teraHdr, 'tratamiento'),
  dosis:          indexOfHeader(teraHdr, 'dosis'),
  via:            indexOfHeader(teraHdr, ['vía de administración', 'vía de\nadministración']),
  diaTratamiento: indexOfHeader(teraHdr, ['día de tratamiento', 'día de\ntratamiento']),
  observaciones:  indexOfHeader(teraHdr, ['observaciones del paciente', 'observaciones\ndel paciente']),
  estado:         indexOfHeader(teraHdr, ['estado del caso', 'estado del\ncaso']),
};

const terapeutica = {};
let teraSkipped = 0;
const teraUnknownAliases = new Set();
for (let r = teraHdrIdx + 1; r < teraRows.length; r++) {
  const row = teraRows[r];
  if (!row || row.every((c) => c == null || c === '')) continue;
  const alias = normalizeAlias(toStr(row[T.alias]));
  const fecha = toIsoDate(row[T.fecha]);
  if (!alias || !fecha) { teraSkipped++; continue; }
  if (!knownAliases.has(alias)) teraUnknownAliases.add(alias);
  const entry = {
    fecha,
    hora: toTimeFraction(row[T.hora]),
    autor: toStr(row[T.autor]),
    autor2: toStr(row[T.autor2]),
    ubicacion: toStr(row[T.ubicacion]),
    diagnostico: toStr(row[T.diagnostico]),
    pruebasLab: toStr(row[T.pruebasLab]),
    tratamiento: toStr(row[T.tratamiento]),
    dosis: toStr(row[T.dosis]),
    via: toStr(row[T.via]),
    diaTratamiento: toIsoDate(row[T.diaTratamiento]) ?? toStr(row[T.diaTratamiento]),
    observaciones: toStr(row[T.observaciones]),
    estado: toStr(row[T.estado]),
  };
  (terapeutica[alias] ??= []).push(entry);
}
for (const arr of Object.values(terapeutica)) {
  arr.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
const teraTotal = Object.values(terapeutica).reduce((n, arr) => n + arr.length, 0);
console.log(`[data-ajolotes] terapeutica: ${teraTotal} entries across ${Object.keys(terapeutica).length} aliases`);
if (teraSkipped) console.warn(`[data-ajolotes]   skipped ${teraSkipped} terapeutica rows (missing alias or fecha)`);
if (teraUnknownAliases.size) {
  console.warn(`[data-ajolotes]   terapeutica aliases not in Dashboard: ${[...teraUnknownAliases].join(', ')}`);
}

// --- Write -----------------------------------------------------------------
const bundle = { ejemplares, planes, historial, terapeutica, alimentacion, bajas };
writeFileSync(join(OUT_DIR, 'bundle.json'), JSON.stringify(bundle, null, 2) + '\n');
console.log(`[data-ajolotes] wrote ${join(OUT_DIR, 'bundle.json')}`);
console.log('[data-ajolotes] Done.');
