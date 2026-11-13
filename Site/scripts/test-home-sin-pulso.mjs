// The home's AxoloNews is the podcast: the Pulso rail, whose cards linked to Instagram posts that are not public, was retired on
// 13-nov-2026. Reads the built home in the three languages: no link to an Instagram post or reel, and the podcast card with its playlist.
//   npm run build, then: node scripts/test-home-sin-pulso.mjs [--dist <folder>]
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--dist');
const dist = i > 0 ? resolve(process.argv[i + 1]) : join(SITE, 'dist');
let fallas = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fallas++; };

for (const pre of ['', 'en/', 'pt/']) {
  const f = join(dist, pre, 'index.html');
  if (!existsSync(f)) { ok(false, `/${pre}: the built home exists (${f}: run \`npm run build\` first)`); continue; }
  const html = readFileSync(f, 'utf8');
  // the corpus first: a home without its news section would pass the sweep below
  const seccion = html.match(/<section id="news"[\s\S]*?<\/section>/)?.[0] ?? '';
  ok(seccion.length > 0, `/${pre}: the home has its AxoloNews section`);
  const posts = [...html.matchAll(/instagram\.com\/(?:p|reel|reels|tv)\/[\w-]+/g)].map((m) => m[0]);
  ok(posts.length === 0, `/${pre}: no link to an Instagram post or reel${posts.length ? ` (${posts.length}, e.g. ${posts[0]})` : ''}`);
  ok(/youtube\.com\/playlist\?list=/.test(seccion) && /podcast-embed/.test(seccion), `/${pre}: AxoloNews keeps the podcast card and its playlist`);
}

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
