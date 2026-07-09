import { getCollection } from 'astro:content';
import episodesRaw from '@/data/podcast-episodes.json';

const PLAYLIST_ID = 'PLv7U-stID9gtb-Tx_JKIXBWPdKl1spBnS';

// Podcast archive (YouTube playlist) — mirrors projects/axolodao-podcast.yaml `url`. Used as the
// fallback when a specific episode isn't in podcast-episodes.json yet.
export const PODCAST_PLAYLIST_URL = `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`;

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

// Per-episode deep links (episode number -> watch URL within the playlist), from the committed
// podcast-episodes.json (generated from the YouTube playlist via tools/youtube). Any episode not
// listed falls back to the playlist URL at the call site.
export function episodeUrls(): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [n, videoId] of Object.entries(episodesRaw as Record<string, string>)) {
    out[Number(n)] = `https://www.youtube.com/watch?v=${videoId}&list=${PLAYLIST_ID}`;
  }
  return out;
}
