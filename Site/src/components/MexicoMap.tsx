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
const DEFAULT_CONTAINER_RATIO = 4 / 5; // fallback if we can't measure yet

function bboxToViewBox(b: BBox, containerRatio: number, paddingFraction = 0.18): string {
  // 1) Extend the shorter axis so the bbox matches the container aspect ratio.
  //    Otherwise preserveAspectRatio="meet" letterboxes on one axis and the user
  //    sees no neighboring-state context on that axis.
  let x = b.x, y = b.y, w = b.w, h = b.h;
  const currentRatio = w / h;
  if (currentRatio < containerRatio) {
    const newW = h * containerRatio;
    x -= (newW - w) / 2;
    w = newW;
  } else if (currentRatio > containerRatio) {
    const newH = w / containerRatio;
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
  const containerRatioRef = useRef<number>(DEFAULT_CONTAINER_RATIO);

  // Track the real width/height of the container so the zoom bbox extension
  // matches reality (desktop is 4/5, mobile is taller).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        containerRatioRef.current = r.width / r.height;
      }
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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

    // overlays + markers default styles. `pointer-events: none` is set BOTH as
    // an SVG attribute and as inline CSS — iOS Safari occasionally ignores the
    // style-based form for complex filled paths (species area overlays), letting
    // the overlay capture taps that should hit the underlying state path.
    container.querySelectorAll<SVGElement>('[data-overlay-type]').forEach((el) => {
      el.style.transition = 'opacity 0.25s ease';
      el.style.pointerEvents = 'none';
      el.setAttribute('pointer-events', 'none');
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

    const target = zoomBBox ? bboxToViewBox(zoomBBox, containerRatioRef.current) : FULL_VIEWBOX;
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

  // Imperative zoom controls. Multiply the current viewBox by `factor` around
  // its center — factor > 1 zooms in, factor < 1 zooms out. We clamp against
  // the full-canvas bounds so the user can't zoom further out than the full map.
  function manualZoom(factor: number) {
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return;
    const parts = (svg.getAttribute('viewBox') ?? FULL_VIEWBOX).split(/\s+/).map(Number);
    if (parts.length !== 4 || parts.some(Number.isNaN)) return;
    const [x, y, w, h] = parts;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const scale = 1 / factor;
    const full = FULL_VIEWBOX.split(' ').map(Number);
    const maxW = full[2];
    const maxH = full[3];
    let newW = Math.min(w * scale, maxW);
    let newH = Math.min(h * scale, maxH);
    // Keep the container aspect ratio in sync so zoom-out doesn't letterbox.
    const ratio = containerRatioRef.current;
    if (newW / newH > ratio) newH = newW / ratio;
    else newW = newH * ratio;
    newW = Math.min(newW, maxW);
    newH = Math.min(newH, maxH);
    const newX = Math.max(0, Math.min(maxW - newW, cx - newW / 2));
    const newY = Math.max(0, Math.min(maxH - newH, cy - newH / 2));
    svg.setAttribute('viewBox', `${newX} ${newY} ${newW} ${newH}`);
  }

  return (
    <div class={`relative ${className ?? ''}`}>
      <div
        ref={containerRef}
        class="h-full w-full"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
      <div class="pointer-events-none absolute right-2 top-2 z-10 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => manualZoom(1.4)}
          aria-label="Zoom in"
          class="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-dark-navy/80 text-lg font-bold text-white/85 shadow-sm backdrop-blur-md transition-colors hover:border-teal/60 hover:text-teal"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => manualZoom(1 / 1.4)}
          aria-label="Zoom out"
          class="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-dark-navy/80 text-lg font-bold text-white/85 shadow-sm backdrop-blur-md transition-colors hover:border-teal/60 hover:text-teal"
        >
          −
        </button>
      </div>
    </div>
  );
}
