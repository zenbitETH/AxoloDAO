import { useEffect, useRef } from 'preact/hooks';

// The DNA shapes live in the side gutters, outside the hero's text columns (review, 22-oct: they covered the subtitle, the problem/solution
// blocks and the sections below); the logo alone floats in the centre, behind the title, at low opacity. They only show on screens wide enough to have gutters, and the whole stage fades once the first
// section after the hero (#atlas) comes into view.
const DNA_STRANDS = [
  { top: '10%', left: '1.5%', size: 150, shape: 'strand',   rot: -14, dur: 22, delay: 0,   depth: 0.32, hue: 'teal' },
  { top: '14%', left: '87%',  size: 170, shape: 'infinity', rot: 10,  dur: 28, delay: -6,  depth: 0.55, hue: 'rosa' },
  { top: '50%', left: '2%',   size: 130, shape: 'strand',   rot: 6,   dur: 34, delay: -12, depth: 0.45, hue: 'ocre' },
  { top: '62%', left: '88%',  size: 150, shape: 'infinity', rot: -22, dur: 24, delay: -3,  depth: 0.65, hue: 'teal' },
  { top: '38%', left: '93%',  size: 80,  shape: 'strand',   rot: 28,  dur: 30, delay: -9,  depth: 0.75, hue: 'teal' },
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

    const species = document.getElementById('atlas') ?? document.getElementById('species');
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

      {/* the logo floats in the centre, behind the hero title (23-oct), faint enough for the title to keep its contrast */}
      <img
        src="/logos/axolodaoicon.svg"
        alt=""
        class="hero-parallax-icon absolute left-1/2 top-[30%] h-[20rem] w-[20rem] sm:h-[30rem] sm:w-[30rem]"
      />

      {DNA_STRANDS.map((s, i) => (
        <div
          key={i}
          class="hero-parallax-strand absolute hidden xl:block"
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
