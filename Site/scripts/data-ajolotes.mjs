#!/usr/bin/env node
/**
 * data-ajolotes.mjs
 *
 * Reads the operations workbook (path from the AXOLODAO_XLSX env var) and emits the bundle.json that
 * powers the per-axolotl Ajolotes Explorer:
 *
 *   Site/src/data/ajolotes/bundle.json
 *
 * Sheets consumed:
 *   - Dashboard ejemplares  → ejemplares[]                 (latest snapshot per axolotl)
 *   - Historial medico      → historial[alias][]           (sorted ascending by fecha)
 *   - Plan de alimentación  → planes[alias]                (one plan per axolotl)
 *   - Alimentación 2.0      → alimentacion[alias][]        (sorted ascending by fecha)
 *   - Bajas                 → bajas[]                      (sorted ascending by fecha)
 *
 * The script regenerates bundle.json from scratch each run, so re-running on
 * the same xlsx produces identical output — no merge logic needed.
 *
 * Run manually each Monday after the Biomuseo team updates the xlsx:
 *   npm run data:ajolotes
 */
import XLSX from 'xlsx';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  toIsoDate,
  toTimeFraction,
  toNum,
  toNumOrText,
  toStr,
  findHeaderRow,
  indexOfHeader,
  normalizeAlias,
  loadEmbargoNames,
  resolveXlsxPath,
} from './lib/xlsx-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..');
const XLSX_PATH = resolveXlsxPath();

const OUT_DIR = resolve(SITE_ROOT, 'src/data/ajolotes');
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Curator overrides for stale Dashboard ejemplares fields. The xlsx is the
// system of record but the dashboard column can lag the actual colony state
// (e.g. a specimen returned from cuarentena before the curator updated the
// sheet). Each override patches a single field after the xlsx is read so the
// next regen does not silently revert the live page. Drop an entry once the
// xlsx catches up.
const EJEMPLAR_OVERRIDES = new Map([
  // Field-level curator patches for stale Dashboard columns. Currently empty —
  // the AM aquarium distribution moved to AM_PECERA below. Add entries here when
  // a non-pecera field lags the live colony state.
]);

// Display-name renames applied to FREE-TEXT fields (feeding-response notes, etc.)
// so a specimen's current name reads consistently in prose too — the structured
// alias join is already folded by ALIAS_NORMALIZE, but that never touches prose.
// Kept separate from ALIAS_NORMALIZE on purpose: that map also folds spelling
// variants (Negra → La negra) which must NOT be substituted into prose. Whole-word
// only, so "Larva 1" → "Patito" never catches "Larva 2" / "Larvas". Drop a rule
// once the curator renames the source in the xlsx.
const TEXT_RENAMES = [[/\bLarva 1\b/g, 'Patito']];
const renameInText = (s) =>
  typeof s === 'string' ? TEXT_RENAMES.reduce((t, [re, to]) => t.replace(re, to), s) : s;

