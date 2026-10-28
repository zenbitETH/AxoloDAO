// The card of an organization as DATA: one view model that every registered organization fills the same way, whether it comes from the hub's routes (OrgDetail, OrgWeeks: INTERFACES §8.1) or from the Xolotlcalli pilot's files, the reference instance.
// Every value carries its origin, `{ estado: 'en-cadena' | 'previsto' | 'hub', esquema?, uid?, url? }`, so nobody reads as verified what is not; a section with nothing to say is `null` (an empty state on screen), never a zero. Pure: no clock, no network, no DOM.

/** The origin of a value. `OrgDetail.origen` is a map from the payload's field names to `{ estado, esquema?, uid? }`; a field missing from it is the hub's own record. */
export const origenDe = (mapa, campo) => {
  const o = mapa && typeof mapa === 'object' ? mapa[campo] : undefined;
  if (!o || typeof o !== 'object' || !['en-cadena', 'previsto', 'hub'].includes(o.estado)) return { estado: 'hub' };
  return { estado: o.estado, ...(o.esquema ? { esquema: o.esquema } : {}), ...(o.uid ? { uid: o.uid } : {}) };
};

/** A snapshot row is accepted only with an explicit, well-formed `origen`: a row without one is refused (it is never drawn, and its id is reported), never given a default. */
export const origenValido = (o) => !!o && typeof o === 'object' && ['en-cadena', 'previsto', 'hub'].includes(o.estado) && (o.estado !== 'hub' || !o.esquema);
export const filasAceptadasPublicas = (cadena) => filasAceptadas(cadena);
const filasAceptadas = (cadena) => (cadena && Array.isArray(cadena.filas) ? cadena.filas.filter((f) => origenValido(f.origen)) : []);
const filasRechazadas = (cadena) => (cadena && Array.isArray(cadena.filas) ? cadena.filas.filter((f) => !origenValido(f.origen)).map((f) => String(f.id ?? '?')) : []);
/** The snapshot's row of one identity, by its id (refused rows do not count). */
const filaDe = (cadena, id) => filasAceptadas(cadena).find((f) => f.id === id) ?? null;
/** An ENS name is «en cadena» ONLY when the build-time onchain snapshot says, with a boolean `resuelve`, that it resolves in the registry; the snapshot wins over the hub for this one mark, and nothing else overrides the hub's origin. A name the hub serves from its own gateway stays «registro del hub». */
export const origenDelEns = (origenHub, cadena) => (filaDe(cadena, 'ens')?.resuelve === true ? { estado: 'en-cadena', esquema: 'ENS' } : origenHub?.estado === 'en-cadena' ? { estado: 'hub' } : origenHub ?? { estado: 'hub' });

const semanaNum = (w) => { const m = /^(\d{4})-W(\d{2})$/.exec(String(w ?? '')); return m ? +m[1] * 100 + +m[2] : null; };
const orden = (a, b) => (semanaNum(a) ?? 0) - (semanaNum(b) ?? 0);

/** The weeks the hub closed for an organization, summarised: how many, from where to where, how many carry an anchor the chain confirmed, and the public records they count. `null` when the organization closed no week. */
/** The origin of a value made of several weeks: «en cadena» only when EVERY week behind it is anchored; none anchored is «previsto»; some of them is a partial mark that says how many. Never a plain «en cadena» on a partial value. */
export const origenDeSemanas = (s) => (!s || s.ancladas === 0 ? { estado: 'previsto', esquema: 'WeekAnchor@2' }
  : s.ancladas === s.n ? { estado: 'en-cadena', esquema: 'WeekAnchor@2' } : { estado: 'parcial', esquema: 'WeekAnchor@2', ancladas: s.ancladas, de: s.n });

export function resumenDeSemanas(weeks) {
  const lista = Array.isArray(weeks?.weeks) ? weeks.weeks : [];
  if (lista.length === 0) return null;
  const ids = lista.map((w) => w.week).sort(orden);
  const firmes = lista.filter((w) => w.anchor?.uid && w.origen?.estado === 'en-cadena');
  const suma = (l) => l.reduce((a, w) => a + (Number(w.publicRecords) || 0), 0);
  return { n: lista.length, desde: ids[0], hasta: ids[ids.length - 1], ancladas: firmes.length, registros: suma(lista), registrosAncladas: suma(firmes) };
}

