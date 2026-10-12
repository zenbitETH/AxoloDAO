// Shared memorial derivation for the Bajas wall + memorial modal. Pure TS (no
// Preact) on purpose, so the Pulso carousel generator can mirror the exact same
// logic against the same bundle.json.
//
// When a specimen dies, curators drop it from the Dashboard sheet, so it leaves
// bundle.ejemplares — but its historial / alimentación / terapéutica records
// stay keyed by alias. The full profile is therefore still shipped, just
// orphaned (no live card to click, deep-link breaks). These helpers rebuild the
// Ejemplar the modal needs and derive the at-a-glance memorial stats.

import type { Baja, Bundle, Ejemplar, HistorialEntry, SpeciesCode } from './types';

// Species for every curated memorial specimen, so a baja that has been dropped
// from the Dashboard sheet (no ejemplares row) still shows its TRUE species
// instead of a fabricated default. This MUST cover every name in
// AjolotesExplorer's BAJAS_VISIBLE_NAMES — Panchita in particular is the last
// A. andersoni the colony held; letting her fall through to the mexicanum
// default would mislabel her on her own memorial once curators drop her row.
// (Leucistica/Loncho species are the operativo report's own inference: blank in
// the registry, AM recinto ⇒ A. mexicanum.)
const BAJA_SPECIES_HINT: Record<string, SpeciesCode> = {
  Leucistica: 'A. mexicanum',
  Loncho: 'A. mexicanum',
  Panchita: 'A. andersoni',
  Goldy: 'A. mexicanum',
  // Las bajas del bundle no traen columna de especie —el ingest no la emite—, y
  // esta ya no tiene fila en el Dashboard, así que sin esta pista `resolveEspecie`
  // devuelve null y la tarjeta sale sin especie. El registro la escribe
  // «A. andersonii», con doble i; el código canónico lleva una.
  'Andersoni 1': 'A. andersoni',
  'Larva 2': 'A. mexicanum',
};

// Fechas corregidas a mano, por nombre, sólo para lo que no tiene fila de baja con fecha. Las bajas con
// fila llegan ya con su fecha canónica desde el generador (scripts/data-ajolotes.mjs toma la de
// bajas-forense.json: día y mes invertidos, año errado y laboratorio contra libro ya resueltos), y la
// comprobación de la construcción (scripts/check-fechas.mjs) falla si el sitio y forense no coinciden.
export const BAJA_FECHA_FIX: Record<string, string> = {
  // Larva 2 sólo está como ejemplar fallecido en el registro (sin fila de baja con fecha): su muerte es del 23 de septiembre de 2026, después del cierre del
  // museo, así que al cierre estaba viva y no cuenta como baja del periodo.
  'Larva 2': '2026-09-23',
};

/** La baja con su fecha corregida, si hay corrección curada para ese nombre. */
export function withFechaFix<T extends Baja>(baja: T): T {
  const fix = BAJA_FECHA_FIX[(baja.nombre ?? '').trim()];
  return fix ? { ...baja, fecha: fix } : baja;
}

// Single source of truth for a baja's species, used by both the modal-synth
// path and deriveMemorial so they can never disagree: the real ejemplar row
// wins, else the curated hint, else null (genuinely unknown — never guessed).
export function resolveEspecie(bundle: Bundle, baja: Baja): SpeciesCode | null {
  return (
    (bundleEjemplarFor(bundle, baja.nombre)?.especie as SpeciesCode | undefined) ??
    BAJA_SPECIES_HINT[baja.nombre] ??
    null
  );
}

// Necropsy status → {done, pending, text}, normalized once (trim + case) so the
// wall card and the modal band can never diverge on a padded/lowercase value.
export function necroStatus(baja: Baja | null | undefined): { done: boolean; pending: boolean; text: string } {
  const raw = String(baja?.necropcia ?? '').trim();
  const pending = /proceso/i.test(raw);
  const done = raw !== '' && raw.toUpperCase() !== 'NA' && !pending;
  return { done, pending, text: raw };
}

// Género for those same rowless bajas, where the operativo/report records it.
const BAJA_GENERO_HINT: Record<string, string> = {
  Leucistica: 'Hembra',
};

