import type { AtlasText } from '@/lib/atlasText';
import { agruparCapas, CLAVE_DE_GRUPO } from '@/lib/atlasGroups.mjs';
import type { UiText } from './uiText';
import type { CardLayer, Ciclo, Colorear, Status } from './types';
import { InfoCapa } from './InfoCapa';

export const ICONOS: Record<string, string> = {
  especies: 'M12 9a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM7.5 9.5 5 6M12 8.5V4M16.5 9.5 19 6',
};
/** The cards the HUD does not list: richness, the state boundaries and rivers and lakes live in the species list; the areas of the species are always drawn; the CONABIO water sites (2013) are hidden. A group left with no card (Water, Context) is not drawn. */
const SIN_TARJETA = new Set(['especies-por-estado', 'localidades-especies', 'limites-admin1', 'rios-lagos', 'sitios-conagua-2013']);

interface Props {
  cards: CardLayer[];
  text: AtlasText;
  ui: UiText;
  colorear: Colorear;
  visible: Record<string, boolean>;
  status: Record<string, Status>;
  ncEnabled: boolean;
  kiosko: boolean;
  metrics: { id: string; title: string }[];
  metric: string;
  orgsNote: string;
  freshness: preact.ComponentChildren;
  /** the full-cycle organization card: null while its flag is off (it is off) */
  ciclo: Ciclo | null;
  /** the chips that filter the facilities by type and by legal figure (inside the facilities card) */
  instFiltros?: preact.ComponentChildren;
  onColorear: (c: Colorear) => void;
  onToggle: (id: string) => void;
  onMetric: (id: string) => void;
}

/** The title of the Instalaciones tab (the group's own name, from the layer cards' text). */
export const tituloInstalaciones = (text: AtlasText) => (text as any)[CLAVE_DE_GRUPO.instalaciones as keyof typeof text] ?? 'instalaciones';

/** The body of the Instalaciones tab of the panel: the cards of that group, each a switch with its note and its data. (The rail of icon buttons is gone: Especies and Instalaciones are tabs of the panel.) */
export function Hud(p: Props) {
  const groups = (agruparCapas(p.cards.filter((c) => !SIN_TARJETA.has(c.id))) as { grupo: string; capas: CardLayer[] }[]);
  const grupo = groups.find((g) => g.grupo === 'instalaciones');
  const meta = (c: CardLayer) => (
    <details class="at-more" onClick={(e) => e.stopPropagation()}>
      <summary>{p.ui.moreAbout}</summary>
      <dl>
        <dt>{p.text.source}</dt><dd>{c.source}</dd>
        <dt>{p.text.licence}</dt><dd>{c.licenceLabel}</dd>
        {c.lastDataText && <><dt>{p.text.lastData}</dt><dd>{c.lastDataText}</dd></>}
        {c.retrievedAt && <><dt>{p.text.retrieved}</dt><dd><time datetime={c.retrievedAt}>{c.retrievedAt}</time></dd></>}
        <dt>{p.text.noDownload}</dt><dd />
      </dl>
    </details>
  );

  const option = (c: CardLayer, checked: boolean, onChange: () => void, extra?: preact.ComponentChildren) => {
    // an NC layer is off in kiosk mode and wherever the flag is off; in the public atlas it can be switched on, with its attribution
    const apagada = c.flag === 'nc' && !p.ncEnabled;
    const note = apagada ? (p.kiosko ? p.text.flagOffKiosk : `${c.licenceLabel}: ${p.ui.offHere}.`) : c.id === 'organizaciones-registradas' ? p.orgsNote : c.note;
    // the text of the cataloged-facilities layer lives in an info button next to its name, not in the row
    const enInfo = c.id === 'instalaciones-catalogadas' && !apagada;
    return (
      <label class="at-opt" for={`capa-${c.id}`} data-layer={c.id} data-flag={c.flag ?? ''} data-download="false" aria-disabled={apagada ? 'true' : undefined}>
        <input id={`capa-${c.id}`} type="checkbox" value={c.id} checked={checked && !apagada} disabled={apagada} onChange={onChange} />
        <span>
          <span class="at-t">{c.title}{enInfo && <InfoCapa id={c.id} etiqueta={p.ui.infoCapa}><span>{note}</span><span data-aviso>{c.aviso}</span></InfoCapa>}</span>
          {!enInfo && <small>{note}</small>}
          {!enInfo && c.aviso && <small data-aviso>{c.aviso}</small>}
          {p.status[c.id] === 'loading' && <small>{p.text.loading}</small>}
          {p.status[c.id] === 'error' && <small>{p.text.failed}</small>}
          {c.id === 'organizaciones-registradas' && p.freshness}
          {extra}
          {meta(c)}
        </span>
      </label>
    );
  };

  const cuerpo = (g: { grupo: string; capas: CardLayer[] }) => g.capas.map((c) => {
    if (c.kind === 'choropleth') {
      return option(c, p.colorear === 'metrica', () => p.onColorear(p.colorear === 'metrica' ? 'ninguno' : 'metrica'),
        c.id === 'metrica-estatal' && p.colorear === 'metrica' && (
          <select aria-label={p.text.metric} value={p.metric} onClick={(e) => e.stopPropagation()} onChange={(e) => p.onMetric((e.target as HTMLSelectElement).value)}>
            {p.metrics.map((m) => <option value={m.id}>{m.title}</option>)}
          </select>
        ));
    }
    return option(c, !!p.visible[c.id], () => p.onToggle(c.id), c.id === 'instalaciones-catalogadas' && p.visible[c.id] ? p.instFiltros : undefined);
  });

  const t = p.ui;
  return (
    <div class="at-inst" data-inst-body role="group" aria-label={tituloInstalaciones(p.text)}>
      {grupo ? cuerpo(grupo) : null}
      {p.ciclo && (
        <article class="at-ciclo" data-ciclo-card>
          <h4>{t.cicloTitulo}</h4>
          <p class="at-ciclo-n"><b>{p.ciclo.nombre}</b> <span class="at-ciclo-b">{t.cicloPiloto}</span> <span class="at-ciclo-b" data-ciclo-estado>{t.cicloEstado}</span></p>
          <dl>
            <dt>{p.text.municipality}</dt><dd>{p.ciclo.municipio}, {p.ciclo.estado}</dd>
            <dt>{p.text.facility}</dt><dd>{p.ciclo.tipo}</dd>
            <dt>{t.cicloRegistro}</dt><dd><time datetime={p.ciclo.registro}>{p.ciclo.registro}</time></dd>
            <dt>{t.cicloCierre}</dt><dd><time datetime={p.ciclo.cierre}>{p.ciclo.cierre}</time></dd>
            <dt>{t.cicloEns}</dt><dd>{p.ciclo.ens}</dd>
          </dl>
          {/^https:\/\//.test(p.ciclo.enlace) && <a href={p.ciclo.enlace} rel="noopener noreferrer" target="_blank">{t.cicloEnlace}</a>}
        </article>
      )}
    </div>
  );
}
