// Embargo: the committed digests drop a withheld specimen with no untracked
// file, and neither the source nor the built site carries it.
//   node scripts/test-embargo.mjs            digests, matching and source scan
//   node scripts/test-embargo.mjs --dist     also scans dist/ (run `npm run build` first)
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMBARGO_FORMAT, EMBARGO_SHA256, embargoDigest, mentionsEmbargoed,
} from './lib/embargo.mjs';
import { scanTree } from './lib/embargo-scan.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) failed++; };

// A synthetic word stands in for the withheld name, so the mechanism is tested
// without writing it down.
const probe = new Set([embargoDigest('Zzfixtura')]);

console.log('digests');
if (EMBARGO_FORMAT !== 'hmac') console.log('  ! the committed digests are still plain sha256 (legacy): whoever holds the names runs `node scripts/embargo-rehash.mjs <names file>` with AXOLODAO_PERSONAS_CLAVE set, and the legacy constant in lib/embargo.mjs is deleted');
else ok(EMBARGO_SHA256.size > 0 && [...EMBARGO_SHA256].every((d) => /^[0-9a-f]{64}$/.test(d)), 'the committed digests are keyed (HMAC-SHA256)');
ok(EMBARGO_SHA256.size > 0 && [...EMBARGO_SHA256].every((d) => /^[0-9a-f]{64}$/.test(d)), 'the committed set holds sha256 hex digests');
// A mid-word accent: a final one is split off by the word split alone, so it does not prove the accent fold.
ok(probe.has(embargoDigest('zzfixtura')) && probe.has(embargoDigest('ZZFIXTURÁ')) && probe.has(embargoDigest('zzfíxtura')), 'the digest folds case and accents');

console.log('matching, no untracked file');
ok(probe.has(embargoDigest('Zzfixtura')) && probe.has(embargoDigest('  zzfixturá ')), 'an alias in any case or accent is matched');
ok(!probe.has(embargoDigest('Zzfixtura 2')) && !probe.has(embargoDigest('Zzotra')), 'a different alias is not');
ok(mentionsEmbargoed('visto junto a zzfixtura, ayer', probe) && mentionsEmbargoed('ZZFIXTURA.', probe), 'free text that names it is matched');
ok(!mentionsEmbargoed('zzfixturas', probe) && !mentionsEmbargoed('xzzfixtura', probe), 'no substring matching');
ok(mentionsEmbargoed('a dos palabras', new Set([embargoDigest('dos palabras')])), 'a two-word phrase is matched');
ok(!mentionsEmbargoed('un ajolote del museo, su agua y su pecera'), 'the committed set leaves ordinary text alone');

console.log('scanner');
const tmp = mkdtempSync(join(tmpdir(), 'embargo-'));
mkdirSync(join(tmp, 'photos'));
writeFileSync(join(tmp, 'photos', 'zzfixtura.webp'), 'x');
writeFileSync(join(tmp, 'a.js'), 'const k = {zzfixtura: 1};');
writeFileSync(join(tmp, 'b.json'), '{"nota":"ok"}');
const hits = scanTree(tmp, probe).sort();
ok(JSON.stringify(hits) === JSON.stringify(['a.js', join('photos', 'zzfixtura.webp')]), 'finds a path hit and a content hit, and only those');

console.log('source');
const srcHits = ['src', 'scripts', 'public'].flatMap((d) =>
  existsSync(join(ROOT, d)) ? scanTree(join(ROOT, d), EMBARGO_SHA256).map((r) => join(d, r)) : []);
ok(srcHits.length === 0, `no source or public file carries a withheld name${srcHits.length ? `: ${srcHits.join(', ')}` : ''}`);

if (process.argv.includes('--dist')) {
  console.log('dist');
  const dist = join(ROOT, 'dist');
  ok(existsSync(dist), 'dist/ exists (run the build first)');
  if (existsSync(dist)) {
    const d = scanTree(dist, EMBARGO_SHA256);
    ok(d.length === 0, `the built site carries no row, photo or text of a withheld specimen${d.length ? `: ${d.join(', ')}` : ''}`);
  }
}

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
