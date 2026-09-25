import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Locale } from '../types';
import { s } from '../strings';

// Forensic postmortem of one deceased specimen. Data is the public projection of the
// audit in the brain (tools/forense/project-public.mjs): no people are named, the lab
// reports are summarised (never reproduced) and the method is pre-registered.

type Lane = 1 | 2 | 3 | 4 | 5 | 'integrity';
interface PmEvent {
  date: string; time: string | null; lane: Lane; kind: string; label: string;
  source: string; grade: 'A' | 'B' | 'C'; text: string | null; critical?: boolean; chronic_only?: boolean;
}
interface PmPoint { date: string; time: string | null; label: string }
interface PmEpisode {
  window: { from: string; to: string; days: number }; grade: string; S0: PmPoint | null; P: PmPoint | null; C: PmPoint | null;
  latency_h: number | null; standard: { id: string; title: string; hours: number } | null;
  signals: number; unanswered: number; coverage: number; role: string | null; flags: string[]; recorded_after_death: number;
}
export interface PmSpecimen {
  alias: string; species: string | null;
  death: { date: string | null; workbook_date: string | null; date_source: string; conf: string; euthanasia: boolean; note: string | null; alive_record_after: string | null };
  cause: string | null; cause_source: string | null;
  necropsy: { performed: string | null; result?: string | null; lab_case?: string | null; status?: string };
  body: string; body_conservation: string | null;
  grade: string; grade_60: string | null; grade_note: string | null;
  primary: PmEpisode | null; sensitivity: PmEpisode | null; events: PmEvent[];
  group?: { date: string | null; cause: string; necropsy: string }[];   // grouped unnamed deaths
}
interface PmAire { specimen: string | null; episode: number; date: string; claim: string; contrast: string | null; speaker: string; confidence: string; verified_on_video: boolean; url: string | null }
export interface PmData {
  generated: string; brain_commit: string; preregistration: string; method_note: string; limits: string[];
  aggregate: { grades: Record<string, number>; n: number; median_latency_over_standard: number | null };
  especimenes: PmSpecimen[]; aire: PmAire[];
}

const fold = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

let cache: Promise<PmData> | null = null;
export function loadPostmortem(): Promise<PmData> {
  cache ??= fetch('/data/ajolotes/bajas-forense.json').then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });
  return cache;
}
export function findSpecimen(data: PmData, alias: string): PmSpecimen | null {
  const k = fold(alias);
  return data.especimenes.find((e) => fold(e.alias) === k) ?? null;
}

export const LANE_COLOR: Record<string, string> = {
  '1': '#0EA5E9', '2': '#F59E0B', '3': '#10B981', '4': '#8B5CF6', '5': '#8B6F47', integrity: '#F43F5E',
};
const LANES: Lane[] = [1, 2, 3, 4, 5, 'integrity'];
export const GRADE_STYLE: Record<string, { bg: string; ink: string }> = {
  oportuna: { bg: 'rgba(16,185,129,0.14)', ink: '#10B981' },
  'tardía': { bg: 'rgba(245,158,11,0.16)', ink: '#D97706' },
  ausente: { bg: 'rgba(244,63,94,0.16)', ink: '#F43F5E' },
  sin_registro_de_acciones: { bg: 'rgba(139,92,246,0.14)', ink: '#8B5CF6' },
  'sin_señal_registrada': { bg: 'rgba(128,128,128,0.16)', ink: 'var(--wq-ink-muted)' },
  indeterminada: { bg: 'rgba(128,128,128,0.16)', ink: 'var(--wq-ink-muted)' },
};

const dayNum = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 864e5);
const hoursOf = (d: string, t: string | null) => dayNum(d) * 24 + (t ? +t.slice(0, 2) + +t.slice(3, 5) / 60 : 12);
const fmtDay = (iso: string | null) => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '—');
const fmtFull = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');
const fmtH = (h: number | null) => (h == null ? '—' : h >= 48 ? `${h.toFixed(0)} h (${(h / 24).toFixed(1)} días)` : `${h.toFixed(1)} h`);

