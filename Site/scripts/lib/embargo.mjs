/**
 * embargo.mjs
 *
 * The embargo: the committed digests of the names whose records are withheld from the public output, and the folding and matching the scans
 * use (lib/embargo-scan.mjs, test:embargo, test:no-embargo-in-dist, test:no-personal-data, test:xolotlcalli-registro). No withheld name is
 * written in the repository.
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { huellaDe } from './limpiar-personas.mjs';

/**
 * Embargo, committed form. A digest of each withheld name folded with foldForEmbargo (no accents, lowercase, single spaces), so a scan with
 * no untracked file still finds the specimen and no tracked line names it.
 *
 * The digests are HMAC-SHA256 with the same key as the people list (AXOLODAO_PERSONAS_CLAVE, outside the repository), stored in
 * src/data/embargo-huellas.json: a plain sha256 of a short name is reversed in seconds with a list of names. Until that file exists the legacy plain
 * digests below stay in force (the embargo is never dropped), and test:embargo says so. To migrate, whoever holds the names runs
 *   node scripts/embargo-rehash.mjs <file with one withheld name per line>
 * with the key set, which writes src/data/embargo-huellas.json; then the legacy constant is deleted.
 */
const LEGACY_SHA256 = new Set(["32061dcc8325c83b80e7c672e3f8fbc154903d7fb307aba21d02f6e5b72eb0c2", "b55a2e9654250ecbd92cc3e31765211f83507f6e9e8f9ac8c5dfdd906d1d4767"]);
const HUELLAS_FILE = fileURLToPath(new URL('../../src/data/embargo-huellas.json', import.meta.url));
const huellasHmac = existsSync(HUELLAS_FILE) ? JSON.parse(readFileSync(HUELLAS_FILE, 'utf8')) : null;
/** 'hmac' once the committed set is keyed; 'sha256-legacy' until then. */
export const EMBARGO_FORMAT = huellasHmac?.formato === 'hmac-sha256' ? 'hmac' : 'sha256-legacy';
export const EMBARGO_SHA256 = new Set(EMBARGO_FORMAT === 'hmac' ? huellasHmac.huellas : LEGACY_SHA256);
/** The digest of one already folded word or pair, in the format of the committed set. */
export const digestDePalabra = (w) => (EMBARGO_FORMAT === 'hmac' ? huellaDe(w) : createHash('sha256').update(w).digest('hex'));

export const foldForEmbargo = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .join(' ');

export const embargoDigest = (s) => digestDePalabra(foldForEmbargo(s));

/**
 * True when any one or two consecutive words of `text` hash into `digests`.
 * Whole words only, so a different animal whose name merely contains a
 * withheld one is not caught.
 */
export function mentionsEmbargoed(text, digests = EMBARGO_SHA256) {
  if (typeof text !== 'string' || !text) return false;
  const words = foldForEmbargo(text).split(' ').filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (digests.has(digestDePalabra(words[i]))) return true;
    if (i + 1 < words.length && digests.has(digestDePalabra(`${words[i]} ${words[i + 1]}`))) return true;
  }
  return false;
}
