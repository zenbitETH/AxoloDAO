# Vendored fonts (OBS overlay rasterisation)

These variable TTFs are vendored so `scripts/data-overlays.mjs` can rasterise the
overlays (`@resvg/resvg-js`) with the brand fonts — resvg renders with on-disk
fonts, not the site's web fonts. They match the site's type system (Baloo 2 for
titles, Montserrat for descriptions).

| File | Family | Source | License |
|---|---|---|---|
| `Baloo2[wght].ttf` | Baloo 2 | [google/fonts · ofl/baloo2](https://github.com/google/fonts/tree/main/ofl/baloo2) | SIL Open Font License 1.1 |
| `Montserrat[wght].ttf` | Montserrat | [google/fonts · ofl/montserrat](https://github.com/google/fonts/tree/main/ofl/montserrat) | SIL Open Font License 1.1 |
| `Montserrat-Italic[wght].ttf` | Montserrat (italic) | [google/fonts · ofl/montserrat](https://github.com/google/fonts/tree/main/ofl/montserrat) | SIL Open Font License 1.1 |

Both families are licensed under the SIL Open Font License v1.1 (full text travels
with each font's `OFL.txt` in the upstream repo). Used here only for build-time
rasterisation of broadcast overlays.
