#!/usr/bin/env node
/**
 * test-data-water-closure.mjs: the series from before the closure and the renovation series
 * never touch, and a suspected label swap or a row dated out of the tab's order is omitted.
 *
 * The museum closed on closure.json `closedOn`. From that day on a reading is either a
 * renovation reading from a station in lib/renovation-stations.mjs or it is not published.
 * This runs the real data-water.mjs over a small workbook, from a scratch copy of scripts/
 * (so the Site's tracked data is never touched), with a test station planted in place of
 * the last one in the scratch copy of the allowlist. Then it plants one mutation per guard in the scratch copy
 * of data-water.mjs and checks that each one turns the run red.
 *
 * Usage (from Site/):
 *   node scripts/test-data-water-closure.mjs
 */
import XLSX from 'xlsx';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { RENOVATION_STATIONS, renovationStationFor } from './lib/renovation-stations.mjs';
import { findOutOfOrderRows } from './lib/date-order.mjs';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(SCRIPTS, '..');
const CLOSED_ON = JSON.parse(readFileSync(join(SITE, 'src/data/closure.json'), 'utf8')).closedOn;
const fails = [];
const ok = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) fails.push(msg);
};

// Dates on each side of the boundary, built from closure.json so the test follows a moved date.
const day = delta => {
  const [y, m, d] = CLOSED_ON.split('-').map(Number);
  return new Date(y, m - 1, d + delta, 12);
};
const isoOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Planted in the scratch allowlist as written with an NFC accent; the fixture writes the
// cell with an NFD accent, other case and extra spaces.
const PLANTED_KEY = 'Estación de prueba';
const PLANTED = { id: 'test-estacion', label: 'Estación de prueba' };
const PLANTED_CELL = '  ESTACIÓN DE  prueba ';

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
  const rows = [HEADER];
  // Baselines: four days of AM (about 860) and AD (about 2900) before the closure.
  for (const d of [-6, -5, -4, -3]) {
    rows.push(intraday(day(d), '01:30', 'AM', 17.3, 7.8, 860 + d, 'baseline AM'));
    rows.push(intraday(day(d), '01:30', 'AD', 18.2, 8.1, 2900 + d, 'baseline AD'));
    // M: a run dated weeks earlier than both of its neighbours, the shape of a wrong date.
    if (d === -5) rows.push(intraday(day(-60), '12:44', 'AA', 18.6, 9.1, 830, 'misdated: out of the tab order'));
  }
  // The tab is in date order; this fixture runs oldest first, which the order rule accepts too.
  rows.push(
    // S: a suspected swap, each value sits at the other station's baseline.
    intraday(day(-2), '22:06', 'AD', 17.7, 7.5, 860, 'swap: AD row with AM water'),
    intraday(day(-2), '22:06', 'AM', 18.7, 7.9, 2900, 'swap: AM row with AD water'),
    // K: one-sided, AM reads like AD but AD reads like itself; not a swap, both published.
    intraday(day(-1), '05:00', 'AM', 17.4, 7.8, 2890, 'one-sided: published'),
    intraday(day(-1), '05:00', 'AD', 18.1, 8.1, 2896, 'one-sided: published'),
    // A: a full battery before the closure.
    [day(-1), '18:31', 'lups-plantae.axolodao.eth', 'XOVI bot', 'AA', 17, 0.25, 0.25, 40, 232.7, 161.1, 8.8, 880, 'row A: before the closure'],
    // B: a legacy station on the closure day goes to the renovation series.
    intraday(day(0), '22:46', 'AA', 16.3, 8.7, 840, 'row B: AA on the closure day'),
    // C: an unlisted location after the closure, which normalizeTankId would fold into AD.
    intraday(day(6), '10:50', 'AD 2', 17.5, 7.6, 2800, 'row C: would fold into AD'),
    // D: the planted station, written another way.
    [day(6), '11:00', 'lups-plantae.axolodao.eth', 'XOVI bot', PLANTED_CELL, 17.2, 0, 0.1, 10, 170, 110, 7.5, 790, 'row D: note must not travel'],
    // E: a reader row on a renovation station.
    [day(6), '11:05', 'XOVI bot', '', 'AA', 17.0, 0, 0, 10, null, null, null, null, 'row E: reader row'],
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows, { cellDates: true }), 'Calidad de agua');
  XLSX.writeFile(wb, path);
}

