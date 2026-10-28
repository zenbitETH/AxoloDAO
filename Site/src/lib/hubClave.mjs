// The booth's key for the hub: a file (mode 600, never printed, never committed) whose content is sent as a header on every request to the hub's own origin and to no other host.
import { readFileSync, statSync } from 'node:fs';

/** `fetchFn` with the key header added (`esquema`, e.g. «Bearer», goes before the key in the header's value) for requests to `hubUrl`'s origin. Refuses a key file that others can read, an empty one, or a header name that was not named. */
export function conClave(fetchFn, { archivo, cabecera, esquema = '', hubUrl }) {
  if (!archivo) return fetchFn;
  if (!cabecera || !/^[A-Za-z0-9-]{1,64}$/.test(cabecera)) throw new Error('the hub key needs its header name (HUB_KEY_HEADER)');
  const st = statSync(archivo);
  if (!st.isFile() || (st.mode & 0o077) !== 0) throw new Error('the hub key file must be a regular file readable only by its owner (mode 600)');
  const valor = readFileSync(archivo, 'utf8').trim();
  if (!valor) throw new Error('the hub key file is empty');
  const u = new URL(hubUrl);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && /^(127\.\d+\.\d+\.\d+|localhost|\[::1\])$/.test(u.hostname))) throw new Error('the hub key travels over https only, or http to a loopback host (127.0.0.1, localhost, ::1)');
  const origen = u.origin;
  return (url, opciones = {}) => {
    if (new URL(url).origin !== origen) return fetchFn(url, opciones);
    return fetchFn(url, { ...opciones, redirect: 'error', headers: { ...(opciones.headers ?? {}), [cabecera]: esquema ? `${esquema} ${valor}` : valor } });
  };
}
