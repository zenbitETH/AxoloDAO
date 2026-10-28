// The credits of the species images, as data, from the plan's table (the plan repository, especies-imagenes-v3/creditos-imagenes.json), pinned to a commit.
//   node scripts/import-creditos-imagenes.mjs <the plan repository checkout> <commit>
// It reads the file AT that commit (git show), writes src/data/creditos-imagenes.json with only what the page shows (credit line, badge, author, licence, link: no repository path, no file name, no hash of a photo)
// and scripts/fixtures/creditos-imagenes.lock.json with the commit and the sha256 of the source and of the output, which test-atlas.mjs checks. Last made from: bc40216 (32 entries).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RUTA = 'context/plans/2026-10-07-innovafest/kickoffs/atlas-rediseno-2026-10-18/especies-imagenes-v3/creditos-imagenes.json';
const [repo, commit] = process.argv.slice(2);
if (!repo || !/^[0-9a-f]{7,40}$/.test(commit ?? '')) { console.error('usage: node scripts/import-creditos-imagenes.mjs <checkout> <commit>'); process.exit(1); }
const bytes = execFileSync('git', ['-C', repo, 'show', `${commit}:${RUTA}`], { maxBuffer: 1 << 26 });
const fuente = JSON.parse(bytes.toString('utf8'));
const salida = {};
for (const slug of Object.keys(fuente).sort()) {
  const e = fuente[slug];
  if (!e?.credit_es || !e?.label_es || !e?.base?.licence || !e.base.author) { console.error(`REFUSED: ${slug} has no credit, label, author or licence`); process.exit(1); }
  salida[slug] = { credito: e.credit_es, etiqueta: e.label_es, autor: e.base.author, licencia: e.base.licence, url: e.base.url ?? null };
}
const texto = JSON.stringify(salida, null, 1) + '\n';
mkdirSync(join(SITE, 'src/data'), { recursive: true }); mkdirSync(join(SITE, 'scripts/fixtures'), { recursive: true });
writeFileSync(join(SITE, 'src/data/creditos-imagenes.json'), texto);
writeFileSync(join(SITE, 'scripts/fixtures/creditos-imagenes.lock.json'), JSON.stringify({ origen: `the plan repository ${commit}`, ruta: RUTA, sha256Origen: createHash('sha256').update(bytes).digest('hex'), sha256Salida: createHash('sha256').update(texto).digest('hex'), entradas: Object.keys(salida).length }, null, 1) + '\n');
console.log(`${Object.keys(salida).length} credits from ${commit}`);
