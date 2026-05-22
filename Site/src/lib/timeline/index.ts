// Public API for the timeline lib. Consumers (EventosTab, TankCard) call
// buildAliasTimeline / buildTankTimeline to get a chronological list of
// TimelineEvent objects already tone-tagged and ready to render.

import type {
  HistorialEntry,
  TerapeuticaEntry,
  BitacoraEntry,
  Baja,
} from '../../components/ajolotes/types';
import type { TimelineEvent, TimelineSource } from './types';
import {
  fromHistorial,
  fromTerapeutica,
  fromBitacora,
  fromBaja,
} from './adapters';

export type { TimelineEvent, TimelineSource, TimelineTone } from './types';
export { dotColorForCategory } from './adapters';

// Sort priority for tie-breaking when two events share the same date and no
// time is recorded. Higher = comes later in ascending order.
const SOURCE_PRIORITY: Record<TimelineSource, number> = {
  bitacora: 1,
  historial: 2,
  terapeutica: 3,
  baja: 4,
};

function compareEvents(a: TimelineEvent, b: TimelineEvent): number {
  const ad = a.date + (a.time ?? '');
  const bd = b.date + (b.time ?? '');
  if (ad < bd) return -1;
  if (ad > bd) return 1;
  return SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source];
}

export interface AliasTimelineInput {
  alias: string;
  historial: HistorialEntry[];
  terapeutica: TerapeuticaEntry[];
  bitacora: BitacoraEntry[];  // already filtered to entries touching `alias`
  baja: Baja | null;
}

// Build the per-ejemplar timeline. Returns events ascending by date+time;
// renderers reverse this for newest-first display.
export function buildAliasTimeline(input: AliasTimelineInput): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  input.historial.forEach((h, i) => {
    if (!h.fecha) return;
    events.push(fromHistorial(input.alias, h, i));
  });
  input.terapeutica.forEach((t, i) => {
    if (!t.fecha) return;
    events.push(fromTerapeutica(input.alias, t, i));
  });
  input.bitacora.forEach((b, i) => {
    if (!b.fecha) return;
    events.push(fromBitacora(b, i));
  });
  if (input.baja) {
    const e = fromBaja(input.baja, 0);
    if (e) events.push(e);
  }
  events.sort(compareEvents);
  return events;
}

export interface TankTimelineInput {
  tankId: string;
  bitacora: BitacoraEntry[];  // already filtered to entries touching `tankId`
}

// Build the per-tank timeline. Currently only sources Bitácora; future
// surfaces (e.g. cooling-maintenance dates from Descripcion de sistemas) can
// be added here without touching call sites.
export function buildTankTimeline(input: TankTimelineInput): TimelineEvent[] {
  const events = input.bitacora
    .filter((b) => b.fecha)
    .map((b, i) => fromBitacora(b, i));
  events.sort(compareEvents);
  return events;
}

// Filter a Bitácora array by alias. Handles comma-separated alias cells like
// "Remo, Rómulo" (multi-ejemplar event) by checking membership.
export function filterBitacoraByAlias(bitacora: BitacoraEntry[], alias: string): BitacoraEntry[] {
  return bitacora.filter((b) => {
    if (!b.alias) return false;
    return b.alias.split(',').map((s) => s.trim()).includes(alias);
  });
}

// Filter a Bitácora array by tank. The xlsx's `ubicación` cell can hold a
// canonical tank id (AA, AM 1) or a subsystem (AM 2.2). For AM family we
// fold any string starting with "AM" into the unified AM tank post-cutoff
// to match the measurements pipeline; pre-cutoff handling kept simple
// (subsystem strings like "AM 1.2" still match AM 1).
const AM_UNIFICATION = '2026-04-28';

export function filterBitacoraByTank(bitacora: BitacoraEntry[], tankId: string): BitacoraEntry[] {
  const canonical = tankId.toUpperCase();
  return bitacora.filter((b) => {
    if (!b.ubicacion) return false;
    const ub = b.ubicacion.trim().toUpperCase();
    if (ub === canonical) return true;
    // AM 1.x → AM 1 pre-cutoff, AM post-cutoff; AM 2.x same idea.
    if (canonical === 'AM' && /^AM(\s|$)/.test(ub) && b.fecha >= AM_UNIFICATION) return true;
    if (canonical === 'AM 1' && /^AM[\s-]*1(\.|$)/.test(ub) && b.fecha < AM_UNIFICATION) return true;
    if (canonical === 'AM 2' && /^AM[\s-]*2(\.|$)/.test(ub) && b.fecha < AM_UNIFICATION) return true;
    if (canonical === 'AD' && /^AD(\s|-|$)/.test(ub)) return true;
    return false;
  });
}
