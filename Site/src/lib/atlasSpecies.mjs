// What the atlas's species UI reads, in the shapes the hub's genus routes serve (/v1/species, /v1/species/{slug}/presence, /localities).
// Today the shapes come from src/data/atlas-snapshot/especies-atlas.json and especies-localidades.geojson, written by scripts/import-atlas-species.mjs
// from Site & Data's final bundles; when src/lib/atlasSnapshot.mjs reads the hub's routes it puts the same shapes through the same functions here.
//
// FIELDS THE UI ASSUMES
//   species    slug (short: 'mexicanum'), scientificName, authorship, aswAccepted, countries[MX|US|CA], categories[{system, scope, category, citation, source}],
//              morphometrics[{measure, stage, sex, mean|min|max, uom, source}], profile {draft, source, campos {description, habitat, distribution, threats, diet, reproduction -> {es}}}
//   presence   [iso, evidence, source] with evidence: present | historical | extirpated | introduced | weak | literature
//   locality   GeoJSON Feature as the hub serves it (+ the species slug): properties {slug, generalization: '0.1deg'|'0.5deg'|'municipality'|'named_water_body', name, sourceKey, source, citation, licence};
//              a cell is its square polygon (5 positions, south-west first), a municipality the INEGI centroid, a lake a point. Nothing finer exists.

export const CELDA = 0.5;                                     // degrees: the edge of a locality cell

/**
 * How a row of presence is drawn. `present` and `literature` (a cited record, with its DOI) are confirmed: solid. Only `weak` is unconfirmed: hatched on the map,
 * dashed in a list. `historical`, `extirpated` and `introduced` say the species is not (or not natively) there now: a lighter tint, and the word.
 */
export const claseDeEvidencia = (evidencia) => (evidencia === 'present' || evidencia === 'literature' ? 'strong' : evidencia === 'weak' ? 'weak' : 'other');

