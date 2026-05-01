// Photo + silhouette fallback. Used by both the gallery card and the modal
// hero so the fallback contract is identical. Renders a square frame with
// rounded corners; size is set by the caller (width/height props) or by the
// parent's CSS (when fill={true}).

import AjoloteAvatar from './AjoloteAvatar';
import { ejemplarPhotoUrl } from './photos';

interface Props {
  alias: string;
  accent: string;
  // Tile-mode dimensions (square). Default 56 to match the legacy avatar size.
  size?: number;
  // Fill-mode: photo fills its parent (e.g. for the photo-on-top card hero).
  // The caller controls aspect ratio + container size; parent must be
  // position: relative.
  fill?: boolean;
}

export default function EjemplarPhoto({ alias, accent, size = 56, fill = false }: Props) {
  const url = ejemplarPhotoUrl(alias);

  if (fill) {
    if (!url) {
      return (
        <div
          class="absolute inset-0 grid place-items-center"
          style={{ backgroundColor: `${accent}10` }}
          aria-label={alias}
        >
          {/* Larger silhouette via AjoloteAvatar, sized to fill */}
          <AjoloteAvatar alias={alias} accent={accent} size={Math.min(180, 180)} />
        </div>
      );
    }
    return (
      <img
        src={url}
        alt={alias}
        loading="lazy"
        decoding="async"
        class="absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  // Tile mode (small, used in modal eyebrow / table)
  if (!url) {
    return <AjoloteAvatar alias={alias} accent={accent} size={size} />;
  }
  return (
    <img
      src={url}
      alt={alias}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      class="rounded-full border-[1.5px] object-cover"
      style={{ borderColor: `${accent}55`, width: size, height: size }}
    />
  );
}
