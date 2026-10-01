import { useEffect, useState } from 'preact/hooks';
import type { Locale } from '../types';
import { s } from '../strings';
import Relato, { type PmRelato } from './Relato';

// The follow-up of a living specimen, read like its postmortem would be. Data is
// seguimiento.json, regenerated in the brain (tools/forense/seguimiento.mjs) and published by
// project-public.mjs with the same scrub and guards as bajas-forense.json; never edited.

interface SegData { generated: string; vivos: Record<string, PmRelato & { alias: string }> }

const fold = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

let cache: Promise<SegData> | null = null;
function loadSeguimiento(): Promise<SegData> {
  cache ??= fetch('/data/ajolotes/seguimiento.json').then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });
  return cache;
}

export default function SeguimientoTab({ alias, locale }: { alias: string; locale: Locale }) {
  const [seg, setSeg] = useState<(PmRelato & { alias: string }) | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    loadSeguimiento()
      .then((d) => { if (live) setSeg(Object.values(d.vivos).find((v) => fold(v.alias) === fold(alias)) ?? null); })
      .catch(() => { if (live) setSeg(null); });
    return () => { live = false; };
  }, [alias]);

  if (seg === undefined) return <div class="h-40 animate-pulse rounded-2xl bg-[var(--wq-row-bg)]" aria-busy="true" />;
  if (seg === null) return <p class="m-0 text-sm text-[var(--wq-ink-muted)]">{s(locale, 'seg.empty')}</p>;
  return (
    <div class="flex flex-col gap-4">
      <Relato r={{ ...seg, vivo: true }} alias={seg.alias} locale={locale} />
      <p class="m-0 border-t border-[var(--wq-divider)] pt-3 text-[11px] leading-snug text-[var(--wq-ink-muted)]">{s(locale, 'seg.bridge')}</p>
    </div>
  );
}
