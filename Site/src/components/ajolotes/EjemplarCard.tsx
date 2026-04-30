import type { Ejemplar, Locale } from './types';
import { genderSymbol, parseEmojiStatus, type ThemeMode, accent as accentFor } from './theme';
import { genderTitle, s } from './strings';
import AjoloteAvatar from './AjoloteAvatar';
import StatusPip from './StatusPip';
import InfoIcon from './InfoIcon';

interface Props {
  ej: Ejemplar;
  theme: ThemeMode;
  locale: Locale;
  onClick: (ej: Ejemplar) => void;
}

const GENDER_CLASS: Record<'♀' | '♂' | '(?)', string> = {
  '♀':   'text-[#D67BA8] dark:text-[#F4A6CB] text-[1.05em] font-semibold',
  '♂':   'text-[#4FA3D1] dark:text-[#7AC0E8] text-[1.05em] font-semibold',
  '(?)': 'text-[var(--wq-ink-muted)] text-[0.78em] tracking-tight font-medium ml-1',
};

const fmt = (v: number | null | undefined, d = 1): string =>
  v == null ? '—' : v.toFixed(d);

export default function EjemplarCard({ ej, theme, locale, onClick }: Props) {
  const ac = accentFor(ej.especie, theme);
  const bcs = parseEmojiStatus(ej.estadoBio);
  const isLarva = (ej.alias ?? '').toLowerCase().includes('ajolobebe');
  const sym = genderSymbol(ej.genero);
  const gTitle = genderTitle(locale, ej.genero);

  return (
    <button
      type="button"
      onClick={() => onClick(ej)}
      style={{ borderTopColor: ac, ['--accent' as string]: ac }}
      class="group flex flex-col gap-3 rounded-3xl border border-[var(--wq-divider)] border-t-[3px] bg-[var(--wq-cell-bg)] p-4 text-left text-[var(--wq-ink)] transition-all duration-200 hover:-translate-y-[1.5px] hover:border-[color:var(--accent)] hover:shadow-[0_10px_28px_rgba(0,0,0,0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
      aria-label={`${ej.alias}`}
    >
      <div class="flex items-start gap-3">
        <AjoloteAvatar alias={ej.alias} size={56} accent={ac} />
        <div class="min-w-0 flex-1">
          <h3 class="m-0 flex flex-wrap items-baseline gap-2 font-display text-[1.05rem] font-bold leading-tight tracking-tight text-[var(--wq-ink)]">
            <span class="min-w-0">{ej.alias}</span>
            <span class={GENDER_CLASS[sym]} title={gTitle} aria-label={gTitle}>
              {sym}
            </span>
          </h3>
          <p class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--wq-ink-muted)]">
            <span
              class="rounded-full px-2.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-[0.04em] shadow-sm"
              style={{ backgroundColor: ac, color: '#F6EFE0' }}
            >
              {ej.pecera || '—'}
            </span>
            {ej.id && (
              <span class="rounded border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-1.5 py-0.5 font-mono text-[12px] font-semibold text-[var(--wq-ink)]">
                {ej.id}
              </span>
            )}
            {ej.edad && <span class="opacity-50">·</span>}
            {ej.edad && <span>{ej.edad}</span>}
          </p>
          {ej.fenotipo && (
            <p class="mt-1.5 text-xs italic text-[var(--wq-ink-muted)]">{ej.fenotipo}</p>
          )}
        </div>
      </div>

      {!isLarva && (
        <div class="grid grid-cols-3 gap-0 rounded-xl bg-[var(--wq-row-bg)] py-2">
          <div class="flex flex-col items-center gap-px border-r border-[var(--wq-divider)] px-2">
            <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
              {s(locale, 'card.peso')}
            </span>
            <span class="font-display text-[1.05rem] font-bold leading-tight tabular-nums text-[var(--wq-ink)]">
              {ej.peso ?? '—'}
              <small class="ml-0.5 text-[10px] font-normal opacity-65">g</small>
            </span>
          </div>
          <div class="flex flex-col items-center gap-px border-r border-[var(--wq-divider)] px-2">
            <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
              {s(locale, 'card.lt')}
            </span>
            <span class="font-display text-[1.05rem] font-bold leading-tight tabular-nums text-[var(--wq-ink)]">
              {fmt(ej.lt, 1)}
              <small class="ml-0.5 text-[10px] font-normal opacity-65">cm</small>
            </span>
          </div>
          <div class="flex flex-col items-center gap-px px-2">
            <span class="inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
              {s(locale, 'card.icc')}
              <InfoIcon text={s(locale, 'card.icc.tooltip')} />
            </span>
            <span class="font-display text-[1.05rem] font-bold leading-tight tabular-nums text-[var(--wq-ink)]">
              {ej.icc != null ? ej.icc.toFixed(2) : '—'}
            </span>
          </div>
        </div>
      )}

      <div class="flex flex-wrap items-center justify-between gap-2">
        <StatusPip
          tone={bcs.tone}
          label={
            bcs.tone === 'muted'
              ? isLarva
                ? s(locale, 'card.larva')
                : s(locale, 'card.noData')
              : bcs.label.toLowerCase()
          }
        />
      </div>
    </button>
  );
}
