/**
 * Lo que el sitio no publica de las personas (decisión del fundador, 7-oct, vía maggia IP): los datos de salud de los animales son
 * públicos, los de las personas no. Un dato público se limpia así:
 *   - se quitan las llaves de quién escribió o dijo algo: autor, autor2, autorPrincipal, autorSecundario, authors;
 *   - se quitan las llaves de los números de caso de un laboratorio (lab_case, labCase);
 *   - en el texto: un nombre ENS de una persona (cualquier .eth que no sea de la lista de nombres de organización), un correo, un teléfono y
 *     una dirección de cartera pasan a un marcador; las palabras de la lista PRIVADA de nombres (ruta en AXOLODAO_PERSONAS_PRIVADAS) pasan a
 *     «[persona]»; y la forma «hecho por Nombre» («realizada por», «aplicado por», «a cargo de», «Dr. Nombre») se limpia aunque el nombre
 *     no esté en la lista, porque una lista de nombres siempre está incompleta. Los nombres de los animales se quedan.
 *   - el texto de un registro se queda como se escribió: no se le cambia el nombre del museo; eso es de los textos y las páginas.
 *
 * La lista de nombres no está en el repositorio. Sí lo están las HUELLAS de sus fichas (src/data/personas-huellas.json), y son HMAC-SHA256
 * con una clave que tampoco está en el repositorio (AXOLODAO_PERSONAS_CLAVE: una variable local y un secreto de GitHub Actions). Un sha256
 * sin clave de «lupita» se revierte en segundos con una lista de nombres comunes; con la clave, no. Sin la clave todo falla hacia lo cerrado.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';

export const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
export const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

/** La clave: al menos 32 bytes aleatorios, en hexadecimal (64 caracteres o más) o en base64 (44 o más). Una clave débil se adivina sin conexión con el centinela. */
export function claveValida(c) {
  if (typeof c !== 'string') return false;
  if (/^[0-9a-f]+$/i.test(c)) return c.length >= 64;       // todo hexadecimal: 64 caracteres son 32 bytes
  return /^[A-Za-z0-9+/_-]{43,}={0,2}$/.test(c) && Buffer.from(c, 'base64').length >= 32;
}

/** La huella de una ficha (una palabra normalizada): HMAC-SHA256 con la clave de AXOLODAO_PERSONAS_CLAVE. Sin clave, o con una débil, falla. */
export function huellaDe(ficha) {
  const clave = process.env.AXOLODAO_PERSONAS_CLAVE;
  if (!claveValida(clave)) throw new Error('falta AXOLODAO_PERSONAS_CLAVE, o es débil: se piden al menos 32 bytes aleatorios (openssl rand -hex 32); una variable local y un secreto de CI, fuera del repositorio. Sin ella las huellas de los nombres no se calculan ni se comparan');
  return createHmac('sha256', clave).update(ficha, 'utf8').digest('hex');
}

export const CLAVES_DE_PERSONAS = new Set(['autor', 'autor2', 'autorPrincipal', 'autorSecundario', 'authors', 'lab_case', 'labCase']);
/** Los nombres ENS de organizaciones, que sí pueden aparecer. */
export const ENS_DE_ORGANIZACION = new Set(['axolodao.eth', 'treasury.axolodao.eth', 'zenbit.axolodao.eth', 'xolotlcalli.axolodao.eth', 'ndali.axolodao.eth', 'zenbit.eth']);

export const RE_ENS = /\b[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)*\.eth\b/gi;
export const RE_CORREO = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// «x at y dot com», «x (at) y (dot) com», «x [arroba] y [punto] com»: un correo escrito para saltarse la forma normal.
export const RE_CORREO_OFUSCADO = /[\w.+-]+\s*[([{]\s*(?:at|arroba)\s*[)\]}]\s*[\w-]+(?:\s*[([{]\s*(?:dot|punto)\s*[)\]}]\s*[\w-]+)+|[\w.+-]+\s+(?:at|arroba)\s+[\w-]+(?:\s+(?:dot|punto)\s+[\w-]+)+/gi;
// Un teléfono con o sin +52, con o sin una etiqueta: 442 123 4567, 442-123-4567, (442) 123 4567, 4421234567.
export const RE_TELEFONO = /(?<![\w.])(?:\+?52[\s.-]?)?(?:\(?\d{2,3}\)?[\s.-]\d{3,4}[\s.-]\d{4}|\d{10})(?![\w])/g;
export const RE_CARTERA = /\b0x[0-9a-fA-F]{40}\b/g;
const RE_PALABRA = /[\p{L}\p{N}]+/gu;

