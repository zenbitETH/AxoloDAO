// The mesa's vote rules (src/components/mesa/votos.ts): only a verified hypothesis takes votes, never from its author, and a vote
// against counts only with the voter's own counter-hypothesis that disputes it; it waits while that counter-hypothesis is pending.
// Run: node --experimental-strip-types --no-warnings scripts/test-mesa-votos.mjs
import assert from 'node:assert/strict';
import { cuentaVotos, estadoClip, revisarVoto, tablaDetectives, votar } from '../src/components/mesa/votos.ts';

const A = '0x00000000000000000000000000000000000000aa', B = '0x00000000000000000000000000000000000000bb', C = '0x00000000000000000000000000000000000000cc';
const hip = (id, autor, estado, contra = null) => ({ id, autor: { direccion: autor, ens: null, red: null }, estado, contra, votos: [] });
const h = hip('h', A, 'verificada');
const voto = (detective, valor, contra = null) => ({ detective, valor, t: 0, contra });

const casos = [
  ['a favor de una verificada', h, voto(B, 1), [h], { ok: true, cuenta: true }],
  ['de quien la verificó', { ...h, verificacion: { verificador: C } }, voto(C, 1), [h], { ok: true, cuenta: true }],
  ['sobre una pendiente', hip('p', A, 'pendiente'), voto(B, 1), [], false],
  ['del autor, aunque cambie mayúsculas', h, voto(A.toUpperCase().replace('0X', '0x'), 1), [h], false],
  ['en contra sin contrahipótesis', h, voto(B, -1), [h], false],
  ['en contra con una contrahipótesis ajena', h, voto(B, -1, 'k'), [h, hip('k', C, 'verificada', 'h')], false],
  ['en contra con una que disputa otra hipótesis', h, voto(B, -1, 'k'), [h, hip('k', B, 'verificada', 'otra')], false],
  ['en contra con una rechazada', h, voto(B, -1, 'k'), [h, hip('k', B, 'rechazada', 'h')], false],
  ['en contra con una pendiente: entra y espera', h, voto(B, -1, 'k'), [h, hip('k', B, 'pendiente', 'h')], { ok: true, cuenta: false }],
  ['en contra con una verificada: cuenta', h, voto(B, -1, 'k'), [h, hip('k', B, 'verificada', 'h')], { ok: true, cuenta: true }],
  ['a favor con contrahipótesis', h, voto(B, 1, 'k'), [h, hip('k', B, 'verificada', 'h')], false],
];
for (const [nombre, hh, v, todas, esperado] of casos) {
  const r = revisarVoto(hh, v, todas);
  if (esperado === false) assert.equal(r.ok, false, nombre);
  else assert.deepEqual(r, esperado, nombre);
}

// uno por detective: votar de nuevo reemplaza; un voto inválido no entra
const k = hip('k', B, 'pendiente', 'h');
let x = votar(h, voto(B, 1), [h]);
x = votar(x, voto(B, -1, 'k'), [x, k]);
x = votar(x, voto(C, 1), [x, k]);
assert.equal(x.votos.length, 2, 'un voto por detective');
assert.throws(() => votar(x, voto(A, 1), [x]), /propia/);
assert.deepEqual(cuentaVotos(x, [x, k]), { a: 1, c: 0, espera: 1 });
assert.deepEqual(cuentaVotos(x, [x, { ...k, estado: 'verificada' }]), { a: 1, c: 1, espera: 0 });

// la tabla: primero hipótesis verificadas; con el mismo número, los votos netos; un empate completo comparte puesto
const D = '0x00000000000000000000000000000000000000dd', N = '0x00000000000000000000000000000000000000ee';
const conVotos = (h, votos) => ({ ...h, votos });
const t = [
  conVotos(hip('a1', A, 'verificada'), [voto(B, 1), voto(C, 1)]),
  conVotos(hip('b1', B, 'verificada'), [voto(A, 1), voto(N, 1), voto(N.replace('ee', 'ef'), 1)]),   // N no tiene verificadas: no cuenta
  hip('c1', C, 'verificada'), hip('c2', C, 'verificada'),                                            // C gana por desempeño, sin votos
  hip('d1', D, 'verificada'), hip('d2', D, 'pendiente'), hip('d3', D, 'rechazada'),                 // sólo cuenta la verificada
  hip('n1', N, 'pendiente'),
];
const tabla = tablaDetectives(t).map((f) => [f.detective.slice(-2), f.verificadas, f.netos, f.puesto]);
assert.deepEqual(tabla, [['cc', 2, 0, 1], ['aa', 1, 2, 2], ['bb', 1, 1, 3], ['dd', 1, 0, 4]], 'orden de la tabla');
const empate = tablaDetectives([hip('x', A, 'verificada'), hip('y', B, 'verificada')]).map((f) => f.puesto);
assert.deepEqual(empate, [1, 1], 'un empate completo comparte el puesto');

// un clip con hipótesis es público sólo con las dos verificadas; un rechazo de cualquiera rechaza el envío
const clips = [
  ['verificada', null, 'verificada'], ['pendiente', null, 'pendiente'],
  ['verificada', 'verificada', 'verificada'], ['verificada', 'pendiente', 'pendiente'], ['verificada', 'borrador', 'pendiente'],
  ['pendiente', 'verificada', 'pendiente'], ['verificada', 'rechazada', 'rechazada'], ['rechazada', 'verificada', 'rechazada'],
];
for (const [c, hh, esperado] of clips) assert.equal(estadoClip(c, hh), esperado, `clip ${c} con hipótesis ${hh}`);
console.log(`test-mesa-votos: ${casos.length + 7 + clips.length} comprobaciones`);
