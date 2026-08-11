// The Pulso AxoloDAO week, as the home rail understands it.
//
// Since W32 the Pulso is four posts a week — Monday maintenance, Tuesday
// AxoloNews, Thursday podcast, Friday axolotl of the week — published from two
// accounts. (The podcast chapter sat on Wednesday until the show itself moved to
// Wednesday 9 PM; its clips cannot exist before the episode airs, so the post
// moved to Thursday. `chapter` values are not day names, so nothing here changed
// but this sentence.) They were briefly grouped into one card per week with a chip strip;
// that traded away the thing each post is actually worth, which is its own image.
// Every chapter now gets a full card of its own, and the rail gained explicit
// navigation to carry the extra length.

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

/** Short chapter label for the card badge, keyed off i18n at render time. */
export const CHAPTER_KEY = (c: Chapter) => `news.chapter.short.${c}` as const;
