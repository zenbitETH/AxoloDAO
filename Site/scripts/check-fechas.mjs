// Comprobación de la construcción (prebuild): sitio, forense y, si está en esta máquina, el replay
// dan la misma fecha a cada muerte, y lo publicado cumple las ocho reglas de lib/fechas.mjs.
//   node scripts/check-fechas.mjs                          sitio y forense
//   AXOLODAO_REPLAY_DIR=<paquete> node scripts/check-fechas.mjs   también el replay (privado, nunca en CI)
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { revisarFechas } from './lib/fechas.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const lineas = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map(JSON.parse);

let replay = null;
const dir = process.env.AXOLODAO_REPLAY_DIR;
if (dir) {
  const priv = join(dir, 'private');
  if (!existsSync(join(priv, 'private_records.jsonl'))) { console.error(`check-fechas: AXOLODAO_REPLAY_DIR no tiene private/private_records.jsonl`); process.exit(1); }
  const alias = new Map();
  // Las larvas sin nombre comparten alias y son animales distintos; el sitio las compara como grupo con forense.
  for (const a of lineas(join(priv, 'organism_aliases.jsonl'))) if (a.kind === 'alias' && !/^larva (sin nombre|de ajolote)/i.test(a.alias)) alias.set(a.organismId, [...(alias.get(a.organismId) ?? []), a.alias.toLowerCase()]);
  replay = new Map();
  for (const p of lineas(join(priv, 'private_records.jsonl'))) {
    if (p.privateType !== 'death' || !p.organismId) continue;
    for (const a of alias.get(p.organismId) ?? []) replay.set(a, [...(replay.get(a) ?? []), p.observedAt.slice(0, 10)]);
  }
}

const fallos = revisarFechas({
  bundle: leer('src/data/ajolotes/bundle.json'),
  forense: leer('public/data/ajolotes/bajas-forense.json'),
  bitacoras: [leer('src/data/ops/bitacora-recent.json'), leer('public/data/ops/bitacora.json')],
  cierre: leer('src/data/closure.json').closedOn,
  replay,
});
console.log(`check-fechas: sitio y forense${replay ? ' y replay' : ' (replay: sin paquete en esta máquina, no se compara)'}`);
for (const f of fallos) console.log(`  ✗ ${f}`);
if (fallos.length) process.exit(1);
console.log('  ✓ una fecha por muerte y las ocho reglas en lo publicado');
