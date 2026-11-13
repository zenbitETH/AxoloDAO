// The numeric measures of the biometry in the workbook (sheet «Historial medico», bundle.historial), in one place: the registry
// of the mesa (/xolotlcalli/mesa/datos.json) publishes each one as a series with this dictionary, the ajolote card (BiometriaTab)
// draws its columns from it, and scripts/test-mesa-registro.mjs checks every numeric field of the data has its entry here,
// so a new column of the workbook cannot drop out of either one in silence.
//
// The lengths are in centimetres, as the card already says for the total and snout-vent lengths; `temp` is the temperature written
// with the biometry, in °C (an axolotl takes the temperature of its water). `grupo` is the lane a measure shares in /datos of Xovi:
// the measures of one group share a unit and a scale.

/** @typedef {{ k: string, grupo: 'peso' | 'longitud' | 'cuerpo' | 'extremidades' | 'branquias' | 'temp', unidad: 'g' | 'cm' | '°C', corto: string, es: string, en: string, pt: string }} Medida */

/** @type {Medida[]} */
export const MEDIDAS = [
  { k: 'peso', grupo: 'peso', unidad: 'g', corto: 'peso', es: 'Peso', en: 'Weight', pt: 'Peso' },
  { k: 'lt', grupo: 'longitud', unidad: 'cm', corto: 'LT', es: 'Longitud total', en: 'Total length', pt: 'Comprimento total' },
  { k: 'lhc', grupo: 'longitud', unidad: 'cm', corto: 'LHC', es: 'Longitud hocico-cloaca', en: 'Snout-vent length', pt: 'Comprimento focinho-cloaca' },
  // axilla to groin: a length along the body (median 4.5 cm), so it shares the lane of the lengths, not the one of the 1.5–4.7 cm widths
  { k: 'interaxial', grupo: 'longitud', unidad: 'cm', corto: 'interaxial', es: 'Distancia interaxial', en: 'Interaxial distance', pt: 'Distância interaxial' },
  { k: 'largoCabeza', grupo: 'cuerpo', unidad: 'cm', corto: 'cabeza L', es: 'Largo de la cabeza', en: 'Head length', pt: 'Comprimento da cabeça' },
  { k: 'anchoCabeza', grupo: 'cuerpo', unidad: 'cm', corto: 'cabeza A', es: 'Ancho de la cabeza', en: 'Head width', pt: 'Largura da cabeça' },
  { k: 'anchoCuerpo', grupo: 'cuerpo', unidad: 'cm', corto: 'cuerpo A', es: 'Ancho del cuerpo', en: 'Body width', pt: 'Largura do corpo' },
  { k: 'brazo', grupo: 'extremidades', unidad: 'cm', corto: 'brazo', es: 'Brazo', en: 'Upper arm', pt: 'Braço' },
  { k: 'antebrazo', grupo: 'extremidades', unidad: 'cm', corto: 'antebrazo', es: 'Antebrazo', en: 'Forearm', pt: 'Antebraço' },
  { k: 'femur', grupo: 'extremidades', unidad: 'cm', corto: 'fémur', es: 'Fémur', en: 'Femur', pt: 'Fêmur' },
  { k: 'tibia', grupo: 'extremidades', unidad: 'cm', corto: 'tibia', es: 'Tibia', en: 'Tibia', pt: 'Tíbia' },
  { k: 'branqIzq', grupo: 'branquias', unidad: 'cm', corto: 'branq. izq.', es: 'Branquias, izquierda', en: 'Gills, left', pt: 'Brânquias, esquerda' },
  { k: 'branqDer', grupo: 'branquias', unidad: 'cm', corto: 'branq. der.', es: 'Branquias, derecha', en: 'Gills, right', pt: 'Brânquias, direita' },
  { k: 'temp', grupo: 'temp', unidad: '°C', corto: 'T°', es: 'Temperatura', en: 'Temperature', pt: 'Temperatura' },
];

/** The fields of a biometry row that hold a number but are not a measure: none today (`bcs`, the body condition, is a score). */
export const NO_SON_MEDIDAS = ['bcs'];

/** The numeric fields a set of biometry rows carries, in the order they first appear: what the dictionary has to cover. */
export const camposNumericos = (filas) => {
  const vistos = [];
  for (const r of filas) for (const [k, v] of Object.entries(r)) if (typeof v === 'number' && !NO_SON_MEDIDAS.includes(k) && !vistos.includes(k)) vistos.push(k);
  return vistos;
};

/**
 * The columns of the measures table on the ajolote card, in reading order: a pair shares a cell («4.2 × 3.8»), and a column only shows
 * when one of the specimen's rows carries one of its measures. Every measure above is in one column (the registry test checks it).
 * `etiqueta` is the key in src/components/ajolotes/strings.ts; `tip`, its explanation.
 */
export const COLUMNAS_TARJETA = [
  { claves: ['peso'], etiqueta: 'biometria.col.peso', dec: 1 },
  { claves: ['lt'], etiqueta: 'biometria.col.lt', tip: 'card.lt.tooltip', dec: 1 },
  { claves: ['lhc'], etiqueta: 'biometria.col.lhc', tip: 'card.lhc.tooltip', dec: 1 },
  { claves: ['largoCabeza', 'anchoCabeza'], etiqueta: 'biometria.col.cabeza', sep: '×', dec: 1 },
  { claves: ['anchoCuerpo'], etiqueta: 'biometria.col.cuerpo', dec: 1 },
  { claves: ['interaxial'], etiqueta: 'biometria.col.interaxial', tip: 'biometria.col.interaxial.tip', dec: 2 },
  { claves: ['brazo', 'antebrazo'], etiqueta: 'biometria.col.brazos', sep: '/', dec: 2 },
  { claves: ['femur', 'tibia'], etiqueta: 'biometria.col.piernas', sep: '/', dec: 2 },
  { claves: ['branqIzq', 'branqDer'], etiqueta: 'biometria.col.branquias', sep: '/', dec: 2 },
  { claves: ['temp'], etiqueta: 'biometria.col.temp', tip: 'biometria.col.temp.tip', dec: 1 },
];
