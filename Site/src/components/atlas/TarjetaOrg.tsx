import { useMemo, useState } from 'preact/hooks';
import { ChipEspecie, EtiquetaEspecie, NombreSinMapa, type InfoEspecie } from './EspecieChip';
import { Origen, OrigenIcono, type OrigenDato } from './Origen';
import { InfoCapa } from './InfoCapa';
import { montoLegible } from '@/lib/fichaOrg.mjs';

// DEMO ONLY (PUBLIC_ATLAS_CICLO=1): the card of an organization, ONE component for every organization of the «Organizaciones registradas» layer, fed by a view model (src/lib/fichaOrg.mjs): the Xolotlcalli pilot is the reference instance (Site & Data's ficha, the clips snapshot, the onchain snapshot) and any other organization comes from the hub's OrgDetail and OrgWeeks.
// Every value wears its origin (en cadena, previsto: <esquema>, registro del hub); a section with nothing to say shows its empty state, never a zero; IRC and survival are in the view model of the pilot only. The visitor's browser never calls Xovi or a chain. Spanish only: the demo is read by the museum and the founder.
// Never shown here, whatever the data carries: deaths or specimen names, counts of private types, thresholds or alert colours, staff names, the embargoed specimen, a per-animal timeline.

export interface FichaXolotlcalli { [k: string]: any }
/** The clips snapshot: `fecha` is the day it was taken from Xovi; each clip is already a display record (no ids, no titles, no specimen names, no notes). */
export interface ClipsXolotlcalli {
  fecha: string;
  clips: { semana: string; semanaDe?: 'grabación' | 'confirmación'; especie: string; sistema: 'am' | 'aa' | 'ad'; estado: string; autor: string; poster?: string | null; url: string }[];
}
/** The week of a clip, with the date it comes from: the label is the export's, never guessed; a snapshot without it says only «semana». */
const semanaDeClip = (c: { semana: string; semanaDe?: string }) => <>{c.semanaDe === 'grabación' ? 'grabado en la semana ' : c.semanaDe === 'confirmación' ? 'confirmado en la semana ' : 'semana '}<span class="at-xs-sem">{c.semana}</span></>;
/** A public onchain read taken at build time (never by the visitor's browser): one row per identity, each with the explorer page it links to. */
export interface FilaCadena {
  id: string; titulo: string; red: string | null; estado: string;
  detalle?: { k: string; v: string; url?: string; sentido?: 'entrada' | 'salida'; contrapartes?: { texto: string; url?: string }[]; enlaces?: { texto: string; url: string }[] }[]; nota?: string; bloque?: number;
  descripcion?: string;
  /** the row's caveat on what the read covers, as the public copy names it (lib/pilotoPublico.mjs); `nota` is the internal file's name for it */
  aclaracion?: string;
  /** the label of the row (the stand's ENS row: «identificador histórico del Piloto (2025–2026)») */
  etiqueta?: string;
  enlace?: { texto: string; url: string };
  /** a short caveat on the read itself, e.g. that one provider answered */
  aviso?: string;
  /** a placeholder row: shown with the tag «valor de muestra» */
  muestra?: boolean;
  /** where the row comes from; the view model fills it */
  origen?: OrigenDato;
}
export interface CadenaXolotlcalli { leidoEl: string; filas: FilaCadena[] }
/** One value of the card and where it comes from. */
interface Dato<T> { valor: T; origen: OrigenDato }
/** The view model (src/lib/fichaOrg.mjs): what the card draws, for any organization. A null section is an empty state. */
export interface OrgVista {
  slug: string;
  nombre: Dato<string>; lugar: Dato<string>; cerrado: { fecha: string | null } | null;
  ens: (Dato<string> & { nota?: string | null }) | null;
  periodo: Dato<{ desde: string; hasta: string | null; semanas?: [string, string] }> | null;
  especies: Dato<string[]> | null;
  sistemas: Dato<{ codigo: string; especie: string | null }[]> | null;
  semanas: Dato<{ n: number; desde: string; hasta: string; ancladas: number }> | null;
  registros: (Dato<number> & { corte?: string; ancladas?: number }) | null;
  /** the IRC and survival band: present for every organization, each block null (an empty state) until its figure is published */
  cifras: { irc: { valor: number | string; etiqueta?: string; linea?: string; pie?: string } | null; supervivencia: any | null; modo: 'demo' | 'piloto' | null; aviso: string | null; notaPie?: string };
  ficha?: FichaXolotlcalli | null;
  clips: ClipsXolotlcalli | null;
  cadena: FilaCadena[];
  cadenaLeidoEl?: string | null;
  pagina: string | null;
  /** the stand profile: every item says where it comes from and when */
  perfil?: 'demo' | 'stand' | 'sitio';
  fuenteDe?: Record<string, { texto: string; fecha?: string | null }> | null;
  tituloAgua?: string | null;
  fuentes?: { texto: string; corte?: string }[];
}

