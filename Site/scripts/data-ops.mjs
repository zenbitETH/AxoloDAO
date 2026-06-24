#!/usr/bin/env node
/**
 * data-ops.mjs
 *
 * Reads operational sheets from the operations workbook (path from the AXOLODAO_XLSX env var) that
 * are NOT tied to a single specimen or tank schema:
 *
 *   - Bitacora                  → site/src/data/ops/bitacora-recent.json (last 90 days)
 *                                 site/public/data/ops/bitacora.json     (full history, lazy-fetched)
 *   - Calendario de actividades → site/src/data/ops/personnel.json {actividades[]}
 *   - Rol de turnos             → site/src/data/ops/personnel.json {turnos[]}
 *
 * Bitácora rows can carry both an `Alias` (per-ejemplar event) and a
 * `Ubicación` (per-tank/system event); the modal and the xolotlcalli water
 * page filter the same array by different keys.
 *
 * Run manually each Monday after the team updates the xlsx:
 *   npm run data:ops
 */
import XLSX from 'xlsx';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  toIsoDate,
  toTimeString,
  toTimeFraction,
  toNum,
  toStr,
  findHeaderRow,
  indexOfHeader,
  normalizeAlias,
  pad2,
  resolveXlsxPath,
} from './lib/xlsx-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const XLSX_PATH = resolveXlsxPath();

const CONTENT_OUT = resolve(SITE_ROOT, 'src/data/ops');
const PUBLIC_OUT  = resolve(SITE_ROOT, 'public/data/ops');
mkdirSync(CONTENT_OUT, { recursive: true });
mkdirSync(PUBLIC_OUT, { recursive: true });

// Convert an Excel time fraction (0..1) or a Date back to a HH:MM string.
// Bitácora and turnos use date-as-time cells (epoch 1899-12-30 + hours);
// modal/UI rendering wants a readable "14:30" rather than 0.6042.
function fractionToHHMM(frac) {
  if (frac == null || !Number.isFinite(frac)) return null;
  const totalSec = Math.round(frac * 86400);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${pad2(h)}:${pad2(m)}`;
}
function toHHMM(v) {
  // Prefer direct HH:MM strings if the cell is already text
  const s = toTimeString(v);
  if (s) return s;
  const frac = toTimeFraction(v);
  return fractionToHHMM(frac);
}

if (!existsSync(XLSX_PATH)) {
  console.error(`[data-ops] ERROR: xlsx not found at ${XLSX_PATH}`);
  process.exit(1);
}

console.log(`[data-ops] Reading ${XLSX_PATH}`);
const wb = XLSX.readFile(XLSX_PATH, { cellDates: true });

function sheet(name) {
  const sh = wb.Sheets[name];
  if (!sh) throw new Error(`Sheet "${name}" not found`);
  return XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true, blankrows: false });
}

// --- Bitacora --------------------------------------------------------------
const bitRows = sheet('Bitacora');
const bitHdrIdx = findHeaderRow(bitRows, ['fecha', 'categoría del evento', 'alias']);
if (bitHdrIdx < 0) throw new Error('Bitacora: header row not found');
const bitHdr = bitRows[bitHdrIdx];
const B = {
  fecha:           indexOfHeader(bitHdr, 'fecha'),
  hora:            indexOfHeader(bitHdr, 'hora'),
  estado:          indexOfHeader(bitHdr, ['estado del caso', 'estado del\ncaso']),
  autorPrincipal:  indexOfHeader(bitHdr, 'autor principal'),
  autorSecundario: indexOfHeader(bitHdr, 'autor secundario'),
  categoria:       indexOfHeader(bitHdr, 'categoría del evento'),
  alias:           indexOfHeader(bitHdr, 'alias'),
  ubicacion:       indexOfHeader(bitHdr, 'ubicación'),
  incidencia:      indexOfHeader(bitHdr, 'incidencia'),
  accion:          indexOfHeader(bitHdr, 'acción'),
  notas:           indexOfHeader(bitHdr, 'notas'),
  linkReporte:     indexOfHeader(bitHdr, 'link'),
};

const bitacora = [];
let bitSkipped = 0;
for (let r = bitHdrIdx + 1; r < bitRows.length; r++) {
  const row = bitRows[r];
  if (!row || row.every((c) => c == null || c === '')) continue;
  const fecha = toIsoDate(row[B.fecha]);
  if (!fecha) { bitSkipped++; continue; }
  // Bitácora rows can list multiple aliases comma-separated ("Remo, Romulo");
  // split, normalize each component, rejoin so consumer-side `alias.split(', ')
  // .includes(name)` resolves both names regardless of casing/accents.
  const rawAlias = toStr(row[B.alias]);
  const alias = rawAlias
    ? rawAlias.split(',').map((s) => normalizeAlias(s.trim())).filter(Boolean).join(', ')
    : null;
  bitacora.push({
    fecha,
    hora: toHHMM(row[B.hora]),
    estado: toStr(row[B.estado]),
    autorPrincipal: toStr(row[B.autorPrincipal]),
    autorSecundario: toStr(row[B.autorSecundario]),
    categoria: toStr(row[B.categoria]),
    alias,
    ubicacion: toStr(row[B.ubicacion]),
    incidencia: toStr(row[B.incidencia]),
    accion: toStr(row[B.accion]),
    notas: toStr(row[B.notas]),
    linkReporte: toStr(row[B.linkReporte]),
  });
}

