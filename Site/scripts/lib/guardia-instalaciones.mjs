// What the repo guards about the facilities on the map, as functions that return the offenders (an empty list is green).
// test-atlas.mjs runs them on the committed data and style; test-guardia-plantada.mjs plants a fault for each and shows them red.
//
// The facilities are drawn at the INEGI centroid of their municipality (or state), never at an address:
//   - precision: no coordinate is finer than a centroid (four decimals);
//   - centroide: every point is exactly the INEGI centroid of its municipality or state;
//   - sinPin: no marker layer draws a pin, and the icon set has no pin-shaped icon;
//   - abanico: markers that share a place are moved on the screen only: the GeoJSON handed to the map has the geometry it came with.
import { readFileSync } from 'node:fs';

/** The Lucide `map-pin` path (lucide-static 0.469.0): the shape a visitor reads as «exactly here». */
export const PIN_LUCIDE = 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0';

export function csvDeCentroides(ruta) {
  const filas = readFileSync(ruta, 'utf8').trim().split('\n').map((l) => { const o = []; let t = '', q = false; for (const c of l) { if (c === '"') q = !q; else if (c === ',' && !q) { o.push(t); t = ''; } else t += c; } o.push(t); return o; });
  const [cab, ...resto] = filas;
  return new Map(resto.map((f) => Object.fromEntries(cab.map((k, i) => [k, f[i]]))).map((r) => [`${r.cve_ent}|${r.cve_mun}`, r]));
}

export const precision = (fc) => fc.features.filter((f) => !f.geometry.coordinates.every((v) => (String(v).split('.')[1] ?? '').length <= 4)).map((f) => f.properties.id);

export const centroide = (fc, inegi) => fc.features.filter((f) => { const c = inegi.get(`${f.properties.cve_ent}|${f.properties.cve_mun}`); return !c || f.geometry.type !== 'Point' || f.geometry.coordinates[0] !== Number(c.lon) || f.geometry.coordinates[1] !== Number(c.lat); }).map((f) => f.properties.id);

/** The guard of before the pictograms: every layer on the facilities source is a translucent circle of 10 px or more. Kept so it can be shown beside the new one. */
export function estiloAntiguo(style) {
  return style.layers.filter((l) => l.source === 'instalaciones' && !(l.type === 'circle' && (l.paint?.['circle-opacity'] ?? 1) < 0.5 && l.paint?.['circle-radius'] >= 10)).map((l) => l.id);
}

