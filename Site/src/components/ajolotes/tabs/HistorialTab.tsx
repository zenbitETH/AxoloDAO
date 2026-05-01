import type { HistorialEntry, Locale, StatusTone } from '../types';
import { s } from '../strings';

interface Props {
  hist: HistorialEntry[];
  accent: string;
  locale: Locale;
}

const dotForCat = (c: string | null | undefined): StatusTone => {
  const x = (c || '').toLowerCase();
  if (/aler|criti|grav/.test(x)) return 'alarm';
  if (/vigil|aten|moder/.test(x)) return 'warn';
  return 'ok';
};

const TONE_COLOR: Record<StatusTone, string> = {
  ok:    '#10B981',
  warn:  '#FBBF24',
  alarm: '#F43F5E',
  muted: 'rgba(128,128,128,0.55)',
};

export default function HistorialTab({ hist, accent, locale }: Props) {
  const events = hist.filter(
    (h) => h.cabeza || h.cuerpo || h.cola || h.extremidades || h.comportamiento || h.notas || h.categoria,
  );
  if (!events.length) {
    return (
      <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-10 text-center">
        <div class="mb-2 text-5xl leading-none opacity-30">○</div>
        <h3 class="m-0 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
          {s(locale, 'medico.empty.title')}
        </h3>
        <p class="mt-1 text-sm text-[var(--wq-ink-muted)]">{s(locale, 'medico.empty.sub')}</p>
      </section>
    );
  }
  const labelKeys: Array<[keyof HistorialEntry, string]> = [
    ['cabeza', 'medico.label.cabeza'],
    ['cuerpo', 'medico.label.cuerpo'],
    ['extremidades', 'medico.label.extremidades'],
    ['cola', 'medico.label.cola'],
    ['comportamiento', 'medico.label.comportamiento'],
    ['tipo', 'medico.label.tipo'],
    ['justificacion', 'medico.label.justificacion'],
  ];
  return (
    <ol class="relative m-0 list-none p-0 pl-[22px]">
      <span
        class="absolute bottom-2 left-[5px] top-2 w-[1.5px] bg-[var(--wq-divider)]"
        aria-hidden="true"
      />
      {[...events].reverse().map((h, i) => {
        const tone = dotForCat(h.categoria);
        return (
          <li key={i} class="relative mb-3.5">
            <span
              class="absolute left-[-22px] top-3.5 h-3 w-3 rounded-full border-[2px]"
              style={{
                borderColor: accent,
                backgroundColor: TONE_COLOR[tone],
                boxShadow: '0 0 0 3px var(--wq-surface)',
              }}
              aria-hidden="true"
            />
            <div class="rounded-xl border border-[var(--wq-divider)] bg-[var(--wq-cell-bg)] p-3.5">
              <header class="mb-2 flex flex-wrap items-center gap-2">
                <span class="text-xs font-semibold text-[var(--wq-ink-muted)] tabular-nums">
                  {h.fecha}
                </span>
                {h.categoria && (
                  <span
                    class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-[0.01em]"
                    style={{
                      color: accent,
                      backgroundColor: `${accent}1F`,
                      borderColor: `${accent}40`,
                    }}
                  >
                    {h.categoria}
                  </span>
                )}
                {h.subcategoria && (
                  <span class="inline-flex items-center gap-1 rounded-full border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wq-ink-muted)]">
                    {h.subcategoria}
                  </span>
                )}
                {h.bcs != null && h.bcs !== '' && (
                  <span class="inline-flex items-center gap-1 rounded-full border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wq-ink-muted)]">
                    BCS {h.bcs}
                  </span>
                )}
                {h.temp != null && (
                  <span class="inline-flex items-center gap-1 rounded-full border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wq-ink-muted)]">
                    {h.temp}°C
                  </span>
                )}
              </header>
              <div class="grid gap-1.5">
                {labelKeys.map(([key, lk]) => {
                  const val = h[key];
                  if (!val) return null;
                  return (
                    <div key={key} class="grid items-start gap-2.5 text-sm md:grid-cols-[200px_1fr]">
                      <span class="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
                        {s(locale, lk)}
                      </span>
                      <span class="text-[var(--wq-ink)]">{String(val)}</span>
                    </div>
                  );
                })}
                {h.notas && (
                  <div class="mt-1.5 grid items-start gap-2.5 border-t border-dashed border-[var(--wq-divider)] pt-1.5 text-sm md:grid-cols-[200px_1fr]">
                    <span class="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
                      {s(locale, 'medico.label.notas')}
                    </span>
                    <span class="italic text-[var(--wq-ink)]">{h.notas}</span>
                  </div>
                )}
              </div>
              <footer class="mt-2.5 flex items-center gap-2 text-[11px] text-[var(--wq-ink-muted)]">
                <span class="font-mono">{(h.autor || '').replace('.axolodao.eth', '')}</span>
                {h.autor2 && (
                  <>
                    <span class="opacity-50">·</span>
                    <span class="font-mono">{h.autor2.replace('.axolodao.eth', '')}</span>
                  </>
                )}
              </footer>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
