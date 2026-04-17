import { useEffect, useRef } from 'preact/hooks';

const DNA_STRANDS = [
  { top: '14%', left: '8%',  size: 120, rot: -18, dur: 22, delay: 0,   depth: 0.35, hue: 'teal' },
  { top: '22%', left: '84%', size: 92,  rot: 12,  dur: 28, delay: -6,  depth: 0.55, hue: 'rosa' },
  { top: '58%', left: '6%',  size: 108, rot: 8,   dur: 34, delay: -12, depth: 0.45, hue: 'ocre' },
  { top: '68%', left: '78%', size: 84,  rot: -24, dur: 24, delay: -3,  depth: 0.65, hue: 'teal' },
  { top: '40%', left: '90%', size: 72,  rot: 30,  dur: 30, delay: -9,  depth: 0.75, hue: 'teal' },
  { top: '82%', left: '46%', size: 96,  rot: -6,  dur: 26, delay: -15, depth: 0.28, hue: 'rosa' },
] as const;

const HUE_COLOR: Record<'teal' | 'rosa' | 'ocre', string> = {
  teal: '#009C9C',
  rosa: '#E85D75',
  ocre: '#D4925F',
};

function DnaStrand({ size, color, className, style }: { size: number; color: string; className?: string; style?: any }) {
  const w = size;
  const h = size * 2.4;
  // Axolotl-inspired: two organic ribbons flowing like the body's silhouette,
  // with a few short, softly rounded rungs only at the cross-over peaks.
  return (
    <svg width={w} height={h} viewBox="0 0 40 120" class={className} style={style} aria-hidden="true">
      <g fill="none" stroke={color} stroke-linecap="round">
        <path
          d="M10 2 C 34 18, 6 32, 30 48 C 6 64, 34 80, 10 96 C 6 108, 18 116, 20 120"
          stroke-width="1.6"
          opacity="0.72"
        />
        <path
          d="M30 2 C 6 18, 34 32, 10 48 C 34 64, 6 80, 30 96 C 34 108, 22 116, 20 120"
          stroke-width="1.6"
          opacity="0.72"
        />
        <g stroke-width="1" opacity="0.38">
          <line x1="15" y1="14" x2="25" y2="14" />
          <line x1="14" y1="32" x2="26" y2="32" />
          <line x1="15" y1="50" x2="25" y2="50" />
          <line x1="14" y1="68" x2="26" y2="68" />
          <line x1="15" y1="86" x2="25" y2="86" />
          <line x1="16" y1="104" x2="24" y2="104" />
        </g>
      </g>
    </svg>
  );
}

export default function HeroParallax() {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    let raf = 0;
    let latest = 0;

    const update = () => {
      raf = 0;
      stage.style.setProperty('--scrollY', `${latest}`);
    };

    const onScroll = () => {
      latest = window.scrollY;
      if (!raf) raf = requestAnimationFrame(update);
    };

    const species = document.getElementById('species');
    let io: IntersectionObserver | null = null;
    if (species) {
      io = new IntersectionObserver(
        ([entry]) => {
          stage.style.setProperty('--stage-opacity', entry.isIntersecting ? '0' : '1');
        },
        { threshold: 0, rootMargin: '-30% 0px 0px 0px' },
      );
      io.observe(species);
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, []);

  return (
    <div
      ref={stageRef}
      class="hero-parallax pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ opacity: 'var(--stage-opacity, 1)' }}
      aria-hidden="true"
    >
      {/* Soft ambient gradients (kept from old hero blobs) */}
      <div class="absolute left-1/2 top-[18%] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-teal/25 blur-3xl" />
      <div class="absolute right-[-6rem] top-[40%] h-72 w-72 rounded-full bg-rosa/20 blur-3xl" />
      <div class="absolute bottom-[-4rem] left-[-4rem] h-80 w-80 rounded-full bg-ocre/15 blur-3xl" />

      {/* Axolotl icon centerpiece */}
      <img
        src="/logos/axolodaoicon.svg"
        alt=""
        class="hero-parallax-icon absolute left-1/2 top-1/2 h-[28rem] w-[28rem] sm:h-[36rem] sm:w-[36rem]"
      />

      {/* DNA strands */}
      {DNA_STRANDS.map((s, i) => (
        <div
          key={i}
          class="hero-parallax-strand absolute"
          style={{
            top: s.top,
            left: s.left,
            ['--depth' as any]: s.depth,
            ['--rot0' as any]: `${s.rot}deg`,
            ['--spin-dur' as any]: `${s.dur}s`,
            ['--spin-delay' as any]: `${s.delay}s`,
          }}
        >
          <DnaStrand size={s.size} color={HUE_COLOR[s.hue]} className="hero-parallax-spin" />
        </div>
      ))}
    </div>
  );
}