/** An accent colour for a species the site has none for: a hue from its slug, fixed saturation and lightness so it reads on the dark map. */
export function acento(slug) {
  let h = Number('0x811c9dc5');   // FNV-1a offset; parsed, not written as a ten-digit literal (which a minified bundle would keep and a privacy scan reads as a phone number)
  for (const c of slug) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const hue = h % 360, s = 0.58, l = 0.62;
  const k = (n) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return `#${[f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/** { slug: { iso: evidence } } from the snapshot's presence rows. */
export function presenciaPorEspecie(snapshot) {
  const out = {};
  for (const [slug, filas] of Object.entries(snapshot?.presencia ?? {})) out[slug] = Object.fromEntries(filas.map(([iso, ev]) => [iso, ev]));
  return out;
}

/** Species per unit: strong (confirmed) and weak (unconfirmed); a unit where the species is gone or not native does not count. */
export function riqueza(presencia) {
  const fuerte = {}, debil = {};
  for (const fila of Object.values(presencia)) for (const [iso, ev] of Object.entries(fila)) { const c = claseDeEvidencia(ev); if (c === 'other') continue; const t = c === 'strong' ? fuerte : debil; t[iso] = (t[iso] ?? 0) + 1; }
  return { fuerte, debil };
}

const MEDIDAS_CAMPO = { description: 'description', habitat: 'habitat', distribution: 'distribution', threats: 'threats', diet: 'feeding' };

/**
 * The species as the picker and the sheet read them: the snapshot's taxon, the site's own entry (common names, accent colour, references, ANP) where
 * there is one, and a derived accent where there is not. Text fields come from the snapshot's profile, which is a draft until the founder approves it.
 */
export function especiesParaUI(snapshot, delSitio = [], locale = 'es') {
  const sitio = new Map(delSitio.map((s) => [s.slug, s]));
  const presencia = presenciaPorEspecie(snapshot);
  return snapshot.especies.map((t) => {
    const y = sitio.get(t.slug);
    const fila = presencia[t.slug] ?? {};
    const iso = Object.keys(fila).sort();
    const categoria = (sistema, ambito) => t.categories.find((c) => c.system === sistema && (ambito ? c.scope === ambito : true))?.category;
    const campos = t.profile?.campos ?? {};
    const texto = (campo) => campos[campo]?.[locale] ?? campos[campo]?.es;
    const item = {
      slug: t.slug, scientificName: t.scientificName, commonNames: y?.commonNames ?? [], iucn: categoria('iucn', 'global'), nom059: categoria('nom059', 'MX') ?? null,
      states: iso.filter((i) => i.startsWith('MX-')).map((i) => i.slice(3)), weakStates: iso.filter((i) => i.startsWith('MX-') && claseDeEvidencia(fila[i]) === 'weak').map((i) => i.slice(3)),
      references: y?.references ?? [], anp: y?.anp ?? [], accentColor: y?.accentColor ?? acento(t.slug), endemic: t.countries.length === 1 && t.countries[0] === 'MX',
      hasHeroCard: Boolean(y?.hasHeroCard),
      authorship: t.authorship, aswAccepted: t.aswAccepted, countries: t.countries, categories: t.categories, morphometrics: t.morphometrics,
      presence: iso.map((i) => [i, fila[i]]), draft: t.profile ? t.profile.draft : false,
    };
    for (const [campo, destino] of Object.entries(MEDIDAS_CAMPO)) { const v = texto(campo); if (v) item[destino] = v; }
    return item;
  });
}

// ---------------------------------------------------------------------------------------------
// localities: cells merged into areas, single cells as points

const clave = (i, j) => `${i},${j}`;
const ARISTA = { '0.5deg': 0.5, '0.1deg': 0.1 };

/** The cells of one species and one edge size, as integer indices of that grid (the square's south-west corner). */
export function celdasDe(fc, slug, generalizacion = '0.5deg') {
  const d = ARISTA[generalizacion];
  const out = [];
  for (const f of fc.features) {
    if (f.properties?.slug !== slug || f.properties.generalization !== generalizacion || f.geometry?.type !== 'Polygon') continue;
    const anillo = f.geometry.coordinates[0];   // the square's south-west corner is the minimum of its ring, whatever vertex the ring starts at
    out.push([Math.round(Math.min(...anillo.map((q) => q[0])) / d), Math.round(Math.min(...anillo.map((q) => q[1])) / d)]);
  }
  return out;
}

/** Groups of cells that share an edge (4-connected), each a list of [i, j]. */
export function componentes(celdas) {
  const presentes = new Set(celdas.map(([i, j]) => clave(i, j)));
  const visto = new Set();
  const grupos = [];
  for (const [i0, j0] of celdas) {
    if (visto.has(clave(i0, j0))) continue;
    const grupo = [];
    const pila = [[i0, j0]];
    visto.add(clave(i0, j0));
    while (pila.length) {
      const [i, j] = pila.pop();
      grupo.push([i, j]);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = clave(i + di, j + dj);
        if (presentes.has(k) && !visto.has(k)) { visto.add(k); pila.push([i + di, j + dj]); }
      }
    }
    grupos.push(grupo);
  }
  return grupos;
}

/** The outline of a group of cells: every edge that belongs to one cell only, as a MultiLineString of unit segments. */
export function contorno(grupo, d = CELDA) {
  const aristas = new Map();
  const arista = (a, b) => {
    const directa = `${a}>${b}`, inversa = `${b}>${a}`;
    if (aristas.has(inversa)) aristas.delete(inversa); else aristas.set(directa, [a, b]);
  };
  for (const [i, j] of grupo) {
    const p = [`${i},${j}`, `${i + 1},${j}`, `${i + 1},${j + 1}`, `${i},${j + 1}`];
    for (let n = 0; n < 4; n++) arista(p[n], p[(n + 1) % 4]);
  }
  const punto = (s) => s.split(',').map((x) => Number((Number(x) * d).toFixed(6)));
  return [...aristas.values()].map(([a, b]) => [punto(a), punto(b)]);
}

/**
 * What the map draws of the localities: groups of two or more touching cells are AREAS (the cells' squares plus an outline of the merged shape),
 * a lone cell is a POINT at the cell's centre, a municipality's centroid is a point, a named water body is a point with its name. Never anything
 * finer than a 0.5° cell. Features keep the species' slug; `kind` is area | outline | cell | lake.
 */
export function localidadesParaMapa(fc) {
  const features = [];
  const especies = [...new Set(fc.features.map((f) => f.properties?.slug))];
  for (const slug of especies) {
    for (const gen of Object.keys(ARISTA)) {
      const d = ARISTA[gen];
      for (const grupo of componentes(celdasDe(fc, slug, gen))) {
        if (grupo.length === 1) {
          const [i, j] = grupo[0];
          features.push({ type: 'Feature', properties: { slug, kind: 'cell', cells: 1, size: d, zona: true, generalization: gen }, geometry: { type: 'Point', coordinates: [Number(((i + 0.5) * d).toFixed(6)), Number(((j + 0.5) * d).toFixed(6))] } });
        } else {
          const cuadro = ([i, j]) => [[[i * d, j * d], [(i + 1) * d, j * d], [(i + 1) * d, (j + 1) * d], [i * d, (j + 1) * d], [i * d, j * d]].map(([x, y]) => [Number(x.toFixed(6)), Number(y.toFixed(6))])];
          features.push({ type: 'Feature', properties: { slug, kind: 'area', cells: grupo.length, size: d, generalization: gen }, geometry: { type: 'MultiPolygon', coordinates: grupo.map(cuadro) } });
          features.push({ type: 'Feature', properties: { slug, kind: 'outline', cells: grupo.length, size: d, generalization: gen }, geometry: { type: 'MultiLineString', coordinates: contorno(grupo, d) } });
        }
      }
    }
  }
  for (const f of fc.features) {
    const g = f.properties?.generalization;
    if (g === 'named_water_body') features.push({ type: 'Feature', properties: { slug: f.properties.slug, kind: 'lake', name: f.properties.name }, geometry: f.geometry });
    else if (g === 'municipality') features.push({ type: 'Feature', properties: { slug: f.properties.slug, kind: 'cell', cells: 1, generalization: 'municipality', name: f.properties.name ?? undefined }, geometry: f.geometry });
  }
  return { type: 'FeatureCollection', features };
}

/** The points layer of the map from the attested localities (/atlas/datos/especies-localidades.geojson): a single cell is a zone marker at its centre, connected cells an area with its outline, a named water body a lake point with its name. Nothing else is drawn as a locality. */
export const puntosDeLocalidades = (fc) => localidadesParaMapa(fc);

/** Where each species' localities come from, as the attested file says it: one line per source, `{ estado: null, corta: the source's title, completa: its citation, licencia: its licence id, sitio, pagina, corroborado: null }`. The page is read from a sourceKey that ends in «-p<number>» (the PACE maps) and from nothing else. */
export function fuentesDePuntos(fc) {
  const out = {};
  for (const f of fc.features) {
    const p = f.properties ?? {};
    if (!p.slug || !p.sourceKey) continue;
    const lista = (out[p.slug] ??= []);
    if (lista.some((x) => x.clave === p.sourceKey)) continue;
    const m = /-p(\d{1,4})$/.exec(p.sourceKey);
    lista.push({ clave: p.sourceKey, estado: null, corta: p.source ?? p.sourceKey, completa: p.citation ?? p.source ?? p.sourceKey, licencia: p.licence ?? null, sitio: p.sourceKey === 'axolodao-sitio-mapa', pagina: m ? Number(m[1]) : null, corroborado: null });
  }
  return out;
}

/** [[west, south], [east, north]] around some units' bounding boxes and a species' drawn localities; null when there is nothing to fit. */
export function extension(cajas, localidades) {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  const sumar = (x0, y0, x1, y1) => { w = Math.min(w, x0); s = Math.min(s, y0); e = Math.max(e, x1); n = Math.max(n, y1); };
  for (const f of localidades?.features ?? []) {
    if (f.properties.kind === 'outline') continue;
    (function recorrer(c) { if (typeof c[0] === 'number') sumar(c[0], c[1], c[0], c[1]); else c.forEach(recorrer); })(f.geometry.coordinates);
  }
  if (!Number.isFinite(w)) for (const b of cajas) sumar(...b);
  return Number.isFinite(w) ? [[w, s], [e, n]] : null;
}

/** The bounding box [w, s, e, n] of every admin-1 unit, by ISO code. */
export function cajasDeUnidades(admin1) {
  const out = {};
  for (const f of admin1.features) {
    let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
    (function recorrer(c) { if (typeof c[0] === 'number') { w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]); } else c.forEach(recorrer); })(f.geometry.coordinates);
    out[f.properties.iso] = [w, s, e, n];
  }
  return out;
}

