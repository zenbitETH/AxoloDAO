import type { Locale } from '../types';
import { s } from '../strings';

// The curated reading of a postmortem: what happened and how long it took, the proof,
// what alerts would have changed, and only then the full forensic record (which the
// caller renders folded below). Everything here comes from `relato` in
// bajas-forense.json, written in the brain (forense/relatos/<alias>.json) and passed
// through the same embargo, person and lab guards as the rest of the projection.

type Tone = 'amber' | 'rose' | 'teal' | 'green' | 'muted' | 'ink';
type Stamp = [string, string?, string?];
export interface PmEvidence {
  date: string; time: string | null; source: 'telefono' | 'transmision'; text: string;
  media: string; poster: string; orient: 'vertical' | 'horizontal'; url: string | null;
  identifies: string; verifies: string; verified: string; sha256: string; attestation: string | null;
}
export interface PmRelato {
  lead: string;
  stats: { n: string; u: string; l: string; tone: Tone }[];
  stats_note?: string;
  curso: {
    from: string; to: string; lecturas: string[]; criticas: string[];
    sin_lectura: [string, string][]; bomba: [string, string][]; sin_camara: [string, string][];
    senales: Stamp[]; videos: Stamp[]; respuestas: Stamp[];
    latencia?: { from: [string, string]; to: [string, string]; label: string };
  };
  momentos: { d: string; d2?: string; t?: string; tone: Tone; title: string; text: string; src: string }[];
  simulacion?: { reglas: { d: string; text: string; real: string }[]; con: { n: string; l: string }; sin: { n: string; l: string } };
  publico?: { fecha: string; fuente: string; url: string; cita: string; registro: string };
  evidencia: PmEvidence[];
}

