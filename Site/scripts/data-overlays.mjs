// Bake the 4 OBS stream overlays (Xovi Goal 5) from the canonical site data:
// transparent 1920×1080 frames, themed per species, with the station + species
// (top-left), the on-camera axolotl(s) — photo + identity, matching the app's
// "¿cuál y dónde?" avatar — (top-right), and the latest water telemetry + date +
// responsable (bottom band). Composited in OBS over the livestream — NOT rendered
// in any app, so the telemetry is baked at regeneration time.
//
//   npm run data:overlays   (runs after data:water in data:all / the weekly refresh)
//
// Always writes SVG (no hard dependency). Rasterises to transparent PNG when
// @resvg/resvg-js is installed; embeds axolotl photos when sharp is available
// (webp → PNG data-URI). Data:
//   water:    src/data/water-quality/measurements-mondays.json
//   tanks:    src/data/water-quality/tanks.json (volume)
//   axolotls: src/data/ajolotes/bundle.json (ejemplares[], by `pecera`)
//   photos:   public/photos/ajolotes/<slug>.webp
//   species:  brand colour + common name + locality (below — matches the site)
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "public/overlays");
const FONT_DIR = resolve(ROOT, "scripts/fonts");
const PHOTO_DIR = resolve(ROOT, "public/photos/ajolotes");

// Brand fonts (matches the site: Baloo 2 for titles, Montserrat for descriptions).
const TITLE_FONT = "'Baloo 2', system-ui, sans-serif";
const DESC_FONT = "'Montserrat', 'Helvetica Neue', Arial, sans-serif";

const measurements = JSON.parse(readFileSync(resolve(ROOT, "src/data/water-quality/measurements-mondays.json"), "utf8"));
const bundle = JSON.parse(readFileSync(resolve(ROOT, "src/data/ajolotes/bundle.json"), "utf8"));
const ejemplares = bundle.ejemplares ?? [];

// Per-species identity — colour + common name + locality, from the site's species
// content (src/content/species/*.yaml, scripts/species-overrides.json `accentColor`).
const SPECIES = {
  mexicanum: { sci: "Ambystoma mexicanum", common: "Axolote de Xochimilco", accent: "#2F5A70", lake: "Xochimilco, CDMX" },
  andersoni: { sci: "Ambystoma andersoni", common: "Achoque de Zacapu", accent: "#BD7A39", lake: "Laguna de Zacapu, Michoacán" },
  dumerilii: { sci: "Ambystoma dumerilii", common: "Achoque de Pátzcuaro", accent: "#356340", lake: "Lago de Pátzcuaro, Michoacán" },
};

// The 4 camera feeds. `water` is a fallback list (first tank with a reading wins —
// AM 4 has no separate reading, so it borrows the unified "AM" group). `pecera`
// keys the on-camera axolotl(s) in the ajolote bundle.
const OVERLAYS = [
  { code: "AA", station: "Acuario AA", species: "andersoni", water: ["AA"], pecera: "AA", volumeL: 106 },
  { code: "AD", station: "Acuario AD", species: "dumerilii", water: ["AD"], pecera: "AD", volumeL: 252 },
  { code: "AM1", station: "Acuario AM 1", species: "mexicanum", water: ["AM 1", "AM"], pecera: "AM1", volumeL: 67 },
  { code: "AM4", station: "Acuario AM 4", species: "mexicanum", water: ["AM 4", "AM"], pecera: "AM4", volumeL: null },
];

// Water metrics in the bottom band (key, label, unit). Nulls → "—".
const METRICS = [
  ["temp", "Temp", "°C"],
  ["ph", "pH", ""],
  ["nh3", "NH₃", ""],
  ["no2", "NO₂", ""],
  ["no3", "NO₃", ""],
  ["gh", "GH", ""],
  ["kh", "KH", ""],
  ["cond", "Cond", "µS"],
];

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = v => (v == null || Number.isNaN(v) ? "—" : typeof v === "number" ? String(Math.round(v * 10) / 10) : String(v));
const shortActor = a => (a && a !== "NA" ? String(a).replace(/\.axolodao\.eth$/, "") : "—");
const genero = g => (g === "Hembra" ? "♀" : g === "Macho" ? "♂" : "");
// Keep the fenotipo to the primary morph so the rightmost avatar caption never
// runs off the 1920 edge ("Verde oliva / Pardo uniforme" → "Verde oliva").
const shortFeno = f => {
  const s = String(f ?? "")
    .split("/")[0]
    .trim();
  return s.length > 22 ? `${s.slice(0, 21)}…` : s;
};