/** The identity rows of the «En cadena» section for an organization the hub serves: its registration, its weeks and its ENS name, each from what the hub says about the chain; the snapshot's rows (treasury, clips, links to explorers) are added by id and never replace these. */
export function filasDeHub(detail, weeks, cadena) {
  const filas = [];
  const reg = origenDe(detail.origen, 'registeredUid');
  filas.push({ id: 'registro', titulo: 'Registro de la organización', red: reg.estado === 'en-cadena' ? (filaDe(cadena, 'registro')?.red ?? null) : 'Sin red',
    estado: reg.estado === 'en-cadena' ? 'Registrada en cadena' : 'Aún no registrada en cadena', origen: reg, ...(filaDe(cadena, 'registro')?.enlace ? { enlace: filaDe(cadena, 'registro').enlace } : {}) });
  const s = resumenDeSemanas(weeks);
  filas.push({ id: 'semanal', titulo: 'Registros semanales anclados', red: s && s.ancladas > 0 ? (filaDe(cadena, 'semanal')?.red ?? null) : 'Sin red',
    estado: s && s.ancladas > 0 ? `${s.ancladas} de ${s.n} semanas ancladas` : 'Aún no anclado', origen: origenDeSemanas(s), ...(filaDe(cadena, 'semanal')?.enlace ? { enlace: filaDe(cadena, 'semanal').enlace } : {}) });
  if (detail.ensName) {
    const f = filaDe(cadena, 'ens');
    filas.push({ id: 'ens', titulo: detail.ensName, red: f?.red ?? null, estado: f?.estado ?? 'Nombre del registro del hub', origen: origenDelEns(origenDe(detail.origen, 'ensName'), cadena), ...(f?.enlace ? { enlace: f.enlace } : {}), ...(f?.aviso ? { aviso: f.aviso } : {}) });
  }
  // the snapshot's own rows for identities the hub does not carry (the treasury, the clips) come along as they are
  for (const f of filasAceptadas(cadena)) if (!['registro', 'semanal', 'ens'].includes(f.id)) filas.push({ ...f, origen: { ...f.origen } });
  return filas;
}

/** The view model of an organization from the hub's own answers. `nombreEstado` turns an ISO 3166-2 code into the name the atlas shows. IRC and survival are empty in it: no figure is published for any organization but the Xolotlcalli demo. */
/** @param {any} detail @param {any} weeks @param {{ cadena?: any, nombreEstado?: (iso: string) => string, clips?: any, tesoreria?: boolean }} [opciones] */
export function vistaDeHub(detail, weeks, { cadena: cadenaEntera = null, nombreEstado = (iso) => iso, clips = null, tesoreria = false } = {}) {
  const cadena = tesoreria ? cadenaEntera : sinTesoreria(cadenaEntera);
  const s = resumenDeSemanas(weeks);
  const unidades = (detail.sites ?? []).flatMap((x) => x.units ?? []).filter((u) => u.kind === 'sistema' || u.kind === 'exhibicion');
  const origenSemanas = origenDeSemanas(s);
  const filas = filasDeHub(detail, weeks, cadena);
  return {
    slug: detail.slug,
    nombre: { valor: detail.displayName, origen: origenDe(detail.origen, 'displayName') },
    lugar: { valor: nombreEstado(detail.state), origen: origenDe(detail.origen, 'state') },
    cerrado: detail.frozen ? { fecha: detail.frozenAt ? String(detail.frozenAt).slice(0, 10) : null } : null,
    ens: detail.ensName ? { valor: detail.ensName, origen: filas.find((f) => f.id === 'ens').origen } : null,
    periodo: detail.span?.fromWeek ? { valor: { desde: detail.span.fromWeek, hasta: detail.span.toWeek ?? null }, origen: origenDe(detail.origen, 'span') } : null,
    especies: Array.isArray(detail.species) && detail.species.length ? { valor: detail.species, origen: origenDe(detail.origen, 'species') } : null,
    sistemas: unidades.length ? { valor: unidades.map((u) => ({ codigo: u.slug, especie: u.species ?? null })), origen: origenDe(detail.origen, 'sites') } : null,
    semanas: s ? { valor: { n: s.n, desde: s.desde, hasta: s.hasta, ancladas: s.ancladas }, origen: origenSemanas } : null,
    registros: s && s.registros > 0 ? { valor: s.registros, ancladas: s.registrosAncladas, origen: origenSemanas } : null,
    // the IRC and survival band is part of every card, empty until the organization has figures PUBLISHED in its view model (none today but the pilot's)
    cifras: { irc: null, supervivencia: null, modo: null, aviso: null },
    agua: null,
    clips: clips && Array.isArray(clips.clips) && clips.clips.length ? clips : null,
    cadena: filas,
    cadenaLeidoEl: cadena?.leidoEl ?? null,
    cadenaRechazadas: filasRechazadas(cadena),
    pagina: null,
    fuentes: [],
  };
}

