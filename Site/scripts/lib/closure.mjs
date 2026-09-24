// The museum's closure, read by the data scripts from the same file the site's banner reads
// (src/data/closure.json), so the scripts and the pages can never disagree about it.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function readClosure() {
  const c = JSON.parse(readFileSync(resolve(SITE_ROOT, 'src/data/closure.json'), 'utf8'));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.closedOn ?? '')) {
    throw new Error(`closure.json closedOn must be YYYY-MM-DD, got ${c.closedOn}`);
  }
  return c;
}

// The roster and the operations log stay as published while the museum is closed: the
// animals are outside it and nothing about them is republished from the workbook until
// the reopening. A deliberate run passes --during-closure, visibly, on its command line.
export function refuseWhileClosed(script) {
  const { active, closedOn } = readClosure();
  if (!active || process.argv.includes('--during-closure')) return;
  console.error(
    `[${script}] refused: the museum is closed since ${closedOn} (src/data/closure.json) and this ` +
      `script's outputs stay as published. Nothing was written. Pass --during-closure to run it anyway.`,
  );
  process.exit(1);
}
