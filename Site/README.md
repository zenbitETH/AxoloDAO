<!-- STAGING HEADER — STRIP THIS COMMENT BEFORE COMMITTING TO THE PUBLIC REPO
---
title: AxoloDAO Landing Site — README (refreshed)
audience: Kira (Protocol Engineer, Zenbit)
date: 2026-09-02
status: draft for review
---
Rationale for the comment wrapper: this file ships to a PUBLIC repository, where a rendered
`audience:` frontmatter block would be both meaningless to readers and an unnecessary disclosure.
The dossier frontmatter is preserved here for the review pass and MUST NOT be committed.
GATE (run before any commit to the public repo; must return nothing):
    grep -n "STAGING HEADER" README.md Site/README.md
-->

# AxoloDAO Landing Site

Astro 5 + Preact + Tailwind. Trilingual (ES default, EN, PT). Static output, deployed on Vercel at
[axolodao.org](https://axolodao.org).

The site is the **render surface for the Biomuseo Xolotlcalli record**: the operations workbook and a
handful of source asset folders go in, committed JSON and static pages come out. Nothing is fetched at
runtime except three files this same build produces: `public/map/mexico-interactive.svg`,
`public/map/state-bboxes.json` and `public/data/water-quality/measurements-all.json` (source:
`src/components/SpeciesExplorer.tsx:164,173` and `src/components/waterQuality/WaterQualityDashboard.tsx:192`,
2026-09-02).

```text
 Operations workbook (.xlsx)                    Hand-edited YAML
 path from $AXOLODAO_XLSX                       src/content/{members,partners,projects,news}/
        │                                                       │
        │  data:water · data:ajolotes · data:ops                │
        ▼                                                       │
 ┌── generated JSON (committed) ───────────────────────────┐    │
 │ src/data/water-quality/*   src/data/ajolotes/bundle.json│    │
 │ src/data/ops/*            public/data/**  public/map/** │    │
 └───────────────────────────┬─────────────────────────────┘    │
                             │                                  │
 MapAssets/ ──── data:map ───┼──► public/map/mexico-interactive.svg
 AmbystomaSpecies/ ─ data:species ─► src/content/species/*.yaml  │
                             ▼                                  ▼
             ┌───────── Astro 5 static build · es | en | pt ──────────┐
             │  /  /especies  /xolotlcalli  /xolotlcalli/ajolotes    │
             │  /xolotlcalli/qr  (+ /conceptos, /especies/[slug])    │
             └───────────────────────────┬────────────────────────────┘
                                         ▼   dist/  →  Vercel
   visitor standing at a tank ── scans the printed QR ──► /xolotlcalli#AA · #AM1…#AM4 · #AD
```

## Quick start

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # static output to dist/
npm run check        # astro check (TypeScript + template diagnostics)
```

## Content model

Astro content collections are declared in `src/content/config.ts`: `members`, `partners`, `projects`,
`species` and `news`. All five are `type: 'data'` (YAML, no MDX bodies), and every user-facing string is
a `{ es, en, pt }` object validated by Zod.

| Collection | Edited by hand? | Current entries |
|---|---|---|
| `src/content/members/` | yes | 3 (source: `src/content/members/`, measured 2026-09-02) |
| `src/content/partners/` | yes | 4 (source: `src/content/partners/`, measured 2026-09-02) |
| `src/content/projects/` | yes | 3 (source: `src/content/projects/`, measured 2026-09-02) |
| `src/content/news/` | yes | 26 (source: `src/content/news/`, measured 2026-09-02) |
| `src/content/species/` | **no — generated** | 17 (source: `src/content/species/`, measured 2026-09-02) |

## Data scripts

Six one-shot Node scripts, all declared in `package.json` (source: `package.json`, 2026-09-02). Three of
them read the **operations workbook** maintained by the Biomuseo Xolotlcalli team; the other three work
from asset folders inside the repository.

```bash
npm run data:map        # MapAssets/            -> public/map/mexico-interactive.svg
npm run data:species    # AmbystomaSpecies/     -> src/content/species/*.yaml
npm run data:tables     # src/content/*         -> docs/data-tables/*.md
npm run data:water      # workbook              -> src/data/water-quality/* + public/data/water-quality/*
npm run data:ajolotes   # workbook              -> src/data/ajolotes/bundle.json
npm run data:ops        # workbook              -> src/data/ops/* + public/data/ops/*
npm run data:all        # all six, in the order above
```

### The workbook path is an environment variable, never a checked-in path

`data:water`, `data:ajolotes` and `data:ops` resolve the workbook through `resolveXlsxPath()` in
`scripts/lib/xlsx-utils.mjs`, which reads **`AXOLODAO_XLSX`** and throws if it is unset (source:
`scripts/lib/xlsx-utils.mjs:21-30`, 2026-09-02). The workbook itself is not in this repository and its
location is not recorded anywhere in it — point the variable at your own copy:

```bash
AXOLODAO_XLSX="/path/to/Control operativo AxoloDAO.xlsx" npm run data:all
```

### `data:map` — interactive Mexico map

Reads `MapAssets/MapCanvas.svg` (39 unnamed paths: 32 states + 7 distribution overlays), fingerprints each
path, matches the 32 largest against the individual `MX*.svg` state files, and writes
`public/map/mexico-interactive.svg` with `id="MX-XXX"` attributes (source: `scripts/tag-mexico-map.mjs:1-25`,
2026-09-02). It also emits `public/map/state-bboxes.json`.

### `data:species` — species sheets

Parses the 17 Notion-exported `A_*.html` files in `AmbystomaSpecies/`, cross-references the master CSV to
reconcile state lists, and writes one YAML per species into `src/content/species/` (source:
`scripts/extract-species.mjs:1-22`, 2026-09-02). Field-level and state-level corrections live in
`scripts/species-overrides.json` and `scripts/species-state-overrides.json`.

### `data:tables` — build dashboard

Reads the YAML in `src/content/{members,partners,projects,species}/` and writes human-readable Markdown
tables to `docs/data-tables/` (`members.md`, `partners.md`, `projects.md`, `species.md`). These tables are a
control dashboard for humans; **the build does not depend on them** (source:
`scripts/build-control-tables.mjs:1-8`, 2026-09-02).

### `data:water` — water-quality dashboard

Sheets consumed: `Descripcion de sistemas`, `Catálogo de parámetros`, `Dashboard calidad de agua`,
`Calidad de agua` (source: `scripts/data-water.mjs`, 2026-09-02).

| Output | Contents | Current size |
|---|---|---|
| `src/data/water-quality/tanks.json` | one entry per water system: species, display name, volume, accent colour, and the physical system description (dimensions, tank type, filter, cooling, aeration) | 8 systems (measured 2026-09-02) |
| `src/data/water-quality/parameters.json` | per-system, per-parameter reference row: `tankId`, `speciesCode`, `key`, `unit`, `min`, `max`, `target` | 60 rows (measured 2026-09-02) |
| `src/data/water-quality/dashboard-agua.json` | the workbook's own dashboard view: historical average, last measurement, clinical status, limits | 40 rows (measured 2026-09-02) |
| `src/data/water-quality/measurements-mondays.json` | default view — the Monday round only | 113 rows (measured 2026-09-02) |
| `public/data/water-quality/measurements-all.json` | full measurement history, fetched lazily by the client when the visitor switches off "Mondays only" | 1,128 rows (measured 2026-09-02) |

Ten parameters are tracked: `temp`, `nh3`, `no2`, `no3`, `gh`, `kh`, `ph`, `po4`, `cond`, `tds` (source:
`scripts/data-water.mjs:41`, 2026-09-02). Each measurement row carries the date and time, the system id,
the recorded values, and the list of parameters out of range for that reading.

### `data:ajolotes` — per-axolotl explorer

Emits a single `src/data/ajolotes/bundle.json` holding, per specimen, the dashboard snapshot, medical
history, feeding plan, feeding log, therapeutic records and the colony's historical records — sourced from
six sheets in the workbook, among them `Dashboard ejemplares`, `Historial medico`, `Plan de alimentación`,
`Alimentación 2.0` and `Terapéutica y Hospital` (source: `scripts/data-ajolotes.mjs:183,290,379,418,610`,
2026-09-02). The current bundle
holds **11 ejemplares** (source: `src/data/ajolotes/bundle.json`, measured 2026-09-02).

The script rebuilds the bundle from scratch on every run — no merge logic, so the same workbook always
produces byte-identical output. Two small maps reconcile spelling variants between the workbook and the site:
`ALIAS_NORMALIZE` in `scripts/lib/xlsx-utils.mjs` folds spelling variants so the structured alias joins do
not silently miss a row, and `TEXT_RENAMES` in `scripts/data-ajolotes.mjs` applies whole-word display
renames to free-text prose only — deliberately kept separate, because folding a spelling variant into prose
would rewrite what the operator actually wrote. Drop an entry from either map once the source spelling is
unified.

### `data:ops` — bitácora, calendar, shifts

Sheets consumed: `Bitacora`, `Bitacora de mantenimiento de ag`, `Calendario de actividades`,
`Rol de turnos` (source: `scripts/data-ops.mjs`, 2026-09-02).

| Output | Contents | Current size |
|---|---|---|
| `public/data/ops/bitacora.json` | full operations log, generated and committed; not currently consumed by the build or the client | 1,229 events (measured 2026-09-02) |
| `src/data/ops/bitacora-recent.json` | rolling 90-day window, inlined into the page | 1,020 events (measured 2026-09-02) |
| `src/data/ops/personnel.json` | `{ actividades[], turnos[] }` — the activity calendar and the shift roster | 61 actividades, 16 turnos (measured 2026-09-02) |

A bitácora row can carry both an `Alias` (a per-specimen event) and a `Ubicación` (a per-system event); the
specimen modal and the water page filter the same array by different keys.

## Generated output is not editable

Everything under these paths is **regenerated from scratch** on the next run. Editing a generated file is
lost work — fix the script, the override JSON, or the upstream workbook instead:

- `src/data/water-quality/**`, `public/data/water-quality/**`
- `src/data/ajolotes/**`
- `src/data/ops/**`, `public/data/ops/**`
- `src/content/species/**`
- `public/map/**`
- `docs/data-tables/**`

Hand-editable **content** is `src/content/{members,partners,projects,news}/`, plus
`src/data/podcast-episodes.json` and `src/data/supporters.ts`. Hand-edited **configuration** lives in
`src/i18n/strings.ts`, `src/components/waterQuality/amAquariums.ts` and the override JSONs under `scripts/`
(`species-overrides.json`, `species-state-overrides.json`, and `state-path-overrides.json` if you create it).

## The QR sheet — how a visitor enters the site

`/xolotlcalli/qr` renders a printable sheet of QR cards, one per station, from
`src/components/QrSheet.astro`. Each tank card is a QR + label + call to action in its species accent colour;
the two extra cards use their own brand colours (source: `src/components/QrSheet.astro:70-89`, 2026-09-03).
Every card can be exported individually to PNG or SVG from the browser. The sheet is printed and a card is
placed next to its aquarium; a visitor scanning it lands directly on that station's detail view.

| Card | Anchor | Destination |
|---|---|---|
| AA — *Ambystoma andersoni* | `#AA` | `/xolotlcalli#AA` |
| AM1 … AM4 — *Ambystoma mexicanum* | `#AM1` … `#AM4` | `/xolotlcalli#AM1` … `#AM4` |
| AD — *Ambystoma dumerilii* | `#AD` | `/xolotlcalli#AD` |
| Mapa | `#mapa` | `/#mapa` — the species map on the home page |
| Xovi | — | `https://xovi.axolodao.org/` |

Eight cards in total: six tank stations plus two extra destinations (source:
`src/components/QrSheet.astro`, 2026-09-03). There used to be a ninth, `Xovi
Testnet`, pointing at `xovi-testnet.vercel.app`. It was dropped: this sheet gets
printed and taped next to an aquarium, which is the worst place to leave a
pointer at a test deployment.

Two invariants keep the printed paper and the running site in lockstep:

1. **`src/components/waterQuality/amAquariums.ts` is the single source of truth** for the AM station. The AM
   system is one recirculating loop physically made of four aquariums; water has been measured once for the
   whole AM system since 2026-06-15, while `AM 1`, `AM 2` and `AM Larvas` remain in `tanks.json` as historical
   water systems (94, 102 and 19 rows, last dated 2026-04-27, 2026-04-27 and 2026-06-15 — source:
   `public/data/water-quality/measurements-all.json`, measured 2026-09-02). That is why `tanks.json` lists
   8 water systems while the QR sheet prints 6 tank stations: the three historical AM systems collapsed into
   `AM`, and `Llave` and `Guppies` are logged but have no visitor-facing station. Each aquarium houses a
   different set of axolotls and gets its own anchor and its own QR; the printable cards, the hash anchors and
   the per-aquarium occupancy tiles all derive from that one array, and `id` matches the canonical aquarium
   value in `AM_PECERA` (`scripts/data-ajolotes.mjs:151-162`) exactly — not the workbook's own location column.
   Moving a specimen between AM aquariums means editing both files; nothing enforces the pairing.
2. **Anchors must be DOM-id safe** (no spaces) — `WaterQualityDashboard.tsx` resolves the hash on load *and*
   on `hashchange`, so a printed code keeps working when the visitor scans a second tank without reloading.

`AjolotesExplorer.tsx` follows the same hash pattern, so a deep link into a specimen behaves like a station
deep link.

The QR sheet exists in all three locales: `/xolotlcalli/qr`, `/en/xolotlcalli/qr`, `/pt/xolotlcalli/qr`.

## Internationalisation

Configured in `astro.config.mjs` (source: `astro.config.mjs`, 2026-09-02):

- `defaultLocale: 'es'`, `locales: ['es', 'en', 'pt']`
- `prefixDefaultLocale: false` and `redirectToDefaultLocale: false` — Spanish lives at the root (`/`,
  `/especies`, `/xolotlcalli`), English under `/en/`, Portuguese under `/pt/`
- `fallback: { en: 'es', pt: 'es' }` — a missing English or Portuguese route falls back to Spanish rather
  than 404ing
- `@astrojs/sitemap` emits the `es-MX` / `en-US` / `pt-BR` alternates

UI strings live in `src/i18n/strings.ts`; content strings live inside each YAML entry as `{ es, en, pt }`,
enforced by the Zod schemas in `src/content/config.ts`. Adding a locale means touching all three places plus
a page file per route under `src/pages/<locale>/`.

## Map state ID validation

`scripts/tag-mexico-map.mjs` matches each `<path>` in `MapCanvas.svg` to one of the `MX*.svg` state files by
shape fingerprinting. If a state ends up tagged with the wrong code, create `scripts/state-path-overrides.json`
— the file is not in the repository and the script loads it only if present (source:
`scripts/tag-mexico-map.mjs:158-163`, 2026-09-02):

```json
{
  "12": "JAL",
  "17": "MIC"
}
```

Path indices are 0-based, in the original document order of `MapCanvas.svg`.

## Deployment

**Vercel** (production). Connect the repository, set the root directory to `Site/`, and the framework is
auto-detected. `vercel.json` pins `framework: astro`, `buildCommand: npm run build`,
`outputDirectory: dist`, `trailingSlash: false`, and sets one-year immutable cache headers for `*.svg` and
`/_astro/*` (source: `vercel.json`, 2026-09-02). `astro.config.mjs` sets `site: 'https://axolodao.org'` and
`output: 'static'`; `vite.build.assetsInlineLimit: 0` keeps every asset a real file so those cache headers
actually apply.

Analytics is `@vercel/analytics` only — aggregate page views. The site collects no visitor identity: no
forms, no accounts, no wallet connection.

**Static fallback.** `npm run build` produces a `dist/` folder of pure static files that can be dropped into
any web root, including cPanel `public_html`. Nothing in the build needs a server runtime.

## Related

- `README.md` at the repository root — what AxoloDAO is, the ENS/Safe structure, and how this site relates to
  Xovi and the onchain system.
- `Docs/{English,Español,Portugues}/` — conceptual documentation.
