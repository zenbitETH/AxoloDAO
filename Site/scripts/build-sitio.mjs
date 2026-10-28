// The axolodao.org build (PUBLIC_ATLAS_SITIO=1): reads the three data files of the pilot's card from the data repository at NAMED commits, checks each against the committed manifest
// (scripts/fixtures/sitio-datos.manifest.json: repository path, commit, sha256 of the file at that commit), writes their PUBLIC projection (src/lib/pilotoPublico.mjs:
// only the fields the card renders), builds, and removes the copies again (public/ ships in every build, so they
// must never stay there: the flags-off build and the demo carry none of them).
//   HUB_BUILD_URL=<hub> HUB_KEY_FILE=… HUB_KEY_HEADER=… HUB_KEY_SCHEME=… npm run build:sitio [-- --outDir <dir>]   builds from a strict hub read, from a clean tree, and refuses otherwise (exit 1)
//   --prueba   builds WITHOUT the hub and the clean-tree rule, for the test runner only: build.json says «prueba» and the pre-push check refuses such a dist
//   node scripts/build-sitio.mjs --fijar                    writes the manifest from the commits below (after a ruling moves one of them)
// The data repository's checkout: BRAIN_HUB_DATOS (required). The chain file is the STAND file (the whole Safe, form (b)), never the demo's real read with the signer row.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clipsDelSitio, datosDelSitioValidos } from '../src/lib/sitioDatos.mjs';
import { cadenaPublica, clipsPublicos, fichaPublica } from '../src/lib/pilotoPublico.mjs';
import { cifrasDe } from '../src/lib/cifrasHome.mjs';
import { archivosSinLicencia, copiarHuella, leerListado, registroDeConstruccion, verificarHuella } from './lib/huella.mjs';
import { paginaXolotlcalli, problemasDeLaAtestacion, problemasDeLasAnclas } from './lib/huellaXolotlcalli.mjs';
import { firmaVigente } from '../src/lib/firmasRetiradas.mjs';
import { arbolSucio, motivoParaNoConstruir, problemasDeLaConstruccionDelSitio } from './lib/construccionSitio.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = process.env.BRAIN_HUB_DATOS;
const SIN_REPO = 'set BRAIN_HUB_DATOS to the checkout of the data repository (the pilot\'s files are read from it at pinned commits)';
const MANIFIESTO = join(SITE, 'scripts/fixtures/sitio-datos.manifest.json');
// where each file comes from, at which commit, and where the card reads it
const FUENTES = [
  { id: 'ficha', ruta: 'context/datos/demo/xolotlcalli-ficha.json', commit: '9a61a62', destino: 'public/atlas/real/xolotlcalli-ficha.json' },
  { id: 'clips', ruta: 'context/datos/demo/xovi-clips-xolotlcalli.json', commit: '305b81d', destino: 'public/atlas/real/xolotlcalli-clips.json' },
  { id: 'cadena', ruta: 'context/datos/demo/xolotlcalli-cadena-stand.json', commit: 'a30747b', destino: 'public/atlas/real/xolotlcalli-cadena.json' },
];
const sha = (b) => createHash('sha256').update(b).digest('hex');
const leer = (f) => { if (!REPO) throw new Error(SIN_REPO); return execFileSync('git', ['-C', REPO, 'show', `${f.commit}:${f.ruta}`], { maxBuffer: 1 << 26 }); };

if (process.argv.includes('--fijar')) {
  const m = { generadoPor: 'scripts/build-sitio.mjs --fijar', archivos: FUENTES.map((f) => ({ ...f, sha256: sha(leer(f)) })) };
  writeFileSync(MANIFIESTO, JSON.stringify(m, null, 1) + '\n');
  console.log(`manifest written: ${m.archivos.map((a) => `${a.id} ${a.commit} ${a.sha256.slice(0, 12)}`).join(', ')}`);
  process.exit(0);
}

