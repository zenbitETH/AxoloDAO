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
import {
  toIsoDate,
  toTimeString,
  parseNumber,
  findHeaderRow,
  indexOfHeader,
} from './lib/xlsx-utils.mjs';

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

// Vanilla light-theme palette. The site applies a brighter dark-mode variant
// via accentForTheme() on the client; the value stored here is the canonical
// light-theme color and what downstream consumers (e.g. carousel) read.
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

// AM 1 + AM 2 were physically unified into a single recirculating system on
// 2026-04-28. Pre-cutoff readings keep the AM 1 / AM 2 distinction; from this
// date onward the Excel writes a single 'AM' row per measurement.
const AM_UNIFICATION = '2026-04-28';
const AM_UNIFICATION_NOTE = {
  es: 'Unificado desde 2026-04-28 (5 acuarios × 72 L)',
  en: 'Unified since 2026-04-28 (5 sub-aquariums × 72 L)',
  pt: 'Unificado desde 2026-04-28 (5 sub-aquários × 72 L)',
};

// AM Larvas is the A. mexicanum larvae aquarium. The curators began logging its
// water quality in 2026-W24 but it has no rows of its own in the catalog/systems
// sheets, so it inherits the unified AM thresholds (same species) — see the
// AM → AM Larvas catalog mirror below. Volume is unset until the team adds it.
const AM_LARVAS_NOTE = {
  es: 'Acuario de larvas de A. mexicanum; umbrales compartidos con AM',
  en: 'A. mexicanum larvae aquarium; thresholds shared with AM',
  pt: 'Aquário de larvas de A. mexicanum; limiares compartilhados com AM',
};

