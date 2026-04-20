import { useEffect, useRef, useState } from 'preact/hooks';

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
  /** Localized labels for the zoom controls */
  controlLabels?: { zoomIn: string; zoomOut: string; zoomReset: string };
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
  controlLabels,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerRatioRef = useRef<number>(DEFAULT_CONTAINER_RATIO);
  const [userZoom, setUserZoom] = useState(1);
  const [userPan, setUserPan] = useState({ x: 0, y: 0 });

  // Reset user zoom/pan whenever the authored focus changes, so species zooms
  // always start from a clean baseline regardless of prior manual zooming.
  useEffect(() => {
    setUserZoom(1);
    setUserPan({ x: 0, y: 0 });
  }, [zoomBBox]);

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

    const base = zoomBBox ? bboxToViewBox(zoomBBox, containerRatioRef.current) : FULL_VIEWBOX;
    const [bx, by, bw, bh] = base.split(/\s+/).map(Number);
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    const w = bw / userZoom;
    const h = bh / userZoom;
    const target = `${cx - w / 2 + userPan.x} ${cy - h / 2 + userPan.y} ${w} ${h}`;
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
  }, [zoomBBox, userZoom, userPan]);

  const ZOOM_STEP = 1.4;
  const ZOOM_MAX = 5;
  const hasUserTransform = userZoom !== 1 || userPan.x !== 0 || userPan.y !== 0;

  return (
    <div
      ref={containerRef}
      class={className}
      style={{ position: 'relative', touchAction: 'pan-y' }}
    >
      <div
        class="h-full w-full"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
      <div class="absolute bottom-3 right-3 z-10 flex flex-col gap-1 rounded-full border border-white/15 bg-[rgb(7_31_41/0.78)] p-1 backdrop-blur">
        <button
          type="button"
          onClick={() => setUserZoom((z) => Math.min(z * ZOOM_STEP, ZOOM_MAX))}
          aria-label={controlLabels?.zoomIn ?? 'Zoom in'}
          class="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-white/85 transition-colors hover:bg-white/10"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => {
            setUserZoom((z) => {
              const next = Math.max(z / ZOOM_STEP, 1);
              if (next === 1) setUserPan({ x: 0, y: 0 });
              return next;
            });
          }}
          aria-label={controlLabels?.zoomOut ?? 'Zoom out'}
          class="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-white/85 transition-colors hover:bg-white/10"
        >
          −
        </button>
        {hasUserTransform && (
          <button
            type="button"
            onClick={() => {
              setUserZoom(1);
              setUserPan({ x: 0, y: 0 });
            }}
            aria-label={controlLabels?.zoomReset ?? 'Reset zoom'}
            class="flex h-8 w-8 items-center justify-center rounded-full text-base leading-none text-white/85 transition-colors hover:bg-white/10"
          >
            ⟲
          </button>
        )}
      </div>
    </div>
  );
}
