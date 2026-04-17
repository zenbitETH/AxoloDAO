#!/usr/bin/env node
/**
 * tag-mexico-map.mjs
 *
 * Reads MapAssets/MapCanvas.svg (39 unnamed paths: 32 states + 7 distribution overlays),
 * fingerprints each path, matches the 32 largest paths to the 32 individual MX*.svg
 * state files, and writes src/assets/mexico-interactive.svg with id="MX-XXX" attributes.
 *
 * Manual overrides live in scripts/state-path-overrides.json (path index -> state code).
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MAP_ASSETS = resolve(ROOT, 'MapAssets');
const SRC_MAP = join(MAP_ASSETS, 'MapCanvas.svg');
const OUT_DIR = resolve(ROOT, 'public/map');
const OUT_MAP = join(OUT_DIR, 'mexico-interactive.svg');
const OVERRIDES_PATH = resolve(__dirname, 'state-path-overrides.json');

mkdirSync(OUT_DIR, { recursive: true });

// --- helpers ---------------------------------------------------------------
const PATH_RE = /<path\s+d="([^"]+)"([^>]*)\/>/g;

function extractPaths(svgText) {
  const out = [];
  let m;
  while ((m = PATH_RE.exec(svgText)) !== null) {
    out.push({ d: m[1], attrs: m[2], full: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

function parsePoints(d) {
  // Tokenize SVG path data into absolute points (best-effort: handles M/L commands as Figma exports them).
  const tokens = d.match(/[MLHVZmlhvz][^MLHVZmlhvz]*/g) || [];
  const pts = [];
  let cx = 0, cy = 0, startX = 0, startY = 0;
  for (const tk of tokens) {
    const cmd = tk[0];
    const nums = (tk.slice(1).match(/-?\d*\.?\d+(?:[eE][+-]?\d+)?/g) || []).map(Number);
    switch (cmd) {
      case 'M':
        for (let i = 0; i < nums.length; i += 2) {
          cx = nums[i]; cy = nums[i + 1];
          if (i === 0) { startX = cx; startY = cy; }
          pts.push([cx, cy]);
        }
        break;
      case 'm':
        for (let i = 0; i < nums.length; i += 2) {
          cx += nums[i]; cy += nums[i + 1];
          if (i === 0) { startX = cx; startY = cy; }
          pts.push([cx, cy]);
        }
        break;
      case 'L':
        for (let i = 0; i < nums.length; i += 2) {
          cx = nums[i]; cy = nums[i + 1]; pts.push([cx, cy]);
        }
        break;
      case 'l':
        for (let i = 0; i < nums.length; i += 2) {
          cx += nums[i]; cy += nums[i + 1]; pts.push([cx, cy]);
        }
        break;
      case 'H': for (const n of nums) { cx = n; pts.push([cx, cy]); } break;
      case 'h': for (const n of nums) { cx += n; pts.push([cx, cy]); } break;
      case 'V': for (const n of nums) { cy = n; pts.push([cx, cy]); } break;
      case 'v': for (const n of nums) { cy += n; pts.push([cx, cy]); } break;
      case 'Z': case 'z': cx = startX; cy = startY; break;
    }
  }
  return pts;
}

function fingerprint(pts) {
  if (!pts.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let sx = 0, sy = 0;
  for (const [x, y] of pts) {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    sx += x; sy += y;
  }
  const w = maxX - minX, h = maxY - minY;
  const cx = sx / pts.length, cy = sy / pts.length;
  // Polygon area (shoelace)
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    area += x1 * y2 - x2 * y1;
  }
  area = Math.abs(area) / 2;
  // Perimeter
  let perim = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    perim += Math.sqrt(dx * dx + dy * dy);
  }
  return {
    count: pts.length,
    w, h,
    aspect: w / Math.max(h, 1e-6),
    centroid: [(cx - minX) / Math.max(w, 1e-6), (cy - minY) / Math.max(h, 1e-6)],
    area,
    perim,
    compactness: (4 * Math.PI * area) / Math.max(perim * perim, 1e-6),
  };
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const aspectDiff = Math.abs(a.aspect - b.aspect) / Math.max(a.aspect, b.aspect);
  const compactDiff = Math.abs(a.compactness - b.compactness);
  const centroidDiff = Math.hypot(a.centroid[0] - b.centroid[0], a.centroid[1] - b.centroid[1]);
  // Lower is better; convert to a [0,1]-ish score where higher = more similar.
  return 1 / (1 + 4 * aspectDiff + 6 * compactDiff + 4 * centroidDiff);
}

// --- pipeline --------------------------------------------------------------
console.log('[map] reading MapCanvas.svg ...');
const canvasSvg = readFileSync(SRC_MAP, 'utf8');
const canvasPaths = extractPaths(canvasSvg);
console.log(`[map] found ${canvasPaths.length} <path> elements in MapCanvas`);

