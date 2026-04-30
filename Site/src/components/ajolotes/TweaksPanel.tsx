// Floating bottom-right Ajustes panel. Mirrors the global locale + theme
// toggles for power users and adds the explorer-specific group-by + larvario
// switches. The full host-protocol scaffolding from the prototype's
// tweaks-panel.jsx (claude.ai prototyping protocol) is intentionally dropped
// — this is a self-contained always-mounted control.

import { useState } from 'preact/hooks';
import type { Locale } from './types';
import { s } from './strings';

interface Props {
  locale: Locale;
  theme: 'light' | 'dark';
  groupBy: 'station' | 'species';
  showLarvario: boolean;
  onTheme: (t: 'light' | 'dark') => void;
  onGroupBy: (g: 'station' | 'species') => void;
  onLarvario: (v: boolean) => void;
  // path builders for locale switching — provided by the page shell so each
  // locale's URL keeps its prefix correct
  pathFor: (l: Locale) => string;
}

const LOCALES: Locale[] = ['es', 'en', 'pt'];

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div class="inline-flex rounded-md bg-[var(--wq-row-bg)] p-0.5 ring-1 ring-[var(--wq-divider)]">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            class={`rounded-[5px] px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
              active ? 'bg-[var(--wq-cell-bg)] text-[var(--wq-ink)] shadow-sm' : 'text-[var(--wq-ink-muted)] hover:text-[var(--wq-ink)]'
            }`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function TweaksPanel({
  locale,
  theme,
  groupBy,
  showLarvario,
  onTheme,
  onGroupBy,
  onLarvario,
  pathFor,
}: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        class="fixed bottom-4 right-4 z-50 grid h-10 w-10 place-items-center rounded-full border border-[var(--wq-divider)] bg-[var(--wq-surface)] text-lg shadow-lg backdrop-blur transition-colors duration-200 hover:bg-[var(--wq-row-bg)]"
        aria-label={s(locale, 'tweaks.title')}
        title={s(locale, 'tweaks.title')}
      >
        ⚙
      </button>
    );
  }

  return (
    <div
      class="fixed bottom-4 right-4 z-50 flex w-[280px] max-w-[calc(100vw-32px)] flex-col gap-2.5 rounded-2xl border border-[var(--wq-divider)] bg-[var(--wq-surface)] p-3.5 text-[var(--wq-ink)] shadow-2xl backdrop-blur"
      role="dialog"
      aria-label={s(locale, 'tweaks.title')}
    >
      <div class="flex items-center justify-between">
        <strong class="font-display text-sm font-bold">{s(locale, 'tweaks.title')}</strong>
        <button
          type="button"
          onClick={() => setOpen(false)}
          class="grid h-6 w-6 place-items-center rounded text-[var(--wq-ink-muted)] hover:bg-[var(--wq-row-bg)] hover:text-[var(--wq-ink)]"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      <div class="flex flex-col gap-1.5">
        <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
          {s(locale, 'tweaks.locale')}
        </span>
        <div class="inline-flex rounded-md bg-[var(--wq-row-bg)] p-0.5 ring-1 ring-[var(--wq-divider)]">
          {LOCALES.map((l) => {
            const active = locale === l;
            return (
              <a
                key={l}
                href={pathFor(l)}
                class={`rounded-[5px] px-2.5 py-1 text-xs font-medium uppercase tracking-[0.04em] transition-all duration-150 ${
                  active
                    ? 'bg-[var(--wq-cell-bg)] text-[var(--wq-ink)] shadow-sm'
                    : 'text-[var(--wq-ink-muted)] hover:text-[var(--wq-ink)]'
                }`}
              >
                {l}
              </a>
            );
          })}
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
          {s(locale, 'tweaks.theme')}
        </span>
        <Segmented
          value={theme}
          options={[
            { value: 'dark',  label: s(locale, 'tweaks.theme.dark') },
            { value: 'light', label: s(locale, 'tweaks.theme.light') },
          ]}
          onChange={onTheme}
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
          {s(locale, 'tweaks.groupBy')}
        </span>
        <Segmented
          value={groupBy}
          options={[
            { value: 'station', label: s(locale, 'tweaks.groupBy.station') },
            { value: 'species', label: s(locale, 'tweaks.groupBy.species') },
          ]}
          onChange={onGroupBy}
        />
      </div>

      <div class="flex items-center justify-between gap-2 pt-0.5">
        <span class="text-xs font-medium text-[var(--wq-ink-muted)]">
          {s(locale, 'tweaks.larvario')}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={showLarvario}
          onClick={() => onLarvario(!showLarvario)}
          class={`relative h-[18px] w-8 rounded-full transition-colors duration-150 ${
            showLarvario ? 'bg-[#34c759]' : 'bg-[var(--wq-divider)]'
          }`}
        >
          <span
            class="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-150"
            style={{ left: showLarvario ? '16px' : '2px' }}
          />
        </button>
      </div>
    </div>
  );
}