const TXT = {
  tabs: [['resumen', 'Resumen'], ['indicadores', 'Indicadores'], ['clips', 'Clips'], ['fondos', 'Fondos y cadena'], ['fuentes', 'Fuentes']] as [string, string][],
  cerrar: 'Cerrar la ficha',
  sistemas: { am: 'AM', aa: 'AA', ad: 'AD' } as Record<string, string>,
};
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return d ? `${d} de ${MESES[m - 1]} de ${a}` : m ? `${MESES[m - 1]} de ${a}` : String(a); };
const num = (v: number, dec = 2) => (Number.isInteger(v) ? String(v) : v.toFixed(dec).replace(/0+$/, '').replace(/\.$/, ''));
const nombreDe = (slug: string) => `A. ${slug.replace(/^ambystoma_/, '')}`;
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** «2025-10-24» as «24 oct 2025». */
const fechaCorta = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return d ? `${d} ${MESES_CORTOS[m - 1]} ${a}` : m ? `${MESES_CORTOS[m - 1]} ${a}` : String(a); };

/** The ISO weeks from `desde` to `hasta`, inclusive. */
function semanasIso(desde: string, hasta: string): string[] {
  const p = (s: string) => { const m = /^(\d{4})-W(\d{2})$/.exec(s)!; return [+m[1], +m[2]]; };
  const enAnio = (y: number) => { const j1 = new Date(Date.UTC(y, 0, 1)).getUTCDay(), bis = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; return j1 === 4 || (bis && j1 === 3) ? 53 : 52; };
  const out: string[] = []; let [y, w] = p(desde); const [yf, wf] = p(hasta);
  while (y < yf || (y === yf && w <= wf)) { out.push(`${y}-W${String(w).padStart(2, '0')}`); if (++w > enAnio(y)) { w = 1; y++; } }
  return out;
}

interface Semana { semana: string; n: number; min: number | null; max: number | null; media: number; metodo: string; extremosSuprimidos?: boolean }

