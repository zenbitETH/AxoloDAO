// Scans a folder for words (and two-word phrases) that hash into a set of
// embargo digests, in file contents and in file paths. It prints digests and
// paths only, never the matched text.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { digestDePalabra, foldForEmbargo } from './xlsx-utils.mjs';

const TEXT = /\.(html|json|js|mjs|cjs|css|txt|xml|svg|webmanifest|map|yaml|yml|md|ts|tsx|astro)$/i;

export function makeMatcher(digests) {
  const cache = new Map();
  const hit = (w) => {
    let r = cache.get(w);
    if (r === undefined) { r = digests.has(digestDePalabra(w)); cache.set(w, r); }
    return r;
  };
  return (text) => {
    const words = foldForEmbargo(text).split(' ');
    for (let i = 0; i < words.length; i++) {
      if (words[i] && hit(words[i])) return true;
      if (words[i] && words[i + 1] && hit(`${words[i]} ${words[i + 1]}`)) return true;
    }
    return false;
  };
}

/** Relative paths under `root` whose name or text mentions an embargoed word. */
export function scanTree(root, digests, { skip = () => false } = {}) {
  const mentions = makeMatcher(digests);
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      const rel = relative(root, p);
      if (skip(rel)) continue;
      if (mentions(rel)) { out.push(rel); continue; }
      if (TEXT.test(name) && mentions(readFileSync(p, 'utf8'))) out.push(rel);
    }
  };
  walk(root);
  return out;
}
