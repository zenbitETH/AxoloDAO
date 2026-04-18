#!/usr/bin/env node
/**
 * derive-species-states-from-map.mjs
 *
 * Reads public/map/mexico-interactive.svg (tagged by tag-mexico-map.mjs) and determines,
 * for each species overlay (point circles and distribution-area paths), which state
 * polygons contain it. Writes the result to scripts/species-state-overrides.json so
 * extract-species.mjs will use it as the source of truth for state highlights.
 *
 * Rationale: the Notion HTML lists biological ranges that don't always match the artist's
 * pin placement on the map. The visual authority wins — the highlighted states should
 * always reflect what the user sees on the map.
 *
 * Velasci keeps its hand-curated list (user-provided) since the artist's green blob
 * covers the biologically-correct wide range.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MAP_SVG = resolve(ROOT, 'public/map/mexico-interactive.svg');
const OUT = resolve(__dirname, 'species-state-overrides.json');

// Species whose derived list should NOT be overwritten (manual curation wins).
// - velasci: the artist's green blob covers the user-specified 19-state range
// - rosaceum: NAY is added manually (painted area doesn't strictly extend there
//   but the species is biologically present in Nayarit)
const PROTECTED = new Set(['velasci', 'rosaceum']);

// ------------ parsing -------------------------------------------------------
function parsePoints(d) {
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
        for (let i = 0; i < nums.length; i += 2) { cx = nums[i]; cy = nums[i + 1]; pts.push([cx, cy]); }
        break;
      case 'l':
        for (let i = 0; i < nums.length; i += 2) { cx += nums[i]; cy += nums[i + 1]; pts.push([cx, cy]); }
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

// Ray-casting point-in-polygon
function pointInPolygon([px, py], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ------------ extract polygons & overlays ----------------------------------
const svg = readFileSync(MAP_SVG, 'utf8');

// 1) state polygons
const statePathRE = /<path\b[^>]*\bd="([^"]+)"[^>]*\bdata-state-code="([A-Z]{3})"[^>]*\/>/g;
const states = [];
for (let m; (m = statePathRE.exec(svg)) !== null; ) {
  const pts = parsePoints(m[1]);
  states.push({ code: m[2], pts });
}
console.log(`[derive] parsed ${states.length} state polygons`);

// 2) point markers (attribute order varies — grab each attr independently)
const circleBlockRE = /<circle\b[^/]*data-species="[a-z]+"[^/]*\/>/g;
const points = [];
for (let m; (m = circleBlockRE.exec(svg)) !== null; ) {
  const tag = m[0];
  const cx = tag.match(/\bcx="([-\d.]+)"/);
  const cy = tag.match(/\bcy="([-\d.]+)"/);
  const sp = tag.match(/\bdata-species="([a-z]+)"/);
  if (cx && cy && sp) {
    points.push({ x: Number(cx[1]), y: Number(cy[1]), species: sp[1] });
  }
}
console.log(`[derive] found ${points.length} point markers`);

// 3) distribution areas (attribute order varies)
const areaBlockRE = /<path\b[^/]*data-overlay-type="area"[^/]*\/>/g;
const areas = [];
for (let m; (m = areaBlockRE.exec(svg)) !== null; ) {
  const tag = m[0];
  const d = tag.match(/\bd="([^"]+)"/);
  const sp = tag.match(/\bdata-species="([a-z]+)"/);
  if (d && sp) areas.push({ pts: parsePoints(d[1]), species: sp[1] });
}
console.log(`[derive] found ${areas.length} distribution-area paths`);

// ------------ for each species, determine containing states ----------------
const result = {};

// Point markers: each point tested against every state; collect states containing the point.
for (const p of points) {
  const hits = new Set(result[p.species] ?? []);
  for (const st of states) {
    if (pointInPolygon([p.x, p.y], st.pts)) hits.add(st.code);
  }
  result[p.species] = [...hits];
}

// Areas: sample the polygon (every 5th vertex) and centroid; aggregate hit states.
for (const a of areas) {
  const hits = new Set(result[a.species] ?? []);
  const samples = [];
  for (let i = 0; i < a.pts.length; i += 5) samples.push(a.pts[i]);
  if (a.pts.length) {
    // centroid
    let sx = 0, sy = 0;
    for (const [x, y] of a.pts) { sx += x; sy += y; }
    samples.push([sx / a.pts.length, sy / a.pts.length]);
  }
  for (const pt of samples) {
    for (const st of states) {
      if (pointInPolygon(pt, st.pts)) hits.add(st.code);
    }
  }
  result[a.species] = [...hits].sort();
}

// ------------ merge with existing overrides (protect curated species) -----
let existing = {};
if (existsSync(OUT)) {
  try { existing = JSON.parse(readFileSync(OUT, 'utf8')); } catch {}
}
const merged = { _doc: existing._doc ?? 'Auto-derived by derive-species-states-from-map.mjs from the visible markers/areas on public/map/mexico-interactive.svg. Species in PROTECTED keep their manual curation.' };
for (const slug of Object.keys(result).sort()) {
  if (PROTECTED.has(slug) && Array.isArray(existing[slug])) {
    merged[slug] = existing[slug];
    console.log(`  - ${slug}: kept manual (${existing[slug].length} states)`);
  } else {
    merged[slug] = result[slug].sort();
    console.log(`  - ${slug}: derived (${merged[slug].join(', ') || '—'})`);
  }
}
// preserve any manual overrides that weren't re-derived
for (const [k, v] of Object.entries(existing)) {
  if (k === '_doc' || merged[k]) continue;
  merged[k] = v;
}

writeFileSync(OUT, JSON.stringify(merged, null, 2) + '\n');
console.log(`[derive] wrote ${OUT}`);