/** The snapshot without its treasury row: that row holds a personal address and is drawn only where the build says so. */
export const sinTesoreria = (cadena) => (cadena && Array.isArray(cadena.filas) ? { ...cadena, filas: cadena.filas.filter((f) => f.id !== 'tesoreria') } : cadena);

/** The snapshot's rows, each with the origin it carries (the ENS row follows the resolve rule); a row without an `origen` is not among them. */
export const filasConOrigen = (cadena, origenEnsHub = { estado: 'hub' }) => filasAceptadas(cadena).map((f) => ({ ...f, origen: f.id === 'ens' ? origenDelEns(origenEnsHub, cadena) : { ...f.origen } }));

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** «2026-09-30» as «30 de septiembre de 2026»: the date of a figure is always rendered from the ficha's own field. */
export const fechaLargaEs = (iso) => { const [a, m, d] = String(iso).split('-').map(Number); return d ? `${d} de ${MESES[m - 1]} de ${a}` : m ? `${MESES[m - 1]} de ${a}` : String(a); };

/** «2026-09-30» as «30-sep-2026». */
export const fechaCortaEs = (iso) => { const [a, m, d] = String(iso).split('-').map(Number); return d ? `${d}-${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][m - 1]}-${a}` : String(iso); };
/** The museum's defined name (the agreement's), ONE constant: the card title, the IRC label, the line under both figures and the water heading read from it. */
export const NOMBRE_MUSEO_BASE = 'Museo de Ajolotes Xolotlcalli';
export const NOMBRE_MUSEO = `${NOMBRE_MUSEO_BASE} (2025–2026)`;
/** The one place the former name stays: the Fuentes citation, whose wording the agreement fixes (clause 8.4), exactly. */
export const CITA_ACUERDO = 'Biomuseo Xolotlcalli (2025–2026)';
/** The pilot's figures when they are shown at the booth (`PUBLIC_ATLAS_CIFRAS_PILOTO`, off until the museum's written approval is filed): the exact wording the IP review ruled, with the date of the IRC taken from the ficha. Zenbit's analysis, never the museum's opinion; no event, no cause. */
export const ETIQUETAS_CIFRAS_PILOTO = {
  irc: (valor, calculadoEl) => `IRC v1: ${valor} — análisis de Zenbit sobre los registros del ${NOMBRE_MUSEO}; calculado el ${fechaLargaEs(calculadoEl)}`,
  supervivencia: (valor) => `Supervivencia: ${Number(valor).toFixed(1)} % — proporción simple sobre los registros del 24-oct-2025 al 25-sep-2026, que incluyen tres días posteriores al cierre al público; no es la métrica del Estándar`,
  aviso: `Cifras calculadas por Zenbit. No expresan la opinión del ${NOMBRE_MUSEO_BASE} ni de quienes participaron en él`,
  /** the captions of the Resumen tiles (a photo or a phone screen shows no tooltip): the number's origin and window as a caption, never a sentence */
  pieIrc: (calculadoEl) => `análisis de Zenbit · ${fechaCortaEs(calculadoEl)}`,
  pieSupervivencia: (desde, hasta) => `proporción simple, ${fechaCortaEs(desde)} a ${fechaCortaEs(hasta)} · no es la métrica del Estándar`,
  /** the one footnote line under the figure tiles */
  notaPie: 'Cifras calculadas por Zenbit; no expresan la opinión del museo ni de quienes participaron.',
};
/** The word «forense» is on no label of any card. */
export const sinForense = (texto) => !/forense/i.test(String(texto ?? ''));

