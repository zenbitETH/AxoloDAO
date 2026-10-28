// Copies the OPEN layers of an open-data package (a Frictionless package with layers/, snapshots/ and tablas/) into the site, with the provenance each
// layer card shows.
//   node scripts/import-atlas-layers.mjs <package dir>     (or set ATLAS_OPEN_DATA_PACKAGE)
// Writes public/atlas/layers/{especies-por-estado,estados-metricas}.json, instalaciones-catalogadas.geojson and manifest.json.
// NC layers (umas-centroides, calidad-agua-2013) are never copied: the atlas reads them from the hub at runtime, behind a flag.
// No species occurrence points are ever written: the species layer is the PACE 2018 presence per state, a list of names.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILA_PILOTO } from './lib/fila-piloto.mjs';
import { tablaDeSinonimos } from '../src/lib/atlasSpecies.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dirArg = process.argv[2] ?? process.env.ATLAS_OPEN_DATA_PACKAGE;
if (!dirArg) throw new Error('usage: node scripts/import-atlas-layers.mjs <open-data package dir>');
const PKG = resolve(dirArg);
const OUT = join(SITE, 'public/atlas/layers');   // manifest.json and the layer cards' files: served as they are
const SNAPSHOT = join(SITE, 'src/data/atlas-snapshot');   // the three data files of the build snapshot: NOT served from here, the build writes them at /atlas/datos/
mkdirSync(SNAPSHOT, { recursive: true });
if (!existsSync(join(PKG, 'datapackage.json'))) throw new Error(`no open-data package at ${PKG}`);
mkdirSync(OUT, { recursive: true });

const readJson = (p) => JSON.parse(readFileSync(join(PKG, p), 'utf8'));
const dp = readJson('datapackage.json');
const clase = Object.fromEntries(dp['zenbit:capas'].map((c) => [c.capa, c.clase]));
for (const id of ['estados-metricas', 'instalaciones-catalogadas']) {
  if (clase[id] !== 'open') throw new Error(`layer ${id} is ${clase[id]}, not open: it cannot be committed`);
}
const snap = (t) => readJson(`snapshots/${t}.json`);
const day = (epoch) => new Date(epoch * 1000).toISOString().slice(0, 10);
const prov = (t, i = 0) => {
  const s = snap(t);
  return { lastDataText: s.sources[i]?.lastDataText ?? '', retrievedAt: day(s.retrievedAt), sourceIds: s.sources.map((x) => x.sourceId) };
};

// -- layer 1: species per state (PACE 2018 presence, names only)
const csv = (p) => {
  const [h, ...rows] = readFileSync(join(PKG, p), 'utf8').trim().split('\n');
  const cols = h.split(',');
  return rows.map((l) => {
    const out = []; let cur = '', q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur);
    return Object.fromEntries(cols.map((c, i) => [c, out[i]]));
  });
};
const porEstado = {};
for (const r of csv('tablas/pace2018_distribucion.csv')) {
  (porEstado[r.iso] ??= new Set()).add(r.nombre_cientifico);
}
const especies = { source: 'PACE Ambystoma 2018', estados: Object.fromEntries(Object.entries(porEstado).sort().map(([k, v]) => [k, [...v].sort()])) };
writeFileSync(join(SNAPSHOT, 'especies-por-estado.json'), JSON.stringify(especies) + '\n');

// -- layer 2: state metrics (already without the Trends series and the GBIF counts)
const em = readJson('layers/estados-metricas.json');
const TITULOS = {
  especies_ambystoma_pace: { es: 'Especies de Ambystoma (PACE 2018)', en: 'Ambystoma species (PACE 2018)', pt: 'Espécies de Ambystoma (PACE 2018)' },
  instalaciones_ajolote: { es: 'Instalaciones catalogadas con ajolote', en: 'Cataloged facilities with axolotls', pt: 'Instalações catalogadas com axolote' },
  pimvs_registrados_2021_2024: { es: 'PIMVS registrados 2021–2024', en: 'PIMVS registered 2021–2024', pt: 'PIMVS registrados 2021–2024' },
  uma_extensivas_registradas_1992_2024: { es: 'UMA extensivas registradas 1992–2024', en: 'Extensive UMAs registered 1992–2024', pt: 'UMAs extensivas registradas 1992–2024' },
  uma_intensivas_registradas_1999_2024: { es: 'UMA intensivas registradas 1999–2024', en: 'Intensive UMAs registered 1999–2024', pt: 'UMAs intensivas registradas 1999–2024' },
  uma_por_100k_hab: { es: 'UMA por 100 mil habitantes', en: 'UMAs per 100,000 inhabitants', pt: 'UMAs por 100 mil habitantes' },
};
const ids = Object.keys(em._meta.metricas);
for (const id of ids) if (!TITULOS[id]) throw new Error(`metric ${id} has no card title`);
const metricas = { metricas: ids.map((id) => ({ id, title: TITULOS[id], fuente_id: em._meta.metricas[id].fuente_id })),
  estados: Object.fromEntries(Object.entries(em.estados).map(([iso, v]) => [iso, Object.fromEntries(['cve_ent', 'nombre', ...ids].map((k) => [k, v[k]]))])) };
