import { claseDeEvidencia } from '@/lib/atlasSpecies.mjs';
import type { UiText } from './uiText';
import type { Item } from './types';

interface Props {
  ui: UiText;
  nombre: string;
  /** the species recorded in the unit, sorted */
  aqui: Item[];
  evidencia: Record<string, Record<string, string>>;
  iso: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** a line under the count (the value of the chosen metric), when there is one */
  valor?: string;
  onPick: (slug: string) => void;
  onFilter: () => void;
  onClose: () => void;
}

const MAXIMO = 9;

export function StatePop(p: Props) {
  const { ui } = p;
  const x = Math.min(Math.max(p.x, 150), Math.max(150, p.ancho - 150));
  return (
    <div class="at-estado-pop" role="dialog" aria-label={p.nombre} data-iso={p.iso} data-up={p.y > p.alto - 260 ? '1' : '0'} style={{ left: `${x}px`, top: `${p.y}px` }}>
      <button type="button" class="at-x" aria-label={ui.stateClose} onClick={p.onClose}>×</button>
      <h3>{p.nombre}</h3>
      <div class="at-n">{p.aqui.length ? `${p.aqui.length} ${p.aqui.length === 1 ? ui.stateSpeciesOne : ui.stateSpeciesMany}` : ui.stateNone}</div>
      {p.valor && <div class="at-n" data-metric>{p.valor}</div>}
      {p.aqui.slice(0, MAXIMO).map((s) => {
        const c = claseDeEvidencia(p.evidencia[s.slug][p.iso]);
        return <button type="button" class="at-sp" data-slug={s.slug} data-weak={c === 'weak' ? '1' : undefined} data-other={c === 'other' ? '1' : undefined} onClick={() => p.onPick(s.slug)}><i class="at-sw" style={{ background: s.accent }} />A. {s.slug}</button>;
      })}
      {p.aqui.length > 0 && <div><button type="button" class="at-act" onClick={p.onFilter}>{p.aqui.length > MAXIMO ? ui.stateSeeAll.replace('{n}', String(p.aqui.length)) : p.iso.startsWith('CA') ? ui.stateFilterCA : ui.stateFilter}</button></div>}
    </div>
  );
}