/** The silhouette of an SVG path as a polygon list: every command (M L H V C S Q T A Z, absolute and relative) flattened to short segments. */
export function poligonosDeTrazo(d) {
  const polis = []; let pts = [], x = 0, y = 0, sx = 0, sy = 0, ult = null, previo = '';
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/g;
  const tok = [...String(d).matchAll(re)].map((m) => m[1] ?? Number(m[2]));
  // compact arc flags («a1 1 0 011 1») are not expected in the icon set; the tokenizer reads them as numbers
  let i = 0; const num = () => tok[i++];
  const punto = (px, py) => { pts.push([px, py]); x = px; y = py; };
  const cerrar = () => { if (pts.length > 2) polis.push(pts); pts = []; };
  const cubica = (x1, y1, x2, y2, x3, y3) => { const x0 = x, y0 = y; for (let t = 1; t <= 12; t++) { const u = t / 12, v = 1 - u; pts.push([v ** 3 * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u ** 3 * x3, v ** 3 * y0 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u ** 3 * y3]); } x = x3; y = y3; ult = ['c', x2, y2]; };
  const cuadratica = (x1, y1, x2, y2) => cubica(x + (2 / 3) * (x1 - x), y + (2 / 3) * (y1 - y), x2 + (2 / 3) * (x1 - x2), y2 + (2 / 3) * (y1 - y2), x2, y2);
  const arco = (rx, ry, fi, fa, fs, x2, y2) => {
    if (rx === 0 || ry === 0) return punto(x2, y2);
    const ph = (fi * Math.PI) / 180, c = Math.cos(ph), sn = Math.sin(ph), dx = (x - x2) / 2, dy = (y - y2) / 2;
    const x1p = c * dx + sn * dy, y1p = -sn * dx + c * dy; rx = Math.abs(rx); ry = Math.abs(ry);
    const lam = x1p ** 2 / rx ** 2 + y1p ** 2 / ry ** 2; if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
    const k = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, (rx ** 2 * ry ** 2 - rx ** 2 * y1p ** 2 - ry ** 2 * x1p ** 2) / (rx ** 2 * y1p ** 2 + ry ** 2 * x1p ** 2)));
    const cxp = (k * rx * y1p) / ry, cyp = (-k * ry * x1p) / rx, cx = c * cxp - sn * cyp + (x + x2) / 2, cy = sn * cxp + c * cyp + (y + y2) / 2;
    const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry); let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
    for (let t = 1; t <= 24; t++) { const a = t1 + (dt * t) / 24; pts.push([c * rx * Math.cos(a) - sn * ry * Math.sin(a) + cx, sn * rx * Math.cos(a) + c * ry * Math.sin(a) + cy]); }
    x = x2; y = y2;
  };
  while (i < tok.length) {
    let cmd = tok[i]; if (typeof cmd === 'string') i++; else cmd = previo === 'M' ? 'L' : previo === 'm' ? 'l' : previo;
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0; previo = cmd;
    if (C === 'Z') { cerrar(); x = sx; y = sy; ult = null; continue; }
    if (C === 'M') { cerrar(); const a = num() + ox, b = num() + oy; sx = a; sy = b; punto(a, b); ult = null; }
    else if (C === 'L') { punto(num() + ox, num() + oy); ult = null; }
    else if (C === 'H') { punto(num() + (rel ? x : 0), y); ult = null; }
    else if (C === 'V') { punto(x, num() + (rel ? y : 0)); ult = null; }
    else if (C === 'C') cubica(num() + ox, num() + oy, num() + ox, num() + oy, num() + ox, num() + oy);
    else if (C === 'S') { const [x1, y1] = ult?.[0] === 'c' ? [2 * x - ult[1], 2 * y - ult[2]] : [x, y]; cubica(x1, y1, num() + ox, num() + oy, num() + ox, num() + oy); }
    else if (C === 'Q') { const a = num() + ox, b = num() + oy; cuadratica(a, b, num() + ox, num() + oy); }
    else if (C === 'T') cuadratica(x, y, num() + ox, num() + oy);
    else if (C === 'A') { const rx = num(), ry = num(), fi = num(), fa = num(), fs = num(); arco(rx, ry, fi, fa, fs, num() + ox, num() + oy); ult = null; }
    else i++;
  }
  cerrar();
  return polis;
}
/** Does a path draw the silhouette of a map pin (a teardrop: a rounded top, the widest row in the upper half, narrowing to a point at the bottom)? By shape, so a pin redrawn with other numbers, other scale or another offset is still one; a shield (flat top), an egg (round bottom) or a circle is not. */
export function esSiluetaDePin(d) {
  const polis = poligonosDeTrazo(d); if (!polis.length) return false;
  const todos = polis.flat(), minX = Math.min(...todos.map((p) => p[0])), maxX = Math.max(...todos.map((p) => p[0])), minY = Math.min(...todos.map((p) => p[1])), maxY = Math.max(...todos.map((p) => p[1]));
  const w = maxX - minX, h = maxY - minY; if (w <= 0 || h <= 0 || h / w < 1.05 || h / w > 1.9) return false;
  const N = 60, ancho = [];
  const dentro = (px, py) => polis.reduce((n, poly) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const [xa, ya] = poly[a], [xb, yb] = poly[b]; if ((ya > py) !== (yb > py) && px < ((xb - xa) * (py - ya)) / (yb - ya) + xa) c = !c; } return n + (c ? 1 : 0); }, 0) % 2 === 1;
  for (let r = 0; r < N; r++) { const py = minY + ((r + 0.5) / N) * h; let n = 0; for (let q = 0; q < 120; q++) if (dentro(minX + ((q + 0.5) / 120) * w, py)) n++; ancho.push(n / 120); }
  const max = Math.max(...ancho), filaMax = ancho.indexOf(max);
  const arriba = ancho.slice(0, Math.max(1, Math.round(N * 0.12))).reduce((a, b) => Math.max(a, b), 0), abajo = ancho.slice(-Math.max(1, Math.round(N * 0.1))).reduce((a, b) => Math.max(a, b), 0);
  let sube = true; for (let r = filaMax; r < N - 1; r++) if (ancho[r + 1] > ancho[r] + 0.06) sube = false;   // below its widest row a pin only narrows
  return filaMax < N * 0.5 && arriba < 0.85 * max && abajo < 0.35 * max && sube;
}

/** No layer on a facilities source draws a pin, and no icon of the set is the pin: a pin says «this exact place», and these rows are municipal centroids. */
export function sinPin(style, iconos) {
  const malos = [];
  for (const l of style.layers.filter((x) => /^instalaciones/.test(x.source ?? ''))) {
    const imagen = JSON.stringify(l.layout?.['icon-image'] ?? '');
    if (l.type === 'symbol' && (/pin/i.test(imagen) || /marker/i.test(imagen))) malos.push(l.id);
  }
  for (const [tipo, partes] of Object.entries(iconos)) if (partes.some((p) => String(p.d).replace(/\s+/g, ' ').trim() === PIN_LUCIDE || esSiluetaDePin(p.d)) || /pin/i.test(tipo)) malos.push(`icono ${tipo}`);
  return malos;
}

const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** `preparar(fc, desp)` is what feeds the marker layers: its output must carry every geometry it was given, unchanged, and leave its input alone; the offset lives in a property. */
export function abanico(preparar, fc, desp) {
  const antes = JSON.stringify(fc);
  const salida = preparar(fc, desp);
  const malos = [];
  if (JSON.stringify(fc) !== antes) malos.push('the input was changed');
  if (salida.features.length !== fc.features.length) malos.push('features were added or dropped');
  salida.features.forEach((f, i) => { if (!iguales(f.geometry, fc.features[i].geometry)) malos.push(`geometry of ${fc.features[i].properties.id}`); if (!Array.isArray(f.properties.desp)) malos.push(`no screen offset on ${fc.features[i].properties.id}`); });
  return malos;
}