writeFileSync(join(SNAPSHOT, 'estados-metricas.json'), JSON.stringify(metricas) + '\n');

// -- layer 3: cataloged facilities. Municipality level, never an exact location (the legal ruling of 7 Oct): every point is the INEGI centroid of its
// municipality (or of its state when the row has no municipality), joined on cve_ent + cve_mun, and the importer compares each one with the INEGI table that
// travels in the package before it writes anything. An allowlist of properties: a free-text note or a coordinate source never goes out.
const PERMITIDAS = ['id', 'nombre', 'tipo_recinto', 'tipo_legal', 'tipo_legal_fuente', 'iso', 'cve_ent', 'cve_mun', 'municipio', 'estado', 'nivel', 'especies', 'exhibicion_publica',
  'estado_operacion', 'estado_fecha', 'verificacion'];
const CENTROIDES_CSV = 'geografia/centroides-inegi.csv';
if (!existsSync(join(PKG, CENTROIDES_CSV))) throw new Error(`the package carries no INEGI centroid table (${CENTROIDES_CSV}): the facilities layer cannot be checked`);
const parseCsv = (texto) => {
  const filas = []; let fila = [], campo = '', comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else comillas = false; } else campo += c; }
    else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  const [cab, ...resto] = filas;
  return resto.filter((f) => f.length === cab.length).map((f) => Object.fromEntries(cab.map((k, i) => [k, f[i]])));
};
const inegi = parseCsv(readFileSync(join(PKG, CENTROIDES_CSV), 'utf8'));
const centroide = new Map(inegi.map((r) => [`${r.cve_ent}|${r.cve_mun}`, r]));
const inst = readJson('layers/instalaciones-catalogadas.json');
const features = inst.features.map((f) => {
  const p = f.properties;
  const c = centroide.get(`${p.cve_ent}|${p.cve_mun ?? ''}`);
  if (!c) throw new Error(`facility ${p.id}: no INEGI centroid for ${p.cve_ent}/${p.cve_mun}`);
  const estadoInegi = centroide.get(`${p.cve_ent}|`);
  if (!estadoInegi || p.estado !== estadoInegi.nombre || (p.cve_mun ? p.municipio !== c.nombre : (p.municipio ?? '') !== '')) {
    throw new Error(`facility ${p.id}: its municipality and state labels are not INEGI's names for ${p.cve_ent}/${p.cve_mun}`);
  }
  if (p.nivel !== (p.cve_mun ? 'municipio' : 'estado')) throw new Error(`facility ${p.id}: level ${p.nivel} does not match its municipality code`);
  if (f.geometry.type !== 'Point' || f.geometry.coordinates[0] !== Number(c.lon) || f.geometry.coordinates[1] !== Number(c.lat)) {
    throw new Error(`facility ${p.id}: its point is not the INEGI centroid of its ${p.nivel}`);
  }
  if (p.id === FILA_PILOTO.id) {
    if (p.estado_operacion !== 'cerrado') throw new Error(`facility ${p.id}: the pilot row is public only as a closed row`);
    const pub = { ...p, nombre: FILA_PILOTO.nombre, estado_fecha: FILA_PILOTO.estado_fecha };
    return { type: 'Feature', geometry: { type: 'Point', coordinates: [Number(c.lon), Number(c.lat)] }, properties: Object.fromEntries(FILA_PILOTO.conservar.map((k) => [k, pub[k] ?? ''])) };
  }
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [Number(c.lon), Number(c.lat)] }, properties: Object.fromEntries(PERMITIDAS.map((k) => [k, p[k] ?? ''])) };
});
writeFileSync(join(SNAPSHOT, 'instalaciones-catalogadas.geojson'), JSON.stringify({ type: 'FeatureCollection', features }) + '\n');
// the INEGI table is also the fixture the site's test compares every committed point with: codes and centroid only. The place NAMES are not copied (a municipality can share a person's first name, and
// the names people read live in the committed layer, which the test checks for consistency instead)
mkdirSync(join(SITE, 'scripts/fixtures'), { recursive: true });
{
  const [cab, ...resto] = parseCsv(readFileSync(join(PKG, CENTROIDES_CSV), 'utf8'));
  const sin = cab.indexOf('nombre');
  const campo = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  writeFileSync(join(SITE, 'scripts/fixtures/centroides-inegi.csv'), [cab, ...resto].filter((f) => f.length === cab.length).map((f) => f.filter((_, i) => i !== sin).map(campo).join(',')).join('\n') + '\n');
}

