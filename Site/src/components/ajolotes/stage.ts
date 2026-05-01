// Life-stage classifier. Prefers the curated `estadio` field from the
// operativo workbook (which encodes maturity, not just length — e.g. Tascalate
// at 16.6 cm is logged as "Adulto neoteno"), and falls back to LT bands when
// the field is missing.

export type Stage = 'larva' | 'juvenil' | 'subadulto' | 'adulto' | 'unknown';

// LT bands (cm), per the operativo team's spec:
//   larva     ≤ 5 cm    (1.5 – 3 months)
//   juvenil   5 – 12 cm  (2 – 6 months)
//   subadulto 12 – 18 cm (6 – 18 months)
//   adulto    ≥ 18 cm    (12+ months)
export const STAGE_LT_BAND: Record<Exclude<Stage, 'unknown'>, [number, number]> = {
  larva:     [0,  5],
  juvenil:   [5,  12],
  subadulto: [12, 18],
  adulto:    [18, 40],
};

export function classifyStage(
  lt: number | null | undefined,
  estadio: string | null | undefined,
): Stage {
  // 1. Prefer the curated `estadio` field
  if (estadio && estadio.trim()) {
    const x = estadio.toLowerCase();
    if (/larva|cr[ií]a/.test(x))   return 'larva';
    if (/juven/.test(x))           return 'juvenil';
    if (/sub.?adult/.test(x))      return 'subadulto';
    if (/adult/.test(x))           return 'adulto';
  }
  // 2. Fall back to LT bands
  if (lt == null || Number.isNaN(lt)) return 'unknown';
  if (lt < 5)  return 'larva';
  if (lt < 12) return 'juvenil';
  if (lt < 18) return 'subadulto';
  return 'adulto';
}
