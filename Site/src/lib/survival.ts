// Tasa de supervivencia: ejemplares vivos entre los ejemplares registrados desde la apertura del
// Museo de Ajolotes Xolotlcalli (vivos + bajas con fecha igual o posterior a la apertura, o sin fecha).
// One helper for every page that shows it, so the Xolotlcalli page, the registry cover and the
// Bajas wall agree. Deaths are counted one by one (grouped larvae count individually), from the
// same bundle the wall reads: the Bajas rows plus deceased snapshots the sheet has not recorded.
// Withheld (embargoed) records are already out of the bundle, as in every public count.

import { BAJA_FECHA_FIX } from '../components/ajolotes/memorial';
import closure from '../data/closure.json';
import { contarSupervivencia } from './survival-core.mjs';

// The period the rate describes: the opening day to the closing day (closure.json, the one date the site uses for «al cierre»).
export const OPENING = '2025-10-24';
export const CLOSED_ON: string = closure.closedOn;

const MESES_CORTOS: Record<string, string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
};
const corta = (iso: string, locale: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${(MESES_CORTOS[locale] ?? MESES_CORTOS.es)[m - 1]} ${y}`;
};
/** «24 oct 2025 – 22 sep 2026»: next to every survival figure, so the figure says what it covers. */
export const periodoDeSupervivencia = (locale = 'es'): string => `${corta(OPENING, locale)} – ${corta(CLOSED_ON, locale)}`;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const fechaLarga = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
};

interface BundleLike {
  ejemplares: unknown[];
  bajas: { nombre?: string | null; fecha?: string | null }[];
  bajasSnapshots?: { alias?: string | null; fecha?: string | null }[];
}

export interface Survival {
  vivos: number;
  bajas: number;
  total: number;
  tasa: number | null;      // 0..1
  /** The dates of the deaths in the count (null: undated), so a test can see that every one falls inside the period. */
  fechas: (string | null)[];
}

// The count itself lives in survival-core.mjs (plain JS, so a test can run it): see there who counts.
export function survival(bundle: BundleLike, since: string = OPENING, until: string = CLOSED_ON): Survival {
  return contarSupervivencia(bundle, { since, until, fixes: BAJA_FECHA_FIX });
}

export const pct = (x: number | null, locale = 'es-MX'): string =>
  x == null ? '—' : `${(x * 100).toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;
