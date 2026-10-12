/**
 * Los textos de relato de los ejemplares (bajas y vivos): lo que la página dibuja de cada uno.
 *
 * Criterio de maggia IP (7-oct): la narración se queda, pero cada oración lleva a lo más un hecho fechado o contado del registro; no hay conjeturas
 * causales («pudo», «por eso»), ni yuxtaposiciones que insinúen culpa («con esas señales abiertas, el agua no se midió», «mientras se agravaba»),
 * ni nada que señale el error de una persona o un rol, ni lo que dijo el podcast puesto contra el registro. Una ausencia («No hay acciones
 * registradas entre el 2 y el 20 de diciembre») se comprueba contra el registro del mismo ejemplar: una ausencia falsa insinúa descuido.
 *
 * `relatosEnJson(texto)` mira todo campo que la página dibuja: lead, stats_note, momentos[].title/text, stats[].l, curso.latencia.label y pistas[].
 */
import { normalizar } from './limpiar-personas.mjs';

// Conjeturas causales y conectores que insinúan culpa, en español, inglés y portugués.
const CAUSAL = new RegExp([
  '\\b(?:pudo|pudieron|pudiera|pudieran|podr[ií]a|podr[ií]an|derivó|derivaron)\\b',
  '\\bposibles? (?:golpe|estr[eé]s|causa|origen|contagio|infecci[oó]n)\\b',
  '\\bpor eso\\b', '\\bpor lo tanto\\b', '\\bpor ello\\b', '\\bpor consiguiente\\b',
  '\\bcould have\\b', '\\bmight have\\b', '\\bmay have\\b', '\\bwhich is why\\b', '\\bso that\\b', '\\bas a result\\b',
  '\\bpuderam\\b', '\\bpôde\\b', '\\bpodia\\b', '\\bpor isso\\b', '\\bcom isso\\b',
  '\\bcon (?:esas|esos|estas|estos) (?:se[ñn]ales|avisos|datos)\\b', '\\bcon una se[ñn]al abierta\\b', '\\bwith (?:those|these) signals\\b', '\\bcom (?:esses|estes) sinais\\b',
  '\\bmientras se agravaba\\b', '\\bantes de su peor semana\\b', '\\bantes de morir\\b', '\\bantes de que muriera\\b', '\\bhasta que (?:muri[oó]|se agrav[oó])\\b',
  '\\bel mismo d[ií]a (?:en que|que|de)\\b', '\\bese mismo d[ií]a\\b', '\\b(?:un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\\d+) d[ií]as (?:antes|despu[eé]s) (?:de|del|que)\\b',
  '\\bdespu[eé]s del episodio\\b', '\\bantes del episodio\\b',
  '\\blo atribuye\\b', '\\bse atribuye\\b', '\\bculpa\\b', '\\bpor culpa\\b',
  // lo que dijo el podcast puesto contra el registro
  '\\b(?:el|un) podcast (?:dijo|habl[oó]|llam[oó]|cont[oó]|afirm[oó]|mencion[oó]|dec[ií]a)\\b', '\\bseg[uú]n el podcast\\b', '\\bse dijo al aire\\b', '\\bse dijo en p[uú]blico\\b', '\\bel lado de Zenbit\\b',
  '\\bthe podcast (?:said|called|told|claimed)\\b', '\\bo podcast (?:disse|falou|contou)\\b',
  // un animal puesto contra otro, y una revisión en curso dicha en presente
  '\\botro ejemplar de su especie\\b', '\\bother (?:specimen|animal) of its species\\b', '\\boutro exemplar da sua esp[eé]cie\\b',
  '\\best[aá]n en revisi[oó]n\\b', '\\bare under review\\b', '\\best[aã]o em revis[aã]o\\b',
  // una ausencia dicha como descuido
  '\\bsin acci[oó]n\\b(?! registrada)', '\\bNo hay consulta\\b(?! registrada)', '\\bno se not[oó]\\b', '\\bnadie not[oó]\\b', '\\bquedó en un tel[eé]fono\\b',
].join('|'), 'i');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_RE = `(?:${MESES.join('|')})`;
// Las duraciones de una ventana («las cinco semanas anteriores») no son un hecho del registro: no se cuentan.
const UNIDAD = '(?:g|kg|cm|mm|%|°C|d[ií]as?|veces|incidencias?|se[ñn]ales|horas|mediciones|acciones)';

