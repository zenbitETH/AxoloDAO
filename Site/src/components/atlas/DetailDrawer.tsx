import { useEffect, useRef, useState } from 'preact/hooks';
import { claseDeEvidencia } from '@/lib/atlasSpecies.mjs';
import { HERO_IMAGE_FILE, HERO_FOCUS_X, HERO_FOCUS_Y } from '@/components/species/heroImages';
import CREDITOS from '@/data/creditos-imagenes.json';
import { partesDeCredito } from '@/lib/creditosImagenes.mjs';
import { IUCN_COLORS, IUCN_LABELS } from '@/components/species/strings';
import type { AtlasText } from '@/lib/atlasText';
import { Grip } from './Grip';
import { Silhouette, type Cota } from './Silhouette';
import { estatusNacionales } from '@/lib/estatusEscala.mjs';
import { EstadoConservacion } from './EscalaEstatus';
import { conPais, type UiText } from './uiText';
import type { Alimentacion, Ficha, Fte, Item, Locale, Snap } from './types';

export type Tab = 'resumen' | 'alimentacion' | 'medidas' | 'clips' | 'fuentes';
const TABS: [Tab, keyof UiText][] = [['resumen', 'tabSummary'], ['alimentacion', 'tabFeeding'], ['medidas', 'tabMeasures'], ['fuentes', 'tabSources']];
const TAB_CLIPS: [Tab, keyof UiText] = ['clips', 'tabClips'];

interface Props {
  ui: UiText;
  text: AtlasText;
  locale: Locale;
  item: Item;
  /** { iso: evidence } of the species */
  presencia: Record<string, string>;
  presenciaFilas: [string, string, string?][];
  /** the source of each drawn point: short and full citation, page and corroboration where it was read off a printed map */
  /** the already-public, confirmed clips of the species, from a static snapshot (DEMO build only: empty, and the tab hidden, otherwise) */
  clips: { id: string; credito: string | null; fecha: string | null; poster: string | null }[];
  /** the life-stage labels in es, en and pt (draft/etiquetas-etapa.json) */
  etapas: Record<string, Record<string, string>>;
  fuentesPuntos: { estado: string | null; corta: string; completa: string; licencia?: string | null; sitio: boolean; pagina: number | null; corroborado: string | null }[];
  fuentes: Record<string, any>;
  nombreDe: Record<string, string>;
  ficha: Ficha | null;
  /** the range features of the species (area or lake marker), with their source lines */
  rango: any[];
  extremos: { menor: { slug: string; mm: number; note: string | null; source: string }; mayor: { slug: string; mm: number; note: string | null; source: string }; n: number } | null;
  porSlug: Record<string, Item>;
  /** the text colour on the active tab: whichever ink gives AA on the species colour */
  tinta: string;
  nInstalaciones: number;
  speciesPathBase: string;
  tab: Tab;
  snap: Snap;
  phone: boolean;
  expandida: boolean;
  onTab: (t: Tab) => void;
  onSnap: (s: Snap) => void;
  onExpand: () => void;
  onClose: () => void;
}

// one 24 px stroke icon per cell (own drawings; nothing is taken from another icon set)
const ICONO: Record<string, string> = {
  iucn: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z',
  national: 'M6 21V4M6 5h11l-2 4 2 4H6',
  cites: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  habitat: 'M3 9c3-3 5 3 9 0s6 3 9 0M3 15c3-3 5 3 9 0s6 3 9 0',
  altitude: 'M3 19l6-10 4 6 3-4 5 8z',
  endemism: 'M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10zM12 8.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  lifeform: 'M14 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0zM8 12C6 9 4 15 2 12M13 9.5 15 7M14 12h3.5M13 14.5 15 17',
  metamorphosis: 'M5 12a7 7 0 0 1 12-4.5M19 12a7 7 0 0 1-12 4.5M17 4v4h-4M7 20v-4h4',
  regeneration: 'M12 21V10M12 10c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2-5-6-5 0 3 2 5 6 5z',
  exsitu: 'M4 9h16v11H4zM4 9l2-4h12l2 4M8 14h8',
  threat: 'M12 4l9 16H3zM12 10v5M12 17.2v.3',
};

