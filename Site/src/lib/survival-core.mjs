/**
 * Survival of the museum's animals for a period, as a pure function of the bundle, the period and the curated date corrections.
 *
 * Who counts, for the period `since` to `until` (the opening day to the closing day):
 *   - alive at the closing day: the animals alive today plus those that died AFTER the closing day (they were alive on it);
 *   - dead in the period: every death dated from `since` to `until`, inclusive;
 *   - a death WITHOUT a date also counts as dead in the period (the larvae and the unnamed groups): the museum bred them, so an unrecorded date
 *     can only fall inside its life; leaving them out would raise the rate;
 *   - a death dated before `since` is not the museum's.
 * The rate is a function of the period: move `until` and it recomputes, and no death in the count falls outside the period.
 * @param {{ ejemplares: unknown[], bajas: {nombre?: string|null, fecha?: string|null}[], bajasSnapshots?: {alias?: string|null, fecha?: string|null}[] }} bundle
 * @param {{ since: string, until: string, fixes?: Record<string,string> }} opts
 * @returns {{ vivos: number, bajas: number, total: number, tasa: number|null, fechas: (string|null)[] }}
 */
export function contarSupervivencia(bundle, { since, until, fixes = {} }) {
  const fecha = (b) => fixes[(b.nombre ?? b.alias ?? '').trim()] ?? b.fecha ?? b.fechaBaja;
  const dentro = (f) => !f || (f >= since && f <= until);
  const rows = bundle.bajas.filter((b) => dentro(fecha(b)));
  const inBajas = new Set(bundle.bajas.map((b) => (b.nombre ?? '').trim()));
  // A deceased animal the sheet has not recorded as a baja (a snapshot): it counts once, on its own date when a curated one is known.
  const extras = (bundle.bajasSnapshots ?? []).filter((s) => !inBajas.has((s.alias ?? '').trim()));
  const extrasEnElPeriodo = extras.filter((s) => dentro(fecha(s)));
  const afterClosing = [...bundle.bajas, ...extras].filter((b) => fecha(b) && fecha(b) > until).length;
  const vivos = bundle.ejemplares.length + afterClosing;
  const bajas = rows.length + extrasEnElPeriodo.length;
  const total = vivos + bajas;
  return { vivos, bajas, total, tasa: total ? vivos / total : null, fechas: [...rows, ...extrasEnElPeriodo].map((b) => fecha(b) ?? null) };
}