// Single source of truth for tank metadata. Subsystems (AD 1.x, AM 1.x, AM 2.x)
// are not listed as distinct tanks; the normalizer below collapses them into
// their parents. AM 1 / AM 2 remain primary so their pre-cutoff history can
// still render side-by-side in the dashboard.
const TANK_META = {
  'AA':      { speciesCode: 'andersoni', scientificName: 'Ambystoma andersoni', displayName: 'Pecera AA',   volumeL: 106, primary: true,  note: null },
  'AM 1':    { speciesCode: 'mexicanum', scientificName: 'Ambystoma mexicanum', displayName: 'Pecera AM 1', volumeL: 67,  primary: true,  note: null },
  'AM 2':    { speciesCode: 'mexicanum', scientificName: 'Ambystoma mexicanum', displayName: 'Pecera AM 2', volumeL: 67,  primary: true,  note: null },
  'AM':      { speciesCode: 'mexicanum', scientificName: 'Ambystoma mexicanum', displayName: 'Pecera AM',   volumeL: 360, primary: true,  note: AM_UNIFICATION_NOTE },
  'AM Larvas': { speciesCode: 'mexicanum', scientificName: 'Ambystoma mexicanum', displayName: 'Pecera AM Larvas', volumeL: null, primary: true, note: AM_LARVAS_NOTE },
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
//   AD 1.1, AD 1.2, AD1.2, AD-1.1 → AD            (unified since early 2026)
//   AM 1.x, AM 1                  → AM 1 (pre-cutoff) | AM (post-cutoff)
//   AM 2.x, AM 2                  → AM 2 (pre-cutoff) | AM (post-cutoff)
//   AM                            → AM   (post-cutoff only; pre-cutoff = invalid)
//
// `isoDate` is the row's ISO date (YYYY-MM-DD) and is required so AM routing
// can pick the right side of the cutoff. For the catalog sheet (which has no
// date column) use `normalizeCatalogTankId` instead.
function normalizeTankId(raw, isoDate) {
  const s = (raw ?? '').toString().trim();
  if (!s) return null;
  const compact = s.replace(/\s+/g, ' ').toUpperCase();

  // Unified A. dumerilii tank: "AD", "AD 1.1", "AD-1.2", "AD1.2", "AD Gral." → "AD".
  // The `\d` alternative catches the no-space "AD1.2" variant: `/^AD\b/` alone has
  // no word boundary between "D" and a digit, so it silently dropped those rows.
  if (/^AD(\b|\d)/.test(compact)) return 'AD';

  // A. mexicanum larvae aquarium: its own series with AM thresholds (catalog mirror).
  if (/^AM\s*LARVAS?$/.test(compact)) return 'AM Larvas';

  const post = isoDate >= AM_UNIFICATION;

  if (compact === 'AM') return post ? 'AM' : null;
  if (compact === 'AM 1' || /^AM[\s-]*1\.\d+$/.test(compact)) return post ? 'AM' : 'AM 1';
  if (compact === 'AM 2' || /^AM[\s-]*2\.\d+$/.test(compact)) return post ? 'AM' : 'AM 2';

  if (compact === 'AA') return 'AA';
  if (compact === 'LLAVE') return 'Llave';
  if (compact === 'GUPPIES') return 'Guppies';
  return s; // unknown id; will be filtered downstream
}

// Catalog rows are dateless: keep AM 1 / AM 2 / AM literally as written so the
// catalog can carry both pre-cutoff and post-cutoff entries. After the loop we
// mirror AM 1 entries under AM so post-cutoff measurements have a min/max set.
function normalizeCatalogTankId(raw) {
  const s = (raw ?? '').toString().trim();
  if (!s) return null;
  const compact = s.replace(/\s+/g, ' ').toUpperCase();

  if (/^AD(\b|\d)/.test(compact)) return 'AD';
  if (/^AM\s*LARVAS?$/.test(compact)) return 'AM Larvas';
  if (compact === 'AM') return 'AM';
  if (compact === 'AM 1' || /^AM[\s-]*1\.\d+$/.test(compact)) return 'AM 1';
  if (compact === 'AM 2' || /^AM[\s-]*2\.\d+$/.test(compact)) return 'AM 2';
  if (compact === 'AA') return 'AA';
  if (compact === 'LLAVE') return 'Llave';
  if (compact === 'GUPPIES') return 'Guppies';
  return s;
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
// System metadata (dimensions, filter, cooling, aeration) is read from the
// "Descripcion de sistemas" sheet so curators can update the spreadsheet
// instead of editing this script. Tank IDs are matched via normalizeCatalogTankId.
// AM has no aggregated row in the xlsx (only AM 1..AM 5 subsystems); we mirror
// AM 1's metadata under 'AM' so the unified post-cutoff tank still has a system
// block, same approach used below for the parameter catalog mirror.
function multiline(s) {
  return s == null ? null : String(s).replace(/\s*\n\s*/g, ' ').trim() || null;
}

const systemsSheet = wb.Sheets['Descripcion de sistemas'];
const systemMap = new Map();
if (systemsSheet) {
  const sysRows = XLSX.utils.sheet_to_json(systemsSheet, { header: 1, defval: null, raw: true, blankrows: false });
  const sysHdrIdx = findHeaderRow(sysRows, ['identificador', 'volumen nominal', 'tipo de filtro']);
  if (sysHdrIdx < 0) {
    console.warn('[data-water] Descripcion de sistemas: header row not found, falling back to no-system tanks');
  } else {
    const sysHdr = sysRows[sysHdrIdx];
    const S = {
      id:             indexOfHeader(sysHdr, 'identificador'),
      volNominal:     indexOfHeader(sysHdr, 'volumen nominal'),
      volEffective:   indexOfHeader(sysHdr, 'volumen efectivo'),
      altoNominal:    indexOfHeader(sysHdr, 'alto (nominal)'),
      altoEffective:  indexOfHeader(sysHdr, 'alto (efectivo)'),
      largo:          indexOfHeader(sysHdr, 'largo'),
      ancho:          indexOfHeader(sysHdr, 'ancho'),
      tankType:       indexOfHeader(sysHdr, 'tipo de tanque'),
      substrate:      indexOfHeader(sysHdr, 'tipo de sustrato'),
      filterType:     indexOfHeader(sysHdr, 'tipo de filtro'),
      filterDesc:     indexOfHeader(sysHdr, ['descripción (marca', 'descripcion (marca']),
      filterFlow:     indexOfHeader(sysHdr, 'caudal del filtro'),
      filterMaint:    indexOfHeader(sysHdr, 'fecha último mantenimiento'),
      coolingType:    indexOfHeader(sysHdr, 'tipo sistema'),
      coolingCap:     indexOfHeader(sysHdr, 'capacidad'),
      coolingSet:     indexOfHeader(sysHdr, 'set point'),
      coolingMaint:   indexOfHeader(sysHdr, 'fecha último mantenimiento.'),
      aerationType:   indexOfHeader(sysHdr, 'tipo aireador'),
      aerationFlow:   indexOfHeader(sysHdr, 'caudal aire'),
    };
    const round1 = (n) => (typeof n === 'number' ? Math.round(n * 10) / 10 : null);
    for (let r = sysHdrIdx + 1; r < sysRows.length; r++) {
      const row = sysRows[r];
      if (!row || row.every((c) => c == null || c === '')) continue;
      const rawId = (row[S.id] ?? '').toString().trim();
      if (!rawId) continue;
      const canonicalId = normalizeCatalogTankId(rawId);
      if (!canonicalId) continue;
      // Parent rows (rawId === canonicalId, e.g. "AD") win over subsystem rows
      // (e.g. "AD 1.1") so the unified tank's metadata reflects the parent
      // system spec, not whichever subsystem the curators listed last.
      const isParentRow = rawId.replace(/\s+/g, ' ').toUpperCase() === canonicalId.toUpperCase();
      if (!isParentRow && systemMap.has(canonicalId)) continue;
      systemMap.set(canonicalId, {
        dimensions: {
          volumeNominalL:   round1(parseNumber(row[S.volNominal])),
          volumeEffectiveL: round1(parseNumber(row[S.volEffective])),
          heightNominalCm:  round1(parseNumber(row[S.altoNominal])),
          heightEffectiveCm: round1(parseNumber(row[S.altoEffective])),
          lengthCm:         round1(parseNumber(row[S.largo])),
          widthCm:          round1(parseNumber(row[S.ancho])),
        },
        tankType:  multiline(row[S.tankType]),
        substrate: multiline(row[S.substrate]),
        filter: {
          type:            multiline(row[S.filterType]),
          description:     multiline(row[S.filterDesc]),
          flow:            multiline(row[S.filterFlow]),
          lastMaintenance: toIsoDate(row[S.filterMaint]),
        },
        cooling: {
          type:            multiline(row[S.coolingType]),
          capacity:        multiline(row[S.coolingCap]),
          setpoint:        multiline(row[S.coolingSet]),
          lastMaintenance: toIsoDate(row[S.coolingMaint]),
        },
        aeration: {
          type:    multiline(row[S.aerationType]),
          airflow: multiline(row[S.aerationFlow]),
        },
      });
    }
    // Mirror AM 1 → AM if no aggregated AM row exists in the xlsx (post-cutoff
    // measurements use 'AM'; subsystem metadata under AM 1..AM 5 is otherwise
    // unreachable from the unified tank in the UI).
    if (!systemMap.has('AM') && systemMap.has('AM 1')) {
      systemMap.set('AM', systemMap.get('AM 1'));
    }
  }
} else {
  console.warn('[data-water] Sheet "Descripcion de sistemas" not found, tanks.json system block will be null');
}

const tanks = Object.entries(TANK_META).map(([id, meta]) => ({
  id,
  ...meta,
  accentColor: SPECIES_ACCENT[meta.speciesCode] ?? '#4A3628',
  system: systemMap.get(id) ?? null,
}));
writeFileSync(
  join(CONTENT_OUT, 'tanks.json'),
  JSON.stringify(tanks, null, 2) + '\n'
);
console.log(`[data-water] tanks.json: ${tanks.length} tanks (${[...systemMap.keys()].length} with system metadata)`);

// --- Parameters (catalog) --------------------------------------------------
const catalogSheet = wb.Sheets['Catálogo de parámetros'];
if (!catalogSheet) throw new Error('Sheet "Catálogo de parámetros" not found');

const catalogRows = XLSX.utils.sheet_to_json(catalogSheet, { header: 1, defval: null, raw: true, blankrows: false });
// Header row may be at index 0 (current xlsx format) or 1 (older format with a
// title row). Locate it by scanning for the canonical "ID-sistemas" cell.
const headerRowIdx = catalogRows.findIndex(r =>
  Array.isArray(r) && r.some(c => (c ?? '').toString().toLowerCase().includes('id-sistemas'))
);
if (headerRowIdx < 0) throw new Error('Catalog: header row with "ID-sistemas" not found');
const headerRow = catalogRows[headerRowIdx];
const dataStartIdx = headerRowIdx + 1;
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
for (let r = dataStartIdx; r < catalogRows.length; r++) {
  const row = catalogRows[r];
  if (!row || row.every(c => c == null || c === '')) continue;
  const rawId = (row[IDX.tankId] ?? '').toString().trim();
  if (!rawId) continue;
  const tankId = normalizeCatalogTankId(rawId);
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

// Mirror AM 1 catalog entries under the unified 'AM' key so post-cutoff
// measurements (m.tankId === 'AM') resolve to a min/max range. Skip params
// already present under 'AM' (e.g. if the team adds an explicit AM row later).
const amKeysPresent = new Set(parameters.filter(p => p.tankId === 'AM').map(p => p.key));
for (const p of parameters.filter(p => p.tankId === 'AM 1')) {
  if (amKeysPresent.has(p.key)) continue;
  parameters.push({ ...p, tankId: 'AM' });
}

// AM Larvas (A. mexicanum larvae) has no catalog rows of its own; mirror the now
// fully-populated 'AM' bands under 'AM Larvas' so its measurements get the same
// alarm evaluation. Runs after the AM 1 → AM mirror so 'AM' is complete. Skip any
// param the team later defines explicitly under AM Larvas.
const amLarvasKeysPresent = new Set(parameters.filter(p => p.tankId === 'AM Larvas').map(p => p.key));
for (const p of parameters.filter(p => p.tankId === 'AM')) {
  if (amLarvasKeysPresent.has(p.key)) continue;
  parameters.push({ ...p, tankId: 'AM Larvas' });
}

writeFileSync(
  join(CONTENT_OUT, 'parameters.json'),
  JSON.stringify(parameters, null, 2) + '\n'
);
console.log(`[data-water] parameters.json: ${parameters.length} catalog entries`);

const catalogLookup = new Map();
for (const p of parameters) catalogLookup.set(`${p.tankId}|${p.key}`, { min: p.min, max: p.max });

// --- Dashboard calidad de agua (curator-blessed summary) -------------------
// `Estado Clínico` carries species-specific clinical judgment beyond the
// catalog's min/max thresholds (e.g., a high NO3 that's clinically OK for
// dumerilii but alarming for andersoni). Ingest as-is, do not recompute.
// ID-sistemas is sticky: forward-fill from the previous non-empty row.
const dashSheet = wb.Sheets['Dashboard calidad de agua'];
const dashboardAgua = [];
const estadoSet = new Set();
if (dashSheet) {
  const dashRowsRaw = XLSX.utils.sheet_to_json(dashSheet, { header: 1, defval: null, raw: true, blankrows: false });
  const dashHdrIdx = findHeaderRow(dashRowsRaw, ['id-sistemas', 'parámetro', 'estado clínico']);
  if (dashHdrIdx < 0) {
    console.warn('[data-water] Dashboard calidad de agua: header row not found, skipping ingestion');
  } else {
    const dashHdr = dashRowsRaw[dashHdrIdx];
    const G = {
      tankId:        indexOfHeader(dashHdr, 'id-sistemas'),
      species:       indexOfHeader(dashHdr, 'especie'),
      param:         indexOfHeader(dashHdr, 'parámetro'),
      unit:          indexOfHeader(dashHdr, 'unidad'),
      rangeSafe:     indexOfHeader(dashHdr, 'rango seguro'),
      promedio:      indexOfHeader(dashHdr, 'promedio'),
      ultima:        indexOfHeader(dashHdr, 'última medición'),
      estado:        indexOfHeader(dashHdr, 'estado clínico'),
      min:           indexOfHeader(dashHdr, 'mínimo'),
      max:           indexOfHeader(dashHdr, 'máximo'),
    };
    let stickyTankRaw = null;
    for (let r = dashHdrIdx + 1; r < dashRowsRaw.length; r++) {
      const row = dashRowsRaw[r];
      if (!row || row.every((c) => c == null || c === '')) continue;
      const rawId = (row[G.tankId] ?? '').toString().trim();
      if (rawId) stickyTankRaw = rawId;
      if (!stickyTankRaw) continue;
      const tankId = normalizeCatalogTankId(stickyTankRaw);
      if (!tankId || !TANK_META[tankId]) continue;
      const paramKey = paramKeyFromName(row[G.param]);
      if (!paramKey) {
        console.warn(`[data-water] dashboard-agua: skipping unknown parameter "${row[G.param]}" on row ${r + 1}`);
        continue;
      }
      const estado = (row[G.estado] ?? '').toString().trim() || null;
      if (estado) estadoSet.add(estado);
      dashboardAgua.push({
        tankId,
        speciesCode: speciesCodeFrom(row[G.species]),
        paramKey,
        unit: (row[G.unit] ?? '').toString().trim() || null,
        rangeSafe: (row[G.rangeSafe] ?? '').toString().trim() || null,
        promedioHistorico: parseNumber(row[G.promedio]),
        ultimaMedicion: parseNumber(row[G.ultima]),
        estadoClinico: estado,
        limiteMin: parseNumber(row[G.min]),
        limiteMax: parseNumber(row[G.max]),
      });
    }
  }
} else {
  console.warn('[data-water] Sheet "Dashboard calidad de agua" not found, skipping ingestion');
}
writeFileSync(
  join(CONTENT_OUT, 'dashboard-agua.json'),
  JSON.stringify(dashboardAgua, null, 2) + '\n',
);
console.log(`[data-water] dashboard-agua.json: ${dashboardAgua.length} entries`);
if (estadoSet.size) console.log(`[data-water]   distinct estadoClinico values: ${[...estadoSet].join(' | ')}`);

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
// Calidad de agua header for column A has been observed to drift away from
// 'Fecha' (e.g. accidental rename to 'Columna 1'); fall back to position 0
// so a single corrupted cell does not zero out the entire dataset.
const IDX_M = {
  fecha:    (() => {
    const i = measHeader.findIndex(h => (h ?? '').toString().toLowerCase() === 'fecha');
    return i >= 0 ? i : 0;
  })(),
  hora:     measHeader.findIndex(h => (h ?? '').toString().toLowerCase() === 'hora'),
  author1:  measHeader.findIndex(h => (h ?? '').toString().toLowerCase().includes('autor principal')),
  author2:  measHeader.findIndex(h => (h ?? '').toString().toLowerCase().includes('autor secundario')),
  // The tank/system column was historically labeled 'Pecera' but the curators
  // renamed it to 'Ubicación' in mid-2026. Accept either spelling so the rename
  // does not silently zero out the dataset (every row would otherwise skip at
  // `if (!rawTank) continue` below, producing 0 rows with no warning).
  pecera:   measHeader.findIndex(h => {
    const s = (h ?? '').toString().toLowerCase().trim();
    return s === 'pecera' || s === 'ubicación' || s === 'ubicacion';
  }),
  noteCol:  measHeader.findIndex(h => (h ?? '').toString().toLowerCase().trim() === 'nota'),
};

// Hard-fail if the tank column is missing. Without this guard a future header
// rename re-introduces the silent-wipe failure mode: 0 measurements written and
// the historical JSON clobbered, with no error surfaced to the curator.
if (IDX_M.pecera < 0) {
  throw new Error(
    '[data-water] "Calidad de agua": tank/location column not found ' +
    '(looked for "Pecera" / "Ubicación"). Header row was: ' +
    JSON.stringify(measHeader)
  );
}

const allMeasurements = [];
let skippedNoDate = 0;
let skippedUnknownTank = 0;
const unknownTankSamples = new Set();

for (let r = 1; r < measRowsRaw.length; r++) {
  const row = measRowsRaw[r];
  if (!row) continue;

  const rawTank = (row[IDX_M.pecera] ?? '').toString().trim();
  if (!rawTank) continue;

  const iso = toIsoDate(row[IDX_M.fecha]);
  if (!iso) { skippedNoDate++; continue; }

  const tankId = normalizeTankId(rawTank, iso);
  if (!tankId || !TANK_META[tankId]) {
    skippedUnknownTank++;
    if (unknownTankSamples.size < 10) unknownTankSamples.add(rawTank);
    continue;
  }

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