export function GradePill({ grade, locale, small = false }: { grade: string; locale: Locale; small?: boolean }) {
  const st = GRADE_STYLE[grade] ?? GRADE_STYLE.indeterminada;
  return (
    <span
      class={`inline-flex items-center gap-1.5 rounded-full font-semibold ${small ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'}`}
      style={{ background: st.bg, color: st.ink }}
    >
      <span class="inline-block h-1.5 w-1.5 rounded-full" style={{ background: st.ink }} aria-hidden="true" />
      {s(locale, `pm.grade.${grade}`)}
    </span>
  );
}

function Timeline({ sp, ep, locale }: { sp: PmSpecimen; ep: PmEpisode; locale: Locale }) {
  const W = 960, LEFT = 150, RIGHT = 16, TOP = 44, ROW = 34;
  const [hover, setHover] = useState<number | null>(null);
  const end = [sp.death.date, sp.necropsy.result, ep.window.to].filter(Boolean).sort().pop() as string;
  const from = ep.window.from;
  const span = Math.max(1, (dayNum(end) + 1 - dayNum(from)) * 24);
  const x = (d: string, t: string | null) => LEFT + ((hoursOf(d, t) - dayNum(from) * 24) / span) * (W - LEFT - RIGHT);
  const H = TOP + ROW * LANES.length + 26;
  const ticks = useMemo(() => {
    const out: string[] = [];
    for (let n = dayNum(from); n <= dayNum(end); n += 7) out.push(new Date(n * 864e5).toISOString().slice(0, 10));
    return out;
  }, [from, end]);
  const laneY = (l: Lane) => TOP + LANES.indexOf(l) * ROW + ROW / 2;
  const perDay = new Map<string, number>();
  const pts = sp.events.filter((e) => e.date >= from && e.date <= end).map((e) => {
    const k = `${e.lane}|${e.date}`;
    const n = perDay.get(k) ?? 0;
    perDay.set(k, n + 1);
    return { e, cx: x(e.date, e.time), cy: laneY(e.lane) + ((n % 3) - 1) * 7 };
  });
  const S0x = ep.S0 ? x(ep.S0.date, ep.S0.time) : null;
  const Px = ep.P ? x(ep.P.date, ep.P.time) : null;
  const Dx = sp.death.date ? x(sp.death.date, null) : null;
  const late = ep.standard && ep.latency_h != null && ep.latency_h > ep.standard.hours;

  const hp = hover != null ? pts[hover] : null;

  return (
    <div class="-mx-1 overflow-x-auto px-1">
      <div class="relative" style={{ minWidth: '720px' }} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s(locale, 'pm.timeline.aria')} style={{ width: '100%', display: 'block' }}>
        {LANES.map((l, i) => (
          <g key={String(l)}>
            <rect x={LEFT} y={TOP + i * ROW} width={W - LEFT - RIGHT} height={ROW} fill={i % 2 ? 'transparent' : 'var(--wq-row-bg)'} />
            <circle cx={12} cy={laneY(l)} r={4} fill={LANE_COLOR[String(l)]} />
            <text x={22} y={laneY(l) + 4} font-size="11.5" fill="var(--wq-ink)">{s(locale, `pm.lane.${l}`)}</text>
          </g>
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t, '00:00')} x2={x(t, '00:00')} y1={TOP} y2={TOP + ROW * LANES.length} stroke="var(--wq-divider)" stroke-dasharray="2 4" />
            <text x={x(t, '00:00')} y={H - 8} font-size="10" text-anchor="middle" fill="var(--wq-ink-muted)">{fmtDay(t)}</text>
          </g>
        ))}
        {S0x != null && Px != null && (
          <g>
            <line x1={S0x} x2={Px} y1={20} y2={20} stroke={late ? '#D97706' : '#10B981'} stroke-width="2" />
            <line x1={S0x} x2={S0x} y1={14} y2={26} stroke={late ? '#D97706' : '#10B981'} stroke-width="2" />
            <line x1={Px} x2={Px} y1={14} y2={26} stroke={late ? '#D97706' : '#10B981'} stroke-width="2" />
            <text x={(S0x + Px) / 2} y={11} font-size="11" font-weight="600" text-anchor="middle" fill={late ? '#D97706' : '#10B981'}>
              {`${fmtH(ep.latency_h)}${ep.standard ? ` · ${s(locale, 'pm.standard')} ${ep.standard.hours} h` : ''}`}
            </text>
          </g>
        )}
        {S0x != null && <line x1={S0x} x2={S0x} y1={TOP} y2={TOP + ROW * LANES.length} stroke="#F59E0B" stroke-width="1.5" stroke-dasharray="4 3" />}
        {Px != null && <line x1={Px} x2={Px} y1={TOP} y2={TOP + ROW * LANES.length} stroke="#10B981" stroke-width="1.5" stroke-dasharray="4 3" />}
        {Dx != null && (
          <g>
            <line x1={Dx} x2={Dx} y1={TOP - 6} y2={TOP + ROW * LANES.length} stroke="var(--wq-ink)" stroke-width="2" />
            <text x={Dx} y={TOP - 10} font-size="10.5" font-weight="700" text-anchor="middle" fill="var(--wq-ink)">
              {sp.death.euthanasia ? s(locale, 'pm.euthanasia') : s(locale, 'pm.death')}
            </text>
          </g>
        )}
        {pts.map(({ e, cx, cy }, i) => {
          const c = e.critical ? '#F43F5E' : LANE_COLOR[String(e.lane)];
          const on = hover === i;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={on ? 7 : e.grade === 'C' ? 3 : 4.5} fill={e.grade === 'A' || e.critical ? c : 'var(--wq-surface)'}
                stroke={c} stroke-width={on ? 2.4 : 1.6} opacity={e.chronic_only && !on ? 0.45 : 0.95} pointer-events="none" />
              {/* Larger invisible target so small points are easy to hover, tap or focus. */}
              <circle cx={cx} cy={cy} r={9} fill="transparent" tabIndex={0} role="button"
                aria-label={`${fmtFull(e.date)} · ${e.label}`}
                onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                onClick={() => setHover(on ? null : i)} style={{ cursor: 'pointer', outline: 'none' }} />
            </g>
          );
        })}
      </svg>
      {hp && (
        <div role="tooltip"
          class="pointer-events-none absolute z-10 w-[280px] rounded-xl border border-[var(--wq-divider)] bg-[var(--wq-surface)] p-3 text-xs shadow-[0_8px_24px_rgba(7,31,41,0.18)]"
          style={{
            left: `clamp(0px, calc(${(hp.cx / W) * 100}% - 140px), calc(100% - 280px))`,
            top: `${(hp.cy / H) * 100}%`,
            transform: hp.cy > H / 2 ? 'translateY(calc(-100% - 12px))' : 'translateY(12px)',
          }}>
          <div class="flex items-center gap-1.5">
            <span class="inline-block h-2 w-2 rounded-full" style={{ background: hp.e.critical ? '#F43F5E' : LANE_COLOR[String(hp.e.lane)] }} />
            <span class="font-semibold text-[var(--wq-ink)]">{hp.e.label}</span>
          </div>
          <div class="mt-1 font-mono text-[11px] text-[var(--wq-ink-muted)]">
            {fmtFull(hp.e.date)}{hp.e.time ? ` · ${hp.e.time}` : ''} · {s(locale, `pm.lane.${hp.e.lane}`)}
          </div>
          {hp.e.text && <p class="m-0 mt-1.5 leading-snug text-[var(--wq-ink)]">{hp.e.text}</p>}
          <div class="mt-2 flex flex-wrap gap-1">
            <span class="rounded-full border border-[var(--wq-divider)] px-1.5 text-[10px] text-[var(--wq-ink-muted)]">{s(locale, `pm.src.${hp.e.source}`)}</span>
            <span class="rounded-full border border-[var(--wq-divider)] px-1.5 text-[10px] text-[var(--wq-ink-muted)]">{s(locale, 'pm.grade')} {hp.e.grade} · {s(locale, `pm.gradeText.${hp.e.grade}`)}</span>
            {hp.e.critical && <span class="rounded-full border border-[#F43F5E]/50 px-1.5 text-[10px] text-[#F43F5E]">{s(locale, 'pm.critical')}</span>}
            {hp.e.chronic_only && <span class="rounded-full border border-[var(--wq-divider)] px-1.5 text-[10px] text-[var(--wq-ink-muted)]">{s(locale, 'pm.chronic')}</span>}
          </div>
        </div>
      )}
      </div>
      <p class="mt-1.5 text-[11px] leading-snug text-[var(--wq-ink-muted)]">{s(locale, 'pm.timeline.legend')}</p>
    </div>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: 'gap' | 'warn' }) {
  return (
    <div class="flex flex-col gap-0.5 rounded-lg bg-[var(--wq-row-bg)] p-2.5">
      <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">{label}</span>
      <span class={`text-sm leading-snug ${tone === 'gap' ? 'italic text-[#F43F5E]' : tone === 'warn' ? 'text-[#D97706]' : 'text-[var(--wq-ink)]'}`}>{value}</span>
    </div>
  );
}

