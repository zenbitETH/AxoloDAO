// Types for the Ajolotes Explorer. Field names mirror the keys produced by the
// prototype's data.js exporter (Spanish, matching the operativo workbook), so
// the bundle.json the explorer ships with maps 1:1.

import type { Locale } from '../waterQuality/types';

export type { Locale };

export type StationId = 'AA' | 'AM' | 'AD' | 'Larvario';

// Latin name as it appears in the source workbook
export type SpeciesCode = 'A. andersoni' | 'A. mexicanum' | 'A. dumerilii';

// Map a workbook species literal onto the existing waterQuality SpeciesCode
// so we can reuse accentForTheme() without rewriting the palette.
import type { SpeciesCode as WqSpeciesCode } from '../waterQuality/types';
export function speciesToWq(s: SpeciesCode | string | null | undefined): WqSpeciesCode {
  if (s === 'A. andersoni') return 'andersoni';
  if (s === 'A. mexicanum') return 'mexicanum';
  if (s === 'A. dumerilii') return 'dumerilii';
  return 'na';
}

export interface Ejemplar {
  alias: string;
  id: string | null;
  pecera: string | null;        // canonical home aquarium / station
  // True when the animal's home aquarium (pecera) is assigned but it is
  // physically out in cuarentena — surfaced as a ribbon on the station tile.
  enCuarentena?: boolean;
  especie: SpeciesCode;
  genero: string | null;          // "Hembra" | "Macho" | "Sin sexar" | …
  marcas: string | null;
  fenotipo: string | null;
  edad: string | null;            // free-text e.g. "5 años"
  estadio: string | null;

  // Friendly curator narrative (curated copy, not from the workbook). breve =
  // 2–3 sentences shown by default; extendida = full paragraph revealed via
  // "leer más" in the Resumen tab.
  descripcion?: { breve: string; extendida: string } | null;

  // biometry snapshot
  peso: number | null;
  lt: number | null;              // longitud total (cm)
  lhc: number | null;             // longitud hocico-cloaca (cm)
  icc: number | null;             // índice de condición corporal
  propCabezaCuerpo: number | null;
  propColaCuerpo: number | null;
  asimetria: string | null;
  temp: number | null;
  bcs: string | number | null;    // body-condition score, 1–5 (or "Sin datos")

  // status (each field begins with a leading emoji that drives tone)
  estadoBio: string | null;
  alertaGastrica: string | null;
  alertaConductual: string | null;
  anomalia: string | null;

  // último consumo
  ultimoConsumo: number | null;
  respuestaAlim: string | null;
}

export interface HistorialEntry {
  fecha: string;                  // ISO YYYY-MM-DD
  autor: string | null;
  autor2: string | null;
  temp: number | null;
  // biometry
  peso: number | null;
  lt: number | null;
  lhc: number | null;
  largoCabeza: number | null;
  anchoCabeza: number | null;
  interaxial: number | null;
  anchoCuerpo: number | null;
  tibia: number | null;
  femur: number | null;
  antebrazo: number | null;
  brazo: number | null;
  branqIzq: number | null;
  branqDer: number | null;
  // physical exam (free text)
  cabeza: string | null;
  cuerpo: string | null;
  extremidades: string | null;
  cola: string | null;
  comportamiento: string | null;
  // metadata
  bcs: number | string | null;
  categoria: string | null;
  subcategoria: string | null;
  tipo: string | null;
  justificacion: string | null;
  notas: string | null;
}

export interface PlanAlimentacion {
  pecera: string | null;
  especie: SpeciesCode | null;
  estadio: string | null;
  dietaBase: string | null;
  planB: string | null;
  porcion: string | null;
  frecuencia: string | null;      // "Lunes, Miercoles" — comma-separated day names
  notas: string | null;
}

export interface RegistroAlimentacion {
  fecha: string;
  hora: number | null;            // Excel time fraction (0..1)
  autor: string | null;
  tipo: string | null;
  racion: number | null;          // grams offered
  sobrante: number | null;        // grams uneaten
  consumo: number | null;         // grams consumed
  respuesta: string | null;
}

export interface Baja {
  fecha: string | null;           // ISO
  nombre: string;
  peso: number | string | null;   // sometimes "NA"
  longitud: number | string | null;
  edad: string | null;
  causa: string | null;
  necropcia: string | null;       // "NA" | "En proceso" | descriptive
}

export interface TerapeuticaEntry {
  fecha: string;                  // ISO
  hora: number | null;            // Excel time fraction (0..1)
  autor: string | null;
  autor2: string | null;
  ubicacion: string | null;
  diagnostico: string | null;
  pruebasLab: string | null;
  tratamiento: string | null;
  dosis: string | null;
  via: string | null;
  diaTratamiento: string | null;  // free-form: ISO date OR day-count text
  observaciones: string | null;
  estado: string | null;          // "Activo" | "Alta medica" | …
}

// Bitácora events live in a separate JSON (ops/bitacora-recent.json) and can
// carry both an alias (per-ejemplar) and an ubicación (per-tank/system).
export interface BitacoraEntry {
  fecha: string;                  // ISO
  hora: string | null;            // HH:MM
  estado: string | null;
  autorPrincipal: string | null;
  autorSecundario: string | null;
  categoria: string | null;
  alias: string | null;           // may be comma-separated for multi-ejemplar events
  ubicacion: string | null;
  incidencia: string | null;
  accion: string | null;
  notas: string | null;
  linkReporte: string | null;
}

export interface Bundle {
  /** Live roster only — deceased and embargoed specimens are filtered at ingest. */
  ejemplares: Ejemplar[];
  /**
   * Last known snapshot of each deceased (non-embargoed) specimen. Kept separate
   * from `ejemplares` so nothing renders them as alive, while the In-Memoriam
   * wall can still read their final biometrics. Optional: a bundle generated
   * before this field existed still parses.
   */
  bajasSnapshots?: Ejemplar[];
  historial: Record<string, HistorialEntry[]>;
  planes: Record<string, PlanAlimentacion>;
  alimentacion: Record<string, RegistroAlimentacion[]>;
  terapeutica: Record<string, TerapeuticaEntry[]>;
  bajas: Baja[];
}

export type StatusTone = 'ok' | 'warn' | 'alarm' | 'muted';
