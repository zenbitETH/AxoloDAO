// Checks of the /atlas page, its data and its licence rules.
//   node scripts/test-atlas.mjs                 static checks: base geometry, style, layer cards, licence and geometry rules, registry fallback
//   node scripts/test-atlas.mjs --dist          also the built site (run `npm run build` first): pages, freshness chip, bundle budget, nothing NC shipped
//   node scripts/test-atlas.mjs --dist --browser  also a real browser on the built site (Chrome or Chromium, found via CHROME_PATH or the usual places)
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseStyle, urlsDelEstilo } from '../src/lib/atlasStyle.mjs';
import { filasDeInstalaciones, lugarDeInstalacion } from '../src/lib/atlasPlace.mjs';
import { capasDelRegistro, geojsonDeCapa, liveOrBuild, organizacionesComoPuntos, organizacionesEnVivo } from '../src/lib/hubLive.mjs';
import { agruparCapas, CLAVE_DE_GRUPO, GRUPOS } from '../src/lib/atlasGroups.mjs';
import { validarLocalidades, tablaDeSinonimos } from '../src/lib/atlasSpecies.mjs';
import { geometriasCrudas } from '../src/lib/atlasGenus.mjs';
import { PROCEDENCIA, generadoDeDe } from './lib/procedencia.mjs';
import { leerAtlas, hubDelBuild } from '../src/lib/atlasLectura.mjs';
import { puntosDeLocalidades, fuentesDePuntos, componentes, celdasDe } from '../src/lib/atlasSpecies.mjs';
import { buscarLocal } from './lib/direccionesLocales.mjs';
import { problemasDeLaConstruccion } from './pre-push-huella.mjs';
import { arbolSucio, motivoParaNoConstruir, problemasDeLaConstruccionDelSitio } from './lib/construccionSitio.mjs';
import { conClave } from '../src/lib/hubClave.mjs';
import { leerListado, copiarHuella, verificarHuella, archivosNc, paginaIndice, NOMBRE_SITIO } from './lib/huella.mjs';
import { problemasDeLaHuella } from './pre-push-huella.mjs';
import { diferencias, METRICAS_ARCHIVO } from '../src/lib/atlasParidad.mjs';
import { FILA_PILOTO } from './lib/fila-piloto.mjs';
import { ESCALA_UICN, ESCALA_NOM, estadoUicn, estadoNom, estatusNacionales, contraste, colorDeTexto } from '../src/lib/estatusEscala.mjs';
import { lineaDeCierre } from '../src/lib/instalacionesCierre.mjs';
const IUCN_COLORS_T = { EX: '#666', EW: '#888', CR: '#E85D75', EN: '#D4925F', VU: '#F4E8C8', NT: '#9CCC9C', LC: '#009C9C', DD: '#888', NE: '#666' };   // src/components/species/strings.ts, checked equal below
import { validarCreditos, partesDeCredito } from '../src/lib/creditosImagenes.mjs';
import { ARCHIVOS, archivosDelSitio, instantanea, PERMITIDAS as PERMITIDAS_SNAPSHOT } from '../src/lib/atlasSnapshot.mjs';
import { ICONOS } from '../src/lib/iconosInstalaciones.mjs';
import { abanico as abanicoDe, separar, prepararInstalaciones, instalacionesDeEspecie } from '../src/lib/atlasInstalaciones.mjs';
import { abanico as guardiaAbanico, sinPin, centroide as guardiaCentroide, precision as guardiaPrecision, csvDeCentroides } from './lib/guardia-instalaciones.mjs';
import { COPIAS as COPIAS_PILOTO } from './fixtures/piloto-de-prueba.mjs';
import { JPEG_PLANTADO, rastroEnBytes } from './lib/barridoBinario.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// a served object against a committed file: the committed file's `bundles` claim and the `fuente` stamp are what a fallback legitimately drops or sets
const sinSello = (o) => { const { fuente: _f, generadoDe, paridadHub: _p, ...resto } = o; const { bundles: _b, origen: _o, ...gd } = generadoDe ?? {}; return JSON.stringify({ ...resto, generadoDe: generadoDe ? gd : undefined }); };
const args = new Set(process.argv.slice(2));
let fails = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails++; };
const json = (p) => JSON.parse(readFileSync(join(SITE, p), 'utf8'));

// ---------------------------------------------------------------------------------------------
console.log('build rules: local addresses, the environment, the tree, the built folder');
{
  const si = ['http://127.0.0.1:4480', 'http://localhost:4480', 'http://0.0.0.0:80', 'http://[::1]:4480', 'http://192.168.1.4/x', 'http://10.1.2.3/x', '10.1.2.3:4480', '172.20.0.5:8080', 'http://mac.local/x', '/home/ana/proyecto/x', '/Users/ejemplo/x', '/var/folders/zz/T', '/Users/ejemplo/.claude/jobs/x', 'C:\\Users\\ana'];
  const no = ['10.5.3.2', '19.4326, -99.1332', 'version 1.2.3.4', 'file://', 'https://hub.zenbit.example/v1', 'localidades', 'especies-por-estado'];
  const malSi = si.filter((t) => !buscarLocal(t)), malNo = no.filter((t) => buscarLocal(t));
  ok(malSi.length === 0 && malNo.length === 0, `review 5: the local-address pattern catches loopback, 0.0.0.0, ::1, private IPv4 with a scheme or port, .local hosts and machine paths, and lets coordinates, versions and a bare «file://» pass${malSi.length ? ' (missed: ' + malSi.join(', ') + ')' : ''}${malNo.length ? ' (false: ' + malNo.join(', ') + ')' : ''}`);
  ok(motivoParaNoConstruir({}) !== null && /HUB_BUILD_URL/.test(motivoParaNoConstruir({})) && /ATLAS_HUB_LAXO/.test(motivoParaNoConstruir({ HUB_BUILD_URL: 'http://127.0.0.1:4480', ATLAS_HUB_LAXO: '1' })) && /PUBLIC_HUB_URL/.test(motivoParaNoConstruir({ HUB_BUILD_URL: 'http://127.0.0.1:4480', PUBLIC_HUB_URL: 'http://127.0.0.1:4480' })) && motivoParaNoConstruir({ HUB_BUILD_URL: 'http://127.0.0.1:4480' }) === null && motivoParaNoConstruir({}, { prueba: true }) === null && /PUBLIC_HUB_URL/.test(motivoParaNoConstruir({ PUBLIC_HUB_URL: 'http://localhost:1' }, { prueba: true })), 'C3: the environment: no hub URL, the lax switch, or a local public URL refuse; a strict hub URL passes; --prueba skips only the hub rule');
  const rep = mkdtempSync(join(tmpdir(), 'arbol-')); const g = (...a) => execFileSync('git', a, { cwd: rep, stdio: 'pipe' });
  g('init', '-q'); g('config', 'user.email', 'a@example.invalid'); g('config', 'user.name', 'x'); writeFileSync(join(rep, 'a.txt'), 'x'); g('add', '-A'); g('commit', '-q', '-m', 'x');
  const limpio = arbolSucio(rep).length === 0; writeFileSync(join(rep, 'nuevo.txt'), 'y'); const conNuevo = arbolSucio(rep); writeFileSync(join(rep, 'a.txt'), 'cambiado');
  ok(limpio && conNuevo.length === 1 && arbolSucio(rep).length === 2, 'review 11: a dirty tree is refused: an untracked file counts, and so does a change to a tracked one');
  rmSync(rep, { recursive: true, force: true });
  // the built folder must prove the strict read: each of the six files hub + paridadHub + bundles; a fallback file, a missing flag or a local address fails
  const out = mkdtempSync(join(tmpdir(), 'dist-')); mkdirSync(join(out, 'atlas/datos'), { recursive: true });
  const escribe = (a, o) => writeFileSync(join(out, 'atlas/datos', a), JSON.stringify(o));
  for (const a of ARCHIVOS) escribe(a, { fuente: 'hub', paridadHub: true, generadoDe: { bundles: [{ id: 'x', manifestSha256: '0x1' }] } });
  // and the pilot's three files, as build:sitio writes them (their public projection)
  mkdirSync(join(out, 'atlas/real'), { recursive: true }); for (const [n, bytes] of COPIAS_PILOTO()) writeFileSync(join(out, 'atlas/real', n), bytes);
  ok(problemasDeLaConstruccionDelSitio(out).length === 0, 'C3: a dist whose six files are hub + paridadHub + bundles passes the post-build check');
  escribe('admin1.geojson', { fuente: 'archivo', generadoDe: { bundles: [{ id: 'x' }] } }); escribe('estados-metricas.json', { fuente: 'hub', paridadHub: true, generadoDe: {} });
  const pb = problemasDeLaConstruccionDelSitio(out);
  ok(pb.some((m) => /admin1\.geojson: fuente is "archivo"/.test(m)) && pb.some((m) => /admin1\.geojson: paridadHub is not true/.test(m)) && pb.some((m) => /estados-metricas\.json: generadoDe\.bundles is missing/.test(m)) && problemasDeLaConstruccionDelSitio(out, { prueba: true }).every((m) => !/fuente|paridadHub/.test(m)), 'C3: after the build, a file that is not «hub», has no paridadHub or no bundles fails the build (not in a --prueba build)');
  rmSync(out, { recursive: true, force: true });
}
console.log('hook, status rules, closed popup, huella title');
{
  // C1: the hook is in the repository and calls the check (the scratch copy of the site has no repository around it: skipped there)
  let top = null; try { top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: SITE, stdio: 'pipe' }).toString().trim(); } catch { /* scratch */ }
  if (top) { const h = join(top, '.githooks/pre-push'); ok(existsSync(h) && (statSync(h).mode & 0o111) !== 0 && /pre-push-huella\.mjs" --hook "\$@"/.test(readFileSync(h, 'utf8')) && execFileSync('git', ['config', '--get', 'core.hooksPath'], { cwd: SITE }).toString().trim() === '.githooks', 'C1: .githooks/pre-push is executable, runs pre-push-huella --hook with git\'s arguments, and core.hooksPath points at it'); }
  else console.log('  · C1 hook file: skipped (no repository around this copy)');
  // review 13: an official NOM code the scale does not know is shown as itself
  const nomX = estadoNom([{ system: 'nom059', category: 'X' }]);
  ok(nomX.desconocida === 'X' && nomX.llena === null && nomX.noListada === false && estadoNom([]).desconocida === null && estadoNom([{ system: 'nom059', category: 'P' }]).desconocida === null, 'review 13: an official NOM code outside {E, P, A, Pr} is the raw code, never «not listed»');
  const coloresReales = Object.fromEntries([...readFileSync(join(SITE, 'src/components/species/strings.ts'), 'utf8').match(/IUCN_COLORS[^{]*\{([^}]*)\}/)[1].matchAll(/(\w+): '(#[0-9A-Fa-f]+)'/g)].map((m) => [m[1], m[2]]));
  ok(JSON.stringify(coloresReales) === JSON.stringify(IUCN_COLORS_T), 'the colours the contrast test uses are the ones strings.ts defines');
  const compEsc = readFileSync(join(SITE, 'src/components/atlas/EscalaEstatus.tsx'), 'utf8');
  ok(/n\.desconocida \? n\.desconocida : ui\.notListed/.test(compEsc), 'review 13: the sheet prints that raw code');
  // review 17: the text on a filled segment reads at 4.5:1 or more, for every IUCN and NOM colour
  const colores = { ...IUCN_COLORS_T, E: IUCN_COLORS_T.EX, P: IUCN_COLORS_T.CR, A: IUCN_COLORS_T.EN, Pr: IUCN_COLORS_T.VU };
  const bajos = Object.entries(colores).filter(([, c]) => contraste(c, colorDeTexto(c)) < 4.5).map(([k, c]) => `${k} ${c} ${contraste(c, colorDeTexto(c)).toFixed(2)}`);
  ok(bajos.length === 0 && contraste('#666', '#031a20') < 4.5 && colorDeTexto('#666') === '#ffffff', `review 17: filled-segment text is at least 4.5:1 on every status colour (EX #666 was 3.1 with the dark ink; it takes white now)${bajos.length ? ' (low: ' + bajos.join(', ') + ')' : ''}`);
  ok(/color: colorDeTexto\(p\.color\(c\)\)/.test(compEsc), 'review 17: the bar sets that colour on the filled segment');
  // item 1: the national statuses
  const nac = estatusNacionales(JSON.parse(readFileSync(join(SITE, 'src/data/atlas-snapshot/especies-atlas.json'), 'utf8')).especies.find((s) => s.slug === 'californiense').categories);
  ok(nac.length === 1 && nac[0].sistema === 'esa' && nac[0].codigos.join() === 'T,E' && nac[0].fuente === 'ecos-fws', 'item 1: californiense\'s three ESA rows (T, E, E) make one «Estatus nacional» entry: ESA T, E with its source');
  const mav = estatusNacionales(JSON.parse(readFileSync(join(SITE, 'src/data/atlas-snapshot/especies-atlas.json'), 'utf8')).especies.find((s) => s.slug === 'mavortium').categories);
  ok(mav.map((x) => x.sistema).join() === 'esa,sara,cosewic' && !readFileSync(join(SITE, 'src/components/atlas/DetailDrawer.tsx'), 'utf8').includes('const nacional = (() =>'), 'item 1: ESA, SARA and COSEWIC in that order; the dead «nacional» code is gone');
  // item 25: a closed facility without a date still gets the closed line
  ok(lineaDeCierre({ estado_fecha: '2026-09-22' }, 'cerrado', (f) => `m(${f})`) === 'cerrado · m(2026-09-22)' && lineaDeCierre({ estado_fecha: null }, 'cerrado', () => 'x') === 'cerrado' && lineaDeCierre({}, 'closed', () => 'x') === 'closed' && /estado_operacion === 'cerrado'\) \{/.test(readFileSync(join(SITE, 'src/components/atlas/Atlas.tsx'), 'utf8')), 'item 25: a closed row without estado_fecha gets «cerrado» alone, and the popup branch no longer requires a date');
  // the huella title follows the layout's rule
  const nombreLayout = /SITE_NAME = '([^']+)'/.exec(readFileSync(join(SITE, 'src/layouts/BaseLayout.astro'), 'utf8'))?.[1];
  ok(nombreLayout === NOMBRE_SITIO && /<title>Huella de los datos del atlas — AxoloDAO<\/title>/.test(paginaIndice({ bundles: [{ id: 'a-b1', manifest: '0' }], archivos: [] }, new Map())), 'the huella page title gets « — AxoloDAO» like the other atlas pages, from the same name as the layout');
  // item 21: the Spanish-only card says so
  ok(/<aside id="at-carta" lang="es"/.test(readFileSync(join(SITE, 'src/components/atlas/TarjetaOrg.tsx'), 'utf8')), 'item 21: the Spanish-only organisation card carries lang="es" on its <aside>');
  // item 16: the small links are at least 24 px
  const css = readFileSync(join(SITE, 'src/components/atlas/atlas.css'), 'utf8');
  ok(/\.at-efte \{[^}]*min-height: 24px/.test(css) && /\.at-xt-enlace \{[^}]*min-height: 24px/.test(css), 'item 16: «fuente» and the card\'s count/«ver» links are at least 24 px tall (also measured in the browser)');
  // the review-only note is hidden in the public builds
  ok(/!p\.ocultarRevision && area\?\.properties\.method === 'gbif_envelope'/.test(readFileSync(join(SITE, 'src/components/atlas/Legend.tsx'), 'utf8')) && /ocultarRevision=\{STAND \|\| SITIO\}/.test(readFileSync(join(SITE, 'src/components/atlas/Atlas.tsx'), 'utf8')), 'founder: «Sólo para revisión: no se publica todavía» is not shown in the public builds');
}
console.log('the map\'s localities come from the attested file');
{
  const at = json('src/data/atlas-snapshot/especies-localidades.geojson');
  const pts = puntosDeLocalidades(at);
  const cells = at.features.filter((f) => f.geometry.type === 'Polygon').length;
  const lagos = pts.features.filter((f) => f.properties.kind === 'lake').map((f) => `${f.properties.slug}:${f.properties.name}`).sort();
  ok(JSON.stringify(lagos) === JSON.stringify(['dumerilii:Lago de Pátzcuaro', 'taylori:Laguna de Alchichica']) && /localidades-lago', type: 'circle', source: 'puntosLoc'/.test(readFileSync(join(SITE, 'src/lib/atlasStyle.mjs'), 'utf8')) && !/f\.properties\.kind !== 'lake'\) continue[\s\S]{0,40}rangos/.test(readFileSync(join(SITE, 'src/components/atlas/Atlas.tsx'), 'utf8')), `the map's lake points and labels are the attested water bodies (${lagos.join(', ')}), drawn from the same layer as the SVG's (localidadesParaMapa), never from the range file`);
  const enMapa = pts.features.reduce((n, f) => n + (f.properties.kind === 'cell' ? 1 : f.properties.kind === 'area' ? f.properties.cells : 0), 0);
  ok(cells === 355 && enMapa === cells && pts.features.every((f) => ['cell', 'area', 'outline', 'lake'].includes(f.properties.kind)) && pts.features.filter((f) => f.properties.kind === 'cell').every((f) => f.properties.zona === true && f.properties.generalization === '0.5deg' && f.geometry.type === 'Point'), `every one of the ${cells} attested cells is a zone marker at its centre or part of an area (${enMapa}); the lakes are the attested water bodies; nothing carries a state, a page or a note`);
  ok(pts.features.every((f) => !('estado' in f.properties) && !('difiere' in f.properties) && !('resaltarEstado' in f.properties) && !('lecturaPagina' in f.properties) && !('lecturaCorroborado' in f.properties)), 'no phase-0 property (estado, difiere, resaltarEstado, lecturaPagina, lecturaCorroborado) is made up');
  const f = fuentesDePuntos(at);
  ok(f.lermaense.length === 2 && f.lermaense.some((x) => x.pagina === 35 && x.clave === 'pace-ambystoma-2018-mapa-lermaense-p35') && f.lermaense.some((x) => x.clave === 'taylor-1940' && x.pagina === null) && f.leorae[0].sitio === true && f.rivulare.length === 2 && Object.values(f).flat().every((x) => x.corroborado === null && x.estado === null && x.completa && x.corta), 'the source lines come from the attested features: each source once, the page only where the key ends in -pNN (lermaense p. 35), no state and no corroboration');
  const plantada = fuentesDePuntos({ features: [{ properties: { slug: 'x', sourceKey: 'mapa-sin-pagina', source: 'S', citation: 'C', licence: 'L' } }, { properties: { slug: 'x', sourceKey: 'mapa-p', source: 'S2' } }, { properties: { slug: 'x', sourceKey: 'otro-p12x', source: 'S3' } }, { properties: { slug: 'x', sourceKey: 'bueno-p7', source: 'S4' } }] });
  ok(plantada.x.map((l) => l.pagina).join() === ',,,7' || plantada.x.map((l) => l.pagina ?? '').join('|') === '|||7', 'planted: a sourceKey that does not end in -pNN (mapa-sin-pagina, mapa-p, otro-p12x) gets no page; one that does (bueno-p7) gets 7');
  // every file under src/ (not only Atlas.tsx): no import or fetch of a removed or unread phase-0 file
  const bajoSrc = (d) => readdirSync(d).flatMap((n) => { const f = join(d, n); return statSync(f).isDirectory() ? bajoSrc(f) : [f]; });
  const lee = bajoSrc(join(SITE, 'src')).filter((f) => /\.(tsx?|mjs|astro|js)$/.test(f)).filter((f) => /real\/localidades|real\}\/localidades|fuentes-localidades|fuentes-puntos|sin-punto|REAL\}\/(localidades|fuentes|sin-punto)/.test(readFileSync(f, 'utf8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')));
  const quedan = ['localidades.geojson', 'fuentes-puntos.json', 'fuentes-localidades.json', 'sin-punto.json'].filter((f) => existsSync(join(SITE, 'public/atlas/real', f)));
  ok(lee.length === 0 && quedan.length === 0, `nothing under src/ imports or fetches the phase-0 locality, source or sin-punto files, and the removed ones are not in the site${lee.length ? ' (read by: ' + lee.map((f) => f.slice(SITE.length + 1)).join(', ') + ')' : ''}${quedan.length ? ' (still there: ' + quedan.join(', ') + ')' : ''}`);
  // the grouping of cells, on a fixture: a 2×2 block, a cell that only touches the block's corner, and a lone cell. Groups of 4, 1, 1 (a diagonal is not an edge), an 8-segment outline for the 2×2 block, markers at the cell centres
  const cuadro = (slug, i, j, gen = '0.5deg', d = 0.5) => ({ type: 'Feature', properties: { slug, generalization: gen, sourceKey: 'k', source: 's', citation: 'c', licence: 'l' }, geometry: { type: 'Polygon', coordinates: [[[(i + 1) * d, (j + 1) * d], [i * d, (j + 1) * d], [i * d, j * d], [(i + 1) * d, j * d], [(i + 1) * d, (j + 1) * d]]] } });   // the ring starts at the NE corner on purpose
  const fx = { type: 'FeatureCollection', features: [cuadro('x', 0, 0), cuadro('x', 1, 0), cuadro('x', 0, 1), cuadro('x', 1, 1), cuadro('x', 2, 2), cuadro('x', 10, 10)] };
  const grupos = componentes(celdasDe(fx, 'x')).map((g) => g.length).sort((a, b) => a - b);
  const mf = puntosDeLocalidades(fx);
  const salida = mf.features.filter((f) => f.properties.kind === 'outline')[0];
  const centros = mf.features.filter((f) => f.properties.kind === 'cell').map((f) => f.geometry.coordinates.join(',')).sort();
  ok(JSON.stringify(grupos) === '[1,1,4]' && mf.features.filter((f) => f.properties.kind === 'area').length === 1 && salida?.geometry.coordinates.length === 8 && JSON.stringify(centros) === JSON.stringify(['1.25,1.25', '5.25,5.25']), `grouping fixture: groups of 4, 1, 1 (the diagonal cell does not join), one area with an 8-segment outline, and the two single cells are markers at their cell centres (${centros.join(' | ')}); got groups ${grupos.join(',')}, ${salida?.geometry.coordinates.length} outline segments`);
  // the marker is at the centre of the cell wherever its ring starts, and the wording and size follow the feature's own generalization
  const solo = puntosDeLocalidades({ type: 'FeatureCollection', features: [cuadro('y', -199, 38)] }).features[0];
  ok(solo.geometry.coordinates.join(',') === '-99.25,19.25' && solo.properties.generalization === '0.5deg' && solo.properties.size === 0.5, 'a single cell is a marker at its centre (-99.25, 19.25), not at a corner, whichever vertex the ring starts at');
  const fino = puntosDeLocalidades({ type: 'FeatureCollection', features: [cuadro('z', 3, 4, '0.1deg', 0.1)] }).features[0];
  ok(fino.properties.generalization === '0.1deg' && fino.properties.size === 0.1 && fino.geometry.coordinates.join(',') === '0.35,0.45', 'the generalization and the size are the feature\'s (0.1°), not a fixed 0.5°');
}
console.log('images carry no generation record');
{
  const imgs = [];
  const anda2 = (d) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) anda2(f); else if (/\.(jpe?g|png|webp|gif|avif)$/i.test(n)) imgs.push(f); } };
  anda2(join(SITE, 'public'));
  const sucias = imgs.filter((f) => rastroEnBytes(readFileSync(f).toString('latin1')));   // the terms: lib/barridoBinario.mjs
  // a species JPEG keeps only the segments that draw it: JFIF, an ICC profile, tables, the frame; Exif, XMP, Photoshop, comments and any other APPn are dropped (jpegtran -copy none: the pixels are identical)
  const segmentos = (f) => { const b = readFileSync(f); const out = []; let i = 2; while (i < b.length && b[i] === 0xff) { const m = b[i + 1]; if (m === 0xda) break; const ln = b.readUInt16BE(i + 2); out.push([m, b.toString('latin1', i + 4, i + 4 + 5)]); i += 2 + ln; } return out; };
  const extra = imgs.filter((f) => /\/public\/species\/[^/]+\.jpe?g$/i.test(f)).filter((f) => segmentos(f).some(([m, id]) => (m >= 0xe1 && m <= 0xef && !(m === 0xe2 && id.startsWith('ICC_'))) || m === 0xfe));
  ok(imgs.length > 20 && sucias.length === 0 && extra.length === 0, `the ${imgs.length} images under public/ carry no generation record (no model path, no private repository path) and no species JPEG has Exif, XMP, Photoshop or comment segments (the generated images' metadata)${sucias.length ? ' (still: ' + sucias.map((f) => f.slice(SITE.length + 1)).slice(0, 3).join(', ') + ')' : ''}${extra.length ? ' (with segments: ' + extra.length + ')' : ''}`);
  // the dist check catches one that slips in
  const d = mkdtempSync(join(tmpdir(), 'img-')); writeFileSync(join(d, 'a.jpg'), JPEG_PLANTADO());
  ok(problemasDeLaConstruccion(d).some((m) => /a\.jpg: image metadata with a local path/.test(m)), 'planted: the dist check refuses an image whose metadata names a local path'); rmSync(d, { recursive: true, force: true });
}
console.log('C5: the build snapshot is not served; the IUCN rows hold category and citation only');
{
  const enPublic = ARCHIVOS.filter((a) => existsSync(join(SITE, 'public/atlas/layers', a)));
  ok(enPublic.length === 0 && ARCHIVOS.every((a) => existsSync(join(SITE, 'src/data/atlas-snapshot', a))), `C5: none of the six committed data files is under public/ (they would be served at /atlas/layers/ as well as at /atlas/datos/); all six are in src/data/atlas-snapshot/${enPublic.length ? ' (still in public: ' + enPublic.join(', ') + ')' : ''}`);
  const fuentesDeImportadores = ['scripts/import-atlas-species.mjs', 'scripts/import-atlas-layers.mjs', 'scripts/build-atlas-base.mjs', 'scripts/escribir-generado-de.mjs'].map((f) => [f, readFileSync(join(SITE, f), 'utf8')]);
  const viejos = fuentesDeImportadores.filter(([, t]) => /public\/atlas\/layers\/(especies-atlas|especies-localidades|admin1|especies-por-estado|estados-metricas|instalaciones-catalogadas)|join\(SITE, 'public\/atlas\/layers', archivo\)/.test(t.replace(/^\/\/.*$/gm, '')));
  ok(viejos.length === 0 && fuentesDeImportadores.every(([, t]) => /src\/data\/atlas-snapshot/.test(t)), `C5: the importers and the stamping script write to src/data/atlas-snapshot${viejos.length ? ' (still public/: ' + viejos.map((v) => v[0]).join(', ') + ')' : ''}`);
  // the IP ruling: from IUCN the committed file may carry only each species' category and its citation (the assessment year is in the citation); nothing else
  const atlas = json('src/data/atlas-snapshot/especies-atlas.json');
  const claveIucn = new Set(atlas.fuentes.filter((f) => /iucn/i.test(f.key) || /iucn/i.test(f.publisher ?? '')).map((f) => f.key));
  const filasIucn = atlas.especies.flatMap((s) => s.categories.filter((c) => c.system === 'iucn').map((c) => [s.slug, c]));
  const CITA = /^UICN: (EX|EW|CR|EN|VU|NT|LC|DD|NE) \(evaluación \d{4}\) · IUCN \d{4}\. The IUCN Red List of Threatened Species\. Version \S+, consultada el \d{4}-\d{2}-\d{2}$/;
  const malFilas = filasIucn.filter(([, c]) => Object.keys(c).some((k) => !['system', 'scope', 'category', 'citation', 'source'].includes(k)) || !CITA.test(c.citation ?? '') || !claveIucn.has(c.source));
  ok(filasIucn.length >= 30 && malFilas.length === 0, `C5/IP: each of the ${filasIucn.length} IUCN rows holds only system, scope, category, citation and the source key, and the citation has the evaluation year${malFilas.length ? ' (not: ' + malFilas.slice(0, 3).map(([s]) => s).join(', ') + ')' : ''}`);
  const usos = [];
  const recorre = (o, ruta) => { if (Array.isArray(o)) o.forEach((x, i) => recorre(x, `${ruta}[${i}]`)); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'source' && typeof v === 'string' && claveIucn.has(v) && !/\.categories\[\d+\]$/.test(ruta)) usos.push(`${ruta}.${k}`); else recorre(v, `${ruta}.${k}`); } };
  recorre(atlas.especies, 'especies'); for (const [iso, filas] of Object.entries(atlas.presencia)) for (const f of Object.values(filas)) if (Array.isArray(f) && claveIucn.has(f[2])) usos.push(`presencia.${iso}`);
  ok(usos.length === 0 && atlas.fuentes.filter((f) => claveIucn.has(f.key)).every((f) => f.citeOnly === true), `C5/IP: no range, trend, threat, text or figure is attributed to IUCN anywhere else in the file, and its source is cite-only${usos.length ? ' (used at: ' + usos.slice(0, 3).join(', ') + ')' : ''}`);
}
console.log('provenance: the bundles each atlas file is built from');
{
  const atest = json('src/data/atestacion-atlas.json');
  const sitioP = archivosDelSitio(SITE);
  ok(atest.lectura?.resultado === 'coincide' && atest.archivos === 130 && atest.archivosAtestados === 130 && atest.noCubiertos.length === 0 && /^0x[0-9a-f]{64}$/.test(atest.contentSha256) && atest.contentSha256 === atest.contentSha256Calculado, `the attestation snapshot says «coincide» for ${atest.archivos} files, none uncovered (uid ${atest.uid.slice(0, 12)}…)`);
  const malP = ARCHIVOS.filter((a) => JSON.stringify(sitioP.archivo[a].generadoDe?.bundles) !== JSON.stringify(generadoDeDe(a, atest).bundles));
  ok(malP.length === 0 && ARCHIVOS.every((a) => PROCEDENCIA[a]), `each of the six committed atlas files carries generadoDe: the bundles it is built from with the manifest sha256 the attestation covers${malP.length ? ' (not: ' + malP.join(', ') + ')' : ''}`);
  ok((() => { try { generadoDeDe('admin1.geojson', { cubre: [] }); return false; } catch { return true; } })() && (() => { try { generadoDeDe('otro.json', atest); return false; } catch { return true; } })(), 'planted: a bundle the attestation does not cover, or a file with no provenance, is refused');
}