// Friendly per-axolotl narrative for the ajolotes-explorer "Resumen" tab. This
// is curated copy maintained by the curator (NOT in the xlsx), keyed by
// canonical alias (post-normalizeAlias, e.g. "La negra", "Chocoroll",
// "Pardo Macho", "Limon"). breve = 2–3 sentences; extendida = full paragraph.
const EJEMPLAR_DESCRIPCIONES = new Map([
  // Chocoroll's narrative uses gender-neutral wording (its sex is recorded as
  // "Sin sexar" in the Dashboard) and describes its arrival illness/recovery in
  // general terms to match the medical record.
  ['Panchita', {
    breve: 'Panchita fue la veterana de la familia. A sus 5 años era la más larga y robusta de todas, y también la más glotona: jamás le decía que no a la comida. Veía poco por una pequeña catarata, pero eso no le restaba ni una pizca de encanto.',
    extendida: 'Con 5 años a cuestas, Panchita fue nuestra ejemplar más veterana y, sin duda, la más imponente: era la más larga y rellenita de todo el grupo. La vida le dejó un par de marcas de guerra —de joven sus hermanos le arrancaron una branquia y una pequeña catarata nublaba uno de sus ojos—, pero ella las llevaba con orgullo. Como su vista ya no era la de antes, cazar no se le daba muy bien… aunque su apetito no conocía límites: Panchita fue, oficialmente, la más glotona de la casa. Tierna, tranquila y siempre lista para comer, fue la gran matriarca de la familia.',
  }],
  ['Remo', {
    breve: 'Remo es nuestro dumerilii más grande y el rey indiscutible de la noche. De carácter fuerte y temperamento intenso, prefiere moverse cuando todos duermen. ¿Hembra o macho? ¡Todavía es un misterio!',
    extendida: 'Remo es el más grande de nuestros dumerilíes y tiene una personalidad a la altura de su tamaño: decidido, territorial y con mucho carácter. Es un auténtico ser nocturno que cobra vida cuando cae la noche y todos los demás descansan. Guarda además un pequeño secreto que aún no hemos podido resolver: todavía no sabemos si es hembra o macho, así que de momento sigue siendo todo un enigma con branquias. Imponente y con un temperamento que no pasa desapercibido, Remo siempre se hace notar.',
  }],
  ['Rómulo', {
    breve: 'Rómulo es el más pequeño de los dumerilíes, pero también el más cachetón y travieso. Su pasatiempo favorito es darle mordiditas a su hermano. Es un poco delicado de salud, pero tiene un espíritu enorme.',
    extendida: 'No te dejes engañar por su tamaño: Rómulo es el más pequeño de los dumerilíes, pero también el más rellenito y cachetón de todos. Es travieso por naturaleza y tiene una debilidad muy particular: no se resiste a darle mordiditas a su hermano cada vez que tiene la oportunidad. Es un poco delicado de salud —de vez en cuando le aparece algún hongo—, así que siempre lo consentimos con cuidados extra. Pequeño, juguetón y muy querido, Rómulo se gana el corazón de todos los que lo conocen.',
  }],
  ['La negra', {
    breve: 'Negra todavía busca nombre definitivo, pero su carácter ya está más que claro: es una hembra serena, tranquila y muy sociable, que se lleva de maravilla con todos los demás ajolotes.',
    extendida: 'Negra es la calma hecha ajolote. De temperamento sereno y nada conflictivo, convive sin problemas con cualquiera de sus compañeros: es de esas que siempre llevan la fiesta en paz. Por ahora su nombre es solo provisional, mientras encontramos el definitivo, pero su personalidad apacible y amistosa ya se ganó un lugar en la familia.',
  }],
  ['Parda', {
    breve: 'Parda es otra de nuestras hembras tranquilas: dulce y pacífica. Tiene una peculiaridad entrañable: cuando la alimentamos con pinza, casi nunca le atina al bocado. Su nombre, por ahora, también es provisional.',
    extendida: 'Parda comparte con Negra ese carácter calmado que tanto nos gusta: es serena, pacífica y fácil de llevar. Eso sí, tiene un detalle que saca una sonrisa: a la hora de comer con pinza, su puntería deja mucho que desear y casi nunca atrapa el bocado a la primera. Todavía lleva un nombre provisional, pero su torpeza encantadora la hace inolvidable.',
  }],
  ['Tamal de dulce', {
    breve: 'Tamal de dulce es nuestra Ambystoma mexicanum más rellenita. Antes fue mascota, tiene un dedito chueco y es la dueña absoluta del refugio: no deja entrar a nadie más. Tierna pero territorial, es todo un personaje.',
    extendida: 'Tamal de dulce es nuestra Ambystoma mexicanum más gordita y una de las más carismáticas. Llegó tras haber sido mascota y carga con algunas marcas de su pasado: un dedito chueco y un daño nervioso permanente en las branquias, secuela de unas quemaduras por amoniaco. Nada de eso le ha quitado el carácter: es la dueña y señora del refugio, y no le hace ninguna gracia que otro ajolote intente entrar en sus dominios. Tan peculiar es que, en una ocasión en que coincidió por accidente con el macho, él llegó incluso a liberar un espermatóforo para cortejarla. Consentida, territorial y con muchísima personalidad, Tamal de dulce no pasa desapercibida.',
  }],
  ['Tascalate', {
    breve: 'Tascalate es la más tímida de nuestras hembras. De color algo apagado y piel delicada, es discreta y reservada. Su vecina Tamal de dulce no pierde ocasión para quitarle la comida.',
    extendida: 'Tascalate es la más tímida de todas nuestras hembras: prefiere pasar desapercibida y quedarse en su rincón. Su color es un poco más opaco que el del resto y su piel es delicada, así que la cuidamos con especial atención. Tiene además un rasgo que la hace única: uno de los dedos de su pata delantera izquierda es más corto que los demás. Por su carácter reservado, muchas veces le toca la peor parte a la hora de comer, porque Tamal de dulce siempre se las arregla para quitarle el bocado. Discreta y delicada, Tascalate se gana el cariño poco a poco.',
  }],
  ['Pardo Macho', {
    breve: 'Pardo macho es nuestro único machito y todo un caballero reservado. Es súper tímido, no le gusta que lo toquen y, aun así, destaca por ser bastante más grande que el promedio.',
    extendida: 'Pardo macho tiene un papel muy especial en la familia: es nuestro único macho. De temperamento sumamente tímido, valora su espacio y no disfruta para nada que lo toquen, así que preferimos admirarlo de lejos. A pesar de su timidez, impone: es un macho notablemente grande para el promedio de su especie. Tranquilo, imponente y un poco huraño, Pardo macho es el discreto galán del grupo.',
  }],
  ['Patito', {
    breve: 'Patito es la más grande de nuestras dos larvas. Tiene un apetito enorme y, de vez en cuando, no resiste hacerle un poco de bullying a su hermano menor.',
    extendida: 'Patito es la mayor de nuestras dos pequeñas larvas, y se le nota: es la más grande y la que come con más ganas. Con esa energía de sobra, a veces se pone juguetona (o un poquito abusiva) y le hace bullying a su hermano menor. Todavía está creciendo y mostrándonos toda su personalidad, pero ya promete dar mucho de qué hablar.',
  }],
  ['Larva 2', {
    breve: 'Larva 2 es la más pequeñita de la familia. Tímida y discreta, su pasatiempo favorito es esconderse. Por ahora, su nombre también es provisional.',
    extendida: 'Larva 2 es la benjamina de la casa: la más pequeña de todas nuestras larvas. De carácter reservado, le encanta buscar rinconcitos donde esconderse y observar el mundo desde un lugar seguro, sobre todo cuando su hermana mayor anda con ganas de juego. Todavía espera su nombre definitivo, pero su ternura de criatura diminuta ya conquista a todos.',
  }],
  ['Limon', {
    breve: 'A Limón le mordieron las branquias de joven —el culpable fue Martín—, así que ahora luce unas más grandes que otras, un look de lo más original. Es el segundo más remilgoso para comer.',
    extendida: 'Limón tiene una historia que se le nota a primera vista: de joven le mordieron las branquias (el responsable fue Martín, que se llevó media branquia de un mordisco) y, desde entonces, presume unas branquias más grandes que otras. Lejos de afearlo, esa asimetría lo hace inconfundible. A la hora de comer es bastante exigente: ostenta el título del segundo más remilgoso de la casa. Original y con carácter, Limón se hace querer.',
  }],
  ['Martín', {
    breve: 'Martín es nuestro pequeño gran personaje: de tamaño enano, pero con mucho temperamento. Tan pronto está tranquilo como se pone bravucón con los más chiquitos. Siempre tiene hambre, aunque su pancita le da algún problema.',
    extendida: 'Martín demuestra que el tamaño no lo es todo: es nuestro ajolote enano, pequeñito pero con una personalidad de armas tomar. Tiene un humor cambiante: a ratos es de lo más tranquilo y a ratos se pone peleonero, eso sí, sobre todo con los más pequeños que él. Es muy comelón y nunca le falta apetito, aunque su estómago no siempre se lo agradece, pues suele tener problemas digestivos, así que vigilamos de cerca su alimentación. Travieso e impredecible, Martín siempre da de qué hablar.',
  }],
  ['Goldy', {
    breve: 'Goldy fue nuestro campeón de lo remilgoso: el más exigente de todos para comer. Era delgadito, crecía despacio y era el más tímido de los juveniles. Un consentido que necesitaba paciencia y cariño.',
    extendida: 'Goldy se llevaba el primer lugar en una categoría muy particular: fue el más remilgoso de todos a la hora de comer, lo que explicaba que estuviera delgadito y que creciera más despacio que el resto. Además fue el más tímido de nuestros juveniles, así que, entre su carácter reservado y su apetito selectivo, fue uno de los que más mimos y paciencia requerían. Pero esa fragilidad es justo lo que lo hizo tan especial: Goldy fue el consentido que a todos nos daban ganas de cuidar.',
  }],
  ['Chocoroll', {
    breve: 'Chocoroll es de nuestros juveniles más grandes y tiene un sello inconfundible: un pedacito extra en la cola que lo hace único. Llegó muy frágil y enfermo, pero con paciencia y cuidados hoy está fuerte y completamente recuperado.',
    extendida: 'Chocoroll es pura historia de superación. Llegó a casa muy frágil y enfermo, pero con mucha paciencia y cuidados logró recuperarse por completo; hoy es un ajolote fuerte y lleno de vida. Es de los más grandes de nuestros juveniles y presume un detalle que lo distingue del resto: un pequeño pedacito extra en la cola, su sello personal e inconfundible. Todavía no sabemos si es hembra o macho, así que sigue siendo un pequeño enigma con mucha personalidad y una historia que vale la pena contar.',
  }],
]);

