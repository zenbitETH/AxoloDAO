// Reads each of the six atlas snapshot files from the hub (HUB_BUILD_URL, else PUBLIC_HUB_URL, plus HUB_KEY_FILE and HUB_KEY_HEADER for the booth key) exactly as a strict build does, and says per file: «hub» (it equals the committed file) or why not.
//   PUBLIC_HUB_URL=http://127.0.0.1:4480 node scripts/hub-paridad.mjs        exit 1 if any file is not «hub»
import { ARCHIVOS, archivosDelSitio, instantanea } from '../src/lib/atlasSnapshot.mjs';
import { conClave } from '../src/lib/hubClave.mjs';
import { hubDelBuild } from '../src/lib/atlasLectura.mjs';

const hubUrl = hubDelBuild(process.env.PUBLIC_HUB_URL);
if (!hubUrl) { console.error('set HUB_BUILD_URL (or PUBLIC_HUB_URL)'); process.exit(2); }
const sitio = archivosDelSitio(process.cwd());
const fetchFn = conClave(globalThis.fetch, { archivo: process.env.HUB_KEY_FILE, cabecera: process.env.HUB_KEY_HEADER, esquema: process.env.HUB_KEY_SCHEME, hubUrl });
let mal = 0;
for (const nombre of ARCHIVOS) {
  try { const d = await instantanea(nombre, { hubUrl, sitio, fetchFn, estricto: true }); console.log(`${d.fuente === 'hub' ? 'hub    ' : 'ARCHIVO'} ${nombre}`); if (d.fuentes && nombre === 'estados-metricas.json') for (const [id, f] of Object.entries(d.fuentes)) console.log(`          ${id}: ${f}`); if (d.fuente !== 'hub') mal++; }
  catch (e) { mal++; console.log(`FALLA   ${nombre}\n        ${e.message.slice(0, 700)}`); }
}
process.exit(mal ? 1 : 0);
