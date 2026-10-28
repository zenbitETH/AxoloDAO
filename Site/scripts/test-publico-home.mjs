// This repository is public: the home page's data and the code behind it carry no internal path, private commit, consent reference,
// founder note or internal rule label. The sweep reads the home's data files and its source files, comments included; it also checks the
// copy step: the committed inventories are exactly the public projection, so a field added upstream never lands here.
//   node scripts/test-publico-home.mjs
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atlasPublico, cadenaPublica } from './lib/inventario-publico.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATOS = readdirSync(join(SITE, 'src/data/inventario')).filter((f) => f.endsWith('.json')).map((f) => `src/data/inventario/${f}`);
const CODIGO = [
  'src/lib/inventarioHome.ts', 'src/lib/cifrasHome.mjs', 'src/lib/heroEstado.ts', 'src/lib/estadoHero.mjs', 'src/lib/paridadAtlas.mjs',
  'src/lib/alcanceAtestacion.mjs', 'src/lib/atlasLectura.mjs', 'src/lib/taxones.ts', 'src/i18n/strings.ts',
  'src/components/sections/ImpactSection.astro', 'src/components/sections/Hero.astro',
  'src/components/home/AtlasHome.astro', 'src/components/home/CasoPiloto.astro', 'src/components/home/DatosCadena.astro',
  'scripts/check-hero-estado.mjs', 'scripts/lib/inventario-publico.mjs',
];
// what must not be written in them: paths and commits of private repositories, the consent reference, internal rule labels and the people
// or bodies behind a ruling
const PROHIBIDO = [/brain/i, /\/Users\//, /a30747b/, /FIGURAS/, /consentimiento/i, /\bR4\b/, /maggia/i, /\bComs\b/, /§/, /\bLucia\b/,
  /founder/i, /fundador/i, /axolotarium/i, /agreement/i];

let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };
const existe = (f) => { try { readFileSync(join(SITE, f)); return true; } catch { return false; } };

/** The lines of a text that carry a forbidden term, as «file:line term». */
export function hallazgos(nombre, texto) {
  const out = [];
  texto.split('\n').forEach((l, i) => { for (const p of PROHIBIDO) if (p.test(l)) out.push(`${nombre}:${i + 1} ${p}`); });
  return out;
}

// self-test: the sweep sees a planted term in a comment and in a data value, and lets a clean text pass
ok(hallazgos('x', '// copied from brain-hub-datos a30747b\nconst a = 1;').length === 2, 'planted: a private path and commit in a comment are caught');
ok(hallazgos('x', '{"nota": "consentimiento firmado", "regla": "R4"}').length === 2, 'planted: a consent reference and a rule label in data are caught');
ok(hallazgos('x', '// the public layer of the atlas\nconst R40 = 2;').length === 0, 'planted: a clean text passes');

const archivos = [...DATOS, ...CODIGO.filter(existe)];
const malos = archivos.flatMap((f) => hallazgos(f, readFileSync(join(SITE, f), 'utf8')));
ok(malos.length === 0, `no internal reference in the home's ${archivos.length} files${malos.length ? `:\n      ${malos.join('\n      ')}` : ''}`);

// the copy step: each committed inventory is already its own public projection (projecting it again changes nothing)
for (const [f, proyectar] of [['src/data/inventario/inventario-atlas.json', atlasPublico], ['src/data/inventario/inventario-cadena-xolotlcalli.json', cadenaPublica]]) {
  const texto = readFileSync(join(SITE, f), 'utf8');
  ok(texto === JSON.stringify(proyectar(JSON.parse(texto)), null, 1) + '\n', `${f} is the public projection, field for field`);
}

// ---- the whole public repository: every file under Site/ that git tracks or would track (node_modules and the build excluded) ---------------
// What none of them may carry: the name of a private repository, a working session or persona, a person behind a ruling, a session or
// machine path, or the booth's hub database. Only the three files that must name these to find them are exempt; a test fixture under
// scripts/ may use the one placeholder home path «/Users/ejemplo/» (and its «.claude/jobs» form) and nothing else.
const REPO_PROHIBIDO = [/brain-/, /\bmaggia\b|MaggIA/i, /\bMaggie\b/, /\bLucia\b/, /\bBuilder\b/, /Zenbit Analyst|\bGrumpy\b/, /~\/\.claude|\.claude\/jobs/, /\/Users\//, /hub_booth/];
const DEFINEN_TERMINOS = new Set(['scripts/test-publico-home.mjs', 'scripts/test-dist-interno.mjs', 'scripts/lib/direccionesLocales.mjs', 'scripts/lib/barridoBinario.mjs']);
const sinFixturesDeRuta = (rel, t) => (rel.startsWith('scripts/') ? t.replace(/\/Users\/ejemplo\/[^'"`<\s]*/g, ' ') : t);
/** The findings of the repository sweep in one file's text, as «file:line term». */
export function hallazgosRepo(rel, texto) {
  const out = [];
  sinFixturesDeRuta(rel, texto).split('\n').forEach((l, i) => { for (const p of REPO_PROHIBIDO) if (p.test(l)) out.push(`${rel}:${i + 1} ${p}`); });
  return out;
}
ok(hallazgosRepo('src/lib/x.mjs', '// from brain-hub-datos, as maggia ruled (Lucia)').length === 3, 'planted: a private repository, a ruling body and a persona in a comment are caught');
ok(hallazgosRepo('scripts/build.mjs', "const jobDir = join(homedir(), '.claude/jobs/abc');").length === 1, 'planted: a session path in a script is caught');
ok(hallazgosRepo('scripts/test-x.mjs', "const si = ['/Users/ejemplo/x', '/Users/ejemplo/.claude/jobs/x'];").length === 0, 'planted: the placeholder home path in a test fixture passes');
ok(hallazgosRepo('src/data/x.json', '"/Users/ejemplo/x"').length === 1 && hallazgosRepo('scripts/test-x.mjs', "'/Users/ana/x'").length === 1, 'planted: the placeholder outside scripts/, or another home path in a fixture, is caught');
ok(hallazgosRepo('src/data/atestacion-atlas.json', '"cargadosFuente": "loads-hub_booth5.jsonl"').length === 1, 'planted: the booth hub database name is caught');
const rastreados = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '.'], { cwd: SITE }).toString().split('\n')
  .filter((f) => f && !f.startsWith('node_modules/') && !f.startsWith('dist/') && !DEFINEN_TERMINOS.has(f) && /\.(?:m?js|ts|tsx|astro|json|jsonl|md|yaml|yml|css|html|txt|svg|geojson|csv|sh)$/i.test(f));
const enRepo = rastreados.flatMap((f) => { try { return hallazgosRepo(f, readFileSync(join(SITE, f), 'utf8')); } catch { return []; } });
ok(rastreados.length > 300 && enRepo.length === 0, `nothing internal in the ${rastreados.length} files of the public repository${enRepo.length ? ` (${enRepo.length}):\n      ${enRepo.slice(0, 80).join('\n      ')}` : ''}`);

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
