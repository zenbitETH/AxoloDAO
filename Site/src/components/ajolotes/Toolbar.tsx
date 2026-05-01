import type { Locale } from './types';
import { s } from './strings';

interface Props {
  locale: Locale;
  viewDensity: 'gallery' | 'list';
  onViewDensity: (v: 'gallery' | 'list') => void;
  search: string;
  onSearch: (q: string) => void;
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      class="inline-flex overflow-hidden rounded-full border border-[var(--wq-divider)] bg-[var(--wq-row-bg)]"
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            class={`px-3.5 py-1.5 text-xs font-semibold transition-[transform,color,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.96] ${
              active
                ? 'bg-[var(--wq-ink)] text-[var(--wq-surface)]'
                : 'text-[var(--wq-ink-muted)] [@media(hover:hover)]:hover:text-[var(--wq-ink)]'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Toolbar({
  locale,
  viewDensity,
  onViewDensity,
  search,
  onSearch,
}: Props) {
  return (
    <div class="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-6 pt-2">
      <Segmented
        value={viewDensity}
        options={[
          { value: 'gallery', label: s(locale, 'view.gallery') },
          { value: 'list',    label: s(locale, 'view.list') },
        ]}
        onChange={onViewDensity}
      />
      <input
        type="search"
        value={search}
        onInput={(e) => onSearch((e.currentTarget as HTMLInputElement).value)}
        placeholder={s(locale, 'toolbar.search')}
        class="min-w-[200px] rounded-full border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-3.5 py-1.5 text-sm text-[var(--wq-ink)] outline-none transition-colors duration-200 placeholder:text-[var(--wq-ink-muted)] focus:border-teal/60"
      />
    </div>
  );
}
