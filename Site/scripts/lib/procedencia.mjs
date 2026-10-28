// Which bundles each committed atlas data file is built from, written into the file as `generadoDe`: an object whose `bundles` is a list of { id, manifestSha256 }: the manifest.json sha256 of each bundle the file was built from (the values Contracts' attestation
// snapshot carries under `cubre`). The hero reads only `bundles`, and may claim «verificables onchain» only when they trace to the attested bundles; other keys an importer writes (dirs, git shas) stay beside it.
// The hub-read path carries the same object and, only when the hub answered with the committed file's data property by property, `paridadHub: true`.
export const PROCEDENCIA = {
  'especies-atlas.json': ['944f8dbc53b0-genero', '735c7b3021a1-perfiles', 'a1d128c4bf4c-morfometria', 'a1d128c4bf4c-localidades'],
  'especies-localidades.geojson': ['944f8dbc53b0-genero', 'a1d128c4bf4c-localidades'],
  'admin1.geojson': ['4216080f8b97-admin1'],
  'especies-por-estado.json': ['5e8591b04e51'],
  'estados-metricas.json': ['5e8591b04e51'],
  'instalaciones-catalogadas.geojson': ['5e8591b04e51'],
};
/** The `generadoDe` object of a file, resolved against the attestation snapshot's `cubre`; throws if a bundle is not covered. `previo` is what the file carried: its keys stay beside `bundles`. */
export function generadoDeDe(archivo, atestacion, previo = null) {
  const ids = PROCEDENCIA[archivo];
  if (!ids) throw new Error(`no provenance for ${archivo}`);
  const bundles = ids.map((id) => {
    const c = (atestacion.cubre ?? []).find((x) => x.id === id);
    if (!c || !/^0x[0-9a-f]{64}$/.test(c.manifestSha256 ?? '')) throw new Error(`${archivo}: the attestation does not cover ${id}`);
    return { id, manifestSha256: c.manifestSha256 };
  });
  const resto = previo && typeof previo === 'object' && !Array.isArray(previo) ? previo : {};
  return { ...resto, bundles };
}
