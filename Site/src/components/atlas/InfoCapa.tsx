import { useEffect, useRef, useState } from 'preact/hooks';

/** The text of a layer, behind an info button next to its name. It opens on mouse hover and on keyboard focus, and toggles on a tap or a click (a phone has no hover); Escape and a press outside close it. The tooltip is always in the page and the button points at it with aria-describedby, so a screen reader reads it without opening anything. It is as wide as the layer row, so it never leaves the panel. */
export function InfoCapa(p: { id: string; etiqueta: string; children: preact.ComponentChildren }) {
  const [hov, setHov] = useState(false);
  const [foc, setFoc] = useState(false);
  const [fijo, setFijo] = useState(false);
  const raiz = useRef<HTMLSpanElement>(null);
  const abierto = hov || foc || fijo;
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: Event) => { if (raiz.current && !raiz.current.contains(e.target as Node)) { setFijo(false); setHov(false); setFoc(false); } };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setFijo(false); setHov(false); setFoc(false); } };   // the tooltip is the top layer while it is open: Escape closes it and nothing under it
    document.addEventListener('pointerdown', fuera); document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);
  const tid = `info-${p.id}`;
  return (
    <span class="at-info" ref={raiz} data-info={p.id} data-open={abierto ? '1' : '0'}
      onPointerEnter={(e) => { if ((e as PointerEvent).pointerType === 'mouse') setHov(true); }} onPointerLeave={() => setHov(false)}>
      <button type="button" class="at-info-b" aria-label={p.etiqueta} aria-describedby={tid}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFijo(!fijo); }}
        onFocus={(e) => { if ((e.currentTarget as HTMLElement).matches(':focus-visible')) setFoc(true); }} onBlur={() => setFoc(false)}>
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2" /><path d="M12 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><circle cx="12" cy="7.5" r="1.3" fill="currentColor" /></svg>
      </button>
      <span class="at-info-t" role="tooltip" id={tid} data-info-tip onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>{p.children}</span>
    </span>
  );
}