/** Un nombre propio probable: una o dos palabras con mayúscula inicial. */
const NOMBRE = '[\\p{Lu}][\\p{Ll}]{1,}(?:\\s+(?:de\\s+(?:la\\s+)?|del\\s+)?[\\p{Lu}][\\p{Ll}]{1,})?';
const PARTICIPIO = '(?:realizad|hech|aplicad|ejecutad|registrad|medid|revisad|atendid|cambiad|supervisad|capturad|tomad|preparad|indicad|autorizad|firmad|dad|enviad|recibid|entregad|acompañad|verificad|confirmad|administrad|solicitad|cobrad|pagad|compartid|escrit|dich)[oa]s?';
const RE_POR_NOMBRE = new RegExp(`(\\b${PARTICIPIO}\\s+por\\s+(?:parte\\s+de\\s+)?)(${NOMBRE})`, 'gu');
const RE_ACARGO = new RegExp(`(\\b(?:a\\s+cargo\\s+de|con\\s+(?:apoyo|ayuda)\\s+de|gracias\\s+a|por\\s+parte\\s+de)\\s+)(${NOMBRE})`, 'gu');
// «Gracias Nombre», «Atte. Nombre» al cierre; «Se alerta a Nombre» / «avisar a Nombre»; «(pendiente Nombre)»: las formas con que una nota nombra a quien actúa.
const RE_CIERRE = new RegExp(`(\\b(?:Gracias|Saludos|Atte\\.?|Att\\.?|Atentamente|Firma:?)\\s+)(${NOMBRE})(?=\\s*[.!]?\\s*$)`, 'gu');
const RE_AVISA = new RegExp(`(\\b(?:[Ss]e alerta|[Ss]e avisa|[Ss]e notifica|[Ss]e informa|[Aa]visar|[Aa]lertar|[Nn]otificar|[Ii]nformar)\\s+(?:a|al)\\s+)(${NOMBRE})`, 'gu');
const RE_PENDIENTE = new RegExp(`(\\((?:[Pp]endiente|[Rr]esp\\.?|[Rr]esponsable|[Aa] cargo|[Pp]or)\\s*:?\\s*)(${NOMBRE})(?=\\))`, 'gu');
const RE_TITULO = new RegExp(`(\\b(?:Dr|Dra|MVZ|M\\.V\\.Z|Lic|Ing|Biol|Biól|Mtro|Mtra|Prof)\\.?\\s+)(${NOMBRE})`, 'gu');
/** Los nombres propios que no son una persona y pueden seguir a «por» o a «a cargo de». */
const NO_PERSONA = new Set(['zenbit', 'ndali', 'xolotlcalli', 'axolodao', 'xovi', 'museo', 'laboratorio', 'universidad', 'persona', 'equipo', 'direccion', 'operacion', 'ajolotes', 'cuarentena', 'sistema', 'bomba']);
const esNoPersona = (nombre) => { const w = normalizar(nombre.split(/\s+/)[0]); return NO_PERSONA.has(w) || animalesConocidos().has(w); };

