// The Xolotlcalli registry files that the OpenDatasetSnapshot@1 fingerprint covers (22-oct): a CLEAN set derived from the site's public data at
// AxoloDAO 7757599, served one by one at /xolotlcalli/datos/huella/ with its listing. What the IP review rules out never enters: no weight, length,
// cause, necropsy, treatment, feeding, photo or hash of a specimen; deaths are a status with a date, without cause or blame.
//   especimenes.json   one row per specimen: public id, name, species, SEMARNAT ID in clear, status, status date and its precision, entry date,
//                      and the status history as append-only entries (date, previous, new)
//   agua-semanal.json  weekly water per system (AA, AM, AD), from the replay's public metrics as the pilot card projects them (lib/pilotoPublico.mjs):
//                      extremes suppressed where the replay flags them (flag 16), no specimen ids; AD's water stays private by the R1 rule
//   estanques.json     the tanks, without their notes
//   parametros.json    the reference ranges per tank and parameter
//   cierre.json        the closure
// Every byte is derived from git objects at fixed commits, so a rerun writes the same bytes.
//   node scripts/xolotlcalli-registro.mjs            writes the files and the listing (listado-stand.txt) under public/xolotlcalli/datos/huella/
//   node scripts/xolotlcalli-registro.mjs --check    exits 1 if the committed files differ from what the sources give
// The data repository's checkout (for the pilot card's weekly water, at the commit the site manifest pins): BRAIN_HUB_DATOS.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fichaPublica } from '../src/lib/pilotoPublico.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const COMMIT_SITIO = '7757599';
export const BUNDLE = `${COMMIT_SITIO}-xolotlcalli`;
export const LICENCIA = 'LicenseRef-registros-piloto-xolotlcalli';
export const SALIDA = join(SITE, 'public/xolotlcalli/datos/huella');
export const ARCHIVOS_DE_DATOS = ['especimenes.json', 'agua-semanal.json', 'estanques.json', 'parametros.json', 'cierre.json'];
const sha = (b) => createHash('sha256').update(b).digest('hex');
const json = (o) => `${JSON.stringify(o, null, 1)}\n`;

const delSitio = (ruta) => JSON.parse(execFileSync('git', ['-C', SITE, 'show', `${COMMIT_SITIO}:${ruta}`], { maxBuffer: 1 << 27 }).toString('utf8'));

/** A public id from a name: lower case, no accents, hyphens. */
export const idPublico = (nombre) => nombre.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ESPECIE = { 'A. mexicanum': 'Ambystoma mexicanum', 'A. andersoni': 'Ambystoma andersoni', 'A. andersonii': 'Ambystoma andersoni', 'A. dumerilii': 'Ambystoma dumerilii' };
const especie = (e) => (e == null ? null : ESPECIE[e] ?? (() => { throw new Error(`a species the registry does not know: ${e}`); })());
// the precision of a date, in the workbook's own codes (bundle «fechaConf»); the death ledger's English codes map onto them
const PRECISION = { exact: 'exacta', window: 'ventana', a_mas_tardar: 'a_mas_tardar', swapped: 'invertida', parcial: 'parcial' };

/** The specimens: the living ones as of the workbook's cut, then each death as a status with its date. */
export function especimenes({ bundle, forense, seguimiento }) {
  const corte = [...new Set(Object.values(seguimiento.vivos).map((v) => v.corte))];
  if (corte.length !== 1) throw new Error('the living specimens do not share one cut date');
  const vivos = bundle.ejemplares.map((e) => ({
    id: idPublico(e.alias), nombre: e.alias, especie: especie(e.especie), idSemarnat: e.id ?? null,
    estado: 'vivo', estadoFecha: corte[0], fechaPrecision: 'corte', fechaIngreso: null, historial: [],
  }));
  // the deaths: the workbook's ledger (bundle.bajas), plus the one the death ledger adds after it (Larva 2), each with the species the death ledger gives
  const delLibro = new Map(forense.especimenes.map((x) => [x.alias, x]));
  const larvas = bundle.bajas.filter((b) => /^Larva de ajolote/.test(b.nombre));
  const bajas = bundle.bajas.map((b) => {
    const larva = /^Larva de ajolote/.test(b.nombre);
    const nombre = larva ? 'Larva de ajolote' : b.nombre;
    const id = larva ? `larva-de-ajolote-${larvas.indexOf(b) + 1}` : idPublico(b.nombre);
    const especieLibro = larva ? delLibro.get('Larvas (7)')?.species : delLibro.get(b.nombre)?.species;
    return { id, nombre, especie: especie(especieLibro ?? null), idSemarnat: null, estado: 'baja', estadoFecha: b.fecha ?? null, fechaPrecision: b.fechaConf, fechaIngreso: null,
      historial: [{ fecha: b.fecha ?? null, anterior: 'vivo', nuevo: 'baja' }] };
  });
  for (const x of forense.especimenes) {
    if (x.alias === 'Larvas (7)' || bundle.bajas.some((b) => b.nombre === x.alias)) continue;
    const snap = bundle.bajasSnapshots.find((s) => s.alias === x.alias);
    bajas.push({ id: idPublico(x.alias), nombre: x.alias, especie: especie(x.species ?? snap?.especie ?? null), idSemarnat: snap?.id ?? null, estado: 'baja',
      estadoFecha: x.death.date ?? null, fechaPrecision: PRECISION[x.death.conf] ?? x.death.conf, fechaIngreso: null,
      historial: [{ fecha: x.death.date ?? null, anterior: 'vivo', nuevo: 'baja' }] });
  }
  const filas = [...vivos, ...bajas];
  const ids = filas.map((f) => f.id);
  if (new Set(ids).size !== ids.length) throw new Error('two specimens share a public id');
  return {
    registro: 'Ejemplares del Museo de Ajolotes Xolotlcalli (2025–2026)',
    fuente: `datos públicos del sitio AxoloDAO en ${COMMIT_SITIO}`,
    corte: corte[0],
    campos: {
      estadoFecha: 'para un ejemplar vivo, la fecha de corte del libro operativo; para una baja, la fecha de la baja',
      fechaPrecision: 'la precisión de esa fecha, con los códigos del libro operativo',
      fechaIngreso: 'los datos públicos no registran la fecha de ingreso',
      historial: 'cada cambio de estado es una entrada nueva (fecha, anterior, nuevo); nada se reescribe',
    },
    ejemplares: filas,
  };
}

