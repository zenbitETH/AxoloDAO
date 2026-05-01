// Stage indicator chip. Mirrors the station-capsule style (filled accent,
// cream text) so the two pills read as a matched pair on the card and modal
// header. Unknown stage falls back to a neutral muted pill.

import type { Locale } from './types';
import type { Stage } from './stage';
import { s } from './strings';

interface Props {
  stage: Stage;
  accent: string;
  locale: Locale;
  size?: 'sm' | 'md';
}

export default function StageChip({ stage, accent, locale, size = 'sm' }: Props) {
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]';
  const baseCls = `inline-flex items-center gap-1 whitespace-nowrap rounded-full font-display font-bold uppercase tracking-[0.04em] shadow-sm ${padding}`;

  const style: { color?: string; backgroundColor?: string } =
    stage === 'unknown'
      ? {
          color: 'var(--wq-ink-muted)',
          backgroundColor: 'var(--wq-row-bg)',
        }
      : {
          color: '#F6EFE0',
          backgroundColor: accent,
        };

  return (
    <span class={baseCls} style={style}>
      {s(locale, `stage.${stage}`)}
    </span>
  );
}
