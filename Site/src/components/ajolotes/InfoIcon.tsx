// Info icon with portal-rendered tooltip. Keep the tooltip out of the parent
// flow (position: fixed, computed from getBoundingClientRect()) — an earlier
// in-flow absolute version widened the parent column on hover.

import { useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';

interface Props {
  text: string;
  ariaLabel?: string;
}

export default function InfoIcon({ text, ariaLabel }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: r.top - 8, left: r.left + r.width / 2 });
  };
  const hide = () => setPos(null);

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        role="button"
        aria-label={ariaLabel ?? text}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => { e.stopPropagation(); pos ? hide() : show(); }}
        class="inline-flex h-4 w-4 cursor-help items-center justify-center align-middle text-[var(--wq-ink-muted)] hover:text-[var(--wq-ink)]"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.4" />
          <circle cx="8" cy="4.5" r="1" fill="currentColor" />
          <path d="M8 7 V 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </span>
      {pos && typeof document !== 'undefined' && createPortal(
        <span
          role="tooltip"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: 'translate(-50%, -100%)',
          }}
          class="pointer-events-none z-[9999] whitespace-nowrap rounded-md bg-[var(--wq-ink)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--wq-surface)] shadow-lg"
        >
          {text}
        </span>,
        document.body,
      )}
    </>
  );
}