/** The view model of the pilot, the reference instance, from Site & Data's ficha, the clips snapshot and the onchain snapshot. It is the ONLY one that carries IRC and survival, and only in the demo. */
/** The band of the pilot: its demo labels (flag off, as ruled for the demo) or the booth wording (flag on). A label never carries «forense»; with the flag on, an IRC with no calculation date in the ficha is NOT shown: the date is never typed here. */
function cifrasDelPiloto(ficha, cifrasPiloto) {
  const irc = ficha.irc_v1, sup = ficha.supervivencia;
  if (!cifrasPiloto) {
    return { irc: irc && sinForense(irc.etiqueta) ? { valor: irc.valor, etiqueta: irc.etiqueta } : null, supervivencia: sup && sinForense(sup.etiqueta) && sinForense(sup.nota) ? sup : null, modo: 'demo', aviso: null };
  }
  const fecha = irc?.calculadoEl?.valor ?? null;
  return {
    irc: irc && fecha ? { valor: irc.valor, linea: ETIQUETAS_CIFRAS_PILOTO.irc(irc.valor, fecha), pie: ETIQUETAS_CIFRAS_PILOTO.pieIrc(fecha) } : null,
    supervivencia: sup ? { valor: sup.valor, linea: ETIQUETAS_CIFRAS_PILOTO.supervivencia(sup.valor), pie: sup.periodo ? ETIQUETAS_CIFRAS_PILOTO.pieSupervivencia(sup.periodo.desde, sup.periodo.hasta) : null } : null,
    modo: 'piloto', aviso: ETIQUETAS_CIFRAS_PILOTO.aviso, notaPie: ETIQUETAS_CIFRAS_PILOTO.notaPie,
  };
}