// Canonical AM-station aquarium distribution. The xlsx "Ubicación" column carries
// the curator's raw per-animal location (AM 1 / AM 3 / Cuarentena / …), but the
// live museum layout is curated here: four aquariums (AM1–AM4) on one unified
// recirculating system. As of 2026-06-15 the two larvae moved into AM3 — the
// adult that was there (Chocoroll) moved to AM1 and Goldy went to Cuarentena — so
// the standalone larvae aquarium is retired from the occupancy list. Its water is
// still logged separately as the "AM Larvas" system (kept for reference in
// data-water.mjs / the water dashboard); only the per-animal occupancy moves to
// AM3 here. This map is the source of truth for the per-aquarium detail views,
// the QR anchors and the Xovi distribution — the UI reads `pecera` directly. An
// animal whose workbook location is "Cuarentena" keeps its home aquarium here and
// is flagged `enCuarentena` below so the tile shows it is temporarily out (drop
// the entry entirely once it has no AM home, e.g. Goldy). Keep it in sync with
// the curator's physical tank labels.
const AM_PECERA = new Map([
  ['Tamal de dulce', 'AM1'],
  ['Tascalate',      'AM1'],
  ['Parda',          'AM1'],
  ['La negra',       'AM1'],
  ['Chocoroll',      'AM1'],
  ['Pardo Macho',    'AM2'],
  ['Patito',         'AM3'],
  ['Larva 2',        'AM3'],
  ['Martín',         'AM4'],
  ['Limon',          'AM4'],
]);

// ---------------------------------------------------------------------------
// Main

if (!existsSync(XLSX_PATH)) {
  console.error(`[data-ajolotes] ERROR: xlsx not found at ${XLSX_PATH}`);
  console.error('[data-ajolotes] Set AXOLODAO_XLSX to the operations workbook path and re-run.');
  process.exit(1);
}

console.log(`[data-ajolotes] Reading ${XLSX_PATH}`);
const wb = XLSX.readFile(XLSX_PATH, { cellDates: true });

function sheet(name) {
  const sh = wb.Sheets[name];
  if (!sh) throw new Error(`Sheet "${name}" not found`);
  return XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true, blankrows: false });
}

// --- Ejemplares ------------------------------------------------------------
const dashRows = sheet('Dashboard ejemplares');
// Header row identified by alias + especie (resilient to the 2026 rename of the
// "Pecera actual" column to "Ubicación").
const dashHdrIdx = findHeaderRow(dashRows, ['alias', 'especie']);
if (dashHdrIdx < 0) throw new Error('Dashboard ejemplares: header row not found');
const dashHdr = dashRows[dashHdrIdx];
const D = {
  alias:           indexOfHeader(dashHdr, 'alias'),
  id:              indexOfHeader(dashHdr, 'id de ejemplar'),
  pecera:          indexOfHeader(dashHdr, ['pecera actual', 'ubicación']),
  especie:         indexOfHeader(dashHdr, 'especie'),
  genero:          indexOfHeader(dashHdr, 'género'),
  marcas:          indexOfHeader(dashHdr, 'marcas'),
  fenotipo:        indexOfHeader(dashHdr, 'fenotipo'),
  edad:            indexOfHeader(dashHdr, 'edad'),
  estadio:         indexOfHeader(dashHdr, 'estadio'),
  peso:            indexOfHeader(dashHdr, 'último peso'),
  lt:              indexOfHeader(dashHdr, 'longitud total'),
  lhc:             indexOfHeader(dashHdr, 'longitud hocico'),
  icc:             indexOfHeader(dashHdr, 'último icc'),
  propCabezaCuerpo: indexOfHeader(dashHdr, 'proporción cabeza'),
  propColaCuerpo:   indexOfHeader(dashHdr, 'proporción cola'),
  asimetria:        indexOfHeader(dashHdr, 'asimetría'),
  temp:             indexOfHeader(dashHdr, 'temp in situ'),
  bcs:              indexOfHeader(dashHdr, 'bcs'),
  alertaConductual: indexOfHeader(dashHdr, 'alerta conductual'),
  anomalia:         indexOfHeader(dashHdr, 'anomalía'),
  estadoBio:        indexOfHeader(dashHdr, 'estado'),
  ultimoConsumo:    indexOfHeader(dashHdr, 'último consumo'),
  respuestaAlim:    indexOfHeader(dashHdr, 'respuesta alimentaria'),
  alertaGastrica:   indexOfHeader(dashHdr, 'alerta gástrica'),
};

