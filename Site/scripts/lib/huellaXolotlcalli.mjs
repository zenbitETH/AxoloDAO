// The Xolotlcalli registry fingerprint page (/xolotlcalli/datos/huella/): the files scripts/xolotlcalli-registro.mjs derives, served one by one
// from public/, with the same intro rules as the atlas page (lib/huella.mjs): where the fingerprint is registered and by whom, what is onchain
// and what is not, the verification sentence verbatim, and a licence on every file. Plain HTML, no script.
// The attestation (src/data/atestacion-xolotlcalli.json) exists only once it is signed; without it the page claims nothing is registered.
import { createHash } from 'node:crypto';
import { NOMBRE_SITIO, CONFIRMACIONES } from './huella.mjs';
import { firmaVigente } from '../../src/lib/firmasRetiradas.mjs';

const re40 = (x) => /^0x[0-9a-fA-F]{40}$/.test(x ?? '');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const BASE = '/xolotlcalli/datos/huella/';
export const FRASE = 'La verificación comprueba que los archivos no cambiaron desde que se registró su huella; no certifica que sus fuentes sean exactas.';
// what this fingerprint leaves out (the IP review's wording); dropping the line is setting this to false
export const MOSTRAR_LIMITES = true;
// the key the anchors must be signed by: the address attester.axolodao.eth resolves to (bunker migration plan, «Data signing»). None exists yet,
// so no anchors file is accepted; the anchors of 22-23 Oct were signed by a key that is now retired (src/lib/firmasRetiradas.mjs).
export const ATESTADOR_DATOS = null;
export const LIMITES = 'Quedan fuera de esta huella el peso, las medidas, las causas de baja, los tratamientos y la alimentación de los ejemplares.';
// the weekly anchors' line, approved for exactly this range (the IP review's wording); a file with another range is refused, not reworded
const ANCLAS_APROBADAS = { cuenta: 48, primera: '2025-W44', ultima: '2026-W39' };
export const LINEA_ANCLAS = `las anclas semanales del registro de Xolotlcalli: ${ANCLAS_APROBADAS.cuenta} semanas, de ${ANCLAS_APROBADAS.primera} a ${ANCLAS_APROBADAS.ultima}, reproducidas en octubre de 2026 desde el registro histórico`;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** A unix time (seconds) as the page writes a date: «22-oct-2026», in Mexico City time (the museum's). */
export function fechaCorta(segundos) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(segundos * 1000)).map((x) => [x.type, x.value]));
  return `${Number(p.day)}-${MESES[Number(p.month) - 1]}-${p.year}`;
}

/** What a confirmed-anchors file must hold before the page names the anchors: the data attester (ATESTADOR_DATOS), never a retired key (src/lib/firmasRetiradas.mjs), 3 txs with their blocks, 48 distinct weeks with distinct uids, and the approved range. */
export function problemasDeLasAnclas(an, { atestador = ATESTADOR_DATOS } = {}) {
  if (!an) return [];
  const mal = [];
  const hex = (x, n) => new RegExp(`^0x[0-9a-f]{${n}}$`).test(x ?? '');
  if (!atestador || String(an.atestador ?? '').toLowerCase() !== String(atestador).toLowerCase()) mal.push('the anchors are not signed by the data attester');
  if (!firmaVigente(an.atestador)) mal.push('the anchors are not signed by a current key');
  if (!Array.isArray(an.txs) || an.txs.length !== 3 || !an.txs.every((t) => hex(t, 64))) mal.push('the anchors do not name their 3 transactions');
  if (!Array.isArray(an.bloques) || an.bloques.length !== 3 || !an.bloques.every((b) => Number.isInteger(b) && b > 0)) mal.push('the anchors do not name a block per transaction');
  const anclas = Array.isArray(an.anclas) ? an.anclas : [];
  const semanas = anclas.map((a) => a.semana).filter((w) => /^\d{4}-W\d{2}$/.test(w ?? ''));
  if (anclas.length !== ANCLAS_APROBADAS.cuenta || new Set(semanas).size !== ANCLAS_APROBADAS.cuenta || an.cuenta !== ANCLAS_APROBADAS.cuenta) mal.push(`the anchors are not ${ANCLAS_APROBADAS.cuenta} distinct weeks`);
  if (!anclas.every((a) => hex(a.uid, 64)) || new Set(anclas.map((a) => a.uid)).size !== anclas.length) mal.push('the anchors do not carry one distinct uid each');
  const orden = [...semanas].sort();
  if (an.primera !== orden[0] || an.ultima !== orden[orden.length - 1]) mal.push('the first and last weeks are not the range of the anchors');
  if (an.primera !== ANCLAS_APROBADAS.primera || an.ultima !== ANCLAS_APROBADAS.ultima) mal.push('the anchors cover another range than the approved line names');
  return mal;
}

