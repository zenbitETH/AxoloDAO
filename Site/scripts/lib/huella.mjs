// The atlas fingerprint served on the site: /atlas/datos/huella/. Contracts' listing («zenbit-listado-stand v1») names every file the Sepolia attestation fingerprints; each one is served ONE BY ONE, byte for byte,
// so anyone can recompute its hash. No archive and no bundle ever (the CC BY-NC layers are among the files, each with its licence beside its link); nothing that is not listed; no transform.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

/** The site name after a page title, as the layout appends it for the pages that opt in (src/layouts/BaseLayout.astro SITE_NAME; a test compares both). */
export const NOMBRE_SITIO = 'AxoloDAO';
const SHA = /^[0-9a-f]{64}$/;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
/** The listing: `{ bundles: [{ id, manifest }], archivos: [{ sha256, ruta }] }`, or throws on any line it does not understand. */
export function leerListado(texto) {
  const lineas = String(texto).split('\n'); if (lineas[lineas.length - 1] === '') lineas.pop();
  if (lineas[0] !== 'zenbit-listado-stand v1') throw new Error('the listing does not start with «zenbit-listado-stand v1»');
  const bundles = [], archivos = [];
  for (const l of lineas.slice(1)) {
    let m;
    if ((m = /^bundle (\S+) manifest 0x([0-9a-f]{64})$/.exec(l))) bundles.push({ id: m[1], manifest: m[2] });
    else if ((m = /^([0-9a-f]{64})  (\S+\/\S+)$/.exec(l)) && SHA.test(m[1]) && !m[2].includes('..') && !m[2].startsWith('/')) archivos.push({ sha256: m[1], ruta: m[2] });
    else throw new Error(`a listing line out of shape: ${l.slice(0, 60)}`);
  }
  if (!bundles.length || !archivos.length) throw new Error('the listing names no bundle or no file');
  for (const a of archivos) if (!bundles.some((b) => a.ruta.startsWith(`${b.id}/`))) throw new Error(`${a.ruta}: a listed file under no bundle (the index would never list it)`);
  for (const b of bundles) { const e = archivos.find((a) => a.ruta === `${b.id}/manifest.json`); if (!e || e.sha256 !== b.manifest) throw new Error(`${b.id}: its manifest line and its file line disagree`); }
  return { bundles, archivos };
}
const todos = (dir) => { const out = []; const anda = (d) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) anda(f); else out.push(relative(dir, f)); } }; if (existsSync(dir)) anda(dir); return out.sort(); };

