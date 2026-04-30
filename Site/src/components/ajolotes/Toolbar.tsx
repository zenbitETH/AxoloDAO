import type { Locale } from './types';
import { s } from './strings';

interface Props {
  locale: Locale;
  groupBy: 'station' | 'species';
  onGroupBy: (g: 'station' | 'species') => void;
  search: string;
  onSearch: (q: string) => void;
}

export default function Toolbar({ locale, groupBy, onGroupBy, search, onSearch }: Props) {
  return (
    <div class="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-6 pt-2">
      <div class="inline-flex overflow-hidden rounded-full border border-[var(--wq-divider)] bg-[var(--wq-row-bg)]">
        <button
          type="button"
          onClick={() => onGroupBy('station')}
          class={`px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 ${
            groupBy === 'station'
              ? 'bg-[var(--wq-ink)] text-[var(--wq-surface)]'
              : 'text-[var(--wq-ink-muted)] hover:text-[var(--wq-ink)]'
          }`}
        >
          {s(locale, 'toolbar.groupBy.station')}
        </button>
        <button
          type="button"
          onClick={() => onGroupBy('species')}
          class={`px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 ${
            groupBy === 'species'
              ? 'bg-[var(--wq-ink)] text-[var(--wq-surface)]'
              : 'text-[var(--wq-ink-muted)] hover:text-[var(--wq-ink)]'
          }`}
        >
          {s(locale, 'toolbar.groupBy.species')}
        </button>
      </div>
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
