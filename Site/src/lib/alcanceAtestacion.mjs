// What the atlas attestation covers, read from the `cubre` and `noCubiertos` lists that Contracts' reader writes into
// src/data/atestacion-atlas.json. Shared by lib/heroEstado.ts and scripts/check-hero-estado.mjs,
// so the build and its check read coverage the same way.
//   - «atlas» only when `cubre` holds the six bundles the site reads and `noCubiertos` is empty: «el atlas» is never said of partial coverage;
//   - «especies» otherwise, the narrowest claim that stays true, which needs at least the species and the localities;
//   - null when the attestation covers neither, so no hero line may name it.

/** The six bundles the site reads, each recognised by its id (the layers bundle has no suffix; it is the one that loads `load:layers`). */
export const PAQUETES = {
  genero: (c) => c.id.endsWith('-genero'),
  localidades: (c) => c.id.endsWith('-localidades'),
  perfiles: (c) => c.id.endsWith('-perfiles'),
  morfometria: (c) => c.id.endsWith('-morfometria'),
  admin1: (c) => c.id.endsWith('-admin1'),
  capas: (c) => /(^|, )load:layers(,|$)/.test(c.datos ?? ''),
};

/** «atlas», «especies» or null, from an atestacion-atlas.json snapshot (or undefined when there is none). */
export function alcance(snapshot) {
  const cubre = Array.isArray(snapshot?.cubre) ? snapshot.cubre : [];
  // «nothing left out» must be stated as an empty list: a missing or malformed noCubiertos never allows «atlas»
  const ningunoFuera = Array.isArray(snapshot?.noCubiertos) && snapshot.noCubiertos.length === 0;
  const tiene = (nombre) => cubre.some(PAQUETES[nombre]);
  if (Object.keys(PAQUETES).every(tiene) && ningunoFuera) return 'atlas';
  if (tiene('genero') && tiene('localidades')) return 'especies';
  return null;
}