// ---------------------------------------------------------------------------------------------
console.log('the atlas fingerprint served file by file');
{
  const dir = mkdtempSync(join(tmpdir(), 'huella-')); const ent = join(dir, 'ent'), sal = join(dir, 'sal');
  const sha2 = (b) => createHash('sha256').update(b).digest('hex');
  const arch = { 'a-b1/manifest.json': '{"files":[]}', 'a-b1/datos.jsonl': '{"x":1}\n', 'a-b1/licences.jsonl': '{"spdx":"CC-BY-4.0","name":"CC BY 4.0","commercialOk":true}\n', 'c-b2/manifest.json': '{"m":2}', 'c-b2/layers/uno.geojson': '{"type":"FeatureCollection","features":[]}\n', 'c-b2/layers.jsonl': '{"slug":"uno","geojsonPath":"layers/uno.geojson","licenceSpdx":"CC-BY-NC-2.5-MX"}\n', 'c-b2/licences.jsonl': '{"spdx":"CC-BY-NC-2.5-MX","name":"CC BY-NC 2.5 MX","commercialOk":false,"url":"https://creativecommons.org/licenses/by-nc/2.5/mx/"}\n' };
  for (const [r, t] of Object.entries(arch)) { mkdirSync(dirname(join(ent, r)), { recursive: true }); writeFileSync(join(ent, r), t); }
  const listadoTxt = `zenbit-listado-stand v1\nbundle a-b1 manifest 0x${sha2(arch['a-b1/manifest.json'])}\nbundle c-b2 manifest 0x${sha2(arch['c-b2/manifest.json'])}\n` + Object.keys(arch).sort().map((r) => `${sha2(arch[r])}  ${r}`).join('\n') + '\n';
  const L = join(dir, 'listado.txt'); writeFileSync(L, listadoTxt);
  ok(leerListado(listadoTxt).archivos.length === 7 && leerListado(listadoTxt).bundles.length === 2, 'the listing parses: two bundles, seven files');
  ok(copiarHuella({ listadoRuta: L, entidades: ent, salida: sal }).length === 0, 'every listed file is copied byte for byte and re-verified against the listing; nothing else is served but the listing and the index');
  const idx = readFileSync(join(sal, 'index.html'), 'utf8');
  ok(/layers\/uno\.geojson[^\n]*<br><span data-licencia="nc">Licencia: <a href="https:\/\/creativecommons\.org\/licenses\/by-nc\/2\.5\/mx\/"[^\n]*>CC BY-NC 2\.5 MX<\/a> \(no comercial\)<\/span>/.test(idx)
    && /datos\.jsonl<\/a> <code>[0-9a-f]{64}<\/code> · <a href="\/atlas\/datos\/huella\/a-b1\/licences\.jsonl" data-licencia="paquete">/.test(idx) && !/datos\.jsonl<\/a>[^\n]*no comercial/.test(idx)
    && !/<script/i.test(idx) && !/datos abiertos/i.test(idx), 'the index gives each file its own link and sha256 and its licence: a CC BY-NC layer «CC BY-NC 2.5 MX (no comercial)» on a line of its own, the others a link to their bundle\'s licences.jsonl; no script, and never «datos abiertos»');
  ok(verificarHuella({ listadoRuta: L, salida: sal }).length === 0 && readFileSync(join(sal, 'listado-stand.txt'), 'utf8') === listadoTxt, 'the served listing is the listing byte for byte');
  // each rule seen red on a planted fault
  writeFileSync(join(sal, 'a-b1/datos.jsonl'), '{"x":2}\n');
  ok(verificarHuella({ listadoRuta: L, salida: sal }).some((m) => /a-b1\/datos\.jsonl: served bytes are not the listed ones/.test(m)), 'planted: a changed byte in a served file is caught');
  writeFileSync(join(sal, 'a-b1/datos.jsonl'), arch['a-b1/datos.jsonl']); writeFileSync(join(sal, 'extra.json'), '{}'); writeFileSync(join(sal, 'todo.zip'), 'x');
  ok(verificarHuella({ listadoRuta: L, salida: sal }).some((m) => /extra\.json: served but not listed/.test(m)) && verificarHuella({ listadoRuta: L, salida: sal }).some((m) => /todo\.zip: an archive is never served/.test(m)), 'planted: an unlisted file and an archive are caught');
  rmSync(join(sal, 'extra.json')); rmSync(join(sal, 'todo.zip')); rmSync(join(sal, 'c-b2/layers/uno.geojson'));
  ok(verificarHuella({ listadoRuta: L, salida: sal }).some((m) => /not served/.test(m)), 'planted: a listed file that is not served is caught');
  writeFileSync(join(ent, 'a-b1/datos.jsonl'), '{"x":3}\n');
  ok((() => { try { copiarHuella({ listadoRuta: L, entidades: ent, salida: join(dir, 'otra') }); return false; } catch (e) { return /sha256 is not the listing's/.test(e.message); } })(), 'planted: a source file that no longer matches the listing stops the copy');
  ok((() => { try { leerListado(listadoTxt.replace('v1', 'v2')); return false; } catch { return true; } })() && (() => { try { leerListado(listadoTxt + 'basura\n'); return false; } catch { return true; } })() && (() => { try { leerListado(listadoTxt.replace(/  c-b2\/manifest\.json/, '  c-b2/../x')); return false; } catch { return true; } })(), 'planted: a listing with another version, a stray line or a path that climbs is refused');
  // review 9, 10, 7: the listing compared as bytes; a listed file under no bundle is refused; the index links are absolute
  {
    const lineaSola = `${sha2('zz')}  zz-sin-bundle/x.json\n`;
    ok((() => { try { leerListado(listadoTxt + lineaSola); return false; } catch (e) { return /under no bundle/.test(e.message); } })(), 'review 10: a listed file whose first folder is not a listed bundle is refused');
    const base = Buffer.from(listadoTxt + `${sha2('x')}  a-b1/n`), cola = (b) => Buffer.concat([base, Buffer.from([b]), Buffer.from('.dat\n')]);
    const L1 = join(dir, 'l1.txt'), sal1 = join(dir, 'sal1'); mkdirSync(sal1, { recursive: true }); writeFileSync(L1, cola(0xff)); writeFileSync(join(sal1, 'listado-stand.txt'), cola(0xfe));
    ok(verificarHuella({ listadoRuta: L1, salida: sal1 }).some((m) => /listado-stand\.txt is not the listing byte for byte/.test(m)), 'review 9: two listings that differ only in an invalid UTF-8 byte are not the same bytes');
    ok(/href="\/atlas\/datos\/huella\/a-b1\/datos\.jsonl"/.test(idx) && /href="\/atlas\/datos\/huella\/listado-stand\.txt"/.test(idx) && !/href="(?!\/|https?:|#)/.test(idx), 'review 7: every link of the index is absolute, so /atlas/datos/huella and /atlas/datos/huella/ both work');
  }
  // the pre-push check: an attested file tracked by path or by content, a generated huella path, or a source map in the build, fails; a clean repository passes
  {
    const rep = join(dir, 'repo'); mkdirSync(rep, { recursive: true });
    const git = (...a) => execFileSync('git', a, { cwd: rep, stdio: 'pipe' });
    git('init', '-q'); git('config', 'user.email', 'a@example.invalid'); git('config', 'user.name', 'x');
    writeFileSync(join(rep, 'propio.txt'), 'nada'); git('add', '-A'); git('commit', '-q', '-m', 'x');
    ok(problemasDeLaHuella({ repo: rep, listadoTexto: listadoTxt }).length === 0, 'pre-push: a repository that tracks none of the attested files passes');
    mkdirSync(join(rep, 'datos/c-b2/layers'), { recursive: true }); writeFileSync(join(rep, 'datos/c-b2/layers/uno.geojson'), arch['c-b2/layers/uno.geojson']); git('add', '-A'); git('commit', '-q', '-m', 'y');
    ok(problemasDeLaHuella({ repo: rep, listadoTexto: listadoTxt }).some((m) => /c-b2\/layers\/uno\.geojson: its path is an attested file's/.test(m)) && problemasDeLaHuella({ repo: rep, listadoTexto: listadoTxt }).some((m) => /its sha256 is the attested file c-b2\/layers\/uno\.geojson/.test(m)), 'pre-push: an attested file tracked by its path and by its content is caught');
    writeFileSync(join(rep, 'otro-nombre.dat'), arch['a-b1/datos.jsonl']); git('add', '-A'); git('commit', '-q', '-m', 'z');
    ok(problemasDeLaHuella({ repo: rep, listadoTexto: listadoTxt }).some((m) => /otro-nombre\.dat: its sha256 is the attested file a-b1\/datos\.jsonl/.test(m)), 'pre-push: an attested file under another name is still caught by its sha256');
    // C1: the repository's top is NOT the site folder: run from Site/, a renamed copy of an attested file must still be found, and a check that hashed nothing fails
    {
      const top = join(dir, 'repo2'); mkdirSync(join(top, 'Site/otra/carpeta'), { recursive: true });
      const g2 = (...a) => execFileSync('git', a, { cwd: top, stdio: 'pipe' });
      g2('init', '-q'); g2('config', 'user.email', 'a@example.invalid'); g2('config', 'user.name', 'x');
      writeFileSync(join(top, 'Site/otra/carpeta/copia-renombrada.bin'), arch['a-b1/datos.jsonl']); writeFileSync(join(top, 'README.md'), 'nada'); g2('add', '-A'); g2('commit', '-q', '-m', 'c');
      const desdeSite = problemasDeLaHuella({ repo: join(top, 'Site'), listadoTexto: listadoTxt });
      ok(desdeSite.some((m) => /Site\/otra\/carpeta\/copia-renombrada\.bin: its sha256 is the attested file a-b1\/datos\.jsonl/.test(m)), 'C1: run from the Site/ subfolder, a renamed copy of an attested file is found by its sha256 (paths are the repository\'s, not Site\'s)');
      const vacio = join(dir, 'repo3'); mkdirSync(vacio, { recursive: true }); execFileSync('git', ['init', '-q'], { cwd: vacio });
      ok(problemasDeLaHuella({ repo: vacio, listadoTexto: listadoTxt }).some((m) => /checked nothing|no file was hashed/.test(m)), 'C1: a check that hashed no file fails instead of passing');
      // the real hook: a push of a commit that holds an attested file is refused, a clean push goes through
      const script = join(SITE, 'scripts/pre-push-huella.mjs'), bare = join(dir, 'remoto.git'); execFileSync('git', ['init', '-q', '--bare', bare]);
      const hooks = join(top, '.githooks'); mkdirSync(hooks, { recursive: true }); const hook = join(hooks, 'pre-push');
      writeFileSync(hook, `#!/bin/sh\nexec node "${script}" --hook "$@"\n`, { mode: 0o755 }); g2('config', 'core.hooksPath', '.githooks'); g2('remote', 'add', 'origen', bare);
      const lis = join(dir, 'listado-hook.txt'); writeFileSync(lis, listadoTxt);
      const empuja = (...refs) => { try { execFileSync('git', ['push', 'origen', ...refs], { cwd: top, stdio: 'pipe', env: { ...process.env, HUELLA_LISTADO: lis } }); return 0; } catch (e) { return e.status ?? 1; } };
      ok(empuja('HEAD:refs/heads/principal') !== 0, 'C1: git push of a commit that holds an attested file is refused by the pre-push hook');
      g2('rm', '-q', 'Site/otra/carpeta/copia-renombrada.bin'); g2('commit', '-q', '-m', 'sin copia');
      ok(empuja('HEAD:refs/heads/principal') !== 0, 'C1: the earlier commit still carries the file, so pushing the branch is still refused (every pushed commit is checked, not only the tip)');
      g2('checkout', '-q', '--orphan', 'limpia'); g2('commit', '-q', '-m', 'limpia', '--allow-empty'); writeFileSync(join(top, 'ok.txt'), 'propio'); g2('add', 'ok.txt'); g2('commit', '-q', '-m', 'propio');
      ok(empuja('HEAD:refs/heads/limpia') === 0, 'C1: a push of history that holds no attested file goes through');
    }
    mkdirSync(join(rep, 'public/atlas/datos/huella'), { recursive: true }); writeFileSync(join(rep, 'public/atlas/datos/huella/x.txt'), 'x'); git('add', '-f', '-A'); git('commit', '-q', '-m', 'w');
    ok(problemasDeLaHuella({ repo: rep, listadoTexto: listadoTxt }).some((m) => /generated for \/atlas\/datos\/huella\/ and tracked/.test(m)), 'pre-push: a tracked file under atlas/datos/huella/ is caught');
    const dist = join(dir, 'dist'); mkdirSync(dist, { recursive: true }); writeFileSync(join(dist, 'a.js'), 'x');
    ok(problemasDeLaHuella({ repo: rep, listadoTexto: listadoTxt, dist }).every((m) => !/source map/.test(m)), 'pre-push: a build with no source map passes');
    writeFileSync(join(dist, 'p.html'), '<astro-island props="{&quot;hubUrl&quot;:[0,&quot;http://127.0.0.1:4480&quot;]}">');
    ok(problemasDeLaHuella({ repo: rep, listadoTexto: listadoTxt, dist }).some((m) => /p\.html: a local address or path in the build \(127\.0\.0\.1\)/.test(m)), 'pre-push: a loopback address in a page is caught');
    writeFileSync(join(dist, 'p.html'), '<p>/Users/ejemplo/x</p>');
    ok(problemasDeLaHuella({ repo: rep, listadoTexto: listadoTxt, dist }).some((m) => /p\.html: a local address or path in the build \(\/Users\/e\)/.test(m)), 'pre-push: a machine path in a page is caught');
    writeFileSync(join(dist, 'p.html'), '<p>10.5.3.2 is not an address: coordinates</p>');
    ok(problemasDeLaHuella({ repo: rep, listadoTexto: listadoTxt, dist }).every((m) => !/local address/.test(m)), 'pre-push: numbers that only look like an address pass');
    rmSync(join(dist, 'p.html'));
    writeFileSync(join(dist, 'a.js.map'), '{}');
    ok(problemasDeLaHuella({ repo: rep, listadoTexto: listadoTxt, dist }).some((m) => /a\.js\.map: a source map in the build/.test(m)), 'pre-push: a source map in the build is caught');
  }
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------------------------
console.log('synonyms and facility counts');
{
  const taxa = [{ id: 'T1', slug: 'ambystoma_velasci' }, { id: 'T2', slug: 'ambystoma_mexicanum' }, { id: 'T3', slug: 'ambystoma_granulosum' }];
  const reg = (taxonId, name) => ({ taxonId, name });
  const tabla = tablaDeSinonimos(taxa, [reg('T1', 'Ambystoma subsalsum'), reg('T2', 'Ambystoma Mexicanum2'), reg('T1', 'Ambystoma granulosum'), reg('T9', 'Ambystoma huerfano'), reg('T1', 'Siredon velasci')]);
  ok(JSON.stringify(tabla) === JSON.stringify({ subsalsum: 'velasci', mexicanum2: 'mexicanum' }), 'the synonym table keeps «Ambystoma <epithet>» names of listed taxa, never an epithet that is itself an atlas species (granulosum), an unlisted taxon or another genus');
  let msg = '';
  try { tablaDeSinonimos(taxa, [reg('T1', 'Ambystoma subsalsum'), reg('T2', 'Ambystoma subsalsum')]); } catch (e) { msg = e.message; }
  ok(/subsalsum.*two taxa/.test(msg), `a synonym claimed by two taxa stops the import (${msg})`);
  ok((() => { try { tablaDeSinonimos(taxa, [reg('T1', 'Ambystoma subsalsum'), reg('T1', 'Ambystoma subsalsum')]); return true; } catch { return false; } })(), 'the same synonym repeated for the SAME taxon is not a conflict');
  const f = (id, especies) => ({ properties: { id, especies } });
  const fs = [f('a', 'A. velasci'), f('b', 'Ambystoma subsalsum, A. mexicanum'), f('c', 'A. mexicanum'), f('d', null)];
  ok(instalacionesDeEspecie(fs, 'velasci', { subsalsum: 'velasci' }) === 2 && instalacionesDeEspecie(fs, 'velasci', {}) === 1 && instalacionesDeEspecie(fs, 'mexicanum', { subsalsum: 'velasci' }) === 2, 'a facility that names a species by one of its synonyms is counted for it (and for no other), once');
}

// ---------------------------------------------------------------------------------------------
console.log('conservation status scales');
{
  const especies = archivosDelSitio(SITE).archivo['especies-atlas.json'].especies;
  const mal = [];
  for (const e of especies) {
    const iucn = e.categories.find((c) => c.system === 'iucn' && c.scope === 'global')?.category;
    const u = estadoUicn(iucn);
    if (ESCALA_UICN.includes(iucn) ? (u.llena !== iucn || u.pildora !== null) : !(u.llena === null && u.pildora === iucn && (iucn === 'DD' || iucn === 'NE'))) mal.push(`${e.slug}: IUCN ${iucn}`);
    const nomOficial = e.categories.find((c) => c.system === 'nom059')?.category;
    const n = estadoNom(e.categories);
    if (nomOficial ? n.llena !== nomOficial || n.noListada : !(n.llena === null && n.noListada)) mal.push(`${e.slug}: NOM ${nomOficial}`);
    const proy = e.categories.find((c) => c.system === 'proy_nom059_2025')?.category;
    if ((proy ?? null) !== n.proyecto) mal.push(`${e.slug}: 2025 draft ${proy}`);
    if (n.notaProyecto !== (proy && proy !== nomOficial ? proy : null)) mal.push(`${e.slug}: 2025 draft note ${n.notaProyecto}`);
  }
  ok(especies.length === 32 && mal.length === 0, `for each of the ${especies.length} species the filled circle is its category in the data, DD and NE show the pill and no filled circle, a species with no NOM-059 is «not listed», and a 2025 draft is only a note${mal.length ? ': ' + mal.join('; ') : ''}`);
  ok(especies.filter((e) => e.categories.some((c) => c.system === 'iucn' && c.category === 'DD')).map((e) => e.slug).sort().join() === 'bombypellum,silvense' && ESCALA_NOM.join() === 'E,P,A,Pr', 'bombypellum and silvense are the two DD species, and the NOM-059 scale is E, P, A, Pr');
  ok(estadoUicn('CR').llena === 'CR' && estadoUicn('DD').llena === null && estadoUicn('NE').pildora === 'NE' && estadoNom([]).noListada === true && estadoNom([{ system: 'proy_nom059_2025', category: 'A' }]).llena === null && estadoNom([{ system: 'proy_nom059_2025', category: 'A' }]).proyecto === 'A', 'planted: a draft category is never the official value; an empty list is «not listed»; DD is never filled');
}

// ---------------------------------------------------------------------------------------------
console.log('species images and their credits');
{
  // heroImages.ts is read as text (a plain `node` without type stripping cannot import it)
  const HERO_IMAGE_FILE = Object.fromEntries([...readFileSync(join(SITE, 'src/components/species/heroImages.ts'), 'utf8').split('HERO_FOCUS_Y')[0].matchAll(/^\s*(\w+): '([\w.-]+)',?$/gm)].map((m) => [m[1], m[2]]));
  const slugs = archivosDelSitio(SITE).archivo['especies-atlas.json'].especies.map((e) => e.slug);
  const creditos = json('src/data/creditos-imagenes.json');
  const archivos = readdirSync(join(SITE, 'public/species')).filter((f) => /\.(png|jpe?g)$/i.test(f));
  const entrada = { slugs, archivos, hero: HERO_IMAGE_FILE, creditos };
  const mal = validarCreditos(entrada);
  ok(slugs.length === 32 && mal.length === 0, `every one of the ${slugs.length} atlas species has an image and a credit, no image file lacks one, no stale gen-subsalsum.jpg, and every CC BY base shows its author and link${mal.length ? ': ' + mal.slice(0, 4).join('; ') : ''}`);
  const lock = json('scripts/fixtures/creditos-imagenes.lock.json');
  const sha = (t) => createHash('sha256').update(t).digest('hex');
  ok(/^the plan repository [0-9a-f]{7,40}$/.test(lock.origen) && lock.entradas === Object.keys(creditos).length && lock.sha256Salida === sha(readFileSync(join(SITE, 'src/data/creditos-imagenes.json'))), `the credits are the pinned import (${lock.origen}, ${lock.entradas} entries): the committed data hashes to the lock's sha256`);
  ok(Object.values(creditos).every((c) => !/crudos|\/Users\/|Site\/public|\.provenance|photo_sha256/.test(JSON.stringify(c))), 'the credit data carries no repository path, file name or photo hash');
  ok(archivos.filter((f) => f.startsWith('gen-')).every((f) => { const sl = Object.keys(HERO_IMAGE_FILE).find((k) => HERO_IMAGE_FILE[k] === f); return sl && creditos[sl]?.etiqueta === 'Ilustración generada con IA'; }) && archivos.filter((f) => f.startsWith('gen-')).length === 28, 'the 28 generated images each carry the badge «Ilustración generada con IA» in their credit');
  ok(JSON.stringify(partesDeCredito('Foto base: Ana Pérez (A. x), CC0 1.0 (https://x.org/p), modificada', 'Ana Pérez', 'https://x.org/p')) === JSON.stringify(['Foto base: ', { texto: 'Ana Pérez', url: 'https://x.org/p' }, ' (A. x), CC0 1.0, modificada']) && JSON.stringify(partesDeCredito('Ilustración generada con IA', 'Zenbit', null)) === JSON.stringify(['Ilustración generada con IA']), 'the address of a credit is not printed: the source\'s name is the link; an original is plain text');
  // each rule seen red on a planted fault
  const sin = (k) => { const o = { ...creditos }; delete o[k]; return o; };
  ok(validarCreditos({ ...entrada, creditos: sin('lermaense') }).some((m) => /lermaense: no credit/.test(m)) && validarCreditos({ ...entrada, hero: { ...HERO_IMAGE_FILE, mabeei: undefined } }).some((m) => /mabeei: no image/.test(m)), 'planted: a species with no credit, or no image, is reported');
  ok(validarCreditos({ ...entrada, archivos: [...archivos, 'gen-suelta.jpg'] }).some((m) => /gen-suelta.jpg: no species uses/.test(m)) && validarCreditos({ ...entrada, archivos: [...archivos, 'gen-subsalsum.jpg'] }).some((m) => /subsalsum/.test(m)), 'planted: an image no species uses, and gen-subsalsum.jpg, are reported');
  ok(validarCreditos({ ...entrada, creditos: { ...creditos, lermaense: { ...creditos.lermaense, url: null } } }).some((m) => /lermaense: a CC BY base/.test(m)) && validarCreditos({ ...entrada, creditos: { ...creditos, lermaense: { ...creditos.lermaense, credito: creditos.lermaense.credito.replace('Tiia Monto', 'alguien') } } }).some((m) => /lermaense: a CC BY base/.test(m)) && validarCreditos({ ...entrada, creditos: { ...creditos, lermaense: { ...creditos.lermaense, etiqueta: '' } } }).some((m) => /lermaense: no badge/.test(m)), 'planted: a CC BY base without its link or its author in the line, and an image without badge, are reported');
}

// ---------------------------------------------------------------------------------------------
console.log('base geometry');
const admin1 = json('src/data/atlas-snapshot/admin1.geojson');
const entidades = readFileSync(join(SITE, 'scripts/fixtures/entidades.csv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split(',')[1]);
const isosDe = (c) => admin1.features.filter((f) => f.properties.country === c).map((f) => f.properties.iso);
const isos = isosDe('MX');
ok(admin1.features.length === 96 && new Set(admin1.features.map((f) => f.properties.iso)).size === 96, `admin1.geojson has 96 unique units (${admin1.features.length})`);
ok(isosDe('MX').length === 32 && isosDe('US').length === 51 && isosDe('CA').length === 13, 'Mexico 32, the United States 51 (50 states and DC), Canada 13');
ok(isos.includes('MX-COL') && isos.includes('MX-CMX') && !isos.includes('MX-DIF'), 'Mexico City is MX-CMX (Natural Earth\'s MX-DIF is mapped) and Colima is there');
ok(JSON.stringify([...isos].sort()) === JSON.stringify([...entidades].sort()), 'the Mexican keys are exactly the 32 INEGI entities');
ok(isosDe('US').includes('US-DC') && isosDe('US').includes('US-AK') && isosDe('CA').includes('CA-QC'), 'DC, Alaska and Quebec are units');
ok(admin1.features.every((f) => f.properties.iso.startsWith(`${f.properties.country}-`) && ['Polygon', 'MultiPolygon'].includes(f.geometry.type)), 'every unit is a polygon whose ISO code starts with its country');
const PROPS_ADMIN1 = (f) => Object.keys(f.properties).sort().join();
ok(admin1.features.every((f) => PROPS_ADMIN1(f) === 'country,inegiCve,iso,nameEn,nameEs' && (f.properties.country === 'MX' ? Number.isInteger(f.properties.inegiCve) : f.properties.inegiCve === null)), 'a unit carries the hub\'s properties (ISO code, country, two names) and the INEGI state code only in Mexico, null elsewhere');
ok(statSync(join(SITE, 'src/data/atlas-snapshot/admin1.geojson')).size < 300 * 1024, 'admin1.geojson is under 300 KB');
ok(gzipSync(readFileSync(join(SITE, 'src/data/atlas-snapshot/admin1.geojson'))).length < 100 * 1024, 'and under 100 KB gzipped');
ok(!existsSync(join(SITE, 'public/atlas/mx-estados.geojson')), 'the old Mexico-only file is not shipped');
const svg = json('src/data/atlas/mx-estados-svg.json');
ok(svg.states.length === 32 && svg.states.every((s) => s.d.startsWith('M') && s.d.length > 20), 'mx-estados-svg.json has a path for each of the 32 states');
ok(svg.states.find((s) => s.iso === 'MX-COL')?.d.length > 20, 'and one for Colima');

// ---------------------------------------------------------------------------------------------
console.log('style: no external tiles, glyphs or sprites');
const estilo = baseStyle();
ok(!estilo.glyphs && !estilo.sprite, 'the style names no glyphs or sprite');
ok(urlsDelEstilo(estilo).every((u) => u.startsWith('/') && !u.startsWith('//')), `every URL in the style is same-origin: ${urlsDelEstilo(estilo).join(', ')}`);
ok(Object.values(estilo.sources).every((s) => s.type === 'geojson'), 'every source is GeoJSON (no raster or vector tiles)');
// known positives: the checker refuses a style that points at a remote tile, glyph or sprite
const remoto = (u) => urlsDelEstilo({ ...estilo, ...u }).some((x) => !x.startsWith('/') || x.startsWith('//'));
ok(remoto({ glyphs: 'https://example.org/{fontstack}/{range}.pbf' }), 'a remote glyphs URL is caught');
ok(remoto({ sprite: 'https://example.org/sprite' }), 'a remote sprite is caught');
ok(remoto({ sources: { t: { type: 'raster', tiles: ['https://tiles.example.org/{z}/{x}/{y}.png'] } } }), 'a remote tile source is caught');
const src = readFileSync(join(SITE, 'src/components/atlas/Atlas.tsx'), 'utf8') + readFileSync(join(SITE, 'src/lib/atlasStyle.mjs'), 'utf8');
ok(!/https?:\/\/(?!127\.0\.0\.1|localhost)/.test(src.replace(/\/\/ .*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'neither the atlas component nor its style hard-codes a remote URL');

// ---------------------------------------------------------------------------------------------
console.log('layer cards');
const manifest = json('public/atlas/layers/manifest.json');
const capa = Object.fromEntries(manifest.capas.map((c) => [c.id, c]));
ok(manifest.capas.length === 9, 'nine cards: the species (richness, localities), facilities, water (rivers and lakes, the CONABIO sites), organizations and context');
ok(manifest.capas.every((c) => c.download === false), 'no layer has download: true');
const GRUPO_DE = { 'especies-por-estado': 'especies', 'localidades-especies': 'especies', 'metrica-estatal': 'instalaciones', 'instalaciones-catalogadas': 'instalaciones', 'uma-extensivas': 'instalaciones', 'rios-lagos': 'agua', 'sitios-conagua-2013': 'agua', 'organizaciones-registradas': 'instalaciones', 'limites-admin1': 'contexto' };
ok(manifest.capas.every((c) => GRUPOS.includes(c.grupo)), `every card names a known panel group (${manifest.capas.map((c) => c.grupo).join(', ')})`);
ok(manifest.capas.every((c) => c.grupo === GRUPO_DE[c.id]), 'and each card sits in the group the design gives it');
ok(Object.keys(CLAVE_DE_GRUPO).sort().join() === [...GRUPOS].sort().join(), 'every group has an i18n key for its heading');
ok(JSON.stringify(agruparCapas(manifest.capas).map((g) => g.grupo)) === JSON.stringify(['especies', 'instalaciones', 'agua', 'contexto']), 'the groups come out in the design\'s order (the organizations sit with the facilities)');
ok(JSON.stringify(agruparCapas(manifest.capas.filter((c) => c.grupo !== 'contexto')).map((g) => g.grupo)) === JSON.stringify(['especies', 'instalaciones', 'agua']), 'and a group with no card is left out');
ok(agruparCapas([...manifest.capas, { id: 'x', grupo: 'nuevo' }]).at(-1).grupo === 'nuevo', 'a card of an unknown group is not dropped: it gets a group of its own');
ok(['uma-extensivas', 'sitios-conagua-2013'].every((id) => capa[id]?.flag === 'nc' && capa[id].lazy && /CC BY-NC/.test(capa[id].licence.label.es + capa[id].licence.label.en)), 'layers 4 and 5 are CC BY-NC, lazy and behind the nc flag');
ok(manifest.capas.filter((c) => c.kind !== 'live').every((c) => c.source.es && c.licence.label.es && c.lastDataText && c.retrievedAt), 'every data layer shows source, licence, last data and retrieval date');
ok(['es', 'en', 'pt'].every((l) => manifest.capas.every((c) => c.title[l] && c.note[l] && c.source[l] && c.licence.label[l])), 'every card text exists in es, en and pt');
ok(['uma-extensivas', 'sitios-conagua-2013'].every((id) => capa[id].attribution.es.startsWith('Fuente: CONABIO')), 'the NC cards carry the CONABIO attribution that appears on the map');
ok(capa['localidades-especies'].kind === 'localities' && capa['especies-por-estado'].licence.id === capa['localidades-especies'].licence.id && !/PACE/.test(JSON.stringify(capa['especies-por-estado'])), 'the richness card no longer names the PACE file, and both species cards say each record cites its own source');

// ---------------------------------------------------------------------------------------------
console.log('the map-first UI: URL state and words');
const { leerUrl, escribirUrl, CAPAS } = await import('../src/lib/atlasUrl.mjs');
const validos = { slugs: ['velasci', 'maculatum'], isos: ['MX-MIC', 'US-TX'] };
ok(JSON.stringify(leerUrl('', validos)) === JSON.stringify({ capa: 'especies', especie: null, estado: null }), 'with no query the atlas opens on the species view');
ok(JSON.stringify(leerUrl('?capa=riqueza&especie=velasci&estado=MX-MIC', validos)) === JSON.stringify({ capa: 'riqueza', especie: 'velasci', estado: 'MX-MIC' }), '?capa ?especie ?estado are read');
ok(JSON.stringify(leerUrl('?capa=drop&especie=%3Cscript%3E&estado=XX-YY', validos)) === JSON.stringify({ capa: 'especies', especie: null, estado: null }), 'a value that names nothing the atlas has is dropped, never trusted');
ok(escribirUrl('?kiosko=1', { capa: 'especies', especie: null, estado: null }) === '?kiosko=1' && escribirUrl('?kiosko=1', { capa: 'metrica', especie: 'velasci', estado: null }) === '?kiosko=1&capa=metrica&especie=velasci', 'the default capa is left out, other parameters are kept, and the order is stable');
ok(CAPAS.length === 3, 'three capa values: especies, riqueza, metrica');
const { uiText } = await import('../src/components/atlas/uiText.ts');
const claves = (o) => Object.keys(o).sort().join();
ok(claves(uiText.es) === claves(uiText.en) && claves(uiText.es) === claves(uiText.pt), 'the UI words carry the same keys in es, en and pt');
ok(['measures', 'evidence', 'countries', 'systems'].every((k) => claves(uiText.es[k]) === claves(uiText.en[k]) && claves(uiText.es[k]) === claves(uiText.pt[k])), 'and the same measures, evidence classes, countries and systems');
ok(['es', 'en', 'pt'].every((l) => Object.values(uiText[l]).every((v) => typeof v !== 'string' || (v.length > 0 && !/^\s|\s$/.test(v)))), 'no UI word is empty or padded');
ok(!/[ÁÉÍÓÚáéíóúñ¿¡]/.test(JSON.stringify(uiText.en)) , 'the English words carry no Spanish letters');
const comp = (f) => readFileSync(join(SITE, 'src/components/atlas', f), 'utf8');
const tsx = ['Hud.tsx', 'IndexDrawer.tsx', 'DetailDrawer.tsx', 'StatePop.tsx', 'Legend.tsx'].map(comp).join('\n');
ok(!/>\s*[A-ZÁÉÍÓÚ][a-záéíóúñ]+(\s[a-záéíóúñ]+)*\s*</.test(tsx), 'no component carries a visible sentence of its own: every word comes from the i18n tables');
ok(!existsSync(join(SITE, 'src/components/atlas/LayerPanel.tsx')) && !existsSync(join(SITE, 'src/components/atlas/LayerCard.tsx')), 'the stacked layer panel is gone, not hidden');
// known positive: a card with download:true is caught by the same predicate
ok(![{ ...capa['uma-extensivas'], download: true }].every((c) => c.download === false), 'a layer with download:true would be caught');

// ---------------------------------------------------------------------------------------------
console.log('licence and geometry rules');
const archivos = (dir) => (existsSync(dir) ? readdirSync(dir, { recursive: true }).filter((f) => statSync(join(dir, f)).isFile()).map((f) => join(dir, f)) : []);
const commiteados = [...archivos(join(SITE, 'public')), ...archivos(join(SITE, 'src/data'))];
ok(!commiteados.some((f) => /umas-centroides|calidad-agua-2013|uma-extensivas|sitios-conagua/.test(f)), 'no NC layer file is in public/ or src/data/');
const capasAbiertas = [...archivos(join(SITE, 'public/atlas/layers')), ...archivos(join(SITE, 'src/data/atlas-snapshot'))].filter((f) => f.endsWith('.geojson') || f.endsWith('.json'));
const geometrias = new Map();
for (const f of capasAbiertas) {
  const g = JSON.parse(readFileSync(f, 'utf8'));
  for (const ft of g.features ?? []) geometrias.set(f.split('/').pop(), (geometrias.get(f.split('/').pop()) ?? new Set()).add(ft.geometry.type));
}
const conPuntos = [...geometrias].filter(([, t]) => t.has('Point')).map(([f]) => f);
ok(JSON.stringify(conPuntos) === JSON.stringify(['especies-localidades.geojson', 'instalaciones-catalogadas.geojson']), `the only committed layers with points are the facilities catalogue and the species localities (${conPuntos.join(', ') || 'none'})`);
// the localities hold no species record points: a lake of the whole range is a point (named), a cell is a 0.5° square, a municipality an INEGI centroid; nothing else
const localidades = JSON.parse(readFileSync(join(SITE, 'src/data/atlas-snapshot/especies-localidades.geojson'), 'utf8'));
ok(validarLocalidades(localidades).length === 0, `the species localities obey the generalization rules (${validarLocalidades(localidades).slice(0, 2).join('; ') || 'none broken'})`);
ok(localidades.features.every((f) => (f.geometry.type === 'Point') === (f.properties.generalization === 'named_water_body' || f.properties.generalization === 'municipality')), 'only a named water body or a municipality centroid is a point; a cell is always a polygon');
ok(localidades.features.filter((f) => f.properties.generalization === 'named_water_body').every((f) => f.properties.name && f.geometry.coordinates.every((c) => Math.abs(c * 100 - Math.round(c * 100)) < 1e-6)), 'a lake is named and its point is rounded to 0.01 degrees');
ok(!localidades.features.some((f) => f.properties.generalization === '0.5deg' && f.geometry.coordinates[0].some(([x, y]) => Math.abs(x * 2 - Math.round(x * 2)) > 1e-6 || Math.abs(y * 2 - Math.round(y * 2)) > 1e-6)), 'every cell corner is on the 0.5 degree grid');
// a planted breach is caught: a 0.05° cell, a point cell, a nameless lake
ok(validarLocalidades({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { slug: 'x', generalization: '0.5deg', sourceKey: 'k', source: 's' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [0.05, 0], [0.05, 0.05], [0, 0.05], [0, 0]]] } }] }).length === 1, 'a cell smaller than 0.5 degrees would be refused');
ok(validarLocalidades({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { slug: 'x', generalization: '0.5deg', sourceKey: 'k', source: 's' }, geometry: { type: 'Point', coordinates: [0, 0] } }] }).length === 1, 'a cell given as a point would be refused');
ok(validarLocalidades({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { slug: 'x', generalization: 'named_water_body', sourceKey: 'k', source: 's' }, geometry: { type: 'Point', coordinates: [0, 0] } }] }).length === 1, 'a lake with no name would be refused');
const instal = json('src/data/atlas-snapshot/instalaciones-catalogadas.geojson');
ok(instal.features.length > 0 && instal.features.every((f) => !('coord_fuente' in f.properties) && !('notas' in f.properties) && !('fuentes' in f.properties)), 'facilities carry no coordinate-source or note fields');

// ---------------------------------------------------------------------------------------------
console.log('facilities: municipality level, never an exact location (legal ruling of 7 Oct)');
const csvFilas = (texto) => {
  const filas = []; let fila = [], campo = '', comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else comillas = false; } else campo += c; }
    else if (c === '"') comillas = true; else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; } else campo += c;
  }
  const [cab, ...resto] = filas;
  return resto.filter((f) => f.length === cab.length).map((f) => Object.fromEntries(cab.map((k, i) => [k, f[i]])));
};
const inegi = new Map(csvFilas(readFileSync(join(SITE, 'scripts/fixtures/centroides-inegi.csv'), 'utf8')).map((r) => [`${r.cve_ent}|${r.cve_mun}`, r]));
ok(inegi.size > 0 && [...inegi.values()].every((r) => /INEGI/.test(r.fuente) && /Marco Geoestad/.test(r.fuente)), 'the INEGI centroid table the points are compared with names its source (Marco Geoestadístico)');
const sinCentroide = instal.features.filter((f) => !inegi.has(`${f.properties.cve_ent}|${f.properties.cve_mun}`));
ok(sinCentroide.length === 0, `every facility joins the INEGI table on cve_ent + cve_mun (${sinCentroide.map((f) => f.properties.id).join(', ') || 'all'})`);
const fueraDelCentroide = instal.features.filter((f) => { const c = inegi.get(`${f.properties.cve_ent}|${f.properties.cve_mun}`); return !c || f.geometry.type !== 'Point' || f.geometry.coordinates[0] !== Number(c.lon) || f.geometry.coordinates[1] !== Number(c.lat); });
ok(fueraDelCentroide.length === 0, `every point is exactly the INEGI centroid of its municipality or state (${fueraDelCentroide.map((f) => f.properties.id).join(', ') || 'all'})`);
// the INEGI fixture carries codes and centroids only (no place names); the names people read are the committed layer's, and each code has exactly one of them
const nombreDe = new Map(); const etiquetaFalsa = [];
for (const { properties: p } of instal.features) {
  const claves = [[`${p.cve_ent}|`, p.estado], ...(p.cve_mun ? [[`${p.cve_ent}|${p.cve_mun}`, p.municipio]] : [])];
  for (const [k, v] of claves) { if (!v) etiquetaFalsa.push(p.id); else if (nombreDe.has(k) && nombreDe.get(k) !== v) etiquetaFalsa.push(p.id); else nombreDe.set(k, v); }
  if (!p.cve_mun && p.municipio !== '') etiquetaFalsa.push(p.id);
}
ok(etiquetaFalsa.length === 0 && ![...inegi.values()].some((r) => 'nombre' in r), `the INEGI fixture has no place-name column, and the layer names each state and municipality code with one name (${etiquetaFalsa.join(', ') || 'all'})`);
ok(instal.features.every((f) => f.properties.nivel === (f.properties.cve_mun ? 'municipio' : 'estado') && f.properties.estado), 'each facility says its level (municipio, or estado when the row has no municipality) and its state');
ok(instal.features.every((f) => f.geometry.coordinates.every((v) => (String(v).split('.')[1] ?? '').length <= 4)), 'no coordinate has more precision than an INEGI centroid (four decimals)');
ok(!instal.features.some((f) => f.properties.id === 'mx-qro-axolotarium'), 'the other Querétaro row tied to a Zenbit mark stays out until the founder authorises it');
{
  // the pilot's row, as the agreement lets it be public: Annex 3 lists no pilot record, so it is a CLOSED row with its name, its place and the day it closed, and nothing else
  const piloto = instal.features.filter((f) => f.properties.id === 'mx-qro-xolotlcalli');
  const p = piloto[0]?.properties ?? {};
  const PERMITIDO = [...FILA_PILOTO.conservar].sort();
  ok(piloto.length === 1 && FILA_PILOTO.id === 'mx-qro-xolotlcalli' && Object.keys(p).sort().join() === PERMITIDO.join(), `the pilot row carries exactly its name, place, level, «cerrado» and the closing day (${Object.keys(p).sort().join(', ')})`);
  ok(p.nombre === FILA_PILOTO.nombre && p.estado_operacion === 'cerrado' && p.estado_fecha === FILA_PILOTO.estado_fecha && p.municipio === 'Querétaro' && p.estado === 'Querétaro' && p.nivel === 'municipio', `the pilot row says «${FILA_PILOTO.nombre}», closed on ${FILA_PILOTO.estado_fecha}, in Querétaro`);
  ok(!['tipo_recinto', 'tipo_legal', 'tipo_legal_fuente', 'especies', 'exhibicion_publica', 'verificacion'].some((k) => k in p), 'the pilot row has no facility type, legal figure, legal source, species, exhibition flag or verification');
  const otras = instal.features.filter((f) => f.properties.id !== 'mx-qro-xolotlcalli');
  ok(otras.length === 39 && otras.every((f) => PERMITIDAS_SNAPSHOT.every((k) => k in f.properties)), 'the other 39 rows keep every field of the facility table, untouched');
}
ok(instal.features.every((f) => (f.properties.id === 'mx-qro-xolotlcalli' && !('tipo_legal' in f.properties)) || (f.properties.tipo_legal === 'no consta' && f.properties.tipo_legal_fuente === '') || (f.properties.tipo_legal && /^https?:\/\//.test(f.properties.tipo_legal_fuente))), 'a legal figure appears only with a public source link; otherwise «no consta» (the pilot\'s closed row carries none at all)');
const retiradas = new Set(json('scripts/fixtures/coordenadas-retiradas.json').sha256);
const crypto = await import('node:crypto');
const TEXTO_DE_BUILD = new Set(['.json', '.geojson', '.html', '.js', '.mjs', '.cjs', '.css', '.txt', '.csv', '.map', '.xml', '.svg', '.astro', '.ts', '.tsx']);
const archivosDeBuild = (raiz) => (existsSync(raiz) ? readdirSync(raiz, { recursive: true }).map((f) => join(raiz, f)).filter((f) => statSync(f).isFile() && TEXTO_DE_BUILD.has(extname(f))) : []);
const raicesDeBuild = ['public', 'src', 'dist', '.astro', 'node_modules/.astro', 'node_modules/.vite'].map((r) => join(SITE, r));
const rastros = [];
for (const raiz of raicesDeBuild) for (const f of archivosDeBuild(raiz)) {
  if (statSync(f).size > 12 * 1024 * 1024) continue;
  for (const m of readFileSync(f, 'utf8').matchAll(/-?\d{1,3}\.\d{4,}/g)) if (retiradas.has(crypto.createHash('sha256').update(m[0]).digest('hex'))) { rastros.push(f.replace(SITE, '')); break; }
}
ok(rastros.length === 0, `no exact facility coordinate is left in public/, src/, dist/ or the build caches (${rastros.slice(0, 3).join(', ') || 'none'})`);
const capaInst = json('public/atlas/layers/manifest.json').capas.find((c) => c.id === 'instalaciones-catalogadas');
ok(capaInst.licence.id === 'CC-BY-4.0' && !/OpenStreetMap|ODbL/i.test(JSON.stringify(capaInst)), 'the facilities card carries the compilation licence (CC BY 4.0) and no OpenStreetMap or ODbL');
ok(['es', 'en', 'pt'].every((l) => /INEGI/.test(capaInst.attribution[l]) && /Marco Geoestad/.test(capaInst.attribution[l])), 'the card credits INEGI (Marco Geoestadístico) in its attribution, in es, en and pt');
ok(['es', 'en', 'pt'].every((l) => capaInst.aviso[l] === 'Directorio compilado de fuentes públicas. Ninguna instalación de esta tabla forma parte de la red ni la respalda. Para corregir o retirar una fila, escribe a hola@zenbit.mx; respondemos en diez días hábiles'), 'the card carries the page note exactly as the legal ruling wrote it');
ok(!instal.features.some((f) => /OpenStreetMap|nominatim/i.test(JSON.stringify(f))), 'no facility mentions OpenStreetMap or Nominatim');
{
  // the markers are pictograms on a backing, never a pin; the facilities stay at the centroid of their municipality and any spreading is on the screen only (scripts/lib/guardia-instalaciones.mjs)
  const alStyle = baseStyle();
  const capasInst = alStyle.layers.filter((l) => /^instalaciones/.test(l.source ?? ''));
  ok(capasInst.some((l) => l.id === 'instalaciones-puntos' && l.type === 'symbol') && capasInst.some((l) => l.id === 'instalaciones-halo' && l.type === 'circle'), 'facilities are a halo (an area) and the pictogram of their type on a backing');
  ok(sinPin(alStyle, ICONOS).length === 0, `no marker layer or icon is a pin (${sinPin(alStyle, ICONOS).join(', ') || 'none'})`);
  ok(guardiaPrecision(instal).length === 0 && guardiaCentroide(instal, csvDeCentroides(join(SITE, 'scripts/fixtures/centroides-inegi.csv'))).length === 0, 'every facility is at the INEGI centroid of its municipality or state, with no finer precision');
  const coords = instal.features.map((f) => f.geometry.coordinates);
  const anclas = coords.map((c, i) => [(c[0] + 103) * 120 + (i % 2), (20 - c[1]) * 120]);
  const desp = separar(anclas, coords);
  const congelada = JSON.parse(JSON.stringify(instal));
  ok(guardiaAbanico(prepararInstalaciones, congelada, desp).length === 0, 'the screen offsets live in a property: the GeoJSON handed to the markers has every geometry it came with, and its input is unchanged');
  const lejos = desp.filter((d) => Math.hypot(d[0], d[1]) > 90.5).length, cerca = (() => { const q = anclas.map((a, i) => [a[0] + desp[i][0], a[1] + desp[i][1]]); let n = 0; for (let i = 0; i < q.length; i++) for (let j = i + 1; j < q.length; j++) if (Math.hypot(q[i][0] - q[j][0], q[i][1] - q[j][1]) < 29) n++; return n; })();
  ok(lejos === 0 && cerca === 0, `markers end at least 29 px apart and no marker is more than 90 px from its place (${cerca} pairs too close, ${lejos} too far)`);
  const gemelos = abanicoDe([[1, 1], [1, 1], [1, 1], [2, 2]]);
  ok(gemelos[3][0] === 0 && gemelos[3][1] === 0 && new Set(gemelos.slice(0, 3).map((d) => d.join())).size === 3, 'facilities sharing a coordinate fan out; a lone one stays on its place');
}
const ordenadas = filasDeInstalaciones(instal.features.map((f) => f.properties));
ok(ordenadas.length === instal.features.length && ordenadas.every((p, i) => i === 0 || ordenadas[i - 1].estado.localeCompare(p.estado, 'es') <= 0), 'the facilities table lists every facility of the map, by state');
ok(filasDeInstalaciones([{ estado: 'B', nivel: 'estado', municipio: '', nombre: 'z' }, { estado: 'B', nivel: 'municipio', municipio: 'Uno', nombre: 'y' }, { estado: 'A', nivel: 'municipio', municipio: 'Dos', nombre: 'x' }]).map((p) => p.nombre).join('') === 'xyz', 'the table sorts by state, then municipality, with the rows that have no municipality last');
const metricasEstado = json('src/data/atlas-snapshot/estados-metricas.json').estados;
const porEstado = {};
for (const f of instal.features) porEstado[f.properties.iso] = (porEstado[f.properties.iso] ?? 0) + 1;
ok(Object.entries(porEstado).every(([iso, n]) => metricasEstado[iso].instalaciones_ajolote >= n) && metricasEstado['MX-QUE'].instalaciones_ajolote === porEstado['MX-QUE'], `the state count of facilities never discloses a row the layer does not show (Querétaro ${metricasEstado['MX-QUE'].instalaciones_ajolote}, layer ${porEstado['MX-QUE']})`);
ok(lugarDeInstalacion({ nivel: 'municipio', municipio: 'Pinal de Amoles', estado: 'Querétaro' }, 'en') === 'en Pinal de Amoles, Querétaro' && lugarDeInstalacion({ nivel: 'estado', municipio: '', estado: 'Ciudad de México' }, 'en') === 'en Ciudad de México' && lugarDeInstalacion({ nivel: 'municipio', municipio: 'Cancún', estado: 'Quintana Roo' }, 'in') === 'in Cancún, Quintana Roo', 'a facility is labelled «en <municipio>, <estado>» (or «en <estado>»), in each language\'s word for «in»');
ok(!manifest.capas.some((c) => /gbif|occurrence|ocurrencia/i.test(JSON.stringify(c))), 'no layer card mentions GBIF or occurrence records');
ok(!capasAbiertas.some((f) => /gbif|occurrence|ocurrencia/i.test(f)), 'no layer file is a GBIF or occurrence layer');
// known positive: an occurrence-style layer is caught by the same rules
ok(/gbif|occurrence|ocurrencia/i.test('gbif-ocurrencias.geojson') && new Set(['Point']).has('Point'), 'a GBIF points layer would be caught');
const especies = json('src/data/atlas-snapshot/especies-por-estado.json');
ok(Object.values(especies.estados).every((l) => Array.isArray(l) && l.every((s) => typeof s === 'string')), 'the species layer is names per state, not coordinates');

// ---------------------------------------------------------------------------------------------
console.log('registry: the hub\'s real shapes, live, with the build list as fallback');
// the shapes of the hub's contract: every answer is `{ schemaVersion, generatedAt, data }`; /v1/orgs is a list of summaries WITHOUT coordinates and
// /v1/orgs/{slug} adds `sites[]` with generalized `latGen` and `lonGen`; /v1/layers lists layers with their GeoJSON path, licence and citation
const envoltura = (data) => ({ schemaVersion: '1', generatedAt: '2026-10-07T12:00:00.000Z', data });
const resumen = (slug, nombre, nivel, estado = 'MX-QUE') => ({ slug, orgUid: '0x' + 'ab'.repeat(32), displayName: nombre, orgType: 1, legalFigure: 1, state: estado,
  verification: { level: nivel, method: 1, expiresAt: null }, species: ['Ambystoma mexicanum'], receivesVisitors: true, ensName: null, listedAt: '2026-10-01T00:00:00.000Z' });
const detalle = (slug, nombre, nivel, lat, lon) => ({ ...resumen(slug, nombre, nivel), publicDescription: null,
  sites: [{ siteUid: '0x' + 'cd'.repeat(32), state: 'MX-QUE', municipalityCode: null, latGen: lat, lonGen: lon, gridCdeg: 10, licence: { spdx: 'LicenseRef-zenbit-pilot-2026' }, units: [] }] });
const capasHub = [{ slug: 'umas-centroides', title: 'UMA', kind: 'points', geojson: '/v1/layers/umas-centroides.geojson', licence: { spdx: 'CC-BY-NC-2.5' }, citation: 'CONABIO, UMA, 2020' }];
const ruta = (url) => new URL(url).pathname;
const hubStub = (overrides = {}) => async (url) => {
  const p = ruta(url);
  if (overrides[p]) return overrides[p]();
  if (p === '/v1/orgs') return { ok: true, json: async () => envoltura([resumen('recinto-uno', 'Recinto uno', 2), resumen('recinto-dos', 'Recinto dos', 0, 'MX-JAL')]) };
  if (p === '/v1/orgs/recinto-uno') return { ok: true, json: async () => envoltura(detalle('recinto-uno', 'Recinto uno', 2, 20.59, -100.39)) };
  if (p === '/v1/orgs/recinto-dos') return { ok: true, json: async () => envoltura({ ...detalle('recinto-dos', 'Recinto dos', 0, null, null), sites: [{ siteUid: '0x00', state: 'MX-JAL', municipalityCode: null, latGen: null, lonGen: null, gridCdeg: 10, licence: { spdx: 'x' }, units: [] }] }) };
  if (p === '/v1/layers') return { ok: true, json: async () => envoltura(capasHub) };
  if (p === '/v1/layers/umas-centroides.geojson') return { ok: true, json: async () => ({ type: 'FeatureCollection', features: [] }) };
  return { ok: false, status: 404, json: async () => ({}) };
};
const enBuild = async () => [detalle('de-la-compilacion', 'De la compilación', 1, 19.4, -99.1)];
const vivo = await liveOrBuild('https://hub.example', () => organizacionesEnVivo('https://hub.example', { fetchFn: hubStub() }), enBuild);
const pts = organizacionesComoPuntos(vivo.data);
ok(vivo.live === true && vivo.data.length === 2, 'with a registry that answers, the list is live (both listed organizations)');
ok(pts.features.length === 1 && pts.features[0].properties.registrada === true && pts.features[0].properties.nivel === 2 && pts.features[0].geometry.coordinates[0] === -100.39,
  'a point appears at the generalized site coordinates with its verification level, and an organization with no coordinates is kept off the map');
const sinDetalle = await organizacionesEnVivo('https://hub.example', { fetchFn: hubStub({ '/v1/orgs/recinto-uno': async () => ({ ok: false, status: 500, json: async () => ({}) }) }) });
ok(sinDetalle.length === 2 && organizacionesComoPuntos(sinDetalle).features.length === 0, 'an organization whose detail fails stays in the list, off the map');
const stubCaido = async () => { throw new Error('hub down'); };
const stub500 = async () => ({ ok: false, status: 500, json: async () => ({}) });
const lento = (_, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('timeout'))));
for (const [nombre, f] of [['down', stubCaido], ['500', stub500]]) {
  const r = await liveOrBuild('https://hub.example', () => organizacionesEnVivo('https://hub.example', { fetchFn: f }), enBuild);
  ok(r.live === false && r.data[0]?.displayName === 'De la compilación' && organizacionesComoPuntos(r.data).features.length === 1, `with the registry ${nombre}, the build list is used and it is not empty`);
}
const t0 = Date.now();
const r = await liveOrBuild('https://hub.example', () => organizacionesEnVivo('https://hub.example', { ms: 80, fetchFn: lento }), enBuild);
ok(r.live === false && Date.now() - t0 < 2000, 'a registry that does not answer in time falls back within the timeout');
ok((await liveOrBuild('', () => { throw new Error('unused'); }, enBuild)).live === false, 'without a registry URL the build list is used');
const lista = await capasDelRegistro('https://hub.example', { fetchFn: hubStub() });
ok(lista.length === 1 && lista[0].slug === 'umas-centroides' && lista[0].citation === 'CONABIO, UMA, 2020', 'the layers list is read from the envelope with its citation');
ok((await geojsonDeCapa('https://hub.example', lista[0], { fetchFn: hubStub() })).type === 'FeatureCollection', 'a layer is fetched by the path the registry announced');
ok(await geojsonDeCapa('https://hub.example', { geojson: 'https://evil.example/x.geojson' }, { fetchFn: hubStub() }).then(() => false, () => true), 'a path the registry did not announce under /v1/layers/ is refused');

console.log('build snapshot: the atlas data from the hub at build, the committed files as the fallback, file by file');
{
  const sitio = archivosDelSitio(SITE);
  const sha = (t) => '0x' + crypto.createHash('sha256').update(t, 'utf8').digest('hex');
  const cuerpoEspecies = JSON.stringify({ type: 'FeatureCollection', features: Object.entries(sitio.archivo['especies-por-estado.json'].estados)
    .map(([iso, especies]) => ({ type: 'Feature', geometry: null, properties: { iso, especies } })) });
  const cuerpoInst = JSON.stringify({ type: 'FeatureCollection', features: sitio.archivo['instalaciones-catalogadas.geojson'].features });
  const fila = (slug, cuerpo, properties) => ({ slug, title: slug, kind: 'x', geojson: `/v1/layers/${slug}.geojson`, geojsonSha256: sha(cuerpo), properties, licence: { spdx: 'x' }, citation: 'c' });
  const estadosMetrica = Object.keys(sitio.archivo['estados-metricas.json'].estados).map((iso) => ({ state: iso, value: '7', uom: null, observedFromYear: 2021, observedYear: 2024, source: null, licence: { spdx: 'x' } }));
  // a hub that answers like the hub: an envelope everywhere, the GeoJSON as the exact text its list pins
  const hubSnap = ({ cuerpos = {}, filas = {}, metricas = { pimvs_registrados_2021_2024: estadosMetrica } } = {}) => async (url) => {
    const u = new URL(url);
    const especies = cuerpos.especies ?? cuerpoEspecies, inst = cuerpos.inst ?? cuerpoInst;
    if (u.pathname === '/v1/layers') return { ok: true, json: async () => envoltura([filas.especies ?? fila('especies-por-estado', especies, ['iso', 'cve_ent', 'nombre', 'especies']), filas.inst ?? fila('instalaciones-catalogadas', inst, PERMITIDAS_SNAPSHOT)]) };
    if (u.pathname === '/v1/layers/especies-por-estado.geojson') return { ok: true, text: async () => especies };
    if (u.pathname === '/v1/layers/instalaciones-catalogadas.geojson') return { ok: true, text: async () => inst };
    if (u.pathname === '/v1/states/metrics') { const k = u.searchParams.get('key'); return { ok: true, json: async () => envoltura({ key: k, states: metricas[k] ?? [] }) }; }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const tomar = (nombre, fetchFn, hubUrl = 'https://hub.example') => instantanea(nombre, { hubUrl, sitio, fetchFn, aviso: (m) => { if (process.env.ATLAS_TEST_VERBOSE) console.log(`    · ${m}`); } });
  const e = await tomar('especies-por-estado.json', hubSnap());
  ok(e.fuente === 'hub' && JSON.stringify(e.estados) === JSON.stringify(sitio.archivo['especies-por-estado.json'].estados), 'species by state come from the hub when its layer is whole');
  const i = await tomar('instalaciones-catalogadas.geojson', hubSnap());
  ok(i.fuente === 'hub' && i.features.length === 40, 'the facilities come from the hub when every point is an INEGI centroid');
  const m = await tomar('estados-metricas.json', hubSnap());
  ok(m.fuentes.pimvs_registrados_2021_2024 === 'hub' && Object.values(m.estados).every((v) => v.pimvs_registrados_2021_2024 === 7)
    && m.fuentes.especies_ambystoma_pace === 'archivo' && m.estados['MX-CMX'].especies_ambystoma_pace === sitio.archivo['estados-metricas.json'].estados['MX-CMX'].especies_ambystoma_pace,
    'a metric the hub has comes from the hub; a metric it does not have keeps the committed values');
  const otroCuerpo = cuerpoEspecies.replace('Ambystoma', 'Ambystoma ');
  const casos = [
    ['especies-por-estado.json', hubSnap({ cuerpos: { especies: otroCuerpo }, filas: { especies: fila('especies-por-estado', cuerpoEspecies, ['iso', 'cve_ent', 'nombre', 'especies']) } }), 'bytes that are not the ones the list pins'],
    ['especies-por-estado.json', hubSnap({ filas: { especies: fila('especies-por-estado', cuerpoEspecies, ['iso']) } }), 'a property the list does not declare'],
    ['especies-por-estado.json', hubSnap({ cuerpos: { especies: JSON.stringify({ ...JSON.parse(cuerpoEspecies), crs: {} }) } }), 'a key other than type and features'],
    ['instalaciones-catalogadas.geojson', hubSnap({ cuerpos: { inst: JSON.stringify({ type: 'FeatureCollection', features: sitio.archivo['instalaciones-catalogadas.geojson'].features.map((f, n) => (n ? f : { ...f, geometry: { type: 'Point', coordinates: [f.geometry.coordinates[0] + 0.0001, f.geometry.coordinates[1]] } })) }) } }), 'a facility off its INEGI centroid'],
    ['instalaciones-catalogadas.geojson', hubSnap({ cuerpos: { inst: JSON.stringify({ type: 'FeatureCollection', features: sitio.archivo['instalaciones-catalogadas.geojson'].features.map((f, n) => (n ? f : { ...f, properties: { ...f.properties, coord_fuente: 'x' } })) }) } }), 'a facility with a property outside the allowlist, even one the hub list declares'],
    ['especies-por-estado.json', async () => { throw new Error('down'); }, 'a hub that is down'],
  ];
  for (const [nombre, f, porque] of casos) {
    const r = await tomar(nombre, f);
    ok(r.fuente === 'archivo' && sinSello(r) === sinSello(sitio.archivo[nombre]), `${nombre}: the committed file with ${porque}`);
  }
  // the last case, written with the allowlist the hub list declares: the extra property is declared there, and still refused here
  const conDeclarada = await tomar('instalaciones-catalogadas.geojson', hubSnap({ cuerpos: { inst: casos[4][1] && JSON.stringify({ type: 'FeatureCollection', features: sitio.archivo['instalaciones-catalogadas.geojson'].features.map((f, n) => (n ? f : { ...f, properties: { ...f.properties, coord_fuente: 'x' } })) }) },
    filas: { inst: fila('instalaciones-catalogadas', JSON.stringify({ type: 'FeatureCollection', features: sitio.archivo['instalaciones-catalogadas.geojson'].features.map((f, n) => (n ? f : { ...f, properties: { ...f.properties, coord_fuente: 'x' } })) }), [...PERMITIDAS_SNAPSHOT, 'coord_fuente']) } }));
  ok(conDeclarada.fuente === 'archivo', 'a facility property outside the site\'s allowlist falls back even when the hub declares it');
  const fueraDeEstados = await tomar('estados-metricas.json', hubSnap({ metricas: { pimvs_registrados_2021_2024: [...estadosMetrica, { ...estadosMetrica[0], state: 'MX-XXX' }] } }));
  ok(fueraDeEstados.fuentes.pimvs_registrados_2021_2024 === 'archivo', 'a metric that names a state the atlas does not have keeps the committed values');
  ok((await tomar('especies-por-estado.json', hubSnap(), '')).fuente === 'archivo', 'without a hub URL the build carries the committed files');
  const importador = readFileSync(join(SITE, 'scripts/import-atlas-layers.mjs'), 'utf8');
  const listaImportador = /const PERMITIDAS = \[([\s\S]*?)\];/.exec(importador)?.[1].match(/'([a-z_]+)'/g)?.map((x) => x.slice(1, -1));
  ok(JSON.stringify(listaImportador) === JSON.stringify(PERMITIDAS_SNAPSHOT), 'the snapshot allows exactly the facility properties the importer writes');

  // the genus atlas: a hub that answers like feat/hub-taxa-na, made from the committed files, and what happens when it lies
  const shaHex = (t) => sha(t).slice(2);
  const atlasC = sitio.archivo['especies-atlas.json'], locC = sitio.archivo['especies-localidades.geojson'], admC = sitio.archivo['admin1.geojson'];
  const fuenteDe = (clave) => { const f = atlasC.fuentes.find((x) => x.key === clave); return f ? { key: f.key, title: f.title, publisher: f.publisher, url: f.url, citation: f.citation } : null; };
  const licDe = (clave) => ({ spdx: atlasC.fuentes.find((x) => x.key === clave)?.licence ?? 'LicenseRef-axolodao-sitio', commercialOk: !atlasC.fuentes.find((x) => x.key === clave)?.citeOnly, attributionRequired: false });
  const largo = (slug) => `ambystoma_${slug}`;
  const cuerposGenus = () => {
    const r = new Map();
    const json = (ruta, data, etag) => r.set(ruta, { json: envoltura(data), etag });
    const lista = atlasC.especies.map((e) => ({ slug: largo(e.slug), scientificName: e.scientificName }));
    json('/v1/species', lista);
    for (const e of atlasC.especies) {
      const perfil = [];
      for (const [campo, porIdioma] of Object.entries(e.profile?.campos ?? {})) for (const [locale, body] of Object.entries(porIdioma)) perfil.push({ field: campo, locale, body, verbatim: false, draft: e.profile.draft, source: fuenteDe(e.profile.source), licence: licDe(e.profile.source) });
      json(`/v1/species/${largo(e.slug)}`, { slug: largo(e.slug), scientificName: e.scientificName, authorship: e.authorship, aswAccepted: e.aswAccepted ? largo(e.aswAccepted) : null, countries: e.countries, synonyms: [],
        categories: e.categories.map(({ source: k, ...c }) => ({ ...c, unit: e.scientificName, sourceKey: k })), source: fuenteDe(e.source), licence: licDe(e.source), profile: perfil,
        morphometrics: e.morphometrics.map(({ source: k, ...m }) => ({ min: null, max: null, mean: null, n: null, ...m, source: fuenteDe(k), licence: licDe(k) })) });
      json(`/v1/species/${largo(e.slug)}/presence`, { slug: largo(e.slug), scientificName: e.scientificName, presence: atlasC.presencia[e.slug].map(([iso, evidence, k]) => ({ iso, country: iso.slice(0, 2), evidence, note: null, source: fuenteDe(k), licence: licDe(k) })) });
      r.set(`/v1/species/${largo(e.slug)}/localities.geojson`, { text: JSON.stringify({ type: 'FeatureCollection', features: locC.features.filter((f) => f.properties.slug === e.slug).map((f) => ({ type: 'Feature', geometry: f.geometry, properties: { generalization: f.properties.generalization, name: f.properties.name, sourceKey: f.properties.sourceKey, source: f.properties.source, citation: f.properties.citation, licence: f.properties.licence } })) }) });
    }
    const cuerpo = JSON.stringify({ type: 'FeatureCollection', features: admC.features.map((f) => ({ type: 'Feature', properties: f.properties, geometry: f.geometry })) });
    r.set('/v1/admin1.geojson', { text: cuerpo, etag: `"${shaHex(cuerpo)}"` });
    json('/v1/admin1', admC.features.map((f) => ({ ...f.properties, geometrySha256: `0x${shaHex(JSON.stringify(f.geometry))}`, source: { title: 'x', citation: 'c' }, licence: { spdx: 'x', commercialOk: true, attributionRequired: false } })));
    return r;
  };
  const hubGenus = (cambiar = () => {}) => {
    const r = cuerposGenus();
    cambiar(r);
    const llamadas = [];
    const f = async (url) => {
      const ruta = new URL(url).pathname;
      llamadas.push(ruta);
      const x = r.get(ruta);
      if (!x) return { ok: false, status: 404, json: async () => ({}), text: async () => '', headers: { get: () => null } };
      return { ok: true, json: async () => x.json ?? JSON.parse(x.text), text: async () => x.text ?? JSON.stringify(x.json), headers: { get: (k) => (k.toLowerCase() === 'etag' ? x.etag ?? null : null) } };
    };
    f.llamadas = llamadas;
    return f;
  };
  const llaves = (xs, f) => xs.map(f).sort().join('\n');
  const f0 = hubGenus();
  const gAtlas = await tomar('especies-atlas.json', f0), gLoc = await tomar('especies-localidades.geojson', f0), gAdm = await tomar('admin1.geojson', f0);
  ok(gAtlas.fuente === 'hub' && gLoc.fuente === 'hub' && gAdm.fuente === 'hub', 'the genus atlas comes from the hub when every route answers in shape');
  ok(f0.llamadas.filter((u) => u === '/v1/species').length === 1, 'the two species files share one read of the species routes');
  ok(llaves(gAtlas.especies, (e) => e.slug) === llaves(atlasC.especies, (e) => e.slug), 'the hub species are the committed species, by short slug');
  ok(atlasC.especies.every((e) => llaves(gAtlas.presencia[e.slug], ([iso, ev]) => `${iso}|${ev}`) === llaves(atlasC.presencia[e.slug], ([iso, ev]) => `${iso}|${ev}`)), 'every presence row (unit and evidence) is the committed one');
  ok(llaves(gLoc.features, (f) => `${f.properties.slug}|${f.properties.generalization}|${JSON.stringify(f.geometry)}`) === llaves(locC.features, (f) => `${f.properties.slug}|${f.properties.generalization}|${JSON.stringify(f.geometry)}`), 'every locality (cell, lake, geometry) is the committed one');
  ok(atlasC.especies.every((e) => { const h = gAtlas.especies.find((x) => x.slug === e.slug); return llaves(h.categories, (c) => `${c.system}|${c.scope}|${c.category}`) === llaves(e.categories, (c) => `${c.system}|${c.scope}|${c.category}`)
    && llaves(h.morphometrics, (m) => `${m.measure}|${m.stage}|${m.sex}|${m.mean}`) === llaves(e.morphometrics, (m) => `${m.measure}|${m.stage}|${m.sex}|${m.mean}`) && JSON.stringify(h.profile?.campos ?? null) === JSON.stringify(e.profile?.campos ?? null) && h.aswAccepted === e.aswAccepted; }), 'categories, measurements, profile and accepted name arrive as committed');
  // the sources are named by the hub's stable keys, and they are the keys of the committed files: a record cites the same source from either
  ok(atlasC.especies.every((e) => { const h = gAtlas.especies.find((x) => x.slug === e.slug); return h.source === e.source && h.profile?.source === e.profile?.source
    && JSON.stringify(h.categories.map((c) => c.source)) === JSON.stringify(e.categories.map((c) => c.source))
    && llaves(h.morphometrics, (m) => `${m.measure}|${m.stage}|${m.sex}|${m.source}`) === llaves(e.morphometrics, (m) => `${m.measure}|${m.stage}|${m.sex}|${m.source}`)
    && llaves(gAtlas.presencia[e.slug], (r) => r.join('|')) === llaves(atlasC.presencia[e.slug], (r) => r.join('|')); }), 'every record cites the same source key from the hub as from the committed file (species, profile, categories, measurements, presence rows)');
  ok(llaves(gLoc.features, (f) => `${f.properties.slug}|${f.properties.sourceKey}`) === llaves(locC.features, (f) => `${f.properties.slug}|${f.properties.sourceKey}`) && locC.features.every((f) => typeof f.properties.sourceKey === 'string'), 'and every locality carries the same sourceKey');
  ok(gAtlas.fuentes.every((f) => atlasC.fuentes.some((c) => c.key === f.key && c.title === f.title)) && gAtlas.fuentes.length >= 20, `the sources the hub names are committed sources with the same title (${gAtlas.fuentes.length} of ${atlasC.fuentes.length})`);
  ok(gAdm.features.length === 96 && admC.features.every((f, n) => JSON.stringify(gAdm.features[n]) === JSON.stringify({ type: 'Feature', properties: f.properties, geometry: f.geometry })), 'the 96 admin-1 units from the hub are the committed ones, geometry byte for byte');
  // the hub stores each geometry with the newline that ends it and pins THOSE bytes: a geometry followed by JSON whitespace passes; a changed coordinate, or any other byte after the brace, does not
  {
    const cuerpoCon = (cola, cambio = (t) => t) => { const feats = admC.features.map((f) => `{"type":"Feature","properties":${JSON.stringify(f.properties)},"geometry":${JSON.stringify(f.geometry)}${cola}}`); return cambio(`{"type":"FeatureCollection","features":[${feats.join(',')}]}`); };
    const hubConCola = (cola, { cambio, shaCola = cola } = {}) => hubGenus((r) => {
      const t = cuerpoCon(cola, cambio); r.set('/v1/admin1.geojson', { text: t, etag: `"${shaHex(t)}"` });
      r.get('/v1/admin1').json.data.forEach((u, n) => { u.geometrySha256 = `0x${shaHex(JSON.stringify(admC.features[n].geometry) + shaCola)}`; });
    });
    ok((await tomar('admin1.geojson', hubConCola('\n'))).fuente === 'hub' && (await tomar('admin1.geojson', hubConCola(' \r\n\t'))).fuente === 'hub', 'admin1: a geometry stored with a trailing newline (or other JSON whitespace) passes, and the hash is of those stored bytes');
    ok((await tomar('admin1.geojson', hubConCola('\n', { shaCola: '' }))).fuente === 'archivo', 'admin1: the same stored bytes against a hash that left the newline out do not pass (the bytes pinned are the stored ones)');
    ok((await tomar('admin1.geojson', hubConCola('\n', { cambio: (t) => t.replace(/(-?\d+\.\d+)/, (m) => String(Number(m) + 0.001)) }))).fuente === 'archivo', 'admin1: a changed coordinate fails');
    ok((await tomar('admin1.geojson', hubConCola('\n,"extra":1'))).fuente === 'archivo' && (await tomar('admin1.geojson', hubConCola('\nx'))).fuente === 'archivo', 'admin1: a non-whitespace byte after the geometry\'s brace fails');
    ok((() => { try { geometriasCrudas('{"geometry":{"a":1}x}'); return false; } catch { return true; } })() && geometriasCrudas('{"geometry":{"a":1}\n}')[0] === '{"a":1}\n', 'admin1: the parser returns the geometry with its trailing whitespace and refuses a stray byte');
  }
  // a build with a hub URL is STRICT: a file that falls back stops the build naming the file and the reason; what the hub gives in full must equal the committed file, property by property
  {
    const estricto = (nombre, fetchFn) => instantanea(nombre, { hubUrl: 'https://hub.example', sitio, fetchFn, estricto: true });
    const falla = async (nombre, fetchFn, re) => { try { await estricto(nombre, fetchFn); return null; } catch (e) { return re.test(e.message) ? e.message : `wrong message: ${e.message}`; } };
    const f429 = async () => ({ ok: false, status: 429, json: async () => ({}), text: async () => '', headers: { get: () => null } });
    const nombres = [];
    for (const n of ARCHIVOS) { const m = await falla(n, f429, new RegExp(n === 'estados-metricas.json' ? `^${n.replace('.', '\\.')}: (the hub's data is not the committed file's: metric .*the hub had no values|no metric came from the hub)` : `^${n.replace('.', '\\.')}: the hub read fell back to the committed file \\(.*429`)); if (m !== null && m.startsWith('wrong')) nombres.push(m); if (m === null) nombres.push(`${n}: did not fail`); }
    ok(nombres.length === 0, `strict: with the hub answering 429, each of the ${ARCHIVOS.length} files stops the build naming itself and the status${nombres.length ? ': ' + nombres.join(' | ') : ''}`);
    ok((await tomar('instalaciones-catalogadas.geojson', f429)).fuente === 'archivo', 'not strict (no hub URL in the build): the same failure still falls back quietly, as before');
    // metrics: a metric the hub does not serve is «derivado» (computed at build from hub-read inputs, named in its fuente) or the ONE declared committed metric; anything else stops the build
    {
      const filasDe = (id) => Object.entries(sitio.archivo['estados-metricas.json'].estados).map(([iso, v]) => ({ state: iso, value: String(v[id]), uom: null, observedFromYear: 2021, observedYear: 2024, source: null, licence: { spdx: 'x' } }));
      const delHub = (ids) => Object.fromEntries(ids.map((id) => [id, filasDe(id)]));
      const todas = ['pimvs_registrados_2021_2024', 'uma_extensivas_registradas_1992_2024', 'uma_intensivas_registradas_1999_2024'];
      const m = await estricto('estados-metricas.json', hubSnap({ metricas: delHub(todas) }));
      ok(m.fuente === 'hub' && todas.every((id) => m.fuentes[id] === 'hub') && m.fuentes.especies_ambystoma_pace === 'derivado: especies-por-estado.json' && m.fuentes.instalaciones_ajolote === 'derivado: instalaciones-catalogadas.geojson' && m.fuentes.uma_por_100k_hab === 'archivo: INEGI', `strict metrics: served ones «hub», the species count and the facility count «derivado» from hub-read inputs, and exactly one declared committed metric (${METRICAS_ARCHIVO.join(', ')})`);
      ok(METRICAS_ARCHIVO.join() === 'uma_por_100k_hab' && /metric uma_extensivas_registradas_1992_2024: the hub had no values and it is not derived or declared/.test(await falla('estados-metricas.json', hubSnap({ metricas: delHub(['pimvs_registrados_2021_2024', 'uma_intensivas_registradas_1999_2024']) }), /not the committed file's/) ?? ''), 'strict metrics: any other metric the hub lacks stops the build and names the metric');
      ok(/metric especies_ambystoma_pace/.test(await falla('estados-metricas.json', hubSnap({ metricas: delHub(todas), cuerpos: { especies: JSON.stringify({ type: 'FeatureCollection', features: [] }) } }), /./) ?? ''), 'strict metrics: with the species layer unreadable from the hub, the derived metric is not derived and the build stops');
    }
    // parity: the hub equal to the committed file passes; the drift of today's hub (the pilot row\'s name and date) does not
    const igual = await estricto('instalaciones-catalogadas.geojson', hubSnap());
    ok(igual.fuente === 'hub' && igual.features.length === 40, 'strict parity: a hub whose 40 facilities equal the committed ones, every property, passes');
    ok(igual.paridadHub === true && JSON.stringify(igual.generadoDe?.bundles) === JSON.stringify(sitio.archivo['instalaciones-catalogadas.geojson'].generadoDe.bundles) && (await tomar('instalaciones-catalogadas.geojson', hubSnap())).paridadHub === undefined && (await tomar('instalaciones-catalogadas.geojson', f429)).paridadHub === undefined && (await tomar('instalaciones-catalogadas.geojson', f429)).generadoDe?.bundles === undefined, 'strict parity: a hub read that passed carries paridadHub true and the committed bundles; a read without the strict check, or a fallback to the committed file, carries no bundles and no paridadHub');
    // the shared read: one cached read per file for every caller; the hub the build reads is HUB_BUILD_URL (never the browser's); a foreign paridadHub never survives; a fallback never carries one
    {
      let llamadas = 0; const hub = hubSnap(); const contado = async (...a) => { llamadas++; return hub(...a); };
      const base = { env: { HUB_BUILD_URL: 'https://hub.example' }, sitio, cache: new Map(), aviso: () => {}, fetchFn: contado };
      const a1 = await leerAtlas('instalaciones-catalogadas.geojson', base); const n1 = llamadas; const a2 = await leerAtlas('instalaciones-catalogadas.geojson', base);
      ok(a1 === a2 && llamadas === n1 && n1 > 0 && a1.paridadHub === true && a1.fuente === 'hub', 'shared read: the route and the hero get the very same object from one hub read per file (paridadHub true on a strict match)');
      ok((await leerAtlas('instalaciones-catalogadas.geojson', { ...base, cache: new Map(), env: {}, publica: 'https://hub.example' })).paridadHub === true && hubDelBuild('https://publica.example', { HUB_BUILD_URL: 'https://local.example' }) === 'https://local.example' && hubDelBuild('https://publica.example', {}) === 'https://publica.example' && hubDelBuild('', {}) === '', 'shared read: HUB_BUILD_URL wins, else the public URL, else no hub');
      ok((await leerAtlas('instalaciones-catalogadas.geojson', { ...base, cache: new Map(), env: { HUB_BUILD_URL: 'https://hub.example', ATLAS_HUB_LAXO: '1' }, fetchFn: f429 })).paridadHub === undefined, 'shared read: a build that is not strict and fell back carries no paridadHub');
      const conAjeno = { ...sitio, archivo: { ...sitio.archivo, 'admin1.geojson': { ...sitio.archivo['admin1.geojson'], paridadHub: true } } };
      ok((await instantanea('admin1.geojson', { hubUrl: 'https://hub.example', sitio: conAjeno, fetchFn: f429, aviso: () => {} })).paridadHub === undefined, 'a fallback to a committed file that carries paridadHub strips it');
      // review 2/3: one fetch wrapper (one keyed fetch, one genus read) per hub URL for all six files, not one per file
      {
        const dirK = mkdtempSync(join(tmpdir(), 'clave2-')); const kf = join(dirK, 'k'); writeFileSync(kf, 'SECRETO-2\n', { mode: 0o600 });
        const hubA = hubSnap(), hubB = hubGenus(); const peticiones = [], cabeceras = new Set(); const realFetch = globalThis.fetch;
        globalThis.fetch = async (url, o) => { const p = new URL(url).pathname; peticiones.push(p); cabeceras.add(o?.headers?.['x-clave']); return (p.startsWith('/v1/species') || p.startsWith('/v1/admin1') ? hubB : hubA)(url, o); };
        try {
          const cacheW = new Map(), envW = { HUB_BUILD_URL: 'https://hub.example', HUB_KEY_FILE: kf, HUB_KEY_HEADER: 'x-clave', ATLAS_HUB_LAXO: '1' };
          for (const n of ARCHIVOS) await leerAtlas(n, { env: envW, sitio, cache: cacheW, aviso: () => {} });
          ok(peticiones.filter((p) => p === '/v1/species').length === 1 && peticiones.filter((p) => p === '/v1/admin1').length === 1 && [...cabeceras].every((c) => c === 'SECRETO-2'), `review 2/3: the six files share one keyed fetch: the species list is read once and the admin1 list once (saw ${peticiones.filter((p) => p === '/v1/species').length} and ${peticiones.filter((p) => p === '/v1/admin1').length}), every request carries the key`);
        } finally { globalThis.fetch = realFetch; rmSync(dirK, { recursive: true, force: true }); }
      }
      // review 4: hub features are rebuilt as exactly {type, properties, geometry}
      {
        const conExtra = JSON.stringify({ type: 'FeatureCollection', features: sitio.archivo['instalaciones-catalogadas.geojson'].features.map((f) => ({ ...f, id: 'z', bbox: [0, 0, 0, 0], foreign: { a: 1 } })) });
        const r = await instantanea('instalaciones-catalogadas.geojson', { hubUrl: 'https://hub.example', sitio, fetchFn: hubSnap({ cuerpos: { inst: conExtra } }), aviso: () => {} });
        ok(r.fuente === 'hub' && r.features.length === 40 && r.features.every((f) => Object.keys(f).sort().join() === 'geometry,properties,type') && Object.keys(r).sort().join() === 'features,fuente,generadoDe,type', 'review 4: a hub feature with foreign members (id, bbox, anything) is served as {type, properties, geometry} and nothing else');
      }
      ok(!/127\.0\.0\.1|localhost|hub\.example/.test(JSON.stringify(a1)) && a1.generadoDe?.origen === 'hub de Zenbit System', 'a hub read writes the fixed label «hub de Zenbit System» and no URL into the served file');
    }
    // C3: generadoDe.bundles is stamped only when the strict comparison passed; a fallback, a committed read or a hub read without the check carries none
    {
      const sinBundles = (d) => d.generadoDe?.bundles === undefined;
      ok(!!igual.generadoDe?.bundles?.length && sinBundles(await tomar('instalaciones-catalogadas.geojson', f429)) && sinBundles(await tomar('instalaciones-catalogadas.geojson', hubSnap())) && sinBundles(await instantanea('instalaciones-catalogadas.geojson', { hubUrl: '', sitio })), 'C3: bundles only on a strict hub read that matched; a fallback, a non-strict read and a no-hub read carry none');
      const nadaDelHub = hubSnap({ metricas: {} });
      const m = await falla('estados-metricas.json', nadaDelHub, /./);
      ok(typeof m === 'string' && /no metric|hub had no values|never from the committed file/.test(m), `C3: in strict mode estados-metricas never comes back as «archivo» because nothing came from the hub (${String(m).slice(0, 80)})`);
    }
    const deriva = JSON.stringify({ type: 'FeatureCollection', features: sitio.archivo['instalaciones-catalogadas.geojson'].features.map((f) => (f.properties.id === 'mx-qro-xolotlcalli' ? { ...f, properties: { ...f.properties, nombre: ['Bio', 'Museo'].join('') + ' Xolotlcalli', estado_fecha: '2026-09' } } : f)) });
    ok(/^instalaciones-catalogadas\.geojson: the hub's data is not the committed file's: facility mx-qro-xolotlcalli: nombre, estado_fecha differ$/.test(await falla('instalaciones-catalogadas.geojson', hubSnap({ cuerpos: { inst: deriva } }), /not the committed file's/) ?? ''), 'strict parity: the pilot row with another name and date (today\'s hub) fails and names the facility and the properties');
    const faltan = JSON.stringify({ type: 'FeatureCollection', features: sitio.archivo['instalaciones-catalogadas.geojson'].features.filter((f) => f.properties.estado_operacion !== 'cerrado') });
    ok(/facility only in the committed file: .*mx-qro-xolotlcalli|has 38 and the committed file 40/.test(await falla('instalaciones-catalogadas.geojson', hubSnap({ cuerpos: { inst: faltan } }), /not the committed file's/) ?? ''), 'strict parity: a hub that serves 38 facilities against 40 fails');
    ok(/state MX-CMX: v differ/.test(await falla('especies-por-estado.json', hubSnap({ cuerpos: { especies: JSON.stringify({ type: 'FeatureCollection', features: Object.entries(sitio.archivo['especies-por-estado.json'].estados).map(([iso, especies]) => ({ type: 'Feature', geometry: null, properties: { iso, especies: iso === 'MX-CMX' ? [] : especies } })) }) } }), /not the committed file's/) ?? ''), 'strict parity: a state with another species list fails');
    // the genus files: equal passes, with the importer\'s selection applied to the hub\'s categories (NatureServe subnational ranks are left out)
    const conRangos = hubGenus((r) => { const d = r.get('/v1/species/ambystoma_velasci').json.data; d.categories = [...d.categories, { system: 'natureserve', scope: 'MX-QUE', category: 'S3', citation: 'x', sourceKey: 'natureserve' }]; });
    const eA = await estricto('especies-atlas.json', conRangos);
    ok(eA.fuente === 'hub' && !JSON.stringify(eA.especies.find((e) => e.slug === 'velasci').categories).includes('S3'), 'selection parity: the hub\'s subnational NatureServe rank is left out, as the file importer leaves it, and the strict comparison passes');
    // a US federal listing is never silently dropped, whatever its scope (californiense's distinct population segments are scoped to California); and a hub that names a source by key and title only gets its publisher and address from the committed file
    const cal = (eA.especies.find((e) => e.slug === 'californiense')?.categories ?? []).filter((c) => c.system === 'esa');
    ok(cal.length === 3 && cal.every((c) => c.scope === 'US-CA'), 'selection parity: the three ESA listings of californiense (scope US-CA) are kept, as the importer now keeps every ESA listing');
    const sinPub = await estricto('especies-atlas.json', hubGenus((r) => { for (const [, x] of r) { const d = x.json?.data; const quitar = (s) => { if (s && typeof s === 'object') { delete s.publisher; delete s.url; } }; if (d?.source) quitar(d.source); for (const m of d?.morphometrics ?? []) quitar(m.source); for (const m of d?.profile ?? []) quitar(m.source); for (const m of d?.presence ?? []) quitar(m.source); } }));
    ok(sinPub.fuente === 'hub' && sinPub.fuentes.some((f) => f.publisher), 'sources the hub names without publisher or address get them from the committed file by key, and the strict comparison passes');
    ok((await estricto('especies-localidades.geojson', hubGenus())).fuente === 'hub' && (await estricto('admin1.geojson', hubGenus())).fuente === 'hub', 'strict parity: the localities and the 96 units equal the committed ones');
    ok(/species velasci: .*differ/.test(await falla('especies-atlas.json', hubGenus((r) => { const d = r.get('/v1/species/ambystoma_velasci').json.data; d.categories = d.categories.map((c) => (c.system === 'iucn' ? { ...c, category: 'EN' } : c)); }), /not the committed file's/) ?? ''), 'strict parity: a changed category fails and names the species');
    ok(diferencias('admin1.geojson', { features: [] }, { features: [{ properties: { iso: 'MX-AGU' }, geometry: null }] }).length > 0 && diferencias('nada.json', {}, {}).length > 0, 'planted: the comparison reports a missing unit, and refuses a file it has no rule for');
  }
  // the booth key: a mode-600 file, sent as a header to the hub's origin only, never in a message
  {
    const dir = mkdtempSync(join(tmpdir(), 'clave-')); const f = join(dir, 'k'); writeFileSync(f, 'SECRETO-DE-PRUEBA-123\n', { mode: 0o600 });
    const vistos = []; const base = async (url, o) => { vistos.push([url, o?.headers ?? {}]); return { ok: true }; };
    const c = conClave(base, { archivo: f, cabecera: 'x-clave', hubUrl: 'https://hub.example/v1' });
    await c('https://hub.example/v1/species', {}); await c('https://otro.example/x', {});
    ok(vistos[0][1]['x-clave'] === 'SECRETO-DE-PRUEBA-123' && vistos[1][1]['x-clave'] === undefined, 'the hub key is sent to the hub\'s origin and to no other host');
    writeFileSync(join(dir, 'abierta'), 'x', { mode: 0o644 });
    const msgs = []; for (const args of [{ archivo: join(dir, 'abierta'), cabecera: 'x-clave' }, { archivo: f, cabecera: '' }, { archivo: f, cabecera: 'bad header' }]) { try { conClave(base, { ...args, hubUrl: 'https://hub.example' }); msgs.push('no error'); } catch (e) { msgs.push(e.message); } }
    ok(msgs.every((m) => m !== 'no error' && !m.includes('SECRETO')) && msgs[0].includes('mode 600'), 'a key file others can read, or a missing or malformed header name, is refused, and no message carries the key');
    const cb = conClave(base, { archivo: f, cabecera: 'Authorization', esquema: 'Bearer', hubUrl: 'https://hub.example' }); await cb('https://hub.example/v1/x', {});
    ok(vistos[vistos.length - 1][1].Authorization === 'Bearer SECRETO-DE-PRUEBA-123', 'the header value can carry its scheme («Bearer <key>»)');
    ok(conClave(base, { archivo: '', cabecera: 'x', hubUrl: 'https://hub.example' }) === base, 'with no key file the fetch is untouched');
    // C4: the keyed request never follows a redirect (the key would go to wherever it points), and the key never travels over plain http unless the host is this machine
    await c('https://hub.example/v1/species', {});
    const sinRedir = (() => { let r; const f2 = async (u, o) => { r = o?.redirect; return { ok: true }; }; return { f2, redir: () => r }; })();
    await conClave(sinRedir.f2, { archivo: f, cabecera: 'x-clave', hubUrl: 'https://hub.example' })('https://hub.example/v1/x', { redirect: 'follow' });
    ok(sinRedir.redir() === 'error', 'C4: a keyed request is made with redirect: "error", whatever the caller asked for');
    const rechaza = (u) => { try { conClave(base, { archivo: f, cabecera: 'x-clave', hubUrl: u }); return false; } catch (e) { return /https|loopback/.test(e.message) && !e.message.includes('SECRETO'); } };
    ok(rechaza('http://hub.example') && rechaza('http://192.168.1.5:4480') && rechaza('http://10.0.0.2') && !rechaza('http://127.0.0.1:4480') && !rechaza('http://localhost:4480') && !rechaza('http://[::1]:4480') && !rechaza('https://hub.example'), 'C4: the key is refused for plain http unless the host is loopback (127.0.0.1, localhost, ::1); https is fine');
    rmSync(dir, { recursive: true, force: true });
  }
  const caidasGenus = [
    ['admin1.geojson', hubGenus((r) => { const x = r.get('/v1/admin1.geojson'); r.set('/v1/admin1.geojson', { ...x, etag: `"${shaHex(x.text + ' ')}"` }); }), 'an ETag that is not the body sha256'],
    ['admin1.geojson', hubGenus((r) => { const x = r.get('/v1/admin1'); x.json.data[3].geometrySha256 = `0x${'0'.repeat(64)}`; }), 'a geometry that is not the bytes the list pins'],
    ['admin1.geojson', hubGenus((r) => { const x = r.get('/v1/admin1.geojson'); const t = x.text.replace('"MX-AGU"', '"MX-AGU "'); r.set('/v1/admin1.geojson', { text: t, etag: `"${shaHex(t)}"` }); }), 'a unit whose key is out of shape'],
    ['especies-atlas.json', hubGenus((r) => { r.get('/v1/species/ambystoma_velasci/presence').json.data.presence[0].evidence = 'probable'; }), 'an evidence class the atlas does not know'],
    ['especies-atlas.json', hubGenus((r) => { r.get('/v1/species/ambystoma_velasci/presence').json.data.presence[0].iso = 'MX-XXX'; }), 'a presence row on a unit that is not one of the 96'],
    ['especies-atlas.json', hubGenus((r) => { r.get('/v1/species/ambystoma_velasci').json.data.slug = 'ambystoma_otra'; }), 'a detail that answers for another species'],
    ['especies-atlas.json', hubGenus((r) => { delete r.get('/v1/species/ambystoma_velasci/presence').json.data.presence[0].source.key; }), 'a presence source without its stable key'],
    ['especies-atlas.json', hubGenus((r) => { r.get('/v1/species/ambystoma_velasci/presence').json.data.presence[0].source.key = 'Has Spaces'; }), 'a source key that is not a key'],
    ['especies-localidades.geojson', hubGenus((r) => { const k = '/v1/species/ambystoma_velasci/localities.geojson'; const fc = JSON.parse(r.get(k).text); delete fc.features[0].properties.sourceKey; r.set(k, { text: JSON.stringify(fc) }); }), 'a locality without its sourceKey'],
    ['especies-atlas.json', hubGenus((r) => { r.delete('/v1/species/ambystoma_velasci/localities.geojson'); }), 'a species with a route missing'],
    ['especies-localidades.geojson', hubGenus((r) => { const k = '/v1/species/ambystoma_velasci/localities.geojson'; const fc = JSON.parse(r.get(k).text); fc.features[0].geometry.coordinates[0] = fc.features[0].geometry.coordinates[0].map(([x, y]) => [x + 0.013, y]); r.set(k, { text: JSON.stringify(fc) }); }), 'a cell that is off the 0.5 degree grid'],
    ['especies-localidades.geojson', async () => { throw new Error('down'); }, 'a hub that is down'],
  ];
  for (const [nombre, f, porque] of caidasGenus) {
    const r = await tomar(nombre, f);
    const comprometidoGenus = sitio.archivo[nombre];
    ok(r.fuente === 'archivo' && sinSello(r) === sinSello(comprometidoGenus), `${nombre}: the committed file with ${porque}`);
  }
  ok((await tomar('especies-atlas.json', hubGenus(), '')).fuente === 'archivo', 'the genus files without a hub URL are the committed ones');
}

// ---------------------------------------------------------------------------------------------
// Comms' meta copy, read from the source of the page text (atlasText.ts is TypeScript, which this script does not import).
const textoFuente = readFileSync(join(SITE, 'src/lib/atlasText.ts'), 'utf8');
const metaTitulos = [...textoFuente.matchAll(/metaTitle: '((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
const metaDescs = [...textoFuente.matchAll(/metaDescription: '((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
const META_ATLAS = Object.fromEntries(['es', 'en', 'pt'].map((l, i) => [l, { metaTitle: metaTitulos[i], metaDescription: metaDescs[i] }]));
ok(metaTitulos.length === 3 && metaDescs.length === 3 && ['es', 'en', 'pt'].every((l) => META_ATLAS[l].metaTitle.length <= 60 && META_ATLAS[l].metaDescription.length <= 155 && !/AxoloDAO/.test(META_ATLAS[l].metaTitle + META_ATLAS[l].metaDescription)), 'the meta title is 60 characters or fewer and the description 155 or fewer, in es, en and pt, and neither names a brand');
ok(!/— AxoloDAO/.test(readFileSync(join(SITE, 'src/components/atlas/AtlasPage.astro'), 'utf8')) && /appendSiteName/.test(readFileSync(join(SITE, 'src/components/atlas/AtlasPage.astro'), 'utf8')) && /SITE_NAME = /.test(readFileSync(join(SITE, 'src/layouts/BaseLayout.astro'), 'utf8')), 'the « — AxoloDAO» suffix is not in the atlas page: the layout adds the site name from one constant');
const dist = join(SITE, 'dist');
// The surfaces a search engine or a share card reads: the title, every meta tag, every structured-data block and every alt text.
const superficiesSeo = (html) => [...(html.match(/<title[^>]*>[\s\S]*?<\/title>/gi) ?? []), ...(html.match(/<meta\b[^>]*>/gi) ?? []), ...(html.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) ?? []), ...(html.match(/\balt="[^"]*"/gi) ?? [])];
const PILOTO_EN_SEO = new RegExp(['xolotlcalli', 'museo de ajolotes', ['bio', 'museo'].join('')].join('|'), 'i');   // the former name is built from parts: the privacy scan reads a literal in a file as the name appearing
if (args.has('--dist')) {
  console.log('built site');
  ok(existsSync(dist), 'dist/ exists (run `npm run build` first)');
  if (existsSync(dist)) {
    for (const [p, l] of [['atlas', 'es'], ['en/atlas', 'en'], ['pt/atlas', 'pt']]) {
      const html = existsSync(join(dist, p, 'index.html')) ? readFileSync(join(dist, p, 'index.html'), 'utf8') : '';
      ok(html.includes('data-freshness='), `/${p}/ carries a freshness chip (${l})`);
      const mt = META_ATLAS[l];
      ok(html.includes(`<title>${mt.metaTitle} — AxoloDAO</title>`) && html.includes(`content="${mt.metaDescription}"`), `/${p}/ has Comms' meta title (the layout adds the site name) and description (${l})`);
      ok(/data-freshness="\d{4}-\d{2}-\d{2}"/.test(html) && html.includes('lang="' + { es: 'es', en: 'en', pt: 'pt' }[l]), `/${p}/ has the build date and its language`);
      ok(superficiesSeo(html).filter((x) => PILOTO_EN_SEO.test(x)).length === 0 && !html.includes(FILA_PILOTO.nombre), `/${p}/: the pilot's name is in no title, meta or og tag, structured-data block or alt text, and not in the page at all (${l})`);
    }
    // the home's map is retired as a destination: no built page links to #mapa, and the nav and hero buttons of the three home pages point to the atlas of their language
    {
      const paginas = []; const anda3 = (d) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) anda3(f); else if (n === 'index.html') paginas.push(f); } }; anda3(dist);
      const enlazan = paginas.filter((f) => /href="[^"]*#mapa"/.test(readFileSync(f, 'utf8'))).map((f) => f.replace(dist, ''));
      const homes = [['index.html', '/atlas/'], ['en/index.html', '/en/atlas/'], ['pt/index.html', '/pt/atlas/']].map(([f, a]) => { const h = readFileSync(join(dist, f), 'utf8'); return h.includes(`href="${a}" class="btn-primary"`) && h.includes(`href="${a}"`) && !/href="#mapa"/.test(h); });
      ok(paginas.length >= 20 && enlazan.length === 0 && homes.every(Boolean), `no built page links to #mapa (${paginas.length} pages read${enlazan.length ? '; found in ' + enlazan.join(', ') : ''}), and the nav and hero buttons of the three home pages point to /atlas/, /en/atlas/ and /pt/atlas/`);
    }
    // The site name after a page title comes from ONE place (the layout's SITE_NAME), only for pages that opt in with `appendSiteName`: no page template
    // writes the suffix itself, no title carries it twice, and the pages that do not opt in carry none.
    const htmls = [];
    const anda = (dir) => { for (const n of readdirSync(dir)) { const f = join(dir, n); if (statSync(f).isDirectory()) anda(f); else if (n === 'index.html') htmls.push(f); } };
    anda(dist);
    // (the /en and /pt species pages that only redirect to the Spanish page carry a «Redirecting» title and are not pages of their own)
    for (let i = htmls.length - 1; i >= 0; i--) if (/^Redirecting to/.test(/<title>([^<]*)<\/title>/.exec(readFileSync(htmls[i], 'utf8'))?.[1] ?? '')) htmls.splice(i, 1);
    const tituloDe = (f) => /<title>([^<]*)<\/title>/.exec(readFileSync(f, 'utf8'))?.[1] ?? '';
    const CON_SUFIJO = (rel) => /^(?:(?:en|pt)\/)?(?:atlas|conceptos|especies)(?:\/|$)/.test(rel) || rel === 'xolotlcalli/datos/huella/';   // the two fingerprint pages take NOMBRE_SITIO (lib/huella.mjs)
    const malos = htmls.filter((f) => (tituloDe(f).split(' — AxoloDAO').length - 1) > 1);
    ok(htmls.length >= 20 && malos.length === 0, `no built title carries the site name twice (${htmls.length} pages read)${malos.length ? ': ' + malos.map((f) => f.replace(dist, '')).join(', ') : ''}`);
    const sinOptar = htmls.filter((f) => !CON_SUFIJO(f.replace(dist + '/', '').replace(/index\.html$/, '')) && tituloDe(f).endsWith(' — AxoloDAO'));
    ok(sinOptar.length === 0, `a page that does not opt in carries no suffix${sinOptar.length ? ': ' + sinOptar.map((f) => f.replace(dist, '')).join(', ') : ''}`);
    const conSufijo = htmls.filter((f) => CON_SUFIJO(f.replace(dist + '/', '').replace(/index\.html$/, '')));
    ok(conSufijo.length >= 9 && conSufijo.every((f) => tituloDe(f).endsWith(' — AxoloDAO') && (tituloDe(f).split(' — AxoloDAO').length - 1) === 1), `the pages that opt in (atlas, conceptos, especies, in three languages) carry the suffix exactly once (${conSufijo.length} pages)`);
    // the build has every flag off: the page serializes no flag as true into its island props, the sample flag is not a prop at all, and the sample branch and its path are not in any shipped script
    const propsDeAtlas = htmls.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/<astro-island[^>]*component-url="[^"]*Atlas[^"]*"[^>]*props="([^"]*)"/g)].map((m) => ({ f: f.replace(dist, ''), props: JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')) })));
    ok(propsDeAtlas.length >= 4 && propsDeAtlas.every(({ props }) => props.ncFlag?.[1] === false && !('muestra' in props) && !/true/.test(JSON.stringify(Object.fromEntries(Object.entries(props).filter(([k]) => k !== 'sitio'))))), `the atlas islands of this build carry ncFlag false, no sample prop and no true flag (${propsDeAtlas.length} islands read: ${propsDeAtlas.map((x) => x.f).join(' ')})`);
    const jsTodos = readdirSync(join(dist, '_astro')).filter((n) => n.endsWith('.js'));
    const conMuestra = jsTodos.filter((n) => /\/atlas\/sample/.test(readFileSync(join(dist, '_astro', n), 'utf8')));
    ok(jsTodos.length > 5 && conMuestra.length === 0, `no shipped script carries the sample branch or its path (${jsTodos.length} scripts read${conMuestra.length ? '; found in ' + conMuestra.join(', ') : ''})`);
    const fuentes = [];
    const anda2 = (dir) => { for (const n of readdirSync(dir)) { const f = join(dir, n); if (statSync(f).isDirectory()) anda2(f); else if (f.endsWith('.astro')) fuentes.push(f); } };
    anda2(join(SITE, 'src'));
    ok(fuentes.length >= 10 && fuentes.every((f) => !/ — AxoloDAO/.test(readFileSync(f, 'utf8'))), 'no page template or component writes « — AxoloDAO» itself');
    const capa = readFileSync(join(SITE, 'src/layouts/BaseLayout.astro'), 'utf8');
    const sinConstante = capa.split('\n').filter((l) => /AxoloDAO/.test(l) && !/SITE_NAME = /.test(l) && !/^\s*\/\//.test(l) && !/github\.com\/zenbitETH\/AxoloDAO|app\.ens\.domains\/axolodao\.eth|axolodao\.org/.test(l));
    ok(sinConstante.length === 0, `the layout writes the brand name only in SITE_NAME (the JSON-LD names, application name, author, publisher and og:site_name all use it)${sinConstante.length ? ': ' + sinConstante.join(' | ') : ''}`);
    // the Organization's description in the structured data is the site's fixed one, not the page's
    const descripciones = new Map();
    for (const f of htmls) {
      const html = readFileSync(f, 'utf8');
      const lang = /<html lang="(\w+)"/.exec(html)?.[1];
      for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        let j; try { j = JSON.parse(m[1]); } catch { continue; }
        if (j['@type'] === 'Organization') { if (!descripciones.has(lang)) descripciones.set(lang, new Set()); descripciones.get(lang).add(j.description); }
      }
    }
    ok(descripciones.size === 3 && [...descripciones.values()].every((set) => set.size === 1), 'the Organization description in the structured data is one fixed text per language, the same on every page');
    const atlasHtml = readFileSync(join(dist, 'atlas/index.html'), 'utf8');
    const orgAtlas = JSON.parse([...atlasHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((x) => /"Organization"/.test(x))).description;
    ok(atlasHtml.includes(`content="${META_ATLAS.es.metaDescription}"`) && orgAtlas !== META_ATLAS.es.metaDescription, 'on /atlas the page\'s description is the page\'s and the Organization description is not');
    // the scripts the page names plus its islands (astro-island component-url / renderer-url), then everything they import statically
    const jsDe = (html) => [...html.matchAll(/(?:src|href|component-url|renderer-url|before-hydration-url)="(\/_astro\/[^"]+\.js)"/g)].map((m) => m[1]);
    const cierre = (entradas) => {
      const visto = new Set();
      const cola = [...entradas];
      while (cola.length) {
        const f = cola.pop();
        if (visto.has(f) || !existsSync(join(dist, f))) continue;
        visto.add(f);
        for (const m of readFileSync(join(dist, f), 'utf8').matchAll(/(?:from|import\()\s*["']\.\/([^"']+\.js)["']/g)) cola.push(`/_astro/${m[1]}`);
      }
      return [...visto];
    };
    const home = readFileSync(join(dist, 'index.html'), 'utf8');
    const jsHome = cierre(jsDe(home));
    ok(jsHome.length > 0 && !jsHome.some((f) => /maplibre/i.test(f) || /maplibre/i.test(readFileSync(join(dist, f), 'utf8').slice(0, 4000))), 'the home page JS does not include maplibre-gl');
    const bytes = jsHome.reduce((n, f) => n + statSync(join(dist, f)).size, 0);
    {
      const base = '<html><head><title>Atlas</title><meta name="description" content="x"><script type="application/ld+json">{"a":1}</script></head><body><img alt="mapa"></body></html>';
      const plantas = [base.replace('<title>Atlas', '<title>Xolotlcalli'), base.replace('content="x"', `content="${FILA_PILOTO.nombre}"`), base.replace('{"a":1}', `{"name":"${['Bio', 'museo'].join('')} Xolotlcalli"}`), base.replace('alt="mapa"', 'alt="Museo de Ajolotes en Querétaro"')];
      ok(superficiesSeo(base).filter((x) => PILOTO_EN_SEO.test(x)).length === 0 && plantas.every((h) => superficiesSeo(h).some((x) => PILOTO_EN_SEO.test(x))), 'the SEO-surface check sees the pilot\'s name planted in a title, a meta tag, a structured-data block and an alt text, and nothing in a clean page');
      // the other pages of the site (home, the museum's own pages) name the museum on their own; this is about the ATLAS: its three pages and its island carry the name nowhere in markup or code, only in the data files. The demo card (a file that exists only in the demo tree) carries its title, so the island is checked where that file is absent.
      const sinTarjeta = !existsSync(join(SITE, 'src/components/atlas/TarjetaOrg.tsx'));
      const sinNombreEn = (fs) => fs.length > 0 && fs.every((f) => !readFileSync(f, 'utf8').includes(FILA_PILOTO.nombre));   // an empty list proves nothing
      const chunksAtlas = archivos(join(dist, '_astro')).filter((f) => /Atlas\.[\w-]+\.js$/.test(f));
      ok(sinTarjeta ? sinNombreEn(chunksAtlas) : chunksAtlas.length > 0, `the atlas island's code does not carry the pilot's name${sinTarjeta ? '' : ' (not checked in the demo tree: its card file is there)'} (${chunksAtlas.length} chunk(s) read)`);
      {
        const tmp = mkdtempSync(join(tmpdir(), 'nombre-'));
        writeFileSync(join(tmp, 'a.js'), `x="${FILA_PILOTO.nombre}"`); writeFileSync(join(tmp, 'b.js'), 'x=1');
        ok(!sinNombreEn([]) && !sinNombreEn([join(tmp, 'a.js'), join(tmp, 'b.js')]) && sinNombreEn([join(tmp, 'b.js')]), 'planted: an empty chunk list, or a chunk that carries the name, fails the check above');
        rmSync(tmp, { recursive: true, force: true });
      }
    }
    const presupuesto = json('scripts/fixtures/home-js-budget.json').bytes;
    ok(bytes <= presupuesto, `the home page JS (${bytes} bytes) stays within its budget (${presupuesto})`);
    const atlas = readFileSync(join(dist, 'atlas/index.html'), 'utf8');
    ok(cierre(jsDe(atlas)).some((f) => f.includes('Atlas')) || /Atlas\.[\w-]+\.js/.test(atlas), 'the atlas page loads its own island chunk');
    // an NC layer file may be in dist/ only in the fingerprint folder (served one by one, with its licence beside its link); anywhere else, never
    ok(ARCHIVOS.every((a) => !existsSync(join(dist, 'atlas/layers', a)) && existsSync(join(dist, 'atlas/datos', a))), 'C5: the built site serves each of the six data files once, at /atlas/datos/, and none of them at /atlas/layers/');
    ok(archivos(dist).every((f) => !/umas-centroides|calidad-agua-2013|uma-extensivas|sitios-conagua/.test(f) || /\/atlas\/datos\/huella\/[^/]+\/layers\/[^/]+\.geojson$/.test(f)), 'no NC layer file is in dist/ outside the fingerprint folder');
    const datos = ARCHIVOS.map((a) => { try { return JSON.parse(readFileSync(join(dist, 'atlas/datos', a), 'utf8')); } catch { return null; } });
    ok(datos.every((d) => d && ['hub', 'archivo'].includes(d.fuente)), `the build carries its atlas data snapshot, each file saying where it came from (${datos.map((d, n) => `${ARCHIVOS[n]}: ${d?.fuente}`).join(', ')})`);
    ok(cierre(jsDe(atlas)).some((f) => readFileSync(join(dist, f), 'utf8').includes('/atlas/datos/')), 'the atlas island reads the snapshot, not the committed files directly');
    // the home's atlas section (founder, 22-oct) is the genus in figures with one way into the atlas: its title «El atlas» is the link (founder, 27-oct: no «Atlas» button), no map of its own
    for (const [p, base] of [['index.html', '/atlas/'], ['en/index.html', '/en/atlas/'], ['pt/index.html', '/pt/atlas/']]) {
      const home = readFileSync(join(dist, p), 'utf8');
      const enlaces = [...home.matchAll(/<a [^>]*href="([^"]*)"[^>]*data-home-atlas-cta/g)].map((m) => m[1]);
      ok(enlaces.length === 1 && enlaces[0] === base, `${p}: the home atlas section links to the atlas once (${enlaces.join(', ')})`);
      ok(!/data-atlas-(?:cta|preview)/.test(home) && !/<astro-island[^>]*(SpeciesExplorer|MexicoMap)/.test(home), `${p}: the old species image, its call and the species map island are gone`);
    }
    const na = readFileSync(join(dist, 'atlas/especies-na.svg'), 'utf8');
    ok(na.length < 160 * 1024 && gzipSync(na).length < 45 * 1024, `the North America image is light (${(na.length / 1024).toFixed(0)} KB, ${(gzipSync(na).length / 1024).toFixed(0)} KB gzipped)`);
    ok((na.match(/<path /g) ?? []).length >= 90 && (na.match(/<circle /g) ?? []).length >= 4 && !/(href|src)=|<script|<image|https?:\/\/(?!www\.w3\.org)/.test(na), 'it draws the units, the localities and the lakes, and references nothing outside itself');
    // a ring wound the wrong way is, to d3-geo, the rest of the world: its path would fill the whole picture
    const cajasSvg = [...na.matchAll(/<path d="([^"]*)"/g)].map((m) => { const n = m[1].match(/-?\d+(?:\.\d+)?/g).map(Number); const xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1); return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]; });
    ok(cajasSvg.length >= 90 && cajasSvg.every(([w, h]) => w < 0.9 * 960 || h < 0.9 * 620), 'no unit or locality in the image fills the whole picture (every ring is wound the way d3-geo reads it)');
    for (const [p, l] of [['especies', 'es'], ['en/especies', 'en'], ['pt/especies', 'pt']]) {
      const html = readFileSync(join(dist, p, 'index.html'), 'utf8');
      ok(/vista&quot;:\[0,&quot;especies&quot;\]/.test(html) && /<h1[^>]*>[^<]+<\/h1>/.test(html), `/${p}/ is the atlas on its species view, with its own heading (${l})`);
    }
    ok(!['src/components/SpeciesExplorer.tsx', 'src/components/MexicoMap.tsx', 'src/components/species/SpeciesCard.tsx', 'src/components/species/SpeciesDetailSheet.tsx'].some((f) => existsSync(join(SITE, f))), 'the old species map and card grid are gone from the source');
  }
}

// ---------------------------------------------------------------------------------------------
if (args.has('--browser')) {
  console.log('browser');
  const candidatos = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  const chrome = candidatos.find((c) => existsSync(c));
  if (!chrome) { console.error('no Chrome or Chromium found: set CHROME_PATH'); process.exit(1); }
  const { chromium } = await import('playwright-core');
  const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/geo+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
  const servirDirectorio = async (raiz) => {
    const servidor = createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = join(raiz, p);
      if (!f.startsWith(raiz) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': tipos[extname(f)] ?? 'application/octet-stream' });
      res.end(readFileSync(f));
    });
    await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
    return { servidor, base: `http://127.0.0.1:${servidor.address().port}` };
  };
  const { servidor, base } = await servirDirectorio(dist);
  const navegador = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const abrir = async (url, { bloquear = true, ancho = 1400, alto = 1100, tactil = false } = {}) => {
    const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, ...(tactil ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    const page = await ctx.newPage();
    const bloqueados = [];
    if (bloquear) {
      await page.route('**/*', (route) => {
        const h = new URL(route.request().url()).hostname;
        if (h === '127.0.0.1' || h === 'localhost') return route.continue();
        bloqueados.push(h);
        return route.abort();
      });
    }
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-atlas][data-ready="1"]', { timeout: 60000 });
    await page.waitForTimeout(500);
    return { page, ctx, bloqueados, errores };
  };

  try {
    const a = await abrir(`${base}/atlas/`);
    const poligonos = await a.page.evaluate(() => document.querySelector('[data-map]').__map.queryRenderedFeatures({ layers: ['estados-relleno'] }).length);
    ok(poligonos >= 25, `the map renders state polygons with every host but localhost blocked (${poligonos} rendered)`);
    ok(a.errores.length === 0, `no page error (${a.errores.join(' | ') || 'none'})`);
    const pedidos = await a.page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name));
    ok(pedidos.filter((u) => u.includes('/atlas/')).every((u) => u.startsWith(base)), 'every atlas request goes to the same origin');
    // the layers live in the panel's «Instalaciones» tab (the index drawer opens from the species button); every card of the old HUD groups is in that one tab now
    const abrirGrupo = async (page, g) => { if (await page.locator('#at-indice').count() === 0) await page.click('[data-group-btn="especies"]'); await page.waitForSelector('#at-indice'); await page.click('#ptab-instalaciones'); await page.waitForSelector('[data-inst-body]'); };
    await abrirGrupo(a.page, 'instalaciones');
    ok(await a.page.$eval('#capa-instalaciones-catalogadas', (e) => e.checked === false), 'the facilities layer starts off: the first view is the species');
    // flags off: the page says so, and the CC BY-NC cards are not switchable (absent, or disabled), whatever the hub would serve
    ok(await a.page.$eval('[data-atlas]', (e) => e.dataset.nc) === '0', 'the flags-off build says data-nc="0"');
    const ncSwitchables = await a.page.$$eval('[data-inst-body] input[id^="capa-"]', (n) => n.filter((x) => /uma-extensivas|sitios-conagua/.test(x.id) && !x.disabled).map((x) => x.id));
    ok(ncSwitchables.length === 0, `no CC BY-NC layer can be switched on with the flag off (${ncSwitchables.join(', ') || 'none switchable'})`);
    await a.page.check('#capa-instalaciones-catalogadas');
    ok(((await a.page.$eval('[data-layer="instalaciones-catalogadas"] [data-aviso]', (e) => e.textContent).catch(() => '')) ?? '').startsWith('Directorio compilado de fuentes públicas.'), 'the facilities card shows the page note under the layer');
    ok(/INEGI, Marco Geoestad/.test(await a.page.innerText('[data-attribution-for="instalaciones-catalogadas"]')), 'the map credits INEGI while the facilities layer is on');
    await a.page.keyboard.press('Escape');
    // facilities: a place label (never an address) with every facility of that municipality
    // the first view fits North America when the data arrives and may override an early camera move: move until the camera stays (below zoom 9 the facilities are counts)
    for (let i = 0; i < 6; i++) {
      await a.page.evaluate(() => document.querySelector('[data-map]').__map.jumpTo({ center: [-99.09, 19.25], zoom: 10 }));
      await a.page.waitForTimeout(1200);
      if (await a.page.evaluate(() => Math.abs(document.querySelector('[data-map]').__map.getZoom() - 10) < 0.01)) break;
    }
    const xochimilco = await a.page.evaluate(() => {
      const map = document.querySelector('[data-map]').__map, r = document.querySelector('[data-map]').getBoundingClientRect();
      const f = map.queryRenderedFeatures({ layers: ['instalaciones-puntos'] }).find((x) => x.properties.cve_mun === '013' && x.properties.cve_ent === '09');
      if (!f) return null;
      const p = map.project(f.geometry.coordinates), d = typeof f.properties.desp === 'string' ? JSON.parse(f.properties.desp) : f.properties.desp ?? [0, 0];
      return { x: r.left + p.x + d[0], y: r.top + p.y + d[1] };   // a marker is drawn at its screen offset: the fan-out keeps the markers of one place apart
    });
    ok(xochimilco !== null, 'a facility of Xochimilco is drawn on the map');
    if (xochimilco) {
      await a.page.mouse.click(xochimilco.x, xochimilco.y);
      await a.page.waitForSelector('.atlas-popup .at-place', { timeout: 5000 });
      const titulo = await a.page.innerText('.atlas-popup .at-place');
      const cuantos = await a.page.$$eval('.atlas-popup .font-semibold', (e) => e.length);
      ok(titulo === 'en Xochimilco, Ciudad de México' && cuantos >= 1, `clicking a marker names the place («${titulo}») and lists the facility (${cuantos}), with no address or coordinate`);
      ok(!/-?\d{2,3}\.\d{3,}/.test(await a.page.innerText('.atlas-popup')), 'the popup shows no coordinate');
      ok(await a.page.locator('#at-detalle').count() === 0 && await a.page.locator('.at-estado-pop').count() === 0, 'and the click opens neither a species nor a state popover underneath');
      await a.page.click('.maplibregl-popup-close-button');
    }
    // the facilities as a table: keyboard reachable, every facility of the map, no coordinate
    ok(await a.page.$('[data-facilities-table] summary') !== null, 'the facilities table has a summary a keyboard can reach');
    await a.page.focus('[data-facilities-table] summary', { timeout: 3000 }).catch(() => {});
    await a.page.keyboard.press('Enter');
    const tabla = await a.page.$$eval('[data-facilities-table] tbody tr', (r) => r.map((x) => x.innerText));
    ok((await a.page.$eval('[data-facilities-table]', (e) => e.open).catch(() => false)) && tabla.length === instal.features.length, `the facilities table opens from the keyboard and lists every facility (${tabla.length} of ${instal.features.length})`);
    ok(!tabla.some((t) => /-?\d{2,3}\.\d{3,}/.test(t)) && tabla.some((t) => /no consta/.test(t)) && tabla.some((t) => /Xochimilco/.test(t)), 'the table has the municipality, the state, the facility and the legal figure («no consta» unless sourced), and no coordinate');
    // North America: the units of the United States and Canada are on the map, can be reached, and open a popover with their species when clicked
    const clicEstado = async (page, [lng, lat, zoom]) => {
      await page.evaluate(([x, y, z]) => new Promise((res) => { const m = document.querySelector('[data-map]').__map; m.once('idle', res); m.jumpTo({ center: [x, y], zoom: z }); }), [lng, lat, zoom]);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(900);
      const r = await page.locator('[data-map]').boundingBox();
      await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
      await page.waitForSelector('.at-estado-pop', { timeout: 5000 });
      return page.$eval('.at-estado-pop', (n) => `${n.querySelector('h3').textContent}\n${n.querySelector('.at-n').textContent}`);
    };
    const paises = await a.page.evaluate(() => { const m = document.querySelector('[data-map]').__map; m.jumpTo({ center: [-98, 40], zoom: 2.4 }); return new Promise((res) => setTimeout(() => res([...new Set(m.queryRenderedFeatures({ layers: ['estados-relleno'] }).map((f) => f.properties.country))].sort()), 900)); });
    ok(paises.join() === 'CA,MX,US', `the map draws units of all three countries (${paises.join(', ')})`);
    const texas = await clicEstado(a.page, [-99.3, 31.3, 5]);
    ok(/^Texas/.test(texas) && /especies?/.test(texas), `clicking Texas opens its popover with its species count («${texas.split('\n').join(' · ')}»)`);
    const quebecEs = await clicEstado(a.page, [-72.5, 51.5, 4]);
    ok(/^Quebec/.test(quebecEs) && await a.page.locator('.at-estado-pop').count() === 1, `a second click replaces the popover with the next unit's, and in Spanish Quebec is «Quebec» (${quebecEs.split('\n')[0]})`);
    const en = await abrir(`${base}/en/atlas/`);
    const quebecEn = await clicEstado(en.page, [-72.5, 51.5, 4]);
    ok(/^Québec/.test(quebecEn) && /No species recorded|species/.test(quebecEn), `in English the popover uses the English name («${quebecEn.split('\n')[0]}») and its words`);
    // nothing leaves the origin on the public build (flags off): after loading the map, opening the panel, the layers, a popup and a popover, in both languages, the route saw no host but the local one,
    // except the site-wide Google Fonts calls of the page layout (older than the atlas and not its own: the same two hosts test-proto.mjs allows; any OTHER host fails)
    const DEL_SITIO = ['fonts.googleapis.com', 'fonts.gstatic.com'];
    const todos = await a.page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name));
    const afuera = (u) => !/^(http:\/\/127\.0\.0\.1:|data:|blob:)/.test(u) && !DEL_SITIO.includes(new URL(u).hostname);
    const hosts = [...new Set([...a.bloqueados, ...en.bloqueados])];
    ok(hosts.every((h) => DEL_SITIO.includes(h)) && todos.filter(afuera).length === 0, `nothing leaves the origin but the layout's site-wide fonts: hosts called ${hosts.join(', ') || 'none'}; ${todos.filter(afuera).length} resource entries outside the origin and those fonts, over ${todos.length}`);
    {
      // the instrument seen red: a page that does call out is caught by the same route
      const q = await abrir(`${base}/atlas/`);
      await q.page.evaluate(() => fetch('https://planted-host.example/ping').catch(() => {}));
      await q.page.waitForTimeout(300);
      ok(q.bloqueados.includes('planted-host.example') && !q.bloqueados.every((h) => DEL_SITIO.includes(h)), 'planted: a request to another host is seen by the instrument and fails the check above (so the pass above means something)');
      await q.ctx.close();
    }
    await en.ctx.close();
    await a.page.evaluate(() => document.querySelector('[data-map]').__map.jumpTo({ center: [-102.5, 23.6], zoom: 3 }));
    // (the map-first panel's interactions — hover preview, tap to prime, drawers, Escape and Back, the state popover, the camera, the URL, the phone sheets — are checked by the proto browser suite, scripts/proto/test-proto.mjs, which `npm run test:atlas:browser` runs against a served build)
    // ---- a build with the CC BY-NC flag ON and a registry (a stub that speaks the hub's real shapes) ----------------------------------
    console.log('browser: NC flag on, stub registry');
    const hub = { log: [], abajo: false };
    const hubServer = createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      hub.log.push(u.pathname);
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
      if (hub.abajo) { res.writeHead(503, cors); res.end('down'); return; }
      const enviar = (cuerpo, extra = {}) => { res.writeHead(200, { 'content-type': 'application/json', ...cors, ...extra }); res.end(JSON.stringify(cuerpo)); };
      if (u.pathname === '/v1/orgs') return enviar(envoltura([resumen('recinto-uno', 'Recinto uno', 2), resumen('recinto-dos', 'Recinto dos', 0, 'MX-JAL')]));
      if (u.pathname === '/v1/orgs/recinto-uno') return enviar(envoltura(detalle('recinto-uno', 'Recinto uno', 2, 20.59, -100.39)));
      if (u.pathname === '/v1/orgs/recinto-dos') return enviar(envoltura(detalle('recinto-dos', 'Recinto dos', 0, 19.7, -103.4)));
      if (u.pathname === '/v1/layers') return enviar(envoltura(capasHub));
      if (u.pathname === '/v1/layers/umas-centroides.geojson') {
        return enviar({ type: 'FeatureCollection', features: [[-100.1, 20.1], [-100.5, 20.4], [-99.9, 19.9]].map((c) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { clave: 'UMA-X' } })) },
          { link: '</v1/layers/umas-centroides>; rel="describedby", <https://creativecommons.org/licenses/by-nc/2.5/mx/>; rel="license"' });
      }
      res.writeHead(404, cors); res.end('not found');
    });
    await new Promise((r) => hubServer.listen(0, '127.0.0.1', r));
    const hubUrl = `http://127.0.0.1:${hubServer.address().port}`;
    const fuera = mkdtempSync(join(tmpdir(), 'atlas-nc-'));
    let servidorNc;
    try {
      execFileSync('npx', ['astro', 'build', '--outDir', fuera], { cwd: SITE, stdio: 'pipe', timeout: 600000,
        env: { ...process.env, PUBLIC_HUB_URL: hubUrl, ATLAS_HUB_LAXO: '1', PUBLIC_ATLAS_NC: '1', PUBLIC_ATLAS_POLL_MS: '1500' } });
      mkdirSync(join(fuera, 'atlas/layers'), { recursive: true });
      writeFileSync(join(fuera, 'atlas/layers/organizaciones-registradas.json'), JSON.stringify([detalle('de-la-compilacion', 'De la compilación', 1, 19.4, -99.1)]));
      servidorNc = await servirDirectorio(fuera);
      const esperar = async (page, fn, arg, ms = 15000) => { await page.waitForFunction(fn, arg, { timeout: ms }); };
      const puntos = async (page, fuente) => JSON.parse(await page.$eval('[data-atlas]', (e) => e.dataset.counts))[fuente] ?? 0;
      const dibujados = (page, capas) => page.evaluate((c) => document.querySelector('[data-map]').__map.queryRenderedFeatures({ layers: c }).length, capas);

      // positive control: outside kiosk mode the NC layers load from the registry, with the registry's citation, and the registry layer is live
      const n = await abrir(`${servidorNc.base}/atlas/`);
      ok(await n.page.$eval('[data-atlas]', (e) => e.dataset.nc === '1'), 'with the flag and a registry the NC layers are allowed outside kiosk mode');
      await abrirGrupo(n.page, 'instalaciones');
      ok(await n.page.$eval('#capa-uma-extensivas', (e) => e.disabled === false), 'the CC BY-NC card is enabled');
      await abrirGrupo(n.page, 'organizaciones');
      await esperar(n.page, () => document.querySelector('[data-layer="organizaciones-registradas"] [data-freshness]')?.dataset.live === 'true');
      await n.page.waitForTimeout(300);
      ok(await puntos(n.page, 'organizaciones') === 2 && await dibujados(n.page, ['organizaciones-registradas']) >= 1, 'the live registry layer draws both listed organizations at their generalized coordinates');
      hub.log.length = 0;
      await abrirGrupo(n.page, 'instalaciones');
      await n.page.click('#capa-uma-extensivas');
      await esperar(n.page, () => document.querySelector('[data-layer="uma-extensivas"]')?.innerText && !/Cargando|Loading|Carregando/.test(document.querySelector('[data-layer="uma-extensivas"]').innerText));
      await n.page.waitForTimeout(800);
      ok(hub.log.includes('/v1/layers') && hub.log.includes('/v1/layers/umas-centroides.geojson'), `toggling an NC layer asks the registry for its list and then for the path it announced (${hub.log.filter((p) => p.startsWith('/v1/layers')).join(', ')})`);
      ok(await puntos(n.page, 'uma') === 3 && await dibujados(n.page, ['uma-grupos', 'uma-puntos']) >= 1, 'the NC layer draws its points');
      ok((await n.page.innerText('[data-attribution-for="uma-extensivas"]')) === 'CONABIO, UMA, 2020', 'the map shows the registry\'s citation');
      // the registry goes down: the layer falls back to the build list, with a chip that says it is not live
      hub.abajo = true;
      await abrirGrupo(n.page, 'organizaciones');
      await esperar(n.page, () => document.querySelector('[data-layer="organizaciones-registradas"] [data-freshness]')?.dataset.live === 'false');
      await n.page.waitForTimeout(300);
      ok(await puntos(n.page, 'organizaciones') === 1 && await dibujados(n.page, ['organizaciones-registradas']) >= 1, 'with the registry down the layer shows the build list, not an empty layer');
      hub.abajo = false;
      await n.ctx.close();

      // kiosk mode: the same build, the flag ON, the registry up: no NC layer is allowed and none is asked for
      hub.log.length = 0;
      const q = await abrir(`${servidorNc.base}/atlas/?kiosko=1`);
      ok(await q.page.$eval('[data-atlas]', (e) => e.dataset.kiosko === '1' && e.dataset.nc === '0'), 'in kiosk mode the NC layers stay off even with the flag on');
      await abrirGrupo(q.page, 'instalaciones');
      const ncUma = await q.page.$eval('#capa-uma-extensivas', (x) => x.disabled);
      // the water-sites card is not in the panel any more: every NC card the panel lists is disabled in kiosk mode
      const ncTodas = await q.page.$$eval('[data-inst-body] [data-flag="nc"] input', (n) => n.map((x) => x.disabled));
      ok(ncUma && ncTodas.length >= 1 && ncTodas.every(Boolean), `the NC cards the panel lists are disabled (${ncTodas.length})`);
      await abrirGrupo(q.page, 'instalaciones');
      await q.page.click('label[for="capa-uma-extensivas"]', { force: true }).catch(() => {});
      await q.page.waitForTimeout(2500);
      ok(!hub.log.some((p) => p.startsWith('/v1/layers')), `no request for an NC layer leaves the page in kiosk mode (${hub.log.join(', ') || 'none'})`);
      ok(hub.log.some((p) => p.startsWith('/v1/orgs')), 'while the registry layer still reads the registry (control: the stub is reachable)');
      await q.ctx.close();
    } finally {
      servidorNc?.servidor.close();
      hubServer.close();
      rmSync(fuera, { recursive: true, force: true });
    }
  } finally {
    await navegador.close();
    servidor.close();
  }
}

if (fails) { console.error(`\n${fails} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
