// Rows dated out of the tab's order. 'Calidad de agua' is kept in date order (newest
// first), so a run of same-dated rows that breaks that order by a week or more was almost
// certainly given the wrong date: three rows written in September under a July date read
// exactly like that. Such rows are omitted, never re-dated: the workbook is the record, and
// the fix is to correct the date there.
//
// A run inside the tab is out of order when it is older than both neighbouring runs (a dip)
// or newer than both (a spike) AND its neighbours are in order with each other once it is
// gone, so the rows next to a misdated run are never blamed for it. The first and last runs
// are judged by their one step against the tab's direction. The most out-of-place runs are
// removed first and the check repeats; when two runs are equally out of place, and date
// order alone cannot tell which one is wrong, both are omitted.
//
// Reach: it sees a wrong date only when it breaks the order by at least MIN_GAP_DAYS. A date
// off by less than that, or a wrong date that still falls between its neighbours, is not seen.
export const MIN_GAP_DAYS = 7;

const dayNumber = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;

function mergeEqualNeighbours(runs) {
  for (let k = runs.length - 1; k > 0; k--) {
    if (runs[k - 1].date === runs[k].date) {
      runs[k - 1].rows.push(...runs[k].rows);
      runs.splice(k, 1);
    }
  }
}

/** dates: one ISO date or null per sheet row, in sheet order. Returns the flagged row indices. */
export function findOutOfOrderRows(dates) {
  const runs = [];
  dates.forEach((d, i) => {
    if (!d) return;
    const last = runs[runs.length - 1];
    if (last && last.date === d) last.rows.push(i);
    else runs.push({ date: d, day: dayNumber(d), rows: [i] });
  });

  // The tab's direction is the one most steps take; newest first on a tie.
  let up = 0;
  let down = 0;
  for (let k = 1; k < runs.length; k++) {
    if (runs[k].day > runs[k - 1].day) up++;
    else down++;
  }
  const inOrder = (above, below) => (down >= up ? above >= below : above <= below);

  const flagged = new Set();
  for (;;) {
    let worst = [];
    let worstGap = 0;
    for (let k = 0; k < runs.length; k++) {
      const x = runs[k].day;
      const above = k > 0 ? runs[k - 1].day : null;
      const below = k < runs.length - 1 ? runs[k + 1].day : null;
      let gap = 0;
      if (above != null && below != null) {
        const dip = x < above && x < below;
        const spike = x > above && x > below;
        if ((dip || spike) && inOrder(above, below)) {
          gap = dip ? Math.min(above - x, below - x) : Math.min(x - above, x - below);
        }
      } else if (below != null) {
        if (!inOrder(x, below)) gap = Math.abs(x - below);
      } else if (above != null) {
        if (!inOrder(above, x)) gap = Math.abs(above - x);
      }
      if (gap < MIN_GAP_DAYS) continue;
      if (gap > worstGap) {
        worst = [k];
        worstGap = gap;
      } else if (gap === worstGap) {
        worst.push(k);
      }
    }
    if (!worst.length) break;
    for (const k of worst.sort((a, b) => b - a)) {
      runs[k].rows.forEach(i => flagged.add(i));
      runs.splice(k, 1);
    }
    mergeEqualNeighbours(runs);
  }
  return flagged;
}
