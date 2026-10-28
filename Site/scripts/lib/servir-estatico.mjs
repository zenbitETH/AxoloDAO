// A static server for a built folder (dist or a copy of it): `/atlas` and `/atlas/` both answer, a folder answers with its index.html. Local only (127.0.0.1); the port is the OS's choice unless one is given.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/geo+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml', '.ico': 'image/x-icon' };

export async function servirEstatico(carpeta, puerto = 0) {
  const raiz = resolve(carpeta);
  const servidor = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    let f = join(raiz, p);
    if (existsSync(f) && statSync(f).isDirectory() && existsSync(join(f, 'index.html'))) f = join(f, 'index.html');
    else if (!existsSync(f) && existsSync(`${f}/index.html`)) f = `${f}/index.html`;
    if (!f.startsWith(raiz) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TIPOS[extname(f)] ?? 'application/octet-stream' });
    res.end(readFileSync(f));
  });
  await new Promise((r) => servidor.listen(puerto, '127.0.0.1', r));
  return { servidor, base: `http://127.0.0.1:${servidor.address().port}` };
}