const ejemplares = [];
const knownAliases = new Set();
for (let r = dashHdrIdx + 1; r < dashRows.length; r++) {
  const row = dashRows[r];
  if (!row || row.every((c) => c == null || c === '')) continue;
  const alias = normalizeAlias(toStr(row[D.alias]));
  if (!alias) continue;
  knownAliases.add(alias);
  ejemplares.push({
    alias,
    id: toStr(row[D.id]),
    pecera: toStr(row[D.pecera]),
    especie: toStr(row[D.especie]),
    genero: toStr(row[D.genero]),
    marcas: toStr(row[D.marcas]),
    fenotipo: toStr(row[D.fenotipo]),
    edad: toStr(row[D.edad]),
    estadio: toStr(row[D.estadio]),
    peso: toNum(row[D.peso]),
    lt: toNum(row[D.lt]),
    lhc: toNum(row[D.lhc]),
    icc: toNum(row[D.icc]),
    propCabezaCuerpo: toNum(row[D.propCabezaCuerpo]),
    propColaCuerpo: toNum(row[D.propColaCuerpo]),
    asimetria: toStr(row[D.asimetria]),
    temp: toNum(row[D.temp]),
    bcs: toNumOrText(row[D.bcs]),
    alertaConductual: toStr(row[D.alertaConductual]) ?? '',
    anomalia: toStr(row[D.anomalia]) ?? '',
    estadoBio: toStr(row[D.estadoBio]),
    ultimoConsumo: toNum(row[D.ultimoConsumo]),
    respuestaAlim: toStr(row[D.respuestaAlim]),
    alertaGastrica: toStr(row[D.alertaGastrica]),
    enCuarentena: false,
  });
}

// Apply curator overrides (see EJEMPLAR_OVERRIDES above) after the xlsx read,
// then normalize AM-station ejemplares to their canonical aquarium (AM_PECERA)
// and collapse the unified A. dumerilii system to canonical "AD".
for (const e of ejemplares) {
  const patch = EJEMPLAR_OVERRIDES.get(e.alias);
  if (patch) Object.assign(e, patch);
  // Attach the friendly curator narrative (null when none is curated yet).
  e.descripcion = EJEMPLAR_DESCRIPCIONES.get(e.alias) ?? null;
  const amPecera = AM_PECERA.get(e.alias);
  if (amPecera) {
    // An AM animal whose workbook location is "Cuarentena" keeps its assigned
    // home aquarium but is flagged so the station tile renders the "en
    // cuarentena" ribbon. Self-clears once the curator moves it back in the xlsx.
    const xlsxLoc = (e.pecera ?? '').trim();
    if (xlsxLoc && xlsxLoc !== amPecera && /cuarentena/i.test(xlsxLoc)) {
      e.enCuarentena = true;
    }
    e.pecera = amPecera;
  } else {
    // The A. dumerilii system is one unified tank: "AD Gral.", "AD 1.1", etc.
    // collapse to canonical "AD" so those ejemplares (e.g. Remo) appear in the
    // AD tank detail. Mirrors normalizeTankId() in data-water.mjs.
    const p = (e.pecera ?? '').trim();
    if (/^AD\b/i.test(p) && p !== 'AD') e.pecera = 'AD';
  }
}

// Surface any curated descripcion whose alias matched no ejemplar (e.g. a
// Dashboard re-spelling like "Limón" vs "Limon") instead of silently dropping it.
const descMatched = new Set(ejemplares.filter((e) => e.descripcion).map((e) => e.alias));
const descOrphans = [...EJEMPLAR_DESCRIPCIONES.keys()].filter((k) => !descMatched.has(k));
if (descOrphans.length) {
  console.warn(`[data-ajolotes]   descripcion keys with no matching ejemplar: ${descOrphans.join(', ')}`);
}
console.log(`[data-ajolotes] ejemplares: ${ejemplares.length}`);

