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
