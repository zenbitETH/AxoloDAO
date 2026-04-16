import { useEffect, useRef } from 'preact/hooks';

interface Props {
  /** Inlined SVG markup (the tagged mexico-interactive.svg) */
  svgMarkup: string;
  /** State codes that should be highlighted (e.g. for the currently selected/hovered species) */
  highlightedStates?: string[];
  /** State codes that match the active filter (rendered with a softer accent) */
  activeStates?: string[];
  onStateHover?: (code: string | null) => void;
  onStateClick?: (code: string) => void;
  className?: string;
}

export default function MexicoMap({
  svgMarkup,
  highlightedStates = [],
  activeStates = [],
  onStateHover,
  onStateClick,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    // Make sure the svg sizes responsively
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('class', 'block w-full h-full');

    const handlers: Array<{ el: Element; type: string; fn: EventListener }> = [];
    container.querySelectorAll<SVGPathElement>('[data-state-code]').forEach((path) => {
      const code = path.dataset.stateCode!;
      path.style.cursor = 'pointer';
      path.style.transition = 'fill 0.2s ease, opacity 0.2s ease';

      const enter = () => onStateHover?.(code);
      const leave = () => onStateHover?.(null);
      const click = () => onStateClick?.(code);

      path.addEventListener('mouseenter', enter);
      path.addEventListener('mouseleave', leave);
      path.addEventListener('focus', enter);
      path.addEventListener('blur', leave);
      path.addEventListener('click', click);
      path.addEventListener('keydown', ((e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(); }
      }) as EventListener);

      handlers.push(
        { el: path, type: 'mouseenter', fn: enter as EventListener },
        { el: path, type: 'mouseleave', fn: leave as EventListener },
        { el: path, type: 'click', fn: click as EventListener },
      );
    });

    return () => {
      for (const h of handlers) h.el.removeEventListener(h.type, h.fn);
    };
  }, [onStateHover, onStateClick]);

  // apply highlight classes whenever props change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const hi = new Set(highlightedStates);
    const active = new Set(activeStates);
    container.querySelectorAll<SVGPathElement>('[data-state-code]').forEach((path) => {
      const code = path.dataset.stateCode!;
      if (hi.has(code)) {
        path.setAttribute('fill', '#009C9C');
        path.style.filter = 'drop-shadow(0 0 14px rgba(0,156,156,0.7))';
        path.style.opacity = '1';
      } else if (active.size && active.has(code)) {
        path.setAttribute('fill', '#0E4555');
        path.style.filter = '';
        path.style.opacity = '1';
      } else {
        path.setAttribute('fill', '#1B333F');
        path.style.filter = '';
        path.style.opacity = active.size ? '0.55' : '1';
      }
    });
    // hide static distribution overlays — we render our own from data
    container.querySelectorAll('[data-distribution]').forEach((el) => {
      (el as SVGElement).style.display = 'none';
    });
  }, [highlightedStates, activeStates]);

  return (
    <div
      ref={containerRef}
      class={className}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}
