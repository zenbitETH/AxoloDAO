// Public API for the timeline lib. EventosTab calls buildAliasTimeline to get
// a chronological list of TimelineEvent objects already tone-tagged and ready
// to render.

import type {
  HistorialEntry,
  TerapeuticaEntry,
  Baja,
} from '../../components/ajolotes/types';
import type { TimelineEvent, TimelineSource } from './types';
import {
  fromHistorial,
  fromTerapeutica,
  fromBaja,
} from './adapters';

export type { TimelineEvent, TimelineSource, TimelineTone } from './types';
export { dotColorForCategory } from './adapters';

// Sort priority for tie-breaking when two events share the same date and no
// time is recorded. Higher = comes later in ascending order.
const SOURCE_PRIORITY: Record<TimelineSource, number> = {
  historial: 1,
  terapeutica: 2,
  baja: 3,
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
  if (input.baja) {
    const e = fromBaja(input.baja, 0);
    if (e) events.push(e);
  }
  events.sort(compareEvents);
  return events;
}
