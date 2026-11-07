// The production deploy refuses a dirty tree and any HEAD that is not origin/main (scripts/deploy-sitio.mjs), checks the built site against the
// embargo before it uploads it, and Vercel skips Git builds.
//   node scripts/test-deploy-sitio.mjs
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { motivoParaNoDesplegar, pasos } from './deploy-sitio.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };
const a = 'a'.repeat(40), b = 'b'.repeat(40);

ok(motivoParaNoDesplegar({ sucio: [], head: a, main: a }) === null, 'a clean tree at origin/main deploys');
ok(/not clean/.test(motivoParaNoDesplegar({ sucio: [' M src/x.ts'], head: a, main: a }) ?? ''), 'a dirty tree is refused');
ok(/not origin\/main/.test(motivoParaNoDesplegar({ sucio: [], head: b, main: a }) ?? ''), 'a branch that is not main (the 23-Oct case) is refused');
ok(/could not be read/.test(motivoParaNoDesplegar({ sucio: [], head: '', main: a }) ?? ''), 'an unreadable HEAD is refused');
const orden = pasos('vercel', a).map(([c, args]) => `${c} ${args.join(' ')}`);
const iEmbargo = orden.indexOf('node scripts/test-embargo.mjs --dist');
ok(iEmbargo > orden.indexOf('npm run build:sitio') && orden.indexOf('npm run build:sitio') >= 0 && iEmbargo < orden.findIndex((p) => p.startsWith('vercel deploy')),
  'the embargo check reads the built site after build:sitio and before the upload (it fails closed without AXOLODAO_PERSONAS_CLAVE)');
const vercel = JSON.parse(readFileSync(join(SITE, 'vercel.json'), 'utf8'));
ok(vercel.ignoreCommand === 'exit 0', 'vercel.json skips every Git-triggered build (ignoreCommand «exit 0»)');
ok(vercel.installCommand === 'npm ci', 'vercel.json still installs with npm ci');

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
