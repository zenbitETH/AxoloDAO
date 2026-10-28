import { lineaDeCierre } from '@/lib/instalacionesCierre.mjs';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Locale } from '@/i18n/strings';
import { atlasText } from '@/lib/atlasText';
import { baseStyle, colorDe, RAMPA, RAMPA_INST, rayasDebil, SIN_DATO } from '@/lib/atlasStyle.mjs';
import { filasDeInstalaciones, lugarDeInstalacion } from '@/lib/atlasPlace.mjs';
import { acento, cajasDeUnidades, claseDeEvidencia, extension, fuentesDePuntos, presenciaPorEspecie, puntosDeLocalidades, riqueza } from '@/lib/atlasSpecies.mjs';
import { escribirUrl, leerUrl } from '@/lib/atlasUrl.mjs';
import { capasDelRegistro, desenvolver, geojsonDeCapa, getJson, liveOrBuild, organizacionesComoPuntos, organizacionesEnVivo } from '@/lib/hubLive.mjs';
import { IUCN_GROUPS } from '@/components/species/strings';
import { DetailDrawer, type Tab } from './DetailDrawer';
import { Hud, ICONOS, tituloInstalaciones } from './Hud';
import { capacidades, type Capacidades } from './CapIcons';
import { IndexDrawer, type Agrupar, type Trama } from './IndexDrawer';
import { ChipEspecie, NombreSinMapa, type InfoEspecie } from './EspecieChip';
import { render } from 'preact';
import { hexa, Legend } from './Legend';
import { StatePop } from './StatePop';
import { uiText } from './uiText';
import { imagenSdf, PARTES_FONDO, numeroDeCumulo } from './Marcadores';
import { TarjetaOrg, type CadenaXolotlcalli, type ClipsXolotlcalli, type FichaXolotlcalli, type OrgVista } from './TarjetaOrg';
import { vistaDeHub, vistaDeXolotlcalli } from '@/lib/fichaOrg.mjs';
import { FiltrosInstalaciones, etiquetaTipo, etiquetaLegal, expansionFigura, type EtiquetasInstalaciones } from './Pictograma';
import { ORIGEN_ICONOS } from '@/lib/iconosInstalaciones.mjs';
import { TIPOS_RECINTO, tipoDe, figuraDe, cerradaDe, codigoLegalDe, prepararInstalaciones, lugares, separar, instalacionesDeEspecie } from '@/lib/atlasInstalaciones.mjs';
import type { CardLayer, Ciclo, Colorear, Fc, Ficha, Item, Snap, Status } from './types';
import './atlas.css';

interface Props {
  locale: Locale;
  /** Base URL of the AxoloDAO registry (hub). Empty when the site is built without one. */
  hubUrl: string;
  /** Build-time flag: the CC BY-NC layers may be shown. Off by default and off in kiosk mode whatever this says. */
  ncFlag: boolean;
  /** `YYYY-MM-DD` of the data the build carries, shown on the registry layer. */
  builtAt: string;
  /** How often the registry layer is read again, in ms (30 s; a test build uses less). */
  pollMs?: number;
  /** What the site itself knows of each species (common names, accent colour, whether it has a page of its own). */
  sitio: Record<string, { commonNames?: string[]; accentColor?: string; description?: string; feeding?: string }>;
  /** The path the species pages live under, with its trailing slash. */
  speciesPathBase: string;
  /** 'especies' is /especies: the atlas with the species index open from the start */
  vista?: 'atlas' | 'especies';
}

interface Metricas { metricas: { id: string; title: Record<Locale, string> }[]; estados: Record<string, any> }

// The first view is North America; the map itself runs over the admin-1 units of MX, US and CA.
const VISTA = { escritorio: [[-134, 14], [-62, 53]], telefono: [[-130, 10], [-62, 60]] } as Record<string, [[number, number], [number, number]]>;
const CAPAS_MAPA: Record<string, string[]> = {
  'rios-lagos': ['rios-linea', 'lagos-relleno'],
  'limites-admin1': ['estados-linea'],
  'instalaciones-catalogadas': ['instalaciones-halo', 'instalaciones-fondo', 'instalaciones-anillo', 'instalaciones-puntos', 'instalaciones-cumulo', 'instalaciones-cumulo-n'],
  'uma-extensivas': ['uma-grupos', 'uma-puntos'],
  'sitios-conagua-2013': ['agua-grupos', 'agua-puntos'],
  'organizaciones-registradas': ['organizaciones-registradas'],
};
const FUENTE_DE: Record<string, string> = { 'uma-extensivas': 'uma', 'sitios-conagua-2013': 'agua', 'instalaciones-catalogadas': 'instalaciones', 'organizaciones-registradas': 'organizaciones' };
const LOCALIDADES = ['rangos-relleno', 'localidades-area', 'localidades-area-trama', 'localidades-lago', 'localidades-punto', 'localidades-lago-trama', 'localidades-punto-trama'];
const CUMULOS = ['instalaciones-cumulo'];
const PUNTOS = ['instalaciones-fondo', 'instalaciones-anillo', 'instalaciones-puntos', 'uma-puntos', 'agua-puntos', 'organizaciones-registradas'];
const CAPA_DE_COLOREAR: Record<Colorear, string> = { ninguno: 'especies', riqueza: 'riqueza', metrica: 'metrica' };
const COLOREAR_DE_CAPA: Record<string, Colorear> = { especies: 'ninguno', riqueza: 'riqueza', metrica: 'metrica' };
const MUESTRA = '/atlas/sample';   // the synthetic NC points only
/** Build-time flag, never a prop of the page: with it off the sample branch below is dead code and the bundle carries neither the branch nor the path. */
const muestra = import.meta.env.PUBLIC_ATLAS_SAMPLE === '1';
const REAL = '/atlas/real';        // Site & Data's phase-0 bundle b38afe8b0710, read through scripts/proto/import-real.mjs
const PEEK = 132;
/** The full-cycle organization card is built but OFF: it switches on, at build time, the day the agreement text and the ruling land (PUBLIC_ATLAS_CICLO=1). */
/** The Clips tab is built but OFF: it exists only in the DEMO build (PUBLIC_ATLAS_CLIPS=1), from a static snapshot of already-public, confirmed clips; the visitor's browser never calls Xovi. */
const CLIPS_ENCENDIDO = (import.meta as any).env?.PUBLIC_ATLAS_CLIPS === '1';
/** The booth profile (PUBLIC_ATLAS_STAND=1): what the IP review ruled the stand may show of the pilot's card and nothing more. It implies the card and the pilot's figures, never the treasury row, and has no ENS row. */
const STAND = (import.meta as any).env?.PUBLIC_ATLAS_STAND === '1';
/** The axolodao.org profile (PUBLIC_ATLAS_SITIO=1): the card of the pilot and the template card, with the stand's guards on the data (form-(b) treasury, ENS label, the IP review's figures) and no demo banner. Its data files are copied in by `npm run build:sitio`. */
const SITIO = (import.meta as any).env?.PUBLIC_ATLAS_SITIO === '1';
const CICLO_ENCENDIDO = (import.meta as any).env?.PUBLIC_ATLAS_CICLO === '1' || STAND || SITIO;
/** The pilot's treasury row, in the shape of the demo's file, exists only where this flag is on (PUBLIC_ATLAS_TESORERIA=1, the demo on 4457/4461). OFF by default and never set at the booth; the stand has its own treasury row, from its own file, behind the view model's guard. */
const TESORERIA_ENCENDIDA = (import.meta as any).env?.PUBLIC_ATLAS_TESORERIA === '1' && !STAND && !SITIO;
/** The pilot's IRC and survival at the booth, with the wording the IP review ruled: OFF until the museum's written approval is filed (PUBLIC_ATLAS_CIFRAS_PILOTO=1). */
const CIFRAS_PILOTO_ENCENDIDO = (import.meta as any).env?.PUBLIC_ATLAS_CIFRAS_PILOTO === '1' || STAND || SITIO;
const mesDeCierre = (aaaamm: string, loc: string) => { const d = new Date(`${aaaamm.slice(0, 7)}-01T00:00:00Z`); return Number.isNaN(+d) ? aaaamm : new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d); };

