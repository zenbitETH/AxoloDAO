// State A also needs the served atlas data to be the attested data. The attestation fingerprints six hub bundles; the hero
// may say so only when every file the build serves under /atlas/datos/ says which bundles it was built from, and each of those is in the
// snapshot's `cubre` with the same manifest hash. Shared by lib/heroEstado.ts and scripts/check-hero-estado.mjs.
//
// Provenance, on every atlas data file (written by the atlas import):
//   generadoDe: { bundles: [{ id: '<bundle id>', manifestSha256: '0x<sha256 of its manifest.json>' }, ...] }
// In a build that reads the hub, every file must also carry `paridadHub: true`, which the import's strict mode writes only when the hub
// answered with the same bytes as those bundles.
import { ARCHIVOS } from './atlasSnapshot.mjs';

const HASH = /^0x[0-9a-f]{64}$/;

/** { ok, problemas } for the served atlas files ({ nombre: datos }) against the snapshot's `cubre`; `hub` is true in a build that reads the hub. */
export function paridad(archivos, snapshot, { hub = false } = {}) {
  const cubre = new Map((Array.isArray(snapshot?.cubre) ? snapshot.cubre : []).map((c) => [c.id, String(c.manifestSha256 ?? '').toLowerCase()]));
  const problemas = [];
  for (const nombre of ARCHIVOS) {
    const datos = archivos?.[nombre];
    if (!datos || typeof datos !== 'object') { problemas.push(`${nombre}: el build no lo sirve`); continue; }
    const bundles = datos.generadoDe?.bundles;
    if (!Array.isArray(bundles) || bundles.length === 0) { problemas.push(`${nombre}: no dice de qué bundles sale (generadoDe.bundles)`); continue; }
    for (const b of bundles) {
      const hash = String(b?.manifestSha256 ?? '').toLowerCase();
      if (typeof b?.id !== 'string' || !HASH.test(hash)) problemas.push(`${nombre}: una procedencia sin id o sin manifestSha256`);
      else if (!cubre.has(b.id)) problemas.push(`${nombre}: sale de ${b.id}, que la atestación no cubre`);
      else if (cubre.get(b.id) !== hash) problemas.push(`${nombre}: sale de ${b.id} con otro manifiesto que el atestado`);
    }
    if (hub && datos.paridadHub !== true) problemas.push(`${nombre}: el build lee el hub y la paridad con el hub no pasó (paridadHub)`);
  }
  return { ok: problemas.length === 0, problemas };
}
