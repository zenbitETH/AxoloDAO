// MapLibre style of the atlas. Plain ESM so the page code and scripts/test-atlas.mjs read the same object.
// It uses NO external tiles, glyphs or sprites: the admin-1 units of Mexico, the United States and Canada come from /atlas/datos/admin1.geojson (same origin, written at build) and every label is an HTML popup.
export const ESTADOS_URL = '/atlas/datos/admin1.geojson';
export const SIN_DATO = '#0f2b35';          // the state fill with nothing on it: dark enough that every species hue and both ramps clear their contrast floors on it (docs/palette-report.txt)
export const MAR = '#06171e';

export function baseStyle() {
  return {
    version: 8,
    name: 'axolodao-atlas',
    sources: {
      estados: { type: 'geojson', data: ESTADOS_URL, promoteId: 'iso' },
      // the species' ranges as smooth areas (TaxonRangeRow) and the named markers of the single-lake species; SAMPLE data in the prototype
      rangos: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      // one point per range (its centre) so a small range is visible at continental scale
      centros: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      // one dot per locality of the species (a 0.5° cell: at its centre; a named water body: at its point)
      puntosLoc: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      aguaNatural: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      // clustered below zoom 9, so the facilities of a crowded area show as a count that opens when it is clicked; from zoom 9 each one is drawn, fanned out where they share a centroid
      instalacionesLugares: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },   // one point per place with an open facility: its halo is drawn once
      instalaciones: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 38, clusterMaxZoom: 8 },
      uma: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 40, clusterMaxZoom: 8 },
      agua: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 40, clusterMaxZoom: 8 },
      organizaciones: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    },
    layers: [
      { id: 'fondo', type: 'background', paint: { 'background-color': MAR } },
      { id: 'estados-relleno', type: 'fill', source: 'estados',
        paint: { 'fill-color': ['coalesce', ['feature-state', 'color'], SIN_DATO], 'fill-opacity': 0.92 } },
      // the species the map shows (a chosen species, or a card under the pointer): its units in its colour, set per unit by the page; weak evidence gets stripes over it
      { id: 'estados-vista', type: 'fill', source: 'estados', paint: { 'fill-color': ['coalesce', ['feature-state', 'vista'], 'rgba(0,0,0,0)'], 'fill-opacity': 0.9 } },
      { id: 'estados-debil', type: 'fill', source: 'estados', filter: ['==', ['get', 'iso'], ''], paint: { 'fill-pattern': 'rayas-debil', 'fill-opacity': 0.9 } },
      { id: 'estados-linea', type: 'line', source: 'estados', paint: { 'line-color': '#7fb6c4', 'line-width': 0.6, 'line-opacity': 0.8 } },
      // a species that has a range or a lake shows its states as an OUTLINE (the range is the finding); a species with no range keeps the state fill above
      { id: 'estados-vista-linea', type: 'line', source: 'estados', paint: { 'line-color': ['coalesce', ['feature-state', 'vistaLinea'], 'rgba(0,0,0,0)'], 'line-width': 2.2 } },
      { id: 'estados-vista-linea-debil', type: 'line', source: 'estados', filter: ['==', ['get', 'iso'], ''], paint: { 'line-color': ['coalesce', ['feature-state', 'vistaLinea'], 'rgba(0,0,0,0)'], 'line-width': 2.2, 'line-dasharray': [1.6, 1.6] } },
      { id: 'estado-elegido', type: 'line', source: 'estados', filter: ['==', ['get', 'iso'], ''], paint: { 'line-color': '#f4e8c8', 'line-width': 2 } },
      // water: Natural Earth rivers and lakes (public domain), under the ranges
      { id: 'lagos-relleno', type: 'fill', source: 'aguaNatural', filter: ['==', ['get', 'kind'], 'lake'], layout: { visibility: 'none' }, paint: { 'fill-color': '#2c9fc9', 'fill-opacity': 0.5 } },
      { id: 'rios-linea', type: 'line', source: 'aguaNatural', filter: ['==', ['get', 'kind'], 'river'], layout: { visibility: 'none', 'line-cap': 'round' }, paint: { 'line-color': '#5fb8de', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.6, 7, 1.6], 'line-opacity': 0.85 } },
      // every range as a faint outline (the overview); the shown species as a fill and a bold outline in its colour; its neighbours as thin outlines in theirs
      { id: 'rangos-general', type: 'fill', source: 'rangos', filter: ['==', ['get', 'kind'], 'range'], paint: { 'fill-color': '#f4e8c8', 'fill-opacity': 0.22 } },
      { id: 'rangos-tenue', type: 'line', source: 'rangos', filter: ['==', ['get', 'kind'], 'range'], paint: { 'line-color': '#f4e8c8', 'line-width': 1.2, 'line-opacity': 0.8 } },
      // the areas of the species whose colour sits close to a neighbour's: a texture on the fill (picture 'trama-<slug>', made by the atlas)
      { id: 'rangos-trama', type: 'fill', source: 'rangos', filter: ['==', ['get', 'slug'], ''], paint: { 'fill-pattern': ['image', ['concat', 'trama-', ['get', 'slug']]], 'fill-opacity': 0.9 } },
      { id: 'rangos-relleno', type: 'fill', source: 'rangos', filter: ['all', ['==', ['get', 'slug'], ''], ['==', ['get', 'kind'], 'range']], paint: { 'fill-color': '#f4e8c8', 'fill-opacity': 0.5 } },
      { id: 'rangos-vecinos', type: 'line', source: 'rangos', filter: ['all', ['==', ['get', 'slug'], ''], ['==', ['get', 'kind'], 'range']], paint: { 'line-color': '#f4e8c8', 'line-width': 1.6, 'line-opacity': 0.9 } },
      { id: 'rangos-contorno', type: 'line', source: 'rangos', filter: ['all', ['==', ['get', 'slug'], ''], ['==', ['get', 'kind'], 'range']], paint: { 'line-color': '#f4e8c8', 'line-width': 2.6, 'line-opacity': 1 } },
      { id: 'localidades-area', type: 'fill', source: 'puntosLoc', filter: ['==', ['get', 'slug'], ''], paint: { 'fill-color': '#f4e8c8', 'fill-opacity': 0.5 } },
      { id: 'localidades-area-trama', type: 'fill', source: 'puntosLoc', filter: ['==', ['get', 'slug'], ''], paint: { 'fill-pattern': ['image', ['concat', 'trama-', ['get', 'slug']]], 'fill-opacity': 0.9 } },
      { id: 'localidades-contorno', type: 'line', source: 'puntosLoc', filter: ['==', ['get', 'slug'], ''], paint: { 'line-color': '#f4e8c8', 'line-width': 2, 'line-opacity': 1 } },
      { id: 'localidades-lago', type: 'circle', source: 'puntosLoc', filter: ['==', ['get', 'kind'], 'lake'], paint: { 'circle-color': '#f4e8c8', 'circle-opacity': 0.95, 'circle-radius': 5, 'circle-stroke-color': MAR, 'circle-stroke-width': 1.4 } },
      { id: 'localidades-punto', type: 'circle', source: 'puntosLoc', filter: ['==', ['get', 'slug'], ''], paint: { 'circle-color': '#f4e8c8', 'circle-opacity': 0.95, 'circle-radius': 4, 'circle-stroke-color': MAR, 'circle-stroke-width': 1.2 } },
      // the same for points: a small disc carrying the texture of its species (picture 'pt-<slug>')
      { id: 'localidades-lago-trama', type: 'symbol', source: 'puntosLoc', filter: ['==', ['get', 'slug'], ''], layout: { 'icon-image': ['concat', 'pt-', ['get', 'slug']], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': 1.1 } },
      { id: 'localidades-punto-trama', type: 'symbol', source: 'puntosLoc', filter: ['==', ['get', 'slug'], ''], layout: { 'icon-image': ['concat', 'pt-', ['get', 'slug']], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': 1 } },
      { id: 'rangos-centro', type: 'circle', source: 'centros', paint: { 'circle-color': '#f4e8c8', 'circle-radius': 4.5, 'circle-stroke-color': MAR, 'circle-stroke-width': 1.4, 'circle-opacity': 0.95 } },
      { id: 'uma-grupos', type: 'circle', source: 'uma', filter: ['has', 'point_count'], layout: { visibility: 'none' },
        paint: { 'circle-color': '#d4925f', 'circle-opacity': 0.55, 'circle-radius': ['step', ['get', 'point_count'], 10, 50, 14, 500, 20] } },
      { id: 'uma-puntos', type: 'circle', source: 'uma', filter: ['!', ['has', 'point_count']], layout: { visibility: 'none' },
        paint: { 'circle-color': '#d4925f', 'circle-opacity': 0.8, 'circle-radius': 3 } },
      { id: 'agua-grupos', type: 'circle', source: 'agua', filter: ['has', 'point_count'], layout: { visibility: 'none' },
        paint: { 'circle-color': '#2c9fc9', 'circle-opacity': 0.55, 'circle-radius': ['step', ['get', 'point_count'], 10, 50, 14, 500, 20] } },
      { id: 'agua-puntos', type: 'circle', source: 'agua', filter: ['!', ['has', 'point_count']], layout: { visibility: 'none' },
        paint: { 'circle-color': '#2c9fc9', 'circle-opacity': 0.85, 'circle-radius': 3 } },
      // A facility is drawn as an AREA (a halo and a ring around the INEGI centroid of its municipality), never as a pin: nobody should read a centroid as an address.
      { id: 'instalaciones-halo', type: 'circle', source: 'instalacionesLugares', minzoom: 9, layout: { visibility: 'none' },
        paint: { 'circle-color': '#f4e8c8', 'circle-opacity': 0.14, 'circle-radius': 22, 'circle-blur': 0.6 } },
      // A facility marker has three SDF parts, recoloured by state: a backing disc (hollow when closed), a ring (thick for a legal figure, teal for a UMA, ochre for a PIMVS) and the pictogram of its type.
      // `desp` is the pixel offset that fans out facilities sharing one centroid; the three parts move together.
      { id: 'instalaciones-fondo', type: 'symbol', source: 'instalaciones', filter: ['!', ['has', 'point_count']], layout: { visibility: 'none', 'icon-image': 'inst-disco', 'icon-offset': ['get', 'desp'], 'icon-allow-overlap': true, 'icon-ignore-placement': true },
        paint: { 'icon-color': ['case', ['==', ['get', 'estado_operacion'], 'cerrado'], 'rgba(0,0,0,0)', '#f4e8c8'] } },
      { id: 'instalaciones-anillo', type: 'symbol', source: 'instalaciones', filter: ['!', ['has', 'point_count']], layout: { visibility: 'none', 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-offset': ['get', 'desp'],
          'icon-image': ['case', ['==', ['get', 'estado_operacion'], 'cerrado'], 'inst-anillo-cerrado', ['==', ['get', 'figura'], 'ninguna'], 'inst-anillo-fino', 'inst-anillo-grueso'] },
        paint: { 'icon-color': ['case', ['==', ['get', 'estado_operacion'], 'cerrado'], '#8a9aa0', ['match', ['get', 'figura'], 'uma', '#19bdb7', 'pimvs', '#d4925f', '#06171e']] } },
      { id: 'instalaciones-puntos', type: 'symbol', source: 'instalaciones', filter: ['!', ['has', 'point_count']], layout: { visibility: 'none', 'icon-image': ['concat', 'inst-', ['get', 'tipo']], 'icon-offset': ['get', 'desp'], 'icon-allow-overlap': true, 'icon-ignore-placement': true },
        paint: { 'icon-color': ['case', ['==', ['get', 'estado_operacion'], 'cerrado'], '#8a9aa0', '#06171e'] } },
      { id: 'instalaciones-cumulo', type: 'circle', source: 'instalaciones', filter: ['has', 'point_count'], layout: { visibility: 'none' },
        paint: { 'circle-color': '#0a3b49', 'circle-stroke-color': '#f4e8c8', 'circle-stroke-width': 2, 'circle-radius': ['step', ['get', 'point_count'], 15, 5, 18, 12, 22] } },
      { id: 'instalaciones-cumulo-n', type: 'symbol', source: 'instalaciones', filter: ['has', 'point_count'], layout: { visibility: 'none', 'icon-image': ['concat', 'inst-n-', ['get', 'point_count']], 'icon-allow-overlap': true, 'icon-ignore-placement': true } },
      { id: 'organizaciones-registradas', type: 'circle', source: 'organizaciones', layout: { visibility: 'none' },
        paint: { 'circle-color': '#e85d75', 'circle-stroke-color': '#f4e8c8', 'circle-stroke-width': ['interpolate', ['linear'], ['get', 'nivel'], 0, 1, 3, 4], 'circle-radius': 7 } },
    ],
  };
}

/** Every URL the style names (sources with a string `data`), to check it is same-origin. */
export function urlsDelEstilo(style = baseStyle()) {
  const urls = [];
  for (const s of Object.values(style.sources)) if (typeof s.data === 'string') urls.push(s.data);
  for (const k of ['sprite', 'glyphs']) if (style[k]) urls.push(style[k]);
  for (const s of Object.values(style.sources)) for (const k of ['url', 'tiles']) if (s[k]) urls.push(...[].concat(s[k]));
  return urls;
}

/** Five sequential classes for a choropleth, from the values present (linear on the observed range). */
export const RAMPA = ['#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb'];             // richness: one blue ramp (dataviz reference steps 500..100)
export const RAMPA_INST = ['#ad4800', '#cd6626', '#e98650', '#ffa97c', '#ffcfaf'];        // facilities per state: one orange ramp (same lightness steps)
export function colorDe(valor, min, max, rampa = RAMPA) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return SIN_DATO;
  if (max <= min) return rampa[2];
  const i = Math.min(rampa.length - 1, Math.floor(((valor - min) / (max - min)) * rampa.length));
  return rampa[i];
}

/** The stripe the weak-evidence layer repeats: dark diagonal lines on a transparent 8 px tile, as raw RGBA (no image file). */
export function rayasDebil() {
  const data = new Uint8Array(8 * 8 * 4);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 8 < 2) data.set([7, 31, 41, 235], (y * 8 + x) * 4);
  return { width: 8, height: 8, data };
}
