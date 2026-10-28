export declare const CELDA: number;
export declare function claseDeEvidencia(evidencia: string): 'strong' | 'weak' | 'other';
export declare function acento(slug: string): string;
export type Presencia = Record<string, Record<string, string>>;
export declare function presenciaPorEspecie(snapshot: { presencia?: Record<string, [string, string, ...unknown[]][]> } | null | undefined): Presencia;
export declare function riqueza(presencia: Presencia): { fuerte: Record<string, number>; debil: Record<string, number> };
export declare function especiesParaUI(snapshot: any, delSitio?: any[], locale?: string): any[];
export declare function celdasDe(fc: any, slug: string): [number, number][];
export declare function componentes(celdas: [number, number][]): [number, number][][];
export declare function contorno(grupo: [number, number][]): number[][][];
export declare function localidadesParaMapa(fc: any): { type: 'FeatureCollection'; features: any[] };
export declare function extension(cajas: number[][], localidades?: { features: any[] } | null): [[number, number], [number, number]] | null;
export declare function cajasDeUnidades(admin1: any): Record<string, number[]>;
export declare function validarLocalidades(fc: unknown): string[];

export declare function puntosDeLocalidades(fc: any): { type: 'FeatureCollection'; features: any[] };
export declare function fuentesDePuntos(fc: any): Record<string, { clave: string; estado: string | null; corta: string; completa: string; licencia: string | null; sitio: boolean; pagina: number | null; corroborado: null }[]>;
