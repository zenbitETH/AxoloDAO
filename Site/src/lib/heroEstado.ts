// The hero's states, each from a fact of the build, never a flag or an environment variable, so the page never claims what the build
// could not verify:
//   1. state A or B (lib/estadoHero.mjs): A only when the attestation snapshot (src/data/atestacion-atlas.json) reads «coincide», was read
//      within the last 7 days, and every atlas data file this build serves came from a strict hub read whose bundles the attestation
//      covers with the same hashes. The hero judges the very objects the /atlas/datos/ route serves (lib/atlasLectura.mjs). Otherwise B,
//      with each reason in the build log;
//   2. datos_en_linea: the atlas data route exists in this tree and declares its files; scripts/check-hero-estado.mjs then fails the build
//      if any declared file is missing or empty in the dist;
//   3. {confirmaciones}: the inventory's count of clip confirmations with an attestation on Sepolia (lib/inventarioHome.ts, CIFRAS.clips);
//   4. the scope of state B's onchain line, from the snapshot's `cubre` and `noCubiertos` (lib/alcanceAtestacion.mjs): «el atlas» only when
//      all six bundles the site reads are covered and none is left out, «las especies del atlas» otherwise.
// State A shows its title and its subtitle and nothing else (the 22-oct ruling): no onchain line and no read date.
import { type Locale, t } from '@/i18n/strings';
import { leerAtlas } from '@/lib/atlasLectura.mjs';
import { ARCHIVOS } from '@/lib/atlasSnapshot.mjs';
import { decidir } from '@/lib/estadoHero.mjs';
import { CIFRAS, llenar } from '@/lib/inventarioHome';

const snapshots = import.meta.glob('/src/data/atestacion-atlas.json', { eager: true, import: 'default' });
const snapshot = Object.values(snapshots)[0] as Record<string, unknown> | undefined;

// the served objects, read only when there is a snapshot to judge them against (otherwise the hero makes no read of its own)
const servidos: Record<string, unknown> = snapshot
  ? Object.fromEntries(await Promise.all(ARCHIVOS.map(async (n) => [n, await leerAtlas(n, { publica: import.meta.env.PUBLIC_HUB_URL ?? '' })])))
  : {};
export const DECISION = decidir({ snapshot, servidos, ahora: Date.now() });
export const ATLAS_VERIFICADO: boolean = DECISION.estado === 'A';
export const ALCANCE: 'atlas' | 'especies' = DECISION.alcance;

const ruta = import.meta.glob('/src/pages/atlas/datos/\\[archivo\\].ts');
export const DATOS_EN_LINEA: boolean = Object.keys(ruta).length === 1 && ARCHIVOS.length > 0;

export const CONFIRMACIONES: number = CIFRAS.clips;
if (CONFIRMACIONES < 1) throw new Error('[hero] el inventario no trae ninguna confirmación de clip en Sepolia: la línea onchain no puede nombrarlas');

if (!ATLAS_VERIFICADO) {
  console.warn(`[hero] estado B (título ${DATOS_EN_LINEA ? 'con' : 'sin'} «datos abiertos»):\n  ${DECISION.problemas.join('\n  ')}`);
}

// a title with a figure the inventory lacks is a build error, never an empty title
const rellenar = (texto: string, locale: Locale): string => {
  const lleno = llenar(texto, locale);
  if (lleno === null) throw new Error(`[hero] el título pide una cifra que el inventario no trae: «${texto}»`);
  return lleno;
};

/** The hero's title, for the state the build verified. */
export const tituloHero = (locale: Locale): string =>
  rellenar(t(locale, ATLAS_VERIFICADO ? 'hero.title' : DATOS_EN_LINEA ? 'hero.title.b.conDatos' : 'hero.title.b.sinDatos'), locale);

/** The hero's subtitle, for the state the build verified. */
export const subtituloHero = (locale: Locale): string => t(locale, ATLAS_VERIFICADO ? 'hero.subtitle.a' : 'hero.subtitle.b');

/** State B's onchain line for the scope, with {confirmaciones} in the singular or the plural; null in state A, which has none. */
export const lineaOnchain = (locale: Locale): string | null =>
  ATLAS_VERIFICADO ? null : t(locale, `hero.onchain.b.${ALCANCE}`).replace(
    '{confirmaciones}',
    t(locale, CONFIRMACIONES === 1 ? 'hero.onchain.confirmaciones.uno' : 'hero.onchain.confirmaciones.varias'),
  );
