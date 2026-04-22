#!/usr/bin/env node
/**
 * data-water.mjs
 *
 * Reads Context/Control operativo AxoloDAO.xlsx (gitignored, maintained by the
 * Biomuseo Xolotlcalli team) and emits JSON for the water-quality dashboard:
 *
 *   Site/src/data/water-quality/tanks.json
 *   Site/src/data/water-quality/parameters.json
 *   Site/src/data/water-quality/measurements-mondays.json   (default view)
 *   Site/public/data/water-quality/measurements-all.json    (lazy-fetched)
 *
 * Run manually each Monday after the team updates the xlsx:
 *   npm run data:water
 */
import XLSX from 'xlsx';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(SITE_ROOT, '..');
const XLSX_PATH = resolve(REPO_ROOT, 'Context/Control operativo AxoloDAO.xlsx');

const CONTENT_OUT = resolve(SITE_ROOT, 'src/data/water-quality');
const PUBLIC_OUT  = resolve(SITE_ROOT, 'public/data/water-quality');
mkdirSync(CONTENT_OUT, { recursive: true });
mkdirSync(PUBLIC_OUT, { recursive: true });

// ---------------------------------------------------------------------------
// Domain maps

const PARAM_KEYS = ['temp','nh3','no2','no3','gh','kh','ph','po4','cond','tds'];

const PARAM_NAME_TO_KEY = {
  'temperatura': 'temp',
  'amonia': 'nh3',
  'amoniaco': 'nh3',
  'nh3': 'nh3',
  'nitritos': 'no2',
  'no2': 'no2',
  'nitratos': 'no3',
  'no3': 'no3',
  'gh': 'gh',
  'dureza general': 'gh',
  'dureza general gh': 'gh',
  'kh': 'kh',
  'dureza de carbonatos': 'kh',
  'dureza de carbonatos kh': 'kh',
  'ph': 'ph',
  'fosfatos': 'po4',
  'po4': 'po4',
  'conductividad': 'cond',
  'tds': 'tds',
};

const SPECIES_ACCENT = {
  andersoni: '#B87333',
  mexicanum: '#2C5F7C',
  dumerilii: '#3E6B4A',
  control:   '#4A3628',
  guppies:   '#4A3628',
  na:        '#4A3628',
};

const AD_UNIFICATION_NOTE = {
  es: 'Unificado desde inicios de 2026 (AD 1.1 + AD 1.2)',
  en: 'Unified since early 2026 (AD 1.1 + AD 1.2)',
  pt: 'Unificado desde o início de 2026 (AD 1.1 + AD 1.2)',
};

// Single source of truth for tank metadata. Subsystems (AD 1.x, AM 1.x, AM 2.x)
// are not listed as distinct tanks; the normalizer below collapses them into
// their parents.
const TANK_META = {
  'AA':      { speciesCode: 'andersoni', scientificName: 'Ambystoma andersoni', displayName: 'Pecera AA',   volumeL: 106, primary: true,  note: null },
  'AM 1':    { speciesCode: 'mexicanum', scientificName: 'Ambystoma mexicanum', displayName: 'Pecera AM 1', volumeL: 67,  primary: true,  note: null },
  'AM 2':    { speciesCode: 'mexicanum', scientificName: 'Ambystoma mexicanum', displayName: 'Pecera AM 2', volumeL: 67,  primary: true,  note: null },
  'AD':      { speciesCode: 'dumerilii', scientificName: 'Ambystoma dumerilii', displayName: 'Pecera AD',   volumeL: 252, primary: true,  note: AD_UNIFICATION_NOTE },
  'Llave':   { speciesCode: 'control',   scientificName: null,                   displayName: 'Control (Llave)', volumeL: null, primary: false, note: null },
  'Guppies': { speciesCode: 'guppies',   scientificName: null,                   displayName: 'Guppies',         volumeL: null, primary: false, note: null },
};

// Map "A.andersoni" / "A. mexicanum" etc. → species code
function speciesCodeFrom(label) {
  const s = (label ?? '').toString().toLowerCase().replace(/\s+/g, '');
  if (s.includes('andersoni')) return 'andersoni';
  if (s.includes('mexicanum')) return 'mexicanum';
  if (s.includes('dumerilii')) return 'dumerilii';
  return 'na';
}

// Collapse subsystem IDs into their logical parent tank.
// AD 1.1, AD 1.2, AD1.2, AD-1.1 → AD   (physically unified since early 2026)
// AM 1.1, AM 1.2               → AM 1  (subsystems feeding parent sump)
// AM 2.1, AM 2.2               → AM 2
function normalizeTankId(raw) {
  const s = (raw ?? '').toString().trim();
  if (!s) return null;
  const compact = s.replace(/\s+/g, ' ').toUpperCase();
  if (/^AD[\s-]*\d+\.\d+$/.test(compact) || compact === 'AD') return 'AD';
  if (/^AM[\s-]*1\.\d+$/.test(compact)) return 'AM 1';
  if (/^AM[\s-]*2\.\d+$/.test(compact)) return 'AM 2';
  // Canonical display casing for known parents
  if (compact === 'AM 1') return 'AM 1';
  if (compact === 'AM 2') return 'AM 2';
  if (compact === 'AA') return 'AA';
  if (compact === 'LLAVE') return 'Llave';
  if (compact === 'GUPPIES') return 'Guppies';
  return s; // unknown id; will be filtered downstream
}