/** The CC BY-NC layers of the layers bundle: which listed files they are, and the licence each carries (from the bundle's own layers.jsonl and licences.jsonl). */
export function archivosNc(entidades, listado) {
  const out = new Map();
  for (const b of listado.bundles) {
    const capas = join(entidades, b.id, 'layers.jsonl'), lic = join(entidades, b.id, 'licences.jsonl');
    if (!existsSync(capas) || !existsSync(lic)) continue;
    const licencias = new Map(readFileSync(lic, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((x) => [x.spdx, x]));
    for (const l of readFileSync(capas, 'utf8').split('\n').filter(Boolean).map((x) => JSON.parse(x))) {
      const li = licencias.get(l.licenceSpdx);
      if (li && li.commercialOk === false && l.geojsonPath) out.set(`${b.id}/${l.geojsonPath}`, { spdx: li.spdx, nombre: li.name, url: li.url ?? null });
    }
  }
  return out;
}

/** Copies every listed file from the entity folders into `salida`, byte for byte, after re-hashing it against the listing; writes the listing itself and the index page
 *  (`confirmaciones`: the inventory's count of clip confirmations, for the page's intro). Throws on any mismatch; returns the problems of what is served, the page's licences included. */
export function copiarHuella({ listadoRuta, entidades, salida, atestacion = null, confirmaciones = null }) {
  const bytesListado = readFileSync(listadoRuta);
  const listado = leerListado(bytesListado.toString('utf8'));
  for (const a of listado.archivos) {
    const origen = join(entidades, a.ruta);
    if (!existsSync(origen)) throw new Error(`${a.ruta}: not in ${entidades}`);
    const bytes = readFileSync(origen);
    if (sha(bytes) !== a.sha256) throw new Error(`${a.ruta}: its sha256 is not the listing's`);
    mkdirSync(dirname(join(salida, a.ruta)), { recursive: true });
    copyFileSync(origen, join(salida, a.ruta));
  }
  writeFileSync(join(salida, 'listado-stand.txt'), bytesListado);
  const nc = archivosNc(entidades, listado);
  const pagina = paginaIndice(listado, nc, atestacion, { confirmaciones });
  writeFileSync(join(salida, 'index.html'), pagina);
  return [...verificarHuella({ listadoRuta, salida, entidades }), ...archivosSinLicencia(pagina, listado).map((r) => `${r}: the index shows no licence for it`)];
}

/** Recomputes what is served: every listed file hashes to the listing and is served, nothing else is served but the listing and the index, and no archive is. Returns the problems (empty when it is exact). */
export function verificarHuella({ listadoRuta, salida }) {
  const mal = [];
  let listado; try { listado = leerListado(readFileSync(listadoRuta, 'utf8')); } catch (e) { return [e.message]; }
  const servidos = new Set(todos(salida));
  if (!servidos.has('listado-stand.txt') || !readFileSync(join(salida, 'listado-stand.txt')).equals(readFileSync(listadoRuta))) mal.push('listado-stand.txt is not the listing byte for byte');
  for (const a of listado.archivos) {
    if (!servidos.has(a.ruta)) { mal.push(`${a.ruta}: not served`); continue; }
    if (sha(readFileSync(join(salida, a.ruta))) !== a.sha256) mal.push(`${a.ruta}: served bytes are not the listed ones`);
  }
  const permitidos = new Set([...listado.archivos.map((a) => a.ruta), 'listado-stand.txt', 'index.html', 'build.json']);
  for (const s of servidos) if (!permitidos.has(s)) mal.push(`${s}: served but not listed`);
  for (const s of servidos) if (/\.(zip|tar|tgz|gz|7z|rar|bz2|xz)$/i.test(s)) mal.push(`${s}: an archive is never served`);
  return mal;
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// the clip confirmations, in the singular or the plural by the inventory's count: the same phrases as the hero's onchain line
// (src/i18n/strings.ts, es: hero.onchain.confirmaciones.uno / .varias)
export const CONFIRMACIONES = { uno: 'la confirmación de un clip de prueba', varias: 'las confirmaciones de clips' };
/** The page's intro (the 22-oct ruling): where the fingerprint is registered, with the attestation UID and its transaction and block; what is
 *  onchain and what stays off the chain; and what the verification proves and what it does not. Only for an attestation on Sepolia. */
const intro = (at, confirmaciones) => `<section data-huella-intro>
<p data-huella-red>Huella registrada en Ethereum, red de prueba Sepolia.</p>
<p style="overflow-wrap: anywhere">Atestación <a href="${esc(at.easscan)}" rel="noopener noreferrer">${esc(at.uid)}</a>, en la transacción <a href="https://sepolia.etherscan.io/tx/${esc(at.tx)}" rel="noopener noreferrer">${esc(at.tx)}</a> (bloque ${esc(at.bloque)}).</p>
<h2>Qué está onchain</h2>
<ul data-huella-onchain>
<li>la huella de los datos del atlas;</li>
<li>${confirmaciones === 1 ? CONFIRMACIONES.uno : CONFIRMACIONES.varias};</li>
<li>la tesorería;</li>
<li>los nombres ENS (axolodao.eth).</li>
</ul>
<p>Más adelante: las métricas semanales.</p>
<h2>Qué queda fuera de la cadena</h2>
<ul data-huella-fuera>
<li>los datos mismos, que el sitio lee del hub de Zenbit System y sirve archivo por archivo aquí abajo.</li>
</ul>
<p data-huella-alcance>La verificación comprueba que los archivos no cambiaron desde que se registró su huella; no certifica que sus fuentes sean exactas.</p>
</section>`;
/** The index page: plain HTML, no script. Each file is its own link with its sha256 and its licence: a CC BY-NC layer shows its licence on a line of its
 *  own («CC BY-NC 2.5 MX (no comercial)») and is never described as open data; every other file links to its bundle's licences.jsonl. */
export function paginaIndice(listado, nc, atestacion = null, { base = '/atlas/datos/huella/', confirmaciones = null } = {}) {
  const enSepolia = atestacion?.red === 'sepolia';
  if (enSepolia && !(Number.isInteger(confirmaciones) && confirmaciones >= 1)) throw new Error('the fingerprint page needs the inventory\'s count of clip confirmations (an integer ≥ 1) for its intro');
  const listados = new Set(listado.archivos.map((a) => a.ruta));
  const filas = (b) => listado.archivos.filter((a) => a.ruta.startsWith(`${b.id}/`)).map((a) => {
    const l = nc.get(a.ruta);
    const licencia = l ? `<br><span data-licencia="nc">Licencia: <a href="${esc(l.url ?? '#')}" rel="noopener noreferrer">${esc(l.nombre)}</a> (no comercial)</span>`
      : listados.has(`${b.id}/licences.jsonl`) ? ` · <a href="${esc(`${base}${b.id}/licences.jsonl`)}" data-licencia="paquete">licencias del paquete</a>` : '';
    return `<li><a href="${esc(base + a.ruta)}">${esc(a.ruta.slice(b.id.length + 1))}</a> <code>${a.sha256}</code>${licencia}</li>`;
  }).join('\n');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Huella de los datos del atlas — ${NOMBRE_SITIO}</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 62rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5">
<h1>Huella de los datos del atlas</h1>
${enSepolia ? `${intro(atestacion, confirmaciones)}\n` : ''}<p>Cada archivo del paquete se sirve por separado, tal como está, para que cualquiera pueda recalcular su hash. <a href="${esc(base)}listado-stand.txt">listado-stand.txt</a> es el listado que la atestación fija. No hay archivo comprimido.</p>
${atestacion ? `<p>El hash del listado es <code>${esc(atestacion.contentSha256)}</code>.</p>` : ''}
${listado.bundles.map((b) => `<h2>${esc(b.id)}</h2>\n<ul>\n${filas(b)}\n</ul>`).join('\n')}
</body></html>
`;
}

/** The listed files whose line on the index page shows no licence (neither its own nor a link to its bundle's licences.jsonl). */
export function archivosSinLicencia(html, listado) {
  return listado.archivos.map((a) => a.ruta).filter((r) => {
    const li = String(html).split('\n').find((l) => l.startsWith('<li>') && l.includes(`/${r}">`));
    return !li || !/data-licencia="(?:nc|paquete)"/.test(li);
  });
}

