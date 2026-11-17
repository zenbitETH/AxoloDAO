// The Equipo fingerprint page (/xolotlcalli/datos/huella-equipo/): the files Xovi /datos reads for its Equipo line (the museum's log as the
// site published it until 7-nov-2026, and the team's answers in its chat), served one by one from public/ with their listing. Same intro
// rules as the Xolotlcalli page (lib/huellaXolotlcalli.mjs): where the fingerprint is registered and by whom, what is onchain and what is
// not, the verification sentence verbatim, and a licence on every file. Its four lines are maggia's (17-nov-2026, QA1), verbatim; the
// first fingerprint's LIMITES sentence is never shown here. Plain HTML, no script.
// The attestation (src/data/atestacion-xolotlcalli-equipo.json) exists only once it is signed; without it the page claims nothing is registered.
import { NOMBRE_SITIO } from './huella.mjs';
import { barra, cabeza, cadena, comparacion, glifo } from './huellaEstilo.mjs';
import { comoComprobarlo } from './huella.mjs';
import { FRASE, fechaCorta } from './huellaXolotlcalli.mjs';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const BASE = '/xolotlcalli/datos/huella-equipo/';
export const TITULO = 'Huella de la bitácora del equipo del museo';
export const H1 = 'Huella de la bitácora del equipo del Museo de Ajolotes Xolotlcalli (2025–2026)';
// maggia, 17-nov-2026 (QA1): what it covers, what it leaves out, how events are placed, and what it is
export const CUBRE = 'Esta huella cubre la bitácora del museo tal como axolodao.org la publicó hasta el 7-nov-2026, sin enlaces a documentos, y las respuestas del equipo en su chat. Es texto libre del equipo: trae observaciones de salud, tratamientos, alimentación y bajas de ejemplares.';
export const FUERA = 'Quedan fuera de esta huella el peso y las medidas de los ejemplares, los nombres de las personas del equipo y los enlaces a reportes.';
export const REPARTO = 'Un evento que no nombra a un ajolote se muestra con los ajolotes que vivían en esa pecera esa semana. Es una asignación por pecera, no una observación de ese ejemplar.';
export const NATURALEZA = 'Es una copia congelada: no se actualiza y no es un registro capturado en Zenbit System.';

/** The page for a listing (lib/huella.mjs leerListado) and its attestation or null. */
export function paginaEquipo(listado, atestacion, { sha256Listado }) {
  const at = atestacion;
  const firmado = Boolean(at);
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
    : '<p data-huella-pendiente>La huella de estos archivos todavía no está registrada en cadena.</p>'}
<div class="lados">
<div class="lado">
<h2>Qué está onchain</h2>
<ul data-huella-onchain>
${firmado ? '<li>la huella de estos archivos.</li>' : '<li>nada de esta página, todavía.</li>'}
</ul>
</div>
<div class="lado fuera">
<h2>Qué queda fuera de la cadena</h2>
<ul data-huella-fuera>
<li>los archivos mismos, que el sitio sirve uno por uno aquí abajo.</li>
</ul>
</div>
</div>
<p data-huella-cubre>${esc(CUBRE)}</p>
<p data-huella-limites>${esc(FUERA)}</p>
<p data-huella-reparto>${esc(REPARTO)}</p>
<p data-huella-naturaleza>${esc(NATURALEZA)}</p>
<p data-huella-alcance>${esc(FRASE)}</p>
<p data-huella-licencia>Licencia de estos archivos: <a href="/xolotlcalli/datos/licencia/">LicenseRef-registros-piloto-xolotlcalli</a>, sólo con fines no comerciales.</p>
</section>`;
  const pasos = [
    { icono: 'registro', titulo: 'Bitácora publicada', texto: 'La bitácora y el chat del equipo, tal como el sitio los publicó.' },
    { icono: 'build', titulo: 'Copia congelada', texto: 'Xovi los copia en dos archivos, con los mismos bytes cada vez.' },
    { icono: 'archivos', titulo: 'Archivos', texto: 'El sitio los publica archivo por archivo.' },
    { icono: 'listado', titulo: 'Listado', texto: 'El hash de cada archivo va a un listado.' },
    { icono: 'huella', titulo: 'Huella', texto: 'El hash del listado es la huella.' },
    firmado ? { icono: 'sepolia', titulo: 'EAS en Sepolia', texto: 'La huella queda atestada con EAS en Ethereum, red de prueba Sepolia.' }
      : { icono: 'sepolia', titulo: 'Sin registrar', texto: 'La huella todavía no está registrada en cadena.', pendiente: true },
    { icono: 'coincide', titulo: 'Coincide', texto: 'Y el sitio la compara con los archivos que sirve.', pendiente: !firmado },
  ];
  return `<!doctype html>
<html lang="es"><head>${cabeza(`${TITULO} — ${NOMBRE_SITIO}`)}</head>
<body><main class="hoja">
${barra}
<header class="portada">
<h1>${esc(H1)}</h1>
<figure class="figura">${glifo(sha256Listado, { etiqueta: `Figura de la huella ${sha256Listado}` })}<figcaption>Dibujada con los dígitos de la huella.</figcaption></figure>
</header>
<div class="intro${firmado ? '' : ' espera'}">
${intro}
</div>
<h2>Cómo se verifica</h2>
${cadena(pasos, { hash: sha256Listado })}
${firmado ? `${comparacion({ calculada: sha256Listado, atestada: at.contentSha256 })}\n${comoComprobarlo(BASE, `https://sepolia.easscan.org/attestation/view/${at.uid}`)}\n` : ''}<section class="archivos">
<p>Cada archivo se sirve por separado, tal como está, para que cualquiera pueda recalcular su hash. <a href="${BASE}listado-stand.txt">listado-stand.txt</a> es el listado que ${firmado ? 'la atestación fija' : 'la atestación fijará'}. No hay archivo comprimido.</p>
<p>El hash del listado es <code>${esc(sha256Listado)}</code>.</p>
${listado.bundles.map((b) => `<h2>${esc(b.id)}</h2>\n<ul>\n${filas(b)}\n</ul>`).join('\n')}
</section>
</main></body></html>
`;
}
