// Photo asset lookup. Photos live in Site/public/photos/ajolotes/<slug>.webp
// (or .jpg). The manifest avoids runtime 404 probing — when a new photo is
// dropped into the folder, add the slug here and the card picks it up. Until
// then, the explorer falls back to the stylized <AjoloteAvatar /> silhouette.

const PHOTO_BASE = '/photos/ajolotes';

// Slugs of available photos. Keep in sync with files in
// Site/public/photos/ajolotes/ — see that folder's README.md.
const AVAILABLE_PHOTOS: Record<string, 'webp' | 'jpg'> = {
  'andersoni-1': 'webp',
  panchita: 'webp',
  'tamal-de-dulce': 'webp',
  tascalate: 'webp',
  martin: 'webp',
  limon: 'webp',
  goldy: 'webp',
  chocorrol: 'webp',
  parda: 'webp',
  leucistica: 'webp',
  'la-negra': 'webp',
  'pardo-macho': 'webp',
  romulo: 'webp',
  remo: 'webp',
  patito: 'webp',
  'larva-2': 'webp',
};

export function aliasSlug(alias: string): string {
  return alias
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ejemplarPhotoUrl(alias: string | null | undefined): string | null {
  if (!alias) return null;
  const slug = aliasSlug(alias);
  const ext = AVAILABLE_PHOTOS[slug];
  if (!ext) return null;
  return `${PHOTO_BASE}/${slug}.${ext}`;
}
