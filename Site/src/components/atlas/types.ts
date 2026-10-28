import type { Locale } from '@/i18n/strings';

export type { Locale };
export type Fc = { type: string; features: any[] };
export type Status = 'idle' | 'loading' | 'ready' | 'error';
export type Snap = 'peek' | 'half' | 'full';
/** What colours the states: nothing (default), the richness of species, or the facilities-per-state metric. One at a time. */
export type Colorear = 'ninguno' | 'riqueza' | 'metrica';

/** A source as the sheet cites it: a short citation (first surname and year), its full title, and the page. */
export interface Fte { cite: string; title: string | null; page: string | null }
/** The sheet data of a species, from Site & Data's phase-0 bundle (taxon_traits, taxon_profiles, taxon_interactions) and the committed morphometrics. */
export interface Ficha {
  desc: Record<string, string> | null;
  diet: { es: string; review: string; src: string | null } | null;
  dietCaptive: { es: string; review: string; src: string | null } | null;
  habitat: { code: string; label: Record<string, string> | null; src: Fte[] }[];
  elevation: { items: { min: number | null; max: number | null; note: string | null; src: Fte }[] } | null;
  lifeForm: { values: Record<string, Fte[]> } | null;
  regeneration: { src: Fte[] } | null;
  threat: { code: string; label: Record<string, string> | null; src: Fte[] }[];
  cites: { value: string; src: Fte; note: string | null } | null;
  prey: { key: number; name: Record<string, string>; contexts: string[]; /** the actual prey names under the group, wild and captive (when the bundle has them) */ nombres?: { wild?: { es: string; en: string; pt: string }[]; captive?: { es: string; en: string; pt: string }[] } }[];
  medidas: { measure: string; stage?: string; sex?: string; mean?: number; min?: number; max?: number; n?: number; uom: string; source: string; note?: string }[];
}
export interface Alimentacion { wild: string | null; captive: string | null; draft: boolean; source: string | null }

/** One card of public/atlas/layers/manifest.json, in the page's language. */
export interface CardLayer {
  id: string;
  /** the HUD group the card belongs to (src/lib/atlasGroups.mjs) */
  grupo: string;
  kind: 'choropleth' | 'points' | 'live' | 'localities' | 'context';
  flag: 'nc' | null;
  lazy: boolean;
  download: false;
  title: string;
  note: string;
  aviso?: string;
  source: string;
  licenceLabel: string;
  licenceId: string;
  attribution?: string;
  lastDataText: string;
  retrievedAt: string;
}

/** A species as the index, the detail and the map read it: the snapshot's taxon plus what the site knows of it. */
export interface Item {
  slug: string;
  t: any;
  accent: string;
  common: string[];
  hasPage: boolean;
  /** the site's own curated text for the species (src/content/species), where it has one */
  descripcion?: string;
  alimentacion?: string;
  iucn?: string;
  countries: string[];
}

/** The full-cycle organization card (behind a flag that is OFF): what Site & Data's record carries. No specimen, health or IRC data. */
export interface Ciclo { nombre: string; registro: string; cierre: string; ens: string; enlace: string; municipio: string; estado: string; tipo: string; /** the id of its row in the facilities layer */ facilidad: string }
