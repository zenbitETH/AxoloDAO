import { useEffect, useState } from 'preact/hooks';
import type { Bundle, Ejemplar, Locale } from './types';
import type { Measurement } from '../waterQuality/types';
import {
  accent as accentFor,
  genderSymbol,
  parseEmojiStatus,
  stationOf,
  type ThemeMode,
} from './theme';
import { commonName, genderTitle, s } from './strings';
import EjemplarPhoto from './EjemplarPhoto';
import StageChip from './StageChip';
import { classifyStage } from './stage';
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
  water: Measurement[];
  waterPath: string;
  onClose: () => void;
}

const GENDER_CLASS: Record<'♀' | '♂' | '(?)', string> = {
  '♀':   'text-[#D67BA8] dark:text-[#F4A6CB] text-[1.4rem] font-semibold self-center',
  '♂':   'text-[#4FA3D1] dark:text-[#7AC0E8] text-[1.4rem] font-semibold self-center',
  '(?)': 'text-[var(--wq-ink-muted)] text-[0.95rem] tracking-tight font-medium self-center',
};

function peceraLabel(locale: Locale, pecera: string | null | undefined): string {
  const raw = (pecera ?? '').trim();
  if (!raw) return '—';
  const station = stationOf(raw);
  if (station === 'AM') return `${s(locale, 'pecera.aquarium')} ${raw}`;
  if (station === 'AA' || station === 'AD') return `${s(locale, 'pecera.station')} ${raw}`;
  return raw;
}

