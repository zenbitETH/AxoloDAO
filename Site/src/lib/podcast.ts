import { getCollection } from 'astro:content';

// Podcast archive (YouTube playlist) — mirrors projects/axolodao-podcast.yaml `url`.
export const PODCAST_PLAYLIST_URL =
  'https://www.youtube.com/playlist?list=PLv7U-stID9gtb-Tx_JKIXBWPdKl1spBnS';

// The weekly water tests are discussed on the podcast. Pulso posts carry both `weekNumber` and
// `podcastNumber`, so each water week can point at its episode. Returns a map of ISO/Pulso week
// number -> podcast episode number (built from real content, so it stays correct if the cadence
// ever skips a week; weeks past the latest published Pulso are extrapolated client-side).
export async function podcastByWeek(): Promise<Record<number, number>> {
  const news = await getCollection('news');
  const byWeek: Record<number, number> = {};
  for (const n of news) {
    const d = n.data as { weekNumber?: number; podcastNumber?: number };
    if (d.weekNumber != null && d.podcastNumber != null) byWeek[d.weekNumber] = d.podcastNumber;
  }
  return byWeek;
}