export default function PostmortemTab({ alias, locale }: { alias: string; locale: Locale }) {
  const [data, setData] = useState<PmData | null>(null);
  const [error, setError] = useState(false);
  const [win, setWin] = useState<'primary' | 'sensitivity'>('sensitivity');
  const [lanes, setLanes] = useState<Set<string>>(new Set(LANES.map(String)));

  useEffect(() => {
    let live = true;
    loadPostmortem().then((d) => live && setData(d)).catch(() => live && setError(true));
    return () => { live = false; };
  }, []);

  if (error) return <p class="text-sm text-[var(--wq-ink-muted)]">{s(locale, 'pm.error')}</p>;
  if (!data) return <p class="text-sm text-[var(--wq-ink-muted)]">{s(locale, 'pm.loading')}</p>;
  const sp = findSpecimen(data, alias);
  if (!sp) return <p class="text-sm text-[var(--wq-ink-muted)]">{s(locale, 'pm.none')}</p>;
  const ep = sp[win] ?? sp.primary;
  const aire = data.aire.filter((a) => a.specimen && fold(a.specimen) === fold(alias));
  const shown = sp.events.filter((e) => lanes.has(String(e.lane)) && (!ep || e.date >= ep.window.from));

  const deathValue = `${fmtFull(sp.death.date)}${sp.death.euthanasia ? ` · ${s(locale, 'pm.euthanasia')}` : ''} · ${s(locale, `pm.src.${sp.death.date_source}`)}`;
  const necroValue = sp.necropsy.performed
    ? `${s(locale, 'pm.necro.done')} ${fmtFull(sp.necropsy.performed)} · ${s(locale, 'pm.necro.result')} ${fmtFull(sp.necropsy.result ?? null)}${sp.necropsy.lab_case ? ` · ${s(locale, 'pm.necro.case')} ${sp.necropsy.lab_case}` : ''}`
    : `${s(locale, 'pm.norecord')}${sp.necropsy.status && !/^(na|sin registro)$/i.test(sp.necropsy.status) ? ` (${s(locale, 'pm.necro.book')}: «${sp.necropsy.status}»)` : ''}`;

  return (
    <div class="flex flex-col gap-5">
      {/* Verdict */}
      <section class="flex flex-col gap-3 rounded-2xl border border-[var(--wq-divider)] p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">{s(locale, 'pm.response')}</span>
          <GradePill grade={sp.grade} locale={locale} />
          <span class="text-xs text-[var(--wq-ink-muted)]">{s(locale, 'pm.window21')}</span>
          {sp.grade_60 && <GradePill grade={sp.grade_60} locale={locale} small />}
          <span class="text-xs text-[var(--wq-ink-muted)]">{s(locale, 'pm.window60')}</span>
        </div>
        {ep && (
          <p class="m-0 text-sm leading-relaxed text-[var(--wq-ink)]">
            {ep.S0 ? (
              <>
                {s(locale, 'pm.firstSignal')} <strong>{fmtFull(ep.S0.date)}</strong> ({ep.S0.label.toLowerCase()}).{' '}
                {ep.P ? (
                  <>
                    {s(locale, 'pm.firstAction')} <strong>{fmtFull(ep.P.date)}</strong> ({ep.P.label.toLowerCase()}):{' '}
                    <strong>{fmtH(ep.latency_h)}</strong>
                    {ep.standard && <> {s(locale, 'pm.against')} {ep.standard.hours} h ({ep.standard.title.toLowerCase()})</>}.
                  </>
                ) : (
                  <>{s(locale, 'pm.noAction')}</>
                )}{' '}
                {s(locale, 'pm.unanswered')
                  .replace('{n}', String(ep.unanswered))
                  .replace('{m}', String(ep.signals))}
              </>
            ) : (
              s(locale, 'pm.noSignal')
            )}
          </p>
        )}
        {ep?.role && (
          <p class="m-0 text-xs text-[var(--wq-ink-muted)]">
            {s(locale, 'pm.role')}: <span class="font-semibold text-[var(--wq-ink)]">{ep.role}</span>
            {ep.flags.includes('dotación_mínima') && <> · {s(locale, 'pm.flag.staff')}</>}
            {ep.flags.includes('estándar_no_escrito_en_el_museo') && <> · {s(locale, 'pm.flag.unwritten')}</>}
          </p>
        )}
        {sp.grade_note && <p class="m-0 text-xs text-[#D97706]">{sp.grade_note}</p>}
      </section>

      {/* Death and after */}
      <section class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Fact label={s(locale, 'pm.fact.death')} value={deathValue} />
        {sp.death.workbook_date && (
          <Fact label={s(locale, 'pm.fact.bookDate')} value={`${fmtFull(sp.death.workbook_date)} · ${s(locale, 'pm.fact.conflict')}`} tone="warn" />
        )}
        {sp.death.alive_record_after && (
          <Fact label={s(locale, 'pm.fact.aliveAfter')} value={`${fmtFull(sp.death.alive_record_after)} · ${s(locale, 'pm.fact.aliveAfterNote')}`} tone="warn" />
        )}
        <Fact label={s(locale, 'pm.fact.cause')} value={`${sp.cause ?? s(locale, 'pm.norecord')}${sp.cause_source ? ` · ${s(locale, `pm.src.${sp.cause_source}`)}` : ''}`} tone={sp.cause ? undefined : 'gap'} />
        <Fact label={s(locale, 'pm.fact.necropsy')} value={necroValue} tone={sp.necropsy.performed ? undefined : 'gap'} />
        <Fact label={s(locale, 'pm.fact.body')} value={sp.body_conservation ? `${sp.body_conservation} · ${sp.body}` : sp.body} tone={/sin registro/.test(sp.body) ? 'gap' : undefined} />
      </section>

      {/* Grouped deaths (unnamed larvae): one row per sheet entry */}
      {sp.group && (
        <section class="flex flex-col gap-2">
          <h3 class="m-0 font-display text-base font-bold text-[var(--wq-ink)]">{s(locale, 'pm.group')}</h3>
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="text-left text-[10px] uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
                <th class="py-1.5 pr-3 font-semibold">#</th>
                <th class="py-1.5 pr-3 font-semibold">{s(locale, 'pm.fact.death')}</th>
                <th class="py-1.5 pr-3 font-semibold">{s(locale, 'pm.fact.cause')}</th>
                <th class="py-1.5 font-semibold">{s(locale, 'pm.fact.necropsy')}</th>
              </tr>
            </thead>
            <tbody>
              {sp.group.map((g, i) => (
                <tr key={i} class="border-t border-dashed border-[var(--wq-divider)]">
                  <td class="py-1.5 pr-3 font-mono text-xs text-[var(--wq-ink-muted)]">{i + 1}</td>
                  <td class={`py-1.5 pr-3 font-mono text-xs ${g.date ? 'text-[var(--wq-ink)]' : 'italic text-[#F43F5E]'}`}>{g.date ? fmtFull(g.date) : s(locale, 'pm.nodate')}</td>
                  <td class="py-1.5 pr-3 text-[var(--wq-ink)]">{g.cause}</td>
                  <td class="py-1.5 italic text-[#F43F5E]">{/^(na|sin registro)$/i.test(g.necropsy) ? s(locale, 'pm.norecord') : g.necropsy}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sp.death.note && <p class="m-0 text-xs text-[var(--wq-ink-muted)]">{sp.death.note}</p>}
        </section>
      )}

      {/* Timeline */}
      {ep && (
        <section class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="m-0 font-display text-base font-bold text-[var(--wq-ink)]">{s(locale, 'pm.timeline')}</h3>
            <div class="inline-flex rounded-full border border-[var(--wq-divider)] p-0.5 text-xs">
              {(['primary', 'sensitivity'] as const).map((w) => (
                <button key={w} type="button" onClick={() => setWin(w)}
                  class={`rounded-full px-3 py-1 font-semibold transition-colors ${win === w ? 'bg-[var(--wq-ink)] text-[var(--wq-surface)]' : 'text-[var(--wq-ink-muted)]'}`}>
                  {s(locale, w === 'primary' ? 'pm.win.21' : 'pm.win.60')}
                </button>
              ))}
            </div>
          </div>
          <Timeline sp={sp} ep={ep} locale={locale} />
        </section>
      )}

      {/* Said on air */}
      {aire.length > 0 && (
        <section class="flex flex-col gap-2">
          <h3 class="m-0 font-display text-base font-bold text-[var(--wq-ink)]">{s(locale, 'pm.aire')}</h3>
          <ul class="m-0 flex list-none flex-col gap-2 p-0">
            {aire.map((a, i) => (
              <li key={i} class="rounded-xl border border-[var(--wq-divider)] p-3">
                <div class="flex flex-wrap items-center gap-2 text-xs text-[var(--wq-ink-muted)]">
                  <span class="font-mono font-semibold text-[var(--wq-ink)]">{fmtFull(a.date)}</span>
                  <span>· {s(locale, 'pm.episode')} {a.episode}</span>
                  <span>· {a.speaker}{a.verified_on_video ? ` (${s(locale, 'pm.verified')})` : ''}</span>
                  {a.url && <a href={a.url} target="_blank" rel="noopener" class="ml-auto font-semibold text-teal underline-offset-2 hover:underline">{s(locale, 'pm.watch')} ↗</a>}
                </div>
                <p class="m-0 mt-1.5 text-sm text-[var(--wq-ink)]">«{a.claim}»</p>
                {a.contrast && <p class="m-0 mt-1 text-xs leading-snug text-[#D97706]">{s(locale, 'pm.record')}: {a.contrast}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Events by lane */}
      <section class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-1.5">
          <h3 class="m-0 mr-2 font-display text-base font-bold text-[var(--wq-ink)]">{s(locale, 'pm.events')}</h3>
          {LANES.map((l) => {
            const on = lanes.has(String(l));
            return (
              <button key={String(l)} type="button" aria-pressed={on}
                onClick={() => setLanes((cur) => { const n = new Set(cur); on ? n.delete(String(l)) : n.add(String(l)); return n; })}
                class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-opacity ${on ? '' : 'opacity-40'}`}
                style={{ borderColor: LANE_COLOR[String(l)], color: LANE_COLOR[String(l)] }}>
                <span class="inline-block h-1.5 w-1.5 rounded-full" style={{ background: LANE_COLOR[String(l)] }} />
                {s(locale, `pm.lane.${l}`)}
              </button>
            );
          })}
        </div>
        <ol class="m-0 flex list-none flex-col p-0">
          {shown.map((e, i) => (
            <li key={i} class="grid gap-x-3 border-b border-dashed border-[var(--wq-divider)] py-2 text-sm"
              style={{ gridTemplateColumns: '84px 1fr' }}>
              <span class="font-mono text-xs text-[var(--wq-ink-muted)]">{fmtFull(e.date)}{e.time ? <><br />{e.time}</> : null}</span>
              <span class="flex flex-col gap-0.5">
                <span class="flex flex-wrap items-center gap-1.5">
                  <span class="inline-block h-2 w-2 rounded-full" style={{ background: e.critical ? '#F43F5E' : LANE_COLOR[String(e.lane)] }} />
                  <span class="font-semibold text-[var(--wq-ink)]">{e.label}</span>
                  <span class="rounded-full border border-[var(--wq-divider)] px-1.5 text-[10px] text-[var(--wq-ink-muted)]">{s(locale, `pm.src.${e.source}`)}</span>
                  <span class="text-[10px] text-[var(--wq-ink-muted)]">{s(locale, 'pm.grade')} {e.grade}</span>
                </span>
                {e.text && <span class="text-[13px] leading-snug text-[var(--wq-ink-muted)]">{e.text}</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Method */}
      <details class="rounded-xl border border-[var(--wq-divider)] p-3 text-xs text-[var(--wq-ink-muted)]">
        <summary class="cursor-pointer font-semibold text-[var(--wq-ink)]">{s(locale, 'pm.method')}</summary>
        <p class="mb-2 mt-2">{data.method_note}</p>
        <ul class="m-0 flex list-disc flex-col gap-1 pl-4">
          {data.limits.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
        <p class="mb-0 mt-2 font-mono">{s(locale, 'pm.prereg')} {data.preregistration} · {s(locale, 'pm.generated')} {data.generated}</p>
      </details>
    </div>
  );
}
