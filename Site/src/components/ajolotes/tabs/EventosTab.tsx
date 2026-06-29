import { useEffect, useMemo, useState } from 'preact/hooks';
import type {
  HistorialEntry,
  TerapeuticaEntry,
  BitacoraEntry,
  Baja,
  Locale,
} from '../types';
import { s } from '../strings';
import {
  buildAliasTimeline,
  filterBitacoraByAlias,
  type TimelineEvent,
  type TimelineSource,
  type TimelineTone,
} from '../../../lib/timeline';

interface Props {
  alias: string;
  historial: HistorialEntry[];
  terapeutica: TerapeuticaEntry[];
  bitacora: BitacoraEntry[];        // pre-loaded array; filtered to alias here
  baja: Baja | null;
  accent: string;
  locale: Locale;
}

const TONE_COLOR: Record<TimelineTone, string> = {
  ok:    '#10B981',
  warn:  '#FBBF24',
  alarm: '#F43F5E',
  muted: 'rgba(128,128,128,0.55)',
};

// Background tint + ink color for the state pill. Mirrors TONE_COLOR with a
// 14% alpha background so the pill reads against any modal surface.
const STATE_PILL_BG: Record<TimelineTone, string> = {
  ok:    'rgba(16,185,129,0.14)',
  warn:  'rgba(251,191,36,0.18)',
  alarm: 'rgba(244,63,94,0.16)',
  muted: 'rgba(128,128,128,0.18)',
};
// Warn ink uses a yellow-leaning amber (#EAB308 ≈ yellow-500) instead of the
// previous orange-toned #B45309 so curators read it as clearly yellow, paired
// with the bright #FBBF24 dot.
const STATE_PILL_INK: Record<TimelineTone, string> = {
  ok:    '#10B981',
  warn:  '#EAB308',
  alarm: '#F43F5E',
  muted: 'var(--wq-ink-muted)',
};

function shouldPulse(tone: TimelineTone): boolean {
  return tone === 'warn' || tone === 'alarm';
}

const SOURCES: TimelineSource[] = ['historial', 'terapeutica', 'bitacora', 'baja'];
const TONES: Array<'ok' | 'warn' | 'alarm'> = ['ok', 'warn', 'alarm'];
const FILTER_KEY = 'axolodao:eventos-filters';
const STATE_FILTER_KEY = 'axolodao:eventos-state-filters';

function loadFilters(): Record<TimelineSource, boolean> {
  const all = { historial: true, terapeutica: true, bitacora: true, baja: true } as const;
  if (typeof window === 'undefined') return { ...all };
  try {
    const raw = window.localStorage.getItem(FILTER_KEY);
    if (!raw) return { ...all };
    const parsed = JSON.parse(raw);
    return {
      historial:   parsed.historial   !== false,
      terapeutica: parsed.terapeutica !== false,
      bitacora:    parsed.bitacora    !== false,
      baja:        parsed.baja        !== false,
    };
  } catch {
    return { ...all };
  }
}

type ToneFilter = Record<'ok' | 'warn' | 'alarm', boolean>;
function loadToneFilters(): ToneFilter {
  const all: ToneFilter = { ok: true, warn: true, alarm: true };
  if (typeof window === 'undefined') return { ...all };
  try {
    const raw = window.localStorage.getItem(STATE_FILTER_KEY);
    if (!raw) return { ...all };
    const parsed = JSON.parse(raw);
    return {
      ok:    parsed.ok    !== false,
      warn:  parsed.warn  !== false,
      alarm: parsed.alarm !== false,
    };
  } catch {
    return { ...all };
  }
}