function paramKeyFromName(raw) {
  const s = (raw ?? '').toString().trim().toLowerCase()
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ');
  if (PARAM_NAME_TO_KEY[s]) return PARAM_NAME_TO_KEY[s];
  for (const [needle, key] of Object.entries(PARAM_NAME_TO_KEY)) {
    if (s.includes(needle)) return key;
  }
  return null;
}

function paramKeyFromColumnHeader(raw) {
  const s = (raw ?? '').toString().toLowerCase()
    .replace(/^\s*\d+\.\s*/, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
  return paramKeyFromName(s);
}

function parseNumber(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim();
  if (!s || s === '-' || s === '—') return null;
  // "0.1-0.25" → midpoint 0.175
  const range = s.match(/^(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)$/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) return (a + b) / 2;
  }
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function toIsoDate(v) {
  if (v == null) return null;
  if (v instanceof Date) {
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  }
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return null;
}

function toTimeString(v) {
  if (v == null) return null;
  if (v instanceof Date) return `${pad2(v.getHours())}:${pad2(v.getMinutes())}`;
  const s = String(v).trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return s.slice(0, 5);
  return null;
}

function isMondayIso(iso) {
  if (!iso) return false;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() === 1;
}

function statusOf(value, min, max) {
  if (value == null) return 'ok';
  if (min != null && value < min * 0.9) return 'alarm';
  if (max != null && value > max * 1.1) return 'alarm';
  if (min != null && value < min) return 'warn';
  if (max != null && value > max) return 'warn';
  return 'ok';
}

// ---------------------------------------------------------------------------
// Main

if (!existsSync(XLSX_PATH)) {
  console.error(`[data-water] ERROR: xlsx not found at ${XLSX_PATH}`);
  console.error('[data-water] Place the file at Context/Control operativo AxoloDAO.xlsx and re-run.');
  process.exit(1);
}

console.log(`[data-water] Reading ${XLSX_PATH}`);
const wb = XLSX.readFile(XLSX_PATH, { cellDates: true });

// --- Tanks -----------------------------------------------------------------
const tanks = Object.entries(TANK_META).map(([id, meta]) => ({
  id,
  ...meta,
  accentColor: SPECIES_ACCENT[meta.speciesCode] ?? '#4A3628',
}));
writeFileSync(
  join(CONTENT_OUT, 'tanks.json'),
  JSON.stringify(tanks, null, 2) + '\n'
);
console.log(`[data-water] tanks.json: ${tanks.length} tanks`);

// --- Parameters (catalog) --------------------------------------------------
const catalogSheet = wb.Sheets['Catálogo de parámetros'];
if (!catalogSheet) throw new Error('Sheet "Catálogo de parámetros" not found');

const catalogRows = XLSX.utils.sheet_to_json(catalogSheet, { header: 1, defval: null, raw: true, blankrows: false });
// Row 0 is the title; row 1 is headers; data starts at row 2.
const headerRow = catalogRows[1] ?? [];
const idxOf = (needle) => headerRow.findIndex(h => (h ?? '').toString().toLowerCase().includes(needle));
const IDX = {
  tankId:  idxOf('id-sistemas'),
  species: idxOf('especie'),
  param:   idxOf('parámetro'),
  unit:    idxOf('unidad'),
  min:     idxOf('mínimo'),
  max:     idxOf('máximo'),
  target:  idxOf('objetivo'),
};

// The catalog lists some entries under subsystem IDs (e.g. AM 1, AM 2 are
// already canonical). We normalize to the same logical tank space as
// measurements so the lookup keys match.
const parameters = [];
const seenCatalogKey = new Set();
for (let r = 2; r < catalogRows.length; r++) {
  const row = catalogRows[r];
  if (!row || row.every(c => c == null || c === '')) continue;
  const rawId = (row[IDX.tankId] ?? '').toString().trim();
  if (!rawId) continue;
  const tankId = normalizeTankId(rawId);
  if (!tankId || !TANK_META[tankId]) continue;
  const paramKey = paramKeyFromName(row[IDX.param]);
  if (!paramKey) {
    console.warn(`[data-water] catalog: skipping unknown parameter "${row[IDX.param]}" on row ${r + 1}`);
    continue;
  }
  const key = `${tankId}|${paramKey}`;
  if (seenCatalogKey.has(key)) continue;
  seenCatalogKey.add(key);
  parameters.push({
    tankId,
    speciesCode: speciesCodeFrom(row[IDX.species]),
    key: paramKey,
    unit: (row[IDX.unit] ?? '').toString().trim(),
    min: parseNumber(row[IDX.min]),
    max: parseNumber(row[IDX.max]),
    target: parseNumber(row[IDX.target]),
  });
}
writeFileSync(
  join(CONTENT_OUT, 'parameters.json'),
  JSON.stringify(parameters, null, 2) + '\n'
);
console.log(`[data-water] parameters.json: ${parameters.length} catalog entries`);

const catalogLookup = new Map();
for (const p of parameters) catalogLookup.set(`${p.tankId}|${p.key}`, { min: p.min, max: p.max });

// --- Measurements (Calidad de agua) ----------------------------------------
const measSheet = wb.Sheets['Calidad de agua'];
if (!measSheet) throw new Error('Sheet "Calidad de agua" not found');

const measRowsRaw = XLSX.utils.sheet_to_json(measSheet, { header: 1, defval: null, raw: true, blankrows: false });
const measHeader = measRowsRaw[0] ?? [];
const colToParam = new Map();
measHeader.forEach((h, i) => {
  const k = paramKeyFromColumnHeader(h);
  if (k) colToParam.set(i, k);
});
const IDX_M = {
  fecha:    measHeader.findIndex(h => (h ?? '').toString().toLowerCase() === 'fecha'),
  hora:     measHeader.findIndex(h => (h ?? '').toString().toLowerCase() === 'hora'),
  author1:  measHeader.findIndex(h => (h ?? '').toString().toLowerCase().includes('autor principal')),
  author2:  measHeader.findIndex(h => (h ?? '').toString().toLowerCase().includes('autor secundario')),
  pecera:   measHeader.findIndex(h => (h ?? '').toString().toLowerCase() === 'pecera'),
  noteCol:  measHeader.findIndex(h => (h ?? '').toString().toLowerCase().trim() === 'nota'),
};

const allMeasurements = [];
let skippedNoDate = 0;
let skippedUnknownTank = 0;
const unknownTankSamples = new Set();

for (let r = 1; r < measRowsRaw.length; r++) {
  const row = measRowsRaw[r];
  if (!row) continue;

  const rawTank = (row[IDX_M.pecera] ?? '').toString().trim();
  if (!rawTank) continue;
  const tankId = normalizeTankId(rawTank);
  if (!tankId || !TANK_META[tankId]) {
    skippedUnknownTank++;
    if (unknownTankSamples.size < 10) unknownTankSamples.add(rawTank);
    continue;
  }

  const iso = toIsoDate(row[IDX_M.fecha]);
  if (!iso) { skippedNoDate++; continue; }

  const values = Object.fromEntries(PARAM_KEYS.map(k => [k, null]));
  for (const [colIdx, paramKey] of colToParam) {
    values[paramKey] = parseNumber(row[colIdx]);
  }
  if (PARAM_KEYS.every(k => values[k] == null)) continue;

  const alarms = [];
  for (const k of PARAM_KEYS) {
    const cat = catalogLookup.get(`${tankId}|${k}`);
    if (!cat) continue;
    const s = statusOf(values[k], cat.min, cat.max);
    if (s !== 'ok') alarms.push(k);
  }

  allMeasurements.push({
    date: iso,
    time: toTimeString(row[IDX_M.hora]),
    tankId,
    isMonday: isMondayIso(iso),
    authors: {
      main: (row[IDX_M.author1] ?? null) || null,
      secondary: (row[IDX_M.author2] ?? null) || null,
    },
    values,
    alarms,
    note: (row[IDX_M.noteCol] != null ? String(row[IDX_M.noteCol]) : null),
  });
}

allMeasurements.sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));

const mondays = allMeasurements.filter(m => m.isMonday);

writeFileSync(
  join(CONTENT_OUT, 'measurements-mondays.json'),
  JSON.stringify(mondays, null, 2) + '\n'
);
writeFileSync(
  join(PUBLIC_OUT, 'measurements-all.json'),
  JSON.stringify(allMeasurements) + '\n'
);

console.log(`[data-water] measurements-mondays.json: ${mondays.length} rows`);
console.log(`[data-water] measurements-all.json: ${allMeasurements.length} rows`);
if (skippedNoDate) console.warn(`[data-water] skipped ${skippedNoDate} rows (no date)`);
if (skippedUnknownTank) {
  console.warn(`[data-water] skipped ${skippedUnknownTank} rows (unknown tank id). Samples: ${[...unknownTankSamples].join(', ')}`);
}

const byTank = new Map();
for (const m of mondays) byTank.set(m.tankId, (byTank.get(m.tankId) ?? 0) + 1);
console.log('[data-water] Monday counts by tank:');
for (const [t, n] of [...byTank.entries()].sort()) console.log(`    ${t.padEnd(8)} ${n}`);
console.log('[data-water] Done.');
