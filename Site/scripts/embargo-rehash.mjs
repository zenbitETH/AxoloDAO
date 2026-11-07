#!/usr/bin/env node
/**
 * embargo-rehash.mjs: writes src/data/embargo-huellas.json, the committed embargo digests keyed with AXOLODAO_PERSONAS_CLAVE, and the key's
 * sentinel that lib/embargo.mjs checks before any scan.
 *   AXOLODAO_PERSONAS_CLAVE=… node scripts/embargo-rehash.mjs <file with one withheld name per line> [--salida <file>]
 * The names file lives outside the repository. Each name is folded as the scanner folds text and must be one or two words, because the scanner
 * compares single words and pairs. The output holds digests only, and this script prints counts only: never a name, never the key.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { HUELLAS_EMBARGO, digestDePalabra, foldForEmbargo } from './lib/embargo.mjs';

const args = process.argv.slice(2);
const iSalida = args.indexOf('--salida');
const salida = iSalida >= 0 ? args[iSalida + 1] : HUELLAS_EMBARGO;
const origen = args.find((a, i) => !a.startsWith('--') && (iSalida < 0 || i !== iSalida + 1));
if (!origen || !salida) { console.error('uso: node scripts/embargo-rehash.mjs <archivo con un nombre retenido por línea> [--salida <archivo>]'); process.exit(1); }
const nombres = readFileSync(origen, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
if (!nombres.length) { console.error('el archivo no tiene nombres'); process.exit(1); }
const formas = [...new Set(nombres.map(foldForEmbargo).filter(Boolean))];
const largas = formas.filter((f) => f.split(' ').length > 2).length;
if (largas) { console.error(`${largas} nombre(s) de tres palabras o más: el escáner compara palabras y pares, así que no lo encontraría; escríbelo en formas de una o dos palabras`); process.exit(1); }
let huellas, centinela;
try {
  huellas = formas.map(digestDePalabra).sort();
  centinela = digestDePalabra('centinela');
} catch (e) { console.error(e.message); process.exit(1); }
writeFileSync(salida, `${JSON.stringify({ formato: 'hmac-sha256', _nota: 'Huellas HMAC-SHA256 (clave AXOLODAO_PERSONAS_CLAVE) de los nombres retenidos, plegados como los pliega el escáner; los nombres no están en el repositorio.', huellas, centinela }, null, 2)}\n`);
console.log(`${nombres.length} nombre(s), ${huellas.length} huella(s) escritas en ${salida === HUELLAS_EMBARGO ? 'src/data/embargo-huellas.json' : salida}`);
