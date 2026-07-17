import { useMemo, useState } from 'preact/hooks';
import type { Baja, Bundle, Locale } from './types';
import { s } from './strings';
import BajaCard from './BajaCard';

interface Props {
  bajas: Baja[];
  bundle: Bundle;
  locale: Locale;
  onBack: () => void;
  onSelect: (baja: Baja) => void;
}

function simplifyCausa(c: string | null | undefined): string {
  const x = (c || '').toLowerCase();
  if (/parasit/.test(x)) return 'Parasitaria';
  if (/bacter|sepsis/.test(x)) return 'Infección bacteriana';
  if (/viral|virus/.test(x)) return 'Viral';
  if (/desconoc/.test(x)) return 'Desconocida';
  if (/caida|trauma|golpe/.test(x)) return 'Trauma';
  if (/edad|natural/.test(x)) return 'Edad/natural';
  if (/conge/.test(x)) return 'Congénita';
  if (!x) return 'Sin registrar';
  return (c ?? '').split(/[,/]/)[0].trim() || 'Otra';
}

// Curation (which bajas are public, synthetic Leucistica injection, etc.)
// happens in the parent AjolotesExplorer. This component trusts the prop.

export default function BajasView({ bajas, bundle, locale, onBack, onSelect }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bajas;
    return bajas.filter((b) =>
      (b.nombre ?? '').toLowerCase().includes(q) ||
      (b.causa ?? '').toLowerCase().includes(q) ||
      (b.fecha ?? '').toLowerCase().includes(q),
    );
  }, [bajas, search]);

  const ordered = useMemo(
    () => [...filtered].sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')),
    [filtered],
  );

  const causaCounts = useMemo(() => {
    const map: Record<string, number> = {};
    bajas.forEach((b) => {
      const k = simplifyCausa(b.causa);
      map[k] = (map[k] ?? 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [bajas]);

  return (
    <>
      <section class="mx-auto grid max-w-[1240px] grid-cols-1 items-start gap-8 border-b border-[var(--wq-divider)] px-6 pb-6 pt-8 md:grid-cols-[1.6fr_1fr]">
        <div>
          <p class="m-0 mb-2.5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
            <span
              class="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: '#8B6F47' }}
              aria-hidden="true"
            />
            {s(locale, 'bajas.eyebrow')} <span aria-hidden="true">🪦</span>
          </p>
          <h1 class="mt-1.5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-[var(--wq-ink)] sm:text-5xl">
            {s(locale, 'bajas.title')}
          </h1>
          <p class="mt-2 max-w-[56ch] text-base leading-relaxed text-[var(--wq-ink-muted)] sm:text-lg">
            {s(locale, 'bajas.sub')}
          </p>
          <button
            type="button"
            onClick={onBack}
            class="mt-3.5 rounded-full border border-[var(--wq-divider)] bg-transparent px-3.5 py-2 text-sm text-[var(--wq-ink)] transition-colors duration-200 hover:border-[var(--wq-ink)] hover:bg-[var(--wq-row-bg)]"
          >
            {s(locale, 'bajas.back')}
          </button>
        </div>
        <div class="flex flex-col gap-3.5">
          <div class="rounded-xl border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] p-4">
            <div class="font-display text-5xl font-bold leading-none text-[var(--wq-ink)]">
              {bajas.length}
            </div>
            <div class="mt-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--wq-ink-muted)]">
              {s(locale, 'bajas.total')}
            </div>
          </div>
          <ul class="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
            {causaCounts.slice(0, 5).map(([k, n]) => (
              <li
                key={k}
                class="grid items-center gap-2.5"
                style={{ gridTemplateColumns: 'minmax(120px, 1fr) 80px 28px' }}
              >
                <span class="text-[var(--wq-ink)]">{k}</span>
                <span class="relative h-1.5 overflow-hidden rounded-[3px] border border-[var(--wq-divider)] bg-[var(--wq-row-bg)]">
                  <span
                    class="block h-full rounded-[2px]"
                    style={{ width: `${(n / Math.max(1, bajas.length)) * 100}%`, background: '#8B6F47' }}
                  />
                </span>
                <span class="text-right font-mono text-xs text-[var(--wq-ink-muted)]">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div class="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-6 pt-2">
        <span class="rounded-full border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-3.5 py-1.5 font-display text-sm font-semibold text-[var(--wq-ink)]">
          {ordered.length}{' '}
          {ordered.length === 1 ? s(locale, 'bajas.count.one') : s(locale, 'bajas.count.many')}
        </span>
        <input
          type="search"
          value={search}
          onInput={(e) => setSearch((e.currentTarget as HTMLInputElement).value)}
          placeholder={s(locale, 'toolbar.search')}
          class="min-w-[200px] rounded-full border border-[var(--wq-divider)] bg-[var(--wq-row-bg)] px-3.5 py-1.5 text-sm text-[var(--wq-ink)] outline-none transition-colors duration-200 placeholder:text-[var(--wq-ink-muted)] focus:border-teal/60"
        />
      </div>

      <main
        class="mx-auto grid w-full max-w-[1400px] gap-4 px-6 pb-12 pt-4"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
      >
        {ordered.map((b, i) => (
          <BajaCard
            key={b.nombre || i}
            baja={b}
            bundle={bundle}
            locale={locale}
            onSelect={onSelect}
          />
        ))}
        {ordered.length === 0 && (
          <p class="m-0 col-span-full py-5 text-center text-sm text-[var(--wq-ink-muted)]">
            {s(locale, 'bajas.empty')}
          </p>
        )}
      </main>
    </>
  );
}
