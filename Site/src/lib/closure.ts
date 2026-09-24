import closureRaw from '@/data/closure.json';
import { type Locale, t } from '@/i18n/strings';
import { monthLabel } from '@/components/waterQuality/strings';

// The museum's closure lives in one data file so the 14 October confirm-or-move edit is a
// single change. The field names mirror Xovi's CLOSURE constant (lib/livestream/closure.ts)
// so both products speak about the same dates with the same words.
//
// Nothing here expires by date: the site is static, and a reopening that slips must never
// make the site look open on its own. Two switches, set by hand: `active` false removes the
// closure notice, `quarantine` false removes the quarantine pill; the banner goes when both
// are false, and the stations list animals again only then.
export type Closure = {
  active: boolean;
  closedOn: string; // first closed day, museum-local YYYY-MM-DD
  reopensOn: string; // planned reopening day, museum-local YYYY-MM-DD
  reopensTentative: boolean; // true until Xolotlcalli confirms the date
  quarantine: boolean; // all the axolotls are in quarantine outside the museum
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function parse(raw: unknown): Closure {
  const c = raw as Closure;
  if (!ISO_DAY.test(c.closedOn) || !ISO_DAY.test(c.reopensOn)) {
    throw new Error(`closure.json: dates must be YYYY-MM-DD (got ${c.closedOn}, ${c.reopensOn})`);
  }
  if (c.closedOn >= c.reopensOn) {
    throw new Error(`closure.json: closedOn ${c.closedOn} is not before reopensOn ${c.reopensOn}`);
  }
  return c;
}

export const CLOSURE: Closure = parse(closureRaw);

// While the museum is closed, or while the animals are in quarantine outside it, no page
// places an axolotl in a museum tank. The pill and the pages read the same rule.
export const ANIMALS_AWAY_FROM_MUSEUM = CLOSURE.active || CLOSURE.quarantine;

// The banner copy is carried verbatim from the comms strings, dates included, so a moved
// date needs both files. This fails the build when closure.json and the copy disagree
// about the reopening day, instead of publishing two dates.
export function assertBannerMatchesDates(locale: Locale): void {
  const text = t(locale, 'closure.banner.text');
  const [, m, d] = CLOSURE.reopensOn.split('-').map(Number);
  const month = monthLabel(locale, m - 1);
  const mentionsDay = new RegExp(`\\b${d}\\b`).test(text);
  if (!mentionsDay || !text.toLowerCase().includes(month.toLowerCase())) {
    throw new Error(
      `closure.banner.text (${locale}) does not name the reopening day ${CLOSURE.reopensOn}: "${text}"`,
    );
  }
}