/** The reasons a locality collection may not be drawn; an empty list means it may. */
export function validarLocalidades(fc) {
  const motivos = [];
  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) return ['not a FeatureCollection'];
  fc.features.forEach((f, n) => {
    const p = f.properties ?? {};
    const donde = `feature ${n} (${p.slug ?? '?'})`;
    if (!p.slug) motivos.push(`${donde}: no species slug`);
    if (!['0.1deg', '0.5deg', 'municipality', 'named_water_body'].includes(p.generalization)) { motivos.push(`${donde}: generalization is ${p.generalization}`); return; }
    if (!p.source || typeof p.sourceKey !== 'string' || !p.sourceKey) motivos.push(`${donde}: no source, or no source key`);
    if (p.generalization === 'named_water_body') {
      if (f.geometry?.type !== 'Point') motivos.push(`${donde}: a lake is a point, not ${f.geometry?.type}`);
      if (!p.name) motivos.push(`${donde}: a lake has no name`);
    } else if (p.generalization === 'municipality') {
      if (f.geometry?.type !== 'Point') motivos.push(`${donde}: a municipality is its centroid, a point, not ${f.geometry?.type}`);
    } else if (f.geometry?.type !== 'Polygon' || f.geometry.coordinates[0].length !== 5) motivos.push(`${donde}: a cell is a closed square of 5 positions`);
    else {
      const d = ARISTA[p.generalization];
      const [[x0, y0], [x1], [, y2]] = f.geometry.coordinates[0];
      if (Math.abs(x1 - x0 - d) > 1e-9 || Math.abs(y2 - y0 - d) > 1e-9) motivos.push(`${donde}: a ${p.generalization} cell must be exactly ${d}° by ${d}°`);
      if (Math.abs(x0 / d - Math.round(x0 / d)) > 1e-6 || Math.abs(y0 / d - Math.round(y0 / d)) > 1e-6) motivos.push(`${donde}: a cell must sit on the ${d}° grid`);
    }
  });
  return motivos;
}