/** The clips the founder cleared for the stand: `{ clips: [{ url, autor }] }`. Nothing is shown without that list, and only what it names. */
export const clipsDelStand = (clips, aprobados) => {
  if (!clips || !Array.isArray(clips.clips) || !aprobados || !Array.isArray(aprobados.clips)) return null;
  const clave = (c) => `${c.url}|${c.autor}`;
  const ok = new Set(aprobados.clips.map(clave));
  const quedan = clips.clips.filter((c) => ok.has(clave(c)));
  return quedan.length ? { ...clips, clips: quedan } : null;
};
/** The ENS name at the stand is a historical identifier of the Pilot: no claim, no use. */
export const ETIQUETA_ENS_STAND = 'identificador histórico del Piloto (2025–2026)';
/** Anything that names who received: a label, a word or an address, full or shortened. A row of the stand that carries one is refused. */
const DESTINATARIO = /firmante|destinatari|recipient|beneficiari|receptor|0xb5b5|0x[0-9a-fA-F]{40}(?![0-9a-fA-F])|0x[0-9a-fA-F]{4}…[0-9a-fA-F]{3,4}/i;
const ROL_O_NOMBRE = /firmante|destinatari|recipient|beneficiari|receptor|representante|socio|director|fundador|tesorero|titular/i;
/** The one category the booth's treasury row may carry with a role word: the ruled label for the founder's personal signer. Only this exact string, as the category part of a month line; «firmante» anywhere else still drops the row. */
export const CATEGORIA_FIRMANTE = 'Aportación (firmante)';
const CORTA = /^0x[0-9a-fA-F]{4}…[0-9a-fA-F]{3,4}$/;
const URL_DIRECCION = /^https:\/\/[a-z.]*etherscan\.io\/address\/(0x[0-9a-fA-F]{40})$/;
const URL_TX = /^https:\/\/[a-z.]*etherscan\.io\/tx\/0x[0-9a-fA-F]{64}$/;
/** The treasury row of the STAND: the whole AxoloDAO Safe, month by month. Every line is a month, a category, a direction, native totals and its transactions; the counterparty of a line is «Zenbit» or an unnamed short address that links to its explorer page. Refused when a line has a field beyond those, when a counterparty carries a name or a role, when a short address sits anywhere but a counterparty's text, when a full address sits anywhere but the address link of a counterparty (and then it must be the short one's), when a link is not an https explorer page, or when ANY word of a recipient, a role or a name appears. */
export function filaTesoreriaDelStand(f) {
  if (!f || f.id !== 'tesoreria' || f.titulo !== 'Tesorería de AxoloDAO (treasury.axolodao.eth)' || !Array.isArray(f.detalle) || f.detalle.length < 2) return false;
  if (Object.keys(f).some((k) => !['id', 'titulo', 'red', 'estado', 'descripcion', 'nota', 'aclaracion', 'bloque', 'origen', 'detalle', 'muestra'].includes(k))) return false;
  const copia = JSON.parse(JSON.stringify(f));
  let movimientos = 0;
  for (const d of copia.detalle) {
    if (!d || typeof d !== 'object') return false;
    if (d.sentido === undefined) {   // a note line or a summary line (Moonwell: withdrawn less deposited), optionally with its transaction links
      if (Object.keys(d).some((k) => !['k', 'v', 'enlaces'].includes(k)) || typeof d.k !== 'string' || typeof d.v !== 'string') return false;
      for (const e of d.enlaces ?? []) { if (!e || Object.keys(e).some((k) => !['texto', 'url'].includes(k)) || !/^tx \d+$/.test(String(e.texto)) || !URL_TX.test(String(e.url))) return false; e.texto = 'tx'; e.url = 'tx'; }
      continue;
    }
    if (Object.keys(d).some((k) => !['k', 'v', 'sentido', 'contrapartes', 'enlaces'].includes(k))) return false;
    if (!/^\d{4}-\d{2} · .+$/.test(String(d.k)) || !['entrada', 'salida'].includes(d.sentido) || !new RegExp(`^${d.sentido}: [\\d.,]+ [A-Za-z]+( · [\\d.,]+ [A-Za-z]+)*$`).test(String(d.v))) return false;
    if (!Array.isArray(d.enlaces) || d.enlaces.length === 0 || !Array.isArray(d.contrapartes) || d.contrapartes.length === 0) return false;
    if (String(d.k).slice(10) === CATEGORIA_FIRMANTE) d.k = `${String(d.k).slice(0, 10)}categoría`;   // the exact ruled category, and nothing else, is set aside before the role-word test
    for (const e of d.enlaces) { if (!e || Object.keys(e).some((k) => !['texto', 'url'].includes(k)) || !/^tx \d+$/.test(String(e.texto)) || !URL_TX.test(String(e.url))) return false; e.texto = 'tx'; e.url = 'tx'; }
    for (const c of d.contrapartes) {
      if (!c || Object.keys(c).some((k) => !['texto', 'url'].includes(k))) return false;
      if (c.texto === 'Zenbit' && c.url === undefined) { c.texto = 'c'; continue; }
      const m = URL_DIRECCION.exec(String(c.url));
      if (!CORTA.test(String(c.texto)) || !m || `${m[1].slice(0, 6)}…${m[1].slice(-4)}`.toLowerCase() !== String(c.texto).toLowerCase()) return false;   // an address shown short, linking to its own explorer page
      c.texto = 'c'; c.url = 'c';
      movimientos++;
    }
  }
  return !ROL_O_NOMBRE.test(JSON.stringify(copia)) && !/0x[0-9a-fA-F]{4}/.test(JSON.stringify(copia)) && movimientos >= 0;
}
/** Decimals shown per token on screen: ETH to 4, the USD stablecoins to 2. The exact value stays in the data and in the `title` of the line. */
const DECIMALES_MONTO = { ETH: 4, mWETH: 4, USDT: 2, USDC: 2, DAI: 2, mUSDT: 2 };   // mWETH and mUSDT are the lending-market receipt tokens, read like the asset they stand for
/** One decimal string to `d` places, half up on the magnitude, by integer arithmetic (no float). A nonzero value that would show as zero reads «<0.0001» (its smallest step), never 0. */
export function montoCorto(txt, d) {
  const m = /^([+\-−]?)(\d[\d,]*)(?:\.(\d+))?$/.exec(String(txt).trim());
  if (!m) return String(txt);
  const entera = m[2].replace(/,/g, ''), frac = m[3] ?? '';
  const todo = BigInt(entera + frac.padEnd(d + 1, '0').slice(0, d + 1));   // d decimals plus the first dropped digit
  const noCero = /[1-9]/.test(entera + frac);
  let escala = todo / 10n; if (todo % 10n >= 5n) escala += 1n;
  if (escala === 0n && noCero) return `${m[1]}<0.${'0'.repeat(d - 1)}1`;
  const sEscala = escala.toString().padStart(d + 1, '0');
  return `${m[1]}${sEscala.slice(0, sEscala.length - d)}.${sEscala.slice(sEscala.length - d)}`;
}
/** A line's value as it is read at a booth: every «<number> ETH|USDT|USDC|DAI» shortened, the rest as written. */
export const montoLegible = (v) => {
  const t = String(v);
  const unidad = /(?:^|[^A-Za-z])(ETH|USDT|USDC|DAI)\b/.exec(t)?.[1];
  return t.replace(/([+\-−]?\d[\d,]*(?:\.\d+)?) (ETH|mWETH|USDT|mUSDT|USDC|DAI)\b/g, (_, n, u) => `${montoCorto(n, DECIMALES_MONTO[u])} ${u}`)
    .replace(/\b(retirado|depositado) (\d[\d,]*(?:\.\d+)?)/g, (_, k, n) => unidad ? `${k} ${montoCorto(n, DECIMALES_MONTO[unidad])}` : `${k} ${n}`);   // «(retirado A − depositado B)» carries the unit of the amount before it
};
/** The ENS row of the stand: the name with the ruled label «identificador histórico del Piloto (2025–2026)» (the file must carry exactly that), whether it resolves said plainly, and no address of whoever holds it. Without the label, or with a line that is an address, it is refused. */
export const filaEnsDelStand = (f) => (f && f.etiqueta === ETIQUETA_ENS_STAND && !/Dirección/.test(JSON.stringify(f.detalle ?? [])) && !DESTINATARIO.test(JSON.stringify(f)) ? f : null);
/** What the stand keeps of the onchain rows: the ENS name as a historical identifier, the treasury row when it passes the guard above, and every other row that does not name the museum or any recipient. */
export function filasDelStand(filas) {
  const quedan = [], rechazadas = [];
  for (const f of filas) {
    if (f.id === 'ens') { const e = filaEnsDelStand(f); if (e) quedan.push(e); else rechazadas.push('ens'); }
    else if (f.id === 'tesoreria') { if (filaTesoreriaDelStand(f)) quedan.push(f); else rechazadas.push('tesoreria'); }
    else if (nombraAlMuseo(f) || DESTINATARIO.test(JSON.stringify(f))) rechazadas.push(String(f.id));
    else quedan.push(f);
  }
  return { filas: quedan, rechazadas };
}
/** A snapshot row that names the museum (its title, status, detail, note, link or text): not shown at the stand (the ENS row, a historical identifier, is the exception). */
export const nombraAlMuseo = (fila) => /xolotlcalli/i.test(JSON.stringify([fila.titulo, fila.estado, fila.detalle, fila.nota, fila.aclaracion, fila.aviso, fila.enlace, fila.red]));