const el = (tag: string, texto?: string, cls?: string) => {
  const n = document.createElement(tag);
  if (texto !== undefined) n.textContent = texto;
  if (cls) n.className = cls;
  return n;
};
/** The species a facility row names, as chips of the map's own species component: the colour and texture of its range, its label and status badge, and a click that opens its drawer; a name the atlas does not know stays plain italic text. */
const listaEspecies = (texto: string, V: any, abrir: (slug: string) => void) => {
  const lista = el('div', undefined, 'at-sp-lista');
  String(texto).split(';').map((t) => t.trim()).filter(Boolean).forEach((t) => {
    const host = el('span', undefined, 'at-sp-host');
    const info: InfoEspecie | null = V.infoEspecie ? V.infoEspecie(t) : null;
    render(info ? <ChipEspecie e={info} onPick={abrir} tituloBadge={V.ui.systems.iucn} /> : <NombreSinMapa texto={t} />, host);
    lista.appendChild(host);
  });
  return lista;
};
/** The picture a textured species is drawn with: a tile of fine diagonal hatching, dots or a cross-hatch in its colour (areas), or a small disc carrying the same texture (points). */
function imagenDeTrama(id: string, color: string, tipo: Trama) {
  const punto = id.startsWith('pt-');
  const px = 2, w = (punto ? 16 : 8) * px;
  const c = document.createElement('canvas'); c.width = w; c.height = w;
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  x.lineWidth = 1.1 * px; x.strokeStyle = color; x.fillStyle = color;
  if (punto) { x.beginPath(); x.arc(w / 2, w / 2, w / 2 - 2 * px, 0, Math.PI * 2); x.fillStyle = 'rgba(6,23,30,.62)'; x.fill(); x.save(); x.clip(); x.fillStyle = color; }
  const t = punto ? 4 * px : w;                                    // the tile of the texture
  const lineas = (inv: boolean) => { for (let ox = -w; ox <= w * 2; ox += t) { x.beginPath(); inv ? (x.moveTo(ox, 0), x.lineTo(ox + w, w)) : (x.moveTo(ox, w), x.lineTo(ox + w, 0)); x.stroke(); } };
  if (tipo === 'rayas') lineas(false);
  else if (tipo === 'cuadros') { lineas(false); lineas(true); }
  else for (let ox = t / 2; ox < w + t; ox += t) for (let oy = t / 2; oy < w + t; oy += t) { x.beginPath(); x.arc(ox, oy, 1.25 * px, 0, Math.PI * 2); x.fill(); }
  if (punto) { x.restore(); x.beginPath(); x.arc(w / 2, w / 2, w / 2 - 2 * px, 0, Math.PI * 2); x.lineWidth = 1.2 * px; x.strokeStyle = color; x.stroke(); }
  return x.getImageData(0, 0, w, w);
}
/** The full-cycle card as a popup body (the DEMO build only: the flag is off elsewhere). Name, place, type, opening and closing dates, «ciclo completo», the ENS label (a label: nothing resolves it), the closure page. */
function tarjetaCiclo(c: Ciclo, ui: any, text: any) {
  const caja = el('div', undefined, 'at-ciclo at-ciclo-pop'); caja.dataset.cicloCard = '';
  caja.appendChild(el('strong', c.nombre));
  const lin = (k: string, v: string) => { const d = el('div'); d.appendChild(el('b', `${k}: `)); d.appendChild(document.createTextNode(v)); return d; };
  const etapa = el('div', undefined, 'at-ciclo-e'); etapa.appendChild(el('span', ui.cicloPiloto, 'at-ciclo-b')); etapa.appendChild(el('span', ui.cicloEstado, 'at-ciclo-b')); caja.appendChild(etapa);
  caja.appendChild(lin(text.municipality, `${c.municipio}, ${c.estado}`)); caja.appendChild(lin(text.facility, c.tipo));
  caja.appendChild(lin(ui.cicloRegistro, c.registro)); caja.appendChild(lin(ui.cicloCierre, c.cierre)); caja.appendChild(lin(ui.cicloEns, c.ens));
  if (/^https:\/\//.test(c.enlace)) { const a = el('a', ui.cicloEnlace) as HTMLAnchorElement; a.href = c.enlace; a.rel = 'noopener noreferrer'; a.target = '_blank'; caja.appendChild(a); }
  return caja;
}
/** The screen radius of a locality marker by zoom: `P` for a point at every zoom; `Z` for a zone up to the zoom where its real extent (about 27 km of radius, 0.365·2^zoom px at 19° N) reaches `Z`, and the real extent above it. */
export const radioMarcador = (zona: any, P: number, Z: number, k = 1) => {
  const zoomReal = Math.log2(Z / 0.365);
  return ['interpolate', ['exponential', 2], ['zoom'], 0, ['case', zona, Z * k, P * k], zoomReal, ['case', zona, Z * k, P * k], 12, ['case', zona, Z * k * 2 ** (12 - zoomReal), P * k]];
};
/** The name of an admin-1 unit from the admin1 data; where that data gives the state the country's own name («México» for MX-MEX) the state is spelled out, until the data does it. */
const nombreDeEstado = (pr: any, loc: string) => { const dato = (loc === 'en' ? pr.nameEn : pr.nameEs) ?? pr.iso; return pr.iso === 'MX-MEX' && /^m[eé]xico$/i.test(dato) ? (loc === 'en' ? 'State of Mexico' : loc === 'pt' ? 'Estado do México' : 'Estado de México') : dato; };
const esTelefono = () => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 720px)').matches;
const sinMovimiento = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/**
 * The first view: where records exist, from southern Canada to southern Mexico. It is the box around the centre of every unit with a confirmed or weak record
 * and around the drawn localities, a few degrees wider; Alaska and Hawaii stay on the map but do not stretch the frame.
 */
function vistaInicial(presencia: Record<string, Record<string, string>>, admin1: Fc, locFc: Fc | null, recortar = false): [[number, number], [number, number]] {
  const riq = riqueza(presencia) as { fuerte: Record<string, number>; debil: Record<string, number> };
  const cajas = cajasDeUnidades(admin1) as Record<string, number[]>;
  const centros = Object.keys({ ...riq.fuerte, ...riq.debil }).filter((iso) => cajas[iso] && !['US-AK', 'US-HI'].includes(iso)).map((iso) => { const [w, s, e, n] = cajas[iso]; return [(w + e) / 2, (s + n) / 2, (w + e) / 2, (s + n) / 2]; });
  // on a narrow phone the whole range would leave Mexico a few millimetres wide: the frame then drops the outermost eighth of the units on each side
  // (the far west of Canada and the far east of the Atlantic provinces), which stay on the map and one swipe away
  let usados = centros;
  if (recortar && centros.length > 12) { const orden = [...centros].sort((p, q) => p[0] - q[0]); const k = Math.floor(orden.length * 0.08); usados = orden.slice(k, orden.length - k); }
  const a = extension(usados, null), b = locFc ? extension([], locFc) : null;
  const ext = a && b ? unir(a, b) : (a ?? b);
  return ext ? [[ext[0][0] - 5, Math.max(ext[0][1] - 4, -5)], [ext[1][0] + 5, Math.min(ext[1][1] + 4, 80)]] : VISTA.escritorio;
}
const unir = (a: number[][], b: number[][]) => [[Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])], [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])]] as [[number, number], [number, number]];

/** The smallest and the largest species of the genus by total length (the highest cited maximum or mean), with the note of the row that gives it. Species with no cited total length are not ranked. */
function extremosDelGenero(fichas: Record<string, Ficha>) {
  const total = (rows: Ficha['medidas']) => { const v = rows.filter((m) => m.measure === 'total_length').map((m) => ({ mm: (m.max ?? m.mean) as number, note: m.note ?? null, source: m.source })).filter((x) => typeof x.mm === 'number'); return v.length ? v.sort((a, b) => b.mm - a.mm)[0] : null; };
  const con = Object.entries(fichas).map(([slug, f]) => ({ slug, ...total(f.medidas ?? []) })).filter((x) => typeof x.mm === 'number') as { slug: string; mm: number; note: string | null; source: string }[];
  con.sort((a, b) => a.mm - b.mm);
  return con.length ? { menor: con[0], mayor: con[con.length - 1], n: con.length } : null;
}

