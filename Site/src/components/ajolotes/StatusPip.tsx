import type { StatusTone } from './types';

const TONE_COLOR: Record<StatusTone, string> = {
  ok:    '#10B981',
  warn:  '#FBBF24',
  alarm: '#F43F5E',
  muted: 'rgba(128,128,128,0.55)',
};

interface Props {
  tone: StatusTone;
  label: string;
}

export default function StatusPip({ tone, label }: Props) {
  const c = TONE_COLOR[tone];
  return (
    <span class="inline-flex items-center gap-1.5 text-xs font-semibold lowercase text-[var(--wq-ink)]">
      <span
        class="inline-block h-2 w-2 rounded-full"
        style={{
          backgroundColor: c,
          boxShadow: `0 0 0 3px color-mix(in oklab, ${c} 25%, transparent)`,
        }}
      />
      {label}
    </span>
  );
}
