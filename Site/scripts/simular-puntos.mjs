// Strategies against the leaderboard points (src/components/mesa/puntos.ts): points per verified act for honest varied work and
// for the ways to game it. Every act here has already passed a verifier, so the cost of a strategy is its count of verified acts.
// Run: node --experimental-strip-types --no-warnings scripts/simular-puntos.mjs [--json]
import { tablaPorPuntos } from '../src/components/mesa/puntos.ts';

const D = 864e5, T0 = Date.UTC(2026, 5, 1);
let n = 0;
const acto = (autor, tipo, celda, extra = {}) => ({ id: `${autor}-${tipo}-${++n}`, autor, tipo, celda, t: T0 + n * 3600e3, ...extra });

function escenario(nombre, armar) { n = 0; const actos = armar(); return { nombre, actos }; }

// pares que citan: otras personas cuyas hipótesis verificadas citan lo que hace cada estrategia (lo mismo para todas)
const citadores = (ids, quien = ['p1', 'p2']) => quien.map((p) => acto(p, 'hipotesis', `hipotesis:${p}`, { cita: ids }));

const escenarios = [
  escenario('Honesta y variada', () => {
    const h1 = acto('honesta', 'hipotesis', 'h'), h2 = acto('honesta', 'hipotesis', 'h');
    const ajena = acto('otra', 'hipotesis', 'h');
    const clips = Array.from({ length: 6 }, (_, i) => acto('honesta', 'clip', `clip:A:conducta${i}:W24`, i < 2 ? { apoya: ajena.id } : {}));
    const aportes = [acto('honesta', 'aporte', 'aporte:sp1:f1'), acto('honesta', 'aporte', 'aporte:sp2:f3')];
    const conj = acto('honesta', 'conjunto', 'conjunto:org1:W24');
    return [h1, h2, ajena, ...clips, ...aportes, conj, ...citadores([h1.id, h2.id, conj.id, clips[0].id])];
  }),
  escenario('Inunda una celda con clips', () => {
    const clips = Array.from({ length: 12 }, () => acto('inunda', 'clip', 'clip:A:branquias:W24'));
    return [...clips, ...citadores([clips[0].id])];
  }),
  escenario('Sólo hipótesis, nadie las usa', () => Array.from({ length: 12 }, () => acto('solohip', 'hipotesis', 'h'))),
  escenario('Anillo de 4 que se citan entre sí', () => {
    const miembros = ['r1', 'r2', 'r3', 'r4'];
    const hip = Object.fromEntries(miembros.map((m) => [m, [acto(m, 'hipotesis', 'h'), acto(m, 'hipotesis', 'h'), acto(m, 'hipotesis', 'h')]]));
    for (const m of miembros) for (const h of hip[m]) h.cita = miembros.filter((o) => o !== m).flatMap((o) => hip[o].map((x) => x.id));
    return miembros.flatMap((m) => hip[m]);
  }),
  escenario('Granja de reclutas (12 en un mes)', () => Array.from({ length: 12 }, (_, i) => ({ ...acto('granja', 'reclutado', 'r'), t: T0 + i * D }))),
];

const filas = [];
for (const e of escenarios) {
  const tabla = tablaPorPuntos(e.actos);
  for (const f of tabla) {
    if (/^p\d|^otra$/.test(f.detective)) continue;
    filas.push({ estrategia: e.nombre, detective: f.detective, actos: f.actos, puntos: +f.total.toFixed(2), porActo: +(f.total / f.actos).toFixed(2),
      base: +f.base.toFixed(2), reuso: +f.reuso.toFixed(2), apoyo: +f.apoyo.toFixed(2), reclutados: f.reclutados });
  }
}
if (process.argv[1]?.endsWith('simular-puntos.mjs') && process.argv.includes('--json')) console.log(JSON.stringify(filas, null, 2));
else if (process.argv[1]?.endsWith('simular-puntos.mjs')) console.table(filas);
export { filas };
