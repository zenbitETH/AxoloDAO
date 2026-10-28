// A byte scan over EVERY file of a built site, images and fonts included: a generated image can carry its generation record (the model
// path, the job folder, the source repository) in its Exif or XMP, which a sweep that reads only text files never sees (22-oct: 23 species
// images did). The scan reads raw bytes, so it does not depend on which grep the machine has (ugrep skips binary files under -r).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** What no served byte may contain, with the reason a reader sees. */
export const PROHIBIDO_BINARIO = [
  [/\/Users\/|\/home\/[a-z_][a-z0-9_-]*\//, 'a local home path'],
  [/\.claude\/jobs/, 'a working-session folder'],
  [/axolodao-brain|brain-hub-datos|brain-plan-innovafest/, 'a private repository'],
  [/hub_booth/, 'the booth hub database'],
  [/model_path/, 'an image generator record'],
  [/mflux/i, 'an image generator record'],
];

/** The first forbidden term in a file's bytes (read as latin1), or null. */
export const rastroEnBytes = (bytes) => { for (const [re] of PROHIBIDO_BINARIO) { const m = bytes.match(re); if (m) return m[0]; } return null; };

/** A planted JPEG whose metadata carries a generator record with a local path: the case every byte check is tested against (it lives here, with the terms, so no other file spells them). */
export const JPEG_PLANTADO = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), Buffer.from('<x:xmpmeta>{"model_path": "/Users/ejemplo/.claude/jobs/abc/models/x", "mflux_version": "0.20.0"}</x:xmpmeta>', 'latin1'), Buffer.from([0xff, 0xd9])]);

const todos = (d) => readdirSync(d).flatMap((n) => { const f = join(d, n); return statSync(f).isDirectory() ? todos(f) : [f]; });

/** The findings in a built folder, as «file: reason (match)», from the bytes of every file. */
export function hallazgosBinarios(dist) {
  const out = [];
  for (const f of todos(dist)) {
    const bytes = readFileSync(f).toString('latin1');   // one char per byte: an ASCII term matches wherever its bytes are
    for (const [re, porque] of PROHIBIDO_BINARIO) { const m = bytes.match(re); if (m) out.push(`${f.slice(dist.length + 1)}: ${porque} (${m[0]})`); }
  }
  return out;
}