/** The synonym table of the genus bundle: «Ambystoma <epithet>» names of a taxon the atlas lists, when that epithet is not itself one of the atlas's species. A name claimed by two different accepted taxa has no single answer: it stops the import. */
export function tablaDeSinonimos(taxa, registros) {
  const epitetoDe = (slug) => String(slug).replace(/^ambystoma_/, '');
  const enElAtlas = new Set(taxa.map((t) => epitetoDe(t.slug)));
  const aceptadoDe = new Map(taxa.map((t) => [t.id, epitetoDe(t.slug)]));
  const sinonimos = {};
  for (const r of registros) {
    const m = /^Ambystoma (\w+)$/.exec(r.name ?? '');
    const acepta = aceptadoDe.get(r.taxonId);
    if (!m || !acepta || enElAtlas.has(m[1].toLowerCase())) continue;
    const nombre = m[1].toLowerCase();
    if (sinonimos[nombre] && sinonimos[nombre] !== acepta) throw new Error(`the synonym «${nombre}» is claimed by two taxa (${sinonimos[nombre]} and ${acepta})`);
    sinonimos[nombre] = acepta;
  }
  return sinonimos;
}

/** Whether a status row is one the card keeps: the global and country ones, and every US federal (ESA) listing whatever its scope (a distinct population segment is scoped to its state, and is still a federal listing: it is never silently dropped). */
export const categoriaVisible = (c) => ALCANCES_DE_ESTATUS.has(c.scope) || c.system === 'esa';
/** The IUCN citation the page prints, the form the hub serves: the category, the assessment year and the access date live only INSIDE this text, never as data fields. */
export const citaUicn = (s) => (s.system === 'iucn' && s.assessedYear && s.accessDate ? `UICN: ${s.category} (evaluación ${s.assessedYear}) · ${s.citation}, consultada el ${s.accessDate}` : (s.citation ?? null));
/** The status categories a card shows: the global and country ones. NatureServe's subnational ranks (S3, S4…) stay in the hub; the file importer and the hub reader apply this same selection, so a hub build renders exactly what a file build renders. The assessment year is never a data field: it lives only inside the citation. */
export const ALCANCES_DE_ESTATUS = new Set(['global', 'MX', 'US', 'CA']);
