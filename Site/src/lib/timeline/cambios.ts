import type { BitacoraEntry } from '../../components/ajolotes/types';

export interface CambioDeAgua {
  date: string;
  tankId: string;              // chart series id this event is being attributed to
  ubicacionReal: string;        // original bitácora ubicación (e.g. "AM 5", "AM larvas")
  accion: string;
  autor: string | null;
}

// The AM tanks (AM, AM 1, AM 2, AM 3, AM 4, AM 5, AM larvas, AM 1 Gral., AM 2 Gral.)
// share one recirculating water system, so a cambio anywhere in this family
// affects every AM-series chart. AA and AD are single tanks with no sub-family.
//
// Cuarentena is deliberately excluded — it runs on isolated water and its
// cambios shouldn't surface on the resident's home-tank chart.
function isAmFamily(id: string | null | undefined): boolean {
  return !!id && id.startsWith('AM');
}

function ubicacionMatchesTank(ubicacion: string | null, tankId: string): boolean {
  if (!ubicacion) return false;
  if (ubicacion === 'Cuarentena') return false;
  if (isAmFamily(tankId)) return isAmFamily(ubicacion);
  return ubicacion === tankId;
}

// Pick out water-change events for a tank (or tank family). Routine and
// emergency changes are both surfaced — the `accion` text preserves the
// distinction in the hover tooltip without needing a separate visual encoding
// on the chart.
export function cambiosDeAguaByTank(
  bitacora: BitacoraEntry[],
  tankId: string,
): CambioDeAgua[] {
  const out: CambioDeAgua[] = [];
  for (const e of bitacora) {
    if (!ubicacionMatchesTank(e.ubicacion, tankId)) continue;
    if (!e.accion || !/cambio de agua/i.test(e.accion)) continue;
    out.push({
      date: e.fecha,
      tankId,
      ubicacionReal: e.ubicacion!,
      accion: e.accion,
      autor: e.autorPrincipal,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}
