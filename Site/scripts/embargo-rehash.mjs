#!/usr/bin/env node
/**
 * embargo-rehash.mjs: writes src/data/embargo-huellas.json, the committed embargo digests keyed with AXOLODAO_PERSONAS_CLAVE.
 *   AXOLODAO_PERSONAS_CLAVE=… node scripts/embargo-rehash.mjs <file with one withheld name per line>
 * The names file lives outside the repository. The output holds digests only; the names are never printed or written.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { foldForEmbargo } from './lib/xlsx-utils.mjs';
import { huellaDe } from './lib/limpiar-personas.mjs';

const origen = process.argv[2];
if (!origen) { console.error('uso: node scripts/embargo-rehash.mjs <archivo con un nombre retenido por línea>'); process.exit(1); }
const nombres = readFileSync(origen, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
if (!nombres.length) { console.error('el archivo no tiene nombres'); process.exit(1); }
// Each name as a whole (a one- or two-word phrase, as the scanner compares them).
const huellas = [...new Set(nombres.map((n) => huellaDe(foldForEmbargo(n))))].sort();
const salida = fileURLToPath(new URL('../src/data/embargo-huellas.json', import.meta.url));
writeFileSync(salida, `${JSON.stringify({ formato: 'hmac-sha256', _nota: 'Huellas HMAC-SHA256 (clave AXOLODAO_PERSONAS_CLAVE) de los nombres retenidos; los nombres no están en el repositorio.', huellas }, null, 2)}\n`);
console.log(`${huellas.length} huella(s) escritas en src/data/embargo-huellas.json`);
