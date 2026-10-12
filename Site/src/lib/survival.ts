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
// The count ends three days after the closing day: a death on 23 September 2026 happened with the animals in the museum's custody, and the
// figure includes it (founder's ruling, 12-oct-2026; the one figure every page and the platform show). The closing day stays CLOSED_ON.
export const FIN_DE_LA_CUENTA = '2026-09-25';

const MESES_CORTOS: Record<string, string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
};
const corta = (iso: string, locale: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${(MESES_CORTOS[locale] ?? MESES_CORTOS.es)[m - 1]} ${y}`;
};
/** «24 oct 2025 – 25 sep 2026»: next to every survival figure, so the figure says what it covers. */
export const periodoDeSupervivencia = (locale = 'es'): string => `${corta(OPENING, locale)} – ${corta(FIN_DE_LA_CUENTA, locale)}`;
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
export function survival(bundle: BundleLike, since: string = OPENING, until: string = FIN_DE_LA_CUENTA): Survival {
  return contarSupervivencia(bundle, { since, until, fixes: BAJA_FECHA_FIX });
}

/** El método y el corte de la cifra, junto a ella: la única tasa que se publica. El nombre del museo no se traduce. */
const NOTAS_DE_SUPERVIVENCIA: Record<string, string> = {
  es:
    'Supervivencia del 24 de octubre de 2025, día de la apertura, al 25 de septiembre de 2026: proporción de ejemplares vivos entre los incluidos en el registro del museo.',
  en:
    'Survival from 24 October 2025, opening day, to 25 September 2026: share of specimens alive among those in the museum\'s register.',
  pt:
    'Sobrevivência de 24 de outubro de 2025, dia da abertura, a 25 de setembro de 2026: proporção de exemplares vivos entre os incluídos no registro do museu.',
};
export const notaDeSupervivencia = (locale = 'es'): string => NOTAS_DE_SUPERVIVENCIA[locale] ?? NOTAS_DE_SUPERVIVENCIA.es;
export const NOTA_DE_SUPERVIVENCIA = NOTAS_DE_SUPERVIVENCIA.es;

export const pct = (x: number | null, locale = 'es-MX'): string =>
  x == null ? '—' : `${(x * 100).toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;