const TONE: Record<Tone, string> = {
  amber: '#E0A23A', rose: '#F2556F', teal: '#2EC4C0', green: '#34C08A', muted: '#8AA3A6', ink: 'var(--wq-ink)',
};
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dShort = (d: string) => `${d.slice(8, 10)} ${MES[+d.slice(5, 7) - 1]}`;
const dLong = (d: string) => `${+d.slice(8, 10)} ${MES[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
const hrs = (d: string, t?: string | null) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), +(t?.slice(0, 2) ?? 12), +(t?.slice(3, 5) ?? 0)) / 36e5;

/** **bold** in curated prose, and nothing else: no HTML ever comes from the data. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((p, i) => (i % 2 ? <strong key={i} class="text-[var(--wq-ink)]">{p}</strong> : p))}</>;
}

function Curso({ c, locale }: { c: PmRelato['curso']; locale: Locale }) {
  const L = 64, R = 392, W = R - L, TOP = 44, ROWS = { agua: 64, ella: 112, resp: 158 };
  const h0 = hrs(c.from, '00:00'), h1 = hrs(c.to, '23:59');
  const x = (d: string, t?: string | null) => L + ((hrs(d, t) - h0) / (h1 - h0)) * W;
  const ticks: string[] = [];
  for (let h = h0; h <= h1; h += 7 * 24) ticks.push(new Date(h * 36e5).toISOString().slice(0, 10));
  const band = (a: string, b: string) => ({ x: x(a, '00:00'), w: x(b, '23:59') - x(a, '00:00') });
  const lat = c.latencia;
  return (
    <div class="rounded-2xl bg-[var(--wq-row-bg)] px-2 pb-1.5 pt-2.5">
      <svg viewBox="0 0 400 192" role="img" aria-label={s(locale, 'pm.r.cursoAria')} style={{ width: '100%', display: 'block' }}>
        <defs>
          <pattern id="pm-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="#F2556F" stroke-width="2.2" opacity="0.55" />
          </pattern>
        </defs>
        {([['agua', 'pm.r.rowWater'], ['ella', 'pm.r.rowHer'], ['resp', 'pm.r.rowResp']] as const).map(([k, key]) => (
          <g key={k}>
            <rect x={L} y={ROWS[k] - 15} width={W} height={30} rx={6} fill="var(--wq-surface)" />
            <text x={4} y={ROWS[k] + 4} font-size="12" font-weight="700" fill="var(--wq-ink)">{s(locale, key)}</text>
          </g>
        ))}
        {ticks.map((t, i) => (
          <g key={t}>
            <line x1={x(t, '00:00')} x2={x(t, '00:00')} y1={TOP} y2={176} stroke="var(--wq-divider)" stroke-dasharray="2 3" />
            <text x={x(t, '00:00')} y={188} font-size="10" text-anchor={i === 0 ? 'start' : 'middle'} fill="var(--wq-ink-muted)">{i === 0 ? dShort(t) : +t.slice(8, 10)}</text>
          </g>
        ))}
        {c.sin_lectura.map(([a, b]) => { const r = band(a, b); return <rect key={a} x={r.x} y={ROWS.agua - 15} width={r.w} height={30} fill="url(#pm-hatch)" />; })}
        {c.bomba.map(([a, b]) => { const r = band(a, b); return (
          <g key={a}>
            <rect x={r.x} y={ROWS.agua - 15} width={r.w} height={4} rx={2} fill="#F2556F" opacity="0.85" />
            <text x={r.x + r.w / 2} y={ROWS.agua - 19} font-size="9" text-anchor="middle" fill="#F2556F">{s(locale, 'pm.r.pump')}</text>
          </g>); })}
        {c.sin_camara.map(([a, b]) => { const r = band(a, b); return (
          <g key={a}>
            <rect x={r.x} y={ROWS.ella + 13} width={r.w} height={3} rx={1.5} fill="var(--wq-ink-muted)" opacity="0.5" />
            <text x={r.x + r.w / 2} y={ROWS.ella + 27} font-size="9" text-anchor="middle" fill="var(--wq-ink-muted)">{s(locale, 'pm.r.noCamera')}</text>
          </g>); })}
        {c.lecturas.map((d) => <circle key={d} cx={x(d)} cy={ROWS.agua} r={2.6} fill="#6B8E96" />)}
        {c.criticas.map((d) => <circle key={d} cx={x(d)} cy={ROWS.agua} r={6} fill="#F2556F" stroke="var(--wq-surface)" stroke-width="1.5" />)}
        {c.senales.map(([d, t, k]) => <circle key={d + t} cx={x(d, t)} cy={ROWS.ella} r={k === 'fuerte' ? 6 : 4.5} fill="#E0A23A" opacity={k === 'fuerte' ? 1 : 0.85} stroke="var(--wq-surface)" stroke-width="1.5" />)}
        {c.videos.map(([d, t], i) => <rect key={d + t} x={x(d, t) - 4.5 + (i % 2 ? 3 : 0)} y={ROWS.ella - 4.5} width={9} height={9} rx={2} fill="#2EC4C0" stroke="var(--wq-surface)" stroke-width="1.2" />)}
        {c.respuestas.map(([d, t, k]) => k === 'no_ocurrio'
          ? <circle key={d + t} cx={x(d, t)} cy={ROWS.resp} r={5} fill="none" stroke="var(--wq-ink-muted)" stroke-width="1.8" />
          : <circle key={d + t} cx={x(d, t)} cy={ROWS.resp} r={5.5} fill="#34C08A" stroke="var(--wq-surface)" stroke-width="1.5" />)}
        <line x1={x(c.to, '09:00')} x2={x(c.to, '09:00')} y1={40} y2={176} stroke="var(--wq-ink)" stroke-width="2" />
        <text x={x(c.to, '09:00') - 3} y={36} font-size="10" font-weight="700" text-anchor="end" fill="var(--wq-ink)">{s(locale, 'pm.death')}</text>
        {lat && (() => { const a = x(...lat.from), b = x(...lat.to); return (
          <g>
            <line x1={a} x2={b} y1={20} y2={20} stroke="#E0A23A" stroke-width="2" />
            <line x1={a} x2={a} y1={15} y2={25} stroke="#E0A23A" stroke-width="2" />
            <line x1={b} x2={b} y1={15} y2={25} stroke="#E0A23A" stroke-width="2" />
            <text x={(a + b) / 2} y={13} font-size="11.5" font-weight="700" text-anchor="middle" fill="#E0A23A">{lat.label}</text>
            <line x1={a} x2={a} y1={25} y2={176} stroke="#E0A23A" stroke-width="1" stroke-dasharray="3 3" opacity="0.7" />
            <line x1={b} x2={b} y1={25} y2={176} stroke="#34C08A" stroke-width="1" stroke-dasharray="3 3" opacity="0.7" />
          </g>); })()}
      </svg>
      <div class="flex flex-wrap gap-x-3 gap-y-1 px-1 pt-1 text-[11px] text-[var(--wq-ink-muted)]">
        {([['#F2556F', 'pm.r.lgCritical'], ['#6B8E96', 'pm.r.lgReading'], ['hatch', 'pm.r.lgNoReading'], ['#E0A23A', 'pm.r.lgSignal'], ['#2EC4C0', 'pm.r.lgVideo'], ['#34C08A', 'pm.r.lgResponse']] as const).map(([c2, key]) => (
          <span key={key} class="inline-flex items-center gap-1.5">
            <i class="inline-block h-2.5 w-2.5 rounded-full" style={c2 === 'hatch'
              ? { borderRadius: '2px', border: '1px solid #F2556F88', background: 'repeating-linear-gradient(135deg,#F2556F55 0 3px,transparent 3px 6px)' }
              : { background: c2 }} />
            {s(locale, key)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Evidence({ e, locale, big }: { e: PmEvidence; locale: Locale; big?: boolean }) {
  return (
    <figure class="m-0 overflow-hidden rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)]">
      <video controls playsInline preload="none" poster={e.poster} src={e.media}
        class="block w-full bg-black" style={{ aspectRatio: e.orient === 'vertical' ? '9 / 12' : '16 / 9', objectFit: 'cover' }} />
      <figcaption class={`flex flex-col gap-2 ${big ? 'p-3' : 'p-2.5'}`}>
        <span class="font-mono text-[11.5px] text-[var(--wq-ink-muted)]">
          {dLong(e.date)}{e.time ? ` · ${e.time}` : ''} · {s(locale, e.source === 'telefono' ? 'pm.r.phone' : 'pm.r.stream')}
        </span>
        <span class={`${big ? 'text-sm' : 'text-[12.5px]'} leading-snug text-[var(--wq-ink)]`}>{e.text}.</span>
        {big && (
          <dl class="m-0 grid gap-x-2.5 gap-y-0.5 rounded-xl bg-[var(--wq-surface)] px-2.5 py-2 text-[11.5px] leading-snug" style={{ gridTemplateColumns: 'auto 1fr' }}>
            <dt class="text-[var(--wq-ink-muted)]">{s(locale, 'pm.r.identifies')}</dt><dd class="m-0 text-[var(--wq-ink)]">{e.identifies}</dd>
            <dt class="text-[var(--wq-ink-muted)]">{s(locale, 'pm.r.verifies')}</dt><dd class="m-0 text-[var(--wq-ink)]">{e.verifies} · {dShort(e.verified)}</dd>
            <dt class="text-[var(--wq-ink-muted)]">{s(locale, 'pm.r.attestation')}</dt><dd class="m-0 text-[#E0A23A]">{e.attestation ?? s(locale, 'pm.r.pending')}</dd>
            <dt class="text-[var(--wq-ink-muted)]">SHA-256</dt><dd class="m-0 break-all font-mono text-[10.5px] text-[var(--wq-ink-muted)]">{e.sha256}</dd>
          </dl>
        )}
        {e.url && <a href={e.url} target="_blank" rel="noopener" class="text-[12px] font-semibold text-teal underline-offset-2 hover:underline">{s(locale, 'pm.watch')} ↗</a>}
      </figcaption>
    </figure>
  );
}

export default function Relato({ r, locale }: { r: PmRelato; locale: Locale }) {
  const [main, ...rest] = [...r.evidencia].sort((a, b) => (a.source === 'telefono' ? -1 : b.source === 'telefono' ? 1 : 0));
  return (
    <div class="flex flex-col gap-5">
      <p class="m-0 text-[15px] leading-relaxed text-[var(--wq-ink)]"><Rich text={r.lead} /></p>

      <section class="flex flex-col gap-2">
        <div class="grid grid-cols-3 gap-2">
          {r.stats.map((st, i) => (
            <div key={i} class="rounded-2xl bg-[var(--wq-row-bg)] px-2.5 pb-2 pt-2.5">
              <div class="font-display text-[30px] font-extrabold leading-none" style={{ color: TONE[st.tone] }}>
                {st.n}{st.u && <span class="ml-0.5 text-[13px] font-bold">{st.u}</span>}
              </div>
              <div class="mt-1 text-[11.5px] leading-snug text-[var(--wq-ink-muted)]">{st.l}</div>
            </div>
          ))}
        </div>
        {r.stats_note && <p class="m-0 text-[11.5px] leading-snug text-[var(--wq-ink-muted)]">{r.stats_note}</p>}
      </section>

      <section class="flex flex-col gap-2">
        <h3 class="m-0 font-display text-base font-bold text-[var(--wq-ink)]">{s(locale, 'pm.r.curso')}</h3>
        <Curso c={r.curso} locale={locale} />
      </section>

      {main && (
        <section class="flex flex-col gap-2">
          <h3 class="m-0 font-display text-base font-bold text-[var(--wq-ink)]">
            {s(locale, 'pm.r.evidence')} <span class="font-sans text-xs font-medium text-[var(--wq-ink-muted)]">· {s(locale, 'pm.r.evidenceSub')}</span>
          </h3>
          <Evidence e={main} locale={locale} big />
          {rest.length > 0 && <div class="grid grid-cols-2 gap-2">{rest.map((e) => <Evidence key={e.media} e={e} locale={locale} />)}</div>}
        </section>
      )}

      <section class="flex flex-col gap-1">
        <h3 class="m-0 font-display text-base font-bold text-[var(--wq-ink)]">{s(locale, 'pm.r.moments')}</h3>
        <ol class="m-0 flex list-none flex-col p-0">
          {r.momentos.map((m, i) => (
            <li key={i} class="grid gap-x-3 border-b border-dashed border-[var(--wq-divider)] py-2.5" style={{ gridTemplateColumns: '62px 1fr' }}>
              <span class="font-mono text-xs leading-snug text-[var(--wq-ink-muted)]">
                {m.d2 ? `${+m.d.slice(8, 10)}–${dShort(m.d2)}` : dShort(m.d)}{m.t && <><br />{m.t}</>}
              </span>
              <span class="text-sm leading-snug text-[var(--wq-ink)]">
                <span class="flex items-center gap-1.5 font-semibold">
                  <span class="inline-block h-2 w-2 flex-none rounded-full" style={{ background: TONE[m.tone] }} />{m.title}
                </span>
                <span class="text-[var(--wq-ink-muted)]">{m.text}</span>
                <span class="ml-1 inline-block rounded-full border border-[var(--wq-divider)] px-1.5 text-[10px] text-[var(--wq-ink-muted)]">{m.src}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {r.simulacion && (
        <section class="flex flex-col gap-2 rounded-2xl border border-[#2EC4C0]/30 bg-[var(--wq-row-bg)] p-3">
          <span class="font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#2EC4C0]">{s(locale, 'pm.r.simBadge')}</span>
          <h3 class="m-0 font-display text-base font-bold text-[var(--wq-ink)]">{s(locale, 'pm.r.simTitle')}</h3>
          <ul class="m-0 flex list-none flex-col gap-2 p-0">
            {r.simulacion.reglas.map((g, i) => (
              <li key={i} class="grid gap-x-2.5 text-[13.5px] leading-snug" style={{ gridTemplateColumns: '54px 1fr' }}>
                <span class="font-mono text-xs font-semibold text-[#2EC4C0]">{dShort(g.d)}</span>
                <span class="text-[var(--wq-ink)]">{g.text}<span class="block text-xs text-[var(--wq-ink-muted)]">{s(locale, 'pm.r.real')}: {g.real}</span></span>
              </li>
            ))}
          </ul>
          <div class="grid grid-cols-2 gap-2">
            {[r.simulacion.con, r.simulacion.sin].map((k, i) => (
              <div key={i} class="rounded-xl bg-[var(--wq-surface)] px-2.5 py-2">
                <b class="block font-display text-[22px] leading-tight" style={{ color: i ? '#E0A23A' : '#34C08A' }}>{k.n}</b>
                <span class="text-[11.5px] text-[var(--wq-ink-muted)]">{k.l}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {r.publico && (
        <section class="flex flex-col gap-1.5 rounded-2xl border border-[var(--wq-divider)] p-3">
          <h3 class="m-0 font-display text-base font-bold text-[var(--wq-ink)]">{s(locale, 'pm.r.public')}</h3>
          <span class="text-xs text-[var(--wq-ink-muted)]">{r.publico.fuente} · {dLong(r.publico.fecha)} ·{' '}
            <a href={r.publico.url} target="_blank" rel="noopener" class="font-semibold text-teal underline-offset-2 hover:underline">{s(locale, 'pm.watch')} ↗</a></span>
          <blockquote class="m-0 border-l-[3px] border-[#E0A23A] pl-2.5 text-sm italic leading-snug text-[var(--wq-ink)]">«{r.publico.cita}»</blockquote>
          <p class="m-0 text-xs leading-snug text-[#E0A23A]">{s(locale, 'pm.record')}: {r.publico.registro}</p>
        </section>
      )}
    </div>
  );
}
