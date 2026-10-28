// The rules of `npm run build:sitio`, each seen as a process: it refuses (exit 1, «REFUSED», nothing left to deploy) without a strict hub, with the lax switch, with a local PUBLIC_HUB_URL, and when the fingerprint
// is not exact; a test build says so. `BUILD_SITIO_SCRIPT` runs another copy of the script (to see these tests red against an older one).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = process.env.BUILD_SITIO_SCRIPT ?? 'scripts/build-sitio.mjs';
let fallos = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fallos++; };
const limpio = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(PUBLIC_(ATLAS|HUB)|HUB_|ATLAS_HUB|ENTIDADES_DIR|HUELLA_)/.test(k)));
const corre = (args, env = {}) => spawnSync('node', [SCRIPT, ...args], { cwd: SITE, env: { ...limpio, ...env }, encoding: 'utf8', maxBuffer: 1 << 26 });
const tmp = mkdtempSync(join(tmpdir(), 'build-sitio-'));
try {
  console.log('build:sitio refusals');
  let out = join(tmp, 'a'), r = corre(['--outDir', out]);
  ok(r.status === 1 && /REFUSED: HUB_BUILD_URL is not set/.test(r.stderr) && !existsSync(out), 'C3: without HUB_BUILD_URL it refuses (exit 1) and builds nothing');
  out = join(tmp, 'b'); r = corre(['--outDir', out], { HUB_BUILD_URL: 'http://127.0.0.1:4480', ATLAS_HUB_LAXO: '1' });
  ok(r.status === 1 && /REFUSED: ATLAS_HUB_LAXO=1/.test(r.stderr) && !existsSync(out), 'C3: with ATLAS_HUB_LAXO=1 it refuses, whatever else is set');
  out = join(tmp, 'c'); r = corre(['--outDir', out], { HUB_BUILD_URL: 'http://127.0.0.1:4480', PUBLIC_HUB_URL: 'http://127.0.0.1:4480' });
  ok(r.status === 1 && /REFUSED: PUBLIC_HUB_URL is a local address/.test(r.stderr) && !existsSync(out), 'C3/review 5: a local PUBLIC_HUB_URL refuses the build (it would be written into every page)');
  out = join(tmp, 'd'); r = corre(['--outDir', out], { HUB_BUILD_URL: 'http://127.0.0.1:4480', HUB_KEY_FILE: join(tmp, 'no-existe'), HUB_KEY_HEADER: 'Authorization' });
  ok(r.status === 1 && !existsSync(out), 'C3: a strict build that cannot read the hub (no key file, no hub) exits 1 and leaves no dist');
  // C2: a fingerprint that is not exact: the build exits 1, writes no build.json and leaves no huella folder
  out = join(tmp, 'e'); const vacia = join(tmp, 'entidades-vacias'); spawnSync('mkdir', ['-p', vacia]);
  r = corre(['--prueba', '--outDir', out], { ENTIDADES_DIR: vacia });
  ok(r.status === 1 && /REFUSED: .*not in /.test(r.stderr), 'C2: an inexact fingerprint (listed files missing) exits 1 with REFUSED');
  ok(!existsSync(join(out, 'atlas/datos/huella')) && !existsSync(join(out, 'atlas/datos/huella/build.json')), 'C2: and no huella folder and no build.json are left behind');
  // a test build says so, and the pre-push check refuses it
  out = join(tmp, 'f'); r = corre(['--prueba', '--outDir', out]);
  const registro = existsSync(join(out, 'atlas/datos/huella/build.json')) ? JSON.parse(spawnSync('cat', [join(out, 'atlas/datos/huella/build.json')], { encoding: 'utf8' }).stdout) : null;
  ok(r.status === 0 && registro?.prueba === true, 'a --prueba build succeeds and its build.json says «prueba»');
  const pp = spawnSync('node', ['scripts/pre-push-huella.mjs', '--dist', out], { cwd: SITE, env: limpio, encoding: 'utf8' });
  ok(pp.status === 1 && /test build \(prueba\)/.test(pp.stderr), 'the pre-push check refuses a dist whose build.json says «prueba»');
} finally { rmSync(tmp, { recursive: true, force: true }); }
console.log(fallos ? `\n${fallos} check(s) failed` : '\nall checks passed');
process.exit(fallos ? 1 : 0);
