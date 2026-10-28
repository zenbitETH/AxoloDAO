import { IUCN_COLORS, IUCN_LABELS } from '@/components/species/strings';
import { ESCALA_NOM, ESCALA_UICN, GRUPOS_UICN, colorDeTexto, estadoNom, estadoUicn } from '@/lib/estatusEscala.mjs';
import type { UiText } from './uiText';

/** NOM-059 reads in the same status tokens as the index badges, never a second palette: P like critically endangered, A like endangered, Pr like vulnerable, E like extinct. */
const COLOR_NOM: Record<string, string> = { E: IUCN_COLORS.EX, P: IUCN_COLORS.CR, A: IUCN_COLORS.EN, Pr: IUCN_COLORS.VU };

/** One connected segmented bar: equal segments, rounded only at the outer ends, the active one filled in its status colour and a little taller; the others muted with their code in small caps. Decorative: the row's label carries the category. */
const Barra = (p: { codigos: readonly string[]; llena: string | null; color: (c: string) => string }) => (
  <div class="at-ebar" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${p.codigos.length}, 1fr)` }}>
    {p.codigos.map((c) => <span class="at-eseg" data-cat={c} data-llena={p.llena === c ? '1' : '0'} style={p.llena === c ? { background: p.color(c), borderColor: p.color(c), color: colorDeTexto(p.color(c)) } : undefined}>{c}</span>)}
  </div>
);
/** The small «fuente» link of a row; the rows of one block all say «fuente», so each link is named by its system for a screen reader («fuente: UICN»). */
const Fuente = (p: { ui: UiText; sistema: string; fuente: { titulo: string; url: string | null } | null }) => !p.fuente ? <span /> : p.fuente.url
  ? <a class="at-efte" href={p.fuente.url} target="_blank" rel="noopener noreferrer" title={p.fuente.titulo} aria-label={`${p.ui.sourceShort}: ${p.sistema}`}>{p.ui.sourceShort}</a>
  : <span class="at-efte" title={p.fuente.titulo}>{p.ui.sourceShort}</span>;

/** The conservation status of a species as ONE block: a row per system (IUCN, NOM-059 for the species that live in Mexico, CITES), each with its label on the left, its bar, its full name on one line and a small «fuente» link at the right end. */
export function EstadoConservacion(p: {
  uicn: { categoria: string; fuente: { titulo: string; url: string | null } | null } | null;
  nom: { categorias: any[]; fuente: { titulo: string; url: string | null } | null } | null;
  cites: { valor: string; fuente: { titulo: string; url: string | null } | null } | null;
  nacionales?: { sistema: string; codigos: string[]; fuente: { titulo: string; url: string | null } | null }[];
  ui: UiText; locale: 'es' | 'en' | 'pt';
}) {
  const { ui } = p;
  const u = p.uicn ? estadoUicn(p.uicn.categoria) : null;
  const n = p.nom ? estadoNom(p.nom.categorias) : null;
  const nombreU = p.uicn ? (u!.pildora === 'DD' ? ui.statusDD : u!.pildora === 'NE' ? ui.statusNE : (IUCN_LABELS[p.uicn.categoria]?.[p.locale] ?? p.uicn.categoria)) : '';
  const nombreN = n ? (n.llena ? ui.nomLabels[n.llena] : n.desconocida ? n.desconocida : ui.notListed) : '';
  const nac = p.nacionales ?? [];
  if (!u && !n && !p.cites && !nac.length) return null;
  return (
    <section class="at-estado" data-estado-conservacion aria-label={ui.conservationTitle}>
      <h4>{ui.conservationTitle}</h4>
      {u && p.uicn && (
        <figure class="at-erow" data-escala="uicn" data-llena={u.llena ?? ''} data-pildora={u.pildora ?? ''} aria-label={`${ui.scaleIucn}: ${nombreU}`}>
          <span class="at-elab">{ui.systems.iucn}</span>
          <div class="at-ecuerpo">
            <div class="at-ecaps" aria-hidden="true">
              {GRUPOS_UICN.map((g) => <span class="at-ecap" style={{ gridColumn: `${ESCALA_UICN.indexOf(g.codigos[0]) + 1} / span ${g.codigos.length}` }} data-corchete={g.corchete ? '1' : '0'}>{({ extinta: ui.statusExtinct, amenazada: ui.statusThreatened, menor: ui.statusLeastConcern } as Record<string, string>)[g.clave]}</span>)}
            </div>
            <Barra codigos={ESCALA_UICN} llena={u.llena} color={(c) => IUCN_COLORS[c]} />
            <figcaption class="at-enombre">{u.pildora ? <span class="at-esc-pil" data-pildora-estatus>{nombreU}</span> : <b>{nombreU}</b>}</figcaption>
          </div>
          <Fuente ui={ui} sistema={ui.systems.iucn} fuente={p.uicn.fuente} />
        </figure>
      )}
      {n && p.nom && (
        <figure class="at-erow" data-escala="nom" data-llena={n.llena ?? ''} data-no-listada={n.noListada ? '1' : '0'} aria-label={`${ui.scaleNom}: ${nombreN}`}>
          <span class="at-elab">{ui.systems.nom059}</span>
          <div class="at-ecuerpo">
            <Barra codigos={ESCALA_NOM} llena={n.llena} color={(c) => COLOR_NOM[c]} />
            <figcaption class="at-enombre">{n.llena ? <b>{nombreN}</b> : n.desconocida ? <span class="at-esc-pil" data-nom-desconocida>{nombreN}</span> : <span class="at-esc-pil" data-no-listada-estatus>{nombreN}</span>}{n.notaProyecto && <small class="at-esc-proy" data-proyecto-2025> · {ui.draft2025}: {n.notaProyecto}</small>}</figcaption>
          </div>
          <Fuente ui={ui} sistema={ui.systems.nom059} fuente={p.nom.fuente} />
        </figure>
      )}
      {p.cites && (
        <div class="at-erow at-ecites" data-escala="cites">
          <span class="at-elab">CITES</span>
          <div class="at-ecuerpo"><span class="at-enombre"><b>{p.cites.valor}</b></span></div>
          <Fuente ui={ui} sistema="CITES" fuente={p.cites.fuente} />
        </div>
      )}
      {nac.length > 0 && (
        <div class="at-erow at-enac" data-escala="nacional">
          <span class="at-elab">{ui.nationalStatus}</span>
          <div class="at-ecuerpo"><span class="at-enombre">{nac.map((x) => <span class="at-enac-it" data-sistema={x.sistema}><b>{ui.systems[x.sistema]}: {x.codigos.join(', ')}</b><Fuente ui={ui} sistema={ui.systems[x.sistema]} fuente={x.fuente} /></span>)}</span></div>
          <span />
        </div>
      )}
    </section>
  );
}
