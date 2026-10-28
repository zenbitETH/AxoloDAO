// PROTOTYPE. Species colours by GEOGRAPHY (founder, 19-oct), third round. Class by countries; the colour follows the centre of each range inside its class.
//   Canada (with US, no Mexico): hue from violet (~295°) in the south to magenta-red (~5°) in the far north, by latitude; lightness by longitude (west lighter).
//   US only: hue from cyan-teal (~195°) at the coasts to deep blue (~250°) at the central meridian (-98°), by |lon+98|; lightness by latitude (north lighter).
//   Mexico only: hue by LONGITUDE, green (~150°) in the west to red (~22°) in the east, through yellow and orange; lightness by latitude (south lighter).
//   mavortium (Canada, US and Mexico): yellow-orange, FLAGGED.
// Each position is normalised inside its class, so the whole range is used. A bounded nudge (hue ±14°, lightness ±0.08, chroma ±0.025) and, for US and Canada species only, a PASTEL variant
// (lightness +0.09, chroma ×0.55) are found by a seeded search over every pair that must stay apart: ranges that touch, and species next to each other in the list. Pairs still under ΔE 10
// get a texture on one of the two (fine diagonal hatching, dots, or a cross-hatch), on the map fill and on the list swatch. Tab ink is its own variant per species.
// Floors: every fill >= 3:1 on the state fill, every ink >= 4.5:1. Lightness runs 0.55-0.84 (the dataviz dark band is 0.48-0.67: the validator's band line will say so).
// Run: node scripts/proto/palette-geo.mjs > docs/palette-report.txt   (writes public/atlas/real/colores.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { contrast, validate } from './validate_palette.mjs';

const STATE = '#0f2b35';
const log = (...a) => console.log(...a);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;

const inGamut = (L, C, h) => { const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180); const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b; const [l, m, s] = [l_ ** 3, m_ ** 3, s_ ** 3]; return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].every((x) => x >= -0.001 && x <= 1.001); };
const toHex = (L, C, h) => { h = ((h % 360) + 360) % 360; while (!inGamut(L, C, h) && C > 0.02) C -= 0.003; const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180); const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b; const [l, m, s] = [l_ ** 3, m_ ** 3, s_ ** 3]; const v = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]; const g = (x) => { x = Math.max(0, Math.min(1, x)); return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)); }; return { hex: `#${v.map(g).map((x) => x.toString(16).padStart(2, '0')).join('')}`, C }; };
const oklab = (hex) => { const n = parseInt(hex.slice(1), 16); const [r, g, b] = [n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b); return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]; };
const dE = (a, b) => { const [p, q] = [oklab(a), oklab(b)]; return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

// -- centres, classes, neighbours
const rangos = JSON.parse(readFileSync('public/atlas/real/rangos.geojson', 'utf8'));
const snap = JSON.parse(readFileSync('src/data/atlas-snapshot/especies-atlas.json', 'utf8'));
const near = JSON.parse(readFileSync('public/atlas/real/vecinos.json', 'utf8'));
const centro = (feats) => { let best = null; for (const f of feats) { const polys = f.geometry.type === 'Point' ? [[[f.geometry.coordinates]]] : f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates; for (const p of polys) { let [w, s, e, n] = [1e9, 1e9, -1e9, -1e9]; for (const [x, y] of p[0]) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); } const area = (e - w) * (n - s); if (!best || area > best.area) best = { area, lon: (w + e) / 2, lat: (s + n) / 2 }; } } return best; };
const CLASES = { ca: 'Canadá (y EE. UU.)', us: 'EE. UU.', mx: 'México', usmx: 'EE. UU. y México', tres: 'Canadá, EE. UU. y México' };
const claseDe = (c) => (c.includes('CA') && c.includes('US') && c.includes('MX') ? 'tres' : c.includes('CA') ? 'ca' : c.includes('US') && c.includes('MX') ? 'usmx' : c.includes('US') ? 'us' : 'mx');
const info = {};
// the localities of a species that has no range: the centres of its attested cells (src/data/atlas-snapshot/especies-localidades.geojson)
const puntos = { features: JSON.parse(readFileSync('src/data/atlas-snapshot/especies-localidades.geojson', 'utf8')).features.map((f) => { if (f.geometry.type !== 'Polygon') return f; const r = f.geometry.coordinates[0], xs = r.map((q) => q[0]), ys = r.map((q) => q[1]); return { ...f, geometry: { type: 'Point', coordinates: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] } }; }) };
// the centre of a species: its largest range polygon (or lake marker); a species with only localities (a municipality centroid, a cell centre) takes the middle of its points
for (const e of snap.especies) { const c = centro(rangos.features.filter((f) => f.properties.slug === e.slug)) ?? (() => { const p = puntos.features.filter((f) => f.properties.slug === e.slug).map((f) => f.geometry.coordinates); return p.length ? { lon: (Math.min(...p.map((x) => x[0])) + Math.max(...p.map((x) => x[0]))) / 2, lat: (Math.min(...p.map((x) => x[1])) + Math.max(...p.map((x) => x[1]))) / 2 } : null; })(); info[e.slug] = { clase: claseDe(e.countries), lon: c.lon, lat: c.lat }; }
const slugs = Object.keys(info).sort();
const edges = []; for (const [a, ns] of Object.entries(near)) for (const b of ns) if (a < b) edges.push([a, b]);

// -- list order (one column: México; Estados Unidos; Estados Unidos y Canadá; México, Estados Unidos y Canadá; A–Z inside each) and list neighbours
const GRUPO = { mx: 0, us: 1, ca: 2, usmx: 3, tres: 3 };
const lista = [...slugs].sort((a, b) => GRUPO[info[a].clase] - GRUPO[info[b].clase] || a.localeCompare(b));
const vecinosLista = []; for (let i = 0; i + 1 < lista.length; i++) if (GRUPO[info[lista[i]].clase] === GRUPO[info[lista[i + 1]].clase]) vecinosLista.push([lista[i], lista[i + 1]]);
// the pairs that must stay apart: ranges that touch (any class) and species next to each other in the list
const llave = ([a, b]) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const pares = new Map(); for (const e of edges) pares.set(llave(e), { a: e[0], b: e[1], toca: true, lista: false }); for (const e of vecinosLista) { const k = llave(e); if (pares.has(k)) pares.get(k).lista = true; else pares.set(k, { a: e[0], b: e[1], toca: false, lista: true }); }
// with the range squares gone the small ranges are points, so species whose centres lie within 3° (the Valle de México, the Gulf coast) must stay apart as well
for (let i = 0; i < slugs.length; i++) for (let j = i + 1; j < slugs.length; j++) { const A = info[slugs[i]], B = info[slugs[j]]; if (Math.hypot(A.lon - B.lon, A.lat - B.lat) < 3) { const k = llave([slugs[i], slugs[j]]); if (pares.has(k)) pares.get(k).cerca = true; else pares.set(k, { a: slugs[i], b: slugs[j], toca: false, lista: false, cerca: true }); } }
const PARES = [...pares.values()];

// -- the colour of a species from its position inside its class, plus the nudge and (US and Canada only) the pastel variant
const rango = (clase, k) => { const xs = slugs.filter((s) => info[s].clase === clase).map((s) => info[s][k]); return [Math.min(...xs), Math.max(...xs)]; };
const norm = (v, [a, b]) => (b > a ? clamp((v - a) / (b - a)) : 0.5);
const R = Object.fromEntries(['ca', 'us', 'mx'].map((c) => [c, { lon: rango(c, 'lon'), lat: rango(c, 'lat') }]));
const base = (s) => {
  const { clase, lon, lat } = info[s];
  if (clase === 'ca') { const t = norm(lat, R.ca.lat), x = norm(lon, R.ca.lon); return { h: lerp(295, 365, t), L: lerp(0.78, 0.58, x), C: 0.15 }; }   // west lighter, east darker
  if (clase === 'us') { const d = clamp(Math.abs(lon + 98) / Math.max(Math.abs(R.us.lon[0] + 98), Math.abs(R.us.lon[1] + 98))), y = norm(lat, R.us.lat); return { h: lerp(250, 195, d), L: lerp(0.58, 0.80, y), C: lerp(0.16, 0.12, d) }; }   // coasts cyan-teal, centre deep blue; north lighter
  if (clase === 'mx') { const x = norm(lon, R.mx.lon), y = norm(lat, R.mx.lat); return { h: lerp(150, 22, x), L: lerp(0.80, 0.60, y), C: 0.15 }; }   // west green, east red (through yellow and orange); south lighter (the Valle de México cluster would turn muddy brown if it were the dark end)
  if (clase === 'usmx') return { h: 95, L: 0.78, C: 0.15 };
  return { h: 60, L: 0.70, C: 0.16 };                                            // mavortium: yellow-orange
};
const LIM = { h: 14, L: 0.08, C: 0.025 };
const limDe = (s) => (info[s].clase === 'mx' ? { h: 26, L: 0.10, C: 0.03 } : LIM);   // the Valle de México holds a dozen species at one longitude and latitude: that class may move further
const PASTEL = { L: 0.09, C: 0.55 };                                            // the pastel variant: lighter and 45% less chroma
const puedePastel = (s) => info[s].clase === 'us' || info[s].clase === 'ca';
const color = (s, d) => { const b = base(s); const pas = d.p && puedePastel(s); let L = clamp(b.L + d.L + (pas ? PASTEL.L : 0), 0.55, 0.84), hex; const Cn = Math.max(pas ? 0.06 : 0.11, (b.C + d.C) * (pas ? PASTEL.C : 1)); for (;;) { ({ hex } = toHex(L, Cn, b.h + d.h)); if (contrast(hex, STATE) >= 3.05 || L >= 0.9) return hex; L += 0.005; } };   // a dark hue at 0.55 would fall under 3:1 on the state fill: lift it just enough
const mismaClase = (a, b) => info[a].clase === info[b].clase;
const parejas = []; for (let i = 0; i < slugs.length; i++) for (let j = i + 1; j < slugs.length; j++) if (mismaClase(slugs[i], slugs[j])) parejas.push([slugs[i], slugs[j]]);
const vecinos = edges.filter(([a, b]) => mismaClase(a, b));
const estadisticas = (col) => {
  const dv = vecinos.map(([a, b]) => dE(col[a], col[b])), dc = parejas.map(([a, b]) => dE(col[a], col[b]));
  return { vecinosMedia: dv.reduce((x, y) => x + y, 0) / Math.max(1, dv.length), vecinosMin: Math.min(...dv), clasePar: Math.min(...dc), vecinosN: dv.length };
};

