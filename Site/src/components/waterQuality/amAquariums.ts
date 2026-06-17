// The AM station is one unified recirculating system physically made of four
// aquariums (AM1–AM4). Water quality is measured once for the whole "AM" system,
// but each aquarium houses a distinct set of axolotls and gets its own anchor +
// printable QR. Ejemplar membership is derived from the canonical `pecera` value
// (see scripts/data-ajolotes.mjs → AM_PECERA); `id` matches that value exactly.
// `anchor` is the URL hash used by QR deep-links (#AM1 … #AM4) and must be DOM-id
// safe (no spaces).
//
// The larvae moved into AM3 on 2026-06-15, so there is no longer a standalone
// larvae aquarium in this occupancy list. The larvae water is still logged and
// charted separately as the "AM Larvas" water system (see data-water.mjs) — it
// just no longer has its own occupancy tile here.

export interface AmAquarium {
  id: string; // canonical pecera value, e.g. "AM1" … "AM4"
  anchor: string; // URL hash, e.g. "AM1" … "AM4"
  label: string; // short display label
  volumeL: number | null;
}

export const AM_AQUARIUMS: readonly AmAquarium[] = [
  // AM1 mirrors the AD tank's capacity (252 L) — it's a large aquarium physically
  // similar to AD (confirmed against Descripción de sistemas, nominal 252 L).
  { id: 'AM1', anchor: 'AM1', label: 'AM1', volumeL: 252 },
  { id: 'AM2', anchor: 'AM2', label: 'AM2', volumeL: 67 },
  // AM3 now houses the two A. mexicanum larvae (moved 2026-06-15).
  { id: 'AM3', anchor: 'AM3', label: 'AM3', volumeL: 67 },
  { id: 'AM4', anchor: 'AM4', label: 'AM4', volumeL: 67 },
];

// Anchor → aquarium, for resolving a QR/hash deep-link back to its aquarium.
export const AM_AQUARIUM_BY_ANCHOR: Record<string, AmAquarium> = Object.fromEntries(
  AM_AQUARIUMS.map((a) => [a.anchor, a]),
);
