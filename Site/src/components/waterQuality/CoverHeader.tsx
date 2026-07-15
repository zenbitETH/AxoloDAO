import type { Locale, Measurement, TestType } from './types';
import { formatShortDate, STRINGS } from './strings';
import WeekNav from './WeekNav';
import ViewToggle from './ViewToggle';

interface Props {
  locale: Locale;
  weekIso: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  // Brand block, moved into the island so it shares one row with the week nav.
  logoSvg: string;
  title: string;
  subtitle: string;
  // Derived per-week classification for the chip under the date.
  testType: TestType;
  // "Solo lunes" data-scope toggle, colocated with the date selector.
  mondaysOnly: boolean;
  onMondaysToggle: (v: boolean) => void;
  // Optional metadata: the freshest measurement of the week
  latest?: Measurement | null;
  summary?: { ok: number; warn: number; alarm: number };
  // The week's podcast episode (number + archive URL) for further water-test context.
  podcastEpisode?: { n: number; url: string } | null;
}

export default function CoverHeader({
  locale,
  weekIso,
  canPrev,
  canNext,
  onPrev,
  onNext,
  logoSvg,
  title,
  subtitle,
  testType,
  mondaysOnly,
  onMondaysToggle,
  latest,
  summary,
  podcastEpisode,
}: Props) {
  const t = STRINGS[locale];
  return (
    <div class="flex flex-col items-center gap-5 py-1 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
      {/* Left — brand block */}
      <div class="flex min-w-0 flex-col items-center text-center sm:items-start sm:text-left">
        <div
          class="wq-logo-mark text-choco dark:text-cream/90"
          aria-label="Biomuseo Xolotlcalli"
          dangerouslySetInnerHTML={{ __html: logoSvg }}
        />
        <h1 class="mt-3 font-display text-2xl text-[var(--wq-ink)] sm:text-3xl">{title}</h1>
        <p class="mt-1 max-w-md font-body text-sm text-[var(--wq-ink)]/70">{subtitle}</p>
      </div>

      {/* Right — week nav, test-type chip, author, legend */}
      <div class="flex flex-shrink-0 flex-col items-center gap-2 sm:items-end">
        <WeekNav
          locale={locale}
          weekIso={weekIso}
          canPrev={canPrev}
          canNext={canNext}
          onPrev={onPrev}
          onNext={onNext}
        />
        <div class="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          <TestTypeChip type={testType} locale={locale} />
          <ViewToggle locale={locale} mondaysOnly={mondaysOnly} onMondaysToggle={onMondaysToggle} />
        </div>
        {latest && (
          <p class="font-body text-[11px] text-[var(--wq-ink)]/55">
            <span class="tabular-nums">
              {t.lastReading}: {formatShortDate(locale, latest.date)}
              {latest.time ? ` · ${latest.time}` : ''}
            </span>
            {latest.authors?.main && (
              <>
                <span class="px-1 text-[var(--wq-ink)]/30">/</span>
                <span class="font-mono text-[var(--wq-ink)]/45">
                  {latest.authors.main}
                  {latest.authors.secondary ? ` · ${latest.authors.secondary}` : ''}
                </span>
              </>
            )}
          </p>
        )}
        {podcastEpisode && (
          <a
            href={podcastEpisode.url}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 font-body text-[11px] text-teal underline decoration-dotted underline-offset-2 transition hover:opacity-80"
          >
            {t.podcastInsight} · Ep. {podcastEpisode.n}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 17L17 7M17 7H8M17 7v9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </a>
        )}
        {summary && summary.ok + summary.warn + summary.alarm > 0 && (
          <div class="flex flex-wrap items-center gap-2 text-[11px] sm:justify-end">
            <SummaryChip count={summary.ok} tone="ok" label={t.statusOk} />
            <SummaryChip count={summary.warn} tone="warn" label={t.statusWarn} />
            <SummaryChip count={summary.alarm} tone="alarm" label={t.statusAlarm} />
          </div>
        )}
      </div>
    </div>
  );
}

const TEST_CHIP: Record<TestType, { key: 'testMantenimiento' | 'testControl' | 'testEmergencia'; cls: string; dot: string }> = {
  mantenimiento: { key: 'testMantenimiento', cls: 'bg-teal/15 text-teal', dot: 'bg-teal' },
  control: { key: 'testControl', cls: 'bg-ocre/20 text-ocre', dot: 'bg-ocre' },
  emergencia: { key: 'testEmergencia', cls: 'bg-rosa/15 text-rosa', dot: 'bg-rosa wq-pulse' },
};

function TestTypeChip({ type, locale }: { type: TestType; locale: Locale }) {
  const t = STRINGS[locale];
  const cfg = TEST_CHIP[type];
  return (
    <span
      class={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-display text-xs font-semibold uppercase tracking-wide ${cfg.cls}`}
    >
      <span class={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
      {t[cfg.key]}
    </span>
  );
}

function SummaryChip({
  count,
  tone,
  label,
}: {
  count: number;
  tone: 'ok' | 'warn' | 'alarm';
  label: string;
}) {
  if (count === 0) {
    return (
      <span class="inline-flex items-center gap-1 rounded-full bg-[var(--wq-ink)]/5 px-2 py-0.5 font-body text-[var(--wq-ink)]/40 tabular-nums">
        <span class="inline-block h-1.5 w-1.5 rounded-full bg-current/30" aria-hidden="true" />
        0 {label.toLowerCase()}
      </span>
    );
  }
  const dot =
    tone === 'ok' ? 'bg-emerald-500'
    : tone === 'warn' ? 'bg-amber-400'
    : 'bg-rose-500 wq-pulse';
  return (
    <span class="inline-flex items-center gap-1.5 rounded-full bg-[var(--wq-ink)]/6 px-2.5 py-0.5 font-body text-[var(--wq-ink)]/80 tabular-nums">
      <span class={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      <span class="font-semibold">{count}</span>
      <span class="text-[var(--wq-ink)]/55">{label.toLowerCase()}</span>
    </span>
  );
}
