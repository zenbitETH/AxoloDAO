// The conservation status scale of a species sheet (IUCN and NOM-059): which circle is filled and what is said beside it. Pure, so the sheet and scripts/test-atlas.mjs read the same rules.
/** IUCN, left to right, with the group captions the scale carries: «Extinta» over EX–EW, a bracket «Amenazada» over CR–EN–VU, «Preocupación menor» over LC (NT carries none). */
export const ESCALA_UICN = ['EX', 'EW', 'CR', 'EN', 'VU', 'NT', 'LC'];
export const GRUPOS_UICN = [{ clave: 'extinta', codigos: ['EX', 'EW'] }, { clave: 'amenazada', codigos: ['CR', 'EN', 'VU'], corchete: true }, { clave: 'menor', codigos: ['LC'] }];
/** NOM-059, in the Norma's order. */
export const ESCALA_NOM = ['E', 'P', 'A', 'Pr'];
/** What the IUCN row shows for a category: the filled circle when it is on the scale; DD and NE are not on it: a separate pill and every circle outlined. */
export const estadoUicn = (categoria) => ({ llena: ESCALA_UICN.includes(categoria) ? categoria : null, pildora: categoria === 'DD' || categoria === 'NE' ? categoria : null });
/** What the NOM-059 row shows: the official category on the scale, or «not listed»; a 2025 draft category is a note, never the official value. */
export function estadoNom(categorias) {
  const oficial = (categorias ?? []).find((c) => c.system === 'nom059')?.category ?? null;
  const proyecto = (categorias ?? []).find((c) => c.system === 'proy_nom059_2025')?.category ?? null;
  const prov = proyecto && ESCALA_NOM.includes(proyecto) ? proyecto : null;
  // the draft is a note only when it differs from the current category
  // an official code the scale does not know is shown as the code itself, never as «not listed» (that would be a wrong legal label)
  return { llena: ESCALA_NOM.includes(oficial) ? oficial : null, noListada: !oficial, desconocida: oficial && !ESCALA_NOM.includes(oficial) ? oficial : null, proyecto: prov, notaProyecto: prov && prov !== oficial ? prov : null };
}

/** The national statuses of the countries the species lives in besides Mexico: ESA (US), SARA and COSEWIC (Canada), in that order; one entry per system with its distinct codes and the key of its first source. */
export const SISTEMAS_NACIONALES = ['esa', 'sara', 'cosewic'];
export function estatusNacionales(categorias) {
  return SISTEMAS_NACIONALES.map((s) => {
    const filas = (categorias ?? []).filter((c) => c.system === s && c.category);
    return filas.length ? { sistema: s, codigos: [...new Set(filas.map((c) => c.category))], fuente: filas[0].source ?? null } : null;
  }).filter(Boolean);
}

const luminancia = (hex) => {
  const h = hex.replace('#', ''); const v = h.length === 3 ? [...h].map((c) => c + c) : h.match(/../g);
  const [r, g, b] = v.map((x) => { const c = parseInt(x, 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** WCAG contrast ratio of two #rgb or #rrggbb colours. */
export const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
/** The text colour for a filled segment: the dark ink or white, whichever reads better on `fondo` (always at least 4.5:1 for the status colours). */
export const colorDeTexto = (fondo) => (contraste(fondo, '#031a20') >= contraste(fondo, '#ffffff') ? '#031a20' : '#ffffff');
