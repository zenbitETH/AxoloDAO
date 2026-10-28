// A live read from the registry with the build data as its fallback. Plain ESM, so the atlas and scripts/test-atlas.mjs share it.

/** `fetch` JSON with a timeout; rejects on a non-2xx answer or when the time runs out. */
export async function getJson(url, ms = 5000, fetchFn = globalThis.fetch) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetchFn(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * `{ data, live }`: what `vivo()` returns when `hubUrl` is set and the registry answers, else whatever `enBuild()` returns, with `live: false`.
 * The build data is never empty because the hub is down: it is what the build carried.
 */
export async function liveOrBuild(hubUrl, vivo, enBuild) {
  if (hubUrl) {
    try {
      return { data: await vivo(), live: true };
    } catch {
      // fall through to the build data
    }
  }
  return { data: await enBuild(), live: false };
}

const base = (hubUrl) => hubUrl.replace(/\/$/, '');
/** The hub wraps every answer: `{ schemaVersion, generatedAt, data }`. The build list the site carries is a bare array. */
export const desenvolver = (r) => (r && !Array.isArray(r) && 'data' in r ? r.data : r);

/**
 * The listed organizations with their sites: `/v1/orgs?listed=true` is a list of summaries
 * `{ slug, displayName, state, verification: { level, method, expiresAt }, orgUid, ... }` with no coordinates; each organization's
 * generalized site coordinates are in `/v1/orgs/{slug}` (`sites[].latGen`, `sites[].lonGen`). An organization whose detail does not
 * answer is kept without a site (it is listed, it is just not on the map).
 */
export async function organizacionesEnVivo(hubUrl, { ms = 5000, fetchFn = globalThis.fetch } = {}) {
  const resumen = desenvolver(await getJson(`${base(hubUrl)}/v1/orgs?listed=true`, ms, fetchFn));
  if (!Array.isArray(resumen)) throw new Error('/v1/orgs did not return a list');
  return Promise.all(resumen.map(async (o) => {
    try {
      return desenvolver(await getJson(`${base(hubUrl)}/v1/orgs/${encodeURIComponent(o.slug)}`, ms, fetchFn));
    } catch {
      return { ...o, sites: [] };
    }
  }));
}

/** Organizations (summary with `sites`) -> GeoJSON points at each site's generalized coordinates. */
export function organizacionesComoPuntos(lista) {
  const features = [];
  for (const o of Array.isArray(lista) ? lista : []) {
    for (const s of Array.isArray(o.sites) ? o.sites : []) {
      const lon = Number(s.lonGen);
      const lat = Number(s.latGen);
      if (s.lonGen === null || s.latGen === null || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { slug: String(o.slug ?? ''), nombre: String(o.displayName ?? ''), registrada: true, nivel: Number(o.verification?.level ?? 0),
          metodo: Number(o.verification?.method ?? 0), estado: String(o.state ?? '') } });
    }
  }
  return { type: 'FeatureCollection', features };
}

/** The layers the registry serves right now (a flagged layer appears only when its flag is on there): `[{ slug, title, geojson, licence, citation }]`. */
export async function capasDelRegistro(hubUrl, { ms = 8000, fetchFn = globalThis.fetch } = {}) {
  const lista = desenvolver(await getJson(`${base(hubUrl)}/v1/layers`, ms, fetchFn));
  if (!Array.isArray(lista)) throw new Error('/v1/layers did not return a list');
  return lista;
}

/** One layer's GeoJSON, by the path the registry itself announced in `/v1/layers` (never a path built here). */
export async function geojsonDeCapa(hubUrl, capa, { ms = 30000, fetchFn = globalThis.fetch } = {}) {
  if (!capa || typeof capa.geojson !== 'string' || !capa.geojson.startsWith('/v1/layers/')) throw new Error('the registry announced no GeoJSON path for this layer');
  return getJson(`${base(hubUrl)}${capa.geojson}`, ms, fetchFn);
}
