import { useRef } from 'preact/hooks';
import type { Snap } from './types';

const ORDEN: Snap[] = ['peek', 'half', 'full'];

/** The handle of a phone sheet: a tap cycles the three heights, a drag up or down moves one step, a drag down from the lowest closes it. Hidden above 720 px by the CSS. */
export function Grip({ label, snap, onSnap, onClose }: { label: string; snap: Snap; onSnap: (s: Snap) => void; onClose: () => void }) {
  const y0 = useRef<number | null>(null);
  const alSoltar = (e: PointerEvent) => {
    if (y0.current === null) return;
    const dy = e.clientY - y0.current;
    y0.current = null;
    const i = ORDEN.indexOf(snap);
    if (Math.abs(dy) < 8) onSnap(ORDEN[(i + 1) % 3]);
    else if (dy < -30) onSnap(ORDEN[Math.min(2, i + 1)]);
    else if (dy > 30) { if (i === 0) onClose(); else onSnap(ORDEN[i - 1]); }
  };
  return (
    <div class="at-grip" role="button" tabIndex={0} aria-label={label} onPointerDown={(e) => { y0.current = e.clientY; (e.currentTarget as Element).setPointerCapture(e.pointerId); }} onPointerUp={alSoltar}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSnap(ORDEN[(ORDEN.indexOf(snap) + 1) % 3]); } }}><i /></div>
  );
}
