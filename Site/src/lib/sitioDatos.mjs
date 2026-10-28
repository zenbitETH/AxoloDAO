// What the axolodao.org build serves of the pilot's data, and the checks that decide it. Pure, so scripts/build-sitio.mjs and scripts/test-ficha-org.mjs read the same rules.
import { filasAceptadasPublicas, filasDelStand } from './fichaOrg.mjs';
import { nombreVigente } from './firmasRetiradas.mjs';

const CLAVES_CLIP = ['semana', 'semanaDe', 'especie', 'sistema', 'estado', 'autor', 'poster', 'url'];
/** The clips snapshot as the page reads it: every signed clip, with no field beyond those the card draws, an author as a short address or an ENS name, a link on https. */
export function clipsDelSitio(clips) {
  if (!clips || !Array.isArray(clips.clips)) return { ok: false, motivo: 'no clips list' };
  for (const c of clips.clips) {
    if (Object.keys(c).some((k) => !CLAVES_CLIP.includes(k))) return { ok: false, motivo: `a clip carries a field beyond ${CLAVES_CLIP.join(', ')}` };
    if (!/^https:\/\//.test(String(c.url)) || !/^(0x[0-9a-fA-F]{4}…[0-9a-fA-F]{3,4}|[\w-]+(\.[\w-]+)*\.eth)$/.test(String(c.autor))) return { ok: false, motivo: 'a clip has no https link or an author that is not a short address or an ENS name' };
  }
  return { ok: true, clips };
}
/** The three files of the build: `{ ficha, clips, cadena }` in, `{ clips, cadena, problemas }` out. The chain file goes through the stand's guards and must keep its treasury row;
 *  an ENS row whose name is retired (lib/firmasRetiradas.mjs) is dropped, not refused. */
export function datosDelSitioValidos({ ficha, clips, cadena }) {
  const problemas = [];
  if (!ficha?.resumen) problemas.push('the ficha has no resumen');
  const c = clipsDelSitio(clips); if (!c.ok) problemas.push(c.motivo);
  const stand = cadena ? filasDelStand(filasAceptadasPublicas(cadena)) : { filas: [], rechazadas: ['cadena'] };
  const filas = { ...stand, filas: stand.filas.filter((f) => f.id !== 'ens' || nombreVigente(f.titulo)) };
  for (const id of ['tesoreria']) if (!filas.filas.some((f) => f.id === id)) problemas.push(`the chain file has no accepted ${id} row`);
  if (filas.rechazadas.length) problemas.push(`rows refused: ${filas.rechazadas.join(', ')}`);
  return { clips, cadena: cadena ? { ...cadena, filas: filas.filas } : null, problemas };
}