/** Los pasos que quitan nombres propios por su forma, sin lista: [{ razon, re }]. */
export const FORMAS_DE_AUTOR = [
  { razon: 'la forma «hecho por Nombre»', re: RE_POR_NOMBRE },
  { razon: 'la forma «a cargo de / con apoyo de Nombre»', re: RE_ACARGO },
  { razon: 'un título con un nombre (Dr., MVZ, Lic.…)', re: RE_TITULO },
  { razon: 'un nombre al cierre («Gracias Nombre», «Atte. Nombre»)', re: RE_CIERRE },
  { razon: 'un nombre tras «se alerta a», «avisar a»…', re: RE_AVISA },
  { razon: 'un nombre entre paréntesis («(pendiente Nombre)»)', re: RE_PENDIENTE },
];

/** Los nombres propios por su forma que quedan en un texto: [{ razon, nombre }]. */
export function nombresPorForma(texto) {
  const hallazgos = [];
  for (const { razon, re } of FORMAS_DE_AUTOR) {
    for (const m of String(texto).matchAll(new RegExp(re.source, re.flags))) {
      if (!esNoPersona(m[2])) hallazgos.push({ razon, nombre: m[2] });
    }
  }
  return hallazgos;
}

/** Los roles de la lista privada, de menor a mayor reserva. El texto editorial deja a `host` y a `consentimiento` (consentimiento por escrito en
 *  el expediente) y no deja a nadie más: personal, practicantes, la lista de embargo y quien pidió retirarse son «el equipo». */
export const ROLES = ['host', 'consentimiento', 'staff', 'intern', 'embargo', 'retirada'];
export const ROLES_EDITORIALES = new Set(['host', 'consentimiento']);

/** Cada línea: «Nombre» o «Nombre | rol». Sin rol es `staff`. */
export function leerPersonasConRol(ruta) {
  if (!ruta || !existsSync(ruta)) throw new Error(`falta la lista privada de nombres de personas: pasa su ruta en AXOLODAO_PERSONAS_PRIVADAS (un nombre por línea, «Nombre | rol» con rol ${ROLES.join(', ')}; vive fuera del repositorio)`);
  return readFileSync(ruta, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
    const [nombre, rol = 'staff'] = l.split('|').map((x) => x.trim());
    if (!ROLES.includes(rol)) throw new Error(`rol desconocido «${rol}» en la lista privada (roles: ${ROLES.join(', ')})`);
    return { nombre, rol };
  });
}

export function leerPersonasPrivadas(ruta) {
  return leerPersonasConRol(ruta).map((p) => p.nombre);
}

/** Las fichas de un nombre: cada palabra de dos o más letras (una inicial suelta no se busca; coincidiría con todo). */
const fichasDe = (nombre) => (normalizar(nombre).match(RE_PALABRA) ?? []).filter((p) => p.length >= 2);

/** Las huellas por rol; una ficha en varios roles queda en el de más reserva. { host: [...], staff: [...], ... } */
export function huellasPorRol(personas) {
  const orden = new Map(ROLES.map((r, i) => [r, i]));
  const mejor = new Map();
  for (const { nombre, rol } of personas) {
    for (const p of fichasDe(nombre)) {
      const h = huellaDe(p);
      if (!mejor.has(h) || orden.get(rol) > orden.get(mejor.get(h))) mejor.set(h, rol);
    }
  }
  const out = Object.fromEntries(ROLES.map((r) => [r, []]));
  for (const [h, r] of mejor) out[r].push(h);
  for (const r of ROLES) out[r].sort();
  return out;
}

/** Las huellas (HMAC de la ficha normalizada) de cada palabra de cada nombre de la lista. */
export function huellasDePersonas(nombres) {
  const set = new Set();
  for (const n of nombres) for (const p of fichasDe(n)) set.add(huellaDe(p));
  const orden = [...set].sort();
  return { huellas: set, digest: sha256(orden.join('\n')), fichas: orden.length };
}

/** Las partes de una palabra pegada: «vJuan» → v, Juan; «JuanConfirma» → Juan, Confirma. Sólo donde cambia de minúscula a mayúscula o de letra a cifra: quitar letras a una palabra común («Llegó» → lego) daría nombres falsos. */
export function partesDePalabra(w) {
  const partes = w.split(/(?<=\p{Ll})(?=\p{Lu})|(?<=\p{L})(?=\d)|(?<=\d)(?=\p{L})/u).filter(Boolean);
  const out = new Set(partes.length > 1 ? partes : []);
  return [...out];
}

