// Stylized SVG silhouette tinted with the species accent. Slight per-alias
// rotation/flip is purely cosmetic so identical species don't look mass-printed.
// Treat as a placeholder — real ID photos will replace this once the museum
// provides them.

interface Props {
  alias: string | null | undefined;
  size?: number;
  accent: string;
  dim?: boolean;
}

export default function AjoloteAvatar({ alias, size = 56, accent, dim = false }: Props) {
  const a = alias ?? '';
  const hash = a.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rot = (hash % 11) - 5;
  const flip = hash % 2 === 0;
  const initials = (a || '?')
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      class="relative grid flex-shrink-0 place-items-center overflow-hidden rounded-full border-[1.5px]"
      style={{
        width: size,
        height: size,
        backgroundColor: `${accent}18`,
        borderColor: `${accent}55`,
        opacity: dim ? 0.55 : 1,
      }}
      aria-label={a}
    >
      <svg
        viewBox="0 0 64 64"
        width={size * 0.78}
        height={size * 0.78}
        style={{
          transform: `rotate(${rot}deg) scaleX(${flip ? -1 : 1})`,
          color: accent,
        }}
      >
        <g fill="currentColor" opacity="0.95">
          <g opacity="0.85">
            <path d="M22 18 q-6 -2 -10 -8 q3 6 6 10 z" />
            <path d="M20 22 q-7 0 -12 -4 q4 5 9 7 z" />
            <path d="M21 26 q-7 1 -12 0 q5 3 10 3 z" />
            <path d="M42 18 q6 -2 10 -8 q-3 6 -6 10 z" />
            <path d="M44 22 q7 0 12 -4 q-4 5 -9 7 z" />
            <path d="M43 26 q7 1 12 0 q-5 3 -10 3 z" />
          </g>
          <ellipse cx="32" cy="30" rx="13" ry="10" />
          <path d="M32 38 q-2 10 -8 16 q14 -2 16 -16 z" />
          <path d="M22 36 q-4 2 -5 6 q3 -1 6 -3 z" />
          <path d="M42 36 q4 2 5 6 q-3 -1 -6 -3 z" />
          <circle cx="27" cy="27" r="1.4" fill="#0A1419" opacity="0.7" />
          <circle cx="37" cy="27" r="1.4" fill="#0A1419" opacity="0.7" />
        </g>
      </svg>
      <span
        class="absolute -bottom-0.5 -right-0.5 rounded-full border border-[var(--wq-divider)] bg-[var(--wq-cell-bg)] px-1.5 py-0 font-mono text-[9px] font-bold tracking-[0.02em] text-[var(--wq-ink-muted)]"
      >
        {initials}
      </span>
    </div>
  );
}
