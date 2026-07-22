// Curated roster of AxoloDAO supporters who fund the colony's daily care through
// Xovi remote-adoption subscriptions ("adopción remota"). Two paid tiers:
//   • Aliado   ($249 MXN/mes) — earns a name mention on the site + podcast.
//   • Guardián ($599 MXN/mes) — earns a logo on the site + a dedicated podcast mention.
// This is the source of truth for the "Aliados y Guardianes" home section. Keep it
// in sync with the live Xovi Stripe subscriber roster: add an entry when someone
// subscribes, remove it when they cancel. Guardianes get a `logo` asset; Aliados are
// a text mention (no logo).

export type SupporterTier = 'aliado' | 'guardian';

export interface Supporter {
  /** Full name (Aliado mention) or organization name (Guardián). */
  name: string;
  tier: SupporterTier;
  /** ISO month the subscription started, e.g. '2026-07'. */
  since?: string;
  /** Guardián logo asset (path under /public). Omit for Aliados (text mention). */
  logo?: string;
  /** Optional link (e.g. a Guardián's site behind their logo). */
  url?: string;
}

// The Xovi remote-adoption checkout. Canonical production URL (GA 2026-07-21).
export const XOVI_SUBSCRIBE_URL = 'https://xovi.axolodao.org/subscribe';

export const SUPPORTERS: Supporter[] = [
  { name: 'Javier Ortega Quezada', tier: 'aliado', since: '2026-07' },
];

// Presentation facts per tier (list price in MXN + brand accent). Prices mirror the
// Xovi TIER_CATALOG list price; promos (e.g. the Fundador discount) are handled on
// the Xovi subscribe page, not replicated here, so this can't drift from the charge.
export const TIER_META: Record<SupporterTier, { priceMxn: number }> = {
  aliado: { priceMxn: 249 },
  guardian: { priceMxn: 599 },
};

export const supportersByTier = (tier: SupporterTier): Supporter[] =>
  SUPPORTERS.filter((s) => s.tier === tier);
