/**
 * xlsx-utils.mjs
 *
 * Shared helpers used by every data-* script that reads the operational
 * spreadsheet. Centralizing here means the new data-ops.mjs (bitácora,
 * calendario, turnos) sees the same alias canonicalization and date parsing
 * as the existing water/ajolotes pipelines.
 */

import { resolve, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

/**
 * Absolute path to the operations workbook ("Control operativo AxoloDAO.xlsx").
 *
 * The workbook is maintained outside this repo, so its location is supplied at
 * run time via the AXOLODAO_XLSX environment variable (absolute, or resolved
 * relative to CWD). These data:* scripts are dev-only and never run in
 * CI/build, so there is no in-repo default — set AXOLODAO_XLSX before running.
 */
export function resolveXlsxPath() {
  const p = process.env.AXOLODAO_XLSX;
  if (!p) {
    throw new Error(
      'AXOLODAO_XLSX is not set. Point it at the operations workbook ' +
        '("Control operativo AxoloDAO.xlsx") and re-run.',
    );
  }
  return resolve(p);
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toIsoDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return null;
}

export function toTimeString(v) {
  if (v == null) return null;
  if (v instanceof Date) return `${pad2(v.getHours())}:${pad2(v.getMinutes())}`;
  const s = String(v).trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return s.slice(0, 5);
  return null;
}

// Excel time cells arrive as Date objects on the 1899-12-30 epoch; this
// returns the 0..1 time-of-day fraction expected by bundle.json.
export function toTimeFraction(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    const epoch = Date.UTC(1899, 11, 30);
    const utcMs = Date.UTC(
      v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate(),
      v.getUTCHours(), v.getUTCMinutes(), v.getUTCSeconds(),
    );
    const dayMs = 24 * 60 * 60 * 1000;
    const frac = ((utcMs - epoch) % dayMs) / dayMs;
    if (!Number.isFinite(frac)) return null;
    if (Math.abs(frac) < 1e-9 && v.getUTCFullYear() <= 1899) return null;
    return frac;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v - Math.floor(v);
  }
  const s = String(v).trim();
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m) {
    const h = Number(m[1]), mn = Number(m[2]), sc = Number(m[3] ?? 0);
    return (h * 3600 + mn * 60 + sc) / 86400;
  }
  return null;
}

export function toNum(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || s === '-' || s === '—' || s.toUpperCase() === 'NA') return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Accept numbers or free-text markers ("NA", "Sin datos") — peso/longitud
// columns in Bajas, bcs columns in ejemplares/historial.
export function toNumOrText(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : s;
}

export function toStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// data-water's parseNumber additionally collapses "0.1-0.25" ranges to the
// midpoint — kept distinct from toNum because the catalog/measurement sheets
// expect this behavior but the ajolotes biometrics do not.
export function parseNumber(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim();
  if (!s || s === '-' || s === '—') return null;
  const range = s.match(/^(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)$/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) return (a + b) / 2;
  }
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Find the row index containing all `markers` (case-insensitive substring).
export function findHeaderRow(rows, markers) {
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

// Locate a column by header text. `needles` can be a string or array; the
// first match wins. Uses normalized substring match.
export function indexOfHeader(headerRow, needles) {
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
export const ALIAS_NORMALIZE = new Map([
  ['Romulo', 'Rómulo'],
  ['romulo', 'Rómulo'],
  // Bookkeeping variant of the same specimen. The cross-sheet joins in this
  // ingest are by name, so both spellings must canonicalize to one.
  ['Romualdo', 'Rómulo'],
  ['romualdo', 'Rómulo'],
  ['Chocorol', 'Chocoroll'],
  ['Negra', 'La negra'],
  ['negra', 'La negra'],
  ['mocca', 'Moka'],
  ['Martin', 'Martín'],
  ['martin', 'Martín'],
  // Rename: the larva formerly logged as "Larva 1" now has a permanent name,
  // "Patito". The xlsx still uses "Larva 1" across every sheet (Dashboard,
  // Alimentación, Terapéutica, …); folding it here canonicalizes the specimen to
  // "Patito" on the Site while keeping all cross-sheet joins intact. Drop this
  // line once the curator renames "Larva 1" → "Patito" in the workbook itself.
  ['Larva 1', 'Patito'],
]);

export function normalizeAlias(s) {
  if (s == null) return s;
  const t = String(s).trim();
  if (!t) return t;
  return ALIAS_NORMALIZE.get(t) ?? t;
}

/**
 * Names whose records are temporarily withheld from the public output (an
 * embargo). Sourced from the AXOLODAO_EMBARGO_BAJAS env var (comma-separated)
 * and/or an untracked <scriptDir>/.embargo.json ({ "bajas": [...] }), so no
 * withheld name is hardcoded in version control. Returns a Set of normalized,
 * lowercased names to match against normalizeAlias(value).toLowerCase().
 */
export function loadEmbargoNames(scriptDir) {
  const set = new Set();
  const add = (s) => {
    const t = (normalizeAlias(toStr(s)) ?? '').trim().toLowerCase();
    if (t) set.add(t);
  };
  (process.env.AXOLODAO_EMBARGO_BAJAS ?? '').split(',').forEach(add);
  if (scriptDir) {
    const cfg = join(scriptDir, '.embargo.json');
    if (existsSync(cfg)) {
      try {
        const parsed = JSON.parse(readFileSync(cfg, 'utf8'));
        (Array.isArray(parsed) ? parsed : parsed.bajas ?? []).forEach(add);
      } catch {
        // Ignore a malformed optional config rather than fail the ingest.
      }
    }
  }
  return set;
}