export default function Atlas({ locale, hubUrl, ncFlag, builtAt, pollMs = 30000, sitio, speciesPathBase, vista = 'atlas' }: Props) {
  const text = atlasText[locale];
  const ui = uiText[locale];
  const raiz = useRef<HTMLDivElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<any>(null);
  const listo = useRef(false);
  const popup = useRef<any>(null);
  const maplibre = useRef<any>(null);
  const vistaIsos = useRef<string[]>([]);
  const marcas = useRef<any[]>([]);
  const yaAjustado = useRef(false);
  const vistaFijada = useRef(false);
  const ignorarPop = useRef(false);
  const devolverFoco = useRef<HTMLElement | null>(null);
  const sinVistaPrevia = useRef(false);
  const avisoReloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- data (same origin; nothing external): the cards are committed, the data is the build's snapshot of the hub (src/pages/atlas/datos/[archivo].ts)
  const [manifest, setManifest] = useState<{ capas: any[] } | null>(null);
  const [snap, setSnap] = useState<any>(null);
  const [rangos, setRangos] = useState<Fc | null>(null);
  const [puntosLoc, setPuntosLoc] = useState<Fc | null>(null);
  const [muestras, setMuestras] = useState<{ vecinos: Record<string, string[]>; colores: any; fichas: Record<string, Ficha>; agua: Fc } | null>(null);
  const [admin1, setAdmin1] = useState<Fc | null>(null);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [instalaciones, setInstalaciones] = useState<Fc | null>(null);
  // the labels of the facility types and legal figures (es, en, pt, as data) and the chips that switch types and figures off (all on by default)
  const [etiquetasInst, setEtiquetasInst] = useState<EtiquetasInstalaciones | null>(null);
  const [ocultosTipo, setOcultosTipo] = useState<Set<string>>(new Set());
  const [ocultasFigura, setOcultasFigura] = useState<Set<string>>(new Set());
  const [ciclo, setCiclo] = useState<Ciclo | null>(null);
  // the full card of the pilot (DEMO only): Site & Data's ficha and the fixed snapshot of the confirmed clips; open from the pilot's closed ring
  const [fichaX, setFichaX] = useState<FichaXolotlcalli | null>(null);
  const [clipsX, setClipsX] = useState<ClipsXolotlcalli | null>(null);
  const [cadenaX, setCadenaX] = useState<CadenaXolotlcalli | null>(null);
  const [aprobadosX, setAprobadosX] = useState<any>(null);
  const [carta, setCarta] = useState(false);
  const [cartaOrg, setCartaOrg] = useState<string | null>(null);
  const [listaOrgs, setListaOrgs] = useState<any[]>([]);
  const [semanasOrg, setSemanasOrg] = useState<Record<string, any>>({});
  const [fuentesPuntos, setFuentesPuntos] = useState<Record<string, { estado: string | null; corta: string; completa: string; licencia?: string | null; sitio: boolean; pagina: number | null; corroborado: string | null }[]>>({});
  const [clips, setClips] = useState<Record<string, { id: string; credito: string | null; fecha: string | null; poster: string | null }[]>>({});
  useEffect(() => { if (CLIPS_ENCENDIDO) getJson(`${REAL}/clips.json`).then(setClips).catch(() => setClips({})); }, []);
  const [etapas, setEtapas] = useState<Record<string, Record<string, string>>>({});
  useEffect(() => { if (CICLO_ENCENDIDO && !STAND && !SITIO) getJson(`${REAL}/organizacion-ciclo.json`).then(setCiclo).catch(() => setCiclo(null)); }, []);
  // at the stand the pilot's cycle file is not served (it names the museum and its ENS label): the ring that opens the card is told by id
  const cicloClic = ciclo ?? (STAND || SITIO ? ({ facilidad: 'mx-qro-xolotlcalli' } as unknown as Ciclo) : null);
  useEffect(() => { if (CICLO_ENCENDIDO) { getJson(`${REAL}/xolotlcalli-ficha.json`).then(setFichaX).catch(() => setFichaX(null)); getJson(`${REAL}/xolotlcalli-clips.json`).then(setClipsX).catch(() => setClipsX(null)); getJson(`${REAL}/xolotlcalli-cadena.json`).then((c) => setCadenaX(TESORERIA_ENCENDIDA || STAND || SITIO ? c : { ...c, filas: (c.filas ?? []).filter((f: any) => f.id !== 'tesoreria') })).catch(() => setCadenaX(null)); getJson('/atlas/layers/organizaciones-semanas.json').then(setSemanasOrg).catch(() => setSemanasOrg({})); if (STAND) getJson(`${REAL}/xolotlcalli-clips-aprobados.json`).then(setAprobadosX).catch(() => setAprobadosX(null)); } }, []);

  // -- what the person has chosen
  // what colours the states: nothing (the default), the richness of species, or the facilities-per-state metric. One at a time; a species shown on the map overrides it while it is shown.
  const [colorear, setColorear] = useState<Colorear>('ninguno');
  const [metric, setMetric] = useState('especies_ambystoma_pace');
  const [visible, setVisible] = useState<Record<string, boolean>>({ 'limites-admin1': false, 'rios-lagos': false, 'organizaciones-registradas': true });
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [orgs, setOrgs] = useState<{ fc: Fc; live: boolean; date: string }>({ fc: { type: 'FeatureCollection', features: [] }, live: false, date: builtAt });
  const [conteos, setConteos] = useState<Record<string, number>>({});       // features each source holds (read by scripts/test-atlas.mjs)
  const [citas, setCitas] = useState<Record<string, string>>({});
  const [sinWebgl, setSinWebgl] = useState(false);
  const [phone, setPhone] = useState(esTelefono);
  const [popGrupo, setPopGrupo] = useState<string | null>(null);
  const [especie, setEspecie] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [primed, setPrimed] = useState<string | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [estadoPop, setEstadoPop] = useState<{ iso: string; x: number; y: number } | null>(null);
  const [indice, setIndice] = useState(false);
  const [panelTab, setPanelTab] = useState<'especies' | 'instalaciones'>('especies');
  const [detalle, setDetalle] = useState(false);
  const [snapI, setSnapI] = useState<Snap>('half');
  const [snapD, setSnapD] = useState<Snap>('half');
  const [tab, setTab] = useState<Tab>('resumen');
  const [expandida, setExpandida] = useState(false);
  const [grupo, setGrupo] = useState<Agrupar>('pais');
  const [iucn, setIucn] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filtros, setFiltros] = useState(false);
  const [leyenda, setLeyenda] = useState(() => !esTelefono());
  const [aviso, setAviso] = useState<string | null>(null);
  const kiosko = useMemo(() => typeof location !== 'undefined' && new URLSearchParams(location.search).get('kiosko') === '1', []);
  // the NC layers (CONABIO) may be shown in the public atlas; never in kiosk mode, and never in a promotional capture
  const ncEnabled = ncFlag && !kiosko && (!!hubUrl || muestra);

  useEffect(() => {
    Promise.all([getJson('/atlas/layers/manifest.json'), getJson('/atlas/datos/especies-atlas.json'), getJson('/atlas/datos/admin1.geojson'),
      getJson('/atlas/datos/estados-metricas.json'), getJson('/atlas/datos/instalaciones-catalogadas.geojson'),
      getJson(`${REAL}/rangos.geojson`), getJson('/atlas/datos/especies-localidades.geojson'), getJson(`${REAL}/vecinos.json`), getJson(`${REAL}/colores.json`), getJson(`${REAL}/fichas.json`), getJson(`${REAL}/agua.geojson`), getJson(`${REAL}/etapas.json`), getJson('/atlas/layers/etiquetas-instalaciones.json').catch(() => null)])
            .then(([m, s, a, e, i, r, lo, v, c, f, ag, et, ei]) => { setEtiquetasInst(ei); setEtapas(et); setFuentesPuntos(fuentesDePuntos(lo)); setManifest(m); setSnap(s); setAdmin1(a); setMetricas(e); setInstalaciones(i); setRangos(r); setPuntosLoc(puntosDeLocalidades(lo)); setMuestras({ vecinos: v, colores: c, fichas: f, agua: ag }); })
      .catch(() => setStatus((s) => ({ ...s, base: 'error' })));
  }, []);
  useEffect(() => {
    const mq = matchMedia('(max-width: 720px)');
    const al = () => setPhone(mq.matches);
    mq.addEventListener?.('change', al);
    return () => mq.removeEventListener?.('change', al);
  }, []);

  const cards: CardLayer[] = useMemo(() => (manifest?.capas ?? []).map((c: any) => ({
    id: c.id, grupo: c.grupo, kind: c.kind, flag: c.flag, lazy: c.lazy, download: false, title: c.title[locale], note: c.note[locale], aviso: c.aviso?.[locale], source: c.source[locale],
    licenceLabel: c.licence.label[locale], licenceId: c.licence.id, attribution: c.attribution?.[locale], lastDataText: c.lastDataText ?? '', retrievedAt: c.retrievedAt ?? '',
  })), [manifest, locale]);

  // -- the species: the snapshot's taxa, what the site knows of them, and what the map needs per unit and per species
  const D = useMemo(() => {
    if (!snap || !rangos || !muestras || !admin1) return null;
    const pal = muestras.colores;   // colour by geography (scripts/proto/palette-geo.mjs): {species: hex}
    const presencia = presenciaPorEspecie(snap);
    const items: Item[] = snap.especies.map((t: any) => ({
      slug: t.slug, t, accent: pal.hues[pal.porEspecie[t.slug]] ?? sitio[t.slug]?.accentColor ?? acento(t.slug), common: sitio[t.slug]?.commonNames ?? [], hasPage: !!sitio[t.slug], descripcion: sitio[t.slug]?.description, alimentacion: sitio[t.slug]?.feeding,
      iucn: t.categories.find((c: any) => c.system === 'iucn' && c.scope === 'global')?.category, countries: t.countries,
    })).sort((a: Item, b: Item) => a.slug.localeCompare(b.slug));
    return {
      presencia, riq: riqueza(presencia), items, porSlug: Object.fromEntries(items.map((i) => [i.slug, i])) as Record<string, Item>,
      nombreDe: Object.fromEntries(admin1.features.map((f: any) => [f.properties.iso, nombreDeEstado(f.properties, locale)])) as Record<string, string>,   // «México» alone would read as the country
      isos: admin1.features.map((f: any) => f.properties.iso as string), cajas: cajasDeUnidades(admin1) as Record<string, number[]>,
      rangosPor: Object.fromEntries(items.map((i) => [i.slug, rangos.features.filter((f: any) => f.properties.slug === i.slug)])) as Record<string, any[]>, vecinos: muestras.vecinos, tinta: pal.tinta as Record<string, string>, matiz: pal.porEspecie as Record<string, string>,
      extremos: extremosDelGenero(muestras.fichas), fuentes: Object.fromEntries(snap.fuentes.map((f: any) => [f.key, f])) as Record<string, any>,
      inicial: vistaInicial(presencia, admin1, rangos), inicialTel: vistaInicial(presencia, admin1, rangos, true),
      colorPorSlug: ['match', ['get', 'slug'], ...items.flatMap((i) => [i.slug, i.accent]), '#f4e8c8'],
      // the species whose colour sits close to a neighbour's carry a texture (scripts/proto/palette-geo.mjs); what each species can do is read from its grid traits
      tramas: (pal.patron ?? {}) as Record<string, Trama>, rampas: pal.rampas as Record<string, string>,
      caps: Object.fromEntries(items.map((i) => [i.slug, capacidades(muestras.fichas[i.slug])])) as Record<string, Capacidades>,
    };
  }, [snap, rangos, muestras, admin1, sitio, locale]);

  // -- the value of each unit for the fill that is on
  const valores = useMemo(() => {
    const out: Record<string, number | null> = {};
    if (!D) return out;
    if (colorear !== 'metrica') for (const iso of D.isos) out[iso] = (D.riq.fuerte[iso] ?? 0) + (D.riq.debil[iso] ?? 0);
    else if (metricas) for (const [iso, v] of Object.entries(metricas.estados)) out[iso] = typeof v[metric] === 'number' ? v[metric] : null;
    return out;
  }, [colorear, metric, D, metricas]);
  const [min, max] = useMemo(() => {
    const v = Object.values(valores).filter((x): x is number => typeof x === 'number');
    return v.length ? [Math.min(...v), Math.max(...v)] : [0, 0];
  }, [valores]);

  // -- the index
  const lista = useMemo(() => {
    if (!D) return [];
    const texto = q.trim().toLowerCase();
    const grupoIucn = IUCN_GROUPS.find((g) => g.key === iucn);
    return D.items.filter((s) => {
      if (grupoIucn && !(grupoIucn.codes as readonly string[]).includes(s.iucn ?? '')) return false;
      if (estado && !D.presencia[s.slug]?.[estado]) return false;
      if (texto && !`${s.t.scientificName} ${s.common.join(' ')}`.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [D, q, iucn, estado]);

  const vistaSlug = hover ?? primed ?? especie;
  // a species the pointer rests on for a moment is brought into frame; it goes back to the overview when the pointer leaves
  const [hoverFit, setHoverFit] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => setHoverFit(hover), hover ? 260 : 140); return () => clearTimeout(t); }, [hover]);
  const metricasLista = (metricas?.metricas ?? []).map((m) => ({ id: m.id, title: m.title[locale] }));
  const etiqueta = colorear === 'metrica' ? (metricasLista.find((m) => m.id === metric)?.title ?? '') : ui.legendRichness;

  // The handlers the map registers once read the latest of everything through this ref, so they are never stale.
  // a species named in a text (a facility row, a card) as the map knows it: its colour, texture and status badge are the index's own; a name that is not in the atlas goes through the taxonomy's synonyms to its accepted species, and a name with neither match is left as plain text
  const infoEspecie = (texto: string): InfoEspecie | null => {
    if (!D) return null;
    const k = String(texto).trim().toLowerCase().replace(/^ambystoma[ _]/, '');
    const sin = (manifest as any)?.sinonimos?.[k];
    const slug = D.porSlug[k] ? k : sin && D.porSlug[sin] ? sin : null;
    if (!slug) return null;
    const it = D.porSlug[slug];
    return { slug, accent: it.accent, trama: D.tramas[slug], iucn: it.iucn };
  };
  const vivo = useRef<any>({});
  vivo.current = { ciclo: CICLO_ENCENDIDO && !kiosko ? cicloClic : null, D, text, ui, locale, estado, indice, detalle, snapI, snapD, phone, valores, colorear, metric, metricas, especie, primed, vistaSlug, etiquetasInst, fichaX, infoEspecie };

  const cuandoListo = (fn: () => void) => {
    const m = mapa.current;
    if (!m) return;
    if (listo.current) fn(); else m.once('load', fn);
  };

  // -- the map: MapLibre is loaded only here, on demand
  useEffect(() => {
    let vivoMapa = true;
    (async () => {
      try {
        const [{ default: maplibregl }] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]);
        if (!vivoMapa || !contenedor.current) return;
        const tel = esTelefono();
        const map = new maplibregl.Map({ container: contenedor.current, style: baseStyle() as any, bounds: VISTA[tel ? 'telefono' : 'escritorio'], fitBoundsOptions: { padding: tel ? { top: 72 + 80, bottom: 16, left: 8, right: 8 } : { top: 12 + 80, bottom: 12, left: 12, right: 12 } },
          minZoom: 1.5, maxZoom: 10, maxBounds: [[-260, -45], [40, 88]], attributionControl: false, dragRotate: false, cooperativeGestures: false });
        map.touchZoomRotate.disableRotation();
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('styleimagemissing', (e: any) => {
          if (e.id === 'rayas-debil') { map.addImage('rayas-debil', rayasDebil()); return; }
          if (/^inst-n-\d+$/.test(e.id)) { map.addImage(e.id, numeroDeCumulo(e.id.slice(7)), { pixelRatio: 2 }); return; }
          if (e.id.startsWith('inst-')) { const t = e.id.slice(5); if (TIPOS_RECINTO.includes(t) || PARTES_FONDO.includes(t)) map.addImage(e.id, imagenSdf(t), { pixelRatio: 2, sdf: true }); return; }
          const m = /^(trama|pt)-(.+)$/.exec(e.id);
          const D0 = vivo.current.D;
          if (m && D0?.tramas[m[2]] && D0.porSlug[m[2]]) map.addImage(e.id, imagenDeTrama(e.id, D0.porSlug[m[2]].accent, D0.tramas[m[2]]), { pixelRatio: 2 });
        });
        mapa.current = map;
        (contenedor.current as any).__map = map;       // read by scripts/test-atlas.mjs
        maplibre.current = maplibregl;
        map.on('load', () => { map.resize(); listo.current = true; setStatus((s) => ({ ...s, mapa: 'ready' })); });
        map.on('mousemove', 'estados-relleno', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'estados-relleno', () => { map.getCanvas().style.cursor = ''; });
      } catch {
        if (vivoMapa) setSinWebgl(true);
      }
    })();
    return () => { vivoMapa = false; mapa.current?.remove(); mapa.current = null; listo.current = false; };
  }, []);

  // A locality a source names as a place is a POINT and nothing else: the 0.5° square the cell was rasterised to is not drawn where the species has points. The squares stay for the species whose
  // cells are an area (the blob cells of altamirani and ordinarium); they still serve the camera, the neighbour graph and the colour of the species.
  const conPunto = useMemo(() => new Set<string>((puntosLoc?.features ?? []).filter((f: any) => f.properties.kind === 'cell').map((f: any) => f.properties.slug)), [puntosLoc]);
  const conArea = useMemo(() => new Set<string>((puntosLoc?.features ?? []).filter((f: any) => f.properties.kind === 'area').map((f: any) => f.properties.slug)), [puntosLoc]);
  const conLocalidad = useMemo(() => new Set<string>((puntosLoc?.features ?? []).map((f: any) => f.properties.slug)), [puntosLoc]);   // a species whose cells are drawn from the attested localities does not also show the cell squares of its range
  // the ranges the legend and the sheet show for a species: the same rule for both. The range squares of a species whose cells come from the attested localities are not shown, and the range file's lake markers
  // (places the attested file does not name) are never shown; a lake outline stays a range.
  const rangoVisible = (slug: string) => (D?.rangosPor[slug] ?? []).filter((f: any) => f.properties.kind !== 'lake' && !(f.properties.method === 'cells_0.5deg' && conLocalidad.has(slug)));
  const rangosMapa = useMemo(() => {
    if (!rangos || !puntosLoc) return null;
    return { type: 'FeatureCollection', features: rangos.features.filter((f: any) => f.properties.kind !== 'lake' && !(f.properties.kind === 'range' && f.properties.method === 'cells_0.5deg' && conLocalidad.has(f.properties.slug))) } as Fc;
  }, [rangos, puntosLoc, conLocalidad]);
  // sources
  useEffect(() => { if (rangosMapa) cuandoListo(() => { mapa.current.getSource('rangos')?.setData(rangosMapa); setConteos((c) => ({ ...c, rangos: rangosMapa.features.length })); }); }, [rangosMapa, status.mapa]);
  useEffect(() => { if (muestras) cuandoListo(() => mapa.current.getSource('aguaNatural')?.setData(muestras.agua)); }, [muestras, status.mapa]);
  useEffect(() => { if (puntosLoc) cuandoListo(() => { mapa.current.getSource('puntosLoc')?.setData(puntosLoc); setConteos((c) => ({ ...c, localidadesPts: puntosLoc.features.length })); }); }, [puntosLoc, status.mapa]);
  // (no dots at the centre of a range: they read as localities and are not data)
  // the overview: every range in its species colour (a low fill and an outline), a dot at its centre; the colours follow the palette on show
  useEffect(() => {
    if (!D) return;
    cuandoListo(() => {
      const m = mapa.current;
      m.setPaintProperty('rangos-general', 'fill-color', D.colorPorSlug); m.setPaintProperty('rangos-tenue', 'line-color', D.colorPorSlug); m.setPaintProperty('localidades-punto', 'circle-color', D.colorPorSlug); m.setPaintProperty('localidades-lago', 'circle-color', D.colorPorSlug);
    });
  }, [D, status.mapa]);
  // the facilities the chips leave on; each carries its type and legal figure for the marker layers, and a SCREEN offset so markers at one place or close together do not hide each other:
  // the offset is pixels for the layers (`icon-offset`), worked out again at every zoom; the GeoJSON and its coordinates are never changed.
  // a closed row has no type and no legal figure to tell apart (its popup is name, place and date): it is in no chip's count and no chip switches it off
  const instVisibles = useMemo(() => instalaciones && ({ ...instalaciones, features: instalaciones.features.filter((f: any) => cerradaDe(f.properties) || (!ocultosTipo.has(tipoDe(f.properties)) && !ocultasFigura.has(figuraDe(f.properties)))) } as Fc), [instalaciones, ocultosTipo, ocultasFigura]);
  useEffect(() => {
    if (!instVisibles) return;
    let fuera = false;
    const aplicar = () => {
      const m = mapa.current;
      if (!m || fuera) return;
      const coords = instVisibles.features.map((f: any) => f.geometry.coordinates as [number, number]);
      const anclas = coords.map((c) => { const q = m.project(c); return [q.x, q.y] as [number, number]; });
      const desp = m.getZoom() >= 8.5 ? separar(anclas, coords) : coords.map(() => [0, 0] as [number, number]);
      m.getSource('instalaciones')?.setData(prepararInstalaciones(instVisibles, desp));
      m.getSource('instalacionesLugares')?.setData(lugares(instVisibles));
    };
    cuandoListo(() => { aplicar(); mapa.current?.on('zoomend', aplicar); });
    return () => { fuera = true; try { mapa.current?.off('zoomend', aplicar); } catch { /* the map is gone */ } };
  }, [instVisibles, status.mapa]);
  const tiposDeInst = useMemo(() => { const o: Record<string, number> = {}; for (const f of (instalaciones?.features ?? []) as any[]) { if (cerradaDe(f.properties)) continue; const t = tipoDe(f.properties); o[t] = (o[t] ?? 0) + 1; } return o; }, [instalaciones]);
  const figurasDeInst = useMemo(() => { const o: Record<string, number> = {}; for (const f of (instalaciones?.features ?? []) as any[]) { if (cerradaDe(f.properties)) continue; const t = figuraDe(f.properties); o[t] = (o[t] ?? 0) + 1; } return o; }, [instalaciones]);
  const alternarEn = (conj: Set<string>, poner: (s: Set<string>) => void, k: string) => { const n = new Set(conj); if (n.has(k)) n.delete(k); else n.add(k); poner(n); };

  // The states' colours. A species shown on the map (pointer, first tap or choice) turns every state fill off while it is shown: the species' own states are drawn by the layer above.
  // Leaving the species gives the states back exactly what the person had chosen, because the fill is a pure function of (species shown, richness on, metric on).
  useEffect(() => {
    if (!D) return;
    cuandoListo(() => {
      const rampa = colorear === 'metrica' ? RAMPA_INST : RAMPA;
      for (const iso of D.isos) {
        const c = vistaSlug || colorear === 'ninguno' ? SIN_DATO : colorDe(valores[iso] ?? null, min, max, rampa);
        mapa.current.setFeatureState({ source: 'estados', id: iso }, { color: c });
      }
    });
  }, [D, colorear, valores, min, max, status.mapa, vistaSlug]);

  // The species the map shows. Hovering a species, a first tap or choosing it all do the same: that species' area (its colour, a bold outline, its states tinted) and its points are drawn, and every other
  // species' area and point is hidden. The list's filters (status pills, search, state) also filter the map. Everything here is a pure function of (species shown, the list), so leaving the species
  // gives the previous view back exactly (B4).
  useEffect(() => {
    if (!D) return;
    cuandoListo(() => {
      const m = mapa.current;
      for (const iso of vistaIsos.current) { m.removeFeatureState({ source: 'estados', id: iso }, 'vista'); m.removeFeatureState({ source: 'estados', id: iso }, 'vistaLinea'); }
      vistaIsos.current = [];
      const filtradas = lista.length !== D.items.length;
      const it = vistaSlug ? D.porSlug[vistaSlug] : null;
      const color = it?.accent ?? '#f4e8c8';
      const debiles: string[] = [];
      const palido = hexa(color, 0.38);
      // a species with a range or a lake: its states are an outline (the area is the finding); a species with none: its states are the fill
      const conArea = !!vistaSlug && (D.rangosPor[vistaSlug]?.length ?? 0) > 0;
      for (const [iso, ev] of Object.entries(vistaSlug ? D.presencia[vistaSlug] ?? {} : {})) {
        const c = claseDeEvidencia(ev as string);
        m.setFeatureState({ source: 'estados', id: iso }, conArea ? { vistaLinea: c === 'other' ? palido : color } : { vista: c === 'other' ? palido : hexa(color, 0.55) });
        vistaIsos.current.push(iso);
        if (c === 'weak') debiles.push(iso);
      }
      m.setFilter('estados-debil', ['in', ['get', 'iso'], ['literal', conArea ? [] : debiles]]);
      m.setFilter('estados-vista-linea-debil', ['in', ['get', 'iso'], ['literal', conArea ? debiles : []]]);
      const propia = ['all', ['==', ['get', 'slug'], vistaSlug ?? ''], ['==', ['get', 'kind'], 'range']];
      m.setFilter('rangos-relleno', propia as any); m.setFilter('rangos-contorno', propia as any);
      m.setFilter('rangos-vecinos', ['==', ['get', 'slug'], ''] as any);                       // no neighbour outlines: the species alone
      // what is drawn: the listed species in the overview, the one species while one is shown (hover, tap or choice)
      const mostrar = vistaSlug ? [vistaSlug] : (filtradas ? lista : D.items).map((i) => i.slug);
      const trama = Object.keys(D.tramas);
      const lisas = mostrar.filter((x) => !trama.includes(x)), conTrama = mostrar.filter((x) => trama.includes(x));
      m.setFilter('rangos-general', ['all', ['==', ['get', 'kind'], 'range'], ['in', ['get', 'slug'], ['literal', vistaSlug ? [] : mostrar]]] as any);
      m.setFilter('rangos-tenue', ['all', ['==', ['get', 'kind'], 'range'], ['in', ['get', 'slug'], ['literal', vistaSlug ? [] : mostrar]]] as any);
      m.setFilter('rangos-trama', ['all', ['==', ['get', 'kind'], 'range'], ['in', ['get', 'slug'], ['literal', vistaSlug ? [] : conTrama]]] as any);
      m.setFilter('localidades-lago', ['all', ['==', ['get', 'kind'], 'lake'], ['in', ['get', 'slug'], ['literal', lisas]]] as any);
      m.setFilter('localidades-lago-trama', ['all', ['==', ['get', 'kind'], 'lake'], ['in', ['get', 'slug'], ['literal', conTrama]]] as any);
      m.setFilter('localidades-punto', ['all', ['==', ['get', 'kind'], 'cell'], ['in', ['get', 'slug'], ['literal', lisas]]] as any);
      m.setFilter('localidades-punto-trama', ['all', ['==', ['get', 'kind'], 'cell'], ['in', ['get', 'slug'], ['literal', conTrama]]] as any);
      // connected cells of the attested localities: an area and its outline, in the species colour
      m.setFilter('localidades-area', ['all', ['==', ['get', 'kind'], 'area'], ['in', ['get', 'slug'], ['literal', lisas]]] as any);
      m.setFilter('localidades-area-trama', ['all', ['==', ['get', 'kind'], 'area'], ['in', ['get', 'slug'], ['literal', conTrama]]] as any);
      m.setFilter('localidades-contorno', ['all', ['==', ['get', 'kind'], 'outline'], ['in', ['get', 'slug'], ['literal', mostrar]]] as any);
      m.setPaintProperty('localidades-area', 'fill-color', D.colorPorSlug); m.setPaintProperty('localidades-contorno', 'line-color', D.colorPorSlug);
      // MARKER SIZES. A point keeps one screen size at every zoom (7 px, 8 when one species is shown); a zone marker (a sensitive locality given as «centroide de celda ∩ estado», a point read off a printed
      // map) keeps a slightly larger one (9 px, 10) with its ring while its real extent (~27 km of radius) is smaller than that, and only above that zoom grows with the map to its real extent.
      const zona = ['==', ['get', 'zona'], true];
      const P = vistaSlug ? 8 : 7, Z = vistaSlug ? 10 : 9;
      m.setPaintProperty('localidades-punto', 'circle-radius', radioMarcador(zona, P, Z, 1));
      m.setLayoutProperty('localidades-punto', 'circle-sort-key', ['case', zona, 0, 1]);   // a big zone never hides a point drawn over it (or catches its hover)
      m.setPaintProperty('localidades-punto', 'circle-opacity', ['case', zona, 0.38, 0.95]);
      m.setPaintProperty('localidades-punto', 'circle-stroke-width', ['case', zona, 2.5, 1.2]);
      m.setPaintProperty('localidades-punto', 'circle-stroke-color', ['case', zona, D.colorPorSlug, '#06171e']);
      m.setPaintProperty('localidades-punto-trama', 'icon-opacity', ['case', zona, 0.55, 1]);
      m.setPaintProperty('localidades-lago', 'circle-radius', P);
      // the textured discs are pictures (a disc of 6 px of radius at icon-size 1): the same radii
      m.setLayoutProperty('localidades-punto-trama', 'symbol-sort-key', ['case', zona, 0, 1]); m.setLayoutProperty('localidades-punto-trama', 'icon-size', radioMarcador(zona, P, Z, 1 / 6)); m.setLayoutProperty('localidades-lago-trama', 'icon-size', P / 6);
      m.setPaintProperty('rangos-relleno', 'fill-color', color); m.setPaintProperty('rangos-contorno', 'line-color', color);
      marcas.current.splice(0).forEach((x) => x.remove());
      if (vistaSlug) {
        for (const f of puntosLoc?.features ?? []) {   // the lake labels are the attested named water bodies: «Localidad citada: <name>»
          if (f.properties.slug !== vistaSlug || f.properties.kind !== 'lake') continue;
          const b = el('button', `${ui.legendLocalityCited}: ${f.properties.name ?? ''}`, 'at-lake') as HTMLButtonElement;
          b.type = 'button'; b.dataset.lake = f.properties.name ?? '';
          b.addEventListener('click', (ev) => { ev.stopPropagation(); vivo.current.pick(vistaSlug); });
          marcas.current.push(new maplibre.current.Marker({ element: b, anchor: 'left', offset: [12, 0] }).setLngLat(f.geometry.coordinates).addTo(m));
        }
      }
    });
  }, [D, rangos, puntosLoc, vistaSlug, especie, lista, status.mapa]);

  // A point pulses when the pointer is on it and says what it is: a generalised location (a cell of about 50 km) or a place a source names. Points only; the areas have no tooltip.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const capas = ['localidades-punto', 'localidades-lago', 'localidades-punto-trama', 'localidades-lago-trama'];
    let ping: any = null, clave = '';
    const quitar = () => { ping?.remove(); ping = null; clave = ''; m.getCanvas().style.cursor = ''; };
    const alMover = (e: any) => {
      const f = e.features?.[0];
      if (!f) return;
      const [x, y] = f.geometry.coordinates;
      m.getCanvas().style.cursor = 'pointer';
      const k = `${f.properties.slug}|${x}|${y}`;
      if (k === clave) return;
      ping?.remove(); clave = k;
      const V = vivo.current;
      const lago = f.properties.kind === 'lake';
      const caja = el('div', undefined, 'at-ping');
      caja.appendChild(el('i', undefined, 'at-ring'));
      const tip = el('div', undefined, 'at-ptip'); tip.setAttribute('role', 'tooltip'); tip.dataset.ping = lago ? 'citada' : 'generalizada';
      tip.appendChild(el('em', `A. ${f.properties.slug}`));
      tip.appendChild(el('span', lago ? `${V.ui.legendLocalityCited}: ${f.properties.name ?? ''}` : f.properties.generalization === 'municipality' ? `${V.ui.tipMunicipio}: ${f.properties.name ?? ''}` : f.properties.generalization === '0.5deg' ? V.ui.tipGeneralized : String(f.properties.generalization ?? '')));   // the wording follows the feature's own generalization
      // near the right edge of the map, or of the open sheet, the tooltip opens to the left of the point
      { const cont = m.getContainer().getBoundingClientRect(), hoja = document.querySelector('.at-right')?.getBoundingClientRect(); const limite = (hoja && hoja.left > cont.left ? hoja.left : cont.right) - cont.left; if (m.project([x, y]).x + 270 > limite) tip.classList.add('at-ptip-izq'); }
      caja.appendChild(tip);
      ping = new maplibre.current.Marker({ element: caja, anchor: 'center' }).setLngLat([x, y]).addTo(m);
    };
    cuandoListo(() => { capas.forEach((c) => { m.on('mousemove', c, alMover); m.on('mouseleave', c, quitar); }); });
    return () => { try { capas.forEach((c) => { m.off('mousemove', c, alMover); m.off('mouseleave', c, quitar); }); } catch { /* the map is gone */ } ping?.remove(); };
  }, [status.mapa]);

  // layer visibility
  useEffect(() => {
    cuandoListo(() => {
      for (const [id, capas] of Object.entries(CAPAS_MAPA)) {
        const card = cards.find((c) => c.id === id);
        const encendida = !!visible[id] && !(card?.flag === 'nc' && !ncEnabled);
        for (const c of capas) if (mapa.current.getLayer(c)) mapa.current.setLayoutProperty(c, 'visibility', encendida ? 'visible' : 'none');
      }
    });
  }, [visible, cards, ncEnabled, status.mapa]);

  // the unit the index is filtered by
  useEffect(() => { cuandoListo(() => mapa.current.setFilter('estado-elegido', ['==', ['get', 'iso'], estado ?? ''])); }, [estado, status.mapa]);

  // the stage scrolls with the page under the fixed site header: the drawers keep their top one gap below it (--desp, read by atlas.css; phones dock a sheet at the bottom and do not use it)
  useEffect(() => {
    let r = 0;
    const poner = () => { r = 0; const el = raiz.current as HTMLElement | null; const st = el?.querySelector('.at-stage') as HTMLElement | null; if (!el || !st) return; el.style.setProperty('--desp', `${Math.max(0, Math.round(-st.getBoundingClientRect().top))}px`); };
    const pedir = () => { if (!r) r = requestAnimationFrame(poner); };
    poner(); addEventListener('scroll', pedir, { passive: true }); addEventListener('resize', pedir);
    return () => { removeEventListener('scroll', pedir); removeEventListener('resize', pedir); if (r) cancelAnimationFrame(r); };
  }, []);

  // the camera: padded by the drawers (or by the sheet on a phone) and refit when they open or close; back to North America when the species is cleared
  const padding = () => {
    const V = vivo.current;
    const stage = raiz.current?.querySelector('.at-stage') as HTMLElement | null;
    if (V.phone && stage) {
      const abierto = V.detalle ? V.snapD : V.indice ? V.snapI : null;
      const h = abierto === null ? 0 : abierto === 'peek' ? PEEK : abierto === 'full' ? stage.clientHeight * 0.92 : stage.clientHeight * 0.5;
      return { top: 76 + 80, bottom: h + 28, left: 20, right: 20 };
    }
    const css = getComputedStyle(raiz.current as HTMLElement);
    const n = (v: string) => parseFloat(css.getPropertyValue(v));
    const izq = V.indice ? n('--gap') + n('--rail') + 6 + n('--drawer-w') + 28 : n('--gap') + n('--rail') + 6 + 28;
    const der = V.detalle ? n('--detail-w') + n('--gap') + 28 : 28;
    return { top: 28 + 80, bottom: 28, left: izq, right: der };
  };
  const ajustarEspecie = (slug: string) => {
    const V = vivo.current;
    if (!mapa.current || !listo.current || !V.D) return;
    const unidades = Object.keys(V.D.presencia[slug] ?? {}).map((i) => V.D.cajas[i]).filter(Boolean);
    const locs = { features: V.D.rangosPor[slug] ?? [] };
    const a = extension(unidades, null), b = extension([], locs);
    const ext = a && b ? unir(a, b) : (a ?? b);
    if (ext) mapa.current.fitBounds(ext, { padding: padding(), maxZoom: 7, duration: sinMovimiento() ? 0 : 900 });
  };
  useEffect(() => {
    if (status.mapa !== 'ready' || !D) return;
    const s = primed ?? especie ?? hoverFit;
    const id = requestAnimationFrame(() => {
      if (s) ajustarEspecie(s);
      else if (volarAlPiloto()) { /* the card is open: the camera stays at Querétaro */ }
      else mapa.current?.fitBounds(phone ? D.inicialTel : D.inicial, { padding: padding(), duration: vistaFijada.current && !sinMovimiento() ? 700 : 0 });
      if (!s) vistaFijada.current = true;
      yaAjustado.current = !!s;
    });
    return () => cancelAnimationFrame(id);
  }, [especie, primed, hoverFit, indice, detalle, snapI, snapD, phone, status.mapa, !!D]);

  // the registry layer: live every `pollMs` when there is a registry (a listed organization shows within a minute), else the build list
  useEffect(() => {
    let vivoOrg = true;
    const leer = async () => {
      const { data, live } = await liveOrBuild(hubUrl, () => organizacionesEnVivo(hubUrl), () => getJson('/atlas/layers/organizaciones-registradas.json', 8000).catch(() => []));
      if (vivoOrg) setOrgs({ fc: organizacionesComoPuntos(Array.isArray(data) ? data : desenvolver(data) ?? []), live, date: live ? new Date().toISOString().slice(0, 10) : builtAt });
      if (vivoOrg) setListaOrgs((Array.isArray(data) ? data : desenvolver(data) ?? []) as any[]); // the cards of the registered organizations (demo)
    };
    leer();
    const t = setInterval(leer, pollMs);
    return () => { vivoOrg = false; clearInterval(t); };
  }, [hubUrl, builtAt, pollMs]);
  useEffect(() => { cuandoListo(() => { mapa.current.getSource('organizaciones')?.setData(orgs.fc); setConteos((c) => ({ ...c, organizaciones: orgs.fc.features.length })); }); }, [orgs, status.mapa]);

  // NC layers: lazy, from the registry, only with the flag; they are never part of the build. The registry decides too: it lists a flagged
  // layer only when its own flag is on and, for an attribution licence, only with its citation; the file path is the one it announces.
  const cargarNc = async (id: string) => {
    const card = (manifest?.capas ?? []).find((c: any) => c.id === id);
    if (!card?.hubLayer || !ncEnabled || status[id] === 'ready' || status[id] === 'loading') return;
    if (muestra && !hubUrl) {
      // PROTOTYPE: synthetic points stand in for the CONABIO layers; the real ones come lazily from the registry
      setStatus((s) => ({ ...s, [id]: 'loading' }));
      try { const fc = await getJson(`${MUESTRA}/nc-${FUENTE_DE[id]}.geojson`); cuandoListo(() => { mapa.current.getSource(FUENTE_DE[id])?.setData(fc); setConteos((c) => ({ ...c, [FUENTE_DE[id]]: fc.features.length })); }); setStatus((s) => ({ ...s, [id]: 'ready' })); } catch { setStatus((s) => ({ ...s, [id]: 'error' })); }
      return;
    }
    setStatus((s) => ({ ...s, [id]: 'loading' }));
    try {
      const capa = (await capasDelRegistro(hubUrl)).find((l: any) => l.slug === card.hubLayer);
      if (!capa) throw new Error('the registry does not serve this layer');
      const fc = await geojsonDeCapa(hubUrl, capa);
      cuandoListo(() => { mapa.current.getSource(FUENTE_DE[id])?.setData(fc); setConteos((c) => ({ ...c, [FUENTE_DE[id]]: fc.features?.length ?? 0 })); });
      if (capa.citation) setCitas((c) => ({ ...c, [id]: capa.citation }));
      setStatus((s) => ({ ...s, [id]: 'ready' }));
    } catch {
      setStatus((s) => ({ ...s, [id]: 'error' }));
    }
  };
  const alternar = (id: string) => {
    setVisible((v) => ({ ...v, [id]: !v[id] }));
    if (!visible[id]) cargarNc(id);
  };

  // -- the layers of the UI: popover, state popover, index, detail. Opening one closes what it replaces; Escape and Back close the top one.
  const empujar = (clave: 'indice' | 'detalle' | 'carta') => { if (!history.state?.[clave]) history.pushState({ ...(history.state ?? {}), [clave]: true }, ''); };
  const avisar = (t: string) => { setAviso(t); if (avisoReloj.current) clearTimeout(avisoReloj.current); avisoReloj.current = setTimeout(() => setAviso(null), 3400); };
  const abrirIndice = (hasta: Snap = 'half') => {
    setPopGrupo(null); setEstadoPop(null);
    if (phone) { setDetalle(false); setSnapI(hasta); }
    setIndice(true); empujar('indice');
  };
  const cerrarIndice = () => { setIndice(false); setHover(null); };
  const abrirDetalle = (slug: string, pestana?: Tab) => {
    setTab(pestana ?? 'resumen'); setExpandida(false);
    setPopGrupo(null); setEstadoPop(null);
    if (phone) { setIndice(false); setSnapD('half'); }
    setDetalle(true); empujar('detalle');
  };
  const pick = (slug: string) => {
    devolverFoco.current = document.activeElement as HTMLElement | null;
    setHover(null); setPrimed(null); setAviso(null); setEspecie(slug); abrirDetalle(slug);
  };
  const tocar = (slug: string) => {
    if (primed === slug) return pick(slug);
    setPrimed(slug); avisar(ui.tapAgain);
  };
  const cerrarDetalle = () => {
    setDetalle(false); setEspecie(null); setPrimed(null);
    const r = devolverFoco.current;
    devolverFoco.current = null;
    // the focus goes back to the row that opened the sheet, but that focus is not a preview: hovering is like choosing, so a preview here would keep the one species alone on the map
    if (r?.isConnected) requestAnimationFrame(() => { sinVistaPrevia.current = true; r.focus({ preventScroll: true }); setTimeout(() => { sinVistaPrevia.current = false; }, 80); });
    if (phone && !indice) abrirIndice('half');
  };
  // richness and the facilities-per-state metric colour the same states, so one turns the other off; neither touches the species the person has chosen
  const elegirColorear = (c: Colorear) => { setColorear(c); setEstadoPop(null); };
  vivo.current.pick = pick;

  const abrirCarta = (slug?: string | null) => { setCartaOrg(slug ?? null); setEstadoPop(null); setPopGrupo(null); popup.current?.remove(); if (detalle) cerrarDetalle(); setCarta(true); empujar('carta'); };
  vivo.current.abrirCarta = () => abrirCarta(null);
  vivo.current.abrirOrg = (slug: string) => abrirCarta(slug);
  // ?ficha=piloto (demo and stand): turns the facilities layer on and opens the pilot's card once its data is here; without the query the card stays closed
  const fichaPedida = useRef(typeof location !== 'undefined' && new URLSearchParams(location.search).get('ficha') === 'piloto');
  useEffect(() => { if (CICLO_ENCENDIDO && !kiosko && fichaPedida.current && fichaX && D) { fichaPedida.current = false; setVisible((v) => ({ ...v, 'instalaciones-catalogadas': true })); abrirCarta(null); } }, [fichaX, !!D]);
  const cerrarArriba = () => {
    if (carta) { setCarta(false); return true; }
    if (estadoPop) { setEstadoPop(null); return true; }
    if (popGrupo) { setPopGrupo(null); return true; }
    if (detalle) { cerrarDetalle(); return true; }
    if (indice) { cerrarIndice(); return true; }
    return false;
  };
  vivo.current.cerrarArriba = cerrarArriba;
  // Escape closes the top layer and takes its history entry with it; Back (popstate) closes the top layer too, but never both from one press
  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && vivo.current.cerrarArriba() && history.state && (history.state.detalle || history.state.indice || history.state.carta)) { ignorarPop.current = true; history.back(); }
    };
    const alVolver = () => { if (ignorarPop.current) { ignorarPop.current = false; return; } vivo.current.cerrarArriba(); };
    addEventListener('keydown', alTecla);
    addEventListener('popstate', alVolver);
    return () => { removeEventListener('keydown', alTecla); removeEventListener('popstate', alVolver); };
  }, []);

  // -- the map's own clicks: a unit opens the state popover, a locality opens its species, a point opens its popup
  const abrirPopup = (lngLat: [number, number], nodos: HTMLElement[]) => {
    const cuerpo = el('div', undefined, 'atlas-popup');
    nodos.forEach((n) => cuerpo.appendChild(n));
    // A new popup each time: one object re-used would be closed by its own «click on the map closes me» listener, which is still
    // in the dispatch of the very click that opens it again, so a second click while a popup was open showed nothing.
    popup.current?.remove();
    popup.current = new maplibre.current.Popup({ closeButton: true, maxWidth: '280px' }).setLngLat(lngLat).setDOMContent(cuerpo).addTo(mapa.current);
    popup.current.on('close', () => cuerpo.querySelectorAll('.at-sp-host').forEach((h) => render(null, h)));   // the species chips are their own Preact roots: unmount them with the popup
  };
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const alEstado = (e: any) => {
      const V = vivo.current;
      if (m.queryRenderedFeatures(e.point, { layers: [...LOCALIDADES, ...PUNTOS, ...CUMULOS] }).length) return;
      const iso = e.features?.[0]?.properties.iso as string | undefined;
      if (!iso) return;
      popup.current?.remove();
      setPopGrupo(null);
      if (V.estado === iso) { setEstado(null); setEstadoPop(null); return; }
      setEstadoPop({ iso, x: e.point.x, y: e.point.y });
    };
    // a count of crowded facilities opens on click: the camera goes to the zoom where it breaks up
    const alCumulo = async (e: any) => { const f = e.features?.[0]; if (!f) return; const z = await (m.getSource('instalaciones') as any).getClusterExpansionZoom(f.properties.cluster_id); m.easeTo({ center: f.geometry.coordinates, zoom: Math.min(z + 0.2, 10) }); };
    const alLocalidad = (e: any) => { if (m.queryRenderedFeatures(e.point, { layers: [...PUNTOS, ...CUMULOS] }).length) return; const s = e.features?.[0]?.properties.slug; if (s) vivo.current.pick(s); };
    const alPunto = (e: any) => {
      const V = vivo.current;
      const f = e.features?.[0];
      if (!f) return;
      setEstadoPop(null); setPopGrupo(null);
      const nodos: HTMLElement[] = [];
      // each facility has its own marker (they fan out where they share a place), so the popup is the clicked facility under «in <municipality>, <state>»
      const cerca = (e.features as any[]).filter((x) => x.properties?.cve_ent !== undefined && x.properties?.id);
      if (cerca.length) {
        const r = cerca[0].properties;
        let abrio = false;
        const armar = () => {
          const bloque = el('div', undefined, 'mt-2');
          bloque.appendChild(el('div', r.nombre, 'font-semibold'));
          const lugar = el('div', lugarDeInstalacion(r, V.text.inPlace), 'at-place');
          // a closed place shows only its name, its place and «cerrado · mes de año» (just «cerrado» when the row has no date): no facility type, no legal figure, no notes
          if (r.estado_operacion === 'cerrado') {
            // the DEMO build (flag on) opens the full-cycle card from the closed marker of the pilot; the public build says «cerrado · mes año» and nothing else
            const c = V.ciclo;
            if (c && c.facilidad === r.id && V.fichaX) { V.abrirCarta(); abrio = true; return; }
            if (c && c.facilidad === r.id) { nodos.length = 1; nodos.push(tarjetaCiclo(c, V.ui, V.text)); return; }
            bloque.appendChild(lugar); bloque.appendChild(el('div', lineaDeCierre(r, V.ui.closedAt, (f: string) => mesDeCierre(f, V.locale)))); nodos.push(bloque); return;
          }
          // an open or unknown row: its type and its legal figure (a short tag) under the name
          const E = V.etiquetasInst as EtiquetasInstalaciones | null;
          // name (bold), then type · legal-figure tag, then the place
          const linea = el('div', undefined, 'at-poptipo');
          if (r.tipo_recinto) { linea.appendChild(el('span', etiquetaTipo(E, tipoDe(r), V.locale))); linea.appendChild(document.createTextNode(' · ')); }
          const figura = el('span', etiquetaLegal(E, codigoLegalDe(r), V.locale), `at-tag at-tag-${figuraDe(r)}`);
          const expl = expansionFigura(E, figuraDe(r), V.locale); if (expl) figura.title = expl;
          linea.appendChild(figura); bloque.appendChild(linea); bloque.appendChild(lugar);
          if (r.especies) bloque.appendChild(listaEspecies(r.especies, V, (slug) => { popup.current?.remove(); V.pick(slug); }));
          const verif = (V.ui.verifLabels as Record<string, string>)[r.verificacion];
          if (verif) bloque.appendChild(el('div', verif, 'at-popverif'));
          nodos.push(bloque);
        };
        armar();
        if (!abrio) abrirPopup(e.lngLat.toArray(), nodos);
        return;
      }
      const p = f.properties;
      if ((p.registrada === true || p.registrada === 'true') && V.abrirOrg && p.slug) { popup.current?.remove(); V.abrirOrg(String(p.slug)); return; }
      nodos.push(el('strong', p.nombre || p.sitio || p.clave || p.municipio || ''));
      if (p.tipo_recinto) nodos.push(el('div', `${V.text.facility}: ${p.tipo_recinto}${p.municipio ? ` · ${p.municipio}` : ''}`));
      if (p.especies) nodos.push(listaEspecies(p.especies, V, (slug) => { popup.current?.remove(); V.pick(slug); }));
      if (p.verificacion) nodos.push(el('div', `${V.text.verification}: ${p.verificacion}`));
      if (p.registrada === true || p.registrada === 'true') nodos.push(el('div', `${V.text.verification}: ${p.nivel}/3`));
      // a municipal aggregate carries its class counts as an object, which MapLibre hands back as JSON text: only a plain class is shown
      if (typeof p.semaforo === 'string' && p.semaforo && !p.semaforo.startsWith('{')) nodos.push(el('div', p.semaforo));
      abrirPopup(e.lngLat.toArray(), nodos);
    };
    cuandoListo(() => {
      m.on('click', 'estados-relleno', alEstado);
      LOCALIDADES.forEach((c) => m.on('click', c, alLocalidad));
      PUNTOS.forEach((c) => m.on('click', c, alPunto));
      m.on('click', 'instalaciones-cumulo', alCumulo);
      m.on('mousemove', 'instalaciones-cumulo', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'instalaciones-cumulo', () => { m.getCanvas().style.cursor = ''; });
    });
    return () => { try { m.off('click', 'estados-relleno', alEstado); LOCALIDADES.forEach((c) => m.off('click', c, alLocalidad)); PUNTOS.forEach((c) => m.off('click', c, alPunto)); m.off('click', 'instalaciones-cumulo', alCumulo); } catch { /* the map is gone */ } };
  }, [status.mapa]);

  // the axolodao.org profile: while the pilot's card is open the camera is at Querétaro, so the facility's marker is in view beside the card (the first-view refit that follows the data's arrival goes there too, instead of North America)
  const volarAlPiloto = (): boolean => {
    if (!SITIO || !vivo.current.cartaAbierta || !instalaciones || !mapa.current || !listo.current) return false;
    const f = (instalaciones.features as any[]).find((x) => x.properties.id === 'mx-qro-xolotlcalli');
    if (!f) return false;
    mapa.current.flyTo({ center: f.geometry.coordinates, zoom: 8.5, duration: sinMovimiento() ? 0 : 1400, padding: esTelefono() ? { top: 160, bottom: 320, left: 20, right: 20 } : { top: 108, bottom: 28, left: 28, right: 470 } });
    return true;
  };
  vivo.current.cartaAbierta = carta;
  const volo = useRef(false);
  useEffect(() => {
    if (carta) { const t = setTimeout(() => { if (volarAlPiloto()) volo.current = true; }, 300); return () => clearTimeout(t); }
    if (volo.current && SITIO && !especie) { volo.current = false; const D0 = vivo.current.D; if (D0 && mapa.current) mapa.current.fitBounds(esTelefono() ? D0.inicialTel : D0.inicial, { padding: padding(), duration: sinMovimiento() ? 0 : 700 }); }
  }, [carta, !!instalaciones]);

  // -- the URL: ?capa ?especie ?estado are read once, when the data is here, and written as they change
  const urlLeida = useRef(false);
  useEffect(() => {
    if (!D || urlLeida.current) return;
    urlLeida.current = true;
    const u = leerUrl(location.search, { slugs: D.items.map((i) => i.slug), isos: D.isos });
    setColorear(COLOREAR_DE_CAPA[u.capa] ?? 'ninguno');
    if (u.estado || (vista === 'especies' && !u.especie)) { if (u.estado) setEstado(u.estado); setIndice(true); }
    if (u.especie) { setEspecie(u.especie); setTab('resumen'); setDetalle(true); }
  }, [D]);
  useEffect(() => {
    if (!urlLeida.current) return;
    const nuevo = escribirUrl(location.search, { capa: CAPA_DE_COLOREAR[colorear], especie, estado });
    if (nuevo !== location.search) history.replaceState(history.state, '', `${location.pathname}${nuevo}${location.hash}`);
  }, [colorear, especie, estado, !!D]);

  // kiosk: after 60 s without touch, tour the layers
  useEffect(() => {
    if (!kiosko) return;
    let idle = 0, paso = 0, tour: ReturnType<typeof setInterval> | null = null;
    const visitas = ['riqueza', 'metrica', 'instalaciones-catalogadas'];
    const reiniciar = () => { idle = 0; if (tour) { clearInterval(tour); tour = null; } };
    const reloj = setInterval(() => {
      idle += 1;
      if (idle === 60 && !tour) tour = setInterval(() => {
        const id = visitas[paso++ % visitas.length];
        if (id === 'instalaciones-catalogadas') setVisible((v) => ({ ...v, [id]: true })); else setColorear(id as Colorear);
      }, 12000);
    }, 1000);
    ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, reiniciar, { passive: true }));
    return () => { clearInterval(reloj); if (tour) clearInterval(tour); ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.removeEventListener(ev, reiniciar)); };
  }, [kiosko]);

  // the card on show: the pilot's (the reference instance) or a registered organization's, built from the hub's answers (demo)
  const vistaCarta: OrgVista | null = useMemo(() => {
    if (!CICLO_ENCENDIDO) return null;
    const nombreEstado = (iso: string) => D?.nombreDe?.[iso] ?? iso;
    if (cartaOrg) {
      const d = listaOrgs.find((o: any) => o.slug === cartaOrg);
      return d ? (vistaDeHub(d, semanasOrg[cartaOrg] ?? { weeks: [] }, { nombreEstado }) as unknown as OrgVista) : null;
    }
    return fichaX ? (vistaDeXolotlcalli({ ficha: fichaX, clips: clipsX, cadena: cadenaX, ciclo, cifrasPiloto: CIFRAS_PILOTO_ENCENDIDO, tesoreria: TESORERIA_ENCENDIDA, perfil: STAND ? 'stand' : SITIO ? 'sitio' : 'demo', clipsAprobados: aprobadosX }) as unknown as OrgVista) : null;
  }, [cartaOrg, listaOrgs, semanasOrg, fichaX, clipsX, cadenaX, aprobadosX, ciclo, D]);
  // in the DEMO build the layer's line agrees with the card below it; the public build keeps its own text
  const orgsNote = CICLO_ENCENDIDO && !kiosko && ciclo ? ui.cicloOrgsNota : orgs.fc.features.length === 0 ? text.orgsEmpty : orgs.live ? text.orgsLive : text.orgsBuild;
  const itemVista = D && vistaSlug ? D.porSlug[vistaSlug] : null;
  const itemDetalle = D && especie ? D.porSlug[especie] : null;
  const aqui = D && estadoPop
    ? D.items.filter((s) => D.presencia[s.slug]?.[estadoPop.iso]).sort((a, b) => Number(claseDeEvidencia(D.presencia[a.slug][estadoPop.iso]) === 'weak') - Number(claseDeEvidencia(D.presencia[b.slug][estadoPop.iso]) === 'weak') || a.slug.localeCompare(b.slug))
    : [];
  const stage = raiz.current?.querySelector('.at-stage') as HTMLElement | null;
  const filasTabla = D ? (colorear === 'metrica'
    ? Object.entries(valores).map(([iso, v]) => ({ iso, nombre: metricas?.estados[iso]?.nombre ?? iso, v }))
    : D.isos.map((iso) => ({ iso, nombre: D.nombreDe[iso], v: D.riq.fuerte[iso] ?? 0 }))).sort((a, b) => a.nombre.localeCompare(b.nombre, locale)) : [];
  const etiquetaTabla = colorear === 'metrica' ? etiqueta : ui.legendRichness;
  // ex situ: how many cataloged facilities name the species (a count, never a place)
  const nInst = (slug: string) => (instalaciones ? instalacionesDeEspecie(instalaciones.features, slug, (manifest as any)?.sinonimos ?? {}) : 0);
  const ocupado = (phone && (indice || detalle)) ? '1' : '0';

  return (
    <div ref={raiz} class="at-ui" data-atlas data-kiosko={kiosko ? '1' : '0'} data-nc={ncEnabled ? '1' : '0'} data-ready={status.mapa === 'ready' && D ? '1' : '0'} data-counts={JSON.stringify(conteos)}
      data-indice={indice ? '1' : '0'} data-sheet-open={ocupado} data-detalle={detalle ? '1' : '0'} data-expanded={expandida ? '1' : '0'} data-colorear={colorear} data-nc-on={ncEnabled ? '1' : '0'} data-especie={especie ?? ''} data-vista={vista} data-ciclo={CICLO_ENCENDIDO ? '1' : '0'} data-clips={CLIPS_ENCENDIDO ? '1' : '0'}>
      <div class="at-stage">
        <div ref={contenedor} role="application" aria-label={ui.mapLabel} class="at-map" data-map />
        {sinWebgl && <p class="at-nowebgl">{text.webgl}</p>}
        {!indice && (
          <button type="button" class="at-openpanel" data-group-btn="especies" aria-controls="at-indice" aria-label={ui.openIndex} title={ui.hudSpecies} onClick={() => abrirIndice()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONOS.especies} /></svg><span class="at-lbl" aria-hidden="true">{ui.hudSpecies}</span>
          </button>
        )}
        {D && (
          <Legend ui={ui} text={text} colorear={colorear} etiqueta={etiqueta} min={min} max={max} vista={itemVista} evidencias={itemVista ? Object.values(D.presencia[itemVista.slug] ?? {}) : []}
            rango={itemVista ? rangoVisible(itemVista.slug) : []} rampas={D.rampas}
            trama={itemVista ? D.tramas[itemVista.slug] : undefined} conPuntos={!!itemVista && conPunto.has(itemVista.slug)} conAreas={!!itemVista && conArea.has(itemVista.slug)} lagos={itemVista ? (puntosLoc?.features ?? []).filter((f: any) => f.properties.kind === 'lake' && f.properties.slug === itemVista.slug) : []} estadosComoLinea={!!itemVista && (D.rangosPor[itemVista.slug]?.length ?? 0) > 0} 
            fuentesPuntos={itemVista ? fuentesPuntos[itemVista.slug] ?? [] : []} ocultarRevision={STAND || SITIO}
            instalaciones={!!visible['instalaciones-catalogadas']} instTipos={Object.keys(tiposDeInst)} instFiguras={Object.keys(figurasDeInst)} etiquetasInst={etiquetasInst} locale={locale} abierta={leyenda} onToggle={() => setLeyenda(!leyenda)} />
        )}
        {D && indice && (
          <IndexDrawer ui={ui} locale={locale} items={D.items} lista={lista} especie={especie} preview={hover ?? primed} q={q} iucn={iucn} grupo={grupo} estadoNombre={estado ? D.nombreDe[estado] : null} estadoIso={estado} filtrosAbiertos={filtros}
            snap={snapI} phone={phone} capas={['limites-admin1', 'rios-lagos'].map((id) => ({ id, label: id === 'limites-admin1' ? ui.ctlLimits : ui.ctlRivers, checked: !!visible[id] }))} onCapa={alternar} riqueza={colorear === 'riqueza'} onRiqueza={() => elegirColorear(colorear === 'riqueza' ? 'ninguno' : 'riqueza')} onQ={setQ} onIucn={setIucn} onGrupo={(g) => { setGrupo(g); if (g !== 'iucn') setIucn(null); }} onQuitarEstado={() => setEstado(null)} onFiltros={() => setFiltros(!filtros)} onPreview={(sl) => { if (sl && sinVistaPrevia.current) return; setHover(sl); }}
            onPick={pick} onTap={tocar} onSnap={setSnapI} onClose={cerrarIndice}
            panel={panelTab} onPanel={(t) => { setPanelTab(t); setHover(null); setPrimed(null); }} tituloInstalaciones={tituloInstalaciones(text)} capacidades={D.caps} tramas={D.tramas}
            cuerpoInstalaciones={<Hud cards={cards} text={text} ui={ui} colorear={colorear} visible={visible} status={status} ncEnabled={ncEnabled} kiosko={kiosko} metrics={metricasLista} metric={metric} orgsNote={orgsNote}
              freshness={<span class="at-fresh" data-freshness={orgs.date} data-live={orgs.live ? 'true' : 'false'}><i aria-hidden="true" />{text.freshness} <time datetime={orgs.date}>{orgs.date}</time></span>}
              ciclo={CICLO_ENCENDIDO && !kiosko ? ciclo : null} instFiltros={<FiltrosInstalaciones etiquetas={etiquetasInst} locale={locale} tipos={tiposDeInst} figuras={figurasDeInst} ocultosTipo={ocultosTipo} ocultasFigura={ocultasFigura} onTipo={(t) => alternarEn(ocultosTipo, setOcultosTipo, t)} onFigura={(f) => alternarEn(ocultasFigura, setOcultasFigura, f)} tituloTipo={text.facility} tituloFigura={text.legalFigure} />} onColorear={elegirColorear} onToggle={alternar} onMetric={setMetric} />} />
        )}
        {CICLO_ENCENDIDO && carta && vistaCarta && !kiosko && <TarjetaOrg vista={vistaCarta} especie={infoEspecie} onEspecie={(slug) => { setCarta(false); pick(slug); }} onClose={() => setCarta(false)} />}
        {D && detalle && itemDetalle && (
          <DetailDrawer ui={ui} text={text} locale={locale} item={itemDetalle} presencia={D.presencia[itemDetalle.slug] ?? {}} presenciaFilas={snap.presencia[itemDetalle.slug] ?? []} fuentes={D.fuentes} nombreDe={D.nombreDe}
            etapas={etapas} clips={CLIPS_ENCENDIDO ? clips[itemDetalle.slug] ?? [] : []} ficha={muestras?.fichas[itemDetalle.slug] ?? null} rango={rangoVisible(itemDetalle.slug)} fuentesPuntos={fuentesPuntos[itemDetalle.slug] ?? []} extremos={D.extremos} porSlug={D.porSlug}
            tinta={D.tinta[D.matiz[itemDetalle.slug]] ?? '#031a20'} nInstalaciones={nInst(itemDetalle.slug)} speciesPathBase={speciesPathBase} tab={tab} snap={snapD} phone={phone} expandida={expandida}
            onTab={setTab} onSnap={setSnapD} onExpand={() => { if (phone) setSnapD(snapD === 'full' ? 'half' : 'full'); else setExpandida(!expandida); }} onClose={cerrarDetalle} />
        )}
        {D && estadoPop && stage && (
          <StatePop ui={ui} nombre={D.nombreDe[estadoPop.iso]} aqui={aqui} evidencia={D.presencia} iso={estadoPop.iso} x={estadoPop.x} y={estadoPop.y} ancho={stage.clientWidth} alto={stage.clientHeight}
            valor={colorear === 'metrica' ? `${etiqueta}: ${valores[estadoPop.iso] ?? text.noData}` : undefined}
            onPick={(s) => { setEstadoPop(null); pick(s); }} onFilter={() => { setEstado(estadoPop.iso); setEstadoPop(null); abrirIndice(); }} onClose={() => setEstadoPop(null)} />
        )}
        {aviso && <div class="at-toast" role="status">{aviso}</div>}
      </div>
      <div class="container-wide at-below">
        {cards.filter((c) => c.attribution && visible[c.id] && (c.flag !== 'nc' || ncEnabled)).map((c) => <p class="mt-2 font-mono text-[11px] text-white/60" data-attribution data-attribution-for={c.id}>{citas[c.id] ?? c.attribution}</p>)}
        {visible['instalaciones-catalogadas'] && <p class="mt-2 font-mono text-[11px] text-white/60" data-attribution data-attribution-for="iconos">{ui.iconsCredit} <a class="underline" href="/atlas/aviso-iconos.txt" target="_blank" rel="noopener noreferrer" data-iconos-aviso>{ORIGEN_ICONOS.set} ({ORIGEN_ICONOS.licencia})</a></p>}
        <details class="mt-4 rounded-xl border border-white/10 p-4">
          <summary class="cursor-pointer text-sm font-semibold">{text.table}</summary>
          <p class="mt-2 text-xs text-white/60">{text.tableNote} {etiquetaTabla}</p>
          <div class="mt-2 overflow-x-auto"><table class="w-full text-left text-sm"><thead><tr><th class="py-1">{text.state}</th><th class="py-1">{text.value}</th></tr></thead>
            <tbody>{filasTabla.map((f) => <tr class="border-t border-white/10"><td class="py-1">{f.nombre}</td><td class="py-1 font-mono">{f.v === null || f.v === undefined ? text.noData : f.v}</td></tr>)}</tbody></table></div>
        </details>
        {instalaciones && (
          <details class="mt-4 rounded-xl border border-white/10 p-4" data-facilities-table>
            <summary class="cursor-pointer text-sm font-semibold">{text.facilitiesTable}</summary>
            <p class="mt-2 text-xs text-white/60">{text.facilitiesTableNote}</p>
            <div class="mt-2 overflow-x-auto"><table class="w-full text-left text-sm">
              <thead><tr><th class="py-1 pr-2">{text.municipality}</th><th class="py-1 pr-2">{text.state}</th><th class="py-1 pr-2">{text.facility}</th><th class="py-1">{text.legalFigure}</th></tr></thead>
              <tbody>{filasDeInstalaciones(instalaciones.features.map((f: any) => f.properties)).map((p: any) => (
                <tr class="border-t border-white/10 align-top" data-facility={p.id}>
                  <td class="py-1 pr-2">{p.nivel === 'estado' || !p.municipio ? text.noMunicipality : p.municipio}</td>
                  <td class="py-1 pr-2">{p.estado}</td>
                  <td class="py-1 pr-2">{p.nombre}</td>
                  <td class="py-1">{p.estado_operacion === 'cerrado' && p.estado_fecha ? `${ui.closedAt} · ${mesDeCierre(String(p.estado_fecha), locale)}` : p.tipo_legal === 'no consta' || !p.tipo_legal ? text.notStated : <>{p.tipo_legal} (<a class="underline" href={p.tipo_legal_fuente} rel="noopener noreferrer">{text.source}</a>)</>}</td>
                </tr>))}</tbody>
            </table></div>
          </details>
        )}
      </div>
    </div>
  );
}
