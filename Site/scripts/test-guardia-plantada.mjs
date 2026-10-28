// The guards of the facilities, each against a PLANTED fault, so every one is seen red as well as green.
//   node scripts/test-guardia-plantada.mjs
// Each row: the old guard (before the pictograms) and the new check on the same input. A guard that cannot be made red guards nothing.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseStyle } from '../src/lib/atlasStyle.mjs';
import { ICONOS } from '../src/lib/iconosInstalaciones.mjs';
import { prepararInstalaciones } from '../src/lib/atlasInstalaciones.mjs';
import { PIN_LUCIDE, abanico, centroide, csvDeCentroides, estiloAntiguo, precision, sinPin } from './lib/guardia-instalaciones.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const instal = JSON.parse(readFileSync(join(SITE, 'src/data/atlas-snapshot/instalaciones-catalogadas.geojson'), 'utf8'));
const inegi = csvDeCentroides(join(SITE, 'scripts/fixtures/centroides-inegi.csv'));
const copia = (x) => JSON.parse(JSON.stringify(x));
let fallos = 0;
const fila = (que, viejo, nuevo, esperaViejo, esperaNuevo) => {
  const col = (v) => (v.length ? 'RED  ' : 'green');
  const bien = (viejo.length > 0) === esperaViejo.rojo && (nuevo.length > 0) === esperaNuevo;
  console.log(`${bien ? '  ok' : 'FAIL'}  ${que.padEnd(58)} old guard: ${col(viejo)}  new check: ${col(nuevo)}${viejo.length ? `   (${viejo.slice(0, 2).join(', ')})` : ''}`);
  if (!bien) fallos++;
};
const sinViejo = { rojo: false };

// 0. the committed data and style are green on every new check
const estilo = baseStyle();
fila('the committed data and style', precision(instal), [...centroide(instal, inegi), ...sinPin(estilo, ICONOS)], sinViejo, false);

// 1. an exact point planted at a facility: finer than a centroid, and not the centroid of its municipality
const exacta = copia(instal); exacta.features[1].geometry.coordinates = [-100.452731, 20.728812];
fila('a facility planted at an exact point (6 decimals)', precision(exacta), centroide(exacta, inegi), { rojo: true }, true);

// 2. a point off the centroid but with four decimals only: the old precision guard cannot see it, the centroid check does
const corrida = copia(instal); corrida.features[1].geometry.coordinates = [-100.4531, 20.7289];
fila('a point moved 40 m, still four decimals', precision(corrida), centroide(corrida, inegi), sinViejo, true);

// 3. a pin layer planted on the facilities source
const conPin = copia(estilo); conPin.layers.push({ id: 'instalaciones-chincheta', type: 'symbol', source: 'instalaciones', layout: { 'icon-image': 'marker-pin' } });
fila('a pin layer planted on the facilities source', estiloAntiguo(conPin).filter((id) => id === 'instalaciones-chincheta'), sinPin(conPin, ICONOS), { rojo: true }, true);

// 4. a pin icon planted in the set («otro» becomes Lucide's map-pin)
const iconoPin = { ...ICONOS, otro: [{ d: PIN_LUCIDE }] };
fila('the «otro» icon replaced by the map-pin', [], sinPin(estilo, iconoPin), sinViejo, true);

// 4b. a pin redrawn with other numbers, another scale and another offset (a teardrop with a round top and a point), and the shapes that must NOT read as a pin
const GOTA = 'M112 82C104 82 98 88 98 96c0 10 14 26 14 26s14-16 14-26c0-8-6-14-14-14z';
const ESCUDO = 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1z';
const HUEVO = 'M12 22c6.23-.05 7.87-5.57 7.5-10-.36-4.34-3.95-9.96-7.5-10-3.55.04-7.14 5.66-7.5 10-.37 4.43 1.27 9.95 7.5 10z';
fila('the «otro» icon replaced by a pin redrawn (other numbers, scale and offset)', [], sinPin(estilo, { ...ICONOS, otro: [{ d: GOTA }] }), sinViejo, true);
fila('a shield and an egg in the set are not a pin', [], sinPin(estilo, { ...ICONOS, otro: [{ d: ESCUDO }], criadero: [{ d: HUEVO }] }), sinViejo, false);

// 5. the old guard on the legitimate new style: it was written for circles, so it is red there (the reason it is replaced, not kept)
fila('the old guard on the new, legitimate style', estiloAntiguo(estilo), sinPin(estilo, ICONOS), { rojo: true }, false);

// 6. a fan-out that moves the coordinates, and one that changes its input
const desp = instal.features.map((_, i) => [i, -i]);
const moviendo = (fc, d) => ({ ...fc, features: fc.features.map((f, i) => ({ ...f, geometry: { ...f.geometry, coordinates: [f.geometry.coordinates[0] + d[i][0] * 1e-4, f.geometry.coordinates[1]] }, properties: { ...f.properties, desp: d[i] } })) });
const mutando = (fc, d) => { fc.features.forEach((f, i) => { f.properties.desp = d[i]; }); return fc; };
fila('a fan-out that moves the coordinates of the GeoJSON', [], abanico(moviendo, copia(instal), desp), sinViejo, true);
fila('a fan-out that changes the GeoJSON it was given', [], abanico(mutando, copia(instal), desp), sinViejo, true);
fila('the real fan-out (screen offsets in a property)', [], abanico(prepararInstalaciones, copia(instal), desp), sinViejo, false);

console.log(fallos ? `\n${fallos} FAILED` : '\nevery fault planted is seen red by the new check, and the committed data and style are green');
process.exit(fallos ? 1 : 0);