/** Los hechos fechados o contados de una oración: una fecha (o un rango de fechas) y cada cantidad con su unidad. */
export function hechosDeUnaOracion(o) {
  const sinVentana = o.replace(/\b(?:los\s+)?\d+ d[ií]as (?:anteriores|antes del corte)\b/gi, ' VENTANA ');
  const sinRangos = sinVentana.replace(new RegExp(`(?:entre el|del|entre|desde el)\\s+\\d{1,2}(?:\\s+de\\s+${MESES_RE})?\\s+(?:y el|al|y|hasta el)\\s+\\d{1,2}(?:\\s+de\\s+${MESES_RE})?`, 'gi'), ' RANGO ')
    .replace(new RegExp(`(?:entre|de)\\s+${MESES_RE}\\s+(?:y|a)\\s+${MESES_RE}`, 'gi'), ' RANGO ');
  const rangos = (sinRangos.match(/ RANGO /g) ?? []).length;
  const fechas = (sinRangos.match(new RegExp(`\\b\\d{1,2}\\s+de\\s+${MESES_RE}\\b|\\b${MESES_RE}\\s+de\\s+\\d{4}\\b|\\b(?:en|desde|hasta|entre)\\s+${MESES_RE}\\b`, 'gi')) ?? []).length;
  const cantidades = (sinRangos.match(new RegExp(`\\d+(?:[.,]\\d+)?\\s?${UNIDAD}(?![\\p{L}])|\\b(?:una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\\s+(?:veces|d[ií]as|incidencias|se[ñn]ales)`, 'giu')) ?? []).length;
  const compara = /\bmenos que\b|\bm[aá]s que\b|\bde\s+\d+(?:[.,]\d+)?\s?\w+\s+a\s+\d|\bde\s+\d+\s+\w+\s+registradas?,\s+\d+\b|\b\d+\s?\w+\s+a\s+\d+\s?\w+/i.test(o);
  // Una fecha y una cantidad juntas («Pesó 60 g el 9 de noviembre») son un solo hecho fechado y contado; dos fechas o dos cantidades son dos.
  return { total: Math.max(rangos + fechas, cantidades), comparativa: compara };
}

// El texto literal de un renglón del libro o del chat («Bitácora: …», «Chat del equipo: …») se cita como se escribió: lo que dice no es del relato.
const LITERAL = /^(?:Bit[aá]cora|Chat del equipo|Acci[oó]n|Cambio de agua|Veterinario|Tratamiento|Diagn[oó]stico|Retiro|Aislamiento|Aviso al veterinario|Terap[eé]utica)\b[^:]{0,40}: /;

/** Los problemas de un texto de relato (sin su registro): conjeturas, conectores y oraciones con más de un hecho. */
export function problemasDeUnLead(texto) {
  const out = [];
  if (LITERAL.test(texto)) return out;
  // Una falla del equipo y un diagnóstico en el mismo texto se leen como causa y efecto: cada uno va en su propio momento fechado.
  if (/\bfalla (?:la|una) bomba\b/i.test(texto) && /intoxicaci[oó]n|\bpoisoning\b|intoxica[cç][aã]o/i.test(texto)) out.push('una falla de equipo y una intoxicación en el mismo texto');
  const m = CAUSAL.exec(texto);
  if (m) out.push(`una conjetura causal, un conector que insinúa culpa o un podcast contra el registro: «${m[0]}»`);
  for (const o of texto.split(/(?<=[.!?])\s+(?=\S)/)) {
    const { total, comparativa } = hechosDeUnaOracion(o);
    if (total >= 3 || (total === 2 && !comparativa && !/\bentre\b|\bdel\b|\bdesde\b/i.test(o))) out.push(`una oración con más de un hecho fechado o contado: «${o.slice(0, 70)}…»`);
  }
  return out;
}

