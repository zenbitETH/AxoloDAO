/**
 * xlsx-utils.mjs
 *
 * Shared helpers used by every data-* script that reads the operational
 * spreadsheet. Centralizing here means the new data-ops.mjs (bitácora,
 * calendario, turnos) sees the same alias canonicalization and date parsing
 * as the existing water/ajolotes pipelines.
 */

import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { huellaDe } from './limpiar-personas.mjs';

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
// inconsistent spellings across sheets: Dashboard ejemplares had 'Negra' while
// Plan / Alimentación / Historial used 'La negra'. The Site (photo manifest,
// deep-link anchors, modal joins between sheets) expects a single canonical
// alias per specimen, so we fold the variants here. When curators want to
// retire a normalization, rename the source in the xlsx first, then drop the
// line below.
//
// ⚠ Folding here does NOT protect the workbook's own formulas. `Dashboard
// ejemplares` pulls each specimen's biometry with
// `FILTER('Historial medico'!D:D = $A<row>)`, which resolves against the raw
// text long before this map runs. A split alias therefore breaks the Sheet while
// the Site still looks coherent: on 2026-08-14 'Chocorol' in column A missed ten
// modern 'Chocorrol' rows and published a December weight, and 'Negra' missed
// 'La negra' entirely and published SIN DATOS against ten measurements. Both were
// fixed in column A, not here.
export const ALIAS_NORMALIZE = new Map([
  // 'Chocorrol' (double R) is the original and, since 2026-08-15, the definitive
  // spelling: podcasts 09, 10 and 21 and the pulso-w20/w21 rail entries all use
  // it. 'Chocoroll' was drift that reached the Historial and the Xovi roster.
  // The workbook itself is now consistent; these two lines cover anything typed
  // from memory, and the Xovi clip feed, which keeps 'Chocoroll' because the
  // verified clip's hash is derived from the alias it was submitted with.
  ['Chocorol', 'Chocorrol'],
  ['Chocoroll', 'Chocorrol'],
  ['chocorol', 'Chocorrol'],
  ['chocoroll', 'Chocorrol'],
  ['chocorrol', 'Chocorrol'],
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
  // The A. andersoni that arrived in AA in August 2026 is logged as
  // "Andersonii 1" — two i's — across Dashboard, Alimentación 2.0 and Bitacora.
  // The species is andersoni, one i, so the working alias carries a typo into
  // every surface that prints it. Folded here (not in the sheet) so the
  // cross-sheet joins keep matching the raw text. Drop this line when the
  // specimen gets its permanent name, or when column A is corrected.
  ['Andersonii 1', 'Andersoni 1'],
  ['andersonii 1', 'Andersoni 1'],
]);

export function normalizeAlias(s) {
  if (s == null) return s;
  const t = String(s).trim();
  if (!t) return t;
  return ALIAS_NORMALIZE.get(t) ?? t;
}

// Species spelling drift, same idea as ALIAS_NORMALIZE but for the `Especie`
// column. The Site types the species as the exact workbook literal
// (`SpeciesCode` in components/ajolotes/types.ts) and `speciesToWq()` matches it
// with ===, so a single stray character silently downgrades a specimen to the
// 'na' palette, drops it out of the species tally, and unlinks it from its
// species sheet. Keep this to real misspellings of the three species on site.
export const SPECIES_NORMALIZE = new Map([
  // Ambystoma andersoni Krebs & Brandon, 1984 — one i. The Dashboard row for the
  // August 2026 arrival types it with two.
  ['A. andersonii', 'A. andersoni'],
  ['A. Andersonii', 'A. andersoni'],
]);

export function normalizeEspecie(s) {
  if (s == null) return s;
  const t = String(s).trim();
  if (!t) return t;
  return SPECIES_NORMALIZE.get(t) ?? t;
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

/**
 * Embargo, committed form. A digest of each withheld name folded with foldForEmbargo (no accents, lowercase, single spaces), so a build with no
 * untracked config (Vercel) still drops the specimen and no tracked line names it. loadEmbargoNames (env or untracked config) adds to this set;
 * it never replaces it.
 *
 * The digests are HMAC-SHA256 with the same key as the people list (AXOLODAO_PERSONAS_CLAVE, outside the repository), stored in
 * src/data/embargo-huellas.json: a plain sha256 of a short name is reversed in seconds with a list of names. Until that file exists the legacy plain
 * digests below stay in force (the embargo is never dropped), and test:embargo says so. To migrate, whoever holds the names runs
 *   node scripts/embargo-rehash.mjs <file with one withheld name per line>
 * with the key set, which writes src/data/embargo-huellas.json; then the legacy constant is deleted.
 */
const LEGACY_SHA256 = new Set(["32061dcc8325c83b80e7c672e3f8fbc154903d7fb307aba21d02f6e5b72eb0c2", "b55a2e9654250ecbd92cc3e31765211f83507f6e9e8f9ac8c5dfdd906d1d4767"]);
const HUELLAS_FILE = fileURLToPath(new URL('../../src/data/embargo-huellas.json', import.meta.url));
const huellasHmac = existsSync(HUELLAS_FILE) ? JSON.parse(readFileSync(HUELLAS_FILE, 'utf8')) : null;
/** 'hmac' once the committed set is keyed; 'sha256-legacy' until then. */
export const EMBARGO_FORMAT = huellasHmac?.formato === 'hmac-sha256' ? 'hmac' : 'sha256-legacy';
export const EMBARGO_SHA256 = new Set(EMBARGO_FORMAT === 'hmac' ? huellasHmac.huellas : LEGACY_SHA256);
/** The digest of one already folded word or pair, in the format of the committed set. */
export const digestDePalabra = (w) => (EMBARGO_FORMAT === 'hmac' ? huellaDe(w) : createHash('sha256').update(w).digest('hex'));

export const foldForEmbargo = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .join(' ');

export const embargoDigest = (s) => digestDePalabra(foldForEmbargo(s));

/**
 * True when any one or two consecutive words of `text` hash into `digests`.
 * Whole words only, so a different animal whose name merely contains a
 * withheld one is not caught.
 */
export function mentionsEmbargoed(text, digests = EMBARGO_SHA256) {
  if (typeof text !== 'string' || !text) return false;
  const words = foldForEmbargo(text).split(' ').filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (digests.has(digestDePalabra(words[i]))) return true;
    if (i + 1 < words.length && digests.has(digestDePalabra(`${words[i]} ${words[i + 1]}`))) return true;
  }
  return false;
}

/** The ingest's filter: committed digests plus whatever loadEmbargoNames finds. */
export function makeEmbargoFilter(scriptDir, committed = EMBARGO_SHA256) {
  const digests = new Set(committed);
  for (const n of loadEmbargoNames(scriptDir)) digests.add(embargoDigest(n));
  return {
    isAlias: (s) => digests.has(embargoDigest(normalizeAlias(toStr(s)) ?? '')),
    mentions: (text) => mentionsEmbargoed(text, digests),
  };
}
