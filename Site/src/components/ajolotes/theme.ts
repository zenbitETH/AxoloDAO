// Re-export the waterQuality theme primitives + add ajolote-specific helpers.
// The species accent palette (light + dark) already lives there; this module
// only adds gender symbol resolution and a SpeciesCode-aware accent wrapper.

import { accentForTheme, useTheme } from '../waterQuality/theme';
import type { ThemeMode } from '../waterQuality/theme';
import { speciesToWq } from './types';
import type { SpeciesCode } from './types';

export { useTheme, accentForTheme };
export type { ThemeMode };

export function accent(species: SpeciesCode | string | null | undefined, theme: ThemeMode): string {
  return accentForTheme(speciesToWq(species), theme);
}

// Group ejemplares by station — AM is unified into a single station with N peceras.
export function stationOf(pecera: string | null | undefined): 'AA' | 'AM' | 'AD' | 'Larvario' {
  if (!pecera || pecera === 'NA') return 'Larvario';
  const alpha = (pecera.match(/^[A-Z]+/) || [''])[0];
  if (alpha === 'AM') return 'AM';
  if (alpha === 'AA') return 'AA';
  if (alpha === 'AD') return 'AD';
  return 'Larvario';
}

export const STATION_ORDER: ReadonlyArray<'AA' | 'AM' | 'AD' | 'Larvario'> = [
  'AA', 'AM', 'AD', 'Larvario',
];
export const SPECIES_ORDER: ReadonlyArray<SpeciesCode> = [
  'A. andersoni', 'A. mexicanum', 'A. dumerilii',
];

// Always render unknown gender as "(?)" — the bare "?" form was rejected.
export type GenderSymbol = '♀' | '♂' | '(?)';
export function genderSymbol(g: string | null | undefined): GenderSymbol {
  if (!g) return '(?)';
  const s = String(g).toLowerCase();
  if (s.startsWith('hembra') || s === 'h' || s === 'f') return '♀'; // ♀
  if (s.startsWith('macho') || s === 'm') return '♂';               // ♂
  return '(?)';
}

// Tone derived from the leading emoji of an operativo status string.
// ✅/🟢 → ok · 🟡/🟠/⚠️ → warn · 🔴/❌ → alarm · else muted.
export type StatusTone = 'ok' | 'warn' | 'alarm' | 'muted';
export interface ParsedStatus {
  tone: StatusTone;
  label: string;
}
export function parseEmojiStatus(s: string | null | undefined): ParsedStatus {
  if (!s) return { tone: 'muted', label: '—' };
  const str = String(s).trim();
  if (!str) return { tone: 'muted', label: '—' };
  // Strip leading emoji + whitespace
  const stripped = str
    .replace(/^[✅⚠\u{1F7E0}-\u{1F7E6}\u{1F534}\u{2192}❌]+\s*/u, '')
    .trim();
  const label = stripped || str;
  if (/✅|\u{1F7E2}/u.test(str) || /ESTABLE|NORMAL/i.test(str)) return { tone: 'ok', label };
  if (/⚠|\u{1F7E1}|\u{1F7E0}/u.test(str) || /VIGILANCIA|ATENCION/i.test(str)) return { tone: 'warn', label };
  if (/\u{1F534}|❌/u.test(str) || /CRITIC|ALERTA/i.test(str)) return { tone: 'alarm', label };
  return { tone: 'muted', label };
}

// Unified day-name normalizer — the operativo uses Spanish weekday names,
// often without diacritics. Returns the 3-letter Spanish key used by the UI.
export type DayKey = 'Lun' | 'Mar' | 'Mie' | 'Jue' | 'Vie' | 'Sab' | 'Dom';
export const DAY_ORDER: ReadonlyArray<DayKey> = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const DAY_MAP: Record<string, DayKey> = {
  'lunes': 'Lun', 'martes': 'Mar', 'miercoles': 'Mie', 'miércoles': 'Mie',
  'jueves': 'Jue', 'viernes': 'Vie', 'sábado': 'Sab', 'sabado': 'Sab', 'domingo': 'Dom',
};
export function parseDays(frecuencia: string | null | undefined): DayKey[] {
  if (!frecuencia) return [];
  return frecuencia
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .map((d) => DAY_MAP[d] ?? (d.slice(0, 3).charAt(0).toUpperCase() + d.slice(1, 3)) as DayKey)
    .filter((d) => DAY_ORDER.includes(d));
}
