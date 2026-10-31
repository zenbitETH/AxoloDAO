/**
 * El modelo tentativo de lo que la mesa produce: hipótesis, pistas, cruces, verificaciones y votos. Hoy vive en el navegador
 * (localStorage); el día que la mesa viva en Xovi, el mismo registro va a su base y sigue el camino de los clips: la persona lo
 * envía firmado, un verificador aprobado por Zenbit lo aprueba o lo rechaza, y sólo entonces otros detectives votan. Los campos
 * están pensados para ese viaje: nada personal más allá de la dirección que firma, todo referido por id estable (alias, tanque,
 * id de clip, uid de ancla). Las rutas de uso que lo justifican están en rutas-y-datos.md, junto a este archivo.
 */
import { fechaDe } from './analisis';
import type { Acto } from './puntos';

/** Una pista: un hecho del registro que la persona señala. `ref` dice dónde vive, para poder volver a él. */
export interface Pista {
  t: number;                       // ms del evento
  tipo: 'bio' | 'alim' | 'med' | 'muerte' | 'clip' | 'agua' | 'equipo' | 'ancla' | 'hipotesis';
  titulo: string;
  ref: { ajolote?: string; tanque?: string; clip?: number; ancla?: string; hipotesis?: string; fuente: string };   // `hipotesis`: citar otra cuenta como reuso
}

/** Un cruce de dos variables en una ventana, con lo que la mesa calculó: queda como evidencia, no como prueba. */
export interface Cruce {
  a: string; b: string;            // ids de variable: «agua:AA:nh3», «peso:Panchita»
  ventana: [number, number];
  rho: number | null; n: number;   // mismo día
  mejor: { lag: number; rho: number; n: number } | null;   // mayor |ρ| con n ≥ 6, desfase en días
  metodo: 'spearman-diario-v1';
}

/**
 * Como un clip: `borrador` (sólo en el navegador de quien la escribe) → `pendiente` (enviada y firmada por su autor; la ven él y
 * los verificadores) → `verificada` o `rechazada` (por un verificador que no es el autor). Sólo una verificada es pública y votable.
 */
export type EstadoHipotesis = 'borrador' | 'pendiente' | 'verificada' | 'rechazada';

/** Los motivos de rechazo son una lista cerrada, como en los clips: un motivo libre no se publica. */
export const MOTIVOS_RECHAZO = {
  'sin-pistas': 'Las pistas no sostienen lo que afirma',
  'fuera-de-ventana': 'Lo que cita cae fuera de su ventana',
  'datos-personales': 'Nombra a personas',
  'duplicada': 'Repite una hipótesis ya verificada',
  'no-verificable': 'No se puede contrastar con el registro',
} as const;

export interface Verificacion {
  decision: 'verificada' | 'rechazada';
  verificador: `0x${string}`; ens: string | null;
  t: number;
  motivo: keyof typeof MOTIVOS_RECHAZO | null;   // sólo al rechazar
  uid: string | null;              // la atestación de la decisión, cuando exista
}

/** Un voto de un detective sobre una hipótesis verificada. Uno por detective: votar de nuevo lo reemplaza. */
export interface Voto {
  detective: `0x${string}`;
  valor: 1 | -1;
  t: number;
  contra: string | null;           // -1 exige el id de la contrahipótesis de ese mismo detective; +1 lo deja en null
}

export interface Hipotesis {
  id: string;                      // uuid; al verificarse, el uid de la atestación lo acompaña como referencia pública
  v: 1;
  creada: number; editada: number;
  autor: { direccion: `0x${string}` | null; ens: string | null; red: 'mainnet' | 'sepolia' | null };
  texto: string;
  sospechosos: string[];           // vocabulario cerrado del caso (El Amoníaco, El Termómetro…)
  sujetos: { ajolotes: string[]; estaciones: string[] };
  ventana: [number, number];
  variables: string[];             // las series activas: «agua:<tanque>:<param>» y las cruzadas
  cruce: Cruce | null;
  pistas: Pista[];
  contra: string | null;           // si es una contrahipótesis, el id de la hipótesis que disputa
  clips: number[];                 // clips de Xovi que la citan; cada clip guarda el id de vuelta
  estado: EstadoHipotesis;
  envio: { firma: string; t: number } | null;      // la firma EIP-712 del autor al enviarla a verificación
  verificacion: Verificacion | null;
  votos: Voto[];
}

export { cuentaVotos, revisarVoto, votar } from './votos';

const CLAVE = 'mesa-hipotesis-v1';
/** Lo guardado antes de verificación y votos se lee como borrador sin votos. */
const completar = (h: any): Hipotesis => ({ contra: null, clips: [], envio: null, verificacion: null, votos: [], ...h,
  estado: ['borrador', 'pendiente', 'verificada', 'rechazada'].includes(h.estado) ? h.estado : 'borrador' });
export function leerHipotesis(): Hipotesis[] {
  try { const v = JSON.parse(localStorage.getItem(CLAVE) ?? '[]'); return Array.isArray(v) ? v.map(completar) : []; } catch { return []; }
}
export function guardarHipotesis(h: Hipotesis[]) {
  try { localStorage.setItem(CLAVE, JSON.stringify(h)); } catch { /* sin almacenamiento: queda en memoria */ }
}
export const nombreHipotesis = (h: Hipotesis) => `${h.sospechosos.join(', ') || 'Sin sospechoso'} · ${fechaDe(h.ventana[0])} → ${fechaDe(h.ventana[1])}`;
export const nuevoId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
export const ESTADO_TXT: Record<EstadoHipotesis, string> = {
  borrador: 'Borrador · sólo en este navegador', pendiente: 'Pendiente de verificación', verificada: 'Verificada', rechazada: 'Rechazada',
};

/** Las hipótesis verificadas como actos de la tabla de puntos; lo que citan como pista (otras hipótesis) es su reuso. */
export function actosDeHipotesis(hs: Hipotesis[]): Acto[] {
  return hs.filter((h) => h.estado === 'verificada' && h.autor.direccion).map((h) => ({
    id: h.id, tipo: 'hipotesis' as const, autor: h.autor.direccion!, t: h.verificacion?.t ?? h.creada,
    celda: `hipotesis:${[...h.sujetos.ajolotes].sort().join('+')}`,
    cita: h.pistas.map((q) => q.ref.hipotesis).filter((x): x is string => !!x),
  }));
}
