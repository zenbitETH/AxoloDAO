// The atlas's URL state: ?capa ?especie ?estado. Plain ESM, so the page and scripts/test-atlas.mjs read the same rules.
// A value that names nothing the atlas has is dropped, never trusted: the URL is input.
export const CAPAS = ['especies', 'riqueza', 'metrica'];
export const CAPA_POR_OMISION = 'especies';

/** The state a query string asks for, checked against the species and units the atlas carries. */
export function leerUrl(search, { slugs, isos }) {
  const q = new URLSearchParams(search);
  const capa = q.get('capa');
  const especie = q.get('especie');
  const estado = q.get('estado');
  return {
    capa: CAPAS.includes(capa) ? capa : CAPA_POR_OMISION,
    especie: especie && slugs.includes(especie) ? especie : null,
    estado: estado && isos.includes(estado) ? estado : null,
  };
}

/** The query string for a state, leaving out what is the default and keeping any other parameter (?kiosko=1). */
export function escribirUrl(search, { capa, especie, estado }) {
  const q = new URLSearchParams(search);
  for (const k of ['capa', 'especie', 'estado']) q.delete(k);
  if (capa && capa !== CAPA_POR_OMISION) q.set('capa', capa);
  if (especie) q.set('especie', especie);
  if (estado) q.set('estado', estado);
  const s = q.toString();
  return s ? `?${s}` : '';
}
