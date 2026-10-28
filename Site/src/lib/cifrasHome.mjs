// The home page's figures and how a caption shows them. Plain ESM, so the build (lib/inventarioHome.ts) and the post-build check
// (scripts/check-hero-estado.mjs) fill a caption the same way. The data comes in as arguments: the build imports the JSON, the check reads it.
//
// A caption carries {placeholders} and never a typed figure; a number is formatted for the page's locale, a list of language codes becomes
// the languages' names joined for that locale.

/** The locale tag each page formats with. */
export const ETIQUETA = { es: 'es-MX', en: 'en-US', pt: 'pt-BR' };
// lists in English without the serial comma, as the approved captions write them
const ETIQUETA_LISTA = { es: 'es-MX', en: 'en-GB', pt: 'pt-BR' };

/** The values the home captions may use, by placeholder name, from the two inventories and the box-office file. */
export function cifrasDe({ cadena, atlas, taquilla }) {
  return {
    especies: atlas.especies.valor,
    recintos: atlas.instalaciones.valor, // the atlas's public layer, not the catalogue's rows
    idiomas: atlas.idiomas.valor,
    clips: cadena.clipsConfirmados.conAtestacionEnSepolia.valor,
    dias: cadena.registrosPublicos.diasConRegistro.valor,
    semanas: cadena.seAnclara.semanas.valor,
    semanasConRegistro: cadena.registrosPublicos.semanasConRegistro.valor,
    tipos: cadena.registrosPublicos.tiposConRegistro.valor,
    areas: cadena.areas.conRegistro,
    visitas: taquilla.visitas,
  };
}

/** One figure as the page shows it. */
export function formatear(valor, locale) {
  if (Array.isArray(valor)) {
    const nombres = new Intl.DisplayNames([ETIQUETA[locale]], { type: 'language' });
    return new Intl.ListFormat(ETIQUETA_LISTA[locale], { type: 'conjunction' }).format(valor.map((c) => nombres.of(c)));
  }
  return new Intl.NumberFormat(ETIQUETA[locale]).format(valor);
}

/** A caption with its {placeholders} filled, or null if one has no figure (then the caption is not shown). */
export function llenar(texto, locale, cifras) {
  let falta = false;
  const out = texto.replace(/\{(\w+)\}/g, (_m, k) => {
    if (!(k in cifras) || cifras[k] === undefined || cifras[k] === null) { falta = true; return ''; }
    return formatear(cifras[k], locale);
  });
  return falta ? null : out;
}
