import type { Ejemplar, Locale } from '../types';
import { type ParsedStatus } from '../theme';
import { genderTitle, s } from '../strings';
import StatusPip from '../StatusPip';
import InfoIcon from '../InfoIcon';
import BCSGauge from '../charts/BCSGauge';

interface Props {
  ej: Ejemplar;
  bcs: ParsedStatus;
  respAlim: ParsedStatus;
  conduc: ParsedStatus;
  accent: string;
  isLarva: boolean;
  locale: Locale;
}

const fmt = (v: unknown, d = 2): string => {
  if (v == null || v === '') return '—';
  if (typeof v === 'number') return v.toFixed(d);
  return String(v);
};

export default function ResumenTab({ ej, bcs, respAlim, conduc, accent, isLarva, locale }: Props) {
  return (
    <div class="grid grid-cols-1 gap-3.5 md:grid-cols-[1.1fr_1fr] md:[grid-template-areas:'id_estado'_'bio_bio'_'consumo_consumo']">
      {/* Identidad */}
      <section
        class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4 md:[grid-area:id]"
      >
        <h3 class="m-0 mb-3 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
          {s(locale, 'resumen.identidad')}
        </h3>
        <dl class="m-0 grid grid-cols-2 gap-x-4 gap-y-2">
          {[
            ['resumen.alias', ej.alias],
            ['resumen.id', ej.id || '—', true],
            ['resumen.pecera', ej.pecera || '—'],
            ['resumen.especie', ej.especie, false, true],
            ['resumen.genero', genderTitle(locale, ej.genero)],
            ['resumen.fenotipo', ej.fenotipo || '—'],
            ['resumen.edad', ej.edad || '—'],
            ['resumen.estadio', ej.estadio || '—'],
          ].map(([k, v, mono, italic]) => (
            <div key={k as string} class="flex min-w-0 flex-col gap-px">
              <dt class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
                {s(locale, k as string)}
              </dt>
              <dd
                class={`m-0 break-words text-sm font-medium text-[var(--wq-ink)] ${
                  mono ? 'font-mono text-[12px]' : ''
                } ${italic ? 'italic' : ''}`}
              >
                {String(v ?? '—')}
              </dd>
            </div>
          ))}
        </dl>
        {ej.marcas && (
          <>
            <h4 class="mb-1 mt-3.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
              {s(locale, 'resumen.marcas')}
            </h4>
            <p class="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--wq-ink)]">
              {ej.marcas}
            </p>
          </>
        )}
      </section>

      {/* Estado clínico */}
      <section
        class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4 md:[grid-area:estado]"
      >
        <h3 class="m-0 mb-3 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
          {s(locale, 'resumen.estado')}
        </h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
              {s(locale, 'resumen.bcs')}
            </span>
            <BCSGauge value={ej.bcs} accent={accent} noDataLabel={s(locale, 'resumen.estados.sinDatos')} />
          </div>
          <div class="flex flex-col gap-1.5">
            <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
              {s(locale, 'resumen.estadoBio')}
            </span>
            <StatusPip
              tone={bcs.tone}
              label={bcs.tone === 'muted' ? s(locale, 'resumen.estados.sinDatos') : bcs.label.toLowerCase()}
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
              {s(locale, 'resumen.respAlim')}
            </span>
            <StatusPip
              tone={respAlim.tone}
              label={
                respAlim.tone === 'muted'
                  ? s(locale, 'resumen.estados.sinDatos')
                  : respAlim.label.toLowerCase()
              }
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
              {s(locale, 'resumen.conducta')}
            </span>
            <StatusPip
              tone={conduc.tone}
              label={
                conduc.tone === 'muted'
                  ? s(locale, 'resumen.estados.sinAlertas')
                  : conduc.label.toLowerCase()
              }
            />
          </div>
        </div>
        {ej.anomalia && (
          <div class="mt-3 flex flex-wrap items-center gap-2 rounded-lg border-l-[3px] border-ocre bg-ocre/15 p-2.5 text-sm">
            <span class="text-[10px] font-bold uppercase tracking-[0.08em] text-ocre">
              {s(locale, 'resumen.anomalia')}
            </span>
            <span>{ej.anomalia}</span>
          </div>
        )}
      </section>

      {/* Biometría snapshot */}
      {!isLarva && (
        <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4 md:[grid-area:bio]">
          <h3 class="m-0 mb-3 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
            {s(locale, 'resumen.bio.title')}
          </h3>
          <div class="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {[
              { l: 'resumen.bio.peso',      v: fmt(ej.peso, 1),                 unit: 'g',  colored: true },
              { l: 'resumen.bio.lt',        v: fmt(ej.lt, 2),                   unit: 'cm', colored: true },
              { l: 'resumen.bio.lhc',       v: fmt(ej.lhc, 2),                  unit: 'cm', colored: true },
              { l: 'resumen.bio.icc',       v: fmt(ej.icc, 3),                  info: true, colored: true },
              { l: 'resumen.bio.cabeza',    v: fmt(ej.propCabezaCuerpo, 2) },
              { l: 'resumen.bio.cola',      v: fmt(ej.propColaCuerpo, 2) },
              { l: 'resumen.bio.asimetria', v: ej.asimetria || '—' },
              { l: 'resumen.bio.temp',      v: fmt(ej.temp, 1),                 unit: '°C' },
            ].map((b) => (
              <div key={b.l} class="flex min-w-0 flex-col gap-0.5 rounded-xl bg-[var(--wq-cell-bg)] p-2.5">
                <span class="inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
                  {s(locale, b.l)}
                  {b.info && <InfoIcon text={s(locale, 'card.icc.tooltip')} />}
                </span>
                <span
                  class="font-display text-[1.05rem] font-bold leading-tight tabular-nums"
                  style={b.colored ? { color: accent } : undefined}
                >
                  {b.v}
                  {b.unit && <small class="ml-0.5 text-[10px] font-normal opacity-65">{b.unit}</small>}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Último consumo */}
      {!isLarva && (
        <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4 md:[grid-area:consumo]">
          <h3 class="m-0 mb-3 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
            {s(locale, 'resumen.consumo.title')}
          </h3>
          <div class="flex flex-wrap items-center gap-4">
            <div
              class="font-display text-[2.5rem] font-bold leading-none tabular-nums"
              style={{ color: accent }}
            >
              {fmt(ej.ultimoConsumo, 2)}
              <small class="ml-1 text-base font-normal opacity-70">g</small>
            </div>
            <div class="flex flex-col gap-0.5 text-sm">
              <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
                {s(locale, 'resumen.consumo.tipo')}
              </span>
              <span>{ej.respuestaAlim || '—'}</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
