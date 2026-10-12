export interface BundleLike {
  ejemplares: unknown[];
  bajas: { nombre?: string | null; fecha?: string | null }[];
  bajasSnapshots?: { alias?: string | null; fecha?: string | null }[];
}
export function contarSupervivencia(
  bundle: BundleLike,
  opts: { since: string; until: string; fixes?: Record<string, string> },
): { vivos: number; bajas: number; total: number; tasa: number | null; fechas: (string | null)[] };
