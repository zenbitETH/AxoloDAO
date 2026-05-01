import type { HistorialEntry, Locale } from '../types';
import { s } from '../strings';
import LineChart from '../charts/LineChart';

interface Props {
  hist: HistorialEntry[];
  accent: string;
  locale: Locale;
}

const fmt = (v: unknown, d = 1): string => {
  if (v == null || v === '') return '—';
  if (typeof v === 'number') return v.toFixed(d);
  return String(v);
};

export default function BiometriaTab({ hist, accent, locale }: Props) {
  const peso = hist.filter((h) => h.peso != null).map((h) => ({ date: h.fecha, value: +(h.peso as number) }));
  const lt = hist.filter((h) => h.lt != null).map((h) => ({ date: h.fecha, value: +(h.lt as number) }));
  const lhc = hist.filter((h) => h.lhc != null).map((h) => ({ date: h.fecha, value: +(h.lhc as number) }));

  const measurementCount = (n: number) =>
    `${n} ${n === 1 ? s(locale, 'biometria.measurement.one') : s(locale, 'biometria.measurement.many')}`;

  return (
    <div>
      <div class="mb-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4">
          <header class="mb-3 flex items-center justify-between gap-3">
            <h3 class="m-0 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
              {s(locale, 'biometria.peso.title')}
            </h3>
            <span class="text-xs font-medium text-[var(--wq-ink-muted)]">
              {measurementCount(peso.length)}
            </span>
          </header>
          <LineChart
            locale={locale}
            series={[{ name: s(locale, 'biometria.peso.title'), data: peso, color: accent }]}
            accent={accent}
            format={(v) => fmt(v, 0)}
            yLabel="g"
            height={200}
          />
        </section>
        <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4">
          <header class="mb-3 flex items-center justify-between gap-3">
            <h3 class="m-0 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
              {s(locale, 'biometria.lt.title')}
            </h3>
            <span class="text-xs font-medium text-[var(--wq-ink-muted)]">
              {measurementCount(Math.max(lt.length, lhc.length))}
            </span>
          </header>
          <LineChart
            locale={locale}
            series={[
              { name: s(locale, 'biometria.lt.serie'), data: lt, color: accent },
              { name: s(locale, 'biometria.lhc.serie'), data: lhc, color: '#E85D75' },
            ]}
            accent={accent}
            format={(v) => fmt(v, 1)}
            yLabel="cm"
            height={200}
          />
        </section>
      </div>

      <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4">
        <header class="mb-3">
          <h3 class="m-0 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
            {s(locale, 'biometria.detalladas')}
          </h3>
        </header>
        {hist.length === 0 ? (
          <p class="m-0 py-5 text-center text-sm text-[var(--wq-ink-muted)]">
            {s(locale, 'biometria.empty')}
          </p>
        ) : (
          <div class="overflow-x-auto rounded-xl border border-[var(--wq-divider)]">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {[
                    { k: 'biometria.col.fecha' },
                    { k: 'biometria.col.peso' },
                    { k: 'biometria.col.lt', tip: 'card.lt.tooltip' },
                    { k: 'biometria.col.lhc', tip: 'card.lhc.tooltip' },
                    { k: 'biometria.col.cabeza' },
                    { k: 'biometria.col.cuerpo' },
                    { k: 'biometria.col.branquias' },
                    { k: 'biometria.col.bcs', tip: 'card.bcs.tooltip' },
                    { k: 'biometria.col.autor' },
                  ].map(({ k, tip }) => (
                    <th
                      key={k}
                      title={tip ? s(locale, tip) : undefined}
                      class={`whitespace-nowrap border-b border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)] ${tip ? 'cursor-help underline decoration-dotted underline-offset-[3px]' : ''}`}
                    >
                      {s(locale, k)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...hist].reverse().map((h, i) => (
                  <tr key={i} class="hover:bg-[var(--wq-row-bg)]">
                    <td class="whitespace-nowrap border-b border-[var(--wq-divider)] px-2.5 py-2 font-mono tabular-nums text-[var(--wq-ink)]">
                      {h.fecha}
                    </td>
                    <td class="whitespace-nowrap border-b border-[var(--wq-divider)] px-2.5 py-2 tabular-nums text-[var(--wq-ink)]">{fmt(h.peso, 1)}</td>
                    <td class="whitespace-nowrap border-b border-[var(--wq-divider)] px-2.5 py-2 tabular-nums text-[var(--wq-ink)]">{fmt(h.lt, 1)}</td>
                    <td class="whitespace-nowrap border-b border-[var(--wq-divider)] px-2.5 py-2 tabular-nums text-[var(--wq-ink)]">{fmt(h.lhc, 1)}</td>
                    <td class="whitespace-nowrap border-b border-[var(--wq-divider)] px-2.5 py-2 tabular-nums text-[var(--wq-ink)]">
                      {fmt(h.largoCabeza, 1)}×{fmt(h.anchoCabeza, 1)}
                    </td>
                    <td class="whitespace-nowrap border-b border-[var(--wq-divider)] px-2.5 py-2 tabular-nums text-[var(--wq-ink)]">{fmt(h.anchoCuerpo, 1)}</td>
                    <td class="whitespace-nowrap border-b border-[var(--wq-divider)] px-2.5 py-2 tabular-nums text-[var(--wq-ink)]">
                      {fmt(h.branqIzq, 1)} / {fmt(h.branqDer, 1)}
                    </td>
                    <td class="whitespace-nowrap border-b border-[var(--wq-divider)] px-2.5 py-2 tabular-nums text-[var(--wq-ink)]">{fmt(h.bcs, 1)}</td>
                    <td class="whitespace-nowrap border-b border-[var(--wq-divider)] px-2.5 py-2 font-mono text-[11px] text-[var(--wq-ink-muted)]">
                      {(h.autor || '').replace('.axolodao.eth', '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