// --- Historial -------------------------------------------------------------
const histRows = sheet('Historial medico');
const histHdrIdx = findHeaderRow(histRows, ['fecha', 'autor principal', 'alias']);
if (histHdrIdx < 0) throw new Error('Historial medico: header row not found');
const histHdr = histRows[histHdrIdx];
const H = {
  fecha:         indexOfHeader(histHdr, 'fecha'),
  autor:         indexOfHeader(histHdr, 'autor principal'),
  autor2:        indexOfHeader(histHdr, 'autor secundario'),
  alias:         indexOfHeader(histHdr, 'alias'),
  temp:          indexOfHeader(histHdr, 'temperatura'),
  peso:          indexOfHeader(histHdr, ['masa corporal', 'peso']),
  lt:            indexOfHeader(histHdr, 'longitud  total'),
  lhc:           indexOfHeader(histHdr, 'longitud  hocico'),
  largoCabeza:   indexOfHeader(histHdr, 'largo  cabeza'),
  anchoCabeza:   indexOfHeader(histHdr, 'ancho cabeza'),
  interaxial:    indexOfHeader(histHdr, 'distancia  interaxial'),
  anchoCuerpo:   indexOfHeader(histHdr, 'ancho cuerpo'),
  tibia:         indexOfHeader(histHdr, 'tibia'),
  femur:         indexOfHeader(histHdr, 'femur'),
  antebrazo:     indexOfHeader(histHdr, 'antebrazo'),
  brazo:         indexOfHeader(histHdr, 'l. brazo'),
  branqIzq:      indexOfHeader(histHdr, 'branquias  izquierda'),
  branqDer:      indexOfHeader(histHdr, 'branquias  derecha'),
  cabeza:        indexOfHeader(histHdr, 'revisión  cabeza'),
  cuerpo:        indexOfHeader(histHdr, 'revisión  cuerpo'),
  extremidades:  indexOfHeader(histHdr, 'revisión  extremidades'),
  cola:          indexOfHeader(histHdr, 'revisión  cola'),
  comportamiento: indexOfHeader(histHdr, 'comportamiento'),
  bcs:           indexOfHeader(histHdr, 'condición  corporal'),
  categoria:     indexOfHeader(histHdr, 'categoría'),
  subcategoria:  indexOfHeader(histHdr, 'subcategoría'),
  tipo:          indexOfHeader(histHdr, 'tipo  específico'),
  justificacion: indexOfHeader(histHdr, 'justificación'),
  notas:         indexOfHeader(histHdr, 'notas'),
};

const historial = {};
let histSkipped = 0;
const histUnknownAliases = new Set();
for (let r = histHdrIdx + 1; r < histRows.length; r++) {
  const row = histRows[r];
  if (!row || row.every((c) => c == null || c === '')) continue;
  const alias = normalizeAlias(toStr(row[H.alias]));
  const fecha = toIsoDate(row[H.fecha]);
  if (!alias || !fecha) { histSkipped++; continue; }
  if (!knownAliases.has(alias) && !histUnknownAliases.has(alias)) {
    histUnknownAliases.add(alias);
  }
  const entry = {
    fecha,
    autor: toStr(row[H.autor]),
    autor2: toStr(row[H.autor2]),
    temp: toNum(row[H.temp]),
    peso: toNum(row[H.peso]),
    lt: toNum(row[H.lt]),
    lhc: toNum(row[H.lhc]),
    largoCabeza: toNum(row[H.largoCabeza]),
    anchoCabeza: toNum(row[H.anchoCabeza]),
    interaxial: toNum(row[H.interaxial]),
    anchoCuerpo: toNum(row[H.anchoCuerpo]),
    tibia: toNum(row[H.tibia]),
    femur: toNum(row[H.femur]),
    antebrazo: toNum(row[H.antebrazo]),
    brazo: toNum(row[H.brazo]),
    branqIzq: toNum(row[H.branqIzq]),
    branqDer: toNum(row[H.branqDer]),
    cabeza: toStr(row[H.cabeza]),
    cuerpo: toStr(row[H.cuerpo]),
    extremidades: toStr(row[H.extremidades]),
    cola: toStr(row[H.cola]),
    comportamiento: toStr(row[H.comportamiento]),
    bcs: toNumOrText(row[H.bcs]),
    categoria: toStr(row[H.categoria]),
    subcategoria: toStr(row[H.subcategoria]),
    tipo: toStr(row[H.tipo]),
    justificacion: toStr(row[H.justificacion]),
    notas: toStr(row[H.notas]),
  };
  (historial[alias] ??= []).push(entry);
}
for (const arr of Object.values(historial)) arr.sort((a, b) => a.fecha.localeCompare(b.fecha));
const histTotal = Object.values(historial).reduce((n, arr) => n + arr.length, 0);
console.log(`[data-ajolotes] historial: ${histTotal} entries across ${Object.keys(historial).length} aliases`);
if (histSkipped) console.warn(`[data-ajolotes]   skipped ${histSkipped} historial rows (missing alias or fecha)`);
if (histUnknownAliases.size) {
  console.warn(`[data-ajolotes]   historial aliases not in Dashboard: ${[...histUnknownAliases].join(', ')}`);
}

// --- Planes ----------------------------------------------------------------
const planRows = sheet('Plan de alimentación');
const planHdrIdx = findHeaderRow(planRows, ['alias', 'frecuencia']);
if (planHdrIdx < 0) throw new Error('Plan de alimentación: header row not found');
const planHdr = planRows[planHdrIdx];
const P = {
  alias:      indexOfHeader(planHdr, 'alias'),
  pecera:     indexOfHeader(planHdr, 'pecera'),
  especie:    indexOfHeader(planHdr, 'especie'),
  estadio:    indexOfHeader(planHdr, 'estadio'),
  dietaBase:  indexOfHeader(planHdr, 'dieta base'),
  planB:      indexOfHeader(planHdr, 'plan b'),
  porcion:    indexOfHeader(planHdr, 'porción'),
  frecuencia: indexOfHeader(planHdr, 'frecuencia'),
  notas:      indexOfHeader(planHdr, 'notas'),
};

const planes = {};
let planUnknown = 0;
for (let r = planHdrIdx + 1; r < planRows.length; r++) {
  const row = planRows[r];
  if (!row || row.every((c) => c == null || c === '')) continue;
  const alias = normalizeAlias(toStr(row[P.alias]));
  if (!alias) continue;
  if (!knownAliases.has(alias)) planUnknown++;
  planes[alias] = {
    pecera: toStr(row[P.pecera]),
    especie: toStr(row[P.especie]),
    estadio: toStr(row[P.estadio]),
    dietaBase: toStr(row[P.dietaBase]),
    planB: toStr(row[P.planB]),
    porcion: toStr(row[P.porcion]),
    frecuencia: toStr(row[P.frecuencia]),
    notas: toStr(row[P.notas]),
  };
}
console.log(`[data-ajolotes] planes: ${Object.keys(planes).length}`);
if (planUnknown) console.warn(`[data-ajolotes]   ${planUnknown} plan rows for aliases not in Dashboard`);

