// Every build runs the date check from its own build hook (astro.config.mjs), on the axolodao.org path too, where npm's prebuild never runs:
// a build with a planted bad date (CHECK_FECHAS_PLANTADA=1, which only adds a failure) is refused, and leaves no output behind. This is
// `astro build` itself, as build:sitio calls it, into a temporary folder.   node scripts/test-gancho-fechas.mjs   (takes about a minute)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };

const tmp = mkdtempSync(join(tmpdir(), 'gancho-fechas-'));
const out = join(tmp, 'dist');
const env = { ...process.env, CHECK_FECHAS_PLANTADA: '1' };
delete env.PUBLIC_HUB_URL; delete env.HUB_BUILD_URL;
const r = spawnSync('npx', ['--no-install', 'astro', 'build', '--outDir', out], { cwd: SITE, env, encoding: 'utf8' });
const salida = `${r.stdout}\n${r.stderr}`;
ok(r.status !== 0, `a build with a planted bad date fails (exit ${r.status})`);
ok(/plantada: CHECK_FECHAS_PLANTADA=1/.test(salida) && /check-fechas: a published date breaks its rules/.test(salida), 'it fails in the build hook, on the date check');
ok(!existsSync(out) || readdirSync(out).length === 0, 'and leaves no output behind');
rmSync(tmp, { recursive: true, force: true });

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