// -- the card of every layer, from the package's provenance; NC layers are listed here with their text and never with data
const L = (es, en, pt) => ({ es, en, pt });
// the notice of the facilities table travels in the package (the table's `zenbit:pageNote`); it is shown as written, in every language
const avisoInstalaciones = dp.resources.find((r) => r.name === 'instalaciones')?.['zenbit:pageNote'];
if (!avisoInstalaciones) throw new Error('the package carries no page note for the facilities table');
const AVISO = L(avisoInstalaciones, avisoInstalaciones, avisoInstalaciones);
const pace = prov('pace2018_distribucion'), uma = prov('umas_agregado'), pop = prov('poblacion_entidades'), ins = prov('instalaciones'), umaNc = prov('umas_predios'), agua = prov('calidad_agua_sitios');
// the species and context cards carry no package provenance: they date from the genus atlas snapshot this build was made with
const ESPECIES_FECHA = { lastDataText: 'varía por fuente', retrievedAt: '2026-10-16' };
// The synonym table comes ONLY from the genus bundle's taxon_synonyms (the atlas follows PACE 2018, not EncicloVida or ASW): a synonym name «Ambystoma <epithet>» of a taxon the atlas lists, when that epithet is not itself one of the atlas's species. A facility row that names one is shown as its accepted species; a name that IS an atlas species (granulosum, taylori) never maps to another.
const GENERO = '944f8dbc53b0-genero';
const ENTIDADES = process.env.ATLAS_ENTITIES_DIR ?? join(homedir(), '.cache', 'axolodao-datos', 'open', 'entities');
const leerGenero = (nombre) => {
  const f = join(ENTIDADES, GENERO, nombre);
  const manifestoGenero = JSON.parse(readFileSync(join(ENTIDADES, GENERO, 'manifest.json'), 'utf8'));
  const bytes = readFileSync(f);
  const entrada = manifestoGenero.files.find((x) => x.path === nombre);
  const sha = `0x${createHash('sha256').update(bytes).digest('hex')}`;
  if (!entrada || sha !== entrada.sha256) throw new Error(`${GENERO}/${nombre}: sha256 ${sha} is not the bundle manifest's`);
  return bytes.toString('utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
};
const taxaGenero = leerGenero('taxa.jsonl');
const sinonimos = tablaDeSinonimos(taxaGenero, leerGenero('taxon_synonyms.jsonl'));
const manifest = {
  generadoDe: 'open-data-2026-10',
  sinonimos,
  capas: [
    // the species cards (2026-10-16): richness and localities come from the genus atlas (the hub's /v1/species routes, or the committed snapshot), not from the PACE file; each record cites its own source
    { id: 'especies-por-estado', grupo: 'especies', kind: 'choropleth', lazy: false, flag: null, download: false,
      title: L('Riqueza de especies por estado y provincia', 'Species richness by state and province', 'Riqueza de espécies por estado e província'),
      note: L('Cuántas especies de Ambystoma tienen registro confirmado en cada estado o provincia de México, Estados Unidos y Canadá.', 'How many Ambystoma species have a confirmed record in each state or province of Mexico, the United States and Canada.', 'Quantas espécies de Ambystoma têm registro confirmado em cada estado ou província do México, dos Estados Unidos e do Canadá.'),
      source: L('Base de especies de AxoloDAO (Zenbit): cada registro cita su fuente', 'AxoloDAO species base (Zenbit): each record cites its source', 'Base de espécies da AxoloDAO (Zenbit): cada registro cita a sua fonte'),
      licence: { id: 'LicenseRef-fuente-de-cada-registro', label: L('La de cada fuente; cada registro la cita', 'That of each source; each record cites it', 'A de cada fonte; cada registro a cita') },
      lastDataText: ESPECIES_FECHA.lastDataText, retrievedAt: ESPECIES_FECHA.retrievedAt, sourceIds: [] },
    { id: 'localidades-especies', grupo: 'especies', kind: 'localities', lazy: false, flag: null, download: false,
      title: L('Localidades de las especies', 'Species localities', 'Localidades das espécies'),
      note: L('Zonas y puntos generalizados a celdas de 0.5° (unos 50 km), nunca una coordenada exacta. Un color por especie.', 'Zones and points generalized to 0.5° cells (about 50 km), never an exact coordinate. One colour per species.', 'Zonas e pontos generalizados em células de 0,5° (cerca de 50 km), nunca uma coordenada exata. Uma cor por espécie.'),
      source: L('Base de especies de AxoloDAO (Zenbit): cada localidad cita su fuente', 'AxoloDAO species base (Zenbit): each locality cites its source', 'Base de espécies da AxoloDAO (Zenbit): cada localidade cita a sua fonte'),
      licence: { id: 'LicenseRef-fuente-de-cada-registro', label: L('La de cada fuente; cada registro la cita', 'That of each source; each record cites it', 'A de cada fonte; cada registro a cita') },
      lastDataText: ESPECIES_FECHA.lastDataText, retrievedAt: ESPECIES_FECHA.retrievedAt, sourceIds: [] },
    { id: 'metrica-estatal', grupo: 'instalaciones', kind: 'choropleth', lazy: false, flag: null, download: false,
      title: L('Una métrica por estado', 'One metric per state', 'Uma métrica por estado'),
      note: L('UMA, PIMVS, instalaciones catalogadas y especies, por estado.', 'UMAs, PIMVS, cataloged facilities and species, by state.', 'UMAs, PIMVS, instalações catalogadas e espécies, por estado.'),
      source: L('SEMARNAT (BADESNIARN), INEGI (Censo 2020) y PACE 2018', 'SEMARNAT (BADESNIARN), INEGI (Census 2020) and PACE 2018', 'SEMARNAT (BADESNIARN), INEGI (Censo 2020) e PACE 2018'),
      licence: { id: 'LicenseRef-semarnat-badesniarn-biodiv', label: L('SEMARNAT: datos estadísticos públicos, con su fuente · INEGI: Términos de libre uso, con cita', 'SEMARNAT: public statistical data, with its source · INEGI: Terms of Free Use, with attribution', 'SEMARNAT: dados estatísticos públicos, com a fonte · INEGI: Termos de Livre Uso, com citação') },
      ...uma, lastDataText: `${uma.lastDataText} (UMA, PIMVS); ${pop.lastDataText} (población)` },
    { id: 'instalaciones-catalogadas', grupo: 'instalaciones', kind: 'points', lazy: false, flag: null, download: false,
      title: L('Instalaciones catalogadas', 'Cataloged facilities', 'Instalações catalogadas'),
      note: L('Catalogadas desde fuentes públicas; no es un registro ni una verificación. Cada ícono marca el municipio (o el estado), no la dirección.', 'Cataloged from public sources; this is not a registry or a verification. Each icon marks the municipality (or the state), not the address.', 'Catalogadas a partir de fontes públicas; não é um registro nem uma verificação. Cada ícone marca o município (ou o estado), não o endereço.'),
      aviso: AVISO,
      source: L('Páginas oficiales y de prensa y SIC Cultura; ubicación: INEGI, Marco Geoestadístico', 'Official and press pages and SIC Cultura; location: INEGI, Marco Geoestadístico', 'Páginas oficiais e de imprensa e SIC Cultura; localização: INEGI, Marco Geoestadístico'),
      licence: { id: 'CC-BY-4.0', label: L('CC BY 4.0, la licencia de la compilación de Zenbit; cada fuente conserva sus derechos', 'CC BY 4.0, the licence of Zenbit\'s compilation; each source keeps its own rights', 'CC BY 4.0, a licença da compilação da Zenbit; cada fonte mantém seus direitos') },
      attribution: L('Ubicación al nivel del municipio: INEGI, Marco Geoestadístico, diciembre de 2025.', 'Location at municipality level: INEGI, Marco Geoestadístico, December 2025.', 'Localização no nível do município: INEGI, Marco Geoestadístico, dezembro de 2025.'),
      ...ins },
    { id: 'uma-extensivas', grupo: 'instalaciones', kind: 'points', lazy: true, flag: 'nc', download: false, hubLayer: 'umas-centroides',
      title: L('UMA extensivas', 'Extensive UMAs', 'UMAs extensivas'),
      note: L('Centroides de las UMA extensivas registradas; sin nombres de predio.', 'Centroids of registered extensive UMAs; no property names.', 'Centroides das UMAs extensivas registradas; sem nomes de propriedades.'),
      source: L('CONABIO, UMA 2020', 'CONABIO, UMA 2020', 'CONABIO, UMA 2020'),
      licence: { id: 'CC-BY-NC-2.5-MX', label: L('CC BY-NC 2.5 MX', 'CC BY-NC 2.5 MX', 'CC BY-NC 2.5 MX') }, attribution: L('Fuente: CONABIO, UMA, 2020. Licencia CC BY-NC 2.5 MX', 'Source: CONABIO, UMA, 2020. License CC BY-NC 2.5 MX', 'Fonte: CONABIO, UMA, 2020. Licença CC BY-NC 2.5 MX'),
      ...umaNc },
    // rivers and lakes: Natural Earth context drawn from the atlas data package (public/atlas/real/agua.geojson), public domain; wording en/pt: the communications team, the communications repository fe84e42
    { id: 'rios-lagos', grupo: 'agua', kind: 'context', lazy: false, flag: null, download: false,
      title: L('Ríos y lagos', 'Rivers and lakes', 'Rios e lagos'),
      note: L('Los ríos y los cuerpos de agua de Norteamérica, como contexto de las áreas.', 'North America\'s rivers and water bodies, as context for the ranges.', 'Os rios e corpos de água da América do Norte, como contexto das áreas.'),
      source: L('Natural Earth, ríos y lagos de Norteamérica (paquete de datos del atlas)', 'Natural Earth, rivers and lakes of North America (atlas data package)', 'Natural Earth, rios e lagos da América do Norte (pacote de dados do atlas)'),
      licence: { id: 'PD', label: L('Dominio público', 'Public domain', 'Domínio público') },
      lastDataText: 'Natural Earth', retrievedAt: '2026-10-18' },
    { id: 'sitios-conagua-2013', grupo: 'agua', kind: 'points', lazy: true, flag: 'nc', download: false, hubLayer: 'calidad-agua-2013',
      title: L('Sitios de calidad del agua (2013)', 'Water quality sites (2013)', 'Pontos de qualidade da água (2013)'),
      note: L('Clases de 2013, no lecturas actuales.', 'Classes from 2013, not current readings.', 'Classes de 2013, não leituras atuais.'),
      source: L('CONABIO, calidad del agua en sitios 2013', 'CONABIO, water quality at sites 2013', 'CONABIO, qualidade da água em locais 2013'),
      licence: { id: 'CC-BY-NC-2.5-MX', label: L('CC BY-NC 2.5 MX', 'CC BY-NC 2.5 MX', 'CC BY-NC 2.5 MX') }, attribution: L('Fuente: CONABIO, calidad del agua, 2013. Licencia CC BY-NC 2.5 MX', 'Source: CONABIO, water quality, 2013. License CC BY-NC 2.5 MX', 'Fonte: CONABIO, qualidade da água, 2013. Licença CC BY-NC 2.5 MX'),
      ...agua },
    { id: 'organizaciones-registradas', grupo: 'instalaciones', kind: 'live', lazy: false, flag: null, download: false,
      title: L('Organizaciones registradas', 'Registered organizations', 'Organizações registradas'),
      note: L('Las registradas (en rosa) se distinguen de las instalaciones catalogadas, que son candidatas; cada una muestra su nivel de verificación.', 'Registered organizations (in pink) are shown apart from cataloged facilities, which are candidates; each shows its verification level.', 'As organizações registradas (em rosa) aparecem separadas das instalações catalogadas, que são candidatas; cada uma mostra seu nível de verificação.'),
      source: L('Registro de organizaciones de AxoloDAO', 'AxoloDAO organization registry', 'Registro de organizações da AxoloDAO'),
      licence: { id: 'LicenseRef-axolodao-registro', label: L('Datos que cada organización decide publicar', 'Data each organization chooses to publish', 'Dados que cada organização decide publicar') },
      lastDataText: '', retrievedAt: '', sourceIds: [] },
    { id: 'limites-admin1', grupo: 'contexto', kind: 'context', lazy: false, flag: null, download: false,
      title: L('Límites de estado y provincia', 'State and province boundaries', 'Limites de estados e províncias'),
      note: L('Los límites de las 96 unidades del mapa.', 'The boundaries of the 96 units on the map.', 'Os limites das 96 unidades do mapa.'),
      source: L('Natural Earth, 1:10m', 'Natural Earth, 1:10m', 'Natural Earth, 1:10m'),
      licence: { id: 'LicenseRef-public-domain', label: L('Dominio público', 'Public domain', 'Domínio público') },
      lastDataText: 'v5.1.1', retrievedAt: ESPECIES_FECHA.retrievedAt, sourceIds: [] },
  ],
};
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(`atlas layers from ${PKG}: ${features.length} facilities, ${Object.keys(especies.estados).length} states with species, ${ids.length} metrics, ${manifest.capas.length} cards`);
