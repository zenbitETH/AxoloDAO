// Before any push: none of the attested files (by path or by sha256), and nothing generated for /atlas/datos/huella/, may be in git; a deployed build carries no source map, no local address or path,
// and says it is a real build. the binding IP condition: the 130 attested files, the cite-only and the IUCN data files never reach zenbitETH/AxoloDAO, by commit or by CI; the site is deployed as a PREBUILT upload.
//   node scripts/pre-push-huella.mjs [--listado <file>] [--dist <dir>]     what git holds now (HEAD and the index)
//   node scripts/pre-push-huella.mjs --hook <remote> <url>                 as a pre-push hook: reads «local-ref local-sha remote-ref remote-sha» lines from stdin and checks every blob of every commit that would be sent
// The listing is read at the pinned commit of Contracts' repository (HUELLA_COMMIT, default 9f7cf28; HUELLA_REPO) unless --listado or HUELLA_LISTADO names a file. Exit 1 on any problem, and when nothing was checked.
// Install: .githooks/pre-push in the repository and `git config core.hooksPath .githooks` (local; the hook is the line that calls this script).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerListado } from './lib/huella.mjs';
import { buscarLocal } from './lib/direccionesLocales.mjs';
import { rastroEnBytes } from './lib/barridoBinario.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const CERO = /^0+$/;
const git = (cwd, args, opciones = {}) => execFileSync('git', args, { cwd, maxBuffer: 1 << 30, ...opciones });

/** The blobs to check: [{ sha1, ruta }]. `refs` are the hook's pushed refs ({ local, remote }); without them, HEAD and the index. Paths are the repository's (from its top), never the folder the check runs in. */
function blobsA(top, refs, remoto) {
  const blobs = new Map();
  const anota = (sha1, ruta) => { if (sha1 && !CERO.test(sha1)) blobs.set(`${sha1} ${ruta}`, { sha1, ruta }); };
  const arbol = (rev) => { for (const l of git(top, ['ls-tree', '-r', '-z', rev]).toString().split('\0').filter(Boolean)) { const m = /^\d+ blob ([0-9a-f]+)\t([\s\S]+)$/.exec(l); if (m) anota(m[1], m[2]); } };
  if (!refs) {
    try { arbol('HEAD'); } catch { /* an unborn HEAD: only the index */ }
    for (const l of git(top, ['ls-files', '-s', '-z', '--full-name']).toString().split('\0').filter(Boolean)) { const m = /^\d+ ([0-9a-f]+) \d\t([\s\S]+)$/.exec(l); if (m) anota(m[1], m[2]); }
    return [...blobs.values()];
  }
  for (const { local, remote } of refs) {
    if (CERO.test(local)) continue;                          // a deletion sends nothing
    arbol(local);                                            // the tip as a whole
    const rango = CERO.test(remote) ? [local, '--not', `--remotes=${remoto || 'origin'}`] : [local, '--not', remote];
    let objetos = ''; try { objetos = git(top, ['rev-list', '--objects', ...rango]).toString(); } catch { objetos = git(top, ['rev-list', '--objects', local]).toString(); }   // a remote sha this clone does not know: everything reachable
    for (const l of objetos.split('\n')) { const m = /^([0-9a-f]{40,64})(?: (.*))?$/.exec(l); if (m && m[2]) anota(m[1], m[2]); }   // trees and blobs carry a path; the type is checked when the content is read
  }
  return [...blobs.values()];
}

/** { problemas, revisados } for the repository containing `repo` (any folder inside it). */
export function revisarHuella({ repo, listadoTexto, dist = null, refs = null, remoto = '' }) {
  const listado = leerListado(listadoTexto);
  const porSha = new Map(listado.archivos.map((a) => [a.sha256, a.ruta]));
  const rutas = listado.archivos.map((a) => a.ruta);
  const top = git(repo, ['rev-parse', '--show-toplevel']).toString().trim();
  const mal = [];
  let revisados = 0;
  const candidatos = blobsA(top, refs, remoto);
  // sizes and types first (`--batch-check`), then the blobs in batches of at most 128 MB through `--batch`: a tree has no content to compare, and a blob too big to read is a failure, never a skip
  const unicos = [...new Map(candidatos.map((c) => [c.sha1, c])).values()];
  const info = new Map(); const chequeo = unicos.length ? execFileSync('git', ['cat-file', '--batch-check'], { cwd: top, input: unicos.map((c) => c.sha1).join('\n') + '\n', maxBuffer: 1 << 28 }).toString().split('\n').filter(Boolean) : [];
  chequeo.forEach((l, i) => { const [, tipo, tam] = l.split(' '); info.set(unicos[i].sha1, { tipo, tam: Number(tam) }); });
  const hashes = new Map();
  let lote = [], bytes = 0;
  const vacia = () => {
    if (!lote.length) return;
    const salida = execFileSync('git', ['cat-file', '--batch'], { cwd: top, input: lote.join('\n') + '\n', maxBuffer: 0x7fffffff });
    let pos = 0;
    for (const sha1 of lote) { const fin = salida.indexOf(0x0a, pos); const tam = Number(salida.subarray(pos, fin).toString().split(' ')[2]); hashes.set(sha1, createHash('sha256').update(salida.subarray(fin + 1, fin + 1 + tam)).digest('hex')); pos = fin + 1 + tam + 1; }
    lote = []; bytes = 0;
  };
  for (const c of unicos) {
    const i = info.get(c.sha1);
    if (!i) { mal.push(`${c.ruta}: ${c.sha1} is not in this repository`); continue; }
    if (i.tipo !== 'blob') continue;
    if (i.tam > (1 << 27)) { mal.push(`${c.ruta}: a blob of ${i.tam} bytes is too big to check, so it is refused`); continue; }
    if (bytes + i.tam > (1 << 27)) vacia();
    lote.push(c.sha1); bytes += i.tam;
  }
  vacia();
  const vistos = new Set();
  for (const c of candidatos) {
    if (info.get(c.sha1)?.tipo !== 'blob') continue;
    revisados++;
    const clave = `${c.sha1} ${c.ruta}`; if (vistos.has(clave)) continue; vistos.add(clave);
    if (/(^|\/)atlas\/datos\/huella(\/|$)/.test(c.ruta)) mal.push(`${c.ruta}: generated for /atlas/datos/huella/ and tracked`);
    if (rutas.some((r) => c.ruta === r || c.ruta.endsWith(`/${r}`))) mal.push(`${c.ruta}: its path is an attested file's`);
    const s = hashes.get(c.sha1);
    if (s && porSha.has(s)) mal.push(`${c.ruta}: its sha256 is the attested file ${porSha.get(s)}`);
  }
  if (revisados === 0) mal.push(refs && refs.every((r) => CERO.test(r.local)) ? null : 'no file was hashed: the check looked at nothing (wrong folder, or an empty repository)');
  if (dist) mal.push(...problemasDeLaConstruccion(dist));
  return { problemas: mal.filter(Boolean), revisados };
}
export const problemasDeLaHuella = (o) => revisarHuella(o).problemas;

const anda = (d) => readdirSync(d).flatMap((nombre) => { const f = join(d, nombre); return statSync(f).isDirectory() ? anda(f) : [f]; });
/** What a build to deploy must not have: source maps, local addresses and paths, a build record that says «prueba» or a dirty tree. */
export function problemasDeLaConstruccion(dist) {
  const mal = [];
  if (!existsSync(dist)) return [`${dist}: no such build`];
  for (const f of anda(dist)) {
    const rel = f.slice(dist.length + 1);
    if (/\.map$/.test(f)) mal.push(`${rel}: a source map in the build`);
    if (/\.(jpe?g|png|webp|gif|avif)$/i.test(f) && statSync(f).size < 32 * 1024 * 1024) {   // a generated image can carry its generation record (model path, prompt, source path) in its metadata
      const ruta = rastroEnBytes(readFileSync(f).toString('latin1'));   // the terms live in lib/barridoBinario.mjs, the one file that spells them
      if (ruta) mal.push(`${rel}: image metadata with a local path or a private repository (${ruta})`);
    }
    if (!/\.(html|json|geojson|txt|js|mjs|css|svg|xml|webmanifest|jsonl|csv|md)$/i.test(f) || statSync(f).size > 64 * 1024 * 1024) continue;
    const hit = buscarLocal(readFileSync(f, 'utf8'));
    if (hit) mal.push(`${rel}: a local address or path in the build (${hit})`);
  }
  const registro = join(dist, 'atlas/datos/huella/build.json');
  if (existsSync(registro)) {
    const r = JSON.parse(readFileSync(registro, 'utf8'));
    if (r.prueba === true) mal.push('build.json: this is a test build (prueba), never to be deployed');
    if (r.sitio?.arbolLimpio !== true) mal.push('build.json: built from a dirty tree');
  }
  return mal;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let texto;
  const archivo = arg('--listado') ?? process.env.HUELLA_LISTADO;
  // inside a hook git exports GIT_DIR (and GIT_INDEX_FILE…) for THIS repository; with them `git -C <Contracts>` would look here and find nothing
  const sinGit = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
  try {
    if (archivo) texto = readFileSync(archivo, 'utf8');
    else texto = execFileSync('git', ['-C', process.env.HUELLA_REPO ?? join(homedir(), 'Documents/GitHub/axolodao-system-booth-browser'), 'show', `${process.env.HUELLA_COMMIT ?? '9f7cf28'}:tools/atlas-huella/listado-stand.txt`], { maxBuffer: 1 << 24, env: sinGit }).toString();
  } catch (e) { console.error(`pre-push-huella: the listing could not be read (${e.message.split('\n')[0]}); nothing was checked, so the push is refused`); process.exit(1); }
  let refs = null, remoto = '';
  if (process.argv.includes('--hook')) {
    remoto = process.argv[process.argv.indexOf('--hook') + 1] ?? '';
    refs = readFileSync(0, 'utf8').split('\n').filter(Boolean).map((l) => { const [, local, , remote] = l.split(' '); return { local, remote }; });
    if (!refs.length) process.exit(0);
  }
  const dist = arg('--dist');
  let r; try { r = revisarHuella({ repo: process.env.HUELLA_REPO_A_REVISAR ?? process.cwd(), listadoTexto: texto, dist: dist ? resolve(dist) : null, refs, remoto }); } catch (e) { console.error(`pre-push-huella: ${e.message}`); process.exit(1); }
  if (r.problemas.length) { console.error(`pre-push-huella: ${r.problemas.length} problem(s)\n${r.problemas.slice(0, 20).map((m) => `  ✗ ${m}`).join('\n')}`); process.exit(1); }
  console.log(`pre-push-huella: ${r.revisados} file(s) hashed, none is an attested file (by path or sha256)${dist ? ', and the build has no source map, no local address, and is a real build' : ''}`);
}