interface Celda { id: string; label: string; value: string | null; color?: string; detail?: string | null; source?: string | null; muted?: boolean; sample?: boolean }

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function DetailDrawer(p: Props) {
  const { ui, item: it } = p;
  const cerrar = useRef<HTMLButtonElement>(null);
  const [fija, setFija] = useState<string | null>(null);        // the cell pinned open by a tap or a click
  const [asoma, setAsoma] = useState<string | null>(null);      // the cell under the pointer
  const [paises, setPaises] = useState<Record<string, boolean>>({});
  useEffect(() => { setFija(null); setAsoma(null); setPaises({}); }, [it.slug, p.tab]);
  useEffect(() => { cerrar.current?.focus({ preventScroll: true }); }, [it.slug]);

  const t = it.t;
  const hero = HERO_IMAGE_FILE[it.slug];
  const credito = (CREDITOS as Record<string, { credito: string; etiqueta: string; autor: string; url: string | null }>)[it.slug];
  const fuenteDe = (k?: string | null) => (k ? p.fuentes[k]?.title ?? k : null);
  const sinDato = p.text.noData;

  // -- E1: presence as chips in the header, by country; a country with many states folds them behind its chip
  const filas = Object.entries(p.presencia);
  const total = filas.length;
  const cabecera = (['MX', 'US', 'CA'] as const).map((pais) => {
    const r = filas.filter(([i]) => i.startsWith(pais));
    if (!r.length) return null;
    const plegable = total > 6;
    const abierto = !plegable || !!paises[pais];
    return (
      <div class="at-pgrp" data-country={pais}>
        {plegable
          ? <button type="button" class="at-pchip at-pcountry" aria-expanded={abierto ? 'true' : 'false'} aria-label={conPais(ui, p.locale, ui.presenceOf, [pais])} onClick={() => setPaises({ ...paises, [pais]: !paises[pais] })}>{ui.countries[pais]} <b>{r.length}</b><i aria-hidden="true" /></button>
          : <span class="at-pchip at-pcountry">{ui.countries[pais]}</span>}
        {abierto && r.map(([iso, ev]) => { const c = claseDeEvidencia(ev); return <span class="at-pchip" data-weak={c === 'weak' ? '1' : undefined} data-other={c === 'other' ? '1' : undefined} title={ui.evidence[ev]}>{p.nombreDe[iso]}</span>; })}
      </div>
    );
  });

  // -- E4: the 12-cell grid, from Site & Data's bundle. Every cell has an icon, «sin dato» when nothing is cited, and a detail with its sources on hover, focus or tap.
  const f = p.ficha;
  const cita = (x: Fte) => `${x.cite}${x.page ? `, ${ui.detailPage} ${x.page}` : ''}`;
  const citas = (xs: Fte[]) => [...new Set(xs.map(cita))].join(' · ') || null;
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const iucn = t.categories.find((c: any) => c.system === 'iucn' && c.scope === 'global');
  // life form: the bundle's values (obligate or facultative paedomorph, metamorphic); two values from two sources are a conflict, shown as such
  const formas = f?.lifeForm ? Object.keys(f.lifeForm.values) : [];
  const nombreForma = (v: string) => (v === 'obligate_paedomorph' ? ui.valueNeotenyObligate : v === 'facultative_paedomorph' ? ui.valueNeotenyFacultative : ui.valueMetamorphic);
  const metaDe = (v: string) => (v === 'obligate_paedomorph' ? ui.valueMetaNo : v === 'facultative_paedomorph' ? ui.valueMetaPart : ui.valueYes);
  const formaCita = f?.lifeForm ? formas.map((v) => `${nombreForma(v)}: ${citas(f.lifeForm!.values[v])}`).join(' / ') : null;
  // habitat, threat, prey-group and stage labels come with the bundle in es, en and pt (draft/etiquetas-*.json, grupos-presa.json)
  const traducir = (x: { code: string; label: any }) => x.label?.[p.locale] ?? null;
  const habEt = traducir, amEt = traducir;
  const nombreGrupo = (g: { key: number; name: any }) => g.name?.[p.locale] ?? g.name?.es ?? '';
  const etapa = (k: string | undefined) => (k ? p.etapas[k]?.[p.locale] ?? '' : '');
  const etiquetas = (xs: { code: string; label: any }[], tr: (x: { code: string; label: any }) => string | null) => xs.map((x) => (tr(x) ? `${x.code} ${tr(x)}` : x.code)).join('; ');
  const muestraLista = (xs: { code: string; label: any }[], tr: (x: { code: string; label: any }) => string | null) => (xs.length ? `${cap(tr(xs[0]) ?? xs[0].code)}${xs.length > 1 ? ` +${xs.length - 1}` : ''}` : null);
  const el = f?.elevation?.items ?? [];
  const eMin = el.map((i) => i.min).filter((x): x is number => x !== null), eMax = el.map((i) => i.max).filter((x): x is number => x !== null);
  const altValor = el.length ? (eMin.length && eMax.length ? (Math.min(...eMin) === Math.max(...eMax) ? `${Math.min(...eMin)} m` : `${Math.min(...eMin)}–${Math.max(...eMax)} m`) : eMin.length ? `${ui.elevFrom} ${Math.min(...eMin)} m` : `${ui.elevTo} ${Math.max(...eMax)} m`) : null;
  // the conservation status block (IUCN, NOM-059 for the species that live in Mexico, CITES): one block, each row with its label, its bar and a small «fuente» link
  const enlaceFuente = (key?: string | null) => { const fu = key ? p.fuentes[key] : null; if (!fu) return null; return { titulo: String(fu.title ?? key), url: (fu.url ?? fu.citation?.match(/https?:\/\/[^\s)]+/)?.[0] ?? null) as string | null }; };
  const nomCat = t.categories.find((c: any) => c.system === 'nom059');
  const estado = (
    <EstadoConservacion locale={p.locale as 'es' | 'en' | 'pt'} ui={ui}
      uicn={iucn ? { categoria: iucn.category, fuente: enlaceFuente(iucn.source) } : null}
      nom={it.countries.includes('MX') ? { categorias: t.categories, fuente: nomCat ? enlaceFuente(nomCat.source) : null } : null}
      nacionales={estatusNacionales(t.categories).map((x: any) => ({ sistema: x.sistema, codigos: x.codigos, fuente: enlaceFuente(x.fuente) }))}
      cites={f?.cites ? { valor: f.cites.value === 'none' ? ui.citesNone : ui.citesAppendix.replace('{n}', f.cites.value), fuente: f.cites.src ? { titulo: cita(f.cites.src), url: null } : null } : null} />
  );
  const celdas: { titulo: string; celdas: Celda[] }[] = [
    { titulo: ui.gridWhere, celdas: [
      { id: 'habitat', label: ui.cellHabitat, value: muestraLista(f?.habitat ?? [], habEt), detail: f?.habitat?.length ? `${ui.habitatCodes}: ${etiquetas(f.habitat, habEt)}` : null, source: f?.habitat?.length ? citas(f.habitat.flatMap((h) => h.src)) : null },
      { id: 'altitude', label: ui.cellElevation, value: altValor, detail: el.map((i) => `${i.min ?? ''}–${i.max ?? ''} m (${i.src.cite})`).join(' · ') || null, source: el.length ? citas(el.map((i) => i.src)) : null },
      { id: 'endemism', label: ui.cellEndemism, value: it.countries.length === 1 ? conPais(ui, p.locale, ui.valueEndemicOf, it.countries) : ui.valueInCountries.replace('{n}', String(it.countries.length)), detail: conPais(ui, p.locale, it.countries.length === 1 ? ui.endemicOnly : ui.notEndemicIn, (['MX', 'US', 'CA'] as const).filter((c) => it.countries.includes(c))), source: ui.srcRange },
    ] },
    { titulo: ui.gridBiology, celdas: [
      { id: 'lifeform', label: ui.cellLifeForm, value: formas.length ? (formas.length > 1 ? ui.valueConflict : nombreForma(formas[0])) : null, detail: formaCita, source: formaCita },
      { id: 'metamorphosis', label: ui.cellMetamorphosis, value: formas.length ? (formas.length > 1 ? ui.valueYes : metaDe(formas[0])) : null, detail: formaCita, source: formaCita },
      { id: 'regeneration', label: ui.cellRegeneration, value: f ? (f.regeneration ? ui.valueDocumented : ui.valueUnstudied) : null, muted: !f?.regeneration, detail: f?.regeneration ? citas(f.regeneration.src) : null, source: f?.regeneration ? citas(f.regeneration.src) : null },
    ] },
    { titulo: ui.gridConservation, celdas: [
      { id: 'exsitu', label: ui.cellExSitu, value: p.nInstalaciones ? plural(p.nInstalaciones, ui.facilitiesOne, ui.facilitiesMany) : null, source: p.nInstalaciones ? ui.facilitiesMany : null },
      { id: 'threat', label: ui.cellThreat, value: muestraLista(f?.threat ?? [], amEt), detail: f?.threat?.length ? `${ui.threatCode}: ${etiquetas(f.threat, amEt)}` : null, source: f?.threat?.length ? citas(f.threat.flatMap((h) => h.src)) : null },
    ] },
  ];

  const celda = (c: Celda, col: number) => {
    const abierta = (fija ?? asoma) === c.id;
    const hay = c.value !== null;
    return (
      <div class="at-cellw" data-col={col}>
        <button type="button" class="at-cell" data-cell={c.id} data-nodata={hay ? undefined : '1'} aria-expanded={abierta ? 'true' : 'false'} aria-describedby={abierta ? `det-${c.id}` : undefined}
          onClick={() => setFija(fija === c.id ? null : c.id)} onMouseEnter={() => setAsoma(c.id)} onMouseLeave={() => setAsoma(null)} onFocus={() => setAsoma(c.id)} onBlur={() => setAsoma(null)}
          onKeyDown={(e) => { if (e.key === 'Escape' && (fija || asoma)) { e.stopPropagation(); setFija(null); setAsoma(null); } }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONO[c.id]} /></svg>
          <span class="at-cl">{c.label}</span>
          <span class="at-cv" data-muted={c.muted || !hay ? '1' : undefined} style={c.color ? { color: c.color } : undefined}>{hay ? c.value : sinDato}</span>
        </button>
        {abierta && (
          <div class="at-celldet" role="tooltip" id={`det-${c.id}`} data-cell-detail={c.id}>
            <b>{c.label}</b>
            <p>{hay ? (c.detail ?? c.value) : sinDato}</p>
            {c.source && <small>{ui.detailSource}: {c.source}</small>}
            {c.sample && <small class="at-sample">{ui.sampleTag}</small>}
          </div>
        )}
      </div>
    );
  };

  const rangoF = p.rango.find((x) => x.properties.kind === 'range');

  // E4: the short text is the founder-approved profile row in the page's language (Spanish where en or pt is still pending), else the site's own curated text
  const desc = f?.desc?.[p.locale] ?? f?.desc?.es ?? it.descripcion ?? null;
  const descLang = f?.desc?.[p.locale] ? p.locale : 'es';
  const [descAbierta, setDescAbierta] = useState(false);
  useEffect(() => { setDescAbierta(false); }, [it.slug]);
  const resumen = () => {
    // a tile with no value is not drawn, and a group left empty loses its heading
    const grupos = celdas.map((g) => ({ ...g, celdas: g.celdas.filter((c) => c.value !== null) })).filter((g) => g.celdas.length);
    return (
      <>
        {estado}
        {grupos.map((g, fi) => (
          <section class="at-grow" data-row={fi + 1} aria-label={g.titulo}>
            <h4>{g.titulo}</h4>
            <div class="at-cells">{g.celdas.map((c, i) => celda(c, i))}</div>
          </section>
        ))}
        {rangoF?.properties.potential && <p class="at-note" data-potential>{ui.legendPotential}</p>}
        {desc ? <div class="at-descw"><p class={descAbierta ? 'at-desc' : 'at-desc at-clamp3'} lang={descLang} data-desc>{desc}</p>{desc.length > 220 && <button type="button" class="at-moreb" data-leer-mas aria-expanded={descAbierta ? 'true' : 'false'} onClick={() => setDescAbierta(!descAbierta)}>{descAbierta ? ui.readLess : ui.readMore}</button>}</div> : <p class="at-note" data-no-text>{ui.noText}</p>}
        {hero && credito && <p class="at-note at-credito" data-credito-imagen>{ui.imageCredits}: {partesDeCredito(credito.credito, credito.autor, credito.url).map((x) => typeof x === 'string' ? x : <a href={x.url} target="_blank" rel="noopener noreferrer">{x.texto}</a>)}</p>}
      </>
    );
  };

  // the actual prey names under a group (wild and captive), when the bundle carries them (Site & Data is adding them): a short list, never a placeholder
  const nombresDe = (g: any) => !!(g.nombres?.wild?.length || g.nombres?.captive?.length);
  const alimentacion = () => {
    // Site & Data's diet rows (a draft until reviewed), else the site's own curated feeding text split into «in the wild» and «in captivity»
    const trozos = (it.alimentacion ?? '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    const cautiverio = trozos.find((x) => /^En cautiverio/i.test(x)), silvestre = trozos.find((x) => !/^En cautiverio/i.test(x));
    const a: Alimentacion | null = f?.diet || f?.dietCaptive
      ? { wild: f.diet?.es ?? null, captive: f.dietCaptive?.es ?? null, draft: [f.diet, f.dietCaptive].some((x) => x?.review === 'draft'), source: [f.diet?.src, f.dietCaptive?.src].filter(Boolean).join(' · ') || null }
      : it.alimentacion ? { wild: silvestre?.replace(/^En su h[aá]bitat natural:\s*/i, '') ?? null, captive: cautiverio?.replace(/^En cautiverio:\s*/i, '') ?? null, draft: false, source: null } : null;
    return (
      <>
        {!a || (!a.wild && !a.captive) ? <p class="at-note">{ui.noFeeding}</p> : (
          <>
            {a.draft && <p class="at-sample" title={ui.draftNote}>{ui.draft}</p>}
            <div class="at-diets">
              {a.wild && <section data-diet="wild"><h4>{ui.feedWild}</h4><p>{a.wild}</p></section>}
              {a.captive && <section data-diet="captive"><h4>{ui.feedCaptive}</h4><p>{a.captive}</p></section>}
            </div>
          </>
        )}
        {(f?.prey ?? []).some((g) => nombresDe(g)) && <h4>{ui.preyGroups}</h4>}
        <div class="at-prey" data-prey>
          {(f?.prey ?? []).filter((g) => nombresDe(g)).map((g) => (
            <figure class="at-tile" data-prey-group={g.key}>
              <figcaption>{nombreGrupo(g)}{g.contexts.length === 1 && g.contexts[0] === 'captive' ? ` (${ui.feedCaptive.toLowerCase()})` : ''}</figcaption>
              {nombresDe(g) && (
                <div class="at-pn" data-prey-names>
                  {(['wild', 'captive'] as const).map((c) => (g.nombres?.[c]?.length ? <p data-prey-ctx={c}><b>{c === 'wild' ? ui.feedWild : ui.feedCaptive}:</b> {g.nombres![c]!.map((n: any) => n[p.locale] ?? n.es).join(', ')}</p> : null))}
                </div>
              )}
            </figure>
          ))}
        </div>
      </>
    );
  };

  // -- E6: the silhouette with its measurement lines, and the same silhouette at scale for the smallest and the largest species of the genus
  const filasM = f?.medidas ?? [];
  const valorDe = (measure: string): { txt: string | null; mm: number | null; note: string | null; source: string | null } => {
    const ms = filasM.filter((m) => m.measure === measure);
    if (!ms.length) return { txt: null, mm: null, note: null, source: null };
    const m = [...ms].sort((a, b) => (b.max ?? b.mean ?? 0) - (a.max ?? a.mean ?? 0))[0];
    const base = { note: m.note ?? null, source: m.source };
    if (m.mean !== undefined) return { txt: `${m.mean} ${m.uom}`, mm: m.mean, ...base };
    if (m.min !== undefined && m.max !== undefined) return { txt: `${m.min}–${m.max} ${m.uom}`, mm: m.max, ...base };
    return { txt: `${ui.maxShort} ${m.max} ${m.uom}`, mm: m.max ?? null, ...base };
  };
  const etapas = new Set(filasM.map((m) => m.stage).filter(Boolean));   // the stage is named only where the table has more than one, and always by its label, never by its key
  const medidas = () => {
    const [svl, cola, total, cabeza] = [valorDe('svl'), valorDe('tail_length'), valorDe('total_length'), valorDe('head_width')];
    const cotas: Cota[] = [{ id: 'total', label: ui.dimTotal, value: total.txt }, { id: 'svl', label: ui.dimSvl, value: svl.txt }, { id: 'tail', label: ui.dimTail, value: cola.txt }, { id: 'head', label: ui.dimHead, value: cabeza.txt }];
    const ext = p.extremos;
    const pie = (slug: string, titulo: string) => { const x = ext && (slug === ext.menor.slug ? ext.menor : ext.mayor); return x ? { slug, titulo, mm: x.mm, note: x.note, source: x.source, nombre: p.porSlug[slug]?.t.scientificName ?? slug } : null; };
    const mayor = ext?.mayor.mm ?? 0;
    const comparacion = ext ? [pie(ext.menor.slug, ui.smallest), pie(ext.mayor.slug, ui.largest)].filter(Boolean) as { slug: string; titulo: string; mm: number; note: string | null; source: string; nombre: string }[] : [];
    const propia = total.mm;
    return (
      <>
        <Silhouette cotas={cotas} noData={sinDato} schematic={ui.schematic} />
        {ext && (
          <figure class="at-compare" data-compare>
            <figcaption>{ui.sameScale} · {ui.byTotal}</figcaption>
            {/* the smallest, the species on screen and the largest, at one scale; the species on screen is highlighted in its own colour (and says «sin dato» when it has no total length) */}
            {[...comparacion.map((c) => ({ ...c, es: c.slug === it.slug })), ...(propia && !comparacion.some((c) => c.slug === it.slug) ? [{ slug: it.slug, titulo: it.t.scientificName, mm: propia, note: total.note, source: total.source ?? '', nombre: it.t.scientificName, es: true }] : [])].sort((a, b) => a.mm - b.mm).concat(!propia && !comparacion.some((c) => c.slug === it.slug) ? [{ slug: it.slug, titulo: '', mm: 0, note: null, source: '', nombre: it.t.scientificName, es: true }] : []).map((c) => (
              <div class="at-cmp-row" data-cmp={c.slug} data-own={c.es ? '1' : undefined} style={c.es ? { '--own': it.accent } as any : undefined}>
                {c.mm > 0 ? <Silhouette mini escala={c.mm / mayor} color={c.es ? it.accent : undefined} destacada={c.es} /> : <span class="at-mini at-mini-vacio" aria-hidden="true" />}
                <span><b>{c.nombre}</b><small>{c.mm > 0 ? <>{c.es ? '' : `${c.titulo} · `}{c.mm} mm{c.source ? ` · ${c.source}` : ''}{c.note ? ` · ${c.note}` : ''}</> : sinDato}</small></span>
              </div>
            ))}
          </figure>
        )}
        {filasM.length > 0 && (
          <table class="at-tbl"><tbody>{filasM.map((m) => <tr><td>{ui.measures[m.measure] ?? m.measure}{m.stage && etapas.size > 1 && etapa(m.stage) ? ` · ${etapa(m.stage)}` : ''}</td><td>{m.mean ?? (m.min !== undefined ? `${m.min}–${m.max}` : `${ui.maxShort} ${m.max}`)}{m.uom === 'count' ? '' : ` ${m.uom}`}{m.n ? ` (n = ${m.n})` : ''}{m.note ? ` · ${m.note}` : ''} <small class="at-src-cite">{m.source}</small></td></tr>)}</tbody></table>
        )}
      </>
    );
  };

  // -- E7: name and authorship, the source of the area, the source of each cell, the references
  const fuentesTab = () => {
    const claves = new Set<string>([...t.categories.map((c: any) => c.source), t.profile?.source, ...p.presenciaFilas.map((r) => r[2]), t.source].filter(Boolean));
    const lista = [...claves].map((k) => p.fuentes[k]).filter(Boolean);
    const autor = t.authorship ?? '';
    // the full citation of every status row (the IUCN one reads «UICN: EN (evaluación 2020) · IUCN 2026. The IUCN Red List of Threatened Species. Version 2026-1, consultada el …»): the «fuente» link of the sheet is the short form, this is one step away
    const orden = ['iucn', 'nom059', 'proy_nom059_2025', 'esa', 'sara', 'cosewic', 'natureserve'];
    const citasEstado = [...new Map(t.categories.filter((c: any) => c.citation).sort((x: any, y: any) => orden.indexOf(x.system) - orden.indexOf(y.system)).map((c: any) => [`${c.system}|${c.citation}`, c])).values()] as { system: string; scope: string; citation: string }[];
    const celdasConFuente = celdas.flatMap((g) => g.celdas).filter((c) => c.value !== null && c.source);
    return (
      <>
        <h4>{ui.srcName}</h4>
        <p class="at-name"><i>{t.scientificName}</i> {autor}</p>
        {rangoF && rangoF.properties.method !== 'lake_outline' && (
          <>
            <h4>{ui.srcRange}</h4>
            {rangoF.properties.potential && <p class="at-note">{ui.legendPotential}</p>}
            <ul class="at-srcs" data-range-source>{(rangoF.properties.fuentes ?? []).map((x: any) => <li>{x.name}<small>{x.credit}</small></li>)}</ul>
          </>
        )}
        <h4>{ui.srcData}</h4>
        <ul class="at-srcs">{celdasConFuente.map((c) => <li>{c.label}<small>{c.source}</small></li>)}</ul>
        {p.fuentesPuntos.length > 0 && (
          <>
            <h4>{ui.srcPoints}</h4>
            <ul class="at-srcs" data-points-sources>{[...new Map(p.fuentesPuntos.map((r) => [r.completa, r])).values()].map((r) => <li>{r.completa}<small>{r.corta}{r.pagina && !r.corta.includes(`p. ${r.pagina}`) ? `, p. ${r.pagina}` : ''}{r.licencia ? ` · ${r.licencia}` : ''}</small></li>)}</ul>
          </>
        )}
        <h4>{ui.tabMeasures}</h4>
        <ul class="at-srcs" data-sil-source><li>{ui.silhouetteOwn}</li></ul>
        {citasEstado.length > 0 && (
          <>
            <h4>{ui.conservationTitle}</h4>
            <ul class="at-srcs" data-status-citations>{citasEstado.map((c) => <li data-status-system={c.system}>{c.citation}<small>{ui.systems[c.system] ?? c.system}{c.scope ? ` · ${c.scope}` : ''}</small></li>)}</ul>
          </>
        )}
        <h4>{ui.srcRefs}</h4>
        <ul class="at-srcs">{lista.map((x: any) => <li>{x.title}<small>{[x.publisher, x.licence].filter(Boolean).join(' · ')}{x.citeOnly ? ` · ${ui.citeOnly}` : ''}</small></li>)}</ul>
      </>
    );
  };

  // the Clips tab exists only for a species with clips in the snapshot; a species without any falls back to the Resumen
  const tabs: [Tab, keyof UiText][] = p.clips.length ? [...TABS.slice(0, 3), TAB_CLIPS, TABS[3]] : TABS;
  const tabAct: Tab = tabs.some(([k]) => k === p.tab) ? p.tab : 'resumen';
  const clipsTab = () => (
    <>
      <div class="at-clips" data-clips>
        {p.clips.map((c) => (
          <figure class="at-clip" data-clip={c.id}>
            {c.poster ? <img src={c.poster} alt="" loading="lazy" decoding="async" /> : <div class="at-pending at-clip-ph"><span>{ui.clipPlaceholder}</span></div>}
            <figcaption>{c.credito ?? ui.clipCredit} · {ui.clipSource} · {c.fecha ?? ui.clipDate}</figcaption>
          </figure>
        ))}
      </div>
    </>
  );
  const cuerpo = { resumen, alimentacion, medidas, clips: clipsTab, fuentes: fuentesTab }[tabAct]();
  const alTecla = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const k = tabs[(i + d + tabs.length) % tabs.length][0];
    p.onTab(k);
    requestAnimationFrame(() => document.getElementById(`tab-${k}`)?.focus());
  };

  return (
    <aside id="at-detalle" class="at-drawer at-right" role="dialog" aria-labelledby="at-det-t" data-snap={p.snap} data-drawer="detalle" data-expanded={p.expandida ? '1' : '0'}
      style={{ '--sp': it.accent, '--sp-ink': p.tinta } as any}>
      <Grip label={ui.sheetGrip} snap={p.snap} onSnap={p.onSnap} onClose={p.onClose} />
      <button type="button" class="at-x at-abs at-exp" data-expand aria-label={p.expandida || p.snap === 'full' && p.phone ? ui.collapse : ui.expand} aria-pressed={p.expandida || (p.phone && p.snap === 'full') ? 'true' : 'false'} onClick={p.onExpand}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={p.expandida || (p.phone && p.snap === 'full') ? 'M10 4v6H4M14 20v-6h6M4 10l6-6M20 14l-6 6' : 'M4 10V4h6M20 14v6h-6M4 4l6 6M20 20l-6-6'} /></svg>
      </button>
      <div class="at-sheet">
        <div class="at-hero">
          {hero ? <><img src={`/species/${hero}`} alt={t.scientificName} decoding="async" style={HERO_FOCUS_Y[it.slug] != null ? { objectPosition: `${HERO_FOCUS_X[it.slug] ?? 50}% ${HERO_FOCUS_Y[it.slug]}%` } : undefined} />{credito?.etiqueta && <span class="at-genlbl" data-etiqueta-imagen>{credito.etiqueta}</span>}</> : (
            <div class="at-ph" style={{ background: `radial-gradient(circle at 50% 60%, ${it.accent}44, transparent 70%)` }}><small>{ui.imagePending}</small></div>
          )}
        </div>
        <div class="at-head">
          <h2 id="at-det-t">{t.scientificName}</h2>
          {it.common.length > 0 && <p class="at-sub">{it.common.join(' · ')}</p>}
          <div class="at-pres" data-presence>{cabecera}</div>
        </div>
        <div class="at-main">
        <div class="at-tabrow">
          <div class="at-tabs" role="tablist" aria-label={ui.detailLabel}>
            {tabs.map(([k, label], i) => <button type="button" class="at-tab" role="tab" id={`tab-${k}`} aria-selected={tabAct === k ? 'true' : 'false'} tabIndex={tabAct === k ? 0 : -1} aria-controls="at-det-panel" onKeyDown={(e) => alTecla(e as KeyboardEvent, i)} onClick={() => p.onTab(k)}>{ui[label] as string}</button>)}
          </div>
          <button ref={cerrar} type="button" class={`at-x at-tabclose${p.phone ? ' at-abs' : ''}`} data-close="detalle" aria-label={ui.detailClose} onClick={p.onClose}>×</button>
        </div>
        <div id="at-det-panel" class="at-panel" role="tabpanel" aria-labelledby={`tab-${tabAct}`} data-tab={tabAct}>{cuerpo}</div>
        </div>
      </div>
    </aside>
  );
}

// prey-group illustrations (Z-Image-Turbo, text prompt only, approved one by one by the founder), by the GBIF key of the group; a group with no kept image has none and its slot is hidden
