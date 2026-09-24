#!/usr/bin/env node
/**
 * test-data-water-bot.mjs — the reader's rows never reach the published water data.
 *
 * Kiki's audit of 2026-09-18 (K5, findings 2 and 8): the skip in data-water.mjs was held
 * by no test, and the spelling "XOVI bot" was joined to the Sheet writer only by a comment.
 * This runs the real data-water.mjs over Kiki's five-row workbook and pins the spelling.
 *
 * data-water.mjs writes into src/data and public/data next to its own folder, so the test
 * runs a copy of scripts/ from a scratch directory: the Site's tracked data is never touched.
 *
 * Usage (from Site/):
 *   node scripts/test-data-water-bot.mjs
 */
import XLSX from 'xlsx';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { READER_BOT_AUTHOR, isReaderBotAuthor } from './lib/reader-bot.mjs';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(SCRIPTS, '..');
const fails = [];
const ok = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) fails.push(msg);
};

console.log('\n1 · the spelling is pinned by its bytes, not compared to itself');
ok(Buffer.from(READER_BOT_AUTHOR, 'utf8').toString('hex') === '584f564920626f74',
  `READER_BOT_AUTHOR is "XOVI bot" byte for byte (${JSON.stringify(READER_BOT_AUTHOR)}), the bytes the brain pins too`);
for (const [value, expected] of [
  ['XOVI bot', true], ['  xovi BOT  ', true],
  ['Xovi (bot)', false], ['xovi robot', false], ['lups-plantae.axolodao.eth', false], ['', false], [null, false],
]) {
  ok(isReaderBotAuthor(value) === expected, `${JSON.stringify(value)} → ${expected ? 'bot' : 'not the bot'}`);
}

// Kiki's fixture: the curator's row with the bot as SECONDARY, two reader rows (canonical and
// hand-edited spelling), the old spelling as main author, and a human row with a blank main.
function writeWorkbook(path) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['ID-sistemas', 'Especie', 'Parámetro', 'Unidad', 'Mínimo', 'Máximo', 'Objetivo'],
    ['AA', 'Ambystoma andersoni', 'Amonia/amoniaco NH3', 'mg/L', 0, 0.25, 0],
  ]), 'Catálogo de parámetros');
  const d = new Date(2026, 8, 14, 12);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Fecha', 'Hora', 'Autor Principal', 'Autor secundario', 'Ubicación', '1. Temperatura (°C)',
      '2. Amonia/amoniaco NH3 (mg/L)', '3. Nitritos NO2 (mg/L)', '4. Nitratos NO3 (mg/L)',
      '5. GH Dureza General (mg/L)', '6. KH Dureza de Carbonatos (mg/L)', '7. pH ',
      '9. Conductividad (µS/cm)', 'Nota'],
    [d, '10:50', 'lups-plantae.axolodao.eth', 'XOVI bot', 'AA', 18.1, 0.25, 0.5, 80, 232.7, 196.9, 8.1, 840, 'LUPITA verified row: bot as SECONDARY'],
    [d, '10:55', 'XOVI bot', '', 'AA', null, 0.5, null, 80, null, null, null, null, '[lector 1/2] BOT row, canonical spelling'],
    [d, '10:56', ' xovi BOT ', '', 'AA', null, 1.0, null, 40, null, null, null, null, '[lector 2/2] BOT row, case and spaces'],
    [d, '10:57', 'Xovi (bot)', '', 'AA', null, 2.0, null, 20, null, null, null, null, 'OLD spelling as main author'],
    [d, '10:58', '', 'XOVI bot', 'AA', 18.0, 0.25, null, null, null, null, null, null, 'HUMAN row with blank main and bot secondary'],
  ], { cellDates: true }), 'Calidad de agua');
  XLSX.writeFile(wb, path);
}

const digest = p => (existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : 'absent');
const trackedOut = join(SITE, 'public/data/water-quality/measurements-all.json');
const trackedBefore = digest(trackedOut);

const scratch = mkdtempSync(join(tmpdir(), 'data-water-bot-'));
try {
  cpSync(SCRIPTS, join(scratch, 'scripts'), { recursive: true });
  symlinkSync(join(SITE, 'node_modules'), join(scratch, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const workbook = join(scratch, 'fixture-control.xlsx');
  writeWorkbook(workbook);

  // The run sets the two env vars the brain writer once read the bot's name from: neither may
  // rename the bot here.
  const run = spawnSync(process.execPath, [join(scratch, 'scripts', 'data-water.mjs')], {
    env: { ...process.env, AXOLODAO_XLSX: workbook, CONTROL_BOT_AUTHOR: 'xovi robot', CONTROL_AUTHOR_SECONDARY: 'xovi robot' },
    encoding: 'utf8',
  });

  console.log('\n2 · the real data-water.mjs over the five-row workbook');
  ok(run.status === 0, `data-water.mjs exits 0 (${run.status}${run.status ? `: ${(run.stderr || '').trim().split('\n').pop()}` : ''})`);
  const outPath = join(scratch, 'public/data/water-quality/measurements-all.json');
  const all = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : [];
  const main = r => (r.authors?.main ?? '').toString();
  ok(!all.some(r => isReaderBotAuthor(main(r))), 'no published row has the bot as main author, in either spelling');
  ok(/skipped 2 reader-bot rows/.test(run.stdout || ''), 'the log counts exactly the 2 reader rows it skipped');
  ok(all.some(r => main(r) === 'lups-plantae.axolodao.eth' && r.authors?.secondary === 'XOVI bot' && r.values?.nh3 === 0.25),
    "the curator's row, with the bot as SECONDARY author, is published");
  ok(all.some(r => (r.note || '').includes('HUMAN row with blank main')), 'a human row with a blank main author is published');
  ok(all.some(r => main(r) === 'Xovi (bot)'),
    'the old spelling "Xovi (bot)" as main author is published: only the reader writes the main author, and it writes "XOVI bot"');
  ok(all.length === 3, `exactly 3 of 5 rows published (${all.length}), with CONTROL_BOT_AUTHOR and CONTROL_AUTHOR_SECONDARY set to "xovi robot"`);

  console.log('\n3 · the test itself leaves the Site alone');
  ok(digest(trackedOut) === trackedBefore, 'public/data/water-quality/measurements-all.json is byte-identical after the run');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (fails.length) {
  console.log(`\n${fails.length} FALLAS`);
  for (const f of fails) console.log(`   ✗ ${f}`);
  process.exit(1);
}
console.log('\nTODO VERDE');
