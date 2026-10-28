// Copies the home page's two inventories into src/data/inventario/, as their public projection (scripts/lib/inventario-publico.mjs):
// read from the data repository at a NAMED commit, never from a working tree, and written with only the fields the home renders.
//   node scripts/copiar-inventario.mjs            writes the two files
//   node scripts/copiar-inventario.mjs --check    exits 1 if the committed files are not the projection of that commit
// The data repository's checkout: BRAIN_HUB_DATOS (required, as for scripts/build-sitio.mjs).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atlasPublico, cadenaPublica } from './lib/inventario-publico.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = process.env.BRAIN_HUB_DATOS;
if (!REPO) { console.error('set BRAIN_HUB_DATOS to the checkout of the data repository (the inventories are read from it at a pinned commit)'); process.exit(1); }
const COMMIT = '8fde865';
const ARCHIVOS = [
  { origen: 'context/datos/inventario/inventario-atlas.json', destino: 'src/data/inventario/inventario-atlas.json', proyectar: atlasPublico },
  { origen: 'context/datos/inventario/inventario-cadena-xolotlcalli.json', destino: 'src/data/inventario/inventario-cadena-xolotlcalli.json', proyectar: cadenaPublica },
];

const check = process.argv.includes('--check');
let distintos = 0;
for (const a of ARCHIVOS) {
  const fuente = JSON.parse(execFileSync('git', ['-C', REPO, 'show', `${COMMIT}:${a.origen}`], { maxBuffer: 1 << 24 }).toString('utf8'));
  const texto = JSON.stringify(a.proyectar(fuente), null, 1) + '\n';
  const destino = join(SITE, a.destino);
  if (check) {
    const igual = readFileSync(destino, 'utf8') === texto;
    console.log(`${igual ? 'ok   ' : 'DIFIERE'} ${a.destino}`);
    if (!igual) distintos++;
  } else {
    writeFileSync(destino, texto);
    console.log(`written ${a.destino} (${COMMIT})`);
  }
}
process.exit(distintos ? 1 : 0);
