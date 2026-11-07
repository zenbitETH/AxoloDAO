/**
 * embargo.mjs
 *
 * The embargo: the committed digests of the names whose records are withheld from the public output, and the folding and matching the scans
 * use (lib/embargo-scan.mjs, test:embargo, test:no-embargo-in-dist, test:no-personal-data, test:xolotlcalli-registro). No withheld name is
 * written in the repository.
 *
 * The digests are HMAC-SHA256 with the key of the people list (AXOLODAO_PERSONAS_CLAVE, outside the repository), in src/data/embargo-huellas.json
 * with the key's sentinel. There is no keyless fallback: a plain sha256 of a short name is reversed in seconds with a list of names. Reading the
 * embargo throws when that file is missing, is in another format, holds no digests, or was written with another key, and every digest throws
 * without the key or with a weak one; so a scan fails closed and never runs without the embargo.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { huellaDe } from './limpiar-personas.mjs';

export const HUELLAS_EMBARGO = fileURLToPath(new URL('../../src/data/embargo-huellas.json', import.meta.url));
/** How the committed file is written, by whoever holds the names and the key. */
export const MIGRAR_EMBARGO = 'AXOLODAO_PERSONAS_CLAVE=… node scripts/embargo-rehash.mjs <file with one withheld name per line>';

const hex64 = (d) => typeof d === 'string' && /^[0-9a-f]{64}$/.test(d);

/** The digest of one already folded word or pair: HMAC-SHA256 with AXOLODAO_PERSONAS_CLAVE; throws without the key or with a weak one. */
export const digestDePalabra = (w) => huellaDe(w);

export const foldForEmbargo = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .join(' ');

export const embargoDigest = (s) => digestDePalabra(foldForEmbargo(s));

/** The committed embargo digests, checked against the file's format and the key's sentinel. Throws rather than return an empty or keyless set. */
export function leerEmbargo(archivo = HUELLAS_EMBARGO) {
  const migrar = `write it with: ${MIGRAR_EMBARGO}`;
  if (!existsSync(archivo)) throw new Error(`the embargo file ${archivo} does not exist; ${migrar}`);
  let j;
  try { j = JSON.parse(readFileSync(archivo, 'utf8')); } catch { throw new Error(`the embargo file ${archivo} is not JSON; ${migrar}`); }
  if (j?.formato !== 'hmac-sha256') throw new Error(`the embargo file ${archivo} is not in the hmac-sha256 format; ${migrar}`);
  if (!Array.isArray(j.huellas) || !j.huellas.length || !j.huellas.every(hex64)) throw new Error(`the embargo file ${archivo} holds no hmac-sha256 digests; ${migrar}`);
  if (!hex64(j.centinela)) throw new Error(`the embargo file ${archivo} has no key sentinel; ${migrar}`);
  if (digestDePalabra('centinela') !== j.centinela) throw new Error('AXOLODAO_PERSONAS_CLAVE is not the key the embargo file was written with (the sentinel differs): with another key no name would match and every scan would pass');
  return new Set(j.huellas);
}

/**
 * True when any one or two consecutive words of `text` hash into `digests`.
 * Whole words only, so a different animal whose name merely contains a
 * withheld one is not caught.
 */
export function mentionsEmbargoed(text, digests) {
  if (!(digests instanceof Set)) throw new Error('mentionsEmbargoed needs the embargo digests (leerEmbargo())');
  if (typeof text !== 'string' || !text) return false;
  const words = foldForEmbargo(text).split(' ').filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (digests.has(digestDePalabra(words[i]))) return true;
    if (i + 1 < words.length && digests.has(digestDePalabra(`${words[i]} ${words[i + 1]}`))) return true;
  }
  return false;
}
