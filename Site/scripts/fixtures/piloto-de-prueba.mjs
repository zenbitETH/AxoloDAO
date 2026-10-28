// A synthetic pilot (not the real one) in the shape of the internal files, for the tests that need the three files build:sitio writes into
// atlas/real/ (their public projection, src/lib/pilotoPublico.mjs).
import { cadenaPublica, clipsPublicos, fichaPublica } from '../../src/lib/pilotoPublico.mjs';

export const FICHA = {
  fecha: '2026-10-21', pedido: 'interno',
  resumen: {
    periodoDeOperacion: { apertura: { valor: '2025-10-24', semanaIso: '2025-W43' }, cierre: { valor: '2026-09', dia: '2026-09-22', semanaIso: '2026-W39' } },
    especies: { valor: ['ambystoma_mexicanum'] }, sistemas: { valor: [{ sistema: 'am', taxon: 'ambystoma_mexicanum' }] },
    semanasDeclaradas: { valor: 49, desde: '2025-W43', hasta: '2026-W39' }, registrosPublicos: { valor: 572, porTipo: { water_reading: 572 }, fechaDeCorte: '2026-09-14' },
  },
  aguaSemanal: { sistemas: { am: { taxon: 'ambystoma_mexicanum', propiedades: { ph: { unidad: 'pH', semanas: [{ semana: '2025-W51', n: 8, min: 7, max: 8, media: 7.5 }] } } } } },
  cobertura: { semanasConRegistroPublico: { valor: 26, de: 49, porcentaje: 53.1 }, diasConTemperatura: { valor: 128, porSistema: { am: 126 } } },
  irc_v1: { valor: 53, etiqueta: 'e', calculadoEl: { valor: '2026-09-30' } },
  supervivencia: { valor: 37, unidad: '%', periodo: { desde: '2025-10-24', hasta: '2026-09-25' }, etiqueta: 'e' },
};
export const CLIPS = { fecha: '2026-10-21', clips: [{ semana: '2026-W37', especie: 'mexicanum', sistema: 'am', estado: 'x', autor: '0x1234…abcd', url: 'https://youtu.be/x' }] };
export const CADENA = { leidoEl: '2026-10-22', filas: [{ id: 'tesoreria', titulo: 't', red: 'r', estado: 'e', nota: 'Sólo movimientos en cadena' }] };

/** The three public files, [name, bytes], as build:sitio writes them. */
export const COPIAS = () => [
  ['xolotlcalli-ficha.json', JSON.stringify(fichaPublica(FICHA))],
  ['xolotlcalli-clips.json', JSON.stringify(clipsPublicos(CLIPS))],
  ['xolotlcalli-cadena.json', JSON.stringify(cadenaPublica(CADENA))],
];