export default function EventosTab({
  alias,
  historial,
  terapeutica,
  bitacora,
  baja,
  accent,
  locale,
}: Props) {
  const [filters, setFilters] = useState<Record<TimelineSource, boolean>>(() => loadFilters());
  const [toneFilters, setToneFilters] = useState<ToneFilter>(() => loadToneFilters());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
    } catch {
      /* ignore quota errors */
    }
  }, [filters]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STATE_FILTER_KEY, JSON.stringify(toneFilters));
    } catch {
      /* ignore quota errors */
    }
  }, [toneFilters]);

  const bitacoraForAlias = useMemo(
    () => filterBitacoraByAlias(bitacora, alias),
    [bitacora, alias],
  );

  const allEvents = useMemo(
    () => buildAliasTimeline({
      alias,
      historial,
      terapeutica,
      bitacora: bitacoraForAlias,
      baja,
    }),
    [alias, historial, terapeutica, bitacoraForAlias, baja],
  );

  const sourceCounts = useMemo(() => {
    const counts: Record<TimelineSource, number> = { historial: 0, terapeutica: 0, bitacora: 0, baja: 0 };
    for (const e of allEvents) counts[e.source]++;
    return counts;
  }, [allEvents]);

  const toneCounts = useMemo(() => {
    const counts: Record<'ok' | 'warn' | 'alarm', number> = { ok: 0, warn: 0, alarm: 0 };
    for (const e of allEvents) {
      if (e.tone === 'ok' || e.tone === 'warn' || e.tone === 'alarm') counts[e.tone]++;
    }
    return counts;
  }, [allEvents]);

  const events = useMemo(
    () =>
      [...allEvents]
        .reverse()
        .filter((e) => filters[e.source])
        .filter((e) => e.tone === 'muted' || toneFilters[e.tone]),
    [allEvents, filters, toneFilters],
  );

  const availableSources = SOURCES.filter((src) => sourceCounts[src] > 0);
  const availableTones = TONES.filter((t) => toneCounts[t] > 0);

  if (!allEvents.length) {
    return (
      <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-10 text-center">
        <div class="mb-2 text-5xl leading-none opacity-30">○</div>
        <h3 class="m-0 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
          {s(locale, 'eventos.empty.title')}
        </h3>
        <p class="mt-1 text-sm text-[var(--wq-ink-muted)]">{s(locale, 'eventos.empty.sub')}</p>
      </section>
    );
  }

  const anyFilterOff = SOURCES.some((src) => !filters[src]);
  const anyToneOff = TONES.some((t) => !toneFilters[t]);

  return (
    <div>
      {(availableSources.length > 1 || availableTones.length > 1) && (
        <div class="mb-3 flex flex-col items-stretch gap-1.5 md:flex-row md:items-start md:justify-between md:gap-3">
          {availableSources.length > 1 && (
            <div class="flex flex-wrap items-center gap-1.5">
              {anyFilterOff && (
                <button
                  type="button"
                  onClick={() => setFilters({ historial: true, terapeutica: true, bitacora: true, baja: true })}
                  class="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-[11px] font-semibold transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
                  style={{ borderColor: accent, color: accent, backgroundColor: 'transparent' }}
                >
                  <span aria-hidden="true">+</span>
                  <span>{s(locale, 'eventos.filter.showAll')}</span>
                </button>
              )}
              {availableSources.map((src) => {
                const active = filters[src];
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, [src]: !prev[src] }))}
                    aria-pressed={active}
                    class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
                    style={active
                      ? { backgroundColor: `${accent}1F`, borderColor: `${accent}66`, color: accent }
                      : { backgroundColor: 'var(--wq-row-bg)', borderColor: 'var(--wq-divider)', color: 'var(--wq-ink-muted)' }
                    }
                  >
                    <span>{s(locale, `eventos.source.${src}`)}</span>
                    <span class="opacity-60 tabular-nums">{sourceCounts[src]}</span>
                  </button>
                );
              })}
            </div>
          )}
          {availableTones.length > 1 && (
            <div class="flex flex-wrap items-center gap-1.5 md:justify-end">
              {anyToneOff && (
                <button
                  type="button"
                  onClick={() => setToneFilters({ ok: true, warn: true, alarm: true })}
                  class="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-[11px] font-semibold transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
                  style={{ borderColor: accent, color: accent, backgroundColor: 'transparent' }}
                >
                  <span aria-hidden="true">+</span>
                  <span>{s(locale, 'eventos.filter.showAll')}</span>
                </button>
              )}
              {availableTones.map((tone) => {
                const active = toneFilters[tone];
                const dot = TONE_COLOR[tone];
                return (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setToneFilters((prev) => ({ ...prev, [tone]: !prev[tone] }))}
                    aria-pressed={active}
                    class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-[background-color,border-color,color,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
                    style={active
                      ? { backgroundColor: STATE_PILL_BG[tone], borderColor: dot, color: STATE_PILL_INK[tone] }
                      : { backgroundColor: 'var(--wq-row-bg)', borderColor: 'var(--wq-divider)', color: 'var(--wq-ink-muted)', opacity: 0.7 }
                    }
                  >
                    <span
                      class="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: active ? dot : 'currentColor' }}
                      aria-hidden="true"
                    />
                    <span>{s(locale, `eventos.state.${tone}`)}</span>
                    <span class="opacity-60 tabular-nums">{toneCounts[tone]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      <ol class="relative m-0 list-none p-0 pl-[22px]">
        <span
          class="absolute bottom-2 left-[5px] top-2 w-[1.5px] bg-[var(--wq-divider)]"
          aria-hidden="true"
        />
        {events.map((event) => (
          <EventRow key={event.id} event={event} accent={accent} locale={locale} />
        ))}
        {!events.length && (
          <li class="text-sm italic text-[var(--wq-ink-muted)]">
            {s(locale, 'eventos.empty.title')}
          </li>
        )}
      </ol>
    </div>
  );
}

interface RowProps {
  event: TimelineEvent;
  accent: string;
  locale: Locale;
}

const HISTORIAL_LABEL_KEYS: Array<[keyof HistorialEntry, string]> = [
  ['cabeza', 'medico.label.cabeza'],
  ['cuerpo', 'medico.label.cuerpo'],
  ['extremidades', 'medico.label.extremidades'],
  ['cola', 'medico.label.cola'],
  ['comportamiento', 'medico.label.comportamiento'],
  ['tipo', 'medico.label.tipo'],
  ['justificacion', 'medico.label.justificacion'],
];

function EventRow({ event, accent, locale }: RowProps) {
  const pulse = shouldPulse(event.tone);
  return (
    <li class="relative mb-3.5">
      <span
        class={`absolute left-[-22px] top-3.5 h-3 w-3 rounded-full border-[2px] ${pulse ? 'aj-state-pulse' : ''}`}
        style={{
          borderColor: accent,
          backgroundColor: TONE_COLOR[event.tone],
          boxShadow: '0 0 0 3px var(--wq-surface)',
        }}
        aria-hidden="true"
      />
      <div class="rounded-xl border border-[var(--wq-divider)] bg-[var(--wq-cell-bg)] p-3.5">
        <header class="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <span class="text-xs font-semibold text-[var(--wq-ink-muted)] tabular-nums">
              {event.date}
              {event.time ? ` · ${event.time}` : ''}
            </span>
            <span
              class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]"
              style={{
                borderColor: `${accent}40`,
                backgroundColor: `${accent}10`,
                color: accent,
              }}
            >
              {s(locale, `eventos.source.${event.source}`)}
            </span>
            {event.categoria && (
              <span
                class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-[0.01em]"
                style={{
                  color: accent,
                  backgroundColor: `${accent}1F`,
                  borderColor: `${accent}40`,
                }}
              >
                {event.categoria}
              </span>
            )}
            {event.subcategoria && event.subcategoria !== event.categoria && (
              <span class="inline-flex items-center gap-1 rounded-full border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wq-ink-muted)]">
                {event.subcategoria}
              </span>
            )}
          </div>
          {event.estado && (
            <span
              class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em] ${pulse ? 'aj-state-pulse' : ''}`}
              style={{
                backgroundColor: STATE_PILL_BG[event.tone],
                color: STATE_PILL_INK[event.tone],
              }}
            >
              <span
                class="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: TONE_COLOR[event.tone] }}
                aria-hidden="true"
              />
              {event.estado}
            </span>
          )}
        </header>
        <h4 class="m-0 mb-1.5 text-sm font-semibold leading-snug text-[var(--wq-ink)]">
          {event.title}
        </h4>
        {event.source === 'historial' ? (
          <HistorialDetail event={event} accent={accent} locale={locale} />
        ) : event.source === 'terapeutica' ? (
          <TerapeuticaDetail event={event} accent={accent} locale={locale} />
        ) : event.source === 'bitacora' ? (
          <BitacoraDetail event={event} accent={accent} locale={locale} />
        ) : (
          <BajaDetail event={event} accent={accent} locale={locale} />
        )}
        {(event.authors.main || event.authors.secondary) && (
          <footer class="mt-2.5 flex items-center gap-2 text-[11px] text-[var(--wq-ink-muted)]">
            {event.authors.main && (
              <span class="font-mono">{event.authors.main}</span>
            )}
            {event.authors.secondary && (
              <>
                <span class="opacity-50">·</span>
                <span class="font-mono">{event.authors.secondary}</span>
              </>
            )}
          </footer>
        )}
      </div>
    </li>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div class="grid items-start gap-2.5 text-sm md:grid-cols-[200px_1fr]">
      <span class="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
        {label}
      </span>
      <span class="text-[var(--wq-ink)]">{value}</span>
    </div>
  );
}

function NotesRow({ notes, locale }: { notes: string | null | undefined; locale: Locale }) {
  if (!notes) return null;
  return (
    <div class="mt-1.5 grid items-start gap-2.5 border-t border-dashed border-[var(--wq-divider)] pt-1.5 text-sm md:grid-cols-[200px_1fr]">
      <span class="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
        {s(locale, 'medico.label.notas')}
      </span>
      <span class="italic text-[var(--wq-ink)]">{notes}</span>
    </div>
  );
}

function HistorialDetail({ event, locale }: RowProps) {
  const h = event.raw as HistorialEntry;
  const chips: string[] = [];
  if (h.bcs != null && h.bcs !== '') chips.push(`BCS ${h.bcs}`);
  if (h.temp != null) chips.push(`${h.temp}°C`);
  return (
    <div class="grid gap-1.5">
      {chips.length > 0 && (
        <div class="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c}
              class="inline-flex items-center gap-1 rounded-full border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wq-ink-muted)]"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      {HISTORIAL_LABEL_KEYS.map(([key, lk]) => {
        const val = h[key];
        if (!val) return null;
        return <DetailRow key={key} label={s(locale, lk)} value={String(val)} />;
      })}
      <NotesRow notes={h.notas} locale={locale} />
    </div>
  );
}

function TerapeuticaDetail({ event, locale }: RowProps) {
  const t = event.raw as TerapeuticaEntry;
  const dosisVia = [t.dosis, t.via].filter(Boolean).join(' · ');
  return (
    <div class="grid gap-1.5">
      <DetailRow label={s(locale, 'eventos.label.diagnostico')} value={t.diagnostico} />
      <DetailRow label={s(locale, 'eventos.label.tratamiento')} value={t.tratamiento} />
      <DetailRow label={s(locale, 'eventos.label.dosis')} value={dosisVia || null} />
      <DetailRow label={s(locale, 'eventos.label.ubicacion')} value={t.ubicacion} />
      <NotesRow notes={t.observaciones} locale={locale} />
    </div>
  );
}

function BitacoraDetail({ event, locale }: RowProps) {
  const b = event.raw as BitacoraEntry;
  return (
    <div class="grid gap-1.5">
      <DetailRow label={s(locale, 'eventos.label.incidencia')} value={b.incidencia} />
      <DetailRow label={s(locale, 'eventos.label.accion')} value={b.accion} />
      <DetailRow label={s(locale, 'eventos.label.ubicacion')} value={b.ubicacion} />
      <NotesRow notes={b.notas} locale={locale} />
    </div>
  );
}

function BajaDetail({ event, locale }: RowProps) {
  const b = event.raw as Baja;
  const biometry = [
    b.peso != null ? `${b.peso} g` : null,
    b.longitud != null ? `${b.longitud} cm` : null,
    b.edad,
  ].filter(Boolean).join(' · ');
  return (
    <div class="grid gap-1.5">
      <DetailRow label={s(locale, 'bajas.causa')} value={b.causa} />
      <DetailRow label={s(locale, 'bajas.necro.done').replace(/:\s*$/, '')} value={b.necropcia} />
      {biometry && <DetailRow label="—" value={biometry} />}
    </div>
  );
}