export default function EjemplarModal({ ej, bundle, theme, locale, water, waterPath, onClose }: Props) {
  const [tab, setTab] = useState<TabId>('resumen');
  const [mounted, setMounted] = useState(false);
  const ac = accentFor(ej.especie, theme);
  const isLarva = (ej.alias ?? '').toLowerCase().includes('ajolobebe');

  // Esc to close + body scroll lock + flip the mount flag on next frame so the
  // CSS transition fires on entry instead of skipping straight to the resting
  // state (Emil's @starting-style pattern, fallback for older browsers).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      cancelAnimationFrame(raf);
    };
  }, [onClose]);

  const hist = (bundle.historial[ej.alias] ?? []).filter((h) => h.fecha);
  const alim = bundle.alimentacion[ej.alias] ?? [];
  const plan = bundle.planes[ej.alias] ?? null;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'resumen', label: s(locale, 'tab.resumen') },
    { id: 'biometria', label: s(locale, 'tab.biometria') },
    { id: 'medico', label: s(locale, 'tab.medico') },
    { id: 'alimentacion', label: s(locale, 'tab.alimentacion') },
  ];

  const bcs = parseEmojiStatus(ej.estadoBio);
  const respAlim = parseEmojiStatus(ej.alertaGastrica);
  const conduc = parseEmojiStatus(ej.alertaConductual);

  const sym = genderSymbol(ej.genero);
  const cName = commonName(locale, ej.especie);
  const stage = classifyStage(ej.lt, ej.estadio);

  return (
    <div
      class="aj-modal-backdrop fixed inset-0 z-[100] grid place-items-center px-4 py-8 backdrop-blur-sm"
      data-mounted={mounted}
      style={{ background: 'color-mix(in oklab, #071F29 76%, transparent)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        class="aj-modal-panel flex max-h-[92vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-3xl border border-[var(--wq-divider)] bg-[var(--wq-surface)] shadow-2xl"
        data-mounted={mounted}
        style={{ borderTopWidth: 4, borderTopColor: ac, ['--accent' as string]: ac }}
        role="dialog"
        aria-modal="true"
        aria-label={ej.alias}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — photo bleeds in from the right with a left-edge fade so
            the alias and chips stay legible without a separate photo column. */}
        <div class="relative overflow-hidden border-b border-[var(--wq-divider)]">
          <div
            class="pointer-events-none absolute inset-y-0 right-0 w-[62%] sm:w-[55%]"
            aria-hidden="true"
          >
            <div class="relative h-full w-full">
              <EjemplarPhoto alias={ej.alias} accent={ac} fill />
            </div>
            <div
              class="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to right, var(--wq-surface) 0%, color-mix(in oklab, var(--wq-surface) 85%, transparent) 22%, color-mix(in oklab, var(--wq-surface) 35%, transparent) 55%, transparent 92%)',
              }}
            />
          </div>
          <div class="relative flex items-start justify-between gap-4 p-5 sm:p-6">
            <div class="min-w-0 flex-1 sm:max-w-[58%]">
              <h2 class="m-0 flex flex-wrap items-center gap-3 font-display text-3xl font-bold leading-none tracking-tight text-[var(--wq-ink)]">
                <span class="truncate">{ej.alias}</span>
                <span class={GENDER_CLASS[sym]} title={genderTitle(locale, ej.genero)} aria-label={genderTitle(locale, ej.genero)}>
                  {sym}
                </span>
              </h2>
              {ej.fenotipo && (
                <p class="mt-1.5 m-0 text-sm italic text-[var(--wq-ink-muted)]">
                  {ej.fenotipo}
                </p>
              )}
              <p class="mt-1.5 m-0 text-sm text-[var(--wq-ink-muted)]">
                <em class="italic" style={{ color: ac }}>{ej.especie}</em>
                {cName && <span> · {cName}</span>}
              </p>
              <div class="mt-2 flex flex-wrap items-center gap-1.5">
                <StageChip stage={stage} accent={ac} locale={locale} />
                <span
                  class="whitespace-nowrap rounded-full px-2.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-[0.04em] shadow-sm"
                  style={{ backgroundColor: ac, color: '#F6EFE0' }}
                >
                  {peceraLabel(locale, ej.pecera)}
                </span>
                {ej.id && (
                  <span
                    class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-2 py-0.5"
                    title={s(locale, 'card.semarnat.tooltip')}
                  >
                    <span class="shrink-0 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
                      {s(locale, 'card.semarnat')}
                    </span>
                    <span class="font-mono text-[11px] font-semibold tracking-[-0.01em] text-[var(--wq-ink)]">
                      {ej.id}
                    </span>
                  </span>
                )}
              </div>
              {ej.marcas && (
                <p class="mt-2 m-0 text-sm leading-relaxed text-[var(--wq-ink)]">
                  <span class="mr-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
                    {s(locale, 'resumen.marcas')}
                  </span>
                  {ej.marcas}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              class="aj-press relative grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-[var(--wq-divider)] bg-[var(--wq-surface)]/60 text-2xl leading-none text-[var(--wq-ink)] backdrop-blur transition-[transform,background-color,border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[var(--wq-row-bg)] active:scale-[0.92]"
              aria-label={s(locale, 'modal.close')}
            >
              ×
            </button>
          </div>
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
                class={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-3 font-body text-sm font-semibold transition-[color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] ${
                  active
                    ? 'text-[var(--wq-ink)]'
                    : 'border-transparent text-[var(--wq-ink-muted)] [@media(hover:hover)]:hover:text-[var(--wq-ink)]'
                }`}
                style={active ? { color: ac, borderBottomColor: ac } : undefined}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Body */}
        <div class="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {tab === 'resumen' && (
            <ResumenTab
              ej={ej}
              hist={hist}
              bcs={bcs}
              respAlim={respAlim}
              conduc={conduc}
              accent={ac}
              isLarva={isLarva}
              locale={locale}
              water={water}
              waterPath={waterPath}
            />
          )}
          {tab === 'biometria' && <BiometriaTab hist={hist} accent={ac} locale={locale} />}
          {tab === 'medico' && <HistorialTab hist={hist} accent={ac} locale={locale} />}
          {tab === 'alimentacion' && (
            <AlimentacionTab ej={ej} alim={alim} plan={plan} accent={ac} locale={locale} />
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
