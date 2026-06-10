# Vendored fonts (OBS overlay rasterisation)

`scripts/data-overlays.mjs` rasterises the overlays with `@resvg/resvg-js`, which
renders with on-disk fonts (not the site's web fonts). These TTFs match the site's
type system: **Baloo 2** for titles + axolotl names, **Montserrat** for descriptions.

**Static per-weight faces** (the ones that matter): resvg renders a *variable*
font only at its default weight (≈400), so `font-weight` was silently ignored and
text came out thin. The static weights below let resvg match `font-family +
font-weight` to a real bold/semibold face:

- `Baloo2-{600,700,800}.ttf`
- `Montserrat-{500,600,700,800}.ttf`, `Montserrat-600-italic.ttf`

**Variable faces** (`Baloo2[wght].ttf`, `Montserrat[wght].ttf`,
`Montserrat-Italic[wght].ttf`) are kept only for **glyph fallback** — the static
latin subsets omit a few symbols (♀ ♂ ₂ ₃ µ ° …); resvg falls back to these for
those glyphs.

| Family | Source | License |
|---|---|---|
| Baloo 2 | [google/fonts](https://github.com/google/fonts/tree/main/ofl/baloo2) · static via [Fontsource](https://fontsource.org/fonts/baloo-2) | SIL Open Font License 1.1 |
| Montserrat | [google/fonts](https://github.com/google/fonts/tree/main/ofl/montserrat) · static via [Fontsource](https://fontsource.org/fonts/montserrat) | SIL Open Font License 1.1 |

Both families are licensed under the SIL Open Font License v1.1. Used here only for
build-time rasterisation of broadcast overlays.