// Same alias→slug rule the photo manifest uses ("Tamal de dulce" → "tamal-de-dulce").
const aliasSlug = a =>
  String(a)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Lighten a brand hex toward white so the dark species colours stay legible as text
// on the dark band. Solid elements (avatar ring, accent bar) keep the pure colour.
function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const m = c => Math.round(c + (255 - c) * amt);
  return `#${((1 << 24) + (m(r) << 16) + (m(g) << 8) + m(b)).toString(16).slice(1)}`;
}

function latestWater(tankIds) {
  for (const tank of tankIds) {
    const rows = measurements.filter(m => m.tankId === tank).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (rows.length) return { ...rows[0], usedTank: tank };
  }
  return null;
}

function metricCell(x, label, value, unit, isAlarm, species) {
  // Value in the species colour; out-of-range stays amber (a welfare signal).
  const valColor = isAlarm ? "#ffd24d" : species;
  const dot = isAlarm ? `<circle cx="${x}" cy="960" r="5" fill="#ffd24d"/>` : "";
  return `
    ${dot}
    <text x="${x + (isAlarm ? 14 : 0)}" y="966" font-size="22" font-weight="700" fill="#f2f8f8" letter-spacing="0.5">${esc(label)}</text>
    <text x="${x}" y="1006" font-size="35" font-weight="800" fill="${valColor}">${esc(fmt(value))}<tspan font-size="20" font-weight="700" fill="#e6f1f1"> ${esc(unit)}</tspan></text>`;
}

