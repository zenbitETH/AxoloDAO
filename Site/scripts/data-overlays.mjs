// Bake the 4 OBS stream overlays (Xovi Goal 5) from the canonical site data:
// transparent 1920×1080 frames with the station (top-left), the on-camera
// axolotl(s) (top-right), and the latest water telemetry + measurement date +
// responsable (bottom band). Composited in OBS over the livestream — NOT rendered
// in any app, so the telemetry is baked at regeneration time.
//
//   npm run data:overlays   (runs after data:water in data:all / the weekly refresh)
//
// Always writes SVG (no dependency). If @resvg/resvg-js is installed it ALSO
// rasterises to transparent PNG (the format most OBS Image Sources want). Data:
//   water:     src/data/water-quality/measurements-mondays.json
//   axolotls:  src/data/ajolotes/bundle.json  (ejemplares[], keyed by `pecera`)
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "public/overlays");

const measurements = JSON.parse(readFileSync(resolve(ROOT, "src/data/water-quality/measurements-mondays.json"), "utf8"));
const bundle = JSON.parse(readFileSync(resolve(ROOT, "src/data/ajolotes/bundle.json"), "utf8"));
const ejemplares = bundle.ejemplares ?? [];

// The 4 camera feeds. `water` is a fallback list (first tank with a reading wins —
// AM 4 has no separate reading, so it borrows the unified "AM" group). `pecera`
// keys the on-camera axolotl(s) in the ajolote bundle.
const OVERLAYS = [
  { code: "AA", station: "Acuario AA", species: "Ambystoma andersoni", water: ["AA"], pecera: "AA" },
  { code: "AD", station: "Acuario AD", species: "Ambystoma dumerilii", water: ["AD"], pecera: "AD" },
  { code: "AM1", station: "Acuario AM 1", species: "Ambystoma mexicanum", water: ["AM 1", "AM"], pecera: "AM1" },
  { code: "AM4", station: "Acuario AM 4", species: "Ambystoma mexicanum", water: ["AM 4", "AM"], pecera: "AM4" },
];

// Water metrics rendered in the bottom band (key, label, unit). Nulls → "—".
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

function latestWater(tankIds) {
  for (const tank of tankIds) {
    const rows = measurements
      .filter(m => m.tankId === tank)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (rows.length) return { ...rows[0], usedTank: tank };
  }
  return null;
}

function metricCell(x, label, value, unit, isAlarm) {
  const valColor = isAlarm ? "#ffcf72" : "#ffffff";
  const dot = isAlarm ? `<circle cx="${x}" cy="960" r="5" fill="#ffcf72"/>` : "";
  return `
    ${dot}
    <text x="${x + (isAlarm ? 14 : 0)}" y="966" font-size="22" font-weight="700" fill="#34eeb6" letter-spacing="0.5">${esc(label)}</text>
    <text x="${x}" y="1006" font-size="34" font-weight="800" fill="${valColor}">${esc(fmt(value))}<tspan font-size="20" font-weight="500" fill="#cfe8e8"> ${esc(unit)}</tspan></text>`;
}

function buildSvg(o) {
  const specimens = ejemplares.filter(e => e.pecera === o.pecera);
  const names = specimens.length ? specimens.map(s => esc(s.alias)).join("  ·  ") : "—";
  const traits =
    specimens.length === 1
      ? [specimens[0].genero, specimens[0].estadio, specimens[0].fenotipo].filter(Boolean).map(esc).join(" · ")
      : `${specimens.length} ejemplares`;

  const w = latestWater(o.water);
  const alarms = new Set(w?.alarms ?? []);
  // 8 cells spread across the left ~1300px so they never collide with the
  // right-aligned provenance (incl. AM4's longer "· sistema AM" fallback note).
  const cells = METRICS.map(([key, label, unit], i) =>
    metricCell(48 + i * 158, label, w?.values?.[key], unit, alarms.has(key)),
  ).join("");

  const provenance = w
    ? `Medición ${esc(w.date)} · ${esc(shortActor(w.authors?.main))}${w.usedTank !== o.water[0] ? ` · sistema ${esc(w.usedTank)}` : ""}`
    : "Sin medición reciente";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="'Segoe UI', 'Helvetica Neue', Arial, sans-serif">
  <defs>
    <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#06222b" stop-opacity="0.84"/>
      <stop offset="1" stop-color="#06222b" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="bot" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#06222b" stop-opacity="0.88"/>
      <stop offset="1" stop-color="#06222b" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="1920" height="156" fill="url(#top)"/>
  <text x="48" y="60" font-size="38" font-weight="800" fill="#34eeb6" letter-spacing="1">${esc(o.station)}</text>
  <text x="48" y="100" font-size="25" font-style="italic" fill="#e8f6f6" opacity="0.8">${esc(o.species)}</text>
  <text x="1872" y="56" text-anchor="end" font-size="32" font-weight="800" fill="#ffffff">${names}</text>
  <text x="1872" y="94" text-anchor="end" font-size="22" fill="#ffcf72" opacity="0.92">${traits}</text>

  <rect x="0" y="924" width="1920" height="156" fill="url(#bot)"/>
  ${cells}
  <text x="1872" y="958" text-anchor="end" font-size="20" fill="#34eeb6" opacity="0.7" letter-spacing="1">CALIDAD DEL AGUA</text>
  <text x="1872" y="1006" text-anchor="end" font-size="22" font-weight="600" fill="#e8f6f6" opacity="0.85">${provenance}</text>
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

  for (const o of OVERLAYS) {
    const svg = buildSvg(o);
    const svgPath = resolve(OUT_DIR, `overlay-${o.code}.svg`);
    writeFileSync(svgPath, svg);
    let pngNote = "";
    if (Resvg) {
      const r = new Resvg(svg, { background: "rgba(0,0,0,0)", fitTo: { mode: "width", value: 1920 } });
      writeFileSync(resolve(OUT_DIR, `overlay-${o.code}.png`), r.render().asPng());
      pngNote = " + .png";
    }
    console.log(`  overlay-${o.code}.svg${pngNote}`);
  }
  console.log(`  Done — ${OVERLAYS.length} overlay(s) in public/overlays/.`);
}

main().catch(err => {
  console.error("Overlay bake failed:", err);
  process.exit(1);
});
