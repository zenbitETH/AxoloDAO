import type { Locale, PlanAlimentacion, RegistroAlimentacion } from '../types';
import { DAY_ORDER, parseDays } from '../theme';
import { s } from '../strings';
import BarChart from '../charts/BarChart';

interface Props {
  alim: RegistroAlimentacion[];
  plan: PlanAlimentacion | null;
  accent: string;
  locale: Locale;
}

const dayLabel = (locale: Locale, key: typeof DAY_ORDER[number]) =>
  s(locale, `days.${key}`);

const interp = (template: string, params: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? '');

export default function AlimentacionTab({ alim, plan, accent, locale }: Props) {
  if (!alim.length && !plan) {
    return (
      <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-10 text-center">
        <h3 class="m-0 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
          {s(locale, 'alim.empty')}
        </h3>
      </section>
    );
  }

  const activeDays = plan ? parseDays(plan.frecuencia) : [];

  // Daily aggregation
  const byDate: Record<string, { ofrecida: number; consumo: number; sobrante: number; n: number }> = {};
  alim.forEach((a) => {
    if (!a.fecha) return;
    const key = a.fecha;
    byDate[key] = byDate[key] ?? { ofrecida: 0, consumo: 0, sobrante: 0, n: 0 };
    byDate[key].ofrecida += +(a.racion ?? 0) || 0;
    byDate[key].consumo += +(a.consumo ?? 0) || 0;
    byDate[key].sobrante += +(a.sobrante ?? 0) || 0;
    byDate[key].n += 1;
  });
  const dates = Object.keys(byDate).sort();
  const consumoData = dates.map((d) => ({ label: d, value: byDate[d].consumo, color: accent }));
  const totalRacion = alim.reduce((acc, b) => acc + (+(b.racion ?? 0) || 0), 0);
  const totalConsumo = alim.reduce((acc, b) => acc + (+(b.consumo ?? 0) || 0), 0);
  const accept = totalRacion > 0 ? (totalConsumo / totalRacion) * 100 : null;

  const tipos: Record<string, number> = {};
  alim.forEach((a) => {
    const t = a.tipo || a.respuesta || '—';
    tipos[t] = (tipos[t] ?? 0) + (+(a.consumo ?? 0) || 0);
  });
  const topTipos = Object.entries(tipos).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const dayWord = (n: number) => (n === 1 ? s(locale, 'alim.day.one') : s(locale, 'alim.day.many'));

  return (
    <div>
      {plan && (
        <>
          <h4
            class="m-0 mb-3 border-b-[1.5px] pb-1.5 font-display text-[0.95rem] font-bold uppercase tracking-[0.08em]"
            style={{ color: accent, borderBottomColor: `${accent}55` }}
          >
            {s(locale, 'alim.section.plan')}
          </h4>
          <div class="grid grid-cols-1 gap-3.5 md:grid-cols-[2fr_1fr]">
            <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4 md:col-span-2">
              <h3 class="m-0 mb-3 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
                {s(locale, 'alim.frecuencia')}
              </h3>
              <div class="mb-2 grid grid-cols-7 gap-1.5">
                {DAY_ORDER.map((d) => {
                  const on = activeDays.includes(d);
                  return (
                    <div
                      key={d}
                      class={`flex flex-col items-center gap-0.5 rounded-xl border-[1.5px] px-1.5 py-3 text-xs transition-all duration-200 ${
                        on ? 'font-bold' : 'text-[var(--wq-ink-muted)]'
                      }`}
                      style={
                        on
                          ? { backgroundColor: accent, color: '#F6EFE0', borderColor: accent, boxShadow: `0 4px 14px ${accent}55` }
                          : { backgroundColor: 'var(--wq-cell-bg)', borderColor: 'var(--wq-divider)' }
                      }
                    >
                      <span class="font-display text-[1.2rem] font-bold leading-none">
                        {dayLabel(locale, d)[0]}
                      </span>
                      <span class="text-[10px] uppercase tracking-[0.08em]">{dayLabel(locale, d)}</span>
                    </div>
                  );
                })}
              </div>
              {plan.frecuencia && (
                <p class="m-0 text-xs text-[var(--wq-ink-muted)]">{plan.frecuencia}</p>
              )}
            </section>
            <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4">
              <h3 class="m-0 mb-3 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
                {s(locale, 'alim.porcion')}
              </h3>
              <div
                class="font-display text-2xl font-bold leading-snug"
                style={{ color: accent }}
              >
                {plan.porcion || '—'}
              </div>
            </section>
            <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4">
              <h3 class="m-0 mb-3 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
                {s(locale, 'alim.dieta')}
              </h3>
              <p class="m-0 whitespace-pre-wrap text-sm leading-relaxed text-[var(--wq-ink)]">
                {plan.dietaBase || '—'}
              </p>
            </section>
            <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4">
              <h3 class="m-0 mb-3 flex items-baseline gap-2 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
                {s(locale, 'alim.planB')}
                <span class="font-body text-xs font-medium text-[var(--wq-ink-muted)]">
                  {s(locale, 'alim.planB.sub')}
                </span>
              </h3>
              <p class="m-0 whitespace-pre-wrap text-sm leading-relaxed text-[var(--wq-ink)]">
                {plan.planB || '—'}
              </p>
            </section>
            {plan.notas && (
              <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4 md:col-span-2">
                <h3 class="m-0 mb-3 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
                  {s(locale, 'alim.notas')}
                </h3>
                <p class="m-0 whitespace-pre-wrap text-sm leading-relaxed text-[var(--wq-ink)]">
                  {plan.notas}
                </p>
              </section>
            )}
          </div>
        </>
      )}

      {alim.length > 0 && (
        <>
          <h4
            class="m-0 mb-3 mt-5 border-b-[1.5px] pb-1.5 font-display text-[0.95rem] font-bold uppercase tracking-[0.08em]"
            style={{ color: accent, borderBottomColor: `${accent}55` }}
          >
            {s(locale, 'alim.section.records')}
          </h4>
          <div class="mb-3.5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div class="flex flex-col gap-1 rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4">
              <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
                {s(locale, 'alim.acceptance')}
              </span>
              <span
                class="font-display text-3xl font-bold leading-none tabular-nums"
                style={{ color: accent }}
              >
                {accept != null ? accept.toFixed(0) : '—'}
                <small class="ml-0.5 text-[0.9rem] font-normal opacity-70">%</small>
              </span>
              <span class="text-xs text-[var(--wq-ink-muted)]">
                {interp(s(locale, 'alim.acceptance.sub'), {
                  consumo: totalConsumo.toFixed(2),
                  ofrecido: totalRacion.toFixed(2),
                })}
              </span>
            </div>
            <div class="flex flex-col gap-1 rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4">
              <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
                {s(locale, 'alim.totals')}
              </span>
              <span
                class="font-display text-3xl font-bold leading-none tabular-nums"
                style={{ color: accent }}
              >
                {alim.length}
              </span>
              <span class="text-xs text-[var(--wq-ink-muted)]">
                {interp(s(locale, 'alim.totals.sub'), {
                  n: String(dates.length),
                  plural: dates.length === 1 ? '' : (locale === 'en' ? 's' : 's'),
                })}
              </span>
            </div>
            <div class="flex flex-col gap-1 rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4">
              <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
                {s(locale, 'alim.daily')}
              </span>
              <span
                class="font-display text-3xl font-bold leading-none tabular-nums"
                style={{ color: accent }}
              >
                {(totalConsumo / Math.max(1, dates.length)).toFixed(2)}
                <small class="ml-0.5 text-[0.9rem] font-normal opacity-70">g</small>
              </span>
              <span class="text-xs text-[var(--wq-ink-muted)]">{s(locale, 'alim.daily.sub')}</span>
            </div>
          </div>

          <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4">
            <header class="mb-3 flex items-center justify-between gap-3">
              <h3 class="m-0 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
                {s(locale, 'alim.consumo.title')}
              </h3>
              <span class="text-xs font-medium text-[var(--wq-ink-muted)]">
                {dates.length} {dayWord(dates.length)}
              </span>
            </header>
            <BarChart locale={locale} data={consumoData} accent={accent} format={(v) => v.toFixed(1)} height={180} />
          </section>

          <div class="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4">
              <header class="mb-3 flex items-center justify-between gap-3">
                <h3 class="m-0 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
                  {s(locale, 'alim.mezcla.title')}
                </h3>
                <span class="text-xs font-medium text-[var(--wq-ink-muted)]">
                  {s(locale, 'alim.mezcla.sub')}
                </span>
              </header>
              <ul class="m-0 flex list-none flex-col gap-2.5 p-0">
                {topTipos.map(([t, g], i) => {
                  const pct = totalConsumo > 0 ? (g / totalConsumo) * 100 : 0;
                  return (
                    <li
                      key={i}
                      class="grid items-center gap-2.5 text-sm md:grid-cols-[110px_1fr_60px]"
                    >
                      <span class="font-medium capitalize text-[var(--wq-ink)]">{t}</span>
                      <span class="block h-2 overflow-hidden rounded-full bg-[var(--wq-cell-bg)]">
                        <span
                          class="block h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: accent }}
                        />
                      </span>
                      <span class="text-right font-mono text-xs text-[var(--wq-ink-muted)]">
                        {g.toFixed(1)}g
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
            <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4">
              <header class="mb-3">
                <h3 class="m-0 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
                  {s(locale, 'alim.records.title')}
                </h3>
              </header>
              <div class="max-h-60 overflow-auto rounded-xl border border-[var(--wq-divider)]">
                <table class="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {[
                        'alim.col.fecha',
                        'alim.col.tipo',
                        'alim.col.ofrecida',
                        'alim.col.consumo',
                        'alim.col.sobrante',
                      ].map((k) => (
                        <th
                          key={k}
                          class="whitespace-nowrap border-b border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]"
                        >
                          {s(locale, k)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...alim].reverse().slice(0, 30).map((a, i) => (
                      <tr key={i} class="hover:bg-[var(--wq-row-bg)]">
                        <td class="whitespace-nowrap border-b border-[var(--wq-divider)] px-2.5 py-2 font-mono tabular-nums text-[var(--wq-ink)]">
                          {a.fecha}
                        </td>
                        <td class="whitespace-nowrap border-b border-[var(--wq-divider)] px-2.5 py-2 text-[var(--wq-ink)]">
                          {a.tipo || a.respuesta || '—'}
                        </td>
                        <td class="whitespace-nowrap border-b border-[var(--wq-divider)] px-2.5 py-2 tabular-nums text-[var(--wq-ink)]">
                          {a.racion != null ? (+a.racion).toFixed(2) : '—'}
                        </td>
                        <td
                          class="whitespace-nowrap border-b border-[var(--wq-divider)] px-2.5 py-2 tabular-nums"
                          style={{ color: accent, fontWeight: 600 }}
                        >
                          {a.consumo != null ? (+a.consumo).toFixed(2) : '—'}
                        </td>
                        <td class="whitespace-nowrap border-b border-[var(--wq-divider)] px-2.5 py-2 tabular-nums text-[var(--wq-ink)]">
                          {a.sobrante != null ? (+a.sobrante).toFixed(2) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