const digest = p => (existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : 'absent');
const TRACKED = [
  'public/data/water-quality/measurements-all.json',
  'src/data/water-quality/measurements-mondays.json',
  'src/data/water-quality/renovation-series.json',
  'src/data/water-quality/dashboard-agua.json',
].map(p => join(SITE, p));
const trackedBefore = TRACKED.map(digest);

function makeScratch({ closure } = {}) {
  const scratch = mkdtempSync(join(tmpdir(), 'data-water-closure-'));
  cpSync(SCRIPTS, join(scratch, 'scripts'), { recursive: true });
  mkdirSync(join(scratch, 'src/data'), { recursive: true });
  if (closure) writeFileSync(join(scratch, 'src/data/closure.json'), JSON.stringify(closure));
  else cpSync(join(SITE, 'src/data/closure.json'), join(scratch, 'src/data/closure.json'));
  symlinkSync(join(SITE, 'node_modules'), join(scratch, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  // Plant the test station in place of the last one (the chart has one colour per slot and
  // the list is full). The real list is never edited.
  const allow = join(scratch, 'scripts/lib/renovation-stations.mjs');
  const src = readFileSync(allow, 'utf8');
  const planted = src.replace(/\n  \[[^\n]*\],\n\];\n/, `\n  [${JSON.stringify(PLANTED_KEY)}, ${JSON.stringify(PLANTED)}],\n];\n`);
  if (planted === src) throw new Error('could not plant the test station: the allowlist declaration changed');
  writeFileSync(allow, planted);
  const workbook = join(scratch, 'fixture-control.xlsx');
  writeWorkbook(workbook);
  return { scratch, workbook };
}
const runIngest = ({ scratch, workbook }) => spawnSync(process.execPath, [join(scratch, 'scripts', 'data-water.mjs')], {
  env: { ...process.env, AXOLODAO_XLSX: workbook },
  encoding: 'utf8',
});
const readJson = p => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const outputs = scratch => ({
  all: readJson(join(scratch, 'public/data/water-quality/measurements-all.json')) ?? [],
  renov: readJson(join(scratch, 'src/data/water-quality/renovation-series.json')),
});
const swappedPublished = all => all.some(m => (m.note ?? '').startsWith('swap:'));

console.log('\n0 · the real allowlist');
const real = [...RENOVATION_STATIONS.values()];
ok(real.length > 0 && real.length <= 3, `the allowlist is not empty and fits the three chart colours (${real.length})`);
ok(real.every(s => !/^(AA|AM|AD|AM 1|AM 2|AM Larvas|Llave|Guppies)$/.test(s.id)), 'no station id is a tank id from before the closure');
ok(renovationStationFor(' aa ')?.id === RENOVATION_STATIONS.get('AA')?.id, 'a cell written " aa " finds the AA station');

console.log('\n0b · the date-order rule, case by case (indices of the flagged rows)');
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
  console.log(`\n1 · the real data-water.mjs, boundary ${CLOSED_ON} from closure.json`);
  const s = makeScratch();
  scratches.push(s.scratch);
  const run = runIngest(s);
  ok(run.status === 0, `data-water.mjs exits 0 (${run.status}${run.status ? `: ${(run.stderr || '').trim().split('\n').pop()}` : ''})`);
  const { all, renov } = outputs(s.scratch);
  ok(all.length > 0, `the series from before the closure is not empty (${all.length} rows), so the next checks are about something`);
  ok(all.length === 11, `11 rows before the closure: 8 baseline rows, the one-sided pair K and row A (${all.length})`);
  ok(all.every(m => m.date < CLOSED_ON), `no row in measurements-all is dated on or after ${CLOSED_ON}`);
  ok(!swappedPublished(all), 'neither row of the suspected swap is published');
  ok(all.filter(m => (m.note ?? '').startsWith('one-sided')).length === 2, 'the one-sided pair K is published: one odd value is not a swap');
  ok(!all.some(m => (m.note ?? '').startsWith('misdated')), 'the run dated out of the tab order is not published');
  ok(/omitted 1 rows dated out of the tab's order/.test(run.stderr || ''), 'the log names the out-of-order row');
  ok(/omitted 2 rows as 1 suspected label swaps/.test(run.stderr || ''), 'the log names the omitted swap');
  ok(/skipped 1 rows dated on or after/.test(run.stderr || ''), 'the log counts the one unlisted post-closure row ("AD 2")');
  ok(renov?.from === CLOSED_ON, `renovation-series.json "from" is closure.json closedOn (${renov?.from})`);
  const byStation = id => renov?.readings?.filter(r => r.stationId === id) ?? [];
  const aa = RENOVATION_STATIONS.get('AA');
  ok(renov?.readings?.length === 2, `2 renovation readings: rows B and D; the reader row E is skipped first (${renov?.readings?.length})`);
  ok(byStation(aa.id).length === 1 && byStation(aa.id)[0].date === isoOf(day(0)), `row B, AA on the closure day, is a renovation reading of ${aa.id}`);
  ok(byStation(PLANTED.id).length === 1, `row D, written ${JSON.stringify(PLANTED_CELL)} with an NFD accent, maps to ${PLANTED.id}`);
  const r = byStation(PLANTED.id)[0] ?? {};
  ok(!('note' in r) && !('tankId' in r) && !('alarms' in r), 'a renovation reading carries no note, tankId or alarms');
  ok(r.authors?.main === 'lups-plantae.axolodao.eth' && r.authors?.secondary === 'XOVI bot', 'its authors are carried as written');
  const slotOf = id => renov?.stations?.find(st => st.id === id)?.slot;
  ok(slotOf(aa.id) === 0 && slotOf(PLANTED.id) === real.length - 1, `colour slots follow the allowlist order, not which stations have readings (${slotOf(aa.id)}, ${slotOf(PLANTED.id)})`);
  ok(!existsSync(join(s.scratch, 'src/data/water-quality/dashboard-agua.json')), 'dashboard-agua.json is not written: the workbook has rows from the closure on');

  console.log('\n1b · the same workbook after the reopening edit (active and quarantine false)');
  const reopened = makeScratch({ closure: { ...JSON.parse(readFileSync(join(SITE, 'src/data/closure.json'), 'utf8')), active: false, quarantine: false } });
  scratches.push(reopened.scratch);
  const rr = runIngest(reopened);
  ok(rr.status === 0, 'data-water.mjs exits 0');
  ok(!existsSync(join(reopened.scratch, 'src/data/water-quality/dashboard-agua.json')), 'dashboard-agua.json is still not written: the freeze follows the data, not the flag');
  ok(outputs(reopened.scratch).all.every(m => m.date < CLOSED_ON), 'the series from before the closure still ends before it');

  console.log('\n2 · each guard is seen red: one mutation per check, planted in the scratch data-water.mjs');
  const mutations = [
    {
      name: 'drop the closure routing, so post-closure rows reach normalizeTankId',
      from: 'if (iso >= CLOSED_ON) {',
      to: 'if (false) {',
      red: mr => mr.status !== 0 && /reached the series from before the closure/.test(mr.stderr || ''),
    },
    {
      name: 'move the routing boundary one day later (>= to >)',
      from: 'if (iso >= CLOSED_ON) {',
      to: 'if (iso > CLOSED_ON) {',
      red: mr => mr.status !== 0 && /reached the series from before the closure/.test(mr.stderr || ''),
    },
    {
      name: 'let a renovation station reuse a tank id from before the closure',
      from: 'const collided = stationIds.filter(id => TANK_META[id]);',
      to: "const collided = [...stationIds, 'AA'].filter(id => TANK_META[id]);",
      red: mr => mr.status !== 0 && /reuse tank ids from before the closure/.test(mr.stderr || ''),
    },
    {
      name: 'publish the rows of a suspected swap',
      from: '  if (omitted.has(c.id)) continue;\n',
      to: '',
      red: (mr, sc) => mr.status === 0 && swappedPublished(outputs(sc).all),
    },
    {
      name: 'publish rows dated out of the tab order',
      from: '  if (outOfOrder.has(r)) {',
      to: '  if (false) {',
      red: (mr, sc) => mr.status === 0 && outputs(sc).all.some(m => (m.note ?? '').startsWith('misdated')),
    },
    {
      name: 'write dashboard-agua.json although the workbook has rows from the closure on',
      from: 'if (rowsFromClosureOn) {',
      to: 'if (false) {',
      red: (mr, sc) => mr.status === 0 && existsSync(join(sc, 'src/data/water-quality/dashboard-agua.json')),
    },
  ];
  // The swap test is mutual; one odd value alone must never omit a row. Planted in the
  // scratch lib, since the rule lives there.
  {
    const ms = makeScratch();
    scratches.push(ms.scratch);
    const file = join(ms.scratch, 'scripts/lib/label-swaps.mjs');
    const src = readFileSync(file, 'utf8');
    const from = 'if (xLooksLikeY && yLooksLikeX)';
    ok(src.includes(from), `the mutation site exists: ${JSON.stringify(from)}`);
    writeFileSync(file, src.replace(from, 'if (xLooksLikeY || yLooksLikeX)'));
    const mr = runIngest(ms);
    ok(mr.status === 0 && outputs(ms.scratch).all.filter(m => (m.note ?? '').startsWith('one-sided')).length < 2,
      'red when one odd value is enough to omit a pair (&& to ||)');
  }
  for (const m of mutations) {
    const ms = makeScratch();
    scratches.push(ms.scratch);
    const file = join(ms.scratch, 'scripts/data-water.mjs');
    const src = readFileSync(file, 'utf8');
    ok(src.includes(m.from), `the mutation site exists: ${JSON.stringify(m.from.trim())}`);
    writeFileSync(file, src.replace(m.from, m.to));
    ok(m.red(runIngest(ms), ms.scratch), `red when we ${m.name}`);
  }

  console.log('\n2b · the guards that refuse to run, each seen refusing');
  const refusals = [
    {
      name: 'two stations share an id',
      plant: src => src.replace(/\n\];\n/, `\n  ['OTRA AA', ${JSON.stringify(RENOVATION_STATIONS.get('AA'))}],\n];\n`),
      expect: /two stations share an id/,
    },
    {
      name: 'a fourth station has no chart colour',
      plant: src => src.replace(/\n\];\n/, `\n  ['CUARTA', { id: 'renovacion-cuarta', label: 'CUARTA' }],\n];\n`),
      expect: /lists 4 stations; the chart has 3 colours/,
    },
  ];
  for (const g of refusals) {
    const gs = makeScratch();
    scratches.push(gs.scratch);
    const allow = join(gs.scratch, 'scripts/lib/renovation-stations.mjs');
    const src = readFileSync(allow, 'utf8');
    const planted = g.plant(src);
    ok(planted !== src, `the plant for "${g.name}" applies`);
    writeFileSync(allow, planted);
    const gr = runIngest(gs);
    ok(gr.status !== 0 && g.expect.test(gr.stderr || ''), `data-water refuses when ${g.name}`);
  }
  for (const script of ['data-ajolotes.mjs', 'data-ops.mjs']) {
    const gs = makeScratch();
    scratches.push(gs.scratch);
    const gr = spawnSync(process.execPath, [join(gs.scratch, 'scripts', script)], { env: { ...process.env, AXOLODAO_XLSX: gs.workbook }, encoding: 'utf8' });
    ok(gr.status === 1 && /refused: the museum is closed/.test(gr.stderr || ''), `${script} refuses to run while the museum is closed`);
    ok(!existsSync(join(gs.scratch, 'src/data/ajolotes')) && !existsSync(join(gs.scratch, 'src/data/ops')) && !existsSync(join(gs.scratch, 'public/data/ops')),
      `${script} wrote nothing`);
  }

  console.log('\n3 · the test leaves the Site alone');
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
