#!/usr/bin/env node
/**
 * test-data-water-suspect-rows.mjs: suspicious rows are omitted, never corrected, and the
 * frozen ingestors refuse to run while the museum is closed.
 *
 * Two rules in data-water.mjs: a batch whose labels look swapped (lib/label-swaps.mjs) and
 * a run of rows dated out of the tab's order (lib/date-order.mjs). This runs the real
 * data-water.mjs over a small workbook, from a scratch copy of scripts/ (so the Site's
 * tracked data is never touched), then plants one mutation per rule in the scratch copy and
 * checks that each one turns the run red. It also runs data-ajolotes.mjs and data-ops.mjs
 * and checks that they refuse, and write nothing, while closure.json is active.
 *
 * Usage (from Site/):
 *   node scripts/test-data-water-suspect-rows.mjs
 */
import XLSX from 'xlsx';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { findOutOfOrderRows } from './lib/date-order.mjs';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(SCRIPTS, '..');
const fails = [];
const ok = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) fails.push(msg);
};

// Fixture days around 22 Sep 2026, the day the museum closed.
const day = delta => new Date(2026, 8, 22 + delta, 12);

const HEADER = ['Fecha', 'Hora', 'Autor Principal', 'Autor secundario', 'Ubicación', '1. Temperatura (°C)',
  '2. Amonia/amoniaco NH3 (mg/L)', '3. Nitritos NO2 (mg/L)', '4. Nitratos NO3 (mg/L)',
  '5. GH Dureza General (mg/L)', '6. KH Dureza de Carbonatos (mg/L)', '7. pH ',
  '9. Conductividad (µS/cm)', 'Nota'];
const intraday = (d, time, where, temp, ph, cond, note = null) => [d, time, 'May', null, where, temp, null, null, null, null, null, ph, cond, note];

function writeWorkbook(path) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['ID-sistemas', 'Especie', 'Parámetro', 'Unidad', 'Mínimo', 'Máximo', 'Objetivo'],
    ['AA', 'Ambystoma andersoni', 'Amonia/amoniaco NH3', 'mg/L', 0, 0.25, 0],
  ]), 'Catálogo de parámetros');
  // The tab is in date order; this fixture runs oldest first, which the order rule accepts too.
  const rows = [HEADER];
  // Baselines: four days of AM (about 860) and AD (about 2900).
  for (const d of [-6, -5, -4, -3]) {
    rows.push(intraday(day(d), '01:30', 'AM', 17.3, 7.8, 860 + d, 'baseline AM'));
    rows.push(intraday(day(d), '01:30', 'AD', 18.2, 8.1, 2900 + d, 'baseline AD'));
    // M: a run dated weeks earlier than both of its neighbours, the shape of a wrong date.
    if (d === -5) rows.push(intraday(day(-60), '12:44', 'AA', 18.6, 9.1, 830, 'misdated: out of the tab order'));
  }
  rows.push(
    // S: a suspected swap, each value sits at the other station's baseline.
    intraday(day(-2), '22:06', 'AD', 17.7, 7.5, 860, 'swap: AD row with AM water'),
    intraday(day(-2), '22:06', 'AM', 18.7, 7.9, 2900, 'swap: AM row with AD water'),
    // K: one-sided, AM reads like AD but AD reads like itself; not a swap, both published.
    intraday(day(-1), '05:00', 'AM', 17.4, 7.8, 2890, 'one-sided: published'),
    intraday(day(-1), '05:00', 'AD', 18.1, 8.1, 2896, 'one-sided: published'),
    // A: a full battery the day before the closure.
    [day(-1), '18:31', 'lups-plantae.axolodao.eth', 'XOVI bot', 'AA', 17, 0.25, 0.25, 40, 232.7, 161.1, 8.8, 880, 'row A'],
    // B: a reading on the closure day joins the same series as every other reading.
    intraday(day(0), '16:10', 'AA', 16.3, 8.7, 840, 'row B: closure day'),
    // E: a reader row, skipped as always.
    [day(6), '11:05', 'XOVI bot', '', 'AA', 17.0, 0, 0, 10, null, null, null, null, 'row E: reader row'],
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows, { cellDates: true }), 'Calidad de agua');
  XLSX.writeFile(wb, path);
}

const digest = p => (existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : 'absent');
const TRACKED = [
  'public/data/water-quality/measurements-all.json',
  'src/data/water-quality/measurements-mondays.json',
  'src/data/water-quality/dashboard-agua.json',
  'src/data/ajolotes/bundle.json',
].map(p => join(SITE, p));
const trackedBefore = TRACKED.map(digest);

