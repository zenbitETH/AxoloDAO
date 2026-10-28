import type { UiText } from './uiText';
import type { Ficha } from './types';

/** What a species can do, read from the bundle's grid traits (life_form, regeneration): never a list kept by hand. */
export interface Capacidades {
  /** obligate neoteny: keeps its gills as an adult */
  neotenia: boolean;
  /** facultative neoteny (and not also recorded as metamorphic): may transform or keep its gills */
  facultativa: boolean;
  /** can metamorphose: metamorphic or facultative */
  metamorfosis: boolean;
  /** limb regeneration documented */
  regeneracion: boolean;
}

export function capacidades(f: Ficha | null | undefined): Capacidades {
  const v = f?.lifeForm ? Object.keys(f.lifeForm.values) : [];
  const obligada = v.includes('obligate_paedomorph'), facultativa = v.includes('facultative_paedomorph'), metamorfica = v.includes('metamorphic');
  // a species whose sources disagree (facultative in one, metamorphic in another) is read as metamorphic: the cycle icon only
  return { neotenia: obligada, facultativa: facultativa && !metamorfica, metamorfosis: metamorfica || facultativa, regeneracion: !!f?.regeneration };
}

// three glyphs, drawn inline (the site has no icon library): gills (three small fronds), a cycle, sparkles
const BRANQUIAS = 'M12 20v-5M12 15C8.5 14 6 11.5 5.5 7.5M12 15V4M12 15c3.5-1 6-3.5 6.5-7.5M7.8 11.2 5.5 12M16.2 11.2 18.5 12M12 9.5 9.8 8M12 9.5 14.2 8';
const CICLO = 'M5 12a7 7 0 0 1 12-4.5M19 12a7 7 0 0 1-12 4.5M17 4v4h-4M7 20v-4h4';
const DESTELLOS = 'M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7zM18.5 14l.8 2.2L21.5 17l-2.2.8-.8 2.2-.8-2.2L15.5 17l2.2-.8z';

const Glifo = ({ d, relleno }: { d: string; relleno?: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class={relleno ? 'at-fill' : undefined}><path d={d} /></svg>
);

/** The capability icons of a species, after its name in the list. Each carries its own tooltip line; a facultative species carries the gill and the cycle. */
export function CapIcons({ c, ui }: { c: Capacidades; ui: UiText }) {
  const items: { id: string; d: string; tip: string; relleno?: boolean }[] = [];
  if (c.neotenia) items.push({ id: 'neotenia', d: BRANQUIAS, tip: ui.capNeotenyTip });
  if (c.facultativa) items.push({ id: 'facultativa', d: BRANQUIAS, tip: ui.capFacultativeTip });
  if (c.metamorfosis) items.push({ id: 'metamorfosis', d: CICLO, tip: ui.capMetaTip });
  if (c.regeneracion) items.push({ id: 'regeneracion', d: DESTELLOS, tip: ui.capRegenTip, relleno: true });
  if (!items.length) return null;
  return (
    <span class="at-caps">
      {items.map((i) => <span class="at-cap" role="img" data-cap={i.id} title={i.tip} aria-label={i.tip}><Glifo d={i.d} relleno={i.relleno} /></span>)}
    </span>
  );
}

/** The key of the three glyphs, compact and inline: it sits on the right of the sort toggle of the species list */
export function CapLegend({ ui }: { ui: UiText }) {
  return (
    <div class="at-capkey" data-cap-legend>
      <span class="at-cap"><Glifo d={BRANQUIAS} /></span><span>{ui.legendCapNeoteny}</span>
      <span class="at-cap"><Glifo d={CICLO} /></span><span>{ui.legendCapMeta}</span>
      <span class="at-cap"><Glifo d={DESTELLOS} relleno /></span><span>{ui.legendCapRegen}</span>
    </div>
  );
}
