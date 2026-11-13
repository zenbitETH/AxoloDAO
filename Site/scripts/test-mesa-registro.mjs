// The registry of the mesa (/xolotlcalli/mesa/datos.json, read by /datos of Xovi) carries every measure of the biometry, not only
// the weight (since 13-nov-2026, every measure is displayed on datos), and the ajolote card has a column for each one.
//   npm run build, then: node scripts/test-mesa-registro.mjs [--dist <folder>]
// The measures are not a list written here: the test reads every numeric field of the biometry rows in the bundle and asks that the
// dictionary (src/lib/medidasBiometria.mjs) names it, that the built registry carries each value as a point of its series, that the
// biometry event says it with its unit, and that a column of the card shows it.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLUMNAS_TARJETA, MEDIDAS, camposNumericos } from '../src/lib/medidasBiometria.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--dist');
const dist = i > 0 ? resolve(process.argv[i + 1]) : join(SITE, 'dist');
let fallas = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fallas++; };

const bundle = JSON.parse(readFileSync(join(SITE, 'src/data/ajolotes/bundle.json'), 'utf8'));
const filas = Object.values(bundle.historial).flat();
const campos = camposNumericos(filas);
// the corpus first: a bundle with no biometry would pass every check below
ok(filas.length >= 100 && campos.length >= 10, `the bundle's biometry has rows and numeric fields to check (${filas.length} rows, ${campos.length} fields: ${campos.join(', ')})`);
const sinNombre = campos.filter((k) => !MEDIDAS.some((m) => m.k === k));
ok(sinNombre.length === 0, `every numeric field of the biometry is a named measure, with its unit and lane${sinNombre.length ? ` (missing: ${sinNombre.join(', ')})` : ''}`);

// the card: every measure is in one column, once
const enColumnas = COLUMNAS_TARJETA.flatMap((c) => c.claves);
const fueraDeLaTarjeta = MEDIDAS.filter((m) => !enColumnas.includes(m.k)).map((m) => m.k);
const repetidas = enColumnas.filter((k, j) => enColumnas.indexOf(k) !== j);
ok(fueraDeLaTarjeta.length === 0 && repetidas.length === 0, `the ajolote card has a column for every measure, and for each one once${fueraDeLaTarjeta.length ? ` (no column: ${fueraDeLaTarjeta.join(', ')})` : ''}${repetidas.length ? ` (twice: ${repetidas.join(', ')})` : ''}`);
const tarjeta = readFileSync(join(SITE, 'src/components/ajolotes/tabs/BiometriaTab.tsx'), 'utf8');
ok(/COLUMNAS_TARJETA/.test(tarjeta) && !/fmt\(h\.(?:peso|lt|lhc|branqIzq)\b/.test(tarjeta), 'the card draws its measure columns from that list, not from fields of its own');

const f = join(dist, 'xolotlcalli/mesa/datos.json');
if (!existsSync(f)) {
  ok(false, `the built registry exists (${f}: run \`npm run build\` first)`);
} else {
  const D = JSON.parse(readFileSync(f, 'utf8'));
  // the dictionary the registry publishes is the module's, in its order
  const def = D.medidasDef ?? [];
  ok(def.length === MEDIDAS.length && MEDIDAS.every((m, j) => def[j]?.k === m.k && def[j]?.unidad === m.unidad && def[j]?.grupo === m.grupo && def[j]?.nombre === m.es),
    `the registry carries the dictionary of the ${MEDIDAS.length} measures: name, unit and lane (${def.length} entries)`);
  // every value of every measure is a point of its series: the weight in `peso`, the others in `medidas`
  const puntos = (alias, k) => (k === 'peso' ? D.peso?.[alias] : D.medidas?.[alias]?.[k]) ?? [];
  const faltan = [];
  for (const m of MEDIDAS) {
    let esperados = 0, publicados = 0;
    for (const [alias, rs] of Object.entries(bundle.historial)) {
      const conValor = rs.filter((r) => typeof r[m.k] === 'number' && r.fecha);
      esperados += conValor.length;
      const serie = puntos(alias, m.k);
      publicados += serie.length;
      for (const r of conValor) if (!serie.some((p) => p[1] === r[m.k])) faltan.push(`${m.k} ${r[m.k]}`);
    }
    if (esperados !== publicados) faltan.push(`${m.k}: ${publicados} points for ${esperados} values`);
  }
  ok(faltan.length === 0, `every value of every measure is a point of its series in the registry${faltan.length ? ` (${faltan.length} missing, e.g. ${faltan.slice(0, 3).join('; ')})` : ''}`);
  // the biometry event of each row says each of its measures with the unit: «LT 24 cm»
  const callados = [];
  for (const [alias, rs] of Object.entries(bundle.historial)) {
    const bio = (D.eventos?.[alias] ?? []).filter((e) => e[1] === 'bio').map((e) => String(e[3]));
    for (const r of rs) for (const m of MEDIDAS) {
      if (typeof r[m.k] !== 'number') continue;
      const frase = `${m.corto} ${r[m.k]} ${m.unidad}`;
      if (!bio.some((t) => t.includes(frase))) callados.push(`${alias}: ${frase}`);
    }
  }
  ok(callados.length === 0, `each biometry event says every measure of its row with its unit${callados.length ? ` (${callados.length} unsaid, e.g. ${callados.slice(0, 2).join('; ')})` : ''}`);
}

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
