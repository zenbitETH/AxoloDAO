import { useEffect, useRef } from 'preact/hooks';

interface BBox { x: number; y: number; w: number; h: number }

interface Props {
  /** Inlined SVG markup (the tagged mexico-interactive.svg) */
  svgMarkup: string;
  /** State codes that should be highlighted (selected/hovered species states) */
  highlightedStates?: string[];
  /** State codes that match the active filter (rendered with a softer accent) */
  activeStates?: string[];
  /** Slug of the focused species. When set, only its overlay/markers show; others are hidden. */
  focusedSpecies?: string | null;
  /** Species slugs that pass the current filters. When set and non-empty, overlays/markers
   *  for species outside this list are hidden even if no single species is focused. */
  filteredSlugs?: string[] | null;
  /** Hex color used for state highlights — defaults to teal but typically the focused species's accent color */
  highlightColor?: string;
  /** When set, animate the SVG viewBox to this region (in master-canvas coords) */
  zoomBBox?: BBox | null;
  onStateHover?: (code: string | null) => void;
  onStateClick?: (code: string) => void;
  className?: string;
}

const FULL_VIEWBOX = '0 0 7205 4735';
const CONTAINER_RATIO = 4 / 5; // width / height — must stay in sync with SpeciesExplorer container aspect-ratio

function bboxToViewBox(b: BBox, paddingFraction = 0.18): string {
  // 1) Extend the shorter axis so the bbox matches the container aspect ratio.
  //    Otherwise preserveAspectRatio="meet" letterboxes on one axis and the user
  //    sees no neighboring-state context on that axis.
  let x = b.x, y = b.y, w = b.w, h = b.h;
  const currentRatio = w / h;
  if (currentRatio < CONTAINER_RATIO) {
    const newW = h * CONTAINER_RATIO;
    x -= (newW - w) / 2;
    w = newW;
  } else if (currentRatio > CONTAINER_RATIO) {
    const newH = w / CONTAINER_RATIO;
    y -= (newH - h) / 2;
    h = newH;
  }
  // 2) Apply outer padding for breathing room.
  const padX = w * paddingFraction;
  const padY = h * paddingFraction;
  return `${x - padX} ${y - padY} ${w + 2 * padX} ${h + 2 * padY}`;
}

export default function MexicoMap({
  svgMarkup,
  highlightedStates = [],
  activeStates = [],
  focusedSpecies = null,
  filteredSlugs = null,
  zoomBBox = null,
  highlightColor,
  onStateHover,
  onStateClick,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // ------ initial setup: size + click/hover handlers (runs once per markup) ----
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('class', 'block w-full h-full');
    svg.setAttribute('viewBox', FULL_VIEWBOX);
    (svg as SVGSVGElement).style.transition = 'none';

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

    // overlays + markers default styles
    container.querySelectorAll<SVGElement>('[data-overlay-type]').forEach((el) => {
      el.style.transition = 'opacity 0.25s ease';
      el.style.pointerEvents = 'none';
    });

    return () => {
      for (const h of handlers) h.el.removeEventListener(h.type, h.fn);
    };
  }, [svgMarkup, onStateHover, onStateClick]);

  // ------ state-fill highlight loop (cheap; runs on every prop change) ----
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const hi = new Set(highlightedStates);
    const active = new Set(activeStates);
    const hc = highlightColor ?? '#009C9C';
    container.querySelectorAll<SVGPathElement>('[data-state-code]').forEach((path) => {
      const code = path.dataset.stateCode!;
      if (hi.has(code)) {
        path.setAttribute('fill', hc);
        // 80% transparency so the highlight is clearly distinct from the solid point/area marker
        path.style.fillOpacity = '0.2';
        path.style.filter = `drop-shadow(0 0 14px ${hc}b3)`;
        path.style.opacity = '1';
      } else if (active.size && active.has(code)) {
        path.setAttribute('fill', '#0E4555');
        path.style.fillOpacity = '';
        path.style.filter = '';
        path.style.opacity = '1';
      } else {
        path.setAttribute('fill', '#1B333F');
        path.style.fillOpacity = '';
        path.style.filter = '';
        path.style.opacity = active.size ? '0.55' : '1';
      }
    });
  }, [highlightedStates, activeStates, highlightColor]);

  // ------ overlay / marker visibility: focusedSpecies wins; otherwise filter by filteredSlugs ----
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const allow = filteredSlugs ? new Set(filteredSlugs) : null;
    container.querySelectorAll<SVGElement>('[data-overlay-type]').forEach((el) => {
      const slug = el.getAttribute('data-species');
      if (focusedSpecies) {
        if (slug === focusedSpecies) {
          el.style.opacity = '1';
          el.style.display = '';
        } else {
          el.style.opacity = '0';
        }
        return;
      }
      if (allow && slug && !allow.has(slug)) {
        el.style.opacity = '0';
        return;
      }
      el.style.opacity = el.dataset.overlayType === 'area' ? '0.7' : '1';
      el.style.display = '';
    });
  }, [focusedSpecies, filteredSlugs]);

  // ------ viewBox zoom ----
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return;

    const target = zoomBBox ? bboxToViewBox(zoomBBox) : FULL_VIEWBOX;
    const current = svg.getAttribute('viewBox') ?? FULL_VIEWBOX;
    if (current === target) return;

    // Animate viewBox by interpolating with rAF (CSS doesn't transition viewBox reliably).
    const parse = (s: string) => s.split(/\s+/).map(Number);
    const from = parse(current);
    const to = parse(target);
    const duration = 600;
    const start = performance.now();
    let raf = 0;

    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = ease(t);
      const v = from.map((f, i) => f + (to[i] - f) * e);
      svg.setAttribute('viewBox', v.join(' '));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [zoomBBox]);

  return (
    <div
      ref={containerRef}
      class={className}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}
