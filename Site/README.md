# AxoloDAO Landing Site

Astro 5 + Preact + Tailwind. Trilingual (ES default, EN, PT). Static output, ready for Vercel.

## Quick start

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # static output to dist/
```

## Data scripts (one-shot)

The site reads from YAML files under `src/content/`. Two of those folders are generated from the source assets in `MapAssets/` and `AmbystomaSpecies/`:

```bash
npm run data:map        # tag MapCanvas.svg paths -> src/assets/mexico-interactive.svg
npm run data:species    # parse Notion HTML files -> src/content/species/*.yaml
npm run data:tables     # generate control tables -> docs/data-tables/*.md
npm run data:all        # all of the above
```

Hand-editable YAML lives in `src/content/{members,partners,projects}/`. The species YAMLs are regenerated, so direct edits there will be overwritten — fix the parser instead.

## Map state ID validation

`scripts/tag-mexico-map.mjs` matches each `<path>` in `MapCanvas.svg` to one of the `MX*.svg` state files via shape fingerprinting. If a state ends up tagged with the wrong code, add a manual override to `scripts/state-path-overrides.json`:

```json
{
  "12": "JAL",
  "17": "MIC"
}
```

(Path indices are 0-based, in the original document order of `MapCanvas.svg`.)

## Deployment

Vercel: connect the repo, set the root to `Site/`, the framework auto-detects. `vercel.json` adds long-lived cache headers for SVG and `_astro/` assets.

cPanel fallback: `npm run build` produces a `dist/` folder of pure static files. Drop into `public_html`.

## Control tables

After running `npm run data:tables`, `docs/data-tables/*.md` contains human-readable tables of all members, partners, projects and species — useful as a build dashboard.
 