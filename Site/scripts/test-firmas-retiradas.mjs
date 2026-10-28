// A build serves no retired name or signing key (src/lib/firmasRetiradas.mjs): not in a page, not in a script, not in a data file.
//   node scripts/test-firmas-retiradas.mjs [--dist <dir>]   (after build:sitio)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIRMANTES_RETIRADOS, NOMBRES_RETIRADOS, firmaVigente, nombreVigente } from '../src/lib/firmasRetiradas.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--dist');
const DIST = i > 0 ? resolve(process.argv[i + 1]) : join(SITE, 'dist');
const TEXTO = new Set(['.html', '.js', '.mjs', '.json', '.geojson', '.xml', '.txt', '.css', '.svg', '.webmanifest', '.jsonl', '.csv']);
let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };

// a retired key also hides behind its short form (0xeCB4…6e05), so each key is matched by its first four hex digits after 0x as well
const patron = new RegExp([...NOMBRES_RETIRADOS.map((n) => n.replace(/\./g, '\\.')), ...FIRMANTES_RETIRADOS.map((d) => `${d.slice(0, 6)}(?:[0-9a-f]{36}|…)`)].join('|'), 'i');
/** The retired names and keys a text carries. */
export const retiradosEn = (texto) => [...new Set((String(texto).match(new RegExp(patron.source, 'gi')) ?? []).map((m) => m.toLowerCase()))];

// planted
ok(!firmaVigente('0xeCB4C1245665e8A1F43826355aaB0Dd6bF336e05') && firmaVigente('0xcF1aeb4152F01e7643f772F4A08E0e791160B96B') && !firmaVigente('') && !firmaVigente(null), 'planted: the retired key is not current, the atlas signer is, and a missing address is not');
ok(!nombreVigente('Zenbit.AxoloDAO.eth ') && !nombreVigente('xolotlcalli.axolodao.eth') && nombreVigente('treasury.axolodao.eth') && nombreVigente('axolodao.eth'), 'planted: both retired names are refused in any case, the treasury and the parent are not');
ok(retiradosEn('Firma: Zenbit (zenbit.axolodao.eth), 0xeCB4C1245665e8A1F43826355aaB0Dd6bF336e05').length === 2 && retiradosEn('autor 0xecb4…6e05').length === 1, 'planted: a page naming the old signer is caught, in full and in short form');
ok(retiradosEn('treasury.axolodao.eth · 0xbDF701408aD237faA2d5d3177ae257aF35265dbb · axolodao.eth').length === 0, 'planted: the treasury and the parent name pass');

// the build
if (!existsSync(DIST)) ok(false, `${DIST} exists (run build:sitio first)`);
else {
  const hallados = [];
  const recorrer = (d) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) recorrer(f); else if (TEXTO.has(extname(n))) { const r = retiradosEn(readFileSync(f, 'utf8')); if (r.length) hallados.push(`${relative(DIST, f)}: ${r.join(', ')}`); } } };
  recorrer(DIST);
  ok(hallados.length === 0, `the build serves no retired name or key${hallados.length ? ` (${hallados.length} file(s): ${hallados.slice(0, 6).join('; ')})` : ''}`);
  // while the weekly anchors are signed by a retired key, no page names them as onchain
  const anclas = JSON.parse(readFileSync(join(SITE, 'src/data/anclas-xolotlcalli.json'), 'utf8'));
  if (!firmaVigente(anclas.atestador)) {
    const nombran = [];
    const buscar = (d) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) buscar(f); else if (n.endsWith('.html') && /48 anclas|48 weekly anchors|48 âncoras|semanas ancladas|weeks anchored|semanas ancoradas/i.test(readFileSync(f, 'utf8'))) nombran.push(relative(DIST, f)); } };
    buscar(DIST);
    ok(nombran.length === 0, `no page names the 48 anchors signed by the retired key${nombran.length ? ` (${nombran.slice(0, 6).join(', ')})` : ''}`);
  }
}

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
