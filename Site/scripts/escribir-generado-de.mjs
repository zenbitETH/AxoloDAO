// Stamps `generadoDe` into the six committed atlas data files (src/data/atlas-snapshot/): the bundles each was built from, with the manifest.json sha256 the attestation covers.
// It first checks each sha against the manifest.json in the entity folder, so a stale bundle is never stamped as the attested one.
//   node scripts/escribir-generado-de.mjs [--dir <entities directory>]
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROCEDENCIA, generadoDeDe } from './lib/procedencia.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--dir');
const ENT = i >= 0 ? process.argv[i + 1] : join(homedir(), '.cache', 'axolodao-datos', 'open', 'entities');
const atestacion = JSON.parse(readFileSync(join(SITE, 'src/data/atestacion-atlas.json'), 'utf8'));
for (const archivo of Object.keys(PROCEDENCIA)) {
  const ruta = join(SITE, 'src/data/atlas-snapshot', archivo);
  const d = JSON.parse(readFileSync(ruta, 'utf8'));
  const generadoDe = generadoDeDe(archivo, atestacion, d.generadoDe);
  for (const b of generadoDe.bundles) {
    const m = join(ENT, b.id, 'manifest.json');
    if (existsSync(m) && `0x${createHash('sha256').update(readFileSync(m)).digest('hex')}` !== b.manifestSha256) throw new Error(`${b.bundle}: the manifest in ${ENT} is not the one the attestation covers`);
  }
  const sal = { ...d, generadoDe };
  const crudo = readFileSync(ruta, 'utf8');
  // keep each file's own formatting: the species and layer files are written with one space of indent, a trailing newline for the GeoJSON ones
  const sangria = /^\{\n( +)"/.test(crudo) ? crudo.match(/^\{\n( +)"/)[1].length : undefined;
  writeFileSync(ruta, JSON.stringify(sal, null, sangria) + (crudo.endsWith('\n') ? '\n' : ''));
  console.log(`${archivo}: generadoDe ${generadoDe.bundles.map((b) => b.id).join(', ')}`);
}
