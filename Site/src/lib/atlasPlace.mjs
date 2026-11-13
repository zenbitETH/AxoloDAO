/** The facilities as the table lists them: by state, then municipality (rows with no municipality last), then name. No coordinate, no note, no address. */
export function filasDeInstalaciones(propiedades) {
  const clave = (p) => [p.estado ?? '', p.nivel === 'estado' || !p.municipio ? '\uffff' : p.municipio, p.nombre ?? ''];
  return [...propiedades].sort((a, b) => { const x = clave(a), y = clave(b); for (let i = 0; i < 3; i++) { const c = x[i].localeCompare(y[i], 'es'); if (c) return c; } return 0; });
}

/** The place a cataloged facility is drawn at: «en <municipio>, <estado>», or «en <estado>» for a row with no municipality.
 *  A facility is never placed more precisely than its INEGI municipality centroid, so the label says the place, never an address. */
export function lugarDeInstalacion(p, enLaLocalidad = 'en') {
  const lugar = p.nivel === 'estado' || !p.municipio ? p.estado : `${p.municipio}, ${p.estado}`;
  return `${enLaLocalidad} ${lugar}`;
}

/** The name of an admin-1 unit from the admin1 data; where that data gives the state the country's own name («México» for MX-MEX) the state is spelled out, until the data does it.
 *  Shared by the map (Atlas.tsx) and the tables page (AtlasTablas.astro), so both name a unit the same way. */
export function nombreDeEstado(pr, loc) {
  const dato = (loc === 'en' ? pr.nameEn : pr.nameEs) ?? pr.iso;
  return pr.iso === 'MX-MEX' && /^m[eé]xico$/i.test(dato) ? (loc === 'en' ? 'State of Mexico' : loc === 'pt' ? 'Estado do México' : 'Estado de México') : dato;
}