/** What the stand's build copies into the folder it serves: only the clips the founder cleared (none without the list) and the onchain rows that are not the ENS name, the treasury or a row that names the museum. */
export function prepararStand({ clips, aprobados, cadena }) {
  const filtrados = clipsDelStand(clips, aprobados);
  return {
    clips: filtrados ?? { fecha: clips?.fecha ?? null, clips: [] },
    cadena: cadena ? { ...cadena, filas: filasDelStand(filasAceptadasPublicas(cadena)).filas } : null,
  };
}

/** @param {{ ficha: any, clips?: any, cadena?: any, ciclo?: any, nombre?: string, pagina?: string, cifrasPiloto?: boolean, tesoreria?: boolean, perfil?: string, clipsAprobados?: any }} o */
export function vistaDeXolotlcalli({ ficha, clips: clipsEntero = null, cadena: cadenaEntera = null, ciclo = null, nombre = NOMBRE_MUSEO, pagina: paginaEntera = '/xolotlcalli/', cifrasPiloto: cifrasPilotoPedido = false, tesoreria: tesoreriaPedida = false, perfil = 'demo', clipsAprobados = null }) {
  // the stand: what the IP review ruled it may show and nothing more: never the treasury row, no ENS, no row that names the museum, no link to its page, only the clips the founder cleared, and the pilot's figures with the booth wording
  // the SITIO profile (axolodao.org, PUBLIC_ATLAS_SITIO=1) is the stand's with three differences: the link to the museum's page, every signed clip (not a cleared list), and the Clips block of Indicadores
  const stand = perfil === 'stand', sitio = perfil === 'sitio', protegido = stand || sitio;
  const tesoreria = protegido ? false : tesoreriaPedida, cifrasPiloto = protegido ? true : cifrasPilotoPedido;
  const cadena = tesoreria || protegido ? cadenaEntera : sinTesoreria(cadenaEntera);
  const clips = stand ? clipsDelStand(clipsEntero, clipsAprobados) : clipsEntero;
  const pagina = stand ? null : paginaEntera;
  const r = ficha.resumen;
  const ap = r.periodoDeOperacion.apertura, ci = r.periodoDeOperacion.cierre;
  const ancladas = origenDeSemanas({ n: r.semanasDeclaradas.valor, ancladas: 0 });
  let filas = filasConOrigen(cadena, { estado: 'hub' });
  let rechazadasStand = [];
  if (protegido) { const r = filasDelStand(filas); filas = r.filas; rechazadasStand = r.rechazadas; }
  const corte = r.registrosPublicos.fechaDeCorte;
  const REGISTRO = 'Registro operativo del museo, archivos públicos';
  return {
    perfil,
    fuenteDe: protegido ? {
      periodo: { texto: 'Fecha de apertura y de cierre del museo', fecha: ficha.fecha }, especies: { texto: REGISTRO, fecha: corte }, sistemas: { texto: REGISTRO, fecha: corte },
      semanas: { texto: REGISTRO, fecha: corte }, registros: { texto: REGISTRO, fecha: corte }, agua: { texto: REGISTRO, fecha: corte }, cobertura: { texto: REGISTRO, fecha: corte }, clips: { texto: 'Xovi, clips confirmados', fecha: clips?.fecha ?? null },
    } : null,
    tituloAgua: protegido ? `Mediciones de agua del ${NOMBRE_MUSEO}` : null,
    slug: 'xolotlcalli',
    nombre: { valor: nombre, origen: { estado: 'hub' } },
    lugar: { valor: ciclo ? `${ciclo.municipio}, ${ciclo.estado}` : 'Querétaro, Querétaro', origen: { estado: 'hub' } },
    cerrado: ci.dia ?? ci.valor ?? ciclo?.cierre ? { fecha: ci.dia ?? ciclo?.cierre ?? null } : null,
    ens: !protegido && ciclo?.ens ? { valor: String(ciclo.ens).replace(/\s*\(pendiente\)\s*$/, ''), nota: /\(pendiente\)/.test(ciclo.ens) ? 'pendiente' : null, origen: origenDelEns({ estado: 'hub' }, cadena) } : null,
    periodo: { valor: { desde: ap.valor, hasta: ci.dia ?? ci.valor, semanas: [ap.semanaIso, ci.semanaIso] }, origen: { estado: 'hub' } },
    especies: { valor: r.especies.valor, origen: { estado: 'hub' } },
    sistemas: { valor: r.sistemas.valor.map((s) => ({ codigo: String(s.sistema).toUpperCase(), especie: s.taxon })), origen: { estado: 'hub' } },
    semanas: { valor: { n: r.semanasDeclaradas.valor, desde: r.semanasDeclaradas.desde, hasta: r.semanasDeclaradas.hasta, ancladas: 0 }, origen: ancladas },
    registros: { valor: r.registrosPublicos.valor, corte: r.registrosPublicos.fechaDeCorte, origen: ancladas },
    cifras: cifrasDelPiloto(ficha, cifrasPiloto),
    ficha,
    clips: clips && clips.clips?.length ? clips : null,
    cadena: filas,
    cadenaLeidoEl: cadena?.leidoEl ?? null,
    cadenaRechazadas: [...filasRechazadas(cadena), ...rechazadasStand],
    pagina,
    fuentes: [{ texto: 'Registro operativo del museo, archivos públicos', corte: r.registrosPublicos.fechaDeCorte }, { texto: 'Vocabulario de propiedades, unidades y métodos' }, { texto: 'Fecha de apertura del museo, tal como la usa el sitio' }, { texto: 'Página de cierre del museo (fecha de cierre y proporción de supervivencia)' }, { texto: 'Informe del primer año (definición del IRC)' }, { texto: 'Xovi · autores por cartera' }, ...(protegido ? [...(sitio ? [{ texto: CITA_ACUERDO }] : []), { texto: ETIQUETAS_CIFRAS_PILOTO.aviso }] : [])],
  };
}
