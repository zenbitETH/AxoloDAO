// The one read of the six atlas data files per build, shared by everything that serves or judges them (the /atlas/datos route, the species map SVG, the hero's state): they all get the same object,
// so the hero judges the bytes that are written. The read is STRICT whenever the build has a hub: a file that falls back or differs from the committed one stops the build (see atlasSnapshot.mjs).
// The hub the BUILD reads is HUB_BUILD_URL, else PUBLIC_HUB_URL. Only PUBLIC_HUB_URL reaches the visitor's browser (the live polling of the registry), so a build against a hub on this machine sets HUB_BUILD_URL
// and no loopback address is ever written into a page. The booth key (HUB_KEY_FILE/HEADER/SCHEME) is sent to that hub only.
import { archivosDelSitio, instantanea } from './atlasSnapshot.mjs';
import { conClave } from './hubClave.mjs';

const CACHE = Symbol.for('axolodao.atlas.lecturas');
const SITIOS = (globalThis[Symbol.for('axolodao.atlas.sitios')] ??= {});

/** The hub URL the build reads: HUB_BUILD_URL, else the public one. `publica` is PUBLIC_HUB_URL as the caller sees it (import.meta.env). */
export const hubDelBuild = (publica = '', env = process.env) => String(env.HUB_BUILD_URL || publica || '');

/**
 * The data file `nombre` as this build reads it: the same promise for every caller. `opciones` is for tests (`env`, `publica`, `sitio`, `fetchFn`, `cache`, `raiz`, `aviso`).
 * `paridadHub` is set only by a strict hub read that matched the committed file; a fallback or a committed file never carries it.
 */
export function leerAtlas(nombre, { env = process.env, publica = '', sitio, fetchFn, cache, raiz = process.cwd(), aviso = (m) => console.warn(`[atlas] ${m}`) } = {}) {
  const hubUrl = hubDelBuild(publica, env);
  const estricto = !!hubUrl && env.ATLAS_HUB_LAXO !== '1';
  const memoria = cache ?? (globalThis[CACHE] ??= new Map());
  const clave = `${raiz}|${hubUrl}|${estricto}|${nombre}`;
  if (!memoria.has(clave)) {
    const propios = sitio ?? ((SITIOS[raiz] ??= archivosDelSitio(raiz)));
    // ONE keyed fetch per hub URL for the whole build: instantanea keeps its once-per-fetch caches (the species and admin1 reads) on the function it is given, so six wrappers would be six reads
    const claveF = `fetch|${hubUrl}|${env.HUB_KEY_FILE ?? ''}|${env.HUB_KEY_HEADER ?? ''}|${env.HUB_KEY_SCHEME ?? ''}`;
    if (!fetchFn && hubUrl && !memoria.has(claveF)) memoria.set(claveF, conClave(globalThis.fetch, { archivo: env.HUB_KEY_FILE, cabecera: env.HUB_KEY_HEADER, esquema: env.HUB_KEY_SCHEME, hubUrl }));
    const f = fetchFn ?? (hubUrl ? memoria.get(claveF) : globalThis.fetch);
    memoria.set(clave, instantanea(nombre, { hubUrl, sitio: propios, fetchFn: f, estricto, aviso }));
  }
  return memoria.get(clave);
}
