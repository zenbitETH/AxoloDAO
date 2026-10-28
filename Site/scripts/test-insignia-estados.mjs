// The states badge on each species page says «1 estado» for a species found in one state and «N estados» otherwise
// (src/lib/insigniaEstados.mjs). Planted species first, then every built page against its species file.
//   node scripts/test-insignia-estados.mjs [--dist <dir>]   (after the build)
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { insigniaEstados } from '../src/lib/insigniaEstados.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--dist');
const DIST = i > 0 ? resolve(process.argv[i + 1]) : join(SITE, 'dist');

let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };

/** The states badge's text on a built species page, or null. */
export const insigniaEnPagina = (html) => ((html.match(/<span[^>]*data-insignia-estados[^>]*>([^<]*)<\/span>/) ?? [])[1] ?? null)?.replace(/\s+/g, ' ').trim() ?? null;

// planted species: one in a single state, one in two
const unEstado = { slug: 'plantada-uno', states: ['MIC'] };
const dosEstados = { slug: 'plantada-dos', states: ['MIC', 'MEX'] };
ok(insigniaEstados(unEstado.states.length) === '1 estado', `planted: a species in one state reads «1 estado» (got «${insigniaEstados(unEstado.states.length)}»)`);
ok(insigniaEstados(dosEstados.states.length) === '2 estados', `planted: a species in two states reads «2 estados» (got «${insigniaEstados(dosEstados.states.length)}»)`);
ok(insigniaEnPagina('<span class="badge-teal" data-insignia-estados>1 estado</span>') === '1 estado', 'planted: the badge is read from a page');

// every built species page against its species file
const CARPETA = join(SITE, 'src/content/species');
let uno = 0;
for (const f of readdirSync(CARPETA).filter((n) => n.endsWith('.yaml'))) {
  const sp = parse(readFileSync(join(CARPETA, f), 'utf8'));
  const n = (sp.states ?? []).length;
  if (n === 1) uno++;
  const html = readFileSync(join(DIST, 'especies', sp.slug, 'index.html'), 'utf8');
  const leido = insigniaEnPagina(html);
  ok(leido === insigniaEstados(n), `especies/${sp.slug}: the badge reads «${leido ?? 'nothing'}» for ${n} state(s)`);
}
ok(uno > 0, `at least one species page has a single state (${uno})`);

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
