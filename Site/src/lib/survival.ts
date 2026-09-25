// Tasa de supervivencia: ejemplares vivos entre los ejemplares registrados desde la apertura del
// Biomuseo (vivos + bajas con fecha igual o posterior a la apertura, o sin fecha).
// One helper for every page that shows it, so the Xolotlcalli page, the registry cover and the
// Bajas wall agree. Deaths are counted one by one (grouped larvae count individually), from the
// same bundle the wall reads: the Bajas rows plus deceased snapshots the sheet has not recorded.
// Withheld (embargoed) records are already out of the bundle, as in every public count.

import { BAJA_FECHA_FIX } from '../components/ajolotes/memorial';

export const OPENING = '2025-10-24';
// Date the counts describe; update it with each data refresh.
export const CORTE = '2026-09-25';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const fechaLarga = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
};

interface BundleLike {
  ejemplares: unknown[];
  bajas: { nombre?: string | null; fecha?: string | null }[];
  bajasSnapshots?: { alias?: string | null }[];
}

export interface Survival {
  vivos: number;
  bajas: number;
  total: number;
  tasa: number | null;      // 0..1
}

export function survival(bundle: BundleLike, since: string = OPENING): Survival {
  const vivos = bundle.ejemplares.length;
  // Curated date corrections (memorial.ts) apply here too, so the wall and every counter agree.
  const fecha = (b: { nombre?: string | null; fecha?: string | null }) => BAJA_FECHA_FIX[(b.nombre ?? '').trim()] ?? b.fecha;
  const rows = bundle.bajas.filter((b) => !fecha(b) || (fecha(b) as string) >= since);
  const inBajas = new Set(bundle.bajas.map((b) => (b.nombre ?? '').trim()));
  const extra = (bundle.bajasSnapshots ?? []).filter((s) => !inBajas.has((s.alias ?? '').trim())).length;
  const bajas = rows.length + extra;
  const total = vivos + bajas;
  return { vivos, bajas, total, tasa: total ? vivos / total : null };
}

export const pct = (x: number | null, locale = 'es-MX'): string =>
  x == null ? '—' : `${(x * 100).toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;