function avatarSvg(cx, cy, r, dataUri, alias, accent, id) {
  if (dataUri) {
    return `
    <clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    <image href="${dataUri}" x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${accent}" stroke-width="4"/>`;
  }
  // Fallback (missing photo): species-tinted circle + initial, like the app avatar.
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${accent}" stroke="#ffffff" stroke-width="2" opacity="0.92"/>
    <text x="${cx}" y="${cy + r * 0.34}" text-anchor="middle" font-family="${TITLE_FONT}" font-size="${r}" font-weight="800" fill="#ffffff">${esc(alias.charAt(0).toUpperCase())}</text>`;
}

function buildSvg(o, avatarBySlug) {
  const sp = SPECIES[o.species];
  // Species hue for titles / axolotl names / water values — lifted toward white so
  // it stays legible as TEXT over the video (the pure colour stays on solid fills:
  // accent bar, avatar ring). No background band — a drop shadow carries legibility.
  const accent = lighten(sp.accent, 0.32);
  const TXT = "#f2f8f8"; // near-white for descriptions
  const specimens = ejemplares.filter(e => e.pecera === o.pecera);

  // Top-right: one avatar column per on-camera axolotl (photo + name + género + fenotipo).
  const cy = 74;
  const r = 52;
  const colW = 300;
  const baseX = 1778; // rightmost column centre — keeps the longest subtitle title-safe
  const columns = specimens
    .map((s, i) => {
      const cx = baseX - (specimens.length - 1 - i) * colW;
      const av = avatarSvg(cx, cy, r, avatarBySlug[aliasSlug(s.alias)], s.alias, sp.accent, `av-${o.code}-${i}`);
      // género (Hembra/Macho/Sin sexar) shown as a WORD, not a ♀/♂ symbol: the
      // symbol isn't in Baloo 2 or the Montserrat latin subset, and a missing glyph
      // makes resvg fall the WHOLE text run back to a default font (only "Remo" —
      // Sin sexar, no symbol — stayed correct). A word keeps género without breaking
      // the font. Name = pure Baloo 2; subtitle = género word + fenotipo, Montserrat.
      const sexo = s.genero === "Hembra" ? "Hembra" : s.genero === "Macho" ? "Macho" : "";
      const sub0 = [sexo, shortFeno(s.fenotipo)].filter(Boolean).join(" · ");
      const subtitle = sub0.length > 24 ? `${sub0.slice(0, 23)}…` : sub0; // never runs off the 1920 edge
      return `${av}
    <text x="${cx}" y="160" text-anchor="middle" font-family="${TITLE_FONT}" font-size="26" font-weight="800" fill="${accent}">${esc(s.alias)}</text>
    <text x="${cx}" y="186" text-anchor="middle" font-size="18" font-weight="700" fill="${TXT}" opacity="0.97">${esc(subtitle)}</text>`;
    })
    .join("");

  const w = latestWater(o.water);
  const alarms = new Set(w?.alarms ?? []);
  const cells = METRICS.map(([key, label, unit], i) =>
    metricCell(48 + i * 158, label, w?.values?.[key], unit, alarms.has(key), accent),
  ).join("");
  const provenance = w
    ? `Medición ${esc(w.date)} · ${esc(shortActor(w.authors?.main))}${w.usedTank !== o.water[0] ? ` · sistema ${esc(w.usedTank)}` : ""}`
    : "Sin medición reciente";
  const locality = `${o.volumeL ? `${o.volumeL} L · ` : ""}${esc(sp.lake)}`;

  // No shade band — a soft dark drop shadow keeps the (species-coloured) text and
  // avatars legible directly over the livestream, so the video is never dimmed.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="${DESC_FONT}">
  <defs>
    <filter id="ds" x="-6%" y="-6%" width="112%" height="112%">
      <feDropShadow dx="0" dy="2" stdDeviation="3.2" flood-color="#01121a" flood-opacity="0.95"/>
    </filter>
  </defs>
  <g filter="url(#ds)">
    <rect x="0" y="20" width="9" height="150" rx="4" fill="${sp.accent}"/>
    <text x="40" y="66" font-family="${TITLE_FONT}" font-size="48" font-weight="800" fill="${accent}" letter-spacing="0.5">${esc(o.station)}</text>
    <text x="42" y="108" font-size="27" font-weight="700" fill="${TXT}" opacity="0.97">${esc(sp.sci)} · ${esc(sp.common)}</text>
    <text x="42" y="142" font-size="22" font-weight="700" fill="${TXT}" opacity="0.88">${locality}</text>
    ${columns}
    ${cells}
    <text x="1872" y="958" text-anchor="end" font-size="20" font-weight="700" fill="${TXT}" opacity="0.82" letter-spacing="1">CALIDAD DEL AGUA</text>
    <text x="1872" y="1006" text-anchor="end" font-size="22" font-weight="700" fill="${TXT}" opacity="0.92">${provenance}</text>
  </g>
</svg>
`;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  let Resvg = null;
  try {
    ({ Resvg } = await import("@resvg/resvg-js"));
  } catch {
    console.log("  @resvg/resvg-js not installed — writing SVG only (install it for PNG).");
  }
  let sharp = null;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.log("  sharp not available — axolotl photos fall back to initials.");
  }

  // resvg rasterises with on-disk fonts (not web fonts) — register the vendored
  // Baloo 2 / Montserrat .ttf so the PNGs render the brand fonts, not a fallback.
  let fontFiles = [];
  try {
    fontFiles = readdirSync(FONT_DIR)
      .filter(f => /\.(ttf|otf)$/i.test(f))
      .map(f => resolve(FONT_DIR, f));
  } catch {
    /* no vendored fonts — resvg falls back to a system sans */
  }

  // Pre-render every needed avatar once: webp → 180px PNG data-URI (resvg embeds
  // PNG cleanly; browsers do too). Keyed by slug. Missing/decoder-less → no entry.
  const avatarBySlug = {};
  const slugs = [...new Set(OVERLAYS.flatMap(o => ejemplares.filter(e => e.pecera === o.pecera).map(e => aliasSlug(e.alias))))];
  for (const slug of slugs) {
    if (!sharp) break;
    try {
      const buf = await sharp(resolve(PHOTO_DIR, `${slug}.webp`)).resize(180, 180, { fit: "cover" }).png().toBuffer();
      avatarBySlug[slug] = `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      /* no photo for this slug — avatarSvg renders the initial fallback */
    }
  }

  for (const o of OVERLAYS) {
    const svg = buildSvg(o, avatarBySlug);
    writeFileSync(resolve(OUT_DIR, `overlay-${o.code}.svg`), svg);
    let pngNote = "";
    if (Resvg) {
      const r = new Resvg(svg, {
        background: "rgba(0,0,0,0)",
        fitTo: { mode: "width", value: 1920 },
        font: { fontFiles, loadSystemFonts: true, defaultFontFamily: "Montserrat" },
      });
      writeFileSync(resolve(OUT_DIR, `overlay-${o.code}.png`), r.render().asPng());
      pngNote = " + .png";
    }
    console.log(`  overlay-${o.code}.svg${pngNote}  (${o.species})`);
  }
  console.log(`  Done — ${OVERLAYS.length} overlay(s) in public/overlays/.`);
}

main().catch(err => {
  console.error("Overlay bake failed:", err);
  process.exit(1);
});
