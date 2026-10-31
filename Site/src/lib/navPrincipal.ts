// The site's three doors, in this order, for the header and the hero alike: the atlas here, and Xovi and its data table on Xovi's own domain.
import { type Locale, t, localePath } from '@/i18n/strings';

export const XOVI_URL = 'https://xovi.axolodao.org';

export interface EnlacePrincipal { href: string; label: string; external?: boolean; clave: 'atlas' | 'xovi' | 'datos' }

export function enlacesPrincipales(locale: Locale): EnlacePrincipal[] {
  return [
    { clave: 'atlas', href: localePath(locale, 'atlas/'), label: t(locale, 'nav.species') },
    { clave: 'xovi', href: XOVI_URL, label: 'Xovi', external: true },
    { clave: 'datos', href: `${XOVI_URL}/datos`, label: t(locale, 'nav.datos'), external: true },
  ];
}
