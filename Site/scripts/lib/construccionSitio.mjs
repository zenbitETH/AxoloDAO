// The rules of the axolodao.org build that are not about copying files: what the environment must say before anything is built, what the tree must be, and what the built folder must prove.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARCHIVOS } from '../../src/lib/atlasSnapshot.mjs';
import { buscarLocal } from './direccionesLocales.mjs';
import { hallazgosBinarios } from './barridoBinario.mjs';
import { problemasDeLaConstruccion } from '../pre-push-huella.mjs';
import { cadenaPublica, clipsPublicos, fichaPublica } from '../../src/lib/pilotoPublico.mjs';

// the pilot's three files as the site serves them: each must be exactly its public projection (a field the projection does not list never ships)
const COPIAS_PUBLICAS = [['xolotlcalli-ficha.json', fichaPublica], ['xolotlcalli-clips.json', clipsPublicos], ['xolotlcalli-cadena.json', cadenaPublica]];

/** The pilot files in a built site that are not byte for byte their public projection. */
export function problemasDeLaCopiaPublica(out) {
  const mal = [];
  for (const [n, proyectar] of COPIAS_PUBLICAS) {
    const f = join(out, 'atlas/real', n);
    if (!existsSync(f)) { mal.push(`atlas/real/${n}: not in the build`); continue; }
    const bytes = readFileSync(f, 'utf8');
    let esperado; try { esperado = JSON.stringify(proyectar(JSON.parse(bytes))); } catch (e) { mal.push(`atlas/real/${n}: not a pilot file the projection can read (${e.message})`); continue; }
    if (bytes !== esperado) mal.push(`atlas/real/${n}: not exactly its public projection (a field or a value the projection does not write)`);
  }
  return mal;
}

/** Why this environment may not build axolodao.org, or null. `prueba` (--prueba) is for the test runner only: it builds without the hub and says so in build.json. */
export function motivoParaNoConstruir(env, { prueba = false } = {}) {
  if (env.PUBLIC_HUB_URL && buscarLocal(env.PUBLIC_HUB_URL)) return 'PUBLIC_HUB_URL is a local address: it would be written into every page as the address the visitor\'s browser calls. Build with HUB_BUILD_URL (the hub the BUILD reads) and leave PUBLIC_HUB_URL unset';
  if (prueba) return null;
  if (!env.HUB_BUILD_URL) return 'HUB_BUILD_URL is not set: axolodao.org is built from a strict hub read (with HUB_KEY_FILE, HUB_KEY_HEADER, HUB_KEY_SCHEME for the booth key)';
  if (env.ATLAS_HUB_LAXO === '1') return 'ATLAS_HUB_LAXO=1 turns the strict hub read off, and that is for the tests that build against a stub hub, never for the site';
  return null;
}

/** The lines of `git status --porcelain` (tracked changes and untracked files): the tree a deployable build comes from must have none. */
export const arbolSucio = (cwd) => execFileSync('git', ['status', '--porcelain'], { cwd }).toString().split('\n').filter(Boolean);

/** What the built folder must prove: each of the six atlas data files was read from the hub and matched (fuente hub, paridadHub true, the bundles), no local address or machine path, no source map, a real build record. */
export function problemasDeLaConstruccionDelSitio(out, { prueba = false } = {}) {
  const mal = [];
  if (!prueba) {
    for (const a of ARCHIVOS) {
      const f = join(out, 'atlas/datos', a);
      if (!existsSync(f)) { mal.push(`${a}: not in the build`); continue; }
      let d; try { d = JSON.parse(readFileSync(f, 'utf8')); } catch { mal.push(`${a}: not valid JSON`); continue; }
      if (d.fuente !== 'hub') mal.push(`${a}: fuente is ${JSON.stringify(d.fuente)}, not "hub"`);
      if (d.paridadHub !== true) mal.push(`${a}: paridadHub is not true`);
      if (!Array.isArray(d.generadoDe?.bundles) || !d.generadoDe.bundles.length) mal.push(`${a}: generadoDe.bundles is missing`);
    }
  }
  return [...mal, ...problemasDeLaCopiaPublica(out), ...hallazgosBinarios(out), ...problemasDeLaConstruccion(out).filter((m) => !(prueba && /build\.json: (this is a test build|built from a dirty tree)/.test(m)))];
}
