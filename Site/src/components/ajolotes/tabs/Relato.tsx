import { useEffect, useRef, useState } from 'preact/hooks';
import type { Locale } from '../types';
import { s } from '../strings';

// The curated reading of a postmortem: what happened and how long it took, the proof,
// what alerts would have changed, and only then the full forensic record (which the
// caller renders folded below). Everything here comes from `relato` in
// bajas-forense.json, written in the brain (forense/relatos/<alias>.json) and passed
// through the same embargo, person and lab guards as the rest of the projection.
//
// Everything that can be pointed at answers: timeline marks show what they are, a
// stat lights up the part of the timeline it counts, a key moment lights up its mark,
// and evidence previews on hover and opens full size on click.

type Tone = 'amber' | 'rose' | 'teal' | 'green' | 'muted' | 'ink';
type Stamp = [string, string?, string?, (string | string[])?];
export interface PmEvidence {
  date: string; time: string | null; source: 'telefono' | 'transmision'; text: string;
  media: string; poster: string; orient: 'vertical' | 'horizontal'; url: string | null;
  identifies: string; verifies: string; verified: string; sha256: string; attestation: string | null;
}
export interface PmPista { tone: Tone; key?: NonNullable<Hot>['key']; title: string; text: string; src: string }
export interface PmRelato {
  nombre?: string;
  /** A living specimen's follow-up (seguimiento.json): same shape, the chart ends at the record's cut. */
  vivo?: boolean; corte?: string; pistas?: PmPista[];
  lead: string;
  stats: { n: string; u: string; l: string; tone: Tone; key?: NonNullable<Hot>['key'] }[];
  stats_note?: string;
  curso: {
    from: string; to: string; lecturas: string[]; criticas: string[]; agua?: Record<string, string>;
    sin_lectura: [string, string][]; bomba: [string, string][]; sin_camara: [string, string][];
    senales: Stamp[]; videos: Stamp[]; respuestas: Stamp[];
    latencia?: { from: [string, string]; to: [string, string]; label: string };
  };
  momentos: { d: string; d2?: string; t?: string; tone: Tone; title: string; text: string; src: string }[];
  simulacion?: { reglas: { d: string; text: string; real: string }[]; con: { n: string; l: string }; sin: { n: string; l: string } };
  publico?: { fecha: string; fuente: string; url: string; cita: string; registro: string };
  evidencia: PmEvidence[];
  datos?: { peso: { d: string; g: number; lt: number | null }[]; alim: { d: string; g: number; ofrecido: number | null }[] };
}

