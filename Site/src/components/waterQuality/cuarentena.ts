import type { Ejemplar } from '../ajolotes/types';

export interface CuarentenaResident {
  alias: string;
  homeTankId: string;
}

// bundle.json's `pecera` field only carries the *current* location of each
// specimen, not where it normally lives. When a specimen is in cuarentena its
// home tank typically has no water sampling for the week, leaving that column
// blank in the dashboard. This map gives the empty column a name so we can
// drop a "Sin medición esta semana" card over it.
//
// Extend when a new specimen rotates into cuarentena. The species → tank
// pairing (A. andersoni → AA, A. dumerilii → AD, A. mexicanum → AM*) makes the
// mapping easy to verify.
const HOME_TANK_BY_ALIAS: Record<string, string> = {
  Panchita: 'AA',
  Rómulo: 'AD',
};

export function residentsInCuarentena(ejemplares: Ejemplar[]): CuarentenaResident[] {
  const out: CuarentenaResident[] = [];
  for (const e of ejemplares) {
    if (e.pecera !== 'Cuarentena') continue;
    const homeTankId = HOME_TANK_BY_ALIAS[e.alias];
    if (!homeTankId) continue;
    out.push({ alias: e.alias, homeTankId });
  }
  return out;
}