// --- Alimentación ----------------------------------------------------------
const alimRows = sheet('Alimentación 2.0');
const alimHdrIdx = findHeaderRow(alimRows, ['fecha', 'alias', 'racion']);
if (alimHdrIdx < 0) throw new Error('Alimentación 2.0: header row not found');
const alimHdr = alimRows[alimHdrIdx];
// Alimentación 2.0 column B header has been observed to corrupt away from
// 'Hora' (e.g. '\]_Ñ¨P?0'); fall back to position 1 so a single corrupted
// header cell does not drop the time column.
const A = {
  fecha:     indexOfHeader(alimHdr, 'fecha'),
  hora:      (() => {
    const i = indexOfHeader(alimHdr, 'hora');
    return i >= 0 ? i : 1;
  })(),
  autor:     indexOfHeader(alimHdr, 'autor principal'),
  alias:     indexOfHeader(alimHdr, 'alias'),
  tipo:      indexOfHeader(alimHdr, 'tipo de alimento'),
  racion:    indexOfHeader(alimHdr, 'racion'),
  sobrante:  indexOfHeader(alimHdr, 'sobrante'),
  consumo:   indexOfHeader(alimHdr, 'consumo'),
  respuesta: indexOfHeader(alimHdr, 'respuesta'),
};

const alimentacion = {};
let alimSkipped = 0;
const alimUnknownAliases = new Set();
for (let r = alimHdrIdx + 1; r < alimRows.length; r++) {
  const row = alimRows[r];
  if (!row || row.every((c) => c == null || c === '')) continue;
  const rawAlias = toStr(row[A.alias]);
  // Combo entries (e.g. 'Tamal de dulce, Tascalate') stay as a single key but
  // each component is normalized so the join with ejemplares still resolves.
  const alias = rawAlias
    ? rawAlias.split(',').map((s) => normalizeAlias(s.trim())).join(', ')
    : rawAlias;
  const fecha = toIsoDate(row[A.fecha]);
  if (!alias || !fecha) { alimSkipped++; continue; }
  if (!knownAliases.has(alias)) alimUnknownAliases.add(alias);
  const entry = {
    fecha,
    hora: toTimeFraction(row[A.hora]),
    autor: toStr(row[A.autor]),
    tipo: toStr(row[A.tipo]),
    racion: toNum(row[A.racion]),
    sobrante: toNum(row[A.sobrante]),
    consumo: toNum(row[A.consumo]),
    respuesta: renameInText(toStr(row[A.respuesta])),
  };
  (alimentacion[alias] ??= []).push(entry);
}
for (const arr of Object.values(alimentacion)) arr.sort((a, b) => a.fecha.localeCompare(b.fecha));
const alimTotal = Object.values(alimentacion).reduce((n, arr) => n + arr.length, 0);
console.log(`[data-ajolotes] alimentacion: ${alimTotal} entries across ${Object.keys(alimentacion).length} aliases`);
if (alimSkipped) console.warn(`[data-ajolotes]   skipped ${alimSkipped} alimentacion rows (missing alias or fecha)`);
if (alimUnknownAliases.size) {
  console.warn(`[data-ajolotes]   alimentacion aliases not in Dashboard: ${[...alimUnknownAliases].join(', ')}`);
}

// --- Bajas -----------------------------------------------------------------
const bajaRows = sheet('Bajas');
const bajaHdrIdx = findHeaderRow(bajaRows, ['fecha', 'nombre', 'causa']);
if (bajaHdrIdx < 0) throw new Error('Bajas: header row not found');
const bajaHdr = bajaRows[bajaHdrIdx];
const B = {
  fecha:     indexOfHeader(bajaHdr, 'fecha'),
  nombre:    indexOfHeader(bajaHdr, 'nombre'),
  peso:      indexOfHeader(bajaHdr, 'peso'),
  longitud:  indexOfHeader(bajaHdr, 'longitud'),
  edad:      indexOfHeader(bajaHdr, 'edad'),
  causa:     indexOfHeader(bajaHdr, 'causa'),
  necropcia: indexOfHeader(bajaHdr, 'necropcia'),
  // Read but NOT published: bajas[] carries no id. It exists solely to
  // cross-check the name join below.
  id:        indexOfHeader(bajaHdr, 'id'),
};

const bajas = [];
for (let r = bajaHdrIdx + 1; r < bajaRows.length; r++) {
  const row = bajaRows[r];
  if (!row || row.every((c) => c == null || c === '')) continue;
  const nombre = normalizeAlias(toStr(row[B.nombre]));
  if (!nombre) continue;
  bajas.push({
    fecha: toIsoDate(row[B.fecha]),
    nombre,
    peso: toNumOrText(row[B.peso]),
    longitud: toNumOrText(row[B.longitud]),
    edad: toStr(row[B.edad]),
    causa: toStr(row[B.causa]),
    necropcia: toStr(row[B.necropcia]),
  });
}
// Null-fecha rows sort to the end so the timeline starts with the earliest
// confirmed date.
bajas.sort((a, b) => {
  if (a.fecha == null && b.fecha == null) return 0;
  if (a.fecha == null) return 1;
  if (b.fecha == null) return -1;
  return a.fecha.localeCompare(b.fecha);
});

