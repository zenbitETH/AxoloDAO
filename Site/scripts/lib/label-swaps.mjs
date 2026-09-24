// Suspected label swaps: two stations measured in the same batch (same date and time)
// whose readings look entered under each other's labels. Such rows are omitted, never
// corrected: the workbook is the record, and a guess about which row is which is not.
//
// The test is mutual and uses each station's own recent readings, not the catalog ranges
// (those no longer describe the systems' water). A pair X, Y is a suspected swap when
// X's value is closer to Y's baseline than to its own AND Y's value is closer to X's
// baseline than to its own, and the two baselines are clearly apart. A baseline is the
// median of the station's other readings within WINDOW_DAYS on either side, from other
// batches, and needs MIN_SAMPLES of them.
//
// Reach: it sees only swaps between stations whose values differ for that parameter.
// With conductivity that is AD against AA or AM; a swap between AA and AM, whose water
// reads alike, cannot be seen by this test.
export const SWAP_PARAM = 'cond';
export const WINDOW_DAYS = 7;
export const MIN_SAMPLES = 3;
export const MIN_SEPARATION = 0.25; // baselines differ by at least 25% of the larger

const dayNumber = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * rows: [{ id, series, station, date, time, value }]. `series` keeps the two sides of the
 * closure apart: a baseline never mixes them. Returns the swapped pairs, each as
 * { date, time, a, b } with the two row ids and station names.
 */
export function findLabelSwaps(rows) {
  const usable = rows.filter(r => r.station && typeof r.value === 'number' && Number.isFinite(r.value));
  const batchOf = r => `${r.series}|${r.date}|${r.time ?? ''}`;
  const byStation = new Map();
  for (const r of usable) {
    const k = `${r.series}|${r.station}`;
    if (!byStation.has(k)) byStation.set(k, []);
    byStation.get(k).push(r);
  }
  const baseline = r => {
    const d = dayNumber(r.date);
    const others = (byStation.get(`${r.series}|${r.station}`) ?? [])
      .filter(o => batchOf(o) !== batchOf(r) && Math.abs(dayNumber(o.date) - d) <= WINDOW_DAYS)
      .map(o => o.value);
    return others.length >= MIN_SAMPLES ? median(others) : null;
  };

  const batches = new Map();
  for (const r of usable) {
    const k = batchOf(r);
    if (!batches.has(k)) batches.set(k, []);
    batches.get(k).push(r);
  }

  const pairs = [];
  for (const batch of batches.values()) {
    for (let i = 0; i < batch.length; i++) {
      for (let j = i + 1; j < batch.length; j++) {
        const x = batch[i];
        const y = batch[j];
        if (x.station === y.station) continue;
        const bx = baseline(x);
        const by = baseline(y);
        if (bx == null || by == null) continue;
        if (Math.abs(bx - by) < MIN_SEPARATION * Math.max(Math.abs(bx), Math.abs(by))) continue;
        const xLooksLikeY = Math.abs(x.value - by) < Math.abs(x.value - bx);
        const yLooksLikeX = Math.abs(y.value - bx) < Math.abs(y.value - by);
        if (xLooksLikeY && yLooksLikeX) pairs.push({ date: x.date, time: x.time, a: x, b: y });
      }
    }
  }
  return pairs;
}
