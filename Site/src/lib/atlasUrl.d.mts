export const CAPAS: string[];
export const CAPA_POR_OMISION: string;
export function leerUrl(search: string, validos: { slugs: string[]; isos: string[] }): { capa: string; especie: string | null; estado: string | null };
export function escribirUrl(search: string, estado: { capa?: string | null; especie?: string | null; estado?: string | null }): string;
export function urlDelAtlas(o: { pathname: string; search: string; hash?: string; atlas?: string; especieInicial?: string | null; propia: boolean; capa?: string | null; especie: string | null; estado: string | null }): { url: string; propia: boolean };
