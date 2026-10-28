// The atlas in a real browser, reproducible from the branch: `npm run test:atlas:browser`.
//   1. the build with every flag off, and `test-atlas.mjs --dist --browser` on it (the map renders, nothing leaves the origin, the facilities popup and table, the North America units, and the NC-flag and stub-registry behaviour);
//   2. a build with the sample-data flags (PUBLIC_ATLAS_NC=1, PUBLIC_ATLAS_SAMPLE=1) in a scratch folder, served locally, and the proto browser suite (scripts/proto/test-*.mjs) run against it: the panel, the drawers, the markers, the legend, the species chips, the info icon.
//   3. the axolodao.org build (`npm run build:sitio`; needs the the data repository checkout at BRAIN_HUB_DATOS or ~/Documents/GitHub/the data repository) and scripts/proto/test-sitio.mjs on it.
// It needs Chrome or Chromium (CHROME_PATH or the usual places) and takes several minutes. Exit 1 on the first suite that fails, after running the rest.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { servirEstatico } from './lib/servir-estatico.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// the environment a build inherits must not carry a flag: step 1 is the build with EVERY flag off, whatever the caller has exported
const HUB = { PUBLIC_HUB_URL: process.env.PUBLIC_HUB_URL, HUB_BUILD_URL: process.env.HUB_BUILD_URL, HUB_KEY_FILE: process.env.HUB_KEY_FILE, HUB_KEY_HEADER: process.env.HUB_KEY_HEADER, HUB_KEY_SCHEME: process.env.HUB_KEY_SCHEME };   // read BEFORE the scrub, for step 4 only
const entorno = (extra = {}) => ({ ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(PUBLIC_(ATLAS|HUB)|HUB_BUILD)/.test(k))), ...extra });
const correr = (cmd, args, env = {}) => spawnSync(cmd, args, { cwd: SITE, stdio: 'inherit', env: entorno(env) }).status === 0;
// the browser suites need THIS process's static server to answer while they run, so they are run asynchronously (a synchronous spawn would block the server and every page load would time out)
const correrAsync = (cmd, args, env = {}) => new Promise((ok) => { const h = spawn(cmd, args, { cwd: SITE, stdio: 'inherit', env: entorno(env) }); h.on('exit', (c) => ok(c === 0)); h.on('error', () => ok(false)); });
let fallos = 0;
const paso = (nombre, bien) => { console.log(`${bien ? 'PASS' : 'FAIL'}  ${nombre}`); if (!bien) fallos++; };

console.log('== 1 · the build with every flag off');
const construido = correr('npm', ['run', 'build']);
paso('npm run build', construido);
if (construido) paso('test-atlas.mjs --dist --browser', correr('node', ['scripts/test-atlas.mjs', '--dist', '--browser']));

console.log('\n== 2 · the proto browser suite on a build with the sample-data flags');
const salida = mkdtempSync(join(tmpdir(), 'atlas-browser-'));
try {
  const hecho = correr('npx', ['--no-install', 'astro', 'build', '--outDir', salida], { PUBLIC_ATLAS_NC: '1', PUBLIC_ATLAS_SAMPLE: '1' });
  paso('astro build with PUBLIC_ATLAS_NC=1 PUBLIC_ATLAS_SAMPLE=1', hecho && existsSync(join(salida, 'atlas/index.html')));
  // the synthetic NC points the sample flag reads live in a fixture folder and are copied into THIS scratch build only, never into public/ (which every real build ships)
  if (hecho) cpSync(join(SITE, 'scripts/fixtures/sample-nc'), join(salida, 'atlas/sample'), { recursive: true });
  if (hecho) {
    const { servidor, base } = await servirEstatico(salida);
    try {
      for (const t of ['test-proto', 'test-legend-provenance', 'test-tooltip-loop', 'test-endemism-lang', 'test-instalaciones', 'test-info-capa', 'test-especie-chips', 'test-capas-ui']) paso(t, await correrAsync('node', [`scripts/proto/${t}.mjs`, base]));
      paso('test-conpais', correr('node', ['--experimental-strip-types', '--no-warnings', 'scripts/proto/test-conpais.mjs']));
    } finally {
      servidor.close();
    }
  }
} finally {
  rmSync(salida, { recursive: true, force: true });
}
console.log('\n== 3 · the axolodao.org build (npm run build:sitio) and its browser suite');
{
  const salidaSitio = mkdtempSync(join(tmpdir(), 'atlas-sitio-'));
  try {
    const hecho = correr('npm', ['run', 'build:sitio', '--', '--prueba', '--outDir', salidaSitio]);
    paso('npm run build:sitio (the three data files at their named commits, sha256 checked, copies removed after)', hecho && existsSync(join(salidaSitio, 'atlas/index.html')));
    if (hecho) {
      const { servidor, base } = await servirEstatico(salidaSitio);
      try { paso('test-sitio', await correrAsync('node', ['scripts/proto/test-sitio.mjs', base])); } finally { servidor.close(); }
    }
    paso('the build left no pilot data file in public/', !['xolotlcalli-ficha.json', 'xolotlcalli-clips.json', 'xolotlcalli-cadena.json'].some((f) => existsSync(join(SITE, 'public/atlas/real', f))));
  } finally {
    rmSync(salidaSitio, { recursive: true, force: true });
  }
}
if (HUB.PUBLIC_HUB_URL || HUB.HUB_BUILD_URL) {
  console.log('\n== 4 · the hub read: every atlas snapshot file from the hub must equal the committed file (strict)');
  paso('hub:paridad (all six files «hub»)', correr('node', ['scripts/hub-paridad.mjs'], Object.fromEntries(Object.entries(HUB).filter(([, v]) => v))));
} else console.log('\n== 4 · the hub read: skipped (set HUB_BUILD_URL or PUBLIC_HUB_URL, HUB_KEY_FILE, HUB_KEY_HEADER and HUB_KEY_SCHEME to run it)');
console.log(fallos ? `\n${fallos} suite(s) failed` : '\nall browser suites passed');
process.exit(fallos ? 1 : 0);
