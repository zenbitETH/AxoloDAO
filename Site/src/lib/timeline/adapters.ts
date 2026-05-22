// Convert each domain entry shape into the unified TimelineEvent so the modal
// (and later the carousel) can render a single chronological feed.
//
// Tone selection extends the previous HistorialTab `dotForCat()` logic with
// rules for terapéutica `estado` and bitácora `categoria`/`estado`.

import type {
  HistorialEntry,
  TerapeuticaEntry,
  BitacoraEntry,
  Baja,
} from '../../components/ajolotes/types';
import type { TimelineEvent, TimelineTone } from './types';

export function dotColorForCategory(cat: string | null | undefined): TimelineTone {
  const x = (cat ?? '').toLowerCase();
  if (!x) return 'ok';
  if (/baja|necropcia/.test(x)) return 'alarm';
  if (/aler|criti|grav|emerg|alarma/.test(x)) return 'alarm';
  if (/vigil|aten|moder|requiere/.test(x)) return 'warn';
  if (/cuarentena|saproleg|enferm/.test(x)) return 'warn';
  return 'ok';
}

// Strip "(emoji) ESTABLE" / "(emoji) ALARMA CLÍNICA" markers down to the
// label; tone is computed from the underlying word, not the emoji.
function stripStatusEmoji(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/[✅⚠️❌🚨🔴🟡🟢]/g, '').trim();
}

function truncate(s: string, max = 120): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

function firstNonEmpty(...vals: (string | null | undefined)[]): string | null {
  for (const v of vals) {
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

// --- Historial -------------------------------------------------------------

export function fromHistorial(
  alias: string,
  h: HistorialEntry,
  idx: number,
): TimelineEvent {
  const tone = dotColorForCategory(h.categoria);
  // Historial has no dedicated state field; surface the categoria as the
  // state label so the row's right-side pill always carries the at-a-glance
  // signal that drives the dot color.
  const estado = h.categoria;
  // Prefer a clinical field for the headline, fall back to biometric snapshot.
  const clinical = firstNonEmpty(h.cabeza, h.cuerpo, h.cola, h.extremidades, h.comportamiento, h.notas);
  let title: string;
  if (clinical) {
    title = truncate(clinical);
  } else if (h.peso != null || h.lt != null) {
    const bits: string[] = [];
    if (h.peso != null) bits.push(`${h.peso} g`);
    if (h.lt != null) bits.push(`LT ${h.lt} cm`);
    if (h.temp != null) bits.push(`${h.temp}°C`);
    title = `Medición · ${bits.join(' · ')}`;
  } else {
    title = h.categoria ?? 'Registro médico';
  }
  return {
    id: `historial:${alias}:${h.fecha}:${idx}`,
    source: 'historial',
    date: h.fecha,
    time: null,
    alias,
    ubicacion: null,
    categoria: h.categoria,
    subcategoria: h.subcategoria,
    tone,
    estado,
    title,
    detail: h.tipo ?? null,
    notes: h.notas,
    authors: { main: h.autor, secondary: h.autor2 },
    raw: h,
  };
}

// --- Terapéutica -----------------------------------------------------------

export function fromTerapeutica(
  alias: string,
  t: TerapeuticaEntry,
  idx: number,
): TimelineEvent {
  // Estado drives tone: Activo / En tratamiento → warn; Alta medica → ok;
  // anything containing "alarma"/"grav" → alarm.
  const estado = (t.estado ?? '').toLowerCase();
  let tone: TimelineTone = 'warn';
  if (/alta|resuelt|cerrad/.test(estado)) tone = 'ok';
  else if (/aler|grav|criti|alarma/.test(estado)) tone = 'alarm';
  const title = firstNonEmpty(t.diagnostico, t.tratamiento, t.observaciones) ?? 'Tratamiento';
  const detailBits: string[] = [];
  if (t.tratamiento && t.diagnostico) detailBits.push(t.tratamiento);
  if (t.dosis) detailBits.push(t.dosis);
  if (t.via) detailBits.push(t.via);
  const detail = detailBits.length ? detailBits.join(' · ') : null;
  return {
    id: `terapeutica:${alias}:${t.fecha}:${idx}`,
    source: 'terapeutica',
    date: t.fecha,
    time: null,
    alias,
    ubicacion: t.ubicacion,
    categoria: t.diagnostico,            // diagnostic is more useful as the categoria chip
    subcategoria: null,                  // state lives in its own pill now
    tone,
    estado: t.estado,
    title: truncate(title),
    detail,
    notes: t.observaciones,
    authors: { main: t.autor, secondary: t.autor2 },
    raw: t,
  };
}

// --- Bitácora --------------------------------------------------------------

export function fromBitacora(b: BitacoraEntry, idx: number): TimelineEvent {
  // Tone derived from state first (Resuelto → ok, Requiere acción → alarm),
  // falling back to categoria when state is absent. "Requiere acción" needs
  // the red alarm tone so it reads as more urgent than open/active events.
  const estadoLower = (b.estado ?? '').toLowerCase();
  let tone: TimelineTone;
  if (/resuelt|cerrad|alta/.test(estadoLower)) tone = 'ok';
  else if (/requiere acción|requiere accion|aler|criti|grav|emerg|alarma/.test(estadoLower)) tone = 'alarm';
  else tone = dotColorForCategory(b.categoria);
  const title = firstNonEmpty(b.incidencia, b.accion, b.categoria, b.notas) ?? 'Evento';
  const detail = firstNonEmpty(b.accion !== b.incidencia ? b.accion : null, b.categoria, b.ubicacion);
  return {
    id: `bitacora:${b.alias ?? b.ubicacion ?? '·'}:${b.fecha}:${idx}`,
    source: 'bitacora',
    date: b.fecha,
    time: b.hora,
    alias: b.alias,
    ubicacion: b.ubicacion,
    categoria: b.categoria,
    subcategoria: null,                  // state moved to its own pill
    tone,
    estado: stripStatusEmoji(b.estado) || null,
    title: truncate(title),
    detail,
    notes: b.notas,
    authors: { main: b.autorPrincipal, secondary: b.autorSecundario },
    raw: b,
  };
}

// --- Bajas -----------------------------------------------------------------

export function fromBaja(b: Baja, idx: number): TimelineEvent | null {
  if (!b.fecha) return null;
  return {
    id: `baja:${b.nombre}:${b.fecha}:${idx}`,
    source: 'baja',
    date: b.fecha,
    time: null,
    alias: b.nombre,
    ubicacion: null,
    categoria: b.causa,
    subcategoria: null,
    tone: 'alarm',
    estado: 'Baja',
    title: b.causa ?? 'Baja registrada',
    detail: b.necropcia ?? null,
    notes: null,
    authors: { main: null, secondary: null },
    raw: b,
  };
}
