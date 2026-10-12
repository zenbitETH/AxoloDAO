import closureRaw from '@/data/closure.json';
import { type Locale, t } from '@/i18n/strings';
import { closureCopyViolations } from '@/lib/closure-copy';

// The museum closed for good on `closedOn`. The notice speaks in the past tense and names no reopening,
// no works and no quarantine; nothing here expires by date, and `active` false removes the notice.
export type Closure = {
  active: boolean;
  closedOn: string; // last open day was the one before; museum-local YYYY-MM-DD
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function parse(raw: unknown): Closure {
  const c = raw as Closure;
  if (!ISO_DAY.test(c.closedOn)) {
    throw new Error(`closure.json: closedOn must be YYYY-MM-DD (got ${c.closedOn})`);
  }
  return c;
}

export const CLOSURE: Closure = parse(closureRaw);

// While the museum is closed no page places an axolotl in a museum tank.
export const ANIMALS_AWAY_FROM_MUSEUM = CLOSURE.active;

// The closure copy is checked at build time: it fails on any reopening wording, works, partner event,
// quarantine, vague future or a date other than the closing day (the same rules as scripts/test-closure-copy.mjs).
export function assertClosureCopyIsPast(locale: Locale): void {
  for (const key of ['closure.banner.text', 'closure.banner.link'] as const) {
    const text = t(locale, key);
    const bad = closureCopyViolations(text, CLOSURE.closedOn);
    if (bad.length) {
      throw new Error(`${key} (${locale}) is not closure copy in the past tense: ${bad.join('; ')} in "${text}"`);
    }
  }
}
