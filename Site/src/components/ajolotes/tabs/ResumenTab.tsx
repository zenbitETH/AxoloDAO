import { useState } from 'preact/hooks';
import type { Ejemplar, HistorialEntry, Locale } from '../types';
import { type ParsedStatus } from '../theme';
import { s } from '../strings';
import StatusPip from '../StatusPip';
import InfoIcon from '../InfoIcon';
import WaterSnapshot from '../WaterSnapshot';
import type { Measurement } from '../../waterQuality/types';

interface Props {
  ej: Ejemplar;
  hist: HistorialEntry[];
  bcs: ParsedStatus;
  respAlim: ParsedStatus;
  conduc: ParsedStatus;
  accent: string;
  isLarva: boolean;
  locale: Locale;
  water: Measurement[];
  waterPath: string;
}

const fmt = (v: unknown, d = 2): string => {
  if (v == null || v === '') return '—';
  if (typeof v === 'number') return v.toFixed(d);
  return String(v);
};

// Latest biometric date — pick the most recent historial entry that has at
// least one of the snapshot fields filled (peso or lt). Falls back to the
// most recent date overall when nothing else matches.
function latestBiometricDate(hist: HistorialEntry[]): string | null {
  if (!hist.length) return null;
  const sorted = [...hist].sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
  const withBio = sorted.find((h) => h.peso != null || h.lt != null);
  return (withBio?.fecha ?? sorted[0]?.fecha) ?? null;
}

// Friendly curator narrative: breve shown by default, extendida revealed via
// "leer más". Keyed per specimen at the call site so the toggle resets when the
// modal switches ejemplar.
function DescripcionBlock({
  descripcion,
  accent,
  locale,
}: {
  descripcion: { breve: string; extendida: string };
  accent: string;
  locale: Locale;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasExtendida = Boolean(
    descripcion.extendida && descripcion.extendida !== descripcion.breve,
  );
  return (
    <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4">
      <p class="m-0 text-sm leading-relaxed text-[var(--wq-ink)]">
        {expanded && hasExtendida ? descripcion.extendida : descripcion.breve}
      </p>
      {hasExtendida && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          class="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: accent }}
        >
          {expanded ? s(locale, 'resumen.leerMenos') : s(locale, 'resumen.leerMas')}
        </button>
      )}
    </section>
  );
}

export default function ResumenTab({
  ej,
  hist,
  respAlim,
  conduc,
  accent,
  isLarva,
  locale,
  water,
  waterPath,
}: Props) {
  const bioDate = latestBiometricDate(hist);

  return (
    <div class="flex flex-col gap-3.5">
      {/* Friendly curator description (curated copy, not from the workbook) */}
      {ej.descripcion && ej.descripcion.breve && (
        <DescripcionBlock
          key={ej.alias}
          descripcion={ej.descripcion}
          accent={accent}
          locale={locale}
        />
      )}

      {/* Estado clínico */}
      <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4">
        <h3 class="m-0 mb-3 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
          {s(locale, 'resumen.estado')}
        </h3>
        <div class={`grid gap-3 ${isLarva ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
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
          {!isLarva && (
            <div class="flex flex-col gap-1.5">
              <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
                {s(locale, 'resumen.consumo.title')}
              </span>
              <span
                class="font-display text-[1.05rem] font-bold leading-none tabular-nums"
                style={{ color: accent }}
              >
                {fmt(ej.ultimoConsumo, 2)}
                <small class="ml-0.5 text-[10px] font-normal opacity-65">g</small>
              </span>
            </div>
          )}
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

      {/* Biometría snapshot — placed above water quality so morphometry leads
          and the agua section reads as supporting environmental context. */}
      {!isLarva && (
        <section class="rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4">
          <header class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 class="m-0 font-display text-base font-bold tracking-tight text-[var(--wq-ink)]">
              {s(locale, 'resumen.bio.title')}
            </h3>
            {bioDate && (
              <span class="text-xs text-[var(--wq-ink-muted)]">
                {s(locale, 'resumen.bio.date')} {bioDate}
              </span>
            )}
          </header>
          <div class="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {[
              { l: 'resumen.bio.peso',      v: fmt(ej.peso, 1),                 unit: 'g',  colored: true },
              { l: 'resumen.bio.lt',        v: fmt(ej.lt, 2),                   unit: 'cm', colored: true, tip: 'card.lt.tooltip' },
              { l: 'resumen.bio.lhc',       v: fmt(ej.lhc, 2),                  unit: 'cm', colored: true, tip: 'card.lhc.tooltip' },
              { l: 'resumen.bio.icc',       v: fmt(ej.icc, 3),                  colored: true, tip: 'card.icc.tooltip' },
              { l: 'resumen.bio.cabeza',    v: fmt(ej.propCabezaCuerpo, 2) },
              { l: 'resumen.bio.cola',      v: fmt(ej.propColaCuerpo, 2) },
              { l: 'resumen.bio.asimetria', v: ej.asimetria || '—' },
            ].map((b) => (
              <div key={b.l} class="flex min-w-0 flex-col gap-0.5 rounded-xl bg-[var(--wq-cell-bg)] p-2.5">
                <span class="inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
                  {s(locale, b.l)}
                  {b.tip && <InfoIcon text={s(locale, b.tip)} />}
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

      {/* Calidad de agua — última muestra del acuario */}
      <WaterSnapshot
        pecera={ej.pecera}
        measurements={water}
        accent={accent}
        locale={locale}
        waterPath={waterPath}
      />
    </div>
  );
}