/** The weekly water per system, as the pilot card projects the replay's public metrics. */
export function aguaSemanal(ficha) {
  const { aguaSemanal: a } = fichaPublica(ficha);
  const sistemas = Object.fromEntries(Object.entries(a.sistemas).filter(([k]) => ['aa', 'am', 'ad'].includes(k)));
  return {
    fuente: 'métricas semanales públicas del libro operativo del piloto',
    extremosSuprimidos: 'en las semanas así marcadas el mínimo y el máximo no se publican; la media sí',
    sistemas,
  };
}

/** The tanks without their notes. */
export const estanques = (tanks) => tanks.map(({ note, ...t }) => t);

/** The pilot card at the commit the site manifest pins, checked against the manifest's sha256. */
function fichaFijada() {
  const repo = process.env.BRAIN_HUB_DATOS;
  if (!repo) throw new Error('set BRAIN_HUB_DATOS to the checkout of the data repository (the weekly water is read from it at a pinned commit)');
  const m = JSON.parse(readFileSync(join(SITE, 'scripts/fixtures/sitio-datos.manifest.json'), 'utf8')).archivos.find((a) => a.id === 'ficha');
  const bytes = execFileSync('git', ['-C', repo, 'show', `${m.commit}:${m.ruta}`], { maxBuffer: 1 << 26 });
  if (sha(bytes) !== m.sha256) throw new Error('the pilot card at its pinned commit does not hash to the manifest');
  return JSON.parse(bytes.toString('utf8'));
}

/** Every file of the bundle with its bytes, the manifest and the licences included, and the listing that names them. */
export function construir() {
  const datos = {
    'especimenes.json': json(especimenes({ bundle: delSitio('Site/src/data/ajolotes/bundle.json'), forense: delSitio('Site/public/data/ajolotes/bajas-forense.json'), seguimiento: delSitio('Site/public/data/ajolotes/seguimiento.json') })),
    'agua-semanal.json': json(aguaSemanal(fichaFijada())),
    'estanques.json': json(estanques(delSitio('Site/src/data/water-quality/tanks.json'))),
    'parametros.json': json(delSitio('Site/src/data/water-quality/parameters.json')),
    'cierre.json': json(delSitio('Site/src/data/closure.json')),
  };
  const licencias = `${JSON.stringify({ spdx: LICENCIA })}\n`;
  const conLicencias = { ...datos, 'licences.jsonl': licencias };
  const manifiesto = json({ bundle: BUNDLE, algoritmo: 'sha256', licencia: LICENCIA,
    archivos: Object.entries(conLicencias).map(([ruta, t]) => ({ ruta, bytes: Buffer.byteLength(t), huella: sha(Buffer.from(t)) })) });
  const archivos = { ...conLicencias, 'manifest.json': manifiesto };
  const listado = `zenbit-listado-stand v1\nbundle ${BUNDLE} manifest 0x${sha(Buffer.from(manifiesto))}\n`
    + Object.keys(archivos).sort().map((r) => `${sha(Buffer.from(archivos[r]))}  ${BUNDLE}/${r}`).join('\n') + '\n';
  return { archivos, listado };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { archivos, listado } = construir();
  const destino = (r) => join(SALIDA, BUNDLE, r);
  if (process.argv.includes('--check')) {
    const mal = [...Object.entries(archivos).filter(([r, t]) => !existsSync(destino(r)) || readFileSync(destino(r), 'utf8') !== t).map(([r]) => r),
      ...(!existsSync(join(SALIDA, 'listado-stand.txt')) || readFileSync(join(SALIDA, 'listado-stand.txt'), 'utf8') !== listado ? ['listado-stand.txt'] : [])];
    console.log(mal.length ? `✗ the committed files differ from their sources: ${mal.join(', ')}` : `✓ the ${Object.keys(archivos).length} files and the listing are what the sources give`);
    process.exit(mal.length ? 1 : 0);
  }
  for (const [r, t] of Object.entries(archivos)) { mkdirSync(dirname(destino(r)), { recursive: true }); writeFileSync(destino(r), t); }
  writeFileSync(join(SALIDA, 'listado-stand.txt'), listado);
  console.log(`written: ${Object.keys(archivos).length} files under ${BUNDLE}/ and listado-stand.txt (listing sha256 0x${sha(Buffer.from(listado))})`);
}
