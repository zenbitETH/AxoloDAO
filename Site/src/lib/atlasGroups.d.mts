export declare const GRUPOS: string[];
export declare const CLAVE_DE_GRUPO: Record<string, string>;
export declare function agruparCapas<T extends { grupo: string }>(capas: T[]): { grupo: string; capas: T[] }[];
