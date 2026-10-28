// The labels of the facility types and legal figures (es, en, pt), as data, from the communications team's table
// (the communications repository, context/axolodao/atlas/etiquetas-instalaciones-2026-10-21.md). Writes public/atlas/layers/etiquetas-instalaciones.json.
//   node scripts/proto/import-etiquetas-instalaciones.mjs <the markdown file> <the commit it comes from>
// The file it writes carries no source line (a path or commit of the brain repo has no place on a public page); the commit it was last made from is recorded here: the communications repository 1b0452f.
// It stops if a code of the data (tipo_recinto, tipo_legal in src/data/atlas-snapshot/instalaciones-catalogadas.geojson) has no row, or a row lacks a language.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [archivo, origen] = process.argv.slice(2);
if (!archivo || !origen) { console.error('usage: node import-etiquetas-instalaciones.mjs <markdown file> <commit>'); process.exit(1); }
const lineas = readFileSync(archivo, 'utf8').split('\n');
let sec = '';
const tipos = {}, legales = {}, siglas = {};
for (const l of lineas) {
  if (/^## 1\./.test(l)) sec = 'tipo'; else if (/^## 2\./.test(l)) sec = 'legal'; else if (/^## 3\./.test(l)) sec = '';
  if (/^\| Sigla /.test(l)) sec = 'siglas';
  const c = l.startsWith('|') ? l.split('|').slice(1, -1).map((x) => x.trim()) : null;
  if (!c) continue;
  const cod = /^`([\w-]+)`$/.exec(c[0])?.[1];
  if (sec === 'tipo' && cod) tipos[cod] = { es: c[1], en: c[2], pt: c[3] };
  else if (sec === 'legal' && cod) legales[cod] = { es: c[1], en: c[2], pt: c[3] };
  else if (sec === 'siglas' && /^(UMA|PIMVS)$/.test(c[0])) siglas[c[0]] = { es: c[1], en: c[2], pt: c[3] };
}
const hay = (o, k, nombre) => { for (const [cod, v] of Object.entries(o)) for (const l of ['es', 'en', 'pt']) if (!v[l]) { console.error(`REFUSED: ${nombre} «${cod}» has no ${l} label`); process.exit(1); } return o; };
hay(tipos, 'tipo', 'tipo_recinto'); hay(legales, 'legal', 'tipo_legal'); hay(siglas, 'sigla', 'sigla');
const datos = JSON.parse(readFileSync(join(SITE, 'src/data/atlas-snapshot/instalaciones-catalogadas.geojson'), 'utf8'));
for (const f of datos.features) {
  if (f.properties.estado_operacion === 'cerrado') continue;   // a closed row is given no type and no legal figure (the atlas does not count it), so it needs no label
  const t = f.properties.tipo_recinto, g = f.properties.tipo_legal === 'no consta' || !f.properties.tipo_legal ? 'desconocido' : f.properties.tipo_legal;
  if (!tipos[t]) { console.error(`REFUSED: tipo_recinto «${t}» of ${f.properties.id} has no label`); process.exit(1); }
  if (!legales[g]) { console.error(`REFUSED: tipo_legal «${g}» of ${f.properties.id} has no label`); process.exit(1); }
}
if (Object.keys(tipos).length !== 11 || Object.keys(siglas).length !== 2) { console.error('REFUSED: expected 11 tipo_recinto codes and 2 acronym rows'); process.exit(1); }
writeFileSync(join(SITE, 'public/atlas/layers/etiquetas-instalaciones.json'), JSON.stringify({ tipo_recinto: tipos, tipo_legal: legales, siglas }, null, 1) + '\n');
console.log(`${Object.keys(tipos).length} types, ${Object.keys(legales).length} legal figures, ${Object.keys(siglas).length} acronyms`);