const FIRMAS_QUE_NO_SON = new Set(['gracias', 'listo', 'ok', 'fin', 'saludos', 'atte', 'atentamente', 'pendiente', 'cerrado', 'hecho', 'urgente', 'revisar', 'normal', 'estable', 'vivo', 'viva', 'muerto', 'muerta', 'nota', 'todos', 'ninguno', 'ninguna', 'ambos', 'mañana', 'hoy', 'ayer', 'nada', 'sin', 'si', 'no']);
let _animales = null;
/** Los nombres de los animales (bundle de ajolotes): una palabra sola al final de una nota que es uno de ellos no es una firma. */
export function animalesConocidos(sitio) {
  if (_animales) return _animales;
  const f = `${sitio ?? new URL('../..', import.meta.url).pathname}/src/data/ajolotes/bundle.json`;
  const out = new Set(['larva']);
  if (existsSync(f)) {
    const b = JSON.parse(readFileSync(f, 'utf8'));
    const add = (n) => { for (const p of normalizar(n).match(RE_PALABRA) ?? []) if (p.length >= 2) out.add(p); };
    for (const e of b.ejemplares ?? []) { add(e.alias); add(e.nombre); }
    for (const x of b.bajas ?? []) add(x.nombre);
    for (const x of b.bajasSnapshots ?? []) add(x.alias);
  }
  return (_animales = out);
}
/** Las etiquetas con que empieza una cadena de un registro («Tratamiento: …»): una palabra con mayúscula y dos puntos que no es una de ellas puede ser una firma al inicio. */
const ETIQUETAS_DE_REGISTRO = new Set(['bitacora', 'tratamiento', 'accion', 'veterinario', 'diagnostico', 'aislamiento', 'pesaje', 'clip', 'retiro', 'fundador', 'correccion', 'curaduria', 'laboratorio', 'estudios', 'temperaturas', 'saprolegniasis', 'causa', 'resultado', 'nota', 'notas', 'aviso', 'incidencia', 'respuesta', 'senal', 'estado', 'observaciones', 'emergencia', 'faltan', 'averia', 'prueba', 'revision', 'pasa', 'chat', 'cambio', 'terapeutica', 'branquias', 'ojos', 'piel', 'aletas', 'cola', 'cuerpo', 'boca', 'abdomen', 'comportamiento', 'apetito', 'conducta', 'nado', 'flotabilidad', 'extremidades', 'patas', 'cabeza', 'heces', 'alimentacion', 'peso', 'longitud']);
const PALABRA_DE_FIRMA = '\\p{Lu}\\p{Ll}{2,}';
const INICIAL = '\\p{Lu}\\.';
// Una firma al final de una nota: una a tres palabras con mayúscula, o iniciales («A. G.»), tras el último punto o un guion.
const RE_FIRMA = new RegExp(`((?:[.!?…]|\\s[-–—])\\s*)((?:${PALABRA_DE_FIRMA}|${INICIAL})(?:\\s+(?:${PALABRA_DE_FIRMA}|${INICIAL})){0,2})\\s*[.!]?\\s*$`, 'u');
// Una firma al inicio: «Nombre - …» o «Nombre: …» con una o dos palabras con mayúscula que no son una etiqueta de registro.
const RE_FIRMA_INICIO = new RegExp(`^(\\s*)((?:${PALABRA_DE_FIRMA})(?:\\s+${PALABRA_DE_FIRMA})?)(\\s*(?::|[-–—])\\s+\\S)`, 'u');
const noEsNombre = (palabra) => { const n = normalizar(palabra); return FIRMAS_QUE_NO_SON.has(n) || NO_PERSONA.has(n) || animalesConocidos().has(n); };
/** El nombre que firma al final de una nota, o null. Si alguna de sus palabras es un animal, una organización o una palabra de cierre, no es una firma. */
export function firmaAlFinal(texto) {
  const m = RE_FIRMA.exec(String(texto));
  if (!m) return null;
  const palabras = m[2].split(/\s+/);
  if (palabras.some((w) => !/^\p{Lu}\.$/u.test(w) && noEsNombre(w))) return null;
  return m[2];
}
/** El nombre que firma al inicio de una cadena, o null. */
export function firmaAlInicio(texto) {
  const m = RE_FIRMA_INICIO.exec(String(texto));
  if (!m) return null;
  const palabras = m[2].split(/\s+/);
  if (palabras.some((w) => noEsNombre(w) || ETIQUETAS_DE_REGISTRO.has(normalizar(w)))) return null;
  return m[2];
}