// Compute fingerprints for canvas paths and sort by area desc (states are the biggest)
const canvasFps = canvasPaths.map((p, i) => {
  const pts = parsePoints(p.d);
  return { i, fp: fingerprint(pts), nPoints: pts.length };
});

// Read state SVGs
const stateFiles = readdirSync(MAP_ASSETS).filter((f) => /^MX[A-Z]{3}\.svg$/.test(f));
console.log(`[map] found ${stateFiles.length} state SVGs`);

const stateFps = [];
for (const f of stateFiles) {
  const code = f.match(/^MX([A-Z]{3})\.svg$/)[1];
  const svg = readFileSync(join(MAP_ASSETS, f), 'utf8');
  const paths = extractPaths(svg);
  if (!paths.length) { console.warn(`[map] ${f} has no paths, skipping`); continue; }
  // Take the largest path in case the file has multiple
  let best = null;
  for (const p of paths) {
    const pts = parsePoints(p.d);
    const fp = fingerprint(pts);
    if (!best || (fp && fp.area > best.fp.area)) best = { fp, nPoints: pts.length };
  }
  stateFps.push({ code, fp: best.fp, nPoints: best.nPoints });
}

// Load manual overrides if present
let overrides = {};
if (existsSync(OVERRIDES_PATH)) {
  overrides = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'));
  console.log(`[map] loaded ${Object.keys(overrides).length} manual overrides`);
}

// Build cost matrix and do a greedy assignment (Hungarian would be overkill for 32×32)
const used = new Set();
const assignments = {}; // pathIndex -> stateCode

// Apply overrides first
for (const [idxStr, code] of Object.entries(overrides)) {
  const idx = Number(idxStr);
  if (!Number.isInteger(idx)) continue;
  assignments[idx] = code;
  used.add(code);
}

// Greedy: rank each canvas path by best available state match
const remainingCanvas = canvasFps.filter((c) => !(c.i in assignments));
const ranked = [];
for (const c of remainingCanvas) {
  for (const s of stateFps) {
    ranked.push({ pathIdx: c.i, code: s.code, score: similarity(c.fp, s.fp) });
  }
}
ranked.sort((a, b) => b.score - a.score);

const assignedPaths = new Set(Object.keys(assignments).map(Number));
for (const r of ranked) {
  if (assignedPaths.has(r.pathIdx) || used.has(r.code)) continue;
  assignments[r.pathIdx] = r.code;
  assignedPaths.add(r.pathIdx);
  used.add(r.code);
  if (used.size === stateFps.length) break;
}

console.log(`[map] assigned ${used.size}/${stateFps.length} states`);
const unassignedPaths = canvasPaths.map((_, i) => i).filter((i) => !(i in assignments));
const unassignedStates = stateFps.map((s) => s.code).filter((c) => !used.has(c));
console.log(`[map] ${unassignedPaths.length} paths left unassigned (likely distribution overlays)`);
if (unassignedStates.length) {
  console.warn(`[map] missing state codes:`, unassignedStates);
}

// --- write output ----------------------------------------------------------
// Replace each <path .../> in original order; wrap unassigned paths in a group at the end.
let out = canvasSvg;
const replacements = [];

for (let i = 0; i < canvasPaths.length; i++) {
  const p = canvasPaths[i];
  const code = assignments[i];
  if (code) {
    const id = `MX-${code}`;
    const newAttrs = ` id="${id}" data-state-code="${code}" tabindex="0" role="button" aria-label="${code}"`;
    const replaced = `<path d="${p.d}"${p.attrs}${newAttrs}/>`;
    replacements.push({ start: p.start, end: p.end, text: replaced });
  } else {
    const replaced = `<path d="${p.d}"${p.attrs} class="distribution-overlay" data-distribution="true"/>`;
    replacements.push({ start: p.start, end: p.end, text: replaced });
  }
}

// Apply replacements from end to start so indices stay valid
replacements.sort((a, b) => b.start - a.start);
for (const r of replacements) {
  out = out.slice(0, r.start) + r.text + out.slice(r.end);
}

// Strip width/height from the root <svg> so it scales fluidly via CSS, and ensure preserveAspectRatio is set.
out = out.replace(
  /<svg([^>]*)>/,
  (_, attrs) => {
    const cleaned = attrs
      .replace(/\s+width="[^"]*"/g, '')
      .replace(/\s+height="[^"]*"/g, '')
      .replace(/\s+preserveAspectRatio="[^"]*"/g, '');
    return `<svg${cleaned} preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:auto;max-width:100%">`;
  },
);

// Strip the opaque white background rectangle so the map blends into the dark canvas.
out = out.replace(/<rect\s+width="7205"\s+height="4735"\s+fill="white"\s*\/>/i, '');

writeFileSync(OUT_MAP, out);
console.log(`[map] wrote ${OUT_MAP} (${(out.length / 1024).toFixed(1)} KB)`);
console.log('[map] done. Validate visually in a browser; add overrides to scripts/state-path-overrides.json if needed.');