// Embargo filter: some records are temporarily withheld from the public bundle
// until an operational precondition is met (tracked outside version control).
// The withheld names are NOT hardcoded here — they come from the operator env
// (AXOLODAO_EMBARGO_BAJAS) or an untracked scripts/.embargo.json (see
// loadEmbargoNames), so the source stays neutral and the value lives outside
// version control. Names are matched against the normalized name, lowercased.
const embargoBajas = loadEmbargoNames(__dirname);
const isEmbargoedName = (name) =>
  embargoBajas.has((normalizeAlias(toStr(name)) ?? '').trim().toLowerCase());
const publicBajas = bajas.filter((b) => !isEmbargoedName(b.nombre));
const withheld = bajas.length - publicBajas.length;
if (withheld > 0) console.log(`[data-ajolotes] bajas withheld (embargo): ${withheld}`);
console.log(`[data-ajolotes] bajas: ${publicBajas.length}`);

// Deceased filter: the Dashboard sheet is a roster snapshot and does NOT clear a
// row when an axolotl dies, so a specimen can appear in BOTH ejemplares (alive)
// and Bajas (dead). Filtering here — at the bundle boundary — is what makes the
// fix hold for every consumer, not just this site: Xovi fetches bundle.json over
// HTTPS and had no bajas filter at all (it was serving the deceased Panchita as a
// selectable clip target), and the /covers roster fetch has none either. Match on
// the normalized+lowercased alias, the same key the embargo filter uses.
//
// Uses the FULL bajas list, not publicBajas: an embargoed death still means the
// animal is dead, and the embargo filter already strips its roster row too — so
// the outcome is identical either way, and this stays correct if that changes.
const deceasedNames = new Set(
  bajas.map((b) => (normalizeAlias(toStr(b.nombre)) ?? '').trim().toLowerCase()).filter(Boolean),
);

// GUARD: a death row whose registry ID belongs to a specimen the Dashboard still
// lists as alive.
//
// This join is by NAME. `publicEjemplares` and `bajasSnapshots` are complementary
// sets over that one predicate, so swapping which name is "the dead one" moves a
// specimen from the roster to the memorial and another the other way, and the
// COUNTS DO NOT CHANGE. There is no numeric signal. That makes a single wrong
// name in Bajas silently publish a living animal as dead and a dead one as alive
// — the exact pair of claims this file exists to prevent.
//
// The IDs are the only independent evidence, so they get a vote: if a death row
// carries the ID of someone still on the Dashboard, the two sources disagree
// about who died and the ingest refuses rather than picking one.
{
  const liveById = new Map(
    ejemplares
      .map((e) => [(toStr(e.id) ?? '').trim().toUpperCase(), e])
      .filter(([id]) => id),
  );
  const conflicts = [];
  for (let r = bajaHdrIdx + 1; r < bajaRows.length; r++) {
    const row = bajaRows[r];
    if (!row) continue;
    const bajaId = B.id >= 0 ? (toStr(row[B.id]) ?? '').trim().toUpperCase() : '';
    if (!bajaId) continue;
    const live = liveById.get(bajaId);
    if (!live) continue;
    const bajaName = (normalizeAlias(toStr(row[B.nombre])) ?? '').trim();
    // Same name on both sides means the Dashboard simply has not been closed out
    // yet, which is normal and already handled by the name gate.
    if (bajaName && bajaName.toLowerCase() === (live.alias ?? '').trim().toLowerCase()) continue;
    conflicts.push(`  Bajas "${bajaName}" lleva el ID ${bajaId}, que el Dashboard asigna a "${live.alias}" (${live.pecera ?? 'sin pecera'})`);
  }
  if (conflicts.length) {
    console.warn(
      `[data-ajolotes] AVISO: ${conflicts.length} fila(s) de Bajas con ID de un ejemplar del Dashboard:\n${conflicts.join('\n')}\n` +
      `  El cruce de fallecidos es por NOMBRE, asi que un nombre equivocado aqui intercambia quien sale al muro y quien al roster SIN cambiar ningun conteo.\n` +
      `  Corrige el ID en la hoja, no el nombre.`,
    );
  }
}

// Curator override for deaths not yet recorded in the Bajas sheet. This exists
// only to bridge the lag between an animal dying and the xlsx being updated —
// DELETE a name from here the moment its Bajas row lands, or it will mask a real
// roster entry forever. Kept in the ingest (not in a component) so every consumer
// inherits it; the per-component HIDDEN_AJOLOTE_ALIASES sets are the pattern this
// replaces. Goldy: announced deceased in ep18 / Pulso W29, no Bajas row as of
// 2026-07-22.
const DECEASED_NOT_IN_BAJAS = ['Goldy'];
for (const n of DECEASED_NOT_IN_BAJAS) {
  const key = (normalizeAlias(toStr(n)) ?? '').trim().toLowerCase();
  if (key) deceasedNames.add(key);
}
const isDeceasedName = (name) =>
  deceasedNames.has((normalizeAlias(toStr(name)) ?? '').trim().toLowerCase());

