import { ICONOS } from '@/lib/atlasInstalaciones.mjs';

export const COLOR_UMA = '#19bdb7', COLOR_PIMVS = '#d4925f', COLOR_CREMA = '#f4e8c8', COLOR_MAR = '#06171e', COLOR_CERRADA = '#8a9aa0';

// Every part of a facility marker is a signed distance field, so MapLibre recolours it (`icon-color`) per state and theme: the backing disc, the ring of the legal figure and the pictogram of its type. All are 72 px squares so one `icon-offset` moves them together; the glyph's grid is Lucide's 24 × 24, stroke 2.
const TAM = 72, RADIO = 8, CORTE = 0.25, INF = 1e20;
/** Radius of the backing in raster px (13 logical px at pixelRatio 2) and the side of the glyph box. */
const R_FONDO = 26, LADO_GLIFO = 40;

function edt1d(grid: Float64Array, off: number, paso: number, n: number, f: Float64Array, v: Uint16Array, z: Float64Array) {
  v[0] = 0; z[0] = -INF; z[1] = INF; f[0] = grid[off];
  for (let q = 1, k = 0, s = 0; q < n; q++) {
    f[q] = grid[off + q * paso];
    const q2 = q * q;
    do { const r = v[k]; s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2; } while (s <= z[k] && --k > -1);
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  for (let q = 0, k = 0; q < n; q++) { while (z[k + 1] < q) k++; const r = v[k], qr = q - r; grid[off + q * paso] = f[r] + qr * qr; }
}
function edt(grid: Float64Array, w: number, h: number) {
  const n = Math.max(w, h), f = new Float64Array(n), v = new Uint16Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) edt1d(grid, x, w, h, f, v, z);
  for (let y = 0; y < h; y++) edt1d(grid, y * w, 1, w, f, v, z);
}

/** `disco`, `anillo-grueso` (a legal figure), `anillo-fino` (no figure) and `anillo-cerrado` are the backing; any other name is the pictogram of that facility type. */
export function imagenSdf(nombre: string): { width: number; height: number; data: Uint8ClampedArray } {
  const cv = document.createElement('canvas'); cv.width = TAM; cv.height = TAM;
  const x = cv.getContext('2d', { willReadFrequently: true })!;
  const c = TAM / 2;
  x.strokeStyle = '#000'; x.fillStyle = '#000'; x.lineCap = 'round'; x.lineJoin = 'round';
  if (nombre === 'disco') { x.beginPath(); x.arc(c, c, R_FONDO, 0, Math.PI * 2); x.fill(); }
  else if (nombre.startsWith('anillo-')) { x.lineWidth = nombre === 'anillo-grueso' ? 6 : nombre === 'anillo-cerrado' ? 4 : 2.4; x.beginPath(); x.arc(c, c, R_FONDO, 0, Math.PI * 2); x.stroke(); }
  else {
    const esc = LADO_GLIFO / 24;
    x.translate((TAM - LADO_GLIFO) / 2, (TAM - LADO_GLIFO) / 2); x.scale(esc, esc); x.lineWidth = 2;
    for (const p of (ICONOS as any)[nombre]) {
      x.save(); if (p.t) x.transform(...(p.t as [number, number, number, number, number, number]));
      for (const d of String(p.d).split(/(?=M)/)) x.stroke(new Path2D(d));
      x.restore();
    }
  }
  const px = x.getImageData(0, 0, TAM, TAM).data, n = TAM * TAM;
  const fuera = new Float64Array(n), dentro = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = px[i * 4 + 3] / 255;
    if (a === 1) { fuera[i] = 0; dentro[i] = INF; } else if (a === 0) { fuera[i] = INF; dentro[i] = 0; }
    else { const d = 0.5 - a; fuera[i] = d > 0 ? d * d : 0; dentro[i] = d < 0 ? d * d : 0; }
  }
  edt(fuera, TAM, TAM); edt(dentro, TAM, TAM);
  const data = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) { const d = Math.sqrt(fuera[i]) - Math.sqrt(dentro[i]); data[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(255 - 255 * (d / RADIO + CORTE)))); }
  return { width: TAM, height: TAM, data };
}

export const PARTES_FONDO = ['disco', 'anillo-grueso', 'anillo-fino', 'anillo-cerrado'];

/** The count on a cluster of facilities, as a small image: cream digits on nothing (the disc is a layer). */
export function numeroDeCumulo(n: string): ImageData {
  const L = 44, r = 2, cv = document.createElement('canvas'); cv.width = L * r; cv.height = L * r;
  const x = cv.getContext('2d')!; x.scale(r, r);
  x.fillStyle = '#f4e8c8'; x.font = '700 14px Montserrat, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(n, L / 2, L / 2 + 1);
  return x.getImageData(0, 0, L * r, L * r);
}
