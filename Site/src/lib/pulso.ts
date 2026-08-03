// The Pulso AxoloDAO week, as the home rail understands it.
//
// Until W31 the Pulso was one Instagram post a week and the rail was a flat list
// of them. Since W32 it is four — Monday maintenance, Tuesday AxoloNews,
// Wednesday podcast, Friday axolotl of the week — published from two different
// accounts. A flat rail would advance four times faster and "Pulso #32" would
// stop naming anything, so the rail groups by week and the chapters become chips
// inside the week's card.

export type Chapter = 'semanal' | 'lunes' | 'axolonews' | 'podcast' | 'ajolote';
export type Author = 'zenbit' | 'xolotlcalli' | 'ndali';

export interface NewsItem {
  slug: string;
  author: Author;
  url: string;
  image: string;
  video?: string;
  poster?: string;
  caption: { es: string; en: string; pt: string };
  publishedAt: string;
  weekNumber?: number;
  podcastNumber?: number;
  chapter: Chapter;
}

/** The four weekly chapters in publishing order. `semanal` is not one of them —
 *  it is the archive format, and a `semanal` week renders without a chip strip. */
export const CHAPTER_ORDER: readonly Chapter[] = ['lunes', 'axolonews', 'podcast', 'ajolote'];

/**
 * Which account publishes which chapter, per
 * `context/plans/2026-07-30-pulso-distribucion-reels.md` §1: each chapter goes to
 * the account that did that work, so Xolotlcalli speaks for the animals and the
 * water and Zenbit for the project, the science and the culture.
 *
 * This is the DEFAULT, not the record. A post's own `author` still wins — a
 * collab can differ, and what actually happened outranks what was planned.
 */
export const CHAPTER_AUTHOR: Record<Chapter, Author> = {
  semanal: 'zenbit',
  lunes: 'xolotlcalli',
  axolonews: 'zenbit',
  podcast: 'zenbit',
  ajolote: 'xolotlcalli',
};

/** Chip colours. `podcast` carries the amber/ink identity the podcast cover, the
 *  story teaser and both chapter videos already wear, so the rail echoes the post
 *  it links to instead of inventing a fifth palette. */
export const CHAPTER_ACCENT: Record<Chapter, string> = {
  semanal: 'bg-marfil/90 text-dark-navy',
  lunes: 'bg-teal/90 text-marfil',
  axolonews: 'bg-marfil/90 text-dark-navy',
  podcast: 'bg-[#F8C471] text-[#1B333F]',
  ajolote: 'bg-rosa/90 text-marfil',
};

export interface PulsoWeek {
  /** Stable key — `weekNumber` alone collides across years. */
  key: string;
  weekNumber?: number;
  year: number;
  /** Newest chapter of the week: the card's image and its main link. */
  hero: NewsItem;
  /** Every chapter published this week, in CHAPTER_ORDER. */
  chapters: NewsItem[];
  /** Newest publishedAt in the group — what the rail sorts on. */
  latest: string;
}

const yearOf = (iso: string) => Number(iso.slice(0, 4));

/**
 * Group posts into weeks, newest week first, chapters in publishing order.
 *
 * A week has no `publishedAt` of its own — its chapters span Monday to Friday —
 * so it sorts on the newest chapter it holds. That is also what makes a
 * mid-week group behave: on a Monday the week has exactly one chapter and sorts
 * to the front on that chapter's date, which is correct.
 *
 * Posts with no `weekNumber` (there are none today, but the field is optional)
 * each become their own single-chapter group rather than being dropped.
 */
export function groupByWeek(items: NewsItem[]): PulsoWeek[] {
  const groups = new Map<string, NewsItem[]>();
  for (const it of items) {
    const key =
      it.weekNumber === undefined
        ? `solo:${it.slug}`
        : `${yearOf(it.publishedAt)}-W${String(it.weekNumber).padStart(2, '0')}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(it);
    else groups.set(key, [it]);
  }

  const rank = (c: Chapter) => {
    const i = CHAPTER_ORDER.indexOf(c);
    return i === -1 ? CHAPTER_ORDER.length : i;
  };

  return [...groups.entries()]
    .map(([key, group]) => {
      const chapters = [...group].sort((a, b) => rank(a.chapter) - rank(b.chapter));
      // Newest by date; ties break on publishing order so the result is stable.
      const hero = [...group].sort(
        (a, b) =>
          (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0) ||
          rank(b.chapter) - rank(a.chapter),
      )[0];
      const latest = group.reduce((m, x) => (x.publishedAt > m ? x.publishedAt : m), group[0].publishedAt);
      return {
        key,
        weekNumber: hero.weekNumber,
        year: yearOf(latest),
        hero,
        chapters,
        latest,
      };
    })
    .sort((a, b) => (a.latest < b.latest ? 1 : a.latest > b.latest ? -1 : 0));
}