/** What an attestation must say for this listing before the page names it: Sepolia, a UID, a tx, a block, its attester, and the listing's own sha256. */
export function problemasDeLaAtestacion(at, bytesListado) {
  if (!at) return [];
  const mal = [];
  if (at.red !== 'sepolia') mal.push('the attestation is not on Sepolia');
  for (const [k, re] of [['uid', /^0x[0-9a-f]{64}$/], ['tx', /^0x[0-9a-f]{64}$/], ['atestador', /^0x[0-9a-fA-F]{40}$/]]) if (!re.test(at[k] ?? '')) mal.push(`the attestation has no valid ${k}`);
  if (re40(at.atestador) && !firmaVigente(at.atestador)) mal.push('the attestation is not signed by a current key');
  if (!Number.isInteger(at.retrievedAt) || at.retrievedAt <= 0) mal.push('the attestation has no retrievedAt (the compilation date)');
  if (!Number.isInteger(at.bloque) || at.bloque <= 0) mal.push('the attestation has no block');
  if (at.contentSha256 !== `0x${createHash('sha256').update(bytesListado).digest('hex')}`) mal.push('the attestation fingerprints another listing');
  return mal;
}

/** The page for a listing (lib/huella.mjs leerListado), its attestation or null, the inventory's count of clip confirmations, and the confirmed weekly anchors or null.
 *  `porVolverAFirmar`: the fingerprint and the anchors were signed by a key that is now retired, so the page says they wait to be signed again. */
export function paginaXolotlcalli(listado, atestacion, { confirmaciones, sha256Listado, anclas = null, porVolverAFirmar = false }) {
  if (!(Number.isInteger(confirmaciones) && confirmaciones >= 1)) throw new Error('the Xolotlcalli fingerprint page needs the inventory\'s count of clip confirmations (an integer ≥ 1)');
  const at = atestacion;
  const firmado = Boolean(at);
  const enCadena = [
    ...(firmado ? ['la huella de estos archivos'] : []),
    ...(anclas ? [LINEA_ANCLAS] : []),
    'la huella de los datos del atlas',
    confirmaciones === 1 ? CONFIRMACIONES.uno : CONFIRMACIONES.varias,
    'la tesorería',
    'los nombres ENS (axolodao.eth)',
  ];
  const listados = new Set(listado.archivos.map((a) => a.ruta));
  const filas = (b) => listado.archivos.filter((a) => a.ruta.startsWith(`${b.id}/`)).map((a) => {
    const licencia = listados.has(`${b.id}/licences.jsonl`) ? ` · <a href="${esc(`${BASE}${b.id}/licences.jsonl`)}" data-licencia="paquete">licencias del paquete</a>` : '';
    return `<li><a href="${esc(BASE + a.ruta)}">${esc(a.ruta.slice(b.id.length + 1))}</a> <code>${a.sha256}</code>${licencia}</li>`;
  }).join('\n');
  const intro = `<section data-huella-intro>
${firmado
    ? `<p data-huella-red>Huella registrada en Ethereum, red de prueba Sepolia.</p>
<p style="overflow-wrap: anywhere">Atestación <a href="https://sepolia.easscan.org/attestation/view/${esc(at.uid)}" rel="noopener noreferrer">${esc(at.uid)}</a>, en la transacción <a href="https://sepolia.etherscan.io/tx/${esc(at.tx)}" rel="noopener noreferrer">${esc(at.tx)}</a> (bloque ${esc(at.bloque)}).</p>
<p data-huella-compilacion>Fecha de compilación: ${fechaCorta(at.retrievedAt)}</p>
<p style="overflow-wrap: anywhere" data-huella-atestador>Firma: ${at.atestadorNombre ? `${esc(at.atestadorNombre)}, ` : ''}<a href="https://sepolia.etherscan.io/address/${esc(at.atestador)}" rel="noopener noreferrer">${esc(at.atestador)}</a>.</p>`
    : porVolverAFirmar
      ? '<p data-huella-pendiente>La huella de estos archivos y las anclas del registro están pendientes de volver a firmarse en cadena.</p>'
      : '<p data-huella-pendiente>La huella de estos archivos todavía no está registrada en cadena.</p>'}
<h2>Qué está onchain</h2>
<ul data-huella-onchain>
${enCadena.map((t, i) => `<li>${esc(t)}${i === enCadena.length - 1 ? '.' : ';'}</li>`).join('\n')}
</ul>
<p>Más adelante: las métricas semanales.</p>
<h2>Qué queda fuera de la cadena</h2>
<ul data-huella-fuera>
<li>los registros mismos, que el sitio sirve archivo por archivo aquí abajo.</li>
</ul>
${MOSTRAR_LIMITES ? `<p data-huella-limites>${esc(LIMITES)}</p>\n` : ''}
<p data-huella-alcance>${esc(FRASE)}</p>
</section>`;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Huella de los registros del museo — ${NOMBRE_SITIO}</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 62rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5">
<h1>Huella de los registros del Museo de Ajolotes Xolotlcalli (2025–2026)</h1>
${intro}
<p>Cada archivo se sirve por separado, tal como está, para que cualquiera pueda recalcular su hash. <a href="${BASE}listado-stand.txt">listado-stand.txt</a> es el listado que ${firmado ? 'la atestación fija' : 'la atestación fijará'}. No hay archivo comprimido.</p>
<p>El hash del listado es <code>${esc(sha256Listado)}</code>.</p>
${listado.bundles.map((b) => `<h2>${esc(b.id)}</h2>\n<ul>\n${filas(b)}\n</ul>`).join('\n')}
</body></html>
`;
}
