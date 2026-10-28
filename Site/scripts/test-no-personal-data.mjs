#!/usr/bin/env node
/**
 * test-no-personal-data.mjs: lo que el sitio publica no lleva datos de personas, ni notas que ningún aviso de privacidad cubra, ni lógica
 * patentable, ni números de caso de un laboratorio ni su nombre.
 *
 * Decisión del fundador (7-oct, vía la revisión de IP): los datos de salud de los animales que la ley no obliga a guardar en privado son
 * públicos; es el caso de uso del proyecto («entrenar modelos y personas a identificar a tiempo esos problemas para prevenir muertes»).
 * Siguen siendo privados, y esta prueba es roja ante cualquiera de ellos:
 *   - datos personales: nombres del personal, autores de las entradas de una bitácora, nombres ENS que nombran a una persona, correos,
 *     teléfonos, datos de visitantes y direcciones de cartera. El texto clínico y de bitácora sale después de una limpieza de nombres de
 *     personas; los nombres de los animales se quedan;
 *   - notas que ningún aviso de privacidad publicado cubre (las llaves nota/note/notes de los datos);
 *   - lógica patentable: umbrales por especie, reglas de alerta que bloquean la captura, derivación del detector (puntajes, rasgos, regiones);
 *   - números de caso de un laboratorio y el nombre del laboratorio;
 *   - el nombre anterior del museo (Biomuseo): el nombre es «Museo de Ajolotes Xolotlcalli».
 *   - nombres de personas en el texto editorial (pies de las noticias del Pulso, el texto del podcast), por huella y por rol (host, staff,
 *     intern, embargo, retirada; criterio de the IP review, 7-oct): los hosts se quedan; el personal sólo en su papel público («con X en el
 *     podcast», «X explica la medición») y nunca ligado a un hecho de salud, una muerte, un tratamiento o un error de un animal (ahí es
 *     «el equipo»); un practicante, alguien de la lista de embargo o quien pidió retirarse no sale en ningún pie.
 * Dos excepciones estrechas del perfil del sitio (axolodao.org), 22-oct, el fundador vía la revisión de IP, cada una con su autoprueba en rojo:
 *   - una dirección de 40 hex sólo como la ruta de una URL de explorador de direcciones (optimistic.etherscan.io, etherscan.io o basescan.org, /address/)
 *     dentro de `contrapartes[].url` del archivo de la tarjeta en cadena (atlas/real/xolotlcalli-cadena.json, y su copia en dist); en cualquier otro lugar
 *     (texto visible, otra llave, otro archivo, otro anfitrión) sigue en rojo;
 *   - la cita exacta «Biomuseo Xolotlcalli (2025–2026)» (cláusula 8.4 del acuerdo) sólo como la constante CITA_ACUERDO de src/lib/fichaOrg.mjs y una vez
 *     como literal en su copia compilada (dist/_astro/*.js); en un encabezado, un título, otro archivo o cualquier otra forma sigue en rojo.
 * NO es roja ante la salud: un diagnóstico, un tratamiento, una muerte o su causa con el nombre del animal pasan.
 *
 * Falla hacia lo cerrado: un dist vacío, una carpeta que no existe o sin archivos de texto, o sin las huellas de la lista de personas, es
 * rojo. Antes de mirar nada demuestra que cada patrón se pone rojo con sus positivos conocidos y deja pasar sus textos legítimos (la salud
 * incluida).
 *
 * Uso (desde Site/, después de `npm run build`):  npm run test:no-personal-data   (también: npm run test:no-deaths)
 *   node scripts/test-no-personal-data.mjs CARPETA...   sólo esas carpetas (cualquier nombre)
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve } from 'node:path';
import { EMBARGO_SHA256, embargoDigest } from './lib/xlsx-utils.mjs';
import { scanTree } from './lib/embargo-scan.mjs';
import { problemasDeUnLead, relatosEnJson, cronologiaFalsa, rolesEnJson, procedenciaEnJson } from './lib/relatos-check.mjs';
import { ENS_DE_ORGANIZACION, RE_CORREO_OFUSCADO, RE_TELEFONO, firmaAlFinal, firmaAlInicio, huellaDe, nombresPorForma, normalizar, partesDePalabra, sha256 } from './lib/limpiar-personas.mjs';

const SITE = resolve(new URL('..', import.meta.url).pathname);
const TEXTO = new Set(['.html', '.js', '.mjs', '.ts', '.tsx', '.astro', '.json', '.yaml', '.yml', '.xml', '.txt', '.css', '.svg', '.webmanifest', '.md', '.csv']);

const ENS_OK = new Set([...ENS_DE_ORGANIZACION, 'impact.stat.eth', 'axolotarium.eth']);       // «impact.stat.eth…» es una llave de traducción, no un nombre ENS
// Las direcciones públicas de los nodos de la organización (tesorería, identidad administrativa, Zenbit, Xolotlcalli), las de Docs/.../MicroDAOs.
const CARTERAS_DE_ORGANIZACION = new Set(['0xbdf701408ad237faa2d5d3177ae257af35265dbb', '0xcf1aeb4152f01e7643f772f4a08e0e791160b96b', '0xecb4c1245665e8a1f43826355aab0dd6bf336e05', '0xb5b5d7ba8c4474f66f7f86a348b1ce303a4ba02e', '0xec41b19804330f7a56f32418214da0b1414954b1', '0x04cc6b487566b1c821bea04d7ac0d23cede05cc9']);
// Los contratos canónicos de las monedas estables que cuenta la tesorería (src/data/tesoreria.json): son contratos públicos, no carteras de nadie.
const CONTRATOS_DE_ESTABLES = new Set(["0x0b2c639c533813f4aa9d7837caf62653d097ff85", "0x50c5725949a6f0c72e6c4a641f24049a917db0cb", "0x6b175474e89094c44da98b954eedeac495271d0f", "0x7f5c764cbc14f9669b88837ca1490cca17c31607", "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca", "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", "0xdac17f958d2ee523a2206206994597c13d831ec7"]);
for (const c of CONTRATOS_DE_ESTABLES) CARTERAS_DE_ORGANIZACION.add(c);
const CORREOS_DE_ORGANIZACION = /@(?:axolodao\.org|zenbit\.mx|zenbit\.eth)$/i;
const SIN_COMILLA = '(?:"|\'|&quot;|&#34;|&#x22;|\\\\")?';
// Una llave de dato: entre comillas (JSON, atributos de las islas, &quot;) o sin ellas pegada a «{» o «,» (JS minificado); no una palabra de una frase.
const CLAVE = (nombres) => `(?:(?:"|'|&quot;|&#34;|&#x22;|\\\\")(?:${nombres})(?:"|'|&quot;|&#34;|&#x22;|\\\\")|(?<=[{,])(?:${nombres}))`;

const JUICIO = '(?:tard[ií]a|tard[ií]o|negligen\\w*|incumpl\\w*|descuid\\w*|incompeten\\w*|error(?:es)? (?:de|del|en) (?:la\\s+)?(?:direcci[oó]n|operaci[oó]n|veterinari|coordinaci[oó]n|cuidad|encargad)\\w*|fall[oó] (?:la\\s+)?(?:direcci[oó]n|operaci[oó]n|el\\s+veterinari)\\w*|(?:was|were|too) late|failed (?:to|in)|negligen\\w*)';
const ROL = '(?:direcci[oó]n(?:\\s+cl[ií]nica)?|veterinari[oa]|vet\\b|operaci[oó]n|coordinaci[oó]n|cuidador\\w*|encargad[oa]|responsable|\\[persona\\]|management|director)';
const JUICIO_JUNTO_A_ROL = new RegExp(`${JUICIO}[^.\\n]{0,60}${ROL}|${ROL}[^.\\n]{0,60}${JUICIO}`, 'i');

/** La tarjeta en cadena del sitio: las URL de explorador de direcciones de sus contrapartes son las únicas que pueden llevar una dirección completa. Devuelve el texto sin ellas. */
const ARCHIVO_CADENA = /(?:^|[/\\])atlas[/\\]real[/\\]xolotlcalli-cadena\.json$/;
// The test fixtures under scripts/ may use reserved names (RFC 2606/6761: example.com/.net/.org, *.example, *.invalid, *.test, *.localhost)
// and ENS names of the form «<algo>-de-prueba[.…].eth»; the same names in any other folder, the dist included, are findings.
const EN_SCRIPTS = (archivo) => /(?:^|[/\\])Site[/\\]scripts[/\\]/.test(archivo) || /^scripts[/\\]/.test(archivo);
const CORREO_RESERVADO = /@(?:example\.(?:com|net|org)|(?:[\w-]+\.)*(?:example|invalid|test|localhost))$/i;
const ENS_DE_PRUEBA = /^[a-z0-9-]+-de-prueba(?:\.[a-z0-9-]+)*\.eth$/i;
// A digit run inside a URL is a path or an id (a GBIF occurrence), not a phone; a link that carries a phone (wa.me, WhatsApp) stays in.
const URL_CON_TELEFONO = /^https?:\/\/(?:wa\.me|api\.whatsapp\.com|(?:www\.)?whatsapp\.com)\//i;
export const sinRutasDeUrl = (t) => t.replace(/https?:\/\/[^\s"'<>()\\]+/g, (u) => (URL_CON_TELEFONO.test(u) ? u : ' '));
// The authorship of a confirmed clip is public (the wallet authorship ruling): only in the pilot's public clips file, only under the key
// «autor», and only as a shortened wallet (0x1234…abcd). The image credits' authors are licence attribution: only in that file.
const ARCHIVO_CLIPS = /(?:^|[/\\])atlas[/\\]real[/\\]xolotlcalli-clips\.json$/;
const ARCHIVO_CREDITOS = /(?:^|[/\\])creditos-imagenes\.json$/;
// The two cases where a researcher's or an author's name may be published (the IP review, with the founder's approval, 22-oct):
//   1. inside a verbatim quotation of a published source that is followed by its citation with the page: on a page, a <blockquote
//      data-cita-literal> followed by <cite data-cita-fuente>…p. N</cite>; in a content file, a field followed by its «<field>Cita» with the
//      page; and, in the attested profile data the quotation comes from, the verbatim passages themselves;
//   2. an author's name inside a bibliography entry: a page's <ul data-referencias>, a content file's «references» list, a data file's
//      source entry ({"cite", "title"}); and, in data and page files, an in-text author-year citation: «Apellido(s) [et al.|y
//      colaboradores] (AAAA)» or «(Apellido et al., AAAA)», the name directly followed by a four-digit year. A titled name (Dr./Dra.) or a
//      name with no year («com. pers.») is not a citation and stays a finding outside a quotation of case 1.
// Everything else is a finding, and a contact detail (a mail, a phone) inside those spans is still a finding. A removal request from a
// named person takes the passage out of the served files (and the profile bundle is attested again).
const CITA_EN_PAGINA = /<blockquote[^>]*data-cita-literal[^>]*>[\s\S]*?<\/blockquote>\s*<figcaption[^>]*>\s*<cite[^>]*data-cita-fuente[^>]*>[^<]*\bp\. \d+[^<]*<\/cite>/g;
const REFERENCIAS_EN_PAGINA = /<ul[^>]*data-referencias[^>]*>[\s\S]*?<\/ul>/g;
const CITA_EN_YAML = /^(\w+): ("(?:[^"\\\n]|\\.)*")\n\1Cita: "[^"\n]*\bp\. \d+[^"\n]*"$/gm;
const REFERENCIAS_EN_YAML = /^references:\n(?:[ \t]+- .*(?:\n|$))+/gm;
const REFERENCIA_EN_JSON = /("cite":"(?:[^"\\]|\\.)*",)"title":"(?:[^"\\]|\\.)*"/g;
const PASAJES_ATESTADOS = [/el grupo de trabajo de la Dra\. Ireri Suazo \(UMSNH\) ha recolectado/g, /\(Rodolfo Pérez-Rodríguez com\. pers\.\)/g];
const APELLIDO = String.raw`\p{Lu}[\p{L}'’]+(?:-\p{Lu}[\p{L}'’]+)*`;
const APELLIDOS = String.raw`${APELLIDO}(?:\s+(?:y|e|and|&)\s+${APELLIDO})?`;
const ANIO = String.raw`(?:1[6-9]|20)\d{2}[a-z]?`;
const CITA_AUTOR_ANIO = new RegExp(String.raw`(?<!\bDra?\.\s)(?<!\bDra?\s)\b${APELLIDOS}(?:\s+(?:et al\.|y colaboradores|y cols?\.))?\s+\(${ANIO}\)|\(${APELLIDOS}(?:\s+et al\.)?,\s*${ANIO}\)`, 'gu');
const DATOS_ATESTADOS = /(?:^|[/\\])(?:(?:src[/\\]data[/\\]atlas-snapshot|dist[/\\]atlas[/\\]datos)[/\\]especies-atlas\.json|dist[/\\]atlas[/\\]datos[/\\]huella[/\\][0-9a-f]{12}-perfiles[/\\]taxon_profiles\.jsonl)$/;
/** The text without the two allowed spans, and what was taken out (still read for contact details). */
export function citasYReferencias(t, archivo = '') {
  const quitado = [];
  const sin = (x, re, deja = '') => x.replace(re, (m, p1) => { quitado.push(m); return deja === 'prefijo' ? `${p1}"title":""` : ' '; });
  let x = t;
  if (/\.html?$/i.test(archivo)) { x = sin(x, CITA_EN_PAGINA); x = sin(x, REFERENCIAS_EN_PAGINA); }
  if (/\.ya?ml$/i.test(archivo)) { x = sin(x, CITA_EN_YAML); x = sin(x, REFERENCIAS_EN_YAML); }
  if (/\.json$/i.test(archivo)) x = sin(x, REFERENCIA_EN_JSON, 'prefijo');
  if (/\.(?:json|jsonl|html?)$/i.test(archivo)) x = sin(x, CITA_AUTOR_ANIO);
  if (DATOS_ATESTADOS.test(archivo)) for (const re of PASAJES_ATESTADOS) x = sin(x, re);
  return { texto: x, quitado: quitado.join('\n') };
}
const CONTACTO = /correo|teléfono/;
// A unix timestamp (ten digits) as the value of a key that names a time: «…At» (retrievedAt, lastDataAt, createdAt) or «timestamp», in JSON or
// in code. Only the value of such a key: the same digits under any other key, or loose in the text, stay a phone.
const MARCA_DE_TIEMPO = /(["']?)(\b[a-z]\w*At|\btimestamp)\1(\s*:\s*)\d{10}(?!\d)/g;
export const sinMarcasDeTiempo = (t) => t.replace(MARCA_DE_TIEMPO, '$1$2$1$3');
const sinAutoriaDeClips = (t, archivo) => (ARCHIVO_CLIPS.test(archivo) ? t.replace(/(["'])autor\1\s*:\s*(["'])0x[0-9a-f]{4}…[0-9a-f]{4}\2/g, '') : t);
const URL_EXPLORADOR = /^https:\/\/(?:optimistic\.etherscan\.io|etherscan\.io|basescan\.org)\/address\/0x[0-9a-fA-F]{40}$/;
export function sinUrlsDeContrapartes(t, archivo = '') {
  if (!ARCHIVO_CADENA.test(archivo)) return t;
  let j; try { j = JSON.parse(t); } catch { return t; }
  let resto = t;
  // se quitan tantas apariciones de cada URL como contrapartes la llevan: una aparición de más (otra llave) queda y se marca
  for (const fila of Array.isArray(j?.filas) ? j.filas : []) for (const d of Array.isArray(fila?.detalle) ? fila.detalle : []) for (const c of Array.isArray(d?.contrapartes) ? d.contrapartes : []) {
    if (typeof c?.url !== 'string' || !URL_EXPLORADOR.test(c.url)) continue;
    const lit = JSON.stringify(c.url), i = resto.indexOf(lit);
    if (i >= 0) resto = resto.slice(0, i) + '""' + resto.slice(i + lit.length);
  }
  return resto;
}
/** La cita del acuerdo (cláusula 8.4): sólo su constante en fichaOrg.mjs y un literal en su copia compilada. Devuelve el texto sin ella. */
const CITA = 'Biomuseo Xolotlcalli (2025–2026)';
export function sinCitaDelAcuerdo(t, archivo = '') {
  if (/(?:^|[/\\])src[/\\]lib[/\\]fichaOrg\.mjs$/.test(archivo)) return t.split(`export const CITA_ACUERDO = '${CITA}';`).join('');
  if (/(?:^|[/\\])dist[/\\]_astro[/\\][^/\\]+\.js$/.test(archivo)) {
    for (const q of ['"', "'", '`']) { const i = t.indexOf(q + CITA + q); if (i >= 0) return t.slice(0, i) + t.slice(i + CITA.length + 2); }
  }
  return t;
}
/** Cada comprobación: { razon, busca(texto, {datos}) → bool }. `datos` es verdadero en dist, public/data, src/data y src/content. */
const COMPROBACIONES = [
  {
    razon: 'un nombre ENS que no es de una organización (puede nombrar a una persona)',
    busca: (t, { archivo = '' }) => [...t.matchAll(/\b[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)*\.eth\b/gi)].some((m) => !ENS_OK.has(m[0].toLowerCase()) && !/(?:^|\.)(?:mycompany|miempresa|minhaempresa)\.eth$/i.test(m[0])
      && !(EN_SCRIPTS(archivo) && ENS_DE_PRUEBA.test(m[0]))),
  },
  {
    razon: 'un autor de una entrada (llave autor, autor2, autorPrincipal, autorSecundario o authors en un dato)',
    busca: (t, { datos, archivo = '' }) => datos && !ARCHIVO_CREDITOS.test(archivo) && new RegExp(`${CLAVE('autor|autor2|autorPrincipal|autorSecundario|authors')}\\s*:`).test(sinAutoriaDeClips(t, archivo)),
  },
  { razon: 'un correo electrónico', busca: (t, { archivo = '' }) => [...t.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)].some((m) => !CORREOS_DE_ORGANIZACION.test(m[0]) && !/\.(?:png|jpe?g|svg|webp|css|js)$/i.test(m[0])
      && !(EN_SCRIPTS(archivo) && CORREO_RESERVADO.test(m[0]))) },
  {
    razon: 'un teléfono',
    // La biblioteca del mapa (MapLibre, de terceros) trae constantes de hash de diez dígitos (2^32 − 1 y semejantes): no son teléfonos. Sólo ese archivo.
    busca: (t, { archivo = '' }) => !/\.(?:svg|css)$/i.test(archivo) && !/(?:^|[/\\])_astro[/\\]maplibre-gl\.[\w-]+\.js$/.test(archivo)
      && (new RegExp(RE_TELEFONO.source, 'g').test(sinMarcasDeTiempo(sinRutasDeUrl(t)).replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')) || /(?:tel[eé]fono|tel\.|whatsapp|celular)\s*:?\s*\+?\d[\d\s.-]{8,}/i.test(t)),
  },
  { razon: 'un correo escrito para saltarse la forma normal (x at y dot com)', busca: (t) => new RegExp(RE_CORREO_OFUSCADO.source, 'i').test(t) },
  { razon: 'una dirección de cartera (de una persona)', busca: (t, { archivo = '' }) => [...sinUrlsDeContrapartes(t, archivo).matchAll(/\b0x[0-9a-fA-F]{40}\b/g)].some((m) => !CARTERAS_DE_ORGANIZACION.has(m[0].toLowerCase())) },
  { razon: 'datos de visitantes (nombre, correo o teléfono de quien visitó)', busca: (t, { datos }) => datos && new RegExp(`${CLAVE('visitorName|visitor_name|nombreVisitante|visitorEmail|correoVisitante|visitorPhone')}\\s*:`, 'i').test(t) },
  {
    razon: 'una nota que ningún aviso de privacidad cubre (llave nota, nota de la hoja o notes en un dato; note en las mediciones de agua)',
    busca: (t, { datos, archivo = '' }) => datos && new RegExp(`${CLAVE(/water-quality\/measurements/.test(archivo) ? 'nota|note|notes' : 'nota|notaDeLaHoja|sheetNote|notes')}\\s*:(?!\\s*null\\b)`).test(t),
  },
  {
    razon: 'lógica patentable (umbrales por especie, reglas de alerta que bloquean la captura, derivación del detector)',
    busca: (t) => /blockCapture|capture[_-]?block|bloquea(?:r|n)? la captura|alert[_-]?rule|reglaDeAlerta|species[_-]?threshold|umbrales? por especie|detector[_-]?(?:score|trait|region)|puntaje del detector|rasgos del detector|regiones del detector/i.test(t),
  },
  { razon: 'un número de caso de un laboratorio', busca: (t) => /lab[_-]?case\s*(?:["']?\s*:\s*["'][^"']+["'])|(?:caso|case|folio|expediente)\s*(?:de laboratorio|laboratorio|lab)\s*(?:n[.o°º]{0,2}\s*)?[:#]?\s*[A-Z0-9][A-Z0-9/-]{3,}|laborator(?:io|y)[^.<]{0,60}\b(?:caso|case|folio|expediente)\s*(?:n[.o°º]{0,2}\s*)?[:#]?\s*[A-Z0-9][A-Z0-9/-]{3,}/i.test(t) },
  {
    razon: 'el nombre de un laboratorio',
    // El laboratorio que analizó una muestra o hizo una necropsia, no el de una referencia bibliográfica: se pide el contexto clínico cerca.
    busca: (t) => /(?:necrops|muestra|resultado|prueba|an[aá]lisis|diagn[oó]st|histopatolog|cultivo|enviad)[^.<]{0,120}\b[Ll]aborator(?:io|ies|y)\s+(?:de|del|of)\s+[A-ZÁÉÍÓÚ]|\b[Ll]aborator(?:io|ies|y)\s+(?:de|del|of)\s+[A-ZÁÉÍÓÚ][^.<]{0,120}(?:necrops|muestra|resultado|prueba|diagn[oó]st|histopatolog|cultivo)/u.test(t),
  },
  {
    // El nombre nuevo es de los textos y las páginas, no de lo registrado: el texto de un registro (public/data, src/data, dist/data) se queda como se escribió.
    razon: 'el nombre anterior del museo (Biomuseo)',
    busca: (t0, { archivo = '' }) => {
      if (/(?:^|[/\\])(?:public|dist|src)[/\\]data[/\\]/.test(archivo)) return false;
      const t = sinCitaDelAcuerdo(t0, archivo);
      // Una página lleva el registro dentro de los props de una isla (props="…"): ese texto también se queda como se escribió.
      const visible = /\.html$/i.test(archivo) ? t.replace(/\sprops="[^"]*"/g, ' ') : t;
      return /bio[\s-]?muse(?:o|u|um)/i.test(visible);
    },
  },
  {
    razon: 'el nombre de un laboratorio escrito como siglas (laboratorio LANIVET, enviado a CIAD)',
    busca: (t) => /(?:\b[Ll]aborator(?:io|y)|\bLab\.?|\benviad[oa]s?\s+a|\banalizad[oa]s?\s+en|\bprocesad[oa]s?\s+en)\s+(?:(?:de|del|of)\s+)?[A-ZÁÉÍÓÚ]{3,}\b/.test(t),
  },
  {
    razon: 'un número de día pegado a una palabra de rol («9 veces desde el 27 operación»): un nombre cambiado por su rol se comió el mes de una fecha',
    busca: (t, { datos }) => datos && /\b\d{1,2}\s+(?:operaci[oó]n|la curadur[ií]a|el veterinario|comunicaci[oó]n|invitad[oa]|Ndali)\b/.test(t),
  },
  { razon: 'una marca de embargo en un texto (cuenta que se retuvo un ejemplar)', busca: (t) => /\[embargo\]/i.test(t) },
  {
    razon: 'un nombre propio por su forma («realizada por Nombre», «a cargo de Nombre», «Dr. Nombre»): la lista de nombres siempre está incompleta',
    busca: (t, { datos, archivo = '' }) => datos && /(?:^|[/\\])(?:(?:public|dist|src)[/\\]data[/\\]|dist[/\\](?:(?:en|pt)[/\\])?xolotlcalli[/\\])/.test(archivo) && nombresPorForma(t).length > 0,
  },
  {
    // Revisión de IP, 7-oct: se publica lo medible («respuesta registrada N días después de la señal», del equipo del museo), no un juicio sobre una persona ni un rol.
    razon: 'un juicio sobre el desempeño de una persona o un rol (tardía, negligente, error de…, late, failed…) junto a un rol o un nombre',
    busca: (t) => (JUICIO_JUNTO_A_ROL.test(t) || new RegExp(`${CLAVE('grade|grade_60')}\\s*:\\s*(?:"|')(?:tard[ií]a|oportuna|ausente|late|timely)`, 'i').test(t) || new RegExp(`${CLAVE('role')}\\s*:\\s*(?:"|')(?:direcci[oó]n|veterinari|operaci[oó]n|coordinaci[oó]n|cuidad|encargad|responsable|gerente|director)`, 'i').test(t)),
  },
];

export function problemasDeTexto(texto, { datos = false, archivo = '' } = {}) {
  const t = String(texto);
  return COMPROBACIONES.filter((c) => c.busca(t, { datos, archivo })).map((c) => c.razon);
}

// ---- Los nombres de personas, por huella (HMAC con una clave fuera del repositorio) -------------------------------------------------------
function cargarHuellasDePersonas() {
  const f = join(SITE, 'src/data/personas-huellas.json');
  if (!existsSync(f)) return null;
  const d = JSON.parse(readFileSync(f, 'utf8'));
  if (!Array.isArray(d.huellas) || !d.huellas.length || sha256([...d.huellas].sort().join('\n')) !== d.digest) return null;
  // Sólo se publica quién puede salir en lo editorial (host, consentimiento); cualquier otra ficha es «el equipo».
  const roles = d.roles && typeof d.roles === 'object' ? d.roles : null;
  const ok = roles && ['host', 'consentimiento'].every((r) => Array.isArray(roles[r])) && Object.keys(roles).length === 2
    && sha256(Object.entries(roles).map(([r, hs]) => `${r}:${hs.join(',')}`).join('\n')) === d.digestRoles;
  const set = new Set(d.huellas);
  set.roles = ok ? roles : null;       // null: sin esta lista la parte editorial falla hacia lo cerrado
  return set;
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', ccedil: 'ç', atilde: 'ã', otilde: 'õ', ecirc: 'ê', ocirc: 'ô' };
/** El texto con sus entidades HTML decodificadas (&#76;upita, &#x4C;upita, &aacute;): un nombre no se esconde detrás de una entidad. */
export function sinEntidades(t) {
  return String(t)
    .replace(/&#x([0-9a-f]+);?/gi, (m, h) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff)))
    .replace(/&#(\d+);?/g, (m, n) => String.fromCodePoint(Math.min(+n, 0x10ffff)))
    .replace(/&([A-Za-z]+);/g, (m, n) => ENTIDADES[n] ?? m);
}

const MESES = new Set(['jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'ene', 'abr', 'ago', 'dic', 'enero', 'febrero', 'marzo', 'abril', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre', 'fev', 'set', 'out', 'dez', 'junho', 'julho', 'setembro', 'outubro', 'dezembro']);
const MES_ANTES = new Set(['in', 'of', 'since', 'until', 'by', 'from', 'last', 'next', 'early', 'late', 'mid', 'during', 'this']);
/** Las palabras de un texto con sus vecinas (entidades decodificadas). */
function palabrasDe(texto) {
  const out = [];
  let previa = '';
  for (const linea of sinEntidades(texto).split('\n')) {
    const ws = linea.match(/[\p{L}\p{N}]+/gu) ?? [];
    ws.forEach((w, i) => {
      const ant = i ? ws[i - 1] : previa;
      const sig = ws[i + 1] ?? '';
      out.push({ w, previa: ant, previa2: i > 1 ? ws[i - 2] : '', sigue: sig, sigue2: ws[i + 2] ?? '' });
    });
    previa = ws.length ? ws[ws.length - 1] : previa;
  }
  return out;
}
/** «May» es un mes, no un nombre, sólo si la vecina inmediata es una cifra, otro mes («Apr, May, Jun») o una preposición de fecha («in May»). */
const esMes = ({ previa, sigue }) => /^\d/.test(sigue) || /^\d/.test(previa) || MESES.has(previa.toLowerCase()) || MESES.has(sigue.toLowerCase()) || MES_ANTES.has(previa.toLowerCase());
const MES_O_MAY = new Set([...MESES, 'may', 'mayo']);
const UNE_MESES = new Set(['and', 'y', 'e', 'or', 'o', 'to', 'a', 'al', 'through']);
/** Un mes («May», «mayo»), con mayúscula o sin ella, que está en una fecha: junto a una cifra o una preposición de fecha, en una lista o un rango de meses («in April and May», «Feb, Mar, Apr»), o en «mayo de 2026». En una zona de datos no es un nombre. La misma palabra suelta («firmado: May») sí lo es. */
const mesEnFecha = (ficha, pal) => MES_O_MAY.has(ficha.toLowerCase())
  && (esMes(pal) || (UNE_MESES.has(pal.previa.toLowerCase()) && MES_O_MAY.has(pal.previa2.toLowerCase())) || (['de', 'del', 'of'].includes(pal.sigue.toLowerCase()) && /^\d/.test(pal.sigue2)));
/** Las fichas de una palabra: ella y sus partes si está pegada a otra cosa («vJuan», «JuanConfirma», «vjuan»). */
const fichasDe = (w) => [w, ...partesDePalabra(w)].filter((x) => x.length >= 2);

/** Cuántas fichas de la lista hay en un texto. `estricto` (código, textos, documentos): sólo un nombre propio, con mayúscula inicial y no un mes. */
export function personasEnTexto(texto, huellas, permitidas = new Set(), { estricto = false } = {}) {
  let n = 0;
  for (const pal of palabrasDe(texto)) {
    const { w } = pal;
    if (w.length < 2) continue;
    for (const ficha of fichasDe(w)) {
      const h = huellaDe(normalizar(ficha));
      if (!huellas.has(h) || permitidas.has(h)) continue;
      if (mesEnFecha(ficha, pal)) continue;
      if (estricto && (!/^\p{Lu}/u.test(ficha) || esMes(pal))) continue;
      n++;
      break;
    }
  }
  return n;
}

// ---- Los nombres en el texto editorial -------------------------------------------------------------------------------------------------
/** Hallazgos en un pie o texto editorial: cualquier ficha de la lista que no sea de un host ni de quien dio su consentimiento es «el equipo». */
export function nombresEditoriales(texto, huellas, permitidas) {
  const hallazgos = [];
  for (const pal of palabrasDe(texto)) {
    const { w } = pal;
    if (w.length < 2) continue;
    for (const ficha of fichasDe(w)) {
      if (!/^\p{Lu}/u.test(ficha) || esMes(pal)) continue;                        // un nombre propio empieza con mayúscula («may» no es «May»)
      const h = huellaDe(normalizar(ficha));
      if (huellas.has(h) && !permitidas.has(h)) { hallazgos.push({ razon: 'un nombre de la lista sale en el texto editorial, y no es de un host ni de quien dio su consentimiento: debe decir «el equipo»' }); break; }
    }
  }
  return hallazgos;
}

/** Las firmas al final de una nota en un JSON: una sola palabra con mayúscula tras el último punto o un guion que no es un animal. */
export function firmasEnJson(texto) {
  let valor;
  try { valor = JSON.parse(texto); } catch { return []; }
  const out = [];
  const anda = (v) => {
    if (typeof v === 'string') { const f = firmaAlFinal(v) ?? firmaAlInicio(v); if (f) out.push(f); }
    else if (Array.isArray(v)) v.forEach(anda);
    else if (v && typeof v === 'object') Object.values(v).forEach(anda);
  };
  anda(valor);
  return out;
}

// ---- Recorrido ------------------------------------------------------------------------------------------------------------------------
function* archivos(dir) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.git') continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) yield* archivos(p);
    else yield p;
  }
}

/** { revisados, problemas }. Una carpeta inexistente o sin archivos de texto es un problema; `minimo` exige un número de archivos. */
export function recorrer(raices, { minimo = 1, exigir = [], datos = () => false, excluir = () => false, personas = null, editorial = null } = {}) {
  const problemas = [];
  let revisados = 0;
  for (const raiz of raices) {
    if (!existsSync(raiz) || !statSync(raiz).isDirectory()) { problemas.push(`${raiz}: no existe o no es una carpeta`); continue; }
    let enRaiz = 0;
    for (const f of archivos(raiz)) {
      if (!TEXTO.has(extname(f).toLowerCase())) continue;
      enRaiz++;
      if (excluir(f)) continue;
      revisados++;
      const { texto, quitado } = citasYReferencias(readFileSync(f, 'utf8'), f);
      for (const razon of problemasDeTexto(texto, { datos: datos(f), archivo: f })) problemas.push(`${f}: ${razon}`);
      if (quitado) for (const razon of problemasDeTexto(quitado, { archivo: f }).filter((r) => CONTACTO.test(r))) problemas.push(`${f}: ${razon} (dentro de una cita o una referencia)`);
      if (personas && personas.zona(f)) {
        const n = personasEnTexto(texto, personas.huellas, personas.permitidas(f), { estricto: Boolean(personas.estricto?.(f)) });
        if (n) problemas.push(`${f}: ${n} ficha(s) de la lista de nombres de personal`);
      }
      if (editorial && editorial.zona(f)) {
        for (const h of nombresEditoriales(texto, editorial.huellas, editorial.permitidas)) problemas.push(`${f}: ${h.razon}`);
      }
      if (datos(f) && extname(f).toLowerCase() === '.json' && /(?:^|[/\\])(?:(?:public|dist|src)[/\\]data[/\\])/.test(f)) {
        for (const p of relatosEnJson(texto)) problemas.push(`${f}: ${p}`);
        if (/(?:^|[/\\])(?:bajas-forense|seguimiento)\.json$/.test(f)) for (const p of [...rolesEnJson(texto), ...procedenciaEnJson(texto)]) problemas.push(`${f}: ${p}`);
        const firmas = firmasEnJson(texto);
        if (firmas.length) problemas.push(`${f}: ${firmas.length} nota(s) firmada(s) con un nombre propio al final (una sola palabra con mayúscula tras el último punto)`);
      }
    }
    if (enRaiz < minimo) problemas.push(`${raiz}: ${enRaiz} archivo(s) de texto; se exigen al menos ${minimo} (¿una construcción vacía?)`);
    for (const e of exigir) if (!existsSync(join(raiz, e))) problemas.push(`${raiz}: falta ${e}`);
  }
  return { revisados, problemas };
}

// ---- El detector se prueba a sí mismo -------------------------------------------------------------------------------------------------
const DATO = { datos: true };
const A40 = '0x' + 'ab'.repeat(20);   // una dirección de prueba, no de nadie
const REGISTRO = { datos: true, archivo: 'public/data/ajolotes/seguimiento.json' };
const POSITIVOS = [
  ['g=3432918353', { archivo: 'dist/_astro/index.abc123.js' }, 'un teléfono'], ['tel 4421234567', { archivo: 'dist/_astro/maplibre-gl-extra.js' }, 'un teléfono'],
  ['{"autorPrincipal":"x.axolodao.eth"}', DATO, 'un autor de una entrada'], ["{autor2:'x'}", DATO, 'un autor de una entrada'], ['&quot;authors&quot;: {', DATO, 'un autor de una entrada'],
  ['persona-uno.axolodao.eth', {}, 'un nombre ENS'], ['curador: persona-dos.axolodao.eth', {}, 'un nombre ENS'],
  ['escribe a persona@ejemplo.com', {}, 'un correo electrónico'], ['escribe a persona at ejemplo dot com', {}, 'un correo escrito para saltarse'], ['persona (at) ejemplo (dot) com', {}, 'un correo escrito para saltarse'],
  ['Tel. +52 442 123 4567', {}, 'un teléfono'], ['WhatsApp: 4421234567', {}, 'un teléfono'], ['llámale al 442 123 4567', {}, 'un teléfono'], ['(442) 123-4567', {}, 'un teléfono'], ['442.123.4567', {}, 'un teléfono'],
  ['0x1111111111111111111111111111111111111111', {}, 'una dirección de cartera'], ['{"visitorEmail":"a@b.co"}', DATO, 'datos de visitantes'],
  ['{"nota":"texto libre de la hoja"}', DATO, 'una nota que ningún aviso'], ['{notes:"x"}', DATO, 'una nota que ningún aviso'],
  ['blockCapture: true', {}, 'lógica patentable'], ['si el umbral por especie bloquea la captura', {}, 'lógica patentable'], ['detector_score', {}, 'lógica patentable'], ['regiones del detector', {}, 'lógica patentable'],
  ['{"lab_case":"LAB-2026-0412"}', DATO, 'un número de caso de un laboratorio'], ['Laboratorio de Patología Acuática, caso n.º AB-1234', {}, 'un número de caso de un laboratorio'],
  ['la necropsia se hizo en el Laboratorio de Patología Acuática', {}, 'el nombre de un laboratorio'],
  ['resultado del laboratorio LANIVET: negativo', {}, 'el nombre de un laboratorio escrito como siglas'], ['muestra enviada a CIAD para cultivo', {}, 'el nombre de un laboratorio escrito como siglas'],
  ['Biomuseo Xolotlcalli', {}, 'el nombre anterior del museo'], ['Xolotlcalli BioMuseum', {}, 'el nombre anterior del museo'], ['Visitantes ao BioMuseu', {}, 'el nombre anterior del museo'], ['Bio Museo', {}, 'el nombre anterior del museo'], ['<p>Bienvenidos al Biomuseo</p>', { datos: true, archivo: 'dist/index.html' }, 'el nombre anterior del museo'],
  // la excepción de direcciones: nada fuera de la URL de una contraparte en el archivo de la tarjeta pasa
  [`{"filas":[{"id":"x","titulo":"pago a ${A40}"}]}`, { datos: true, archivo: 'dist/atlas/real/xolotlcalli-cadena.json' }, 'una dirección de cartera'],
  [`{"filas":[{"id":"x","detalle":[{"contrapartes":[{"texto":"c","url":"https://optimistic.etherscan.io/address/${A40}"}],"otra":"https://optimistic.etherscan.io/address/${A40}"}]}]}`, { datos: true, archivo: 'dist/atlas/real/xolotlcalli-cadena.json' }, 'una dirección de cartera'],
  [`{"filas":[{"id":"x","detalle":[{"contrapartes":[{"texto":"c","url":"https://optimistic.etherscan.io/address/${A40}"}]}]}]}`, { datos: true, archivo: 'dist/atlas/real/otro.json' }, 'una dirección de cartera'],
  [`{"filas":[{"id":"x","detalle":[{"contrapartes":[{"texto":"c","url":"https://explorador-ajeno.example/address/${A40}"}]}]}]}`, { datos: true, archivo: 'dist/atlas/real/xolotlcalli-cadena.json' }, 'una dirección de cartera'],
  [`{"filas":[{"id":"x","detalle":[{"contrapartes":[{"texto":"${A40}","url":"https://optimistic.etherscan.io/address/${A40}"}]}]}]}`, { datos: true, archivo: 'dist/atlas/real/xolotlcalli-cadena.json' }, 'una dirección de cartera'],
  // la excepción de la cita: sólo la constante y un literal compilado
  [`const T = 'Mediciones de agua del ${CITA}';`, { archivo: 'src/lib/fichaOrg.mjs' }, 'el nombre anterior del museo'],
  [`export const CITA_ACUERDO = '${CITA}';\nconst h = 'Biomuseo';`, { archivo: 'src/lib/fichaOrg.mjs' }, 'el nombre anterior del museo'],
  [`export const CITA_ACUERDO = '${CITA}';`, { archivo: 'src/lib/otro.mjs' }, 'el nombre anterior del museo'],
  [`export const CITA_ACUERDO = 'Biomuseo Xolotlcalli';`, { archivo: 'src/lib/fichaOrg.mjs' }, 'el nombre anterior del museo'],
  [`<title>${CITA}</title>`, { archivo: 'dist/atlas/index.html' }, 'el nombre anterior del museo'],
  [`a="${CITA}",b="${CITA}"`, { archivo: 'dist/_astro/Atlas.abc123.js' }, 'el nombre anterior del museo'],
  [`a="Mediciones de agua del ${CITA}"`, { archivo: 'dist/_astro/Atlas.abc123.js' }, 'el nombre anterior del museo'],
  ['el que se llevaron es [embargo]; sigue en la pecera', {}, 'una marca de embargo'],
  ['9 veces desde el 27 operación', DATO, 'un número de día pegado'], ['Aplicacion realizada por Rosendo', REGISTRO, 'un nombre propio por su forma'], ['tratamiento aplicado por Mariana Lopez', REGISTRO, 'un nombre propio por su forma'], ['a cargo de Fernando', REGISTRO, 'un nombre propio por su forma'], ['revisión del Dr. Esteban Ruiz', REGISTRO, 'un nombre propio por su forma'],
  ['respuesta tardía de la Dirección clínica del museo', DATO, 'un juicio sobre el desempeño'], ['la dirección fue negligente con la señal', DATO, 'un juicio sobre el desempeño'], ['the vet was late to answer', DATO, 'un juicio sobre el desempeño'],
  ['"grade": "tardía"', DATO, 'un juicio sobre el desempeño'], ['"role": "Dirección clínica del museo"', DATO, 'un juicio sobre el desempeño'],
  // the narrow exceptions stay narrow: a phone in plain text or in a phone link, a reserved address or a test ENS outside scripts/, a non-test
  // ENS form inside scripts/, and an author anywhere but the two files and forms that may carry one
  ['tel 4421234567', {}, 'un teléfono'], ['escríbenos: https://wa.me/524421234567', {}, 'un teléfono'],
  // a timestamp passes only as the value of a key that names a time: under another key, or loose, ten digits stay a phone
  ['{"contacto": 4421234567}', DATO, 'un teléfono'], ['{"retrievedAtNota": "4421234567"}', DATO, 'un teléfono'], ['retrievedAt 4421234567', {}, 'un teléfono'], ['{"At": 4421234567}', DATO, 'un teléfono'],
  ['a@example.invalid', { archivo: 'dist/index.html' }, 'un correo electrónico'], ['a@example.invalid', { archivo: 'src/lib/x.mjs' }, 'un correo electrónico'],
  ['acuario-de-prueba.axolodao.eth', { archivo: 'dist/index.html' }, 'un nombre ENS'], ['ens: x.eth', { archivo: 'scripts/test-x.mjs' }, 'un nombre ENS'],
  ['{"autor":"0x1234…abcd"}', { datos: true, archivo: 'dist/atlas/real/otro.json' }, 'un autor'], ['{"autor":"Ana López"}', { datos: true, archivo: 'dist/atlas/real/xolotlcalli-clips.json' }, 'un autor'],
  ['{"autor":"0x1234abcd"}', { datos: true, archivo: 'dist/atlas/real/xolotlcalli-clips.json' }, 'un autor'], ['{"autor2":"0x1234…abcd"}', { datos: true, archivo: 'dist/atlas/real/xolotlcalli-clips.json' }, 'un autor'],
  ['{"autor":"x"}', { datos: true, archivo: 'src/data/otros-creditos.json' }, 'un autor'],
];
// Lo que SÍ puede salir: la salud de un animal con su nombre, la muerte y su causa, organizaciones, y datos sin persona.
const NEGATIVOS = [
  ['Panchita murió el 8 de julio por una infección bacteriana; se aplicó ivermectina 0.2 mg/L y baño de sal', DATO],
  ['Chocorrol: tratamiento antifúngico con verde de malaquita, en cuarentena desde el 30 de agosto', DATO], ['Larva 2 murió el 23 de septiembre, causa desconocida', DATO],
  ['"diagnostico":"Saprolegnia","tratamiento":"Desparacitante","observaciones":"mejoría"', DATO], ['Notificación a veterinario', DATO], ['Tasa de supervivencia 37.0 %', DATO],
  ['xolotlcalli.axolodao.eth, zenbit.axolodao.eth, ndali.axolodao.eth, treasury.axolodao.eth', DATO], ['hola@axolodao.org', {}], ['0xbdf701408aD237faa2d5d3177ae257af35265dbb', {}],
  [`{"filas":[{"id":"x","detalle":[{"contrapartes":[{"texto":"c","url":"https://optimistic.etherscan.io/address/${A40}"},{"texto":"d","url":"https://basescan.org/address/${A40}"}]}]}]}`, { datos: true, archivo: 'dist/atlas/real/xolotlcalli-cadena.json' }],
  [`export const CITA_ACUERDO = '${CITA}';`, { archivo: 'src/lib/fichaOrg.mjs' }], [`a="${CITA}",b=1`, { archivo: 'dist/_astro/Atlas.abc123.js' }],
  ['"nota": null', DATO], ['{"retrievedAt": 1792734384}', DATO], ['const AT = { retrievedAt: 1792734384 };', { archivo: 'scripts/test-x.mjs' }], ['{"lastDataAt":1792734384,"timestamp": 1792734384}', DATO], ['Museo de Ajolotes Xolotlcalli (2025–2026)', {}], ['Se conocen 17 especies; temperatura 17.15 °C y pH 7.4', DATO], ['impact.stat.eth', {}],
  ['El laboratorio de agua del museo midió amoníaco y nitritos', {}], ['{"authorityKey": 1, "authorized": true}', DATO],
  ['Lavado de trapos de Biomuseo', { datos: true, archivo: 'public/data/ops/bitacora.json' }], ['<astro-island props="{&quot;notas&quot;:&quot;Lavado de trapos de biomuseo&quot;}"></astro-island>', { datos: true, archivo: 'dist/xolotlcalli/index.html' }],                  // el texto de un registro se queda como se escribió
  ['Aplicación realizada por [persona]', REGISTRO], ['realizada por el equipo del museo', REGISTRO], ['Publicado por Zenbit', REGISTRO],
  ['Respuesta registrada 5 días después de la señal, por el equipo del museo', DATO], ['9 veces desde el 27 de mayo; 12 días con la curaduría de guardia', DATO], ['"role": "Laboratorio"', DATO], ['"grade": "A"', DATO],
  ['Fechas del 2026-05-09 al 2026-05-12, serie 2026-0512-0001', {}], ['resultados de pH y amoníaco, enviados a análisis', {}],
  ['https://www.gbif.org/occurrence/6334480905', {}], ['{"url":"https://www.gbif.org/occurrence/6334480905"}', DATO],
  ['git config user.email a@example.invalid', { archivo: 'scripts/test-atlas.mjs' }], ['acuario-de-prueba.axolodao.eth', { archivo: 'scripts/test-ficha-org.mjs' }],
  ['{"clips":[{"autor":"0x721a…58d7"},{"autor":"0x84de…f096"}]}', { datos: true, archivo: 'dist/atlas/real/xolotlcalli-clips.json' }],
  ['{"imagenes":[{"autor":"Usuario de Wikimedia Commons"}]}', { datos: true, archivo: 'src/data/creditos-imagenes.json' }],
];
for (const [t, op, razon] of POSITIVOS) {
  if (!problemasDeTexto(t, op).some((p) => p.startsWith(razon))) { console.error(`✗ el detector no ve su positivo conocido: ${t} (${razon})`); process.exit(2); }
}
for (const [t, op] of NEGATIVOS) {
  const p = problemasDeTexto(t, op);
  if (p.length) { console.error(`✗ el detector marca un texto legítimo (la salud no es un problema): ${t} → ${p.join(', ')}`); process.exit(2); }
}
console.log(`  ✓ el detector ve sus ${POSITIVOS.length} positivos conocidos y deja pasar sus ${NEGATIVOS.length} textos legítimos (la salud con el nombre del animal incluida)`);

// Los nombres, por huella: se prueba con una clave y unas fichas inventadas, sin tocar la lista real.
const claveReal = process.env.AXOLODAO_PERSONAS_CLAVE;
const CLAVE_DE_PRUEBA = 'ab'.repeat(32);     // 32 bytes que no son los reales
process.env.AXOLODAO_PERSONAS_CLAVE = CLAVE_DE_PRUEBA;
try {
  const ficha = (n) => huellaDe(normalizar(n));
  // Nombres inventados: host (Zoe), consentimiento (Mia) y el resto de la lista (Ana, Beto, Carla, Dora, May).
  const permitidas = new Set([ficha('Zoe'), ficha('Mia')]);
  const huellas = new Set(['Zoe', 'Mia', 'Ana', 'Beto', 'Carla', 'Dora', 'Mar'].map(ficha));
  const hallazgos = (t) => nombresEditoriales(t, huellas, permitidas).length;
  const rojos = ['Beto limpia los tanques', 'Carla ayudó con el agua', 'Gracias a Dora', 'Ana aplicó el tratamiento a Panchita', 'Ana cambió el agua', 'Ana nos acompaña en el podcast', 'Mar se une al equipo de tiempo completo', 'Zara and Ana, con apoyo de AN&#65;', 'vAna confirma el dato'];
  for (const t of rojos) if (!hallazgos(t)) { console.error(`✗ el texto editorial no pone rojo: ${t}`); process.exit(2); }
  const verdes = ['Zoe y Mia conversan en el podcast', 'Zoe cuenta cómo murió Tamal', 'el equipo aplicó el tratamiento a Panchita', 'in Mar 2026 the museum opened', 'with a view in mar', 'del 4 al 10 de Mar 2026', 'Feb, Mar, Apr', 'Panchita regresa al museo'];
  for (const t of verdes) if (hallazgos(t)) { console.error(`✗ el texto editorial marca un texto legítimo: ${t}`); process.exit(2); }
  // Un nombre no se esconde detrás de una entidad HTML ni pegado a otra cosa, y en el código sólo cuenta como nombre propio.
  const detecta = (t, op, permit = new Set()) => personasEnTexto(t, huellas, permit, op);
  for (const t of ['&#65;na limpió', '&#x41;na limpió', 'Beto', 'cambio de agua con Dora', 'cambio de agua con Dor&#97;', 'vBeto confirma el dato', 'BetoConfirma el dato']) if (!detecta(t)) { console.error(`✗ un nombre escondido no se detecta por huella: ${t}`); process.exit(2); }
  // En una zona de datos (no estricta) un mes con mayúscula en un contexto de fecha («in April and May», «mayo de 2026», «Feb, Mar, Apr») no es un nombre; la misma palabra suelta, como firma, sí; y los nombres de la lista siguen saliendo.
  for (const t of ['in Mar 2026', 'del 4 al 10 de Mar 2026', 'Feb, Mar, Apr', 'in April and Mar, and the adult', 'Mar de 2026', 'from April to Mar']) if (detecta(t)) { console.error(`✗ un mes en contexto de fecha se marca como nombre en una zona de datos: ${t}`); process.exit(2); }
  for (const t of ['firmado: Mar', 'Mar', 'nota firmada por Mar', 'mar abierto', 'Beto in Mar 2026', 'Ana 2026']) if (!detecta(t)) { console.error(`✗ un nombre suelto (o un mes en minúscula, o un nombre junto a una fecha) ya no se detecta en una zona de datos: ${t}`); process.exit(2); }
  if (detecta('mar abierto', { estricto: true }) || detecta('in Mar 2026', { estricto: true }) || detecta('Feb, Mar, Apr', { estricto: true }) || !detecta('Mar ayudó', { estricto: true }) || detecta('ana', { estricto: true }) || detecta('anaquel y betonera', {}) || detecta('Llegó muy frágil', { estricto: true })) { console.error('✗ el modo estricto (código y textos) cuenta un mes o una palabra común como un nombre'); process.exit(2); }
  // En un registro (bitácora, historial) un host que actúa como personal también es «el equipo»: ahí no se permite a nadie.
  if (!detecta('Zoe confirma el dato', {}) || detecta('Zoe confirma el dato', {}, permitidas)) { console.error('✗ la prueba de registros no distingue lo editorial (donde un host puede salir) de un registro (donde nadie)'); process.exit(2); }
  // Una firma al final de una nota, que no está en la lista, sale; un animal o una palabra de cierre no.
  const registro = (obj) => firmasEnJson(JSON.stringify(obj)).length;
  if (!registro({ notas: 'Cambio de agua completo. Ana Gil' }) || !registro({ notas: 'Cambio de agua completo. A. G.' }) || !registro({ notas: 'Rosalinda - revisó las bombas' }) || !registro({ notas: 'Rosalinda: revisó las bombas' }) || registro({ notas: 'Tratamiento: ivermectina' }) || registro({ notas: 'Chat del equipo: Panchita regresó' }) || registro({ notas: 'AM 2: cambio de agua' }) || registro({ notas: 'Se alimentó. Tamal de dulce' }) || !registro({ notas: 'Cambio de agua completo. Rosalinda' }) || !registro({ notas: 'Revisión de bombas - Fernando' }) || registro({ notas: 'Cambio de agua completo. Gracias' }) || registro({ notas: 'Se alimentó. Panchita' }) || registro({ notas: 'Cambio de agua' }) || registro({ notas: 'Revisión de la bomba y el filtro' })) { console.error('✗ la firma al final de una nota no se detecta, o se marca un animal o una palabra de cierre'); process.exit(2); }
  // Los textos de relato: nada de conjeturas causales ni de oraciones que junten hechos; la narración con un hecho por oración pasa.
  const lead = (t) => problemasDeUnLead(t).length;
  for (const t of ['viajes que pudieron exponerla a cambios bruscos', 'No se midió, por eso empeoró.', 'It could have been exposed.', 'Os viajes puderam expô-la.', 'Con esas señales abiertas, el agua no se midió.', 'El 9 de mayo pesó 50 g y el 12 de mayo 40 g y el 15 de mayo murió.']) {
    if (!lead(t)) { console.error(`✗ un texto de relato que no debe pasar pasa: ${t}`); process.exit(2); }
  }
  for (const t of ['Según el testimonio del fundador, en 2025 salió del museo dos veces: a la Expo Qro en septiembre y a una convención en otro estado.', 'No hay mediciones de agua registradas entre el 17 y el 19 de abril.', 'De 9 incidencias registradas, 7 se anotaron como «solo observación».', 'El 21 de abril pesó 50 g, 22 % menos que en enero.', '9 de septiembre: señal registrada. 10 de septiembre: señal registrada.', 'Murió el 5 de mayo.']) {
    if (lead(t)) { console.error(`✗ un texto de relato legítimo se marca: ${t} → ${problemasDeUnLead(t).join(' | ')}`); process.exit(2); }
  }
  // Más formas de firma: con un punto final, un cierre, un aviso a alguien, un paréntesis.
  for (const t of ['Cambio de agua. Rosalinda.', 'Cambio de agua. Gracias Rosalinda', 'Se alerta a Rosalinda', 'Revisión pendiente (pendiente Rosalinda)', 'Cambio de agua. Atte. Rosalinda Gil']) {
    if (!nombresPorForma(t).length && !firmaAlFinal(t)) { console.error(`✗ una forma de firma no se detecta: ${t}`); process.exit(2); }
  }
  for (const t of ['Se alerta al resto del equipo', 'Se alerta a Panchita', 'Gracias a todos', 'Revisado por el veterinario']) {
    if (nombresPorForma(t).length || firmaAlFinal(t)) { console.error(`✗ una frase sin firma se marca: ${t}`); process.exit(2); }
  }
  // Los relatos: cada campo que la página dibuja, un aviso falso de ausencia, y los bloques `aire` y `publico`.
  const relato = (extra = {}) => JSON.stringify({ alias: 'X', lead: 'Murió el 5 de mayo.', stats_note: 'Son distancias entre registros.', momentos: [{ d: '2026-01-02', title: 'Sin mediciones de agua registradas', text: 'No hay mediciones de agua registradas entre el 3 y el 4 de enero.' }],
    stats: [{ n: '2', u: 'días', l: 'sin mediciones de agua registradas' }], curso: { from: '2025-12-20', to: '2026-01-10', lecturas: ['2025-12-30', '2026-01-05'], respuestas: [['2026-01-02', '10:00', 'si', ['Cambio de agua']]], latencia: { label: '2 días' } }, ...extra });
  const rojosRelato = [
    ['lead', { lead: 'Con una señal abierta, el agua no se midió.' }], ['momento', { momentos: [{ title: 'x', text: 'Pierde el ojo; un posible golpe que derivó en infección.' }] }], ['título', { momentos: [{ title: 'El mismo día en que el podcast habló de ella', text: 'x' }] }],
    ['stat', { stats: [{ n: '3', u: 'días', l: 'sin medir el agua mientras se agravaba' }] }], ['latencia', { curso: { from: '2025-12-20', to: '2026-01-10', lecturas: [], respuestas: [], latencia: { label: '5 días · estándar 48 h antes de su peor semana' } } }],
    ['pista', { pistas: [{ title: 'x', text: 'Leucística pasó tres días así antes de su peor semana.' }] }],
    ['ausencia falsa de acciones', { lead: 'No hay acciones registradas entre el 1 y el 3 de enero.' }], ['ausencia falsa de mediciones', { lead: 'No hay mediciones de agua registradas entre el 4 y el 6 de enero.' }],
    ['otro ejemplar de su especie', { lead: 'El 5 de mayo otro ejemplar de su especie pasó el día revolcándose.' }],
    ['revisión en presente', { lead: 'Las grabaciones de ese día están en revisión.' }],
    ['falla de equipo junto a un diagnóstico', { momentos: [{ title: 'x', text: 'Falla la bomba; el veterinario habla de intoxicación por amoníaco.' }] }],
    ['hueco en rosa', { stats: [{ n: '3', u: 'días', l: 'sin mediciones de agua registradas, del 17 al 19 de abril', tone: 'rose', key: 'gap' }] }],
    ['hueco de registro en ámbar', { momentos: [{ d: '2026-01-02', title: 'Sin registros de alimentación', text: 'El último registro antes es del 14 de abril.', tone: 'amber' }] }],
    ['publico', { publico: { cita: 'x' } }], ['una oración con tres hechos', { lead: 'El 5 de mayo pesó 40 g y el 6 de mayo pesó 38 g y el 7 de mayo 36 g.' }],
  ];
  for (const [que, extra] of rojosRelato) if (!relatosEnJson(relato(extra)).length) { console.error(`✗ un relato que no debe pasar pasa (${que})`); process.exit(2); }
  // Los roles de personas no salen en lo público (todo es «el equipo»), y los datos dicen el commit que los produjo.
  for (const [que, t] of [['Operación como sujeto', 'Operación hace el tratamiento'], ['Curaduría como sujeto', 'Curaduría informa que salió'], ['Fundador como sujeto', 'Fundador comparte video'], ['el fundador', 'El fundador pregunta si'], ['un prefijo de quien habla', 'Chat del equipo: curaduría: es normal'], ['de operación', 'con ayuda de operación'], ['identifica', 'el fundador']]) {
    if (!rolesEnJson(JSON.stringify({ especimenes: [{ events: [{ text: t }] }] })).length) { console.error(`✗ un rol de una persona pasa (${que})`); process.exit(2); }
  }
  for (const t of ['El equipo hace el tratamiento', 'Operaciones de limpieza', 'Fundamentos', 'Chat del equipo: Panchita con mejor ánimo']) {
    if (rolesEnJson(JSON.stringify({ events: [{ text: t }] })).length) { console.error(`✗ un texto sin rol se marca: ${t}`); process.exit(2); }
  }
  if (procedenciaEnJson(JSON.stringify({ generated: '2026-10-07', brain_commit: '9496fa1' })).length || procedenciaEnJson(JSON.stringify({ especimenes: [] })).length) { console.error('✗ una procedencia correcta se marca'); process.exit(2); }
  if (!procedenciaEnJson(JSON.stringify({ generated: '2026-10-08', brain_commit: '9496fa1' }), '2026-10-07').length || procedenciaEnJson(JSON.stringify({ generated: '2026-10-07', brain_commit: '9496fa1' }), '2026-10-07').length) { console.error('✗ la fecha de UTC un día adelante no se marca (o la de hoy sí)'); process.exit(2); }
  for (const [que, o] of [['sucio', { generated: '2026-10-07', brain_commit: '9496fa1-dirty' }], ['vacío', { generated: '2026-10-07', brain_commit: '' }], ['sin fecha', { generated: 'ayer', brain_commit: '9496fa1' }]]) {
    if (!procedenciaEnJson(JSON.stringify(o)).length) { console.error(`✗ una procedencia que no debe pasar pasa (${que})`); process.exit(2); }
  }
  // La línea de cronología de un ejemplar dice las fechas del registro y las de su latencia, con una ventana para todos.
  const esp = (c, lat = { from: ['2026-05-20', '09:36'], to: ['2026-05-28', '17:21'] }) => ({ alias: 'X', primary: { window: { from: '2026-05-10', to: '2026-06-05' } },
    events: [{ lane: 2, date: '2026-05-20', time: '09:36' }, { lane: 2, date: '2026-04-12', time: '09:00' }, { lane: 3, date: '2026-05-28', time: '17:21' }, { lane: 3, date: '2026-04-20', time: '10:00' }],
    relato: { lead: 'x', momentos: [], simulacion: { reglas: [], cronologia: c }, curso: { latencia: lat } } });
  const cron = (e) => cronologiaFalsa(e).length;
  if (cron(esp({ senal: '2026-05-20', accion: '2026-05-28' }))) { console.error('✗ una cronología verdadera se marca'); process.exit(2); }
  for (const [que, e] of [['señal fuera de la ventana', esp({ senal: '2026-04-12', accion: '2026-05-28' })], ['acción fuera de la ventana', esp({ senal: '2026-05-20', accion: '2026-04-20' })], ['sin fecha de señal', esp({ senal: null, accion: '2026-05-28' })],
    ['distinta de la latencia', esp({ senal: '2026-05-20', accion: '2026-05-28' }, { from: ['2026-05-19', '10:00'], to: ['2026-05-28', '17:21'] })]]) {
    if (!cron(e)) { console.error(`✗ una cronología que no debe pasar pasa (${que})`); process.exit(2); }
  }
  if (!relatosEnJson(JSON.stringify({ especimenes: [{ ...esp({ senal: '2026-05-20', accion: '2026-05-28' }), events: [{ lane: 2, date: '2026-05-20', time: '09:36', text: 'Vigilar a la hembra; guppies muriendo' }, { lane: 3, date: '2026-05-28', time: '17:21', text: 'Cambio de agua' }] }] })).length) { console.error('✗ un evento que nombra a los guppies pasa'); process.exit(2); }
  if (relatosEnJson(JSON.stringify({ especimenes: [{ ...esp({ senal: '2026-05-20', accion: '2026-05-28' }), events: [{ lane: 2, date: '2026-05-20', time: '09:36', text: 'Vigilar a la hembra' }, { lane: 3, date: '2026-05-28', time: '17:21', text: 'Cambio de agua' }] }] })).length) { console.error('✗ un evento legítimo se marca'); process.exit(2); }
  if (!relatosEnJson(JSON.stringify({ especimenes: [esp({ senal: '2026-04-12', accion: '2026-05-28' })] })).length) { console.error('✗ relatosEnJson no mira la cronología de los ejemplares'); process.exit(2); }
  if (!relatosEnJson(JSON.stringify({ especimenes: [], aire: [{ claim: 'x' }] })).length) { console.error('✗ un bloque aire pasa'); process.exit(2); }
  if (relatosEnJson(relato()).length) { console.error(`✗ un relato legítimo se marca: ${relatosEnJson(relato()).join(' | ')}`); process.exit(2); }
  if (relatosEnJson(relato({ lead: 'No hay acciones registradas entre el 3 y el 10 de enero.' })).length) { console.error('✗ una ausencia verdadera se marca'); process.exit(2); }
  // Sin clave, o con una débil, las huellas no se calculan: falla hacia lo cerrado, no deja pasar.
  delete process.env.AXOLODAO_PERSONAS_CLAVE;
  let sinClave = false;
  try { personasEnTexto('Ana', huellas); } catch { sinClave = true; }
  if (!sinClave) { console.error('✗ sin AXOLODAO_PERSONAS_CLAVE la prueba de nombres pasa'); process.exit(2); }
  for (const debil of ['clave-de-prueba-que-no-es-la-real', 'abcd', 'ab'.repeat(31), '0'.repeat(63)]) {
    process.env.AXOLODAO_PERSONAS_CLAVE = debil;
    let falla = false;
    try { personasEnTexto('Ana', huellas); } catch { falla = true; }
    if (!falla) { console.error(`✗ una clave débil se acepta: ${debil.length} caracteres`); process.exit(2); }
  }
  process.env.AXOLODAO_PERSONAS_CLAVE = CLAVE_DE_PRUEBA;

  const t = mkdtempSync(join(tmpdir(), 'sin-personas-'));
  try {
    const vacio = join(t, 'vacio'); mkdirSync(vacio);
    if (!recorrer([vacio], { minimo: 10, exigir: ['index.html'] }).problemas.length) { console.error('✗ un dist vacío pasa'); process.exit(2); }
    if (!recorrer([join(t, 'no-existe')]).problemas.length) { console.error('✗ una carpeta que no existe pasa'); process.exit(2); }
    const otra = join(t, 'salida-con-otro-nombre'); mkdirSync(otra);
    writeFileSync(join(otra, 'a.json'), '{"autorPrincipal":"x"}');
    if (!recorrer([otra], { datos: () => true }).problemas.some((p) => p.includes('autor'))) { console.error('✗ una carpeta que no se llama dist se salta'); process.exit(2); }
    const limpia = join(t, 'limpia'); mkdirSync(limpia); writeFileSync(join(limpia, 'index.html'), '<p>Panchita murió de una infección. Semana 18</p>');
    if (recorrer([limpia]).problemas.length) { console.error('✗ una carpeta con salud (sin datos personales) no pasa'); process.exit(2); }
    writeFileSync(join(limpia, 'b.json'), '{"notas":"cambio de agua con Dora"}');
    if (!recorrer([limpia], { personas: { huellas, permitidas: () => new Set(), zona: () => true } }).problemas.some((p) => p.includes('nombres de personal'))) { console.error('✗ un nombre de personal no se detecta por huella'); process.exit(2); }
    // Los dos casos permitidos (revisión de IP, 22-oct): una cita literal seguida de su cita con página, y un autor dentro de una referencia.
    // Rojo: el mismo nombre fuera de la cita, una cita sin página, y un dato de contacto junto a un nombre citado.
    const conSuazo = new Set([...huellas, ficha('Suazo')]);
    const pag = join(t, 'dist', 'especies', 'x'); mkdirSync(pag, { recursive: true });
    const cita = (pie) => `<figure><blockquote data-cita-literal>Recientemente el grupo de trabajo de la Dra. Ireri Suazo (UMSNH) ha recolectado ejemplares.</blockquote><figcaption><cite data-cita-fuente>${pie}</cite></figcaption></figure>`;
    const revisa = (html) => { writeFileSync(join(pag, 'index.html'), html); return recorrer([join(t, 'dist')], { personas: { huellas: conSuazo, permitidas: () => new Set(), zona: () => true } }).problemas; };
    const nombres = (ps) => ps.filter((p) => p.includes('nombres de personal'));
    if (nombres(revisa(cita('SEMARNAT (2018), PACE Ambystoma, p. 20'))).length) { console.error('✗ una cita literal con su página marca el nombre citado'); process.exit(2); }
    if (nombres(revisa('<ul data-referencias><li>Medina-Aguilar, O., I. Suazo-Ortuño y J. Díaz-Alvarado, 2011. Herpetofauna de Tacámbaro.</li></ul>')).length) { console.error('✗ un autor en una referencia se marca'); process.exit(2); }
    if (!nombres(revisa(cita('SEMARNAT (2018), PACE Ambystoma, p. 20') + '<p>Escribe a la Dra. Ireri Suazo para más datos.</p>')).length) { console.error('✗ el mismo nombre fuera de la cita pasa'); process.exit(2); }
    if (!nombres(revisa(cita('SEMARNAT (2018), PACE Ambystoma'))).length) { console.error('✗ una cita sin página pasa'); process.exit(2); }
    if (!revisa(cita('SEMARNAT (2018), PACE Ambystoma, p. 20').replace('ejemplares.', 'ejemplares; escribe a ireri@ejemplo.com.')).some((p) => p.includes('correo'))) { console.error('✗ un correo junto a un nombre citado pasa'); process.exit(2); }
    rmSync(join(t, 'dist'), { recursive: true, force: true });
    // Las citas autor-año (revisión de IP, 22-oct): pasan sólo con el año pegado al nombre; un nombre con título, uno sin año y un dato
    // de contacto junto a la cita siguen en rojo.
    const dz = join(t, 'src', 'data'); mkdirSync(dz, { recursive: true });
    const enDatos = (frase) => { writeFileSync(join(dz, 'x.json'), JSON.stringify({ texto: frase })); return recorrer([join(t, 'src')], { datos: () => true }).problemas; };
    const forma = (ps) => ps.filter((p) => p.includes('nombre propio por su forma'));
    if (forma(enDatos('los ejemplares fueron revisados por Ramírez-Bautista y colaboradores (2009), quienes encontraron')).length) { console.error('✗ una cita autor-año se marca'); process.exit(2); }
    if (forma(enDatos('como notan (Taylor et al., 1940) y Medina-Aguilar y Suazo-Ortuño (2011)')).length) { console.error('✗ una cita autor-año entre paréntesis se marca'); process.exit(2); }
    if (!forma(enDatos('los ejemplares fueron revisados por Ramírez-Bautista y colaboradores')).length) { console.error('✗ un nombre sin año pasa como cita'); process.exit(2); }
    if (!forma(enDatos('el ejemplar fue revisado por la Dra. Ramírez (2009)')).length) { console.error('✗ un nombre con título pasa como cita'); process.exit(2); }
    if (!enDatos('revisados por Ramírez-Bautista y colaboradores (2009), ramirez@ejemplo.com').some((p) => p.includes('correo'))) { console.error('✗ un correo junto a una cita autor-año pasa'); process.exit(2); }
    rmSync(join(t, 'src'), { recursive: true, force: true });
    // Una carpeta dada por la línea de comandos también busca nombres (no sólo patrones).
    const cli = revisarCarpetas([limpia], huellas);
    if (!cli.problemas.some((p) => p.includes('nombres de personal'))) { console.error('✗ una carpeta dada en la línea de comandos no busca nombres'); process.exit(2); }
    // El embargo se aplica en todos los contextos: un nombre cuyo digest está en la lista de embargo, en un texto o en el nombre de un archivo, es rojo.
    const sonda = new Set([embargoDigest('Zzfixtura')]);
    const emb = join(t, 'embargo'); mkdirSync(join(emb, 'photos'), { recursive: true });
    writeFileSync(join(emb, 'photos', 'zzfixtura.webp'), 'x'); writeFileSync(join(emb, 'pulso.yaml'), 'es: "junto a Zzfixtura y Chocorrol"'); writeFileSync(join(emb, 'limpio.yaml'), 'es: "Chocorrol y Panchita"');
    if (JSON.stringify(scanTree(emb, sonda).sort()) !== JSON.stringify([join('photos', 'zzfixtura.webp'), 'pulso.yaml'])) { console.error('✗ el embargo no encuentra un nombre en un archivo y en una ruta, o marca un texto limpio'); process.exit(2); }
    const noticias = join(t, 'news'); mkdirSync(noticias);
    writeFileSync(join(noticias, 'pulso.yaml'), 'es: "Zoe y Mia conversan; Beto limpia los tanques"');
    if (!recorrer([noticias], { editorial: { huellas, permitidas, zona: () => true } }).problemas.some((p) => p.includes('texto editorial'))) { console.error('✗ alguien de la lista en un pie editorial no se detecta'); process.exit(2); }
    writeFileSync(join(noticias, 'pulso.yaml'), 'es: "Zoe y Mia conversan; el equipo limpia los tanques"');
    if (recorrer([noticias], { editorial: { huellas, permitidas, zona: () => true } }).problemas.length) { console.error('✗ un host y quien dio su consentimiento no pueden salir en un pie editorial'); process.exit(2); }
    const nota = join(t, 'datos'); mkdirSync(join(nota, 'public', 'data'), { recursive: true });
    writeFileSync(join(nota, 'public', 'data', 'bitacora.json'), JSON.stringify([{ notas: 'Cambio de agua completo. Rosalinda' }]));
    if (!recorrer([nota], { datos: () => true }).problemas.some((p) => p.includes('firmada'))) { console.error('✗ una nota firmada en un JSON de datos no se detecta'); process.exit(2); }
  } finally {
    rmSync(t, { recursive: true, force: true });
  }
} finally {
  if (claveReal === undefined) delete process.env.AXOLODAO_PERSONAS_CLAVE; else process.env.AXOLODAO_PERSONAS_CLAVE = claveReal;
}
console.log('  ✓ los nombres se buscan por huella (HMAC), por rol en el texto editorial, detrás de una entidad HTML y en las carpetas de la línea de comandos; sin la clave la prueba falla; un dist vacío o inexistente es rojo');

// ---- El recorrido real ----------------------------------------------------------------------------------------------------------------
function cargarPersonas() {
  const huellas = cargarHuellasDePersonas();
  return huellas;
}
/** Una carpeta cualquiera (línea de comandos): patrones y nombres de la lista, en todo el texto. */
function revisarCarpetas(raices, huellas) {
  return recorrer(raices, { minimo: 1, datos: () => true, personas: { huellas, permitidas: () => new Set(), zona: () => true } });
}

const argumentos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let huellas;
try {
  if (!claveReal) throw new Error('falta AXOLODAO_PERSONAS_CLAVE');
  huellas = cargarPersonas();
} catch (e) {
  console.error(`✗ ${e.message}: sin la clave de las huellas la prueba de nombres no puede correr, y falla hacia lo cerrado (variable local o secreto de GitHub Actions AXOLODAO_PERSONAS_CLAVE)`);
  process.exit(1);
}
if (!huellas?.roles) { console.error('✗ falta src/data/personas-huellas.json con sus huellas y roles, o su huella no coincide: falla hacia lo cerrado (node scripts/limpiar-datos-publicos.mjs)'); process.exit(1); }
// La clave real tiene que ser la de esas huellas: una clave distinta no las compara y todo pasaría.
{
  const centinela = JSON.parse(readFileSync(join(SITE, 'src/data/personas-huellas.json'), 'utf8')).centinela;
  if (!centinela || huellaDe('centinela') !== centinela) { console.error('✗ la clave AXOLODAO_PERSONAS_CLAVE no es la de las huellas de src/data/personas-huellas.json (centinela distinto): con otra clave ninguna ficha coincidiría y todo pasaría'); process.exit(1); }
}
if (argumentos.length) {
  const { revisados, problemas } = revisarCarpetas(argumentos.map((a) => resolve(a)), huellas);
  if (problemas.length) {
    console.error(`\n✗ ${problemas.length} problema(s):`);
    for (const x of [...new Set(problemas)].slice(0, 40)) console.error(`  - ${x}`);
    process.exit(1);
  }
  console.log(`  ✓ ${revisados} archivos de ${argumentos.join(' y ')} sin datos de personas, nombres de la lista, notas sin cobertura, lógica patentable ni casos de laboratorio\n\nnada de eso en lo revisado`);
  process.exit(0);
}

const permitidosF = join(SITE, 'src/data/nombres-permitidos.json');
const permitidos = existsSync(permitidosF) ? JSON.parse(readFileSync(permitidosF, 'utf8')).prefijos ?? {} : {};
// Los hosts y quien dio su consentimiento pueden salir sólo en lo editorial (el podcast, los pies del Pulso, las páginas); en un registro, un host
// que actúa como personal es «el equipo». El resto de la lista no sale en ningún lado.
const permitidas = (f) => {
  const rel = relative(SITE, f);
  if (zonaDeRegistros(f) && !zonaEditorial(f)) return new Set();
  return new Set([...huellas.roles.host, ...huellas.roles.consentimiento, ...Object.entries(permitidos).filter(([prefijo]) => rel.startsWith(prefijo)).flatMap(([, hs]) => hs)]);
};
// Los archivos que definen los patrones o las listas no se leen como contenido.
const DEFINEN = new Set(['scripts/test-no-personal-data.mjs', 'scripts/test-agua-rangos.mjs', 'scripts/lib/limpiar-personas.mjs', 'src/data/personas-huellas.json', 'src/data/nombres-permitidos.json']);
const rel = (f) => relative(SITE, f);
// Los registros (bitácora, historial, mediciones y las páginas del museo que los dibujan) buscan una ficha de la lista en cualquier forma; todo lo
// demás (código, textos, páginas, documentos) la busca como nombre propio. Los hosts y quien dio su consentimiento pueden salir en lo editorial.
const zonaDeRegistros = (f) => { const r = rel(f); return r.startsWith('public/data/') || r.startsWith('src/data/') || /^dist\/(?:(?:en|pt)\/)?xolotlcalli\//.test(r) || r.startsWith('dist/data/'); };
const esDato = (f) => { const r = rel(f); if (/\.m?js$/.test(r)) return false; return r.startsWith('dist/') || r.startsWith('public/data/') || r.startsWith('src/data/') || r.startsWith('src/content/') || r.startsWith('../Docs/'); };
const zonaEditorial = (f) => { const r = rel(f); return r.startsWith('src/content/news/') || r.startsWith('src/content/projects/') || r === 'src/data/podcast-episodes.json'; };

const fallos = [];
let total = 0;
for (const [nombre, minimo, exigir] of [['dist', 10, ['index.html', 'xolotlcalli/ajolotes/index.html', 'especies/index.html']], ['public', 5, []], ['src', 20, []], ['scripts', 5, []]]) {
  const { revisados, problemas } = recorrer([join(SITE, nombre)], {
    minimo, exigir, datos: esDato,
    personas: { huellas, permitidas, zona: () => true, estricto: (f) => !zonaDeRegistros(f) },
    editorial: { huellas, permitidas: new Set([...huellas.roles.host, ...huellas.roles.consentimiento]), zona: zonaEditorial },
    excluir: (f) => DEFINEN.has(rel(f)),
  });
  total += revisados;
  fallos.push(...problemas);
}
{
  const docs = resolve(SITE, '..', 'Docs');
  const { revisados, problemas } = recorrer([docs], { minimo: 5, datos: () => false, personas: { huellas, permitidas, zona: () => true, estricto: () => true } });
  total += revisados;
  fallos.push(...problemas);
}
for (const [nombre, raiz] of [['dist', join(SITE, 'dist')], ['public', join(SITE, 'public')], ['src', join(SITE, 'src')], ['scripts', join(SITE, 'scripts')], ['Docs', resolve(SITE, '..', 'Docs')]]) {
  for (const hit of scanTree(raiz, EMBARGO_SHA256)) fallos.push(`${join(raiz, hit)}: un nombre de la lista de embargo (por digest, en su texto o en el nombre del archivo); se muestra sólo la ruta`);
}
for (const r of ['../README.md', 'README.md', '../CLAUDE.md']) {
  const f = join(SITE, r);
  if (existsSync(f)) { total++; for (const razon of problemasDeTexto(readFileSync(f, 'utf8'))) fallos.push(`${f}: ${razon}`); }
}

if (fallos.length) {
  console.error(`\n✗ ${fallos.length} problema(s):`);
  for (const x of [...new Set(fallos)].slice(0, 60)) console.error(`  - ${relative(SITE, x.split(': ')[0])}: ${x.split(': ').slice(1).join(': ')}`);
  process.exit(1);
}
console.log(`  ✓ ${total} archivos de dist, public, src, scripts, Docs y README: sin datos de personas, sin nombres de la lista (por huella y por rol), sin notas sin cobertura, sin lógica patentable, sin casos ni nombres de laboratorio, sin marcas de embargo ni juicios sobre una persona o un rol; la salud pasa\n\nnada de datos personales ni de lo reservado en el sitio`);