const TONE: Record<Tone, string> = {
  amber: '#E0A23A', rose: '#F2556F', teal: '#2EC4C0', green: '#34C08A', muted: '#8AA3A6', ink: 'var(--wq-ink)',
};
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dShort = (d: string) => `${d.slice(8, 10)} ${MES[+d.slice(5, 7) - 1]}`;
const dLong = (d: string) => `${+d.slice(8, 10)} ${MES[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
const hrs = (d: string, t?: string | null) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), +(t?.slice(0, 2) ?? 12), +(t?.slice(3, 5) ?? 0)) / 36e5;
const inRange = (d: string, a: string, b?: string) => d >= a && d <= (b ?? a);

// Touch screens emulate mouseenter right before click. Hover handlers stand down for a
// moment after any touch, and every hover target also answers a tap (tap again to close).
let lastTouch = 0;
if (typeof window !== 'undefined') window.addEventListener('touchstart', () => { lastTouch = Date.now(); }, { capture: true, passive: true });
const touching = () => Date.now() - lastTouch < 1000;

/** What the pointer is on. A date lights up marks and moments; the other keys are stats. */
type Hot = { date?: string; to?: string; key?: 'lat' | 'gap' | 'vid' | 'peso' | 'alim' | 'senales' | 'agua' } | null;

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/** Insights the detail tabs hold, computed here so the postmortem shows them first. */
export function insights(r: PmRelato) {
  const peso = r.datos?.peso ?? [];
  const last = peso[peso.length - 1];
  const peak = peso.reduce<typeof last | undefined>((m, p) => (!m || p.g > m.g ? p : m), undefined);
  // The living get their weight pista from seguimiento.mjs (two weigh-ins below the 90-day
  // peak); a peak-to-last drop over all time would revive one-off entries.
  const drop = !r.vivo && last && peak && peak.d < last.d && last.g < peak.g
    ? { from: peak, to: last, pct: Math.round(((last.g - peak.g) / peak.g) * 100), g: +(peak.g - last.g).toFixed(1) } : null;
  const alim = (r.datos?.alim ?? []).filter((a) => a.d >= r.curso.from && a.d <= r.curso.to);
  let gap: { from: string; to: string; n: number } | null = null;
  for (let i = 1; i < alim.length; i++) { const n = days(alim[i - 1].d, alim[i].d); if (n >= 5 && (!gap || n > gap.n)) gap = { from: alim[i - 1].d, to: alim[i].d, n }; }
  return { drop, gap, alim, peso };
}

/**
 * Everything the main view draws, as rows for the full record, so the record below never
 * shows less than the view above it. Method events come from the projection; these add
 * the curated course, the videos and what the detail tabs hold (weigh-ins, meals).
 */
export function relatoEvents(r: PmRelato, locale: Locale) {
  type Row = { date: string; time: string | null; lane: 1 | 2 | 'datos' | 'integrity'; kind: string; label: string; source: string; grade: 'A' | 'B' | 'C'; text: string | null; critical?: boolean };
  const c = r.curso; const rows: Row[] = [];
  const moment = (d: string) => r.momentos.find((m) => inRange(d, m.d, m.d2));
  c.criticas.forEach((d) => rows.push({ date: d, time: null, lane: 1, kind: 'water_critical', label: s(locale, 'pm.r.ev.critical'), source: 'libro', grade: 'B', text: c.agua?.[d] ?? moment(d)?.title ?? null, critical: true }));
  c.bomba.forEach(([a, b]) => rows.push({ date: a, time: null, lane: 1, kind: 'pump', label: s(locale, 'pm.r.ev.pump'), source: 'podcast', grade: 'B', text: `${dShort(a)}–${dShort(b)} · ${moment(a)?.text ?? ''}`.trim() }));
  c.sin_lectura.forEach(([a, b]) => { for (let d = a; d <= b; d = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10))
    rows.push({ date: d, time: null, lane: 1, kind: 'gap_measurement', label: s(locale, 'pm.r.ev.noReadingLabel'), source: 'libro', grade: 'B', text: s(locale, 'pm.r.ev.noReading') }); });
  r.evidencia.forEach((e) => rows.push({ date: e.date, time: e.time, lane: 2, kind: 'signal_video', label: s(locale, 'pm.r.ev.video'), source: 'video', grade: 'A', text: e.text }));
  (r.datos?.peso ?? []).forEach((p, i, all) => rows.push({ date: p.d, time: null, lane: 'datos', kind: 'weigh_in', label: s(locale, 'pm.r.weighIn'), source: 'historial', grade: 'A',
    text: `${p.g} g${p.lt != null ? ` · LT ${p.lt} cm` : ''}${i && p.g !== all[i - 1].g ? ` · ${p.g - all[i - 1].g > 0 ? '+' : '−'}${Math.abs(+(p.g - all[i - 1].g).toFixed(1))} g` : ''}` }));
  (r.datos?.alim ?? []).forEach((a) => rows.push({ date: a.d, time: null, lane: 'datos', kind: 'meal', label: s(locale, 'pm.r.fed'), source: 'alimentacion', grade: 'A',
    text: `${+a.g.toFixed(2)} g${a.ofrecido != null ? ` ${s(locale, 'pm.r.of')} ${+a.ofrecido.toFixed(2)} g` : ''}` }));
  const gap = insights(r).gap;
  if (gap) rows.push({ date: gap.from, time: null, lane: 'datos', kind: 'gap_meal', label: s(locale, 'pm.r.noFood').replace('{n}', String(gap.n)), source: 'alimentacion', grade: 'A', text: `${dShort(gap.from)} – ${dShort(gap.to)}` });
  if (r.publico) rows.push({ date: r.publico.fecha, time: null, lane: 'integrity', kind: 'said_public', label: s(locale, 'pm.r.public'), source: 'podcast', grade: 'A', text: `«${r.publico.cita}»` });
  return rows;
}

/** **bold** in curated prose, and nothing else: no HTML ever comes from the data. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((p, i) => (i % 2 ? <strong key={i} class="text-[var(--wq-ink)]">{p}</strong> : p))}</>;
}

interface Mark { id: string; x: number; y: number; r: number; shape: 'dot' | 'ring' | 'sq' | 'dia'; fill: string; date: string; time?: string | null; title: string; sub?: string; lines?: string[]; note?: string; dim?: boolean }

function Curso({ r, name, hot, setHot, locale }: { r: PmRelato; name: string; hot: Hot; setHot: (h: Hot | ((c: Hot) => Hot)) => void; locale: Locale }) {
  const c = r.curso;
  // The SVG is drawn at the container's real width (1 unit = 1 CSS px), so labels keep
  // their size on a phone and on a desktop instead of scaling with the drawing.
  const box = useRef<HTMLDivElement>(null);
  const [VW, setVW] = useState(400);
  useEffect(() => {
    const el = box.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setVW(Math.max(320, Math.round(e.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const L = 86, R = VW - 8, W = R - L, TOP = 44, ROWS = { agua: 64, ella: 112, resp: 158 };
  const h0 = hrs(c.from, '00:00'), h1 = hrs(c.to, '23:59');
  const x = (d: string, t?: string | null) => L + ((hrs(d, t) - h0) / (h1 - h0)) * W;
  const [tip, setTip] = useState<Mark | null>(null);
  // The whole history can span a year: weekly ticks up to ten weeks, then the 1st of each month.
  const spanD = (h1 - h0) / 24, monthly = spanD > 70;
  const ticks: string[] = [];
  if (!monthly) for (let h = h0; h <= h1; h += 7 * 24) ticks.push(new Date(h * 36e5).toISOString().slice(0, 10));
  else for (let [y, m] = [+c.from.slice(0, 4), +c.from.slice(5, 7)]; `${y}-${String(m).padStart(2, '0')}-01` <= c.to; m === 12 ? (y++, m = 1) : m++) {
    const d = `${y}-${String(m).padStart(2, '0')}-01`; if (d >= c.from) ticks.push(d);
  }
  const tickLabel = (t: string, i: number) => (monthly ? `${MES[+t.slice(5, 7) - 1]}${i === 0 || t.slice(5, 7) === '01' ? ` ’${t.slice(2, 4)}` : ''}` : i === 0 ? dShort(t) : String(+t.slice(8, 10)));
  const band = (a: string, b: string) => ({ x: x(a, '00:00'), w: x(b, '23:59') - x(a, '00:00') });
  const momentOn = (d: string) => r.momentos.find((m) => inRange(d, m.d, m.d2));
  const marks: Mark[] = [
    ...c.lecturas.filter((d) => !c.criticas.includes(d)).map((d): Mark => ({ id: `l${d}`, x: x(d), y: ROWS.agua, r: 2.6, shape: 'dot', fill: '#6B8E96', date: d, title: s(locale, 'pm.r.tipReading'), sub: c.agua?.[d], note: momentOn(d)?.title })),
    ...c.criticas.map((d): Mark => ({ id: `c${d}`, x: x(d), y: ROWS.agua, r: 6, shape: 'dot', fill: '#F2556F', date: d, title: s(locale, 'pm.r.tipCritical'), sub: c.agua?.[d] ?? momentOn(d)?.text, note: momentOn(d)?.title })),
    ...c.senales.map(([d, t, k, why]): Mark => ({ id: `s${d}${t}`, x: x(d, t), y: ROWS.ella, r: k === 'fuerte' ? 6 : 4.5, shape: 'dot', fill: '#E0A23A', date: d, time: t, title: s(locale, 'pm.r.tipSignal'), sub: (typeof why === 'string' ? why : undefined) ?? momentOn(d)?.text, note: momentOn(d)?.title })),
    ...c.videos.map(([d, t], i): Mark => {
      const ev = r.evidencia.find((e) => e.date === d && (e.time ?? '').slice(0, 5) === t);
      return { id: `v${d}${t}`, x: x(d, t) + (i % 2 ? 3 : 0), y: ROWS.ella, r: 4.5, shape: 'sq', fill: '#2EC4C0', date: d, time: t, title: s(locale, 'pm.r.lgVideo'), sub: ev?.text };
    }),
    ...c.respuestas.map(([d, t, k, what]): Mark => ({ id: `r${d}${t}`, x: x(d, t), y: ROWS.resp, r: 5.5, shape: k === 'no_ocurrio' ? 'ring' : 'dot', fill: k === 'no_ocurrio' ? 'var(--wq-ink-muted)' : '#34C08A', date: d, time: t,
      title: s(locale, k === 'no_ocurrio' ? 'pm.r.tipNoResp' : 'pm.r.tipResponse'), lines: Array.isArray(what) ? what : what ? [what] : undefined, sub: what ? undefined : momentOn(d)?.text, note: momentOn(d)?.title })),
  ];
  const ins = insights(r);
  ins.peso.filter((p) => p.d >= c.from && p.d <= c.to).forEach((p) => {
    const prev = ins.peso.filter((q) => q.d < p.d).pop();
    marks.push({ id: `p${p.d}`, x: x(p.d, '12:00'), y: ROWS.ella, r: 5, shape: 'dia', fill: '#F2556F', date: p.d, title: `${s(locale, 'pm.r.weighIn')}: ${p.g} g`,
      sub: prev ? `${p.g - prev.g > 0 ? '+' : '−'}${Math.abs(+(p.g - prev.g).toFixed(1))} g ${s(locale, 'pm.r.since')} ${dShort(prev.d)}${ins.drop ? ` · −${Math.abs(ins.drop.pct)} % ${s(locale, 'pm.r.since')} ${dShort(ins.drop.from.d)}` : ''}` : undefined });
  });
  ins.alim.forEach((a) => marks.push({ id: `a${a.d}`, x: x(a.d, '12:00'), y: ROWS.ella - 11, r: 2.4, shape: 'dot', fill: '#B98DF0', date: a.d,
    title: `${s(locale, 'pm.r.fed')}: ${+a.g.toFixed(2)} g`, sub: a.ofrecido != null ? `${s(locale, 'pm.r.offered')} ${+a.ofrecido.toFixed(2)} g` : undefined }));
  // Months of marks on one row: dots shrink with the span so they stay legible (the hit
  // area stays 9 px).
  const k = spanD > 150 ? 0.6 : spanD > 70 ? 0.75 : 1;
  if (k < 1) marks.forEach((m) => { m.r = Math.max(1.6, m.r * k); });
  const lit = (m: Mark) => {
    if (hot?.date) return inRange(m.date, hot.date, hot.to);
    switch (hot?.key) {
      case 'vid': return m.shape === 'sq';
      case 'peso': return m.shape === 'dia';
      case 'alim': return m.id.startsWith('a');
      case 'senales': return m.id.startsWith('s') || m.id.startsWith('c');
      case 'agua': return m.id.startsWith('c') || m.id.startsWith('l');
      case 'lat': return !!c.latencia && ((m.id.startsWith('s') && m.date === c.latencia.from[0]) || (m.id.startsWith('r') && m.date === c.latencia.to[0]));
      default: return false;
    }
  };
  const lat = c.latencia;
  const show = (m: Mark | null) => { setTip(m); setHot(m ? { date: m.date } : null); };
  return (
    <div class="relative rounded-2xl bg-[var(--wq-row-bg)] px-2 pb-1.5 pt-2.5" onMouseLeave={() => { if (!touching()) show(null); }}>
      <div ref={box}>
      <svg viewBox={`0 0 ${VW} 192`} width={VW} height={192} role="img" aria-label={s(locale, 'pm.r.cursoAria')} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <pattern id="pm-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="#F2556F" stroke-width="2.2" opacity="0.55" />
          </pattern>
        </defs>
        {([['agua', s(locale, 'pm.r.rowWater')], ['ella', name], ['resp', s(locale, 'pm.r.rowResp')]] as const).map(([k, label]) => (
          <g key={k}>
            <rect x={L} y={ROWS[k] - 15} width={W} height={30} rx={6} fill="var(--wq-surface)" />
            <text x={4} y={ROWS[k] + 4} font-size="11.5" font-weight="700" fill="var(--wq-ink)">{label}</text>
          </g>
        ))}
        {ticks.map((t, i) => (
          <g key={t}>
            <line x1={x(t, '00:00')} x2={x(t, '00:00')} y1={TOP} y2={176} stroke="var(--wq-divider)" stroke-dasharray="2 3" />
            {(i === 0 || x(t, '00:00') - x(ticks[0], '00:00') >= 44) && (i === 0 || x(t, '00:00') - x(ticks[i - 1], '00:00') >= 26) && <text x={x(t, '00:00')} y={188} font-size="10" text-anchor={i === 0 ? 'start' : 'middle'} fill="var(--wq-ink-muted)">{tickLabel(t, i)}</text>}
          </g>
        ))}
        {c.sin_lectura.map(([a, b]) => { const g = band(a, b); const on = hot?.key === 'gap' || (hot?.date && inRange(hot.date, a, b));
          return <rect key={a} x={g.x} y={ROWS.agua - 15} width={g.w} height={30} fill="url(#pm-hatch)" stroke={on ? '#F2556F' : 'none'} stroke-width="1.5" rx={3}
            style={{ cursor: 'pointer' }} onMouseEnter={() => { if (touching()) return; setTip({ id: 'gap', x: g.x + g.w / 2, y: ROWS.agua, r: 0, shape: 'dot', fill: '#F2556F', date: a, title: s(locale, 'pm.r.lgNoReading'), sub: `${dShort(a)} – ${dShort(b)}` }); setHot({ date: a, to: b }); }} onClick={() => { setTip({ id: 'gap', x: g.x + g.w / 2, y: ROWS.agua, r: 0, shape: 'dot', fill: '#F2556F', date: a, title: s(locale, 'pm.r.lgNoReading'), sub: `${dShort(a)} – ${dShort(b)}` }); setHot({ date: a, to: b }); }} />; })}
        {c.bomba.map(([a, b]) => { const g = band(a, b); return (
          <g key={a} style={{ cursor: 'pointer' }} onMouseEnter={() => { if (touching()) return; setTip({ id: 'pump', x: g.x + g.w / 2, y: ROWS.agua - 15, r: 0, shape: 'dot', fill: '#F2556F', date: a, title: momentOn(a)?.title ?? s(locale, 'pm.r.pump'), sub: momentOn(a)?.text }); setHot({ date: a, to: b }); }} onClick={() => { setTip({ id: 'pump', x: g.x + g.w / 2, y: ROWS.agua - 15, r: 0, shape: 'dot', fill: '#F2556F', date: a, title: momentOn(a)?.title ?? s(locale, 'pm.r.pump'), sub: momentOn(a)?.text }); setHot({ date: a, to: b }); }}>
            <rect x={g.x} y={ROWS.agua - 22} width={g.w} height={11} fill="transparent" />
            <rect x={g.x} y={ROWS.agua - 15} width={g.w} height={4} rx={2} fill="#F2556F" opacity="0.85" />
            <text x={g.x + g.w / 2} y={ROWS.agua - 19} font-size="9" text-anchor="middle" fill="#F2556F">{s(locale, 'pm.r.pump')}</text>
          </g>); })}
        {c.sin_camara.map(([a, b]) => { const g = band(a, b); return (
          <g key={a}>
            <rect x={g.x} y={ROWS.ella + 13} width={g.w} height={3} rx={1.5} fill="var(--wq-ink-muted)" opacity="0.5" />
            <text x={g.x + g.w / 2} y={ROWS.ella + 27} font-size="9" text-anchor="middle" fill="var(--wq-ink-muted)">{s(locale, 'pm.r.noCamera')}</text>
          </g>); })}
        {ins.gap && (() => { const g = band(ins.gap.from, ins.gap.to); const on = hot?.key === 'alim' || (hot?.date && inRange(hot.date, ins.gap.from, ins.gap.to)); return (
          <g style={{ cursor: 'pointer' }} onMouseEnter={() => { if (touching()) return; setTip({ id: 'agap', x: g.x + g.w / 2, y: ROWS.ella - 11, r: 0, shape: 'dot', fill: '#B98DF0', date: ins.gap!.from, title: s(locale, 'pm.r.noFood').replace('{n}', String(ins.gap!.n)), sub: `${dShort(ins.gap!.from)} – ${dShort(ins.gap!.to)}` }); setHot({ date: ins.gap!.from, to: ins.gap!.to }); }} onClick={() => { setTip({ id: 'agap', x: g.x + g.w / 2, y: ROWS.ella - 11, r: 0, shape: 'dot', fill: '#B98DF0', date: ins.gap!.from, title: s(locale, 'pm.r.noFood').replace('{n}', String(ins.gap!.n)), sub: `${dShort(ins.gap!.from)} – ${dShort(ins.gap!.to)}` }); setHot({ date: ins.gap!.from, to: ins.gap!.to }); }}>
            <rect x={g.x} y={ROWS.ella - 14} width={g.w} height={6} fill="transparent" />
            <line x1={g.x} x2={g.x + g.w} y1={ROWS.ella - 11} y2={ROWS.ella - 11} stroke="#B98DF0" stroke-width={on ? 2.5 : 1.5} stroke-dasharray="3 3" />
          </g>); })()}
        {lat && (() => { const a = x(...lat.from), b = x(...lat.to); const on = hot?.key === 'lat'; return (
          <g opacity={hot && !on ? 0.55 : 1}>
            <line x1={a} x2={b} y1={20} y2={20} stroke="#E0A23A" stroke-width={on ? 3 : 2} />
            <line x1={a} x2={a} y1={15} y2={25} stroke="#E0A23A" stroke-width="2" />
            <line x1={b} x2={b} y1={15} y2={25} stroke="#E0A23A" stroke-width="2" />
            <text x={(a + b) / 2} y={12} font-size="11" font-weight="700" text-anchor="middle" fill="#E0A23A">{lat.label}</text>
            <line x1={a} x2={a} y1={25} y2={176} stroke="#E0A23A" stroke-width="1" stroke-dasharray="3 3" opacity="0.7" />
            <line x1={b} x2={b} y1={25} y2={176} stroke="#34C08A" stroke-width="1" stroke-dasharray="3 3" opacity="0.7" />
          </g>); })()}
        <line x1={x(c.to, '09:00')} x2={x(c.to, '09:00')} y1={40} y2={176} stroke="var(--wq-ink)" stroke-width="2" />
        <text x={x(c.to, '09:00') - 3} y={36} font-size="10" font-weight="700" text-anchor="end" fill="var(--wq-ink)">{s(locale, r.vivo ? 'seg.corte' : 'pm.death')}</text>
        {marks.map((m) => {
          const on = lit(m) || tip?.id === m.id; const rr = on ? m.r + 2 : m.r;
          const dim = !!hot?.key && !on;
          return (
            <g key={m.id} opacity={dim ? 0.22 : 1} style={{ transition: 'opacity 150ms' }}>
              {m.shape === 'dia'
                ? <rect x={m.x - rr * 0.8} y={m.y - rr * 0.8} width={rr * 1.6} height={rr * 1.6} fill={m.fill} stroke="var(--wq-surface)" stroke-width="1.2" transform={`rotate(45 ${m.x} ${m.y})`} />
                : m.shape === 'sq'
                ? <rect x={m.x - rr} y={m.y - rr} width={rr * 2} height={rr * 2} rx={2} fill={m.fill} stroke="var(--wq-surface)" stroke-width="1.2" />
                : m.shape === 'ring'
                  ? <circle cx={m.x} cy={m.y} r={rr} fill="none" stroke={m.fill} stroke-width="1.8" />
                  : <circle cx={m.x} cy={m.y} r={rr} fill={m.fill} stroke={m.r > 3 ? 'var(--wq-surface)' : 'none'} stroke-width="1.5" />}
              {on && <circle cx={m.x} cy={m.y} r={rr + 4} fill="none" stroke={m.fill} stroke-width="1" opacity="0.5" />}
              <circle cx={m.x} cy={m.y} r={9} fill="transparent" tabIndex={0} role="button" aria-label={`${dLong(m.date)} · ${m.title}`}
                style={{ cursor: 'pointer', outline: 'none' }} onMouseEnter={() => { if (!touching()) show(m); }} onFocus={() => { if (!touching()) show(m); }} onBlur={() => show(null)}
                onClick={() => show(tip?.id === m.id ? null : m)} />
            </g>
          );
        })}
      </svg>
      </div>
      {tip && (
        <div role="tooltip" class="pointer-events-none absolute z-10 w-[280px] rounded-xl border border-[var(--wq-divider)] bg-[var(--wq-surface)] p-2.5 text-xs shadow-[0_8px_24px_rgba(7,31,41,0.25)]"
          style={{ left: `clamp(4px, calc(${(tip.x / VW) * 100}% - 140px), calc(100% - 284px))`, top: `${(tip.y / 192) * 100}%`, transform: tip.y > 96 ? 'translateY(calc(-100% - 14px))' : 'translateY(14px)' }}>
          <div class="flex items-center gap-1.5 font-semibold text-[var(--wq-ink)]">
            <span class="inline-block h-2 w-2 rounded-full" style={{ background: tip.fill }} />{tip.title}
          </div>
          <div class="mt-0.5 font-mono text-[10.5px] text-[var(--wq-ink-muted)]">{dLong(tip.date)}{tip.time ? ` · ${tip.time}` : ''}</div>
          {tip.sub && <p class="m-0 mt-1 leading-snug text-[var(--wq-ink)]">{tip.sub}</p>}
          {tip.lines && <ul class="m-0 mt-1 list-disc space-y-0.5 pl-4 leading-snug text-[var(--wq-ink)]">{tip.lines.map((l) => <li key={l}>{l}</li>)}</ul>}
          {tip.note && <p class="m-0 mt-1.5 border-t border-[var(--wq-divider)] pt-1 text-[10.5px] leading-snug text-[var(--wq-ink-muted)]">{s(locale, 'pm.r.tipMoment')}: {tip.note}</p>}
        </div>
      )}
      <div class="flex flex-wrap gap-x-3 gap-y-1 px-1 pt-1 text-[11px] text-[var(--wq-ink-muted)]">
        {([['#F2556F', 'pm.r.lgCritical'], ['#6B8E96', 'pm.r.lgReading'], ['hatch', 'pm.r.lgNoReading'], ['#E0A23A', 'pm.r.lgSignal'], ['#2EC4C0', 'pm.r.lgVideo'], ['dia', 'pm.r.lgWeight'], ['#B98DF0', 'pm.r.lgFood'], ['#34C08A', 'pm.r.lgResponse']] as const).map(([c2, key]) => (
          <span key={key} class="inline-flex items-center gap-1.5">
            <i class="inline-block h-2.5 w-2.5 rounded-full" style={c2 === 'dia' ? { background: '#F2556F', borderRadius: '1px', transform: 'rotate(45deg) scale(0.8)' } : c2 === 'hatch'
              ? { borderRadius: '2px', border: '1px solid #F2556F88', background: 'repeating-linear-gradient(135deg,#F2556F55 0 3px,transparent 3px 6px)' }
              : { background: c2 }} />
            {s(locale, key)}
          </span>
        ))}
      </div>
    </div>
  );
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Same-size card: poster at rest, muted looping preview on hover, full view on click. */
function EvidenceCard({ e, locale, onOpen, lit }: { e: PmEvidence; locale: Locale; onOpen: () => void; lit: boolean }) {
  const [hover, setHover] = useState(false);
  const preview = hover && !reducedMotion();
  return (
    <button type="button" onClick={onOpen} onMouseEnter={() => { if (!touching()) setHover(true); }} onMouseLeave={() => setHover(false)}
      onFocus={() => { if (!touching()) setHover(true); }} onBlur={() => setHover(false)}
      aria-label={`${s(locale, 'pm.r.open')}: ${e.text}`}
      class={`group relative block w-full overflow-hidden rounded-xl border bg-black text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2EC4C0] ${lit ? 'border-[#2EC4C0]' : 'border-[var(--wq-divider)]'}`}
      style={{ aspectRatio: '4 / 5' }}>
      {preview
        ? <video src={e.media} muted autoPlay loop playsInline preload="auto" class="absolute inset-0 h-full w-full object-cover" />
        : <img src={e.poster} alt="" loading="lazy" class="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />}
      <span class="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-2 pb-2 pt-8">
        <span class="font-mono text-[10px] text-white/75">{dShort(e.date)}{e.time ? ` · ${e.time.slice(0, 5)}` : ''}</span>
        <span class="text-[11.5px] font-semibold leading-tight text-white">{s(locale, e.source === 'telefono' ? 'pm.r.phone' : 'pm.r.stream')}</span>
      </span>
      <span class={`pointer-events-none absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white transition-opacity ${preview ? 'opacity-0' : 'opacity-100'}`} aria-hidden="true">
        <svg width="11" height="12" viewBox="0 0 11 12"><path d="M1 1l9 5-9 5z" fill="currentColor" /></svg>
      </span>
    </button>
  );
}

function Lightbox({ list, index, setIndex, locale }: { list: PmEvidence[]; index: number; setIndex: (i: number | null) => void; locale: Locale }) {
  const e = list[index];
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (k: KeyboardEvent) => {
      if (k.key === 'Escape') { k.stopImmediatePropagation(); k.preventDefault(); setIndex(null); }
      if (k.key === 'ArrowRight') setIndex((index + 1) % list.length);
      if (k.key === 'ArrowLeft') setIndex((index - 1 + list.length) % list.length);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [index, list.length]);
  return (
    <div role="dialog" aria-modal="true" aria-label={e.text} class="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      onClick={(ev) => { if (ev.target === ev.currentTarget) setIndex(null); }}>
      <div class="flex max-h-full w-full max-w-4xl flex-col overflow-y-auto overscroll-contain rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-surface)] sm:flex-row sm:overflow-hidden">
        {/* On a phone the video keeps its place in one scrolling column and a vertical clip is
            capped at 42vh, so it can never paint over the text below it. */}
        <div class="flex flex-none items-center justify-center bg-black sm:min-h-0 sm:flex-1">
          <video key={e.media} src={e.media} poster={e.poster} controls autoPlay playsInline
            class={`block max-w-full object-contain ${e.orient === 'vertical' ? 'max-h-[42vh] w-auto sm:max-h-[82vh]' : 'max-h-[42vh] w-full sm:max-h-[82vh]'}`} />
        </div>
        <div class="flex w-full flex-none flex-col gap-2.5 p-4 sm:w-[300px] sm:flex-auto sm:overflow-y-auto">
          <div class="flex items-start justify-between gap-2">
            <span class="font-mono text-[11px] text-[var(--wq-ink-muted)]">{dLong(e.date)}{e.time ? ` · ${e.time}` : ''} · {s(locale, e.source === 'telefono' ? 'pm.r.phone' : 'pm.r.stream')}</span>
            <button ref={close} type="button" onClick={() => setIndex(null)} aria-label={s(locale, 'pm.r.close')}
              class="grid h-7 w-7 flex-none place-items-center rounded-full border border-[var(--wq-divider)] text-[var(--wq-ink)] transition-colors hover:bg-[var(--wq-row-bg)]">✕</button>
          </div>
          <p class="m-0 text-sm leading-snug text-[var(--wq-ink)]">{e.text}.</p>
          <dl class="m-0 grid gap-x-2.5 gap-y-1 rounded-xl bg-[var(--wq-row-bg)] px-2.5 py-2 text-[11.5px] leading-snug" style={{ gridTemplateColumns: 'auto 1fr' }}>
            <dt class="text-[var(--wq-ink-muted)]">{s(locale, 'pm.r.status')}</dt><dd class="m-0 text-[var(--wq-ink)]">{s(locale, 'pm.r.verified')} · {dShort(e.verified)}</dd>
            <dt class="text-[var(--wq-ink-muted)]">{s(locale, 'pm.r.attestation')}</dt><dd class="m-0 text-[#E0A23A]">{e.attestation ?? s(locale, 'pm.r.pending')}</dd>
            <dt class="text-[var(--wq-ink-muted)]">SHA-256</dt><dd class="m-0 break-all font-mono text-[10px] text-[var(--wq-ink-muted)]">{e.sha256}</dd>
          </dl>
          {e.url && <a href={e.url} target="_blank" rel="noopener" class="text-xs font-semibold text-teal underline-offset-2 hover:underline">{s(locale, 'pm.watch')} ↗</a>}
          {list.length > 1 && (
            <div class="mt-auto flex items-center justify-between pt-2 text-xs text-[var(--wq-ink-muted)]">
              <button type="button" onClick={() => setIndex((index - 1 + list.length) % list.length)} class="rounded-full border border-[var(--wq-divider)] px-3 py-1 hover:bg-[var(--wq-row-bg)]">‹ {s(locale, 'pm.r.prev')}</button>
              <span class="font-mono">{index + 1} / {list.length}</span>
              <button type="button" onClick={() => setIndex((index + 1) % list.length)} class="rounded-full border border-[var(--wq-divider)] px-3 py-1 hover:bg-[var(--wq-row-bg)]">{s(locale, 'pm.r.next')} ›</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const H3 = 'm-0 font-display text-base font-bold text-[var(--wq-ink)] sm:text-[15px]';

export default function Relato({ r, alias, locale }: { r: PmRelato; alias: string; locale: Locale }) {
  // Hover previews a selection; a click or a tap pins it until the same thing is chosen again.
  const [hov, setHot] = useState<Hot>(null);
  const [pin, setPin] = useState<Hot>(null);
  const hot = hov ?? pin;
  const curso = useRef<HTMLElement>(null);
  const pinHot = (h: NonNullable<Hot>, reveal = false) => {
    const same = JSON.stringify(pin) === JSON.stringify(h);
    setPin(same ? null : h);
    if (!same && reveal && curso.current) {
      const r0 = curso.current.getBoundingClientRect();
      if (r0.top < 60 || r0.bottom > window.innerHeight) curso.current.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
    }
  };
  const [open, setOpen] = useState<number | null>(null);
  const ev = [...r.evidencia].sort((a, b) => `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`));
  const statKey: ('lat' | 'gap' | 'vid')[] = ['lat', 'gap', 'vid'];
  const ins = insights(r);
  const stats: (PmRelato['stats'][number] & { key: NonNullable<Hot>['key'] })[] = r.stats.map((st, i) => ({ ...st, key: st.key ?? statKey[i] }));
  if (ins.drop) stats.splice(Math.min(1, stats.length), 0, { n: `−${Math.abs(ins.drop.pct)}`, u: '%', tone: 'rose', key: 'peso',
    l: s(locale, 'pm.r.weightStat').replace('{a}', String(ins.drop.from.g)).replace('{b}', String(ins.drop.to.g)).replace('{d}', dShort(ins.drop.to.d)) });
  return (
    <div class="flex flex-col gap-5">
      <p class="m-0 text-[15px] leading-relaxed text-[var(--wq-ink)] sm:text-sm"><Rich text={r.lead} /></p>

      {stats.length > 0 && <section class="flex flex-col gap-2">
        <div class={`grid gap-2 ${['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-2 sm:grid-cols-4'][stats.length] ?? 'grid-cols-2 sm:grid-cols-4'}`}>
          {stats.map((st, i) => (
            <div key={i} tabIndex={0} onMouseEnter={() => { if (!touching()) setHot({ key: st.key }); }} onMouseLeave={() => { if (!touching()) setHot(null); }} onClick={() => pinHot({ key: st.key }, true)}
              onFocus={() => { if (!touching()) setHot({ key: st.key }); }} onBlur={() => { if (!touching()) setHot(null); }}
              role="button" aria-pressed={pin?.key === st.key}
              class={`cursor-pointer rounded-2xl border bg-[var(--wq-row-bg)] px-2.5 pb-2 pt-2.5 outline-none transition duration-200 [@media(hover:hover)]:hover:-translate-y-0.5 focus-visible:border-[#2EC4C0] ${pin?.key === st.key ? 'border-current' : hot?.key === st.key ? 'border-[var(--wq-divider)]' : 'border-transparent'}`} style={{ color: TONE[st.tone] }}>
              <div class={`font-display font-extrabold leading-none ${/\d/.test(st.n) ? 'text-[28px] sm:text-[24px]' : 'text-[20px] sm:text-[18px]'}`} style={{ color: TONE[st.tone] }}>
                {st.n}{st.u && <span class="ml-0.5 text-[12px] font-bold">{st.u}</span>}
              </div>
              <div class="mt-1 text-[11.5px] leading-snug text-[var(--wq-ink-muted)] sm:text-[11px]">{st.l}</div>
            </div>
          ))}
        </div>
        {r.stats_note && <p class="m-0 text-[11px] leading-snug text-[var(--wq-ink-muted)]">{r.stats_note}</p>}
      </section>}

      {!!r.pistas?.length && (
        <section class="flex flex-col gap-2">
          <h3 class={H3}>{s(locale, 'seg.pistas')} <span class="font-sans text-xs font-medium text-[var(--wq-ink-muted)]">· {s(locale, 'seg.pistasSub')}</span></h3>
          <ul class="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
            {r.pistas.map((p, i) => (
              <li key={i} tabIndex={0} role="button" aria-pressed={!!p.key && pin?.key === p.key}
                onMouseEnter={() => { if (!touching() && p.key) setHot({ key: p.key }); }} onMouseLeave={() => { if (!touching()) setHot(null); }}
                onFocus={() => { if (!touching() && p.key) setHot({ key: p.key }); }} onBlur={() => { if (!touching()) setHot(null); }}
                onClick={() => p.key && pinHot({ key: p.key }, true)}
                class={`cursor-pointer rounded-xl border bg-[var(--wq-row-bg)] px-3 py-2 outline-none transition duration-200 [@media(hover:hover)]:hover:-translate-y-0.5 focus-visible:border-[#2EC4C0] ${p.key && pin?.key === p.key ? 'border-current' : p.key && hot?.key === p.key ? 'border-[var(--wq-divider)]' : 'border-transparent'}`}
                style={{ color: TONE[p.tone] }}>
                <div class="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--wq-ink)]">
                  <span class="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: TONE[p.tone] }} />{p.title}
                </div>
                <p class="m-0 mt-0.5 text-[12px] leading-snug text-[var(--wq-ink-muted)]">{p.text} <span class="ml-0.5 whitespace-nowrap rounded-full border border-[var(--wq-divider)] px-1.5 text-[10px]">{p.src}</span></p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section ref={curso} class="flex flex-col gap-2">
        <h3 class={H3}>{s(locale, 'pm.r.curso')}</h3>
        <Curso r={r} name={r.nombre ?? alias} hot={hot} setHot={setHot} locale={locale} />
      </section>

      {ev.length > 0 && (
        <section class="flex flex-col gap-2">
          <h3 class={H3}>
            {s(locale, 'pm.r.evidence')} <span class="font-sans text-xs font-medium text-[var(--wq-ink-muted)]">· {s(locale, 'pm.r.evidenceSub')}</span>
          </h3>
          <div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {ev.map((e, i) => <EvidenceCard key={e.media} e={e} locale={locale} onOpen={() => setOpen(i)}
              lit={hot?.key === 'vid' || (!!hot?.date && inRange(e.date, hot.date, hot.to))} />)}
          </div>
          <p class="m-0 text-[11px] text-[var(--wq-ink-muted)]">{s(locale, 'pm.r.evidenceHint')}</p>
          {open != null && <Lightbox list={ev} index={open} setIndex={setOpen} locale={locale} />}
        </section>
      )}

      <section class="flex flex-col gap-1">
        <h3 class={H3}>{s(locale, 'pm.r.moments')}</h3>
        <ol class="m-0 flex list-none flex-col p-0">
          {r.momentos.map((m, i) => {
            const on = !!hot?.date && (inRange(hot.date, m.d, m.d2) || (!!hot.to && inRange(m.d, hot.date, hot.to)));
            return (
              <li key={i} tabIndex={0} onMouseEnter={() => { if (!touching()) setHot({ date: m.d, to: m.d2 }); }} onMouseLeave={() => { if (!touching()) setHot(null); }} onClick={() => pinHot({ date: m.d, to: m.d2 })}
                onFocus={() => { if (!touching()) setHot({ date: m.d, to: m.d2 }); }} onBlur={() => { if (!touching()) setHot(null); }}
                class={`-mx-2 grid gap-x-3 rounded-lg border-b border-dashed border-[var(--wq-divider)] px-2 py-2 outline-none transition-colors hover:bg-[var(--wq-row-bg)] ${on ? 'bg-[var(--wq-row-bg)]' : ''}`}
                style={{ gridTemplateColumns: '58px 1fr' }}>
                <span class="font-mono text-[11px] leading-snug text-[var(--wq-ink-muted)]">
                  {m.d2 ? (m.d.slice(5, 7) === m.d2.slice(5, 7) ? `${+m.d.slice(8, 10)}–${dShort(m.d2)}` : `${dShort(m.d)} – ${dShort(m.d2)}`) : dShort(m.d)}{m.d.slice(0, 4) !== r.curso.to.slice(0, 4) && <> {m.d.slice(0, 4)}</>}{m.t && <><br />{m.t}</>}
                </span>
                <span class="text-sm leading-snug text-[var(--wq-ink)] sm:text-[13px]">
                  <span class="flex items-center gap-1.5 font-semibold">
                    <span class="inline-block h-2 w-2 flex-none rounded-full" style={{ background: TONE[m.tone] }} />{m.title}
                  </span>
                  <span class="text-[var(--wq-ink-muted)]">{m.text}</span>
                  <span class="ml-1 inline-block rounded-full border border-[var(--wq-divider)] px-1.5 text-[10px] text-[var(--wq-ink-muted)]">{m.src}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {r.simulacion && (
        <section class="flex flex-col gap-2 rounded-2xl border border-[#2EC4C0]/30 bg-[var(--wq-row-bg)] p-3">
          <span class="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[#2EC4C0]">{s(locale, 'pm.r.simBadge')}</span>
          <h3 class={H3}>{s(locale, 'pm.r.simTitle')}</h3>
          <ul class="m-0 flex list-none flex-col gap-1 p-0">
            {r.simulacion.reglas.map((g, i) => (
              <li key={i} tabIndex={0} onMouseEnter={() => { if (!touching()) setHot({ date: g.d }); }} onMouseLeave={() => { if (!touching()) setHot(null); }} onClick={() => pinHot({ date: g.d })} onFocus={() => { if (!touching()) setHot({ date: g.d }); }} onBlur={() => { if (!touching()) setHot(null); }}
                class="-mx-1.5 grid gap-x-2.5 rounded-lg px-1.5 py-1 text-[13px] leading-snug outline-none transition-colors hover:bg-[var(--wq-surface)]" style={{ gridTemplateColumns: '50px 1fr' }}>
                <span class="font-mono text-[11px] font-semibold text-[#2EC4C0]">{dShort(g.d)}</span>
                <span class="text-[var(--wq-ink)]">{g.text}<span class="block text-[11.5px] text-[var(--wq-ink-muted)]">{s(locale, 'pm.r.real')}: {g.real}</span></span>
              </li>
            ))}
          </ul>
          <div class="grid grid-cols-2 gap-2">
            {[r.simulacion.con, r.simulacion.sin].map((k, i) => (
              <div key={i} class="rounded-xl bg-[var(--wq-surface)] px-2.5 py-2">
                <b class="block font-display text-[20px] leading-tight" style={{ color: i ? '#E0A23A' : '#34C08A' }}>{k.n}</b>
                <span class="text-[11px] text-[var(--wq-ink-muted)]">{k.l}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {r.publico && (
        <section class="flex flex-col gap-1.5 rounded-2xl border border-[var(--wq-divider)] p-3 transition-colors hover:border-[#E0A23A]/50">
          <h3 class={H3}>{s(locale, 'pm.r.public')}</h3>
          <span class="text-xs text-[var(--wq-ink-muted)]">{r.publico.fuente} · {dLong(r.publico.fecha)} ·{' '}
            <a href={r.publico.url} target="_blank" rel="noopener" class="font-semibold text-teal underline-offset-2 hover:underline">{s(locale, 'pm.watch')} ↗</a></span>
          <blockquote class="m-0 border-l-[3px] border-[#E0A23A] pl-2.5 text-sm italic leading-snug text-[var(--wq-ink)] sm:text-[13px]">«{r.publico.cita}»</blockquote>
          <p class="m-0 text-xs leading-snug text-[#E0A23A]">{s(locale, 'pm.record')}: {r.publico.registro}</p>
        </section>
      )}
    </div>
  );
}
