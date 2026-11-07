// The pilot's water and axolotl data is a fixed snapshot of its end: no script regenerates it, and scripts/fixtures/foto-fija-piloto.manifest.json
// pins every file by sha256. A correction is a deliberate commit that updates the manifest in the same change.
//   node scripts/test-foto-fija.mjs
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifiesto = JSON.parse(readFileSync(join(SITE, 'scripts/fixtures/foto-fija-piloto.manifest.json'), 'utf8'));
// the folders that hold the snapshot; every file in them must be pinned, so a new one cannot slip in unlisted
const CARPETAS = ['src/data/water-quality', 'public/data/water-quality', 'src/data/ajolotes', 'public/data/ajolotes'];

let fallas = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fallas++; };
const iso = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d ?? '');

const listados = (manifiesto.archivos ?? []).map((a) => a.ruta);
const enCarpetas = CARPETAS.flatMap((c) => (existsSync(join(SITE, c)) ? readdirSync(join(SITE, c)).map((f) => `${c}/${f}`) : []));

console.log('the snapshot');
ok(listados.length === 7 && new Set(listados).size === 7, `the manifest pins the 7 files of the snapshot (${listados.length})`);
ok(enCarpetas.length > 0, `the snapshot folders are not empty (${enCarpetas.length} files)`);
const sinListar = enCarpetas.filter((f) => !listados.includes(f));
ok(sinListar.length === 0, `every file in the snapshot folders is pinned${sinListar.length ? `: ${sinListar.join(', ')}` : ''}`);
for (const a of manifiesto.archivos ?? []) {
  const ruta = join(SITE, a.ruta);
  const igual = existsSync(ruta) && createHash('sha256').update(readFileSync(ruta)).digest('hex') === a.sha256;
  ok(igual, `${a.ruta} is byte for byte the pinned snapshot`);
}

console.log('its dates');
const cierre = JSON.parse(readFileSync(join(SITE, 'src/data/closure.json'), 'utf8')).closedOn;
ok(iso(manifiesto.cierreDelMuseo) && manifiesto.cierreDelMuseo === cierre, `the museum's closure is carried from src/data/closure.json (${manifiesto.cierreDelMuseo})`);
ok(iso(manifiesto.ultimaEscritura) && manifiesto.ultimaEscritura >= manifiesto.cierreDelMuseo, `the last write is a date on or after the closure (${manifiesto.ultimaEscritura})`);

if (fallas) { console.error(`\n${fallas} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