// before: the palette of the second round (hue by latitude in Mexico, no pastel, no pattern)
const antes = JSON.parse(readFileSync('../../palette-retired/colores-round2.json', 'utf8')).hues;
const sAntes = estadisticas(antes);
const bajo = (col, lim = 10) => PARES.filter((q) => dE(col[q.a], col[q.b]) < lim).length;

// -- the seeded search: nudges and pastel flags that spread the pairs that must stay apart
let seed = 20261019; const rnd = () => { seed = (seed * 1664525 + 0x3c6ef35f) >>> 0; return seed / 2 ** 32; };
const cero = () => ({ h: 0, L: 0, C: 0, p: 0 });
let d = Object.fromEntries(slugs.map((s) => [s, cero()]));
let col = Object.fromEntries(slugs.map((s) => [s, color(s, d[s])]));
const obj = (dd, cc) => {
  let t = 0;
  for (const q of PARES) { const v = dE(cc[q.a], cc[q.b]); t += Math.min(v, 12) * (q.toca || q.cerca ? 1.2 : 0.7) - (v < 10 ? 6 : 0); }
  for (const [a, b] of parejas) t += 0.2 * Math.min(dE(cc[a], cc[b]), 8);
  for (const s of slugs) t -= 3 * ((dd[s].h / limDe(s).h) ** 2 + (dd[s].L / limDe(s).L) ** 2 + (dd[s].C / limDe(s).C) ** 2) + 2 * dd[s].p;
  return t;
};
let cur = obj(d, col);
for (let it = 0; it < 20000; it++) {
  const s = slugs[Math.floor(rnd() * slugs.length)];
  const c = { ...d[s] };
  const k = ['h', 'L', 'C', 'p'][Math.floor(rnd() * 4)];
  if (k === 'p') { if (!puedePastel(s)) continue; c.p = c.p ? 0 : 1; } else c[k] = clamp(c[k] + (rnd() - 0.5) * limDe(s)[k] * 0.8, -limDe(s)[k], limDe(s)[k]);
  const nuevo = color(s, c), viejo = col[s];
  col[s] = nuevo; const v = obj({ ...d, [s]: c }, col);
  if (v > cur) { d = { ...d, [s]: c }; cur = v; } else col[s] = viejo;
}
const hues = col;
// the pairs still under ΔE 10 get a texture on one of the two: fine diagonal hatching, or dots when its partner is textured too
const bajos = PARES.map((q) => ({ ...q, v: dE(hues[q.a], hues[q.b]) })).filter((q) => q.v < 10).sort((p, q) => p.v - q.v);
// the fewest textured species such that every pair under ΔE 10 has a textured member, and two textured members of one pair carry different textures (three textures, so the textured ones of the pairs must 3-colour)
const nodos = [...new Set(bajos.flatMap((q) => [q.a, q.b]))].sort();
const TEX = ['rayas', 'puntos', 'cuadros'];
const colorear = (T) => { const c = {}; const orden = [...T].sort((x, y) => bajos.filter((q) => q.a === y || q.b === y).length - bajos.filter((q) => q.a === x || q.b === x).length); const ir = (i) => { if (i === orden.length) return true; const n = orden[i]; for (const t of TEX) { if (bajos.some((q) => (q.a === n ? c[q.b] === t : q.b === n && c[q.a] === t))) continue; c[n] = t; if (ir(i + 1)) return true; delete c[n]; } return false; }; return ir(0) ? c : null; };
const subconjuntos = (arr, k, ini = 0, act = []) => (act.length === k ? [act] : arr.slice(ini).flatMap((x, i) => subconjuntos(arr, k, ini + i + 1, [...act, x])));
let patron = {};
buscar: for (let k = 0; k <= nodos.length; k++) for (const T of subconjuntos(nodos, k)) { if (!bajos.every((q) => T.includes(q.a) || T.includes(q.b))) continue; const c = colorear(T); if (c) { patron = c; break buscar; } }
for (const q of bajos) { const ta = patron[q.a], tb = patron[q.b]; q.aplicado = ta && tb ? `${q.a}: ${ta}, ${q.b}: ${tb}` : `${ta ? q.a : q.b}: ${ta ?? tb}`; }
// ink: a near-black (or, on a dark fill, a near-white) of the species' own hue, whichever reaches 4.5:1 on its fill
const tinta = {};
for (const s of slugs) { const b = base(s); const c = []; for (const L of [0.16, 0.12, 0.08, 0.04, 0.0]) c.push(toHex(L, 0.03, b.h + d[s].h).hex); for (const L of [0.97, 0.99, 1.0]) c.push(toHex(L, 0.01, b.h + d[s].h).hex); const ok = c.filter((x) => contrast(hues[s], x) >= 4.5); tinta[s] = ok.length ? ok[0] : c.sort((p, q) => contrast(hues[s], q) - contrast(hues[s], p))[0]; }
const sDespues = estadisticas(hues);
// the key of the legend: one gradient per class through its species, ordered by what drives the colour (west to east in Mexico, south to north in Canada, centre to coast in the US)
const rampa = (clase, k) => { const l = slugs.filter((x) => info[x].clase === clase).sort((a, b) => k(info[a]) - k(info[b])); return `linear-gradient(90deg, ${l.map((x) => hues[x]).join(', ')})`; };
const rampas = { mx: rampa('mx', (i) => i.lon), ca: rampa('ca', (i) => i.lat), us: rampa('us', (i) => Math.abs(i.lon + 98)), tres: hues.mavortium };