/** El texto sin nombres de personas, correos, teléfonos ni carteras. El nombre del museo del registro NO se toca. */
export function limpiarTexto(texto, huellas) {
  const persona = (m, previo, nombre) => (esNoPersona(nombre) ? m : `${previo}[persona]`);
  return texto
    .replace(RE_ENS, (m) => (ENS_DE_ORGANIZACION.has(m.toLowerCase()) ? m : '[persona]'))
    .replace(RE_CORREO, '[correo]')
    .replace(RE_CORREO_OFUSCADO, '[correo]')
    .replace(RE_CARTERA, '[cartera]')
    .replace(RE_TELEFONO, '[teléfono]')
    .replace(RE_POR_NOMBRE, persona)
    .replace(RE_ACARGO, persona)
    .replace(RE_TITULO, persona)
    .replace(RE_CIERRE, persona)
    .replace(RE_AVISA, persona)
    .replace(RE_PENDIENTE, persona)
    .replace(RE_PALABRA, (w) => {
      if (w.length < 2) return w;
      if (huellas.has(huellaDe(normalizar(w)))) return '[persona]';
      // Un nombre pegado a otra cosa («vJuan»): se cambia la parte que es un nombre y se deja el resto.
      const pegadas = partesDePalabra(w);
      if (!pegadas.length || !pegadas.some((p) => p.length >= 3 && huellas.has(huellaDe(normalizar(p))))) return w;
      const camel = w.split(/(?<=\p{Ll})(?=\p{Lu})|(?<=\p{L})(?=\d)|(?<=\d)(?=\p{L})/u).filter(Boolean);
      if (camel.length > 1) return camel.map((p) => (p.length >= 3 && huellas.has(huellaDe(normalizar(p))) ? '[persona]' : p)).join('');
      return w;
    })
    .replace(RE_FIRMA, (m, previo) => (firmaAlFinal(m) ? `${previo}[persona]` : m))
    .replace(RE_FIRMA_INICIO, (m, ini, nombre, resto) => (firmaAlInicio(m) ? `${ini}[persona]${resto}` : m))
    // Una marca de embargo cuenta que se retuvo un ejemplar: sale con su conector.
    .replace(/\s+y\s+\[embargo\]/gi, '').replace(/\b(de|a)\s+\[embargo\]\s+y\s+/gi, '$1 ').replace(/\[embargo\]/gi, '');
}

const CUENTA_UN_EMBARGO = /\[embargo\]/i;
const CUENTA_QUE_SE_RETUVO = /\b(?:se llevaron|llevaron|retirad[oa]|retuvo|retenid[oa])\b/i;

/** El mismo valor JSON limpio: sin las llaves de personas, con el texto limpio y sin las filas que sólo cuentan que se retuvo un ejemplar. */
export function limpiarValor(v, huellas) {
  if (Array.isArray(v)) {
    return v
      .filter((x) => !(Array.isArray(x) && x.some((y) => typeof y === 'string' && CUENTA_UN_EMBARGO.test(y) && CUENTA_QUE_SE_RETUVO.test(y))))
      .map((x) => limpiarValor(x, huellas));
  }
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) if (!CLAVES_DE_PERSONAS.has(k)) out[k] = limpiarValor(x, huellas);
    return out;
  }
  return typeof v === 'string' ? limpiarTexto(v, huellas) : v;
}
