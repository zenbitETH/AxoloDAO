import { useEffect, useRef } from 'preact/hooks';

const DNA_STRANDS = [
  { top: '12%', left: '6%',  size: 170, shape: 'strand',   rot: -14, dur: 22, delay: 0,   depth: 0.32, hue: 'teal' },
  { top: '20%', left: '86%', size: 200, shape: 'infinity', rot: 10,  dur: 28, delay: -6,  depth: 0.55, hue: 'rosa' },
  { top: '56%', left: '4%',  size: 150, shape: 'strand',   rot: 6,   dur: 34, delay: -12, depth: 0.45, hue: 'ocre' },
  { top: '68%', left: '80%', size: 170, shape: 'infinity', rot: -22, dur: 24, delay: -3,  depth: 0.65, hue: 'teal' },
  { top: '40%', left: '92%', size: 90,  shape: 'strand',   rot: 28,  dur: 30, delay: -9,  depth: 0.75, hue: 'teal' },
  { top: '84%', left: '48%', size: 210, shape: 'infinity', rot: -4,  dur: 26, delay: -15, depth: 0.26, hue: 'rosa' },
] as const;

const SHAPE_ASPECT: Record<'strand' | 'infinity', number> = {
  strand: 1.36,   // tall organic curve (dnaShape.svg)
  infinity: 0.49, // wide double-lobe (dnaInfinity.svg, 820x400)
};
const SHAPE_URL: Record<'strand' | 'infinity', string> = {
  strand: '/logos/dnaShape.svg',
  infinity: '/logos/dnaInfinity.svg',
};

const HUE_COLOR: Record<'teal' | 'rosa' | 'ocre', string> = {
  teal: '#009C9C',
  rosa: '#E85D75',
  ocre: '#D4925F',
};

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
      <div class="absolute left-1/2 top-[18%] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-teal/25 blur-3xl" />
      <div class="absolute right-[-6rem] top-[40%] h-72 w-72 rounded-full bg-rosa/20 blur-3xl" />
      <div class="absolute bottom-[-4rem] left-[-4rem] h-80 w-80 rounded-full bg-ocre/15 blur-3xl" />

      <img
        src="/logos/axolodaoicon.svg"
        alt=""
        class="hero-parallax-icon absolute left-1/2 top-1/2 h-[16rem] w-[16rem] sm:h-[28rem] sm:w-[28rem] lg:h-[36rem] lg:w-[36rem]"
      />

      {DNA_STRANDS.map((s, i) => (
        <div
          key={i}
          class="hero-parallax-strand absolute"
          style={{
            top: s.top,
            left: s.left,
            width: `${s.size}px`,
            height: `${s.size * SHAPE_ASPECT[s.shape]}px`,
            color: HUE_COLOR[s.hue],
            ['--depth' as any]: s.depth,
            ['--rot0' as any]: `${s.rot}deg`,
            ['--spin-dur' as any]: `${s.dur}s`,
            ['--spin-delay' as any]: `${s.delay}s`,
            ['--mask-url' as any]: `url('${SHAPE_URL[s.shape]}')`,
          }}
        >
          <div class="hero-parallax-spin hero-parallax-dna" />
        </div>
      ))}
    </div>
  );
}
