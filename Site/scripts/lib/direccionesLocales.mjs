// What must never be written into anything that is deployed: an address that only exists on this machine or this network, and a path on this machine.
// Used by the pre-push check and by build:sitio on the dist it has just built. Plain numbers that only look like an address (coordinates, versions) pass: a private IPv4 counts only with a scheme or a port.
const IPV4_PRIVADO = '(?:10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|192\\.168\\.\\d{1,3}\\.\\d{1,3}|172\\.(?:1[6-9]|2\\d|3[01])\\.\\d{1,3}\\.\\d{1,3}|169\\.254\\.\\d{1,3}\\.\\d{1,3})';
export const LOCAL = new RegExp([
  '127\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}', 'localhost', '0\\.0\\.0\\.0', '\\[::1\\]', '\\[fe80:',
  `(?:https?:)?//${IPV4_PRIVADO}`, `${IPV4_PRIVADO}:\\d{2,5}`,
  'https?://[a-z0-9-]+\\.local\\b', 'file:///[A-Za-z]',
  '/Users/[A-Za-z]', '/home/[a-z_][a-z0-9_-]*/', '/private/var/', '/var/folders/', '/tmp/claude', '\\.claude/jobs', '[A-Za-z]:\\\\Users\\\\',
].join('|'), 'i');
/** The first local address or path found in `texto`, or null. */
export const buscarLocal = (texto) => { const m = String(texto).match(LOCAL); return m ? m[0] : null; };