function makeScratch() {
  const scratch = mkdtempSync(join(tmpdir(), 'data-water-suspect-'));
  cpSync(SCRIPTS, join(scratch, 'scripts'), { recursive: true });
  // data-ajolotes and data-ops read the closure from the Site's closure.json.
  mkdirSync(join(scratch, 'src/data'), { recursive: true });
  cpSync(join(SITE, 'src/data/closure.json'), join(scratch, 'src/data/closure.json'));
  symlinkSync(join(SITE, 'node_modules'), join(scratch, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const workbook = join(scratch, 'fixture-control.xlsx');
  writeWorkbook(workbook);
  return { scratch, workbook };
}
const runScript = ({ scratch, workbook }, script = 'data-water.mjs') => spawnSync(process.execPath, [join(scratch, 'scripts', script)], {
  env: { ...process.env, AXOLODAO_XLSX: workbook },
  encoding: 'utf8',
});
const readAll = scratch => {
  const p = join(scratch, 'public/data/water-quality/measurements-all.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : [];
};
const noted = (all, prefix) => all.filter(m => (m.note ?? '').startsWith(prefix));

console.log('\n0 · the date-order rule, case by case (indices of the flagged rows)');
const flags = dates => [...findOutOfOrderRows(dates)].sort((a, b) => a - b).join(',');
for (const [dates, want, why] of [
  [['2026-09-20', '2026-09-18', '2026-09-21', '2026-09-17', '2026-09-16'], '', 'a date three days off is not flagged'],
  [['2026-09-20', '2026-09-18', '2026-08-01', '2026-09-17', '2026-09-16'], '2', 'a date weeks off is flagged'],
  [['2026-09-30', '2026-09-20', '2026-07-17', '2026-09-10', '2026-09-01'], '2', 'the run below a misdated run is judged against its real neighbours and kept'],
  [['2026-09-06', '2026-09-29', '2026-09-22', '2026-09-21'], '0', 'a misdated first run is flagged, not the correct run under it'],
  [['2026-09-22', '2026-09-21', '2026-09-13', '2026-10-13'], '3', 'a misdated last run is flagged, not the correct run above it'],
  [['2026-09-30', '2026-09-10', '2026-09-20', '2026-09-01', '2026-08-31'], '1,2', 'two equally out-of-place runs are both omitted'],
  [['2026-09-20', '2026-09-18', '2026-08-01', '2026-09-18', '2026-09-17'], '2', 'the two halves of a date split by a misdated run join again'],
  [[null, '2026-09-20', null, '2026-08-01', '2026-09-19', '2026-09-18'], '3', 'empty rows in between do not change the order'],
]) ok(flags(dates) === want, `${why} (${flags(dates) || 'none'})`);

const scratches = [];
try {
  console.log('\n1 · the real data-water.mjs over the fixture');
  const s = makeScratch();
  scratches.push(s.scratch);
  const run = runScript(s);
  ok(run.status === 0, `data-water.mjs exits 0 (${run.status}${run.status ? `: ${(run.stderr || '').trim().split('\n').pop()}` : ''})`);
  const all = readAll(s.scratch);
  ok(all.length > 0, `the series is not empty (${all.length} rows), so the next checks are about something`);
  ok(all.length === 12, `12 rows published: 8 baseline rows, the one-sided pair K, row A and row B (${all.length})`);
  ok(noted(all, 'swap:').length === 0, 'neither row of the suspected swap is published');
  ok(noted(all, 'one-sided').length === 2, 'the one-sided pair K is published: one odd value is not a swap');
  ok(noted(all, 'misdated').length === 0, 'the run dated out of the tab order is not published');
  ok(noted(all, 'row B').length === 1 && noted(all, 'row B')[0].tankId === 'AA', 'a reading from the closure day is published in the same series, as AA');
  ok(/omitted 2 rows as 1 suspected label swaps/.test(run.stderr || ''), 'the log names the omitted swap');
  ok(/omitted 1 rows dated out of the tab's order/.test(run.stderr || ''), 'the log names the out-of-order row');
  ok(existsSync(join(s.scratch, 'src/data/water-quality/dashboard-agua.json')), 'dashboard-agua.json is written as before');

  console.log('\n2 · each rule is seen red: one mutation per rule, planted in the scratch copy');
  const mutations = [
    {
      name: 'publish the rows of a suspected swap',
      file: 'scripts/data-water.mjs',
      from: '  if (omitted.has(c.id)) continue;\n',
      to: '',
      red: sc => noted(readAll(sc), 'swap:').length > 0,
    },
    {
      name: 'publish rows dated out of the tab order',
      file: 'scripts/data-water.mjs',
      from: '  if (outOfOrder.has(r)) {',
      to: '  if (false) {',
      red: sc => noted(readAll(sc), 'misdated').length > 0,
    },
    {
      name: 'let one odd value omit a pair (&& to ||)',
      file: 'scripts/lib/label-swaps.mjs',
      from: 'if (xLooksLikeY && yLooksLikeX)',
      to: 'if (xLooksLikeY || yLooksLikeX)',
      red: sc => noted(readAll(sc), 'one-sided').length < 2,
    },
  ];
  for (const m of mutations) {
    const ms = makeScratch();
    scratches.push(ms.scratch);
    const file = join(ms.scratch, m.file);
    const src = readFileSync(file, 'utf8');
    ok(src.includes(m.from), `the mutation site exists: ${JSON.stringify(m.from.trim())}`);
    writeFileSync(file, src.replace(m.from, m.to));
    const mr = runScript(ms);
    ok(mr.status === 0 && m.red(ms.scratch), `red when we ${m.name}`);
  }

  console.log('\n3 · the frozen ingestors refuse while the museum is closed');
  for (const script of ['data-ajolotes.mjs', 'data-ops.mjs']) {
    const gs = makeScratch();
    scratches.push(gs.scratch);
    const gr = runScript(gs, script);
    ok(gr.status === 1 && /refused: the museum is closed/.test(gr.stderr || ''), `${script} refuses to run`);
    ok(!existsSync(join(gs.scratch, 'src/data/ajolotes')) && !existsSync(join(gs.scratch, 'src/data/ops')) && !existsSync(join(gs.scratch, 'public/data/ops')),
      `${script} wrote nothing`);
  }

  console.log('\n4 · the test leaves the Site alone');
  const after = TRACKED.map(digest);
  TRACKED.forEach((p, i) => ok(after[i] === trackedBefore[i], `${p.slice(SITE.length + 1)} is byte-identical after the run`));
} finally {
  for (const d of scratches) rmSync(d, { recursive: true, force: true });
}

if (fails.length) {
  console.log(`\n${fails.length} FALLAS`);
  for (const f of fails) console.log(`   ✗ ${f}`);
  process.exit(1);
}
console.log('\nTODO VERDE');