const mesDe = (nombre) => MESES.indexOf(normalizar(nombre)) + 1;
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** «No hay acciones/mediciones de agua registradas entre el A y el B (de mes)» o «del A al B (de mes)»: los intervalos que dice, con año del registro. */
export function ausenciasDichas(texto, desde, hasta) {
  const out = [];
  const re = new RegExp(`No hay (acciones|mediciones de agua) registradas (?:entre el|del)\\s+(\\d{1,2})(?:\\s+de\\s+(${MESES_RE}))?\\s+(?:y el|al)\\s+(\\d{1,2})\\s+de\\s+(${MESES_RE})`, 'gi');
  for (const m of texto.matchAll(re)) {
    const mesFin = mesDe(m[5]);
    const mesIni = m[3] ? mesDe(m[3]) : mesFin;
    // el año: el del registro en que cae esa fecha (el ejemplar vive dentro de [desde, hasta])
    const anio = (mes, dia) => [Number(desde.slice(0, 4)), Number(hasta.slice(0, 4))].find((y) => iso(y, mes, dia) >= desde && iso(y, mes, dia) <= hasta) ?? Number(hasta.slice(0, 4));
    out.push({ que: m[1].toLowerCase(), de: iso(anio(mesIni, +m[2]), mesIni, +m[2]), a: iso(anio(mesFin, +m[4]), mesFin, +m[4]), frase: m[0] });
  }
  return out;
}

/** Las ausencias de un texto contra el registro del ejemplar (su `curso`): una ausencia falsa es un problema. */
export function ausenciasFalsas(texto, curso) {
  if (!curso?.from || !curso?.to) return [];
  const desde = String(Array.isArray(curso.from) ? curso.from[0] : curso.from);
  const hasta = String(Array.isArray(curso.to) ? curso.to[0] : curso.to);
  const acciones = (curso.respuestas ?? []).map((r) => r[0]);
  const lecturas = curso.lecturas ?? [];
  const out = [];
  for (const a of ausenciasDichas(texto, desde, hasta)) {
    const hay = (a.que === 'acciones' ? acciones : lecturas).filter((d) => d >= a.de && d <= a.a);
    if (hay.length) out.push(`una ausencia falsa: «${a.frase}…» pero el registro tiene ${a.que === 'acciones' ? 'una acción' : 'una medición'} el ${hay[0]}`);
  }
  return out;
}

/** Los campos de un relato que la página dibuja. */
function camposDeUnRelato(r) {
  const campos = [['lead', r.lead], ['stats_note', r.stats_note]];
  for (const m of r.momentos ?? []) campos.push(['momentos.title', m.title], ['momentos.text', m.text]);
  for (const st of r.stats ?? []) campos.push(['stats.l', st.l]);
  if (r.curso?.latencia?.label) campos.push(['curso.latencia.label', r.curso.latencia.label]);
  for (const p of r.pistas ?? []) campos.push(['pistas.title', p.title], ['pistas.text', p.text]);
  return campos.filter(([, t]) => typeof t === 'string' && t);
}

/**
 * La línea «primera señal registrada · primera acción registrada» de un ejemplar: una sola ventana para todos (la del evento principal),
 * y las fechas son las del registro (la señal más temprana del carril 2 y la acción más temprana del carril 3 dentro de esa ventana).
 * Cuando el relato trae `curso.latencia`, la línea y la latencia dicen las mismas fechas.
 */
export function cronologiaFalsa(esp) {
  const out = [];
  const c = esp.relato?.simulacion?.cronologia;
  const w = esp.primary?.window;
  if (!c || !w) return ['la cronología no tiene la ventana del evento principal para comprobarse'];
  const primero = (lane) => (esp.events ?? []).filter((e) => e.lane === lane && e.date >= w.from && e.date <= w.to).map((e) => `${e.date} ${e.time ?? '00:00'}`).sort()[0]?.slice(0, 10) ?? null;
  if ((c.senal ?? null) !== primero(2)) out.push(`cronología de ${esp.alias}: la primera señal dice ${c.senal} y el registro dice ${primero(2)}`);
  if ((c.accion ?? null) !== primero(3)) out.push(`cronología de ${esp.alias}: la primera acción dice ${c.accion} y el registro dice ${primero(3)}`);
  const l = esp.relato?.curso?.latencia;
  if (l?.from && l?.to) {
    if (c.senal !== l.from[0]) out.push(`cronología de ${esp.alias}: la primera señal (${c.senal}) no es la de la latencia (${l.from[0]})`);
    if (c.accion !== l.to[0]) out.push(`cronología de ${esp.alias}: la primera acción (${c.accion}) no es la de la latencia (${l.to[0]})`);
  }
  return out;
}

