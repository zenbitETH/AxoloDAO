// Shared types for the unified event timeline used by the ajolotes detail
// modal (Eventos tab) and the xolotlcalli per-tank panel.
//
// `TimelineEvent` is render-agnostic: the modal renders JSX, the carousel
// generator (eventually) emits HTML strings, but both consume the same merged
// chronological feed.

export type TimelineSource = 'historial' | 'terapeutica' | 'bitacora' | 'baja';

export type TimelineTone = 'ok' | 'warn' | 'alarm' | 'muted';

export interface TimelineEvent {
  id: string;                  // stable key: `${source}:${alias|ubicacion}:${fecha}:${idx}`
  source: TimelineSource;
  date: string;                // ISO YYYY-MM-DD
  time: string | null;         // "HH:MM" or null when unknown
  alias: string | null;
  ubicacion: string | null;
  categoria: string | null;
  subcategoria: string | null;
  tone: TimelineTone;          // primary tone (drives dot + state pill color)
  estado: string | null;       // raw state label (e.g. "Activo", "Resuelto")
  title: string;               // headline shown next to the dot
  detail: string | null;       // secondary line (one field) — kept short for the timeline
  notes: string | null;        // free-form notes shown below detail when expanded
  authors: { main: string | null; secondary: string | null };
  // Source-specific original entry for renderers that want the full record.
  raw: unknown;
}