/** One property of one water system, week by week: the band between the weekly minimum and maximum, the weekly mean as a dot, a line between consecutive weeks. One hue, no thresholds, no ranges, no alert colours. */
function Serie(p: { semanas: string[]; datos: Semana[]; unidad: string; titulo: string }) {
  const W = 560, H = 176, L = 46, R = 10, T = 12, B = 26;
  const por = new Map(p.datos.map((d) => [d.semana, d]));
  const vals = p.datos.flatMap((d) => [d.min, d.max, d.media].filter((v): v is number => v !== null));
  let lo = Math.min(...vals), hi = Math.max(...vals); if (lo === hi) { lo -= 1; hi += 1; }
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, p.semanas.length - 1), y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = [lo, (lo + hi) / 2, hi];
  const linea: string[] = []; let tramo = '';
  p.semanas.forEach((s, i) => { const d = por.get(s); if (d) tramo += `${tramo ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.media).toFixed(1)}`; else if (tramo) { linea.push(tramo); tramo = ''; } });
  if (tramo) linea.push(tramo);
  return (
    <svg class="at-xs-serie" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${p.titulo}: serie semanal, ${p.datos.length} semanas con registro público`}>
      {ticks.map((t) => <g><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} class="at-xs-grid" /><text x={L - 6} y={y(t) + 3.5} text-anchor="end" class="at-xs-eje">{num(t)}</text></g>)}
      {p.semanas.map((s, i) => { const d = por.get(s); if (!d || d.min === null || d.max === null) return null; return <line x1={x(i)} x2={x(i)} y1={y(d.min)} y2={y(d.max)} class="at-xs-banda"><title>{`${s}: n ${d.n}, mín ${num(d.min)}, máx ${num(d.max)}, media ${num(d.media)} ${p.unidad}`}</title></line>; })}
      {linea.map((d) => <path d={d} class="at-xs-linea" />)}
      {p.semanas.map((s, i) => { const d = por.get(s); if (!d) return null; return <circle cx={x(i)} cy={y(d.media)} r={d.extremosSuprimidos ? 3.2 : 2.6} class={d.extremosSuprimidos ? 'at-xs-punto at-xs-hueco' : 'at-xs-punto'}><title>{`${s}: n ${d.n}, media ${num(d.media)} ${p.unidad}${d.extremosSuprimidos ? ' (extremos suprimidos: pocas lecturas)' : ''}`}</title></circle>; })}
      <text x={L} y={H - 6} class="at-xs-eje">{p.semanas[0]}</text>
      <text x={W - R} y={H - 6} text-anchor="end" class="at-xs-eje">{p.semanas[p.semanas.length - 1]}</text>
      <text x={4} y={9} class="at-xs-eje">{p.unidad}</text>
    </svg>
  );
}

export function TarjetaOrg(p: {
  vista: OrgVista;
  /** the species the card links to, by short slug, with the name the atlas shows */
  onEspecie: (slug: string) => void;
  /** a species named by the card, as the map shows it (colour, texture, status badge); null when the atlas does not know the name */
  especie: (texto: string) => InfoEspecie | null;
  onClose: () => void;
}) {
  const v = p.vista;
  const f: any = v.ficha ?? null;
  const [tab, setTab] = useState('resumen');
  const [sistema, setSistema] = useState('am');
  const [propiedad, setPropiedad] = useState('temperature');
  const [tabla, setTabla] = useState(false);
  const semanas = useMemo(() => (f ? semanasIso(f.resumen.semanasDeclaradas.desde, f.resumen.semanasDeclaradas.hasta) : []), [f]);
  const sist = f?.aguaSemanal?.sistemas?.[sistema] ?? { propiedades: {} };
  const props = Object.keys(sist.propiedades ?? {});
  const prop = sist.propiedades?.[propiedad] ?? sist.propiedades?.[props[0]];
  const propActual = sist.propiedades?.[propiedad] ? propiedad : props[0];
  const etiquetaProp = (k: string) => String(sist.propiedades[k].columnaDelLibro).replace(/^\d+\.\s*/, '');
  const clips = v.clips?.clips ?? [];
  // every species the card names wears the map's own chip; a name the atlas does not know is plain italic text
  const chip = (t: string) => { const e = p.especie(t); return e ? <ChipEspecie e={e} onPick={p.onEspecie} /> : <NombreSinMapa texto={nombreDe(t)} />; };
  const marca = (t: string) => { const e = p.especie(t); return e ? <EtiquetaEspecie e={e} /> : <NombreSinMapa texto={nombreDe(t)} />; };
  const alTecla = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault();
    const k = TXT.tabs[(i + d + TXT.tabs.length) % TXT.tabs.length][0]; setTab(k); requestAnimationFrame(() => document.getElementById(`ctab-${k}`)?.focus());
  };
  const fechaOSemana = (x: string) => (/^\d{4}-W\d{2}$/.test(x) ? x : fechaLarga(x));
  // a value with its origin; with no value, the empty state of its section (never a zero)
  const fuente = (k: string) => { const f = v.fuenteDe?.[k]; return f ? <small class="at-xs-fuente" data-xs-fuente={k}>Fuente: {f.texto}{f.fecha ? ` · ${fechaLarga(f.fecha)}` : ''}</small> : null; };
  const dato = (k: string, valor: preact.ComponentChildren, origen?: OrigenDato, nota?: string, fuenteDe?: string) => <div class="at-xs-dato" data-xs-dato={k}><dt>{k}</dt><dd>{valor}{origen && <Origen o={origen} />}{nota && <small class="at-xs-nota">{nota}</small>}{fuenteDe && fuente(fuenteDe)}</dd></div>;
  const vacio = (texto: string) => <span class="at-xs-vacio-dato" data-xs-dato-vacio>{texto}</span>;

  // an amount as it is read at a booth (ETH to 4 places, USD stablecoins to 2); the exact value of the file stays in the title, and in the data
  const monto = (v: string) => { const c = montoLegible(v); return c === v ? <>{v}</> : <span data-xs-monto title={v}>{c}</span>; };
  // the Safe's movements, month by month: a closed list inside the row (no stacked cards); links open an explorer page only on click
  const MES_LARGO = (ym: string) => { const [a, m] = ym.split('-').map(Number); return `${MESES[m - 1]} de ${a}`; };
  const movimientosPorMes = (r: FilaCadena) => {
    const lineas = (r.detalle ?? []).filter((d) => d.sentido);
    const meses = [...new Set(lineas.map((d) => d.k.slice(0, 7)))].sort();
    return (
      <details class="at-xs-meses" data-xs-movimientos>
        <summary>Movimientos por mes <small>({lineas.length})</small></summary>
        {meses.map((mes) => (
          <section class="at-xs-mes" data-mes={mes} aria-label={MES_LARGO(mes)}>
            <h5>{MES_LARGO(mes)}</h5>
            <table class="at-xs-tbl">
              <thead class="at-sr"><tr><th scope="col">Categoría</th><th scope="col">Monto</th><th scope="col">Enlaces</th></tr></thead>
              <tbody>
                {lineas.filter((d) => d.k.slice(0, 7) === mes).map((d) => (
                  <tr class="at-xs-mov" data-xs-mov data-sentido={d.sentido}>
                    <td class="at-xs-mov-c">{d.k.split(' · ').slice(1).join(' · ')}</td>
                    <td class="at-xs-mov-v"><b>{d.sentido}</b> {monto(d.v.replace(/^(entrada|salida): /, ''))}</td>
                    <td class="at-xs-mov-l">
                      {(d.contrapartes ?? []).map((c, i) => <>{i > 0 && ', '}{c.url ? <a class="at-xs-ext" href={c.url} target="_blank" rel="noopener noreferrer" data-explorer data-contraparte>{c.texto}</a> : <span data-contraparte>{c.texto}</span>}</>)}
                      {d.enlaces?.length ? <details class="at-xs-tx"><summary>ver {d.enlaces.length} tx</summary>{d.enlaces.map((e, i) => <>{i > 0 && ' '}<a class="at-xs-ext" href={e.url} target="_blank" rel="noopener noreferrer" data-explorer data-tx>{e.texto}</a></>)}</details> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </details>
    );
  };
  const filaCadena = (r: FilaCadena) => (
    <li class="at-xs-fila" data-xs-cadena={r.id}>
      <div class="at-xs-fila-t"><b>{r.titulo}</b><Origen o={r.origen ?? { estado: 'hub' }} />{r.muestra && <span class="at-xs-muestra">valor de muestra</span>}{r.aviso && <span class="at-xs-aviso" data-xs-aviso>{r.aviso}</span>}</div>
      <p class="at-xs-fila-e">{r.estado}</p>
      {r.etiqueta && <p class="at-xs-fila-et" data-xs-etiqueta>{r.etiqueta}</p>}
      {r.descripcion && <p class="at-xs-fila-desc" data-xs-descripcion>{r.descripcion}</p>}
      {r.detalle?.some((d) => d.sentido) ? movimientosPorMes(r) : null}
      {r.detalle?.filter((d) => !d.sentido).length ? <dl class="at-xs-fila-d">{r.detalle.filter((d) => !d.sentido).map((d) => <div data-xs-linea><dt>{d.k}</dt><dd>{monto(d.v)}{d.url && <> <a class="at-xs-ext" href={d.url} target="_blank" rel="noopener noreferrer" data-explorer>Ver transacción</a></>}{d.enlaces?.length ? <span class="at-xs-mov-l"> {d.enlaces.map((e, i) => <>{i > 0 && ' '}<a class="at-xs-ext" href={e.url} target="_blank" rel="noopener noreferrer" data-explorer data-tx>{e.texto}</a></>)}</span> : null}</dd></div>)}</dl> : null}
      {(r.aclaracion ?? r.nota) && <p class="at-xs-nota">{r.aclaracion ?? r.nota}</p>}
      <p class="at-xs-fila-p"><small>{[r.red, r.bloque != null ? `bloque ${r.bloque.toLocaleString('es-MX')}` : null].filter(Boolean).join(' · ')}</small>{r.enlace && <a class="at-xs-ext" href={r.enlace.url} target="_blank" rel="noopener noreferrer" data-explorer>{r.enlace.texto}</a>}</p>
    </li>
  );
  // Resumen: a grid of tiles in four groups, each tile one value, one label and at most one caption; its origin is a small icon in the corner; the long wording is in Indicadores and Fuentes
  const tesoreria = v.cadena.find((fila) => fila.id === 'tesoreria');
  const pieClips = clips.length ? `${clips.length === 1 ? 'clip' : 'clips'} al ${fechaCorta(v.clips!.fecha)}` : null;
  const tile = (k: string, etiqueta: string, valor: preact.ComponentChildren, o: { origen?: OrigenDato; pie?: preact.ComponentChildren; info?: string; grande?: boolean; clase?: string } = {}) => (
    <div class={`at-xt${o.grande ? ' at-xt-g' : ''}${o.clase ? ` ${o.clase}` : ''}`} data-xs-dato={k}>
      <span class="at-xt-k">{etiqueta}{o.info && <InfoCapa id={`cifra-${k}`} etiqueta={`Más sobre ${etiqueta}`}><span>{o.info}</span></InfoCapa>}</span>
      <div class="at-xt-v">{valor}</div>
      {o.pie && <small class="at-xt-pie">{o.pie}</small>}
      {o.origen && <span class="at-xt-og"><OrigenIcono o={o.origen} /></span>}
    </div>
  );
  const piloto = v.cifras.modo === 'piloto';
  const tilesCifras = !v.cifras.irc && !v.cifras.supervivencia
    ? <p class="at-xs-vacio-dato" data-xs-cifras-vacia>Sin cifras publicadas por la organización</p>
    : piloto ? <>
      {v.cifras.irc && tile('irc', 'IRC v1', <b class="at-xs-grande" data-xs-cifra="irc">{v.cifras.irc.valor}</b>, { grande: true, pie: v.cifras.irc.pie, info: v.cifras.irc.linea })}
      {v.cifras.supervivencia && tile('supervivencia', 'Supervivencia', <b class="at-xs-grande" data-xs-cifra="sup">{Number(v.cifras.supervivencia.valor).toFixed(1)} %</b>, { grande: true, pie: v.cifras.supervivencia.pie, info: v.cifras.supervivencia.linea })}
    </> : <>
      {tile('irc', 'IRC v1', v.cifras.irc ? <><b class="at-xs-grande" data-xs-cifra="irc">{v.cifras.irc.valor}</b> <span class="at-tag at-tag-pend">pendiente de dictamen · no publicado</span></> : <span class="at-xs-vacio-dato" data-xs-cifra-vacia>Sin IRC publicado</span>, { grande: true })}
      {tile('supervivencia', 'Supervivencia', v.cifras.supervivencia ? <b class="at-xs-grande" data-xs-cifra="sup">{Number(v.cifras.supervivencia.valor).toFixed(1)} {v.cifras.supervivencia.unidad}</b> : <span class="at-xs-vacio-dato" data-xs-cifra-vacia>Sin tasa de supervivencia publicada</span>, { grande: true, pie: v.cifras.supervivencia ? `${v.cifras.supervivencia.etiqueta}` : undefined })}
    </>;
  const resumen = (
    <div class="at-xs-resumen at-xt-rejilla" data-carta-panel="resumen">
      <section class="at-xt-gr" aria-labelledby="xt-op"><h4 id="xt-op">Operación</h4><div class="at-xt-fila">
        {tile('Periodo de operación', 'Periodo', v.periodo ? <>{fechaCorta(v.periodo.valor.desde)} → {v.periodo.valor.hasta ? fechaCorta(v.periodo.valor.hasta) : 'en operación'}</> : vacio('Sin periodo declarado'), { origen: v.periodo?.origen, pie: v.semanas ? `${v.semanas.valor.n} semanas` : undefined })}
        {tile('Sistemas de agua', 'Sistemas', v.sistemas ? <span class="at-xs-chips at-xt-sis" data-xs-sistemas>{v.sistemas.valor.map((s) => { const e = s.especie ? p.especie(s.especie) : null; return <span class="at-xt-sw" title={e ? nombreDe(e.slug) : undefined}><i style={e ? { background: e.accent } : undefined} aria-hidden="true" /><b>{s.codigo}</b></span>; })}</span> : vacio('Sin sistemas declarados'), { origen: v.sistemas?.origen })}
      </div></section>
      <section class="at-xt-gr" aria-labelledby="xt-es"><h4 id="xt-es">Especies</h4><div class="at-xt-fila">
        {tile('Especies exhibidas', 'Exhibidas', v.especies ? <span class="at-xs-chips" data-xs-especies>{v.especies.valor.map((t) => chip(t))}</span> : vacio('Sin especies declaradas'), { origen: v.especies?.origen, clase: 'at-xt-ancha' })}
      </div></section>
      <section class="at-xt-gr" aria-labelledby="xt-ind"><h4 id="xt-ind">Indicadores</h4>
        <div class="at-xt-fila at-xt-cifras" role="group" aria-label="Cifras clave">{tilesCifras}</div>
        {v.cifras.notaPie && <p class="at-xs-nota at-xs-cifras-aviso" data-xs-cifras-pie>{v.cifras.notaPie}</p>}
      </section>
      <section class="at-xt-gr" aria-labelledby="xt-dv"><h4 id="xt-dv">Datos y verificación</h4><div class="at-xt-fila at-xt-tres">
        {tile('Registros públicos', 'Lecturas públicas', v.registros ? <>{v.registros.valor}</> : vacio('Sin registros públicos todavía'), { origen: v.registros?.origen, pie: v.registros?.corte ? `corte al ${fechaCorta(v.registros.corte)}` : undefined })}
        {clips.length > 0 && tile('Clips confirmados', 'Clips confirmados', <button type="button" class="at-xt-enlace" data-xs-ir="clips" onClick={() => setTab('clips')}>{clips.length}</button>, { pie: pieClips ?? undefined })}
        {tesoreria && tile('Tesorería', 'Tesorería', <button type="button" class="at-xt-enlace" data-xs-ir="fondos" onClick={() => setTab('fondos')}>{tesoreria.origen?.estado === 'en-cadena' ? 'en cadena' : 'ver'}</button>, { origen: tesoreria.origen })}
      </div></section>
    </div>
  );

  const indicadores = (
    <div class="at-xs-ind" data-carta-panel="indicadores">
      {piloto && (v.cifras.irc || v.cifras.supervivencia) && <section aria-labelledby="xs-cifras" class="at-xs-cifras-full">
        <h4 id="xs-cifras">Cifras clave</h4>
        {v.cifras.irc && <p class="at-xs-cifra-l" data-xs-cifra-linea="irc">{v.cifras.irc.linea}</p>}
        {v.cifras.supervivencia && <p class="at-xs-cifra-l" data-xs-cifra-linea="sup">{v.cifras.supervivencia.linea}</p>}
        {v.cifras.aviso && <p class="at-xs-nota" data-xs-cifras-aviso>{v.cifras.aviso}</p>}
      </section>}
      {!f && <section aria-labelledby="xs-agua"><h4 id="xs-agua">Calidad del agua</h4><p class="at-xs-vacio" data-xs-vacio>Sin lecturas públicas todavía.</p></section>}
      {f && <section aria-labelledby="xs-agua">
        <h4 id="xs-agua">{v.tituloAgua ?? 'Calidad del agua'}</h4>
        {fuente('agua')}
        <div class="at-xs-chips" role="group" aria-label="Sistema">
          {['am', 'aa', 'ad'].map((s) => <button type="button" class="at-chip" aria-pressed={sistema === s ? 'true' : 'false'} data-xs-sistema={s} onClick={() => { setSistema(s); const k = Object.keys(f.aguaSemanal.sistemas[s].propiedades ?? {}); if (!k.includes(propiedad)) setPropiedad(k[0] ?? ''); }}>{TXT.sistemas[s]} · <i class="at-sp-i">{nombreDe(f.aguaSemanal.sistemas[s].taxon)}</i></button>)}
        </div>
        {props.length === 0 ? (
          <p class="at-xs-vacio" data-xs-vacio>Este sistema no tiene lecturas públicas.</p>
        ) : (
          <>
            <div class="at-xs-chips" role="group" aria-label="Propiedad">
              {props.map((k) => <button type="button" class="at-chip" aria-pressed={propActual === k ? 'true' : 'false'} data-xs-prop={k} onClick={() => setPropiedad(k)}>{etiquetaProp(k)}</button>)}
            </div>
            <p class="at-xs-nota">Cada marca es una semana: la barra va del mínimo al máximo de las lecturas públicas, el punto es la media; un punto hueco es una semana con pocas lecturas, sin extremos.</p>
            {!tabla && <Serie semanas={semanas} datos={prop.semanas} unidad={prop.unidad} titulo={`${etiquetaProp(propActual)}, ${TXT.sistemas[sistema]}`} />}
            <button type="button" class="at-act" aria-pressed={tabla ? 'true' : 'false'} onClick={() => setTabla(!tabla)}>{tabla ? 'Ver como gráfica' : 'Ver como tabla'}</button>
            {tabla && (
              <div class="at-xs-tabla"><table>
                <caption>{etiquetaProp(propActual)} ({prop.unidad}), {TXT.sistemas[sistema]}</caption>
                <thead><tr><th>Semana</th><th>n</th><th>Mín.</th><th>Máx.</th><th>Media</th></tr></thead>
                <tbody>{prop.semanas.map((s: Semana) => <tr><td>{s.semana}</td><td>{s.n}</td><td>{s.min === null ? '—' : num(s.min)}</td><td>{s.max === null ? '—' : num(s.max)}</td><td>{num(s.media)}</td></tr>)}</tbody>
              </table></div>
            )}
          </>
        )}
      </section>}
      {f && <section aria-labelledby="xs-cob">
        <h4 id="xs-cob">Cobertura de registro</h4>
        <dl class="at-xs-datos">
          {dato('Semanas con registro público', <>{f.cobertura.semanasConRegistroPublico.valor} de {f.cobertura.semanasConRegistroPublico.de} <small>({num(f.cobertura.semanasConRegistroPublico.porcentaje, 1)} %)</small></>, undefined, undefined, 'cobertura')}
          {dato('Días con lectura de temperatura', <>{f.cobertura.diasConTemperatura.valor} <small>(AM {f.cobertura.diasConTemperatura.porSistema.am}, AA {f.cobertura.diasConTemperatura.porSistema.aa}, AD {f.cobertura.diasConTemperatura.porSistema.ad})</small></>)}
        </dl>
      </section>}
      {v.perfil !== 'stand' && <section aria-labelledby="xs-clips">
        <h4 id="xs-clips">Clips confirmados</h4>
        {clips.length ? <p>{clips.length} <small>al {fechaLarga(v.clips!.fecha)}</small>{['mexicanum', 'dumerilii', 'andersoni'].map((e) => { const n = clips.filter((c) => c.especie === e).length; return n ? <span class="at-xs-sis"> · <i class="at-sp-i">{nombreDe(e)}</i>: {n}</span> : null; })}</p> : <p class="at-xs-vacio">Sin clips públicos todavía.</p>}
      </section>}
      {v.cifras.irc && v.cifras.modo !== 'piloto' && <section aria-labelledby="xs-irc">
        <h4 id="xs-irc">IRC v1</h4>
        <p class="at-xs-grande" data-xs-irc>{v.cifras.irc.valor} <span class="at-tag at-tag-pend">pendiente de dictamen · no publicado</span></p>
        <p class="at-xs-nota">{v.cifras.irc.etiqueta}. La definición está en Fuentes.</p>
      </section>}
      {v.cifras.supervivencia && v.cifras.modo !== 'piloto' && <section aria-labelledby="xs-sup">
        <h4 id="xs-sup">Supervivencia</h4>
        <p class="at-xs-grande" data-xs-sup>{Number(v.cifras.supervivencia.valor).toFixed(1)} {v.cifras.supervivencia.unidad} <small>{v.cifras.supervivencia.etiqueta}</small></p>
        <p class="at-xs-nota">{v.cifras.supervivencia.nota} <span>Periodo: {fechaLarga(v.cifras.supervivencia.periodo.desde)} → {fechaLarga(v.cifras.supervivencia.periodo.hasta)}.</span></p>
      </section>}
    </div>
  );

  const porEstado = [...new Set(clips.map((c) => c.estado))].map((e) => [e, clips.filter((c) => c.estado === e)] as const).sort((x, y) => y[1].length - x[1].length || x[0].localeCompare(y[0], 'es'));
  const clipsTab = (
    <div class="at-xs-clipsv" data-carta-panel="clips">
      {clips.length === 0 ? <p class="at-xs-vacio" data-xs-clips-vacio>Sin clips públicos todavía.</p> : (
        <>
          <p class="at-xs-nota" data-xs-clips-fecha>clips al {fechaLarga(v.clips!.fecha)}</p>
          {fuente('clips')}
          {porEstado.map(([e, lista]) => (
            <section aria-label={`Comportamiento ${e}`}>
              <h4>{e} <small>{lista.length}</small></h4>
              <div class="at-clips">
                {lista.map((c) => (
                  <div class="at-clip at-xs-clip at-xs-tile">
                    <a href={c.url} target="_blank" rel="noopener noreferrer" data-xs-clip aria-label="Abrir el clip en YouTube">
                      {c.poster ? <img src={c.poster} alt="" loading="lazy" decoding="async" /> : <div class="at-pending at-clip-ph"><span>cuadro del clip</span></div>}
                    </a>
                    <span class="at-xs-cap">{chip(c.especie)}</span>
                    <span class="at-xs-cap2">Sistema {TXT.sistemas[c.sistema]}</span>
                    <span class="at-xs-cap2" data-xs-semana={c.semanaDe ?? ''}>{semanaDeClip(c)}</span>
                    <span class="at-xs-cap2">{c.autor}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );

  // plain names, never repository names, hashes or file paths: those stay in the data file
  const fuentes = (
    <div class="at-xs-fuentes" data-carta-panel="fuentes">
      {v.fuentes?.length ? <ul class="at-xs-lista">
        {v.fuentes?.map((x) => <li>{x.texto}{x.corte ? ` (corte al ${fechaLarga(x.corte)})` : ''}</li>)}
      </ul> : <p class="at-xs-vacio" data-xs-fuentes-vacio>Sin fuentes registradas todavía.</p>}
    </div>
  );

  // Fondos y cadena: everything onchain in detail, with a one-row legend of the origin words
  const fondos = (
    <div class="at-xs-fondos" data-carta-panel="fondos">
      <p class="at-xs-leyenda" data-xs-leyenda aria-label="Qué significa cada marca de origen"><Origen o={{ estado: 'en-cadena' }} /> <Origen o={{ estado: 'previsto', esquema: 'esquema' }} /> <Origen o={{ estado: 'hub' }} /></p>
      <h4 id="xs-cadena">En cadena {v.cadenaLeidoEl && <small>lectura del {fechaLarga(v.cadenaLeidoEl)}</small>}</h4>
      {v.cadena.length ? <ul class="at-xs-filas">{v.cadena.map(filaCadena)}</ul> : <p class="at-xs-vacio" data-xs-cadena-vacio>Sin registros en cadena.</p>}
    </div>
  );
  const cuerpo = { resumen, indicadores, clips: clipsTab, fondos, fuentes }[tab as 'resumen'];
  return (
    <aside id="at-carta" lang="es" class="at-drawer at-right at-xs" role="dialog" aria-labelledby="at-carta-t" data-drawer="carta" data-snap="half" data-expanded="0">
      <div class="at-sheet">
        <div class="at-head at-xs-head">
          <h2 id="at-carta-t">{v.nombre.valor}<OrigenIcono o={v.nombre.origen} /></h2>
          <p class="at-sub">{v.lugar.valor}<OrigenIcono o={v.lugar.origen} /></p>
          <p class="at-xs-pildoras">{v.pagina && <a class="at-xs-btn" href={v.pagina} data-xs-pagina>Página del museo</a>}<span class="at-xs-pildora">{v.cerrado ? (v.cerrado.fecha ? `cerrado · ${fechaLarga(v.cerrado.fecha)}` : 'cerrado') : 'en operación'}</span>{v.ens && <span class="at-xs-ens" data-ciclo-ens>{v.ens.valor}{v.ens.nota ? ` (${v.ens.nota})` : ''}<Origen o={v.ens.origen} /></span>}</p>
        </div>
        <div class="at-tabrow">
          <div class="at-tabs" role="tablist" aria-label="Secciones de la ficha">
            {TXT.tabs.map(([k, label], i) => <button type="button" class="at-tab" role="tab" id={`ctab-${k}`} aria-selected={tab === k ? 'true' : 'false'} tabIndex={tab === k ? 0 : -1} aria-controls="at-carta-panel" onKeyDown={(e) => alTecla(e as KeyboardEvent, i)} onClick={() => setTab(k)}>{label}</button>)}
          </div>
          <button type="button" class="at-x at-tabclose" data-close="carta" aria-label={TXT.cerrar} onClick={p.onClose}>×</button>
        </div>
        <div id="at-carta-panel" class="at-panel" role="tabpanel" aria-labelledby={`ctab-${tab}`} data-tab={tab}>{cuerpo}</div>
      </div>
    </aside>
  );
}
