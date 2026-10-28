// The home page's figures: the public copy of its two inventories (scripts/copiar-inventario.mjs writes it) and the box-office count.
// No figure is typed in a string: a caption carries {placeholders} and lib/cifrasHome.mjs fills them, formatted for the page's locale.
// A caption with a placeholder that has no figure is not shown.
import cadena from '@/data/inventario/inventario-cadena-xolotlcalli.json';
import atlas from '@/data/inventario/inventario-atlas.json';
import taquilla from '@/data/inventario/taquilla-home.json';
import { cifrasDe, formatear, llenar as llenarCon } from '@/lib/cifrasHome.mjs';

export { cadena, atlas };

/** The values the home captions may use, by placeholder name. */
export const CIFRAS = cifrasDe({ cadena, atlas, taquilla });

/** A caption with its {placeholders} filled, or null if one has no figure (then the caption is not shown). */
export const llenar = (texto: string, locale: string): string | null => llenarCon(texto, locale, CIFRAS);

/** One figure as the page shows it in `locale`. */
export const cifra = (clave: keyof typeof CIFRAS, locale: string): string => formatear(CIFRAS[clave], locale);

/** A 32-byte hash, shortened for reading; the full one stays in the explorer link. */
export const corto = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;