// --- Bitacora de mantenimiento de agua -------------------------------------
// Dedicated water-maintenance log (water changes, solution prep, garrafón
// fills, filter top-ups). Merged into the same bitácora feed as the main sheet
// so it surfaces (a) on the water charts via cambiosDeAguaByTank — which keys
// off `accion` ~ /cambio de agua/i — and (b) in each tank's "Eventos del
// sistema" panel, whose filter admits any row with a category matching
// /mantenimiento/. Excel truncates the sheet name to 31 chars.
const MAINT_SHEET = 'Bitacora de mantenimiento de ag';

// Map the maintenance `Ubicación` to a canonical tank token so the merged
// events match the chart/timeline tank filters. Recipe-prefixed locations
// ("Holtfreter AA") fold to their tank; "AM larvas" stays in the AM family;
// specimen-level / pantry rows (Romulo, Golden, garrafón fills) pass through.
function normalizeMaintUbicacion(raw) {
  if (!raw) return null;
  const up = raw.trim().toUpperCase();
  if (/AM\s*LARVAS/.test(up)) return 'AM larvas';
  if (/\bAA\b/.test(up)) return 'AA';
  if (/\bAD\b/.test(up)) return 'AD';
  if (/\bAM\b/.test(up)) return 'AM';
  return raw.trim();
}

let maintCount = 0;
let maintSkipped = 0;
if (wb.Sheets[MAINT_SHEET]) {
  const mRows = sheet(MAINT_SHEET);
  const mHdrIdx = findHeaderRow(mRows, ['fecha', 'evento']);
  if (mHdrIdx < 0) throw new Error(`${MAINT_SHEET}: header row not found`);
  const mHdr = mRows[mHdrIdx];
  const M = {
    fecha:    indexOfHeader(mHdr, 'fecha'),
    hora:     indexOfHeader(mHdr, 'hora'),
    autor:    indexOfHeader(mHdr, 'autor principal'),
    autor2:   indexOfHeader(mHdr, 'autor secundario'),
    evento:   indexOfHeader(mHdr, 'evento'),
    ubic:     indexOfHeader(mHdr, 'ubicación'),
    cantidad: indexOfHeader(mHdr, 'cantidad'),
    solucion: indexOfHeader(mHdr, 'solución'),
    notas:    indexOfHeader(mHdr, 'notas'),
  };
  for (let r = mHdrIdx + 1; r < mRows.length; r++) {
    const row = mRows[r];
    if (!row || row.every((c) => c == null || c === '')) continue;
    const fecha = toIsoDate(row[M.fecha]);
    if (!fecha) { maintSkipped++; continue; }
    const evento = toStr(row[M.evento]);
    const cantidad = toNum(row[M.cantidad]);
    const solucion = toStr(row[M.solucion]);
    // Keep the event word ("Cambio de agua") at the front of `accion` so the
    // chart's cambiosDeAguaByTank picks real water changes up automatically.
    const accion = [evento, cantidad != null ? `${cantidad} L` : null, solucion]
      .filter(Boolean)
      .join(' · ');
    bitacora.push({
      fecha,
      hora: toHHMM(row[M.hora]),
      estado: null,
      autorPrincipal: toStr(row[M.autor]),
      autorSecundario: toStr(row[M.autor2]),
      categoria: 'Mantenimiento de agua',
      alias: null,
      ubicacion: normalizeMaintUbicacion(toStr(row[M.ubic])),
      incidencia: evento,
      accion: accion || null,
      notas: toStr(row[M.notas]),
      linkReporte: null,
    });
    maintCount++;
  }
}

bitacora.sort((a, b) => (a.fecha + (a.hora ?? '')).localeCompare(b.fecha + (b.hora ?? '')));

// 90-day window for the eagerly-imported recent file. Uses the most-recent
// event date as the reference (more robust than `new Date()` when the xlsx is
// a day or two behind the calendar — keeps the window stable across reruns).
const latestIso = bitacora.length ? bitacora[bitacora.length - 1].fecha : null;
let bitacoraRecent = bitacora;
if (latestIso) {
  const [y, m, d] = latestIso.split('-').map(Number);
  const ref = new Date(y, m - 1, d);
  const cutoff = new Date(ref);
  cutoff.setDate(cutoff.getDate() - 90);
  const cutIso = `${cutoff.getFullYear()}-${pad2(cutoff.getMonth() + 1)}-${pad2(cutoff.getDate())}`;
  bitacoraRecent = bitacora.filter((e) => e.fecha >= cutIso);
}

