// The atlas's screen classes, in one place: the component reads them with matchMedia, atlas.css repeats them in its @media rules
// (scripts/test-atlas.mjs checks the two agree), and the screen test reads them to know what each viewport should show.
//
//   sheets   a phone, or any upright window up to a tablet's width: the index, the species and the legend are bottom sheets
//   short    a window on its side and low (a phone held sideways): narrow side drawers, a compact legend
//   drawers  everything else: side drawers, capped in width so the map keeps the middle

/** Bottom sheets: a phone, or an upright window up to 1100 px wide (a tablet held upright, a narrow desktop window). */
export const HOJA = '(max-width: 720px), (max-width: 1100px) and (orientation: portrait)';
/** A low window on its side (a phone held sideways): side drawers, narrow. */
export const BAJA = '(min-width: 721px) and (max-height: 520px) and (orientation: landscape)';

/** The same rule as HOJA, for a viewport given in numbers (the screen test). */
export const esHoja = (ancho, alto) => ancho <= 720 || (ancho <= 1100 && alto >= ancho);