/** The build record written next to the files and kept in the job folder: which site commit, which bundles (id, manifest sha256, and the sha256 of the bundle's own «paquete.sha256.txt» when it is there), which listing, which attestation. No path of this machine. */
export function registroDeConstruccion({ commitSitio, arbolLimpio, prueba = false, listadoRuta, entidades, atestacion }) {
  const bytes = readFileSync(listadoRuta), listado = leerListado(bytes.toString('utf8'));
  const sha256Listado = `0x${sha(bytes)}`;
  if (atestacion && sha256Listado !== atestacion.contentSha256) throw new Error(`the listing (${sha256Listado}) is not the one the attestation fingerprints (${atestacion.contentSha256})`);
  const bundles = listado.bundles.map((b) => {
    const prefijo = b.id.split('-')[0], paquete = join(entidades, `${prefijo}-paquete.sha256.txt`);
    return { id: b.id, manifestSha256: `0x${b.manifest}`, ...(existsSync(paquete) ? { paqueteSha256: `0x${sha(readFileSync(paquete))}` } : {}) };
  });
  return { ...(prueba ? { prueba: true } : {}), sitio: { commit: commitSitio, arbolLimpio }, listado: { sha256: sha256Listado, archivos: listado.archivos.length }, bundles, atestacion: atestacion ? { contentSha256: atestacion.contentSha256, uid: atestacion.uid, tx: atestacion.tx, bloque: atestacion.bloque, red: atestacion.red } : null };
}
