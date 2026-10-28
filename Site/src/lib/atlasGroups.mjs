// The groups of the atlas's layer panel, in the order they are listed. A card names its group in the manifest (`grupo`);
// a group with no card is not drawn (Contexto waits for its first layer).
export const GRUPOS = ['especies', 'instalaciones', 'agua', 'organizaciones', 'contexto'];

// The i18n key of each group's heading (src/lib/atlasText.ts).
export const CLAVE_DE_GRUPO = {
  especies: 'groupSpecies',
  instalaciones: 'groupFacilities',
  agua: 'groupWater',
  organizaciones: 'groupOrganizations',
  contexto: 'groupContext',
};

/** The cards of each group, groups in panel order, empty groups left out. A card of an unknown group is not dropped: it gets a group of its own at the end. */
export function agruparCapas(capas) {
  const orden = [...GRUPOS, ...[...new Set(capas.map((c) => c.grupo))].filter((g) => !GRUPOS.includes(g))];
  return orden.map((g) => ({ grupo: g, capas: capas.filter((c) => c.grupo === g) })).filter((x) => x.capas.length > 0);
}