const prueba = process.argv.includes('--prueba');
const manifiesto = JSON.parse(readFileSync(MANIFIESTO, 'utf8'));
const copias = [];
let estado = 1, out = null;
const argsAstro = process.argv.slice(2).filter((a) => a !== '--prueba');
try {
  const motivo = motivoParaNoConstruir(process.env, { prueba });
  if (motivo) throw new Error(motivo);
  if (!prueba) { const sucio = arbolSucio(SITE); if (sucio.length) throw new Error(`the tree is not clean (${sucio.length} change(s) or untracked file(s), e.g. ${sucio[0]}): a deployable build comes from a commit`); }
  const datos = {};
  for (const e of manifiesto.archivos) {
    const bytes = leer(e);
    if (sha(bytes) !== e.sha256) throw new Error(`${e.id}: the file at ${e.commit} does not hash to the manifest's sha256`);
    datos[e.id] = JSON.parse(bytes.toString('utf8'));
  }
  // what the page serves: the clips as they are (every signed clip), the chain file through the stand's guards (a row that fails one is refused, and the build stops: the card needs the treasury and ENS rows)
  const { clips, cadena, problemas } = datosDelSitioValidos(datos);
  if (problemas.length) throw new Error(`the data does not pass the guards: ${problemas.join('; ')}`);
  // what is written into public/: the public projection of each file (lib/pilotoPublico.mjs), never the internal file as it is
  const salida = { ficha: fichaPublica(datos.ficha), clips: clipsPublicos(clips), cadena: cadenaPublica(cadena) };
  for (const e of manifiesto.archivos) {
    const dest = join(SITE, e.destino); mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, JSON.stringify(salida[e.id])); copias.push(dest);
  }
  console.log(`sitio data: ficha ${datos.ficha.fecha ?? ''}, ${clips.clips.length} clips, ${cadena.filas.length} chain rows (${cadena.filas.map((f) => f.id).join(', ')})`);
  const iOut = process.argv.indexOf('--outDir'); out = resolve(SITE, iOut >= 0 ? process.argv[iOut + 1] : 'dist');
  const r = spawnSync('npx', ['--no-install', 'astro', 'build', ...argsAstro], { cwd: SITE, stdio: 'inherit', env: { ...process.env, PUBLIC_ATLAS_SITIO: '1', BUILD_SITIO_DESPLIEGUE: '1' }   /* the flag Vercel's build command (scripts/build-vercel.mjs) requires */ });
  estado = r.status ?? 1;
  if (estado !== 0) throw new Error('astro build failed');
  estado = 1;   // from here on only a verified build exits 0
  // the atlas fingerprint, served one file at a time: Contracts' listing (HUELLA_LISTADO) and the entity folders it names (ENTIDADES_DIR), copied byte for byte into the built site and re-verified against the listing
  {
    // the listing is read AT a pinned commit of Contracts' repository (the site must serve exactly what gets attested): 9f7cf28 (HUELLA_COMMIT); HUELLA_LISTADO (a file) overrides, for tests
    const repoHuella = process.env.HUELLA_REPO ?? join(homedir(), 'Documents/GitHub/axolodao-system-booth-browser'), commitHuella = process.env.HUELLA_COMMIT ?? '9f7cf28';
    let listadoRuta = process.env.HUELLA_LISTADO;
    if (!listadoRuta) { listadoRuta = join(mkdtempSync(join(tmpdir(), 'huella-')), 'listado-stand.txt'); writeFileSync(listadoRuta, execFileSync('git', ['-C', repoHuella, 'show', `${commitHuella}:tools/atlas-huella/listado-stand.txt`], { maxBuffer: 1 << 24 })); }
    const entidades = process.env.ENTIDADES_DIR ?? join(homedir(), '.cache/axolodao-datos/open/entities');
    const atestacion = JSON.parse(readFileSync(join(SITE, 'src/data/atestacion-atlas.json'), 'utf8'));
    const salidaHuella = join(out, 'atlas/datos/huella');
    // the clip confirmations the page's intro names, counted by the same inventory as the home's figures
    const inventario = (f) => JSON.parse(readFileSync(join(SITE, 'src/data/inventario', f), 'utf8'));
    const { clips: confirmaciones } = cifrasDe({ cadena: inventario('inventario-cadena-xolotlcalli.json'), atlas: inventario('inventario-atlas.json'), taquilla: inventario('taquilla-home.json') });
    const mal = copiarHuella({ listadoRuta, entidades, salida: salidaHuella, atestacion, confirmaciones });
    if (mal.length) throw new Error(`the fingerprint is not exact: ${mal.slice(0, 5).join('; ')}`);   // before any build record: a record only ever describes an exact fingerprint
    // the Xolotlcalli registry fingerprint: its files come from public/ (scripts/xolotlcalli-registro.mjs); here they are re-verified against their
    // listing, the attestation (once signed) is checked against that listing, and the page is written
    {
      const dirX = join(out, 'xolotlcalli/datos/huella'), listadoX = join(dirX, 'listado-stand.txt');
      const bytesX = readFileSync(listadoX), lx = leerListado(bytesX.toString('utf8'));
      const rutaAt = join(SITE, 'src/data/atestacion-xolotlcalli.json');
      // a file signed by a retired key (src/lib/firmasRetiradas.mjs) is not shown: the page says it waits to be signed again
      const atLeida = existsSync(rutaAt) ? JSON.parse(readFileSync(rutaAt, 'utf8')) : null;
      const atX = atLeida && firmaVigente(atLeida.atestador) ? atLeida : null;
      const rutaAnclas = join(SITE, 'src/data/anclas-xolotlcalli.json');   // only once the weekly anchors are confirmed onchain
      const anclasLeidas = existsSync(rutaAnclas) ? JSON.parse(readFileSync(rutaAnclas, 'utf8')) : null;
      const anclasX = anclasLeidas && firmaVigente(anclasLeidas.atestador) ? anclasLeidas : null;
      const porVolverAFirmar = Boolean((atLeida && !atX) || (anclasLeidas && !anclasX));
      const malX = [...verificarHuella({ listadoRuta: listadoX, salida: dirX }), ...problemasDeLaAtestacion(atX, bytesX), ...problemasDeLasAnclas(anclasX)];
      const paginaX = paginaXolotlcalli(lx, atX, { confirmaciones, sha256Listado: `0x${sha(bytesX)}`, anclas: anclasX, porVolverAFirmar });
      malX.push(...archivosSinLicencia(paginaX, lx).map((r) => `${r}: the Xolotlcalli index shows no licence for it`));
      if (malX.length) throw new Error(`the Xolotlcalli fingerprint is not exact: ${malX.slice(0, 5).join('; ')}`);
      writeFileSync(join(dirX, 'index.html'), paginaX);
    }
    const registro = registroDeConstruccion({ commitSitio: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: SITE }).toString().trim(), arbolLimpio: arbolSucio(SITE).length === 0, prueba, listadoRuta, entidades, atestacion });
    writeFileSync(join(salidaHuella, 'build.json'), JSON.stringify(registro, null, 1) + '\n');
    const problemas = problemasDeLaConstruccionDelSitio(out, { prueba });
    if (problemas.length) throw new Error(`the built site does not pass its own checks: ${problemas.slice(0, 6).join('; ')}`);
    // a copy of the build record for the operator, where they ask for it (REGISTRO_COPIA, a file path); never a path written in the repository
    if (process.env.REGISTRO_COPIA && !prueba) writeFileSync(process.env.REGISTRO_COPIA, JSON.stringify(registro, null, 1) + '\n');
    console.log('huella: every listed file served byte for byte, nothing else');
    estado = 0;
  }
} catch (e) {
  console.error(`REFUSED: ${e.message}`);
  estado = 1;
  if (out && ![SITE, homedir(), '/', dirname(SITE)].includes(out)) rmSync(out, { recursive: true, force: true });   // a refused build leaves nothing to deploy (the inexact fingerprint folder included)
} finally {
  for (const f of copias) rmSync(f, { force: true });
}
process.exit(estado);
