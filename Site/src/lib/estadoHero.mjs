// Which state the hero may show, decided from facts of the build only. Plain ESM, shared by lib/heroEstado.ts (the build) and
// scripts/check-hero-estado.mjs (the dist), so both judge the same snapshot and the same served files the same way.
//
// State A («verifiable onchain») needs all of:
//   - the attestation snapshot reads «coincide»;
//   - it was read within the last 7 days (leidoEl), and not in the future;
//   - every atlas data file the build serves came from a strict hub read: fuente 'hub' and paridadHub true;
//   - each file names the bundles it was built from, each in the snapshot's `cubre` with the same manifest hash (lib/paridadAtlas.mjs);
//   - the snapshot covers at least the species and the localities (lib/alcanceAtestacion.mjs).
// Anything else is state B. The scope of the onchain line («especies» or «atlas») comes from the snapshot either way.
import { alcance } from './alcanceAtestacion.mjs';
import { ARCHIVOS } from './atlasSnapshot.mjs';
import { paridad } from './paridadAtlas.mjs';

export const FRESCURA_DIAS = 7;
const DIA = 24 * 60 * 60 * 1000;
const HOLGURA = 60 * 60 * 1000; // clock skew allowed for a read «in the future»

/** When the snapshot was read (ms), or null if it does not say. */
export function leidoEl(snapshot) {
  const v = snapshot?.leidoEl ?? snapshot?.lectura?.leidoEl;
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
}

/**
 * The hero's state for this build; `leido` (ms) is set only in state A.
 * @returns {{ estado: 'A' | 'B', alcance: 'atlas' | 'especies', leido: number | null, problemas: string[] }}
 */
export function decidir({ snapshot, servidos, ahora }) {
  const problemas = [];
  const coincide = snapshot?.lectura?.resultado === 'coincide';
  if (!snapshot) problemas.push('no hay foto de la atestación (src/data/atestacion-atlas.json)');
  else if (!coincide) problemas.push(`la atestación no coincide (lectura: «${snapshot.lectura?.resultado ?? 'sin resultado'}»)`);

  const leido = leidoEl(snapshot);
  const fresca = leido !== null && leido <= ahora + HOLGURA && ahora - leido <= FRESCURA_DIAS * DIA;
  if (snapshot && !fresca) {
    problemas.push(leido === null ? 'la foto no dice cuándo se leyó (leidoEl)'
      : `la foto se leyó el ${new Date(leido).toISOString().slice(0, 10)}: fuera de los ${FRESCURA_DIAS} días antes del build`);
  }

  const delHub = ARCHIVOS.every((n) => servidos?.[n]?.fuente === 'hub' && servidos[n].paridadHub === true);
  const par = paridad(servidos, snapshot, { hub: true });
  if (coincide) {
    if (!delHub) problemas.push('no todos los archivos del atlas salen de una lectura estricta del hub (fuente «hub» y paridadHub)');
    problemas.push(...par.problemas);
  }

  const al = alcance(snapshot);
  if (coincide && al === null) problemas.push('la atestación no cubre las especies y las localidades');

  const a = coincide && fresca && delHub && par.ok && al !== null;
  return { estado: a ? 'A' : 'B', alcance: al ?? 'especies', leido: a ? leido : null, problemas: [...new Set(problemas)] };
}