/** Los problemas de todo relato de un JSON de datos (objetos con `lead`): conjeturas, oraciones con varios hechos, ausencias falsas y los bloques `aire` y `publico`. */
export function relatosEnJson(texto) {
  let valor;
  try { valor = JSON.parse(texto); } catch { return []; }
  const out = [];
  const anda = (v, llave) => {
    if (Array.isArray(v)) { v.forEach((x) => anda(x, llave)); return; }
    if (!v || typeof v !== 'object') return;
    if (typeof v.lead === 'string' && (v.momentos || v.stats || v.curso)) {
      for (const [campo, t] of camposDeUnRelato(v)) {
        for (const p of problemasDeUnLead(t)) out.push(`${campo}: ${p}`);
        for (const p of ausenciasFalsas(t, v.curso)) out.push(`${campo}: ${p}`);
      }
      for (const m of v.momentos ?? []) if (/^Sin (?:registros|mediciones)\b/i.test(m.title ?? '') && m.tone && m.tone !== 'muted') out.push(`momentos.tone: «${m.title}» es un hueco de registro y va en el color neutro, no en «${m.tone}»`);
      for (const st of v.stats ?? []) if (st.key === 'gap' && st.tone === 'rose') out.push(`stats.tone: un hueco de registro («${st.l}») en rosa; va en el color neutro`);
      if ('publico' in v) out.push('un bloque `publico` (lo que se dijo en público puesto contra el registro)');
    }
    if (Array.isArray(v.events)) for (const e of v.events) if (typeof e.text === 'string' && /\bguppy\b|\bguppies\b/i.test(e.text)) out.push(`un evento de ${v.alias} nombra a otros animales de la casa (guppies): «${e.text.slice(0, 60)}»`);
    if (v.relato?.simulacion?.cronologia && Array.isArray(v.events)) for (const p of cronologiaFalsa(v)) out.push(p);
    if ('aire' in v && (v.especimenes || Array.isArray(v.aire))) out.push('un bloque `aire` (lo que se dijo al aire puesto contra el registro)');
    for (const [k, x] of Object.entries(v)) anda(x, k);
  };
  anda(valor, '');
  return out;
}

const ROL_DE_PERSONA = /(?<![\p{L}])(?:(?:el|la)\s+)?(operaci[oó]n|curadur[ií]a|fundador)(?![\p{L}])/giu;

/**
 * maggia IP (7-oct): un rol de una persona («Operación», «Curaduría», «el fundador») no aparece en lo público; todo es «el equipo».
 * Se mira todo texto de los dos JSON generados, sea sujeto de una oración, un prefijo de quien habla o el campo de quien identifica o verifica.
 */
export function rolesEnJson(texto) {
  let valor;
  try { valor = JSON.parse(texto); } catch { return []; }
  const out = [];
  const anda = (v, ruta) => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(ROL_DE_PERSONA)) out.push(`${ruta}: un rol de una persona («${m[0]}»); en lo público es «el equipo»`);
    } else if (Array.isArray(v)) v.forEach((x, i) => anda(x, `${ruta}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) anda(x, `${ruta}.${k}`);
  };
  anda(valor, '');
  return out.slice(0, 5);
}

/** `brain_commit` de un JSON generado es un commit, no «<sha>-dirty»: los datos salieron de un árbol confirmado. `generated` es una fecha. */
export function procedenciaEnJson(texto, hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())) {
  let valor;
  try { valor = JSON.parse(texto); } catch { return []; }
  const out = [];
  if (valor && typeof valor === 'object' && 'brain_commit' in valor) {
    if (!/^[0-9a-f]{7,40}$/.test(String(valor.brain_commit))) out.push(`brain_commit «${valor.brain_commit}» no es un commit confirmado (¿se generó de un árbol sin confirmar?)`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor.generated ?? ''))) out.push(`generated «${valor.generated}» no es una fecha`);
    else if (valor.generated > hoy) out.push(`generated «${valor.generated}» es posterior a hoy en el museo (${hoy}): ¿la fecha de UTC en vez de la de America/Mexico_City?`);
  }
  return out;
}
