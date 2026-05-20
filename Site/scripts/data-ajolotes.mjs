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

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(SITE_ROOT, '..');
const XLSX_PATH = resolve(REPO_ROOT, 'Context/Control operativo AxoloDAO.xlsx');

const OUT_DIR = resolve(SITE_ROOT, 'src/data/ajolotes');
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Helpers

function pad2(n) { return String(n).padStart(2, '0'); }

function toIsoDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  }
  // Already an ISO-ish string
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return null;
}

// Convert an Excel time cell (Date object on the 1899-12-30 epoch) into a 0..1
// time-of-day fraction, matching the format already in bundle.json.
function toTimeFraction(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    const epoch = Date.UTC(1899, 11, 30); // Excel's "zero" date
    const utcMs = Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate(),
                            v.getUTCHours(), v.getUTCMinutes(), v.getUTCSeconds());
    const dayMs = 24 * 60 * 60 * 1000;
    const frac = ((utcMs - epoch) % dayMs) / dayMs;
    if (!Number.isFinite(frac)) return null;
    // Treat midnight on the epoch (no real time) as null
    if (Math.abs(frac) < 1e-9 && v.getUTCFullYear() <= 1899) return null;
    return frac;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v - Math.floor(v); // numeric Excel time
  }
  const s = String(v).trim();
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m) {
    const h = Number(m[1]), mn = Number(m[2]), sc = Number(m[3] ?? 0);
    return (h * 3600 + mn * 60 + sc) / 86400;
  }
  return null;
}

function toNum(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || s === '-' || s === '—' || s.toUpperCase() === 'NA') return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Some columns (peso, longitud in Bajas; bcs in ejemplares/historial) accept
// either a number or a free-text marker like "NA" or "Sin datos".
function toNumOrText(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : s;
}

function toStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// Header row scanning: find the row index containing all of `markers`.
function findHeaderRow(rows, markers) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const cells = row.map((c) => (c ?? '').toString().toLowerCase());
    if (markers.every((m) => cells.some((c) => c.includes(m.toLowerCase())))) {
      return r;
    }
  }
  return -1;
}

function indexOfHeader(headerRow, needles) {
  const list = Array.isArray(needles) ? needles : [needles];
  const norm = (s) => (s ?? '').toString().toLowerCase().replace(/\s+/g, ' ').trim();
  for (const needle of list) {
    const n = norm(needle);
    const idx = headerRow.findIndex((h) => norm(h).includes(n));
    if (idx >= 0) return idx;
  }
  return -1;
}

// Alias normalization. The xlsx is the operational system of record but uses
// inconsistent spellings across sheets — Dashboard ejemplares has 'Negra',
// 'Chocorol', 'Romulo' while Plan / Alimentación / Historial use 'La negra',
// 'Chocoroll', 'Rómulo'. The Site (photo manifest, deep-link anchors, modal
// joins between sheets) expects a single canonical alias per specimen, so we
// fold the variants here. When curators want to retire a normalization,
// rename the source in the xlsx first, then drop the line below.
const ALIAS_NORMALIZE = new Map([
  ['Romulo', 'Rómulo'],
  ['romulo', 'Rómulo'],
  ['Chocorol', 'Chocoroll'],
  ['Negra', 'La negra'],
  ['mocca', 'Moka'],
]);
function normalizeAlias(s) {
  if (s == null) return s;
  const t = String(s).trim();
  if (!t) return t;
  return ALIAS_NORMALIZE.get(t) ?? t;
}

// Curator overrides for stale Dashboard ejemplares fields. The xlsx is the
// system of record but the dashboard column can lag the actual colony state
// (e.g. a specimen returned from cuarentena before the curator updated the
// sheet). Each override patches a single field after the xlsx is read so the
// next regen does not silently revert the live page. Drop an entry once the
// xlsx catches up.
const EJEMPLAR_OVERRIDES = new Map([
  // Chocoroll returned from cuarentena to AM 2.2 (curator confirmed
  // 2026-05-19); xlsx Dashboard + Bitacora still showing Cuarentena.
  ['Chocoroll', { pecera: 'AM 2.2' }],
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
const dashHdrIdx = findHeaderRow(dashRows, ['alias', 'pecera', 'especie']);
if (dashHdrIdx < 0) throw new Error('Dashboard ejemplares: header row not found');
const dashHdr = dashRows[dashHdrIdx];
const D = {
  alias:           indexOfHeader(dashHdr, 'alias'),
  id:              indexOfHeader(dashHdr, 'id de ejemplar'),
  pecera:          indexOfHeader(dashHdr, 'pecera actual'),
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
  });
}

// Apply curator overrides (see EJEMPLAR_OVERRIDES above) after the xlsx read.
for (const e of ejemplares) {
  const patch = EJEMPLAR_OVERRIDES.get(e.alias);
  if (patch) Object.assign(e, patch);
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

// --- Write -----------------------------------------------------------------
const bundle = { ejemplares, planes, historial, alimentacion, bajas };
writeFileSync(join(OUT_DIR, 'bundle.json'), JSON.stringify(bundle, null, 2) + '\n');
console.log(`[data-ajolotes] wrote ${join(OUT_DIR, 'bundle.json')}`);
console.log('[data-ajolotes] Done.');