const num = (v: number | string | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const byFechaAsc = (a: HistorialEntry, b: HistorialEntry) =>
  (a.fecha ?? '').localeCompare(b.fecha ?? '');

export interface WeightPoint {
  fecha: string;
  peso: number;
}

export interface MemorialProfile {
  nombre: string;
  fecha: string | null; // death date
  causa: string | null;
  necropcia: string | null;
  edad: string | null; // free-text age at death, from the operativo
  especie: SpeciesCode | null;
  lastWeight: number | null;
  lastLength: number | null;
  firstRecord: string | null; // earliest historial fecha (records begin)
  lastRecord: string | null; // latest historial fecha
  weightSeries: WeightPoint[];
  hasHistorial: boolean;
  hasFeeding: boolean;
}

// The real ejemplar row for a baja. Deceased specimens are filtered out of the
// live `ejemplares` roster at ingest, so their final snapshot lives in
// `bajasSnapshots` — check both. (`ejemplares` stays first only so a name that
// somehow appears in both resolves to the live row.) Rowless bajas (Loncho and
// the unnamed larvae) return null → rebuilt by synthEjemplarFromBaja below.
export function bundleEjemplarFor(bundle: Bundle, nombre: string): Ejemplar | null {
  const key = nombre.trim();
  const matches = (e: Ejemplar) => (e.alias ?? '').trim() === key;
  return bundle.ejemplares.find(matches) ?? bundle.bajasSnapshots?.find(matches) ?? null;
}

// Rebuild a minimal Ejemplar for a rowless baja so EjemplarModal can render its
// tabs (all keyed by alias). Biometry comes from the latest historial entry,
// falling back to the Baja snapshot. Curated/status fields stay null — the tabs
// already degrade (ResumenTab hides the narrative + shows "sin datos" pips,
// BiometriaTab shows an empty chart, AlimentacionTab shows the empty state).
export function synthEjemplarFromBaja(baja: Baja, bundle: Bundle): Ejemplar {
  const hist = (bundle.historial[baja.nombre] ?? []).filter((h) => h.fecha).sort(byFechaAsc);
  const last = hist[hist.length - 1] ?? null;
  return {
    alias: baja.nombre,
    id: null,
    pecera: null,
    // Never fabricate: resolveEspecie prefers the real row / curated hint. The
    // 'A. mexicanum' tail is an unreachable last resort (every memorialized name
    // is covered by BAJA_SPECIES_HINT) kept only to satisfy the non-null type.
    especie: resolveEspecie(bundle, baja) ?? 'A. mexicanum',
    genero: BAJA_GENERO_HINT[baja.nombre] ?? null,
    marcas: null,
    fenotipo: null,
    edad: baja.edad ?? null,
    estadio: null,
    descripcion: null,
    peso: num(last?.peso) ?? num(baja.peso),
    lt: num(last?.lt) ?? num(baja.longitud),
    lhc: num(last?.lhc),
    icc: null,
    propCabezaCuerpo: null,
    propColaCuerpo: null,
    asimetria: null,
    temp: null,
    bcs: last?.bcs ?? null,
    estadoBio: null,
    alertaGastrica: null,
    alertaConductual: null,
    anomalia: null,
    ultimoConsumo: null,
    respuestaAlim: null,
  };
}

// The Ejemplar to open the memorial modal with: the real row when it survives
// in the bundle, otherwise a rebuilt one.
export function memorialEjemplar(bundle: Bundle, baja: Baja): Ejemplar {
  return bundleEjemplarFor(bundle, baja.nombre) ?? synthEjemplarFromBaja(baja, bundle);
}

export function deriveMemorial(bundle: Bundle, baja: Baja): MemorialProfile {
  const hist = (bundle.historial[baja.nombre] ?? []).filter((h) => h.fecha).sort(byFechaAsc);
  const weightSeries: WeightPoint[] = hist
    .map((h) => ({ fecha: h.fecha, peso: num(h.peso) }))
    .filter((p): p is WeightPoint => p.peso != null);
  const ej = bundleEjemplarFor(bundle, baja.nombre);
  const feeding = bundle.alimentacion[baja.nombre] ?? [];
  const lastSeries = weightSeries.length ? weightSeries[weightSeries.length - 1].peso : null;
  return {
    nombre: baja.nombre,
    fecha: baja.fecha,
    causa: baja.causa,
    necropcia: baja.necropcia,
    edad: baja.edad ?? ej?.edad ?? null,
    especie: resolveEspecie(bundle, baja),
    lastWeight: num(baja.peso) ?? lastSeries,
    lastLength: num(baja.longitud) ?? num(ej?.lt),
    firstRecord: hist.length ? hist[0].fecha : null,
    lastRecord: hist.length ? hist[hist.length - 1].fecha : baja.fecha,
    weightSeries,
    hasHistorial: hist.length > 0,
    hasFeeding: feeding.length > 0,
  };
}