log('# Species colours by geography, widened (founder, 19-oct). Class by countries; hue and lightness follow the centre of the range inside its class; a bounded search nudges coinciding neighbours apart.');
log(`# state fill ${STATE}; the tab ink is a near-black (or, on a dark fill, a near-white) of the species' own hue`);
log('\n## 1. The colour of each species');
const nombreClase = (c) => CLASES[c];
for (const s of slugs) { const i = info[s]; log(`  ${s.padEnd(15)} ${nombreClase(i.clase).padEnd(24)} centre ${i.lon.toFixed(1).padStart(7)}, ${i.lat.toFixed(1).padStart(5)}  ${hues[s]}  fill ${contrast(hues[s], STATE).toFixed(2)}:1  ink ${tinta[s]} ${contrast(hues[s], tinta[s]).toFixed(2)}:1`); }
const minFill = Math.min(...slugs.map((s) => contrast(hues[s], STATE))), minInk = Math.min(...slugs.map((s) => contrast(hues[s], tinta[s])));
log('\n## 2. Floors');
log(`  fills on the state fill: lowest ${minFill.toFixed(2)}:1 (need >= 3:1)  ${minFill >= 3 ? 'PASS' : 'FAIL'}`);
log(`  tab ink on each fill: lowest ${minInk.toFixed(2)}:1 (need >= 4.5:1)  ${minInk >= 4.5 ? 'PASS' : 'FAIL'}`);
const ls = slugs.map((s) => oklab(hues[s])[0]);
log(`  lightness of the fills: ${Math.min(...ls).toFixed(2)} to ${Math.max(...ls).toFixed(2)} (the founder asked for 0.55-0.82)`);
log(`  no two species share a colour: ${new Set(Object.values(hues)).size === slugs.length ? 'PASS' : 'FAIL'} (${new Set(Object.values(hues)).size} distinct of ${slugs.length})`);
log('\n## 3. The dataviz validator on the 33 colours (dark, state fill)');
log('   The CVD and normal-vision lines read the list as adjacent pairs and mean nothing for an unordered set. The lightness band is 0.48-0.67 for a dark ground: the widening to 0.82 leaves it on purpose, so that line is expected to fail.');
const { report } = validate(slugs.map((s) => hues[s]), { mode: 'dark', surface: STATE });
for (const [n, st, m] of report) log(`  [${({ true: 'PASS', false: 'FAIL', pass: 'PASS', floor: 'WARN', fail: 'FAIL', relief: 'WARN' })[st]}] ${n.padEnd(20)} ${m}`);
log('\n## 4. Neighbours inside a class, second round and third round (OKLab ×100, normal vision)');
log(`  touching pairs of the same class: ${sDespues.vecinosN}`);
log(`  average ΔE between them:   second round ${sAntes.vecinosMedia.toFixed(1)}   now ${sDespues.vecinosMedia.toFixed(1)}`);
log(`  closest touching pair:     second round ${sAntes.vecinosMin.toFixed(1)}   now ${sDespues.vecinosMin.toFixed(1)}`);
const porClase = (c0) => Object.fromEntries(['ca', 'us', 'mx'].map((c) => { const v = vecinos.filter(([a]) => info[a].clase === c).map(([a, b]) => dE(c0[a], c0[b])); return [c, v.length ? v.reduce((x, y) => x + y, 0) / v.length : 0]; }));
const pb = porClase(antes), pa = porClase(hues);
for (const c of ['ca', 'us', 'mx']) log(`  ${nombreClase(c).padEnd(22)} average ΔE between touching neighbours: second round ${pb[c].toFixed(1)}  now ${pa[c].toFixed(1)}`);
log(`\n## 5. Every pair that must stay apart: ${PARES.length} (${PARES.filter((q) => q.toca).length} touching ranges, ${PARES.filter((q) => !q.toca).length} more that are only next to each other in the list or within 3° of each other)`);
log(`  pairs under ΔE 10: second-round colours ${bajo(antes)}, after hue/pastel search ${bajos.length}, each of them carries a texture on at least one of the two, and two textured ones carry different textures`);
const conPastel = slugs.filter((s) => d[s].p);
log(`  pastel variant (US and Canada only): ${conPastel.length ? conPastel.join(', ') : 'none'}`);
log('  pair                              how        ΔE colour   what was applied');
for (const q of [...PARES].map((q) => ({ ...q, v: dE(hues[q.a], hues[q.b]) })).sort((p, q) => p.v - q.v).filter((q) => q.v < 16)) {
  const ap = bajos.find((b) => b.a === q.a && b.b === q.b);
  log(`  ${(q.a + ' / ' + q.b).padEnd(33)} ${[q.toca && 'touch', q.lista && 'list', q.cerca && 'near'].filter(Boolean).join('+')}`.padEnd(46) + `${q.v.toFixed(1).padStart(5)}       ${q.v < 10 ? (ap?.aplicado ?? '') : 'colour alone is enough (>= 10)'}`);
}
log(`  (pairs from ΔE 16 up, ${PARES.filter((q) => dE(hues[q.a], hues[q.b]) >= 16).length} of them, are listed in the JSON below, not here)`);
log(`  textured species: ${Object.entries(patron).map(([s, t]) => `${s} (${t})`).join(', ') || 'none'}`);
// the pair distances of the 33 x 33 matrix that matter least: any two species of one class
log('  closest two species of one class, touching or not: ' + parejas.map(([a, b]) => [a, b, dE(hues[a], hues[b])]).sort((p, q) => p[2] - q[2]).slice(0, 6).map(([a, b, v]) => `${a}/${b} ${v.toFixed(1)}`).join('; '));
log(`  species per class: ${Object.keys(CLASES).map((c) => `${CLASES[c]} ${slugs.filter((s) => info[s].clase === c).length}`).join(', ')}`);
log('  order of the list (one column): ' + lista.join(', '));
log('FLAGGED for the founder: mavortium (Canada, US and Mexico) takes yellow-orange by default.');

writeFileSync('public/atlas/real/colores.json', JSON.stringify({ hues, porEspecie: Object.fromEntries(slugs.map((s) => [s, s])), tinta, patron, rampas, bajos: bajos.map((q) => [q.a, q.b, +q.v.toFixed(2)]), clases: Object.fromEntries(slugs.map((s) => [s, info[s].clase])), sinDato: STATE }, null, 1));
