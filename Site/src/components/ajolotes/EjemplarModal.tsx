import { useEffect, useState } from 'preact/hooks';
import type { Bundle, Ejemplar, Locale } from './types';
import {
  accent as accentFor,
  genderSymbol,
  parseEmojiStatus,
  type ThemeMode,
} from './theme';
import { commonName, genderTitle, s } from './strings';
import AjoloteAvatar from './AjoloteAvatar';
import ResumenTab from './tabs/ResumenTab';
import BiometriaTab from './tabs/BiometriaTab';
import HistorialTab from './tabs/HistorialTab';
import AlimentacionTab from './tabs/AlimentacionTab';

type TabId = 'resumen' | 'biometria' | 'medico' | 'alimentacion';

interface Props {
  ej: Ejemplar;
  bundle: Bundle;
  theme: ThemeMode;
  locale: Locale;
  onClose: () => void;
}

const GENDER_CLASS: Record<'♀' | '♂' | '(?)', string> = {
  '♀':   'text-[#D67BA8] dark:text-[#F4A6CB] text-[1.4rem] font-semibold self-center',
  '♂':   'text-[#4FA3D1] dark:text-[#7AC0E8] text-[1.4rem] font-semibold self-center',
  '(?)': 'text-[var(--wq-ink-muted)] text-[0.78em] tracking-tight font-medium ml-1 self-center',
};

export default function EjemplarModal({ ej, bundle, theme, locale, onClose }: Props) {
  const [tab, setTab] = useState<TabId>('resumen');
  const ac = accentFor(ej.especie, theme);
  const isLarva = (ej.alias ?? '').toLowerCase().includes('ajolobebe');

  // Esc to close + body scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const hist = (bundle.historial[ej.alias] ?? []).filter((h) => h.fecha);
  const alim = bundle.alimentacion[ej.alias] ?? [];
  const plan = bundle.planes[ej.alias] ?? null;

  const histClinicalCount = hist.filter(
    (h) => h.cabeza || h.cuerpo || h.cola || h.extremidades || h.comportamiento || h.notas,
  ).length;

  const tabs: { id: TabId; label: string; count?: number | null }[] = [
    { id: 'resumen', label: s(locale, 'tab.resumen') },
    { id: 'biometria', label: s(locale, 'tab.biometria'), count: hist.length || null },
    { id: 'medico', label: s(locale, 'tab.medico'), count: histClinicalCount || null },
    { id: 'alimentacion', label: s(locale, 'tab.alimentacion'), count: alim.length || null },
  ];

  const bcs = parseEmojiStatus(ej.estadoBio);
  const respAlim = parseEmojiStatus(ej.alertaGastrica);
  const conduc = parseEmojiStatus(ej.alertaConductual);

  const sym = genderSymbol(ej.genero);
  const cName = commonName(locale, ej.especie);

  return (
    <div
      class="fixed inset-0 z-[100] grid place-items-center px-4 py-8 backdrop-blur-md"
      style={{ background: 'color-mix(in oklab, #071F29 76%, transparent)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        class="flex max-h-[92vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-3xl border border-[var(--wq-divider)] bg-[var(--wq-surface)] shadow-2xl"
        style={{ borderTopWidth: 4, borderTopColor: ac, ['--accent' as string]: ac }}
        role="dialog"
        aria-modal="true"
        aria-label={ej.alias}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="flex items-start justify-between gap-4 border-b border-[var(--wq-divider)] p-5 sm:p-6">
          <div class="flex min-w-0 items-center gap-4">
            <AjoloteAvatar alias={ej.alias} size={88} accent={ac} />
            <div class="min-w-0">
              <p class="m-0 mb-1.5 flex flex-wrap items-center gap-2.5 text-xs text-[var(--wq-ink-muted)]">
                <span
                  class="rounded-full px-3 py-0.5 font-display text-[11px] font-bold"
                  style={{ backgroundColor: ac, color: '#F6EFE0' }}
                >
                  {ej.pecera}
                </span>
                {ej.id && (
                  <span class="rounded border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-2.5 py-0.5 font-mono text-[14px] font-semibold tracking-[0.02em] text-[var(--wq-ink)]">
                    {ej.id}
                  </span>
                )}
              </p>
              <h2 class="m-0 flex flex-wrap items-baseline gap-3 font-display text-3xl font-bold leading-none tracking-tight text-[var(--wq-ink)]">
                <span>{ej.alias}</span>
                <span class={GENDER_CLASS[sym]} title={genderTitle(locale, ej.genero)}>
                  {sym}
                </span>
              </h2>
              <p class="mt-1 text-sm text-[var(--wq-ink-muted)]">
                <em style={{ color: ac, fontStyle: 'italic' }}>{ej.especie}</em>
                {cName && <span> · {cName}</span>}
                <span> · {genderTitle(locale, ej.genero)}</span>
                {ej.estadio && <span> · {ej.estadio}</span>}
                {ej.edad && <span> · {ej.edad}</span>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            class="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-[var(--wq-divider)] bg-transparent text-2xl leading-none text-[var(--wq-ink)] transition-colors duration-200 hover:bg-[var(--wq-row-bg)]"
            aria-label={s(locale, 'modal.close')}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <nav
          class="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-[var(--wq-divider)] px-5 sm:px-6"
          role="tablist"
        >
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                class={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-3 font-body text-sm font-semibold transition-colors duration-200 ${
                  active
                    ? 'text-[var(--wq-ink)]'
                    : 'border-transparent text-[var(--wq-ink-muted)] hover:text-[var(--wq-ink)]'
                }`}
                style={active ? { color: ac, borderBottomColor: ac } : undefined}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.count != null && (
                  <span
                    class="rounded-full px-1.5 py-0 text-[10px] tabular-nums"
                    style={
                      active
                        ? { color: ac, backgroundColor: `${ac}33` }
                        : { color: 'var(--wq-ink-muted)', backgroundColor: 'var(--wq-row-bg)' }
                    }
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Body */}
        <div class="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {tab === 'resumen' && (
            <ResumenTab
              ej={ej}
              bcs={bcs}
              respAlim={respAlim}
              conduc={conduc}
              accent={ac}
              isLarva={isLarva}
              locale={locale}
            />
          )}
          {tab === 'biometria' && <BiometriaTab hist={hist} accent={ac} locale={locale} />}
          {tab === 'medico' && <HistorialTab hist={hist} accent={ac} locale={locale} />}
          {tab === 'alimentacion' && (
            <AlimentacionTab alim={alim} plan={plan} accent={ac} locale={locale} />
          )}
        </div>

        {/* Footer */}
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-5 py-2.5 text-[11px] text-[var(--wq-ink-muted)] sm:px-6">
          <span class="inline-flex items-center gap-1.5">
            <span
              class="inline-block h-1.5 w-1.5 rounded-full bg-ocre"
              style={{ boxShadow: '0 0 6px rgba(212,146,95,0.6)' }}
            />
            {s(locale, 'modal.foot.att')}
          </span>
          <span>
            {s(locale, 'modal.foot.curador')}:{' '}
            <code class="font-mono text-teal">lups-plantae.axolodao.eth</code>
          </span>
        </div>
      </div>
    </div>
  );
}