// --- Terapéutica y Hospital ------------------------------------------------
// Sheet schema: Fecha | Hora | Autor Principal | Autor Secundario | Alias del
// Ejemplar | Ubicación | Diagnóstico/Motivo | Pruebas de Laboratorio |
// Tratamiento | Dosis | Vía de Administración | Día de Tratamiento (date, not
// number) | Observaciones del Paciente | Estado del Caso. ENS suffixes on
// authors are stripped at render-time (matches Historial behavior).
const teraRows = sheet('Terapéutica y Hospital');
const teraHdrIdx = findHeaderRow(teraRows, ['fecha', 'alias', 'diagnóstico']);
if (teraHdrIdx < 0) throw new Error('Terapéutica y Hospital: header row not found');
const teraHdr = teraRows[teraHdrIdx];
const T = {
  fecha:          indexOfHeader(teraHdr, 'fecha'),
  hora:           indexOfHeader(teraHdr, 'hora'),
  autor:          indexOfHeader(teraHdr, 'autor principal'),
  autor2:         indexOfHeader(teraHdr, 'autor secundario'),
  alias:          indexOfHeader(teraHdr, 'alias'),
  ubicacion:      indexOfHeader(teraHdr, 'ubicación'),
  diagnostico:    indexOfHeader(teraHdr, 'diagnóstico'),
  pruebasLab:     indexOfHeader(teraHdr, ['pruebas de laboratorio', 'pruebas de\nlaboratorio']),
  tratamiento:    indexOfHeader(teraHdr, 'tratamiento'),
  dosis:          indexOfHeader(teraHdr, 'dosis'),
  via:            indexOfHeader(teraHdr, ['vía de administración', 'vía de\nadministración']),
  diaTratamiento: indexOfHeader(teraHdr, ['día de tratamiento', 'día de\ntratamiento']),
  observaciones:  indexOfHeader(teraHdr, ['observaciones del paciente', 'observaciones\ndel paciente']),
  estado:         indexOfHeader(teraHdr, ['estado del caso', 'estado del\ncaso']),
};

const terapeutica = {};
let teraSkipped = 0;
const teraUnknownAliases = new Set();
for (let r = teraHdrIdx + 1; r < teraRows.length; r++) {
  const row = teraRows[r];
  if (!row || row.every((c) => c == null || c === '')) continue;
  const alias = normalizeAlias(toStr(row[T.alias]));
  const fecha = toIsoDate(row[T.fecha]);
  if (!alias || !fecha) { teraSkipped++; continue; }
  if (!knownAliases.has(alias)) teraUnknownAliases.add(alias);
  const entry = {
    fecha,
    hora: toTimeFraction(row[T.hora]),
    autor: toStr(row[T.autor]),
    autor2: toStr(row[T.autor2]),
    ubicacion: toStr(row[T.ubicacion]),
    diagnostico: toStr(row[T.diagnostico]),
    pruebasLab: toStr(row[T.pruebasLab]),
    tratamiento: toStr(row[T.tratamiento]),
    dosis: toStr(row[T.dosis]),
    via: toStr(row[T.via]),
    diaTratamiento: toIsoDate(row[T.diaTratamiento]) ?? toStr(row[T.diaTratamiento]),
    observaciones: toStr(row[T.observaciones]),
    estado: toStr(row[T.estado]),
  };
  (terapeutica[alias] ??= []).push(entry);
}
for (const arr of Object.values(terapeutica)) {
  arr.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
const teraTotal = Object.values(terapeutica).reduce((n, arr) => n + arr.length, 0);
console.log(`[data-ajolotes] terapeutica: ${teraTotal} entries across ${Object.keys(terapeutica).length} aliases`);
if (teraSkipped) console.warn(`[data-ajolotes]   skipped ${teraSkipped} terapeutica rows (missing alias or fecha)`);
if (teraUnknownAliases.size) {
  console.warn(`[data-ajolotes]   terapeutica aliases not in Dashboard: ${[...teraUnknownAliases].join(', ')}`);
}

// --- Write -----------------------------------------------------------------
// Embargo (continued): also strip embargoed specimens from the live roster and
// their per-name detail dictionaries. The client island serializes the WHOLE
// bundle for hydration, so a withheld name must leave no trace anywhere in the
// artifact — not just the bajas array. Uses the same list as the bajas filter.
//
// A live roster entry must survive BOTH gates: not embargoed, and not deceased.
// The per-name detail dictionaries keep their embargo-only strip — a deceased
// specimen's history stays in the bundle on purpose, because the In Memoriam
// surface reads it; only the LIVE roster drops them.
const publicEjemplares = ejemplares.filter((e) => !isEmbargoedName(e.alias) && !isDeceasedName(e.alias));
for (const dict of [planes, historial, terapeutica, alimentacion]) {
  for (const key of Object.keys(dict)) {
    if (isEmbargoedName(key)) delete dict[key];
  }
}
// Last known snapshot of each deceased specimen: OUT of the live roster, but
// still IN the bundle. The In-Memoriam wall renders its biometrics from these
// rows (memorial.ts bundleEjemplarFor, AjolotesExplorer SYNTH_BAJAS), and Goldy
// has no Bajas row at all — dropping them outright would erase him from the
// memorial. Embargoed names are excluded so a withheld death still leaves no
// trace anywhere in the artifact.
const bajasSnapshots = ejemplares.filter((e) => isDeceasedName(e.alias) && !isEmbargoedName(e.alias));
console.log(`[data-ajolotes] bajasSnapshots: ${bajasSnapshots.length}`);

const strippedEjemplares = ejemplares.length - publicEjemplares.length;
if (strippedEjemplares > 0) console.log(`[data-ajolotes] ejemplares withheld (embargo + deceased): ${strippedEjemplares}`);
// Nag only about deaths the embargo is NOT already handling: those are rows the
// curator still has to clear from the Dashboard sheet.
const stillListed = ejemplares
  .filter((e) => isDeceasedName(e.alias) && !isEmbargoedName(e.alias))
  .map((e) => e.alias);
if (stillListed.length > 0) {
  console.warn(
    `[data-ajolotes] deceased specimens removed from the live roster: ${stillListed.join(', ')} ` +
      '— clear their rows from the Dashboard sheet so this filter becomes a no-op.',
  );
}

const bundle = {
  ejemplares: publicEjemplares,
  bajasSnapshots,
  planes,
  historial,
  terapeutica,
  alimentacion,
  bajas: publicBajas,
};
writeFileSync(join(OUT_DIR, 'bundle.json'), JSON.stringify(bundle, null, 2) + '\n');
console.log(`[data-ajolotes] wrote ${join(OUT_DIR, 'bundle.json')}`);
console.log('[data-ajolotes] Done.');
