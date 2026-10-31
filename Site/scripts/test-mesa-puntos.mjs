// The leaderboard points (src/components/mesa/puntos.ts): scarcity per cell, independent reuse only, support of someone else's
// hypothesis, a cap on recruits, votes as the tiebreak, and the strategies of scripts/simular-puntos.mjs ranked as intended.
// Run: node --experimental-strip-types --no-warnings scripts/test-mesa-puntos.mjs
import assert from 'node:assert/strict';
import { APOYO, BASE, REUSO, TOPE_RECLUTADOS, puntosPorActo, tablaPorPuntos } from '../src/components/mesa/puntos.ts';
import { filas } from './simular-puntos.mjs';

let n = 0; const T = Date.UTC(2026, 5, 1);
const a = (autor, tipo, celda = 'c', extra = {}) => ({ id: `${tipo}${++n}`, autor, tipo, celda, t: T + n * 1000, ...extra });
let ok = 0; const eq = (x, y, m) => { assert.ok(Math.abs(x - y) < 1e-9, `${m}: ${x} ≠ ${y}`); ok++; };

// escasez: el n-ésimo dato de una celda vale 1/n; otra celda empieza de nuevo
const c1 = a('A', 'clip', 'x'), c2 = a('B', 'clip', 'x'), c3 = a('A', 'clip', 'x'), c4 = a('A', 'clip', 'y');
let p = puntosPorActo([c1, c2, c3, c4]);
eq(p.get(c1.id).base, BASE.clip, 'primer clip de la celda'); eq(p.get(c2.id).base, BASE.clip / 2, 'segundo'); eq(p.get(c3.id).base, BASE.clip / 3, 'tercero');
eq(p.get(c4.id).base, BASE.clip, 'otra celda');
// las hipótesis no tienen escasez
const h1 = a('A', 'hipotesis', 'h'), h2 = a('B', 'hipotesis', 'h');
p = puntosPorActo([h1, h2]); eq(p.get(h2.id).base, BASE.hipotesis, 'segunda hipótesis sobre lo mismo');

// reuso: personas distintas e independientes; citarse a sí mismo o en reciprocidad no cuenta
const dato = a('A', 'conjunto', 'k');
const citaB = a('B', 'hipotesis', 'h', { cita: [dato.id, dato.id] }), citaC = a('C', 'hipotesis', 'h', { cita: [dato.id] }), citaA = a('A', 'hipotesis', 'h', { cita: [dato.id] });
p = puntosPorActo([dato, citaB, citaC, citaA]); eq(p.get(dato.id).reuso, REUSO.conjunto * Math.log2(3), 'dos personas, la autora no cuenta');
const hA = a('A', 'hipotesis'), hB = a('B', 'hipotesis', 'h', { cita: [hA.id] }); hA.cita = [hB.id];
p = puntosPorActo([hA, hB]); eq(p.get(hA.id).reuso, 0, 'reciprocidad A↔B'); eq(p.get(hB.id).reuso, 0, 'reciprocidad B↔A');

// apoyo: sólo un clip para la hipótesis de otra persona
const ajena = a('B', 'hipotesis'), propia = a('A', 'hipotesis');
const ap = a('A', 'clip', 'z', { apoya: ajena.id }), auto = a('A', 'clip', 'w', { apoya: propia.id });
p = puntosPorActo([ajena, propia, ap, auto]); eq(p.get(ap.id).apoyo, APOYO, 'apoyo a otra persona'); eq(p.get(auto.id).apoyo, 0, 'apoyo a sí misma');

// reclutados: tope por ventana de 30 días
const recl = Array.from({ length: 6 }, (_, i) => ({ ...a('R', 'reclutado'), t: T + i * 864e5 }));
const tarde = { ...a('R', 'reclutado'), t: T + 40 * 864e5 };
const tr = tablaPorPuntos([...recl, tarde]).find((f) => f.detective === 'r');
eq(tr.reclutados, (TOPE_RECLUTADOS + 1) * BASE.reclutado, 'tres en el primer mes y uno después');

// empate de puntos: desempatan los votos; empate completo comparte puesto
const e = [a('A', 'hipotesis'), a('B', 'hipotesis'), a('C', 'hipotesis')];
const t = tablaPorPuntos(e, new Map([['b', 2], ['a', 2], ['c', 1]]));
assert.deepEqual(t.map((f) => [f.detective, f.puesto]), [['a', 1], ['b', 1], ['c', 3]]); ok++;

// las estrategias de la simulación: lo honesto rinde más por acto que inundar, reclutar en masa o citarse en anillo
const por = (nombre) => filas.find((f) => f.estrategia.startsWith(nombre)).porActo;
assert.ok(por('Honesta') > 4 * por('Inunda'), 'inundar una celda no paga'); ok++;
assert.ok(por('Honesta') > 4 * por('Granja'), 'reclutar en masa no paga'); ok++;
assert.ok(por('Anillo') <= por('Sólo hipótesis'), 'el anillo no gana nada por citarse'); ok++;
console.log(`test-mesa-puntos: ${ok} comprobaciones`);
