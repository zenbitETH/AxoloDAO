// Vercel's build command refuses a build that build:sitio did not start (scripts/build-vercel.mjs), and vercel.json points at it.   node scripts/test-build-vercel.mjs
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };
const correr = (env) => spawnSync(process.execPath, [join(SITE, 'scripts/build-vercel.mjs')], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });

const vercel = JSON.parse(readFileSync(join(SITE, 'vercel.json'), 'utf8'));
ok(vercel.buildCommand === 'node scripts/build-vercel.mjs', `vercel.json builds with the refusing command (${vercel.buildCommand})`);
const sin = correr({});
ok(sin.status === 1 && /REFUSED/.test(sin.stderr), 'a build Vercel starts by itself (no flag) exits 1 with REFUSED');
const otro = correr({ BUILD_SITIO_DESPLIEGUE: 'true' });
ok(otro.status === 1, 'only the exact flag value lets it through («true» does not)');
const con = correr({ BUILD_SITIO_DESPLIEGUE: '1' });
ok(con.status === 0, 'with the flag that build:sitio sets, it exits 0 and builds nothing');
ok(/BUILD_SITIO_DESPLIEGUE: '1'/.test(readFileSync(join(SITE, 'scripts/build-sitio.mjs'), 'utf8')), 'build:sitio is what sets the flag');

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
