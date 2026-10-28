import { IUCN_COLORS } from '@/components/species/strings';
import { fondoMuestra, type Trama } from './muestra';

/** What the map knows of a species: the colour of its range and its texture (the same ones its swatch in the index wears), and its IUCN category. */
export interface InfoEspecie { slug: string; accent: string; trama?: Trama; iucn?: string }
/** The label the index shows for a species, and the only spelling any other surface may use. */
export const etiquetaEspecie = (slug: string) => `A. ${slug}`;

/** The swatch, the italic short name and the status badge of one species, exactly as a row of the index draws them (the same classes, so one stylesheet rule serves both). `extra` goes after the name (the index puts its capability icons there). */
export function MarcaEspecie(p: { e: InfoEspecie; tituloBadge?: string; extra?: preact.ComponentChildren }) {
  const { e } = p;
  return (
    <>
      <i class="at-sw" data-trama={e.trama ?? ''} style={{ background: fondoMuestra(e.accent, e.trama) }} />
      <span class="at-nc"><span class="at-nm" title={etiquetaEspecie(e.slug)}>{etiquetaEspecie(e.slug)}</span>{p.extra}</span>
      {e.iucn ? <span class="at-ib" style={{ color: IUCN_COLORS[e.iucn] }} title={p.tituloBadge ? `${p.tituloBadge} ${e.iucn}` : e.iucn}>{e.iucn}</span> : <span />}
    </>
  );
}

/** A species as a chip: the index's own row, sized to its content, and a button that opens the species' drawer. */
export function ChipEspecie(p: { e: InfoEspecie; onPick: (slug: string) => void; tituloBadge?: string }) {
  return (
    <button type="button" class="at-srow at-spchip" data-species-chip={p.e.slug} data-accent={p.e.accent} style={{ color: p.e.accent }} onClick={() => p.onPick(p.e.slug)}>
      <MarcaEspecie e={p.e} tituloBadge={p.tituloBadge} />
    </button>
  );
}

/** A species named in the text but not in the atlas, and not a synonym of one: plain italic text, no colour. */
export function NombreSinMapa(p: { texto: string }) { return <span class="at-sp-sinmapa" data-species-plain>{p.texto}</span>; }

/** The same, without the click: for a place that is already a link (a clip tile) or only names the species (the water systems). */
export function EtiquetaEspecie(p: { e: InfoEspecie; tituloBadge?: string }) {
  return <span class="at-srow at-spchip at-spstatic" data-species-label={p.e.slug} style={{ color: p.e.accent }}><MarcaEspecie e={p.e} tituloBadge={p.tituloBadge} /></span>;
}