writeFileSync(
  join(PUBLIC_OUT, 'bitacora.json'),
  JSON.stringify(bitacora) + '\n',
);
writeFileSync(
  join(CONTENT_OUT, 'bitacora-recent.json'),
  JSON.stringify(bitacoraRecent, null, 2) + '\n',
);
console.log(`[data-ops] bitacora.json: ${bitacora.length} events (full history)`);
console.log(`[data-ops] bitacora-recent.json: ${bitacoraRecent.length} events (90-day window ending ${latestIso})`);
console.log(`[data-ops]   includes ${maintCount} water-maintenance events (Mantenimiento de agua)`);
if (bitSkipped) console.warn(`[data-ops]   skipped ${bitSkipped} bitacora rows (missing fecha)`);
if (maintSkipped) console.warn(`[data-ops]   skipped ${maintSkipped} water-maintenance rows (missing fecha)`);

// --- Calendario de actividades --------------------------------------------
// The sheet uses section header rows (e.g. "Turno matutino (Apertura)") whose
// only populated cell is column 0. We forward-track the current section so
// each activity carries its turno context for the personnel doc.
const calRows = sheet('Calendario de actividades');
const calHdrIdx = findHeaderRow(calRows, ['orden', 'actividad', 'puntaje']);
if (calHdrIdx < 0) throw new Error('Calendario de actividades: header row not found');
const calHdr = calRows[calHdrIdx];
const C = {
  orden:        indexOfHeader(calHdr, 'orden'),
  actividad:    indexOfHeader(calHdr, 'actividad'),
  puntaje:      indexOfHeader(calHdr, 'puntaje'),
  registro:     indexOfHeader(calHdr, ['pestaña de registro', 'pestana de registro']),
  responsable:  indexOfHeader(calHdr, 'responsable'),
  modalidad:    indexOfHeader(calHdr, 'modalidad'),
  notas:        indexOfHeader(calHdr, 'notas'),
};

const actividades = [];
let currentSeccion = null;
for (let r = calHdrIdx + 1; r < calRows.length; r++) {
  const row = calRows[r];
  if (!row || row.every((c) => c == null || c === '')) continue;
  const orden = row[C.orden];
  const actividad = toStr(row[C.actividad]);
  // Section header rows have a string in col 0 and nothing else
  const onlyCol0 = row.slice(1).every((c) => c == null || c === '');
  if (onlyCol0 && typeof orden === 'string') {
    currentSeccion = orden.trim();
    continue;
  }
  if (!actividad && typeof orden !== 'number') continue;
  actividades.push({
    seccion: currentSeccion,
    orden: typeof orden === 'number' ? orden : null,
    actividad: actividad ? actividad.replace(/\s*\n\s*/g, ' ').trim() : null,
    puntaje: toStr(row[C.puntaje]),
    registro: toStr(row[C.registro]),
    responsable: toStr(row[C.responsable]),
    modalidad: toStr(row[C.modalidad]),
    notas: toStr(row[C.notas]),
  });
}

// --- Rol de turnos ---------------------------------------------------------
// `Dia` is sticky: populated on the first row of each weekday block and null
// for subsequent rows that share the same day. Forward-fill so every entry
// carries its day.
const turRows = sheet('Rol de turnos');
const turHdrIdx = findHeaderRow(turRows, ['dia', 'nombre', 'turno']);
if (turHdrIdx < 0) throw new Error('Rol de turnos: header row not found');
const turHdr = turRows[turHdrIdx];
const R = {
  dia:          indexOfHeader(turHdr, 'dia'),
  nombre:       indexOfHeader(turHdr, 'nombre'),
  turno:        indexOfHeader(turHdr, ['turno asignado', 'turno\nasignado']),
  modalidad:    indexOfHeader(turHdr, 'modalidad'),
  horaEntrada:  indexOfHeader(turHdr, ['hora de entrada', 'hora de\nentrada']),
  horaSalida:   indexOfHeader(turHdr, ['hora de salida', 'hora de\nsalida']),
  totalHoras:   indexOfHeader(turHdr, ['total de horas', 'total de\nhoras']),
};

const turnos = [];
let stickyDia = null;
for (let r = turHdrIdx + 1; r < turRows.length; r++) {
  const row = turRows[r];
  if (!row || row.every((c) => c == null || c === '')) continue;
  const dia = toStr(row[R.dia]);
  if (dia) stickyDia = dia;
  const nombre = toStr(row[R.nombre]);
  if (!nombre) continue;
  turnos.push({
    dia: stickyDia,
    nombre,
    turno: toStr(row[R.turno]),
    modalidad: toStr(row[R.modalidad]),
    horaEntrada: toHHMM(row[R.horaEntrada]),
    horaSalida: toHHMM(row[R.horaSalida]),
    totalHoras: toNum(row[R.totalHoras]),
  });
}

writeFileSync(
  join(CONTENT_OUT, 'personnel.json'),
  JSON.stringify({ actividades, turnos }, null, 2) + '\n',
);
console.log(`[data-ops] personnel.json: ${actividades.length} actividades, ${turnos.length} turnos`);
console.log('[data-ops] Done.');
