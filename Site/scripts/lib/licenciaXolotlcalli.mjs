// The text of LicenseRef-registros-piloto-xolotlcalli (/xolotlcalli/datos/licencia/): variant B′, non-commercial (the founder, 17-nov-2026), in
// maggia's corrected wording (review of 17-nov-2026), verbatim. It lives outside every attested listing, so publishing or versioning it changes
// no fingerprint. The build refuses to write it while its publication date or its contact mailbox are missing: a licence page with a
// placeholder never ships. Plain HTML, no script.
import { NOMBRE_SITIO } from './huella.mjs';
import { barra, cabeza } from './huellaEstilo.mjs';

export const RUTA = '/xolotlcalli/datos/licencia/';
export const ID = 'LicenseRef-registros-piloto-xolotlcalli';
// filled when the page goes out: the publication day (AAAA-MM-DD) and a Zenbit mailbox, never a person's
export const PUBLICADA = '2026-11-17';
export const CONTACTO = 'hola@zenbit.mx';
export const BUNDLES = { xolotlcalli: '7757599-xolotlcalli', equipo: '617efe2-xolotlcalli-equipo' };

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** What keeps the page from shipping. */
export function problemasDeLaLicencia({ publicada = PUBLICADA, contacto = CONTACTO } = {}) {
  const mal = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publicada ?? '')) mal.push('the licence has no publication date');
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(contacto ?? '')) mal.push('the licence has no contact mailbox');
  return mal;
}

export function paginaLicencia({ publicada = PUBLICADA, contacto = CONTACTO } = {}) {
  const mal = problemasDeLaLicencia({ publicada, contacto });
  if (mal.length) throw new Error(`the licence page cannot ship: ${mal.join('; ')}`);
  return `<!doctype html>
<html lang="es"><head>${cabeza(`Licencia de los registros piloto de Xolotlcalli — ${NOMBRE_SITIO}`)}</head>
<body><main class="hoja">
${barra}
<header class="portada">
<h1>Licencia de los registros piloto de Xolotlcalli</h1>
<p>Identificador: <code>${ID}</code> · versión 1 · publicada el <time datetime="${esc(publicada)}">${esc(publicada)}</time></p>
<p>Otorga: Zenbit S.A.S. de C.V.</p>
</header>
<section data-licencia-texto>
<h2>1. Qué cubre</h2>
<p>Esta licencia se aplica a los archivos enumerados en el listado de cada una de estas huellas, que Zenbit publica en <code>axolodao.org/xolotlcalli/datos/</code>:</p>
<ul>
<li>la huella <a href="/xolotlcalli/datos/huella/"><code>${BUNDLES.xolotlcalli}</code></a>: ejemplares, agua semanal, estanques, parámetros y cierre;</li>
<li>la huella <a href="/xolotlcalli/datos/huella-equipo/"><code>${BUNDLES.equipo}</code></a>: una copia congelada de la bitácora del museo tal como axolodao.org la publicó hasta el 7 de noviembre de 2026, sin nombres de personas ni enlaces a documentos, y las respuestas del equipo en su chat.</li>
</ul>
<p>Los registros los produjo el equipo del Museo de Ajolotes Xolotlcalli durante su operación, de 2025 a 2026. Cada huella describe en su página qué contiene, qué deja fuera y cómo se asignaron los eventos. Esos límites forman parte de lo que se publica.</p>
<h2>2. Qué puedes hacer</h2>
<p>Con las condiciones de la cláusula 3, puedes:</p>
<ol>
<li>leer, descargar y verificar los archivos contra su huella;</li>
<li>copiarlos y redistribuirlos, completos o en parte;</li>
<li>adaptarlos, combinarlos con otros datos y publicar tus análisis;</li>
<li>hacer todo lo anterior sólo con fines no comerciales. Un uso es comercial cuando busca principalmente una ventaja comercial o una compensación económica. Investigar, enseñar, divulgar y publicar análisis no son, por sí mismos, usos comerciales. Esta licencia no autoriza ningún uso comercial.</li>
</ol>
<h2>3. Qué pides a cambio</h2>
<ul>
<li><strong>Cita la fuente</strong> así, o de una forma equivalente:
<blockquote>Registros piloto de Xolotlcalli, Zenbit, axolodao.org/xolotlcalli/datos/ (huella <code>&lt;bundle&gt;</code>), con licencia <code>${ID}</code>, consultados el <code>&lt;fecha&gt;</code>.</blockquote></li>
<li><strong>Si cambiaste los datos, dilo.</strong></li>
<li><strong>Si redistribuyes los archivos,</strong> incluye esta licencia o su dirección, y no les pongas otra.</li>
<li><strong>No sugieras</strong> que Zenbit, AxoloDAO o el museo respaldan tu trabajo.</li>
<li><strong>No uses los archivos para identificar a las personas del equipo,</strong> cuyos nombres se omitieron, ni para contactarlas.</li>
<li><strong>No uses los nombres de los ejemplares</strong> como marca, nombre de producto o para promocionar bienes o servicios.</li>
</ul>
<h2>4. Qué no otorga</h2>
<ul>
<li>Derechos sobre las marcas, nombres comerciales y logotipos ZENBIT, AXOLODAO, XOVI y XOLOTLCALLI, ni sobre otros signos distintivos, cualquiera que sea su titular. Citar la fuente como pide la cláusula 3 no es una licencia de marca.</li>
<li>Derechos sobre patentes o solicitudes de patente, ni sobre el software, los métodos o los sistemas con que se produjeron, procesaron o verificaron los datos.</li>
<li>Derechos sobre fotografías, videos ni ningún otro archivo que no esté en el listado de una huella cubierta, aunque los archivos de datos lo mencionen.</li>
<li>Derechos que no sean de Zenbit. Zenbit otorga esta licencia en la medida de los derechos que tiene sobre los archivos y no garantiza que terceros no tengan otros.</li>
</ul>
<h2>5. Sin garantía</h2>
<p>Los datos se publican tal como están. Una huella comprueba que los archivos no cambiaron desde que se registró; no certifica que sus fuentes sean exactas ni completas. Los registros de salud no son un diagnóstico veterinario ni describen el estado actual de ningún ejemplar. En la medida en que la ley lo permite, Zenbit no responde por decisiones tomadas con estos datos.</p>
<h2>6. Versiones y terminación</h2>
<ul>
<li>Zenbit puede publicar versiones nuevas de esta licencia en esta misma página. Las anteriores se conservan aquí, con su fecha.</li>
<li>Un archivo que obtuviste bajo una versión puede seguir usándose bajo esa versión.</li>
<li>Esta versión se aplica también a las copias obtenidas antes de su publicación.</li>
<li>Si no cumples la cláusula 3, o usas los archivos con fines comerciales, el permiso termina para ti. Se restablece si corriges el incumplimiento dentro de los 30 días siguientes a saberlo.</li>
</ul>
<h2>7. Contacto</h2>
<p><a href="mailto:${esc(contacto)}">${esc(contacto)}</a></p>
<h2>8. Idioma y ley</h2>
<p>Este texto en español es el que rige. Cualquier traducción es sólo de referencia. Esta licencia se rige por las leyes de los Estados Unidos Mexicanos.</p>
</section>
</main></body></html>
`;
}
