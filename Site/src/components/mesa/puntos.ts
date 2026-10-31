/**
 * Los puntos de la tabla de detectives (propuesta del 29-oct, por aprobar). Sólo cuenta lo verificado; los votos desempatan.
 * Sin dependencias de ejecución, como votos.ts, para que scripts/test-mesa-puntos.mjs y la simulación lo corran con node.
 *
 * Puntos de un acto = base × escasez + reuso + apoyo
 *   escasez  = 1 / n, con n el lugar del acto en su celda (el primer clip de una conducta de un ajolote en una semana vale
 *              completo, el segundo la mitad…); llenar una celda rinde H(N) ≈ ln N, no N
 *   reuso    = R[tipo] · log2(1 + k), con k las personas distintas, no su autor, cuyas hipótesis verificadas lo citan; una
 *              persona a la que el autor también cita no cuenta: sólo el reuso independiente suma (un anillo que se cita
 *              entre sí no gana nada; la simulación lo mide)
 *   apoyo    = A · escasez, para un clip que sostiene la hipótesis verificada de otra persona
 * Los reclutados suman B cada uno, con un tope de TOPE_RECLUTADOS por detective cada 30 días.
 */

export type TipoActo = 'hipotesis' | 'clip' | 'aporte' | 'conjunto' | 'reclutado';

/** Un hecho verificado de un detective. `celda` agrupa lo que compite por la misma escasez. */
export interface Acto {
  id: string;
  tipo: TipoActo;
  autor: string;
  t: number;
  celda: string;          // «clip:<ajolote>:<conducta>:<semana>», «aporte:<sujeto>:<campo>», «conjunto:<organización>:<semana>»…
  cita?: string[];        // ids de actos que esta hipótesis usa como pistas
  apoya?: string;         // un clip: la hipótesis que sostiene
}

export const BASE: Record<TipoActo, number> = { hipotesis: 10, clip: 3, aporte: 2, conjunto: 6, reclutado: 5 };
export const REUSO: Partial<Record<TipoActo, number>> = { hipotesis: 8, conjunto: 6, aporte: 3, clip: 2 };
export const APOYO = 2;
export const TOPE_RECLUTADOS = 3;
const MES = 30 * 864e5;
/** La escasez se aplica a los datos; dos hipótesis sobre la misma baja compiten por explicarla y valen lo mismo. */
const CON_ESCASEZ: TipoActo[] = ['clip', 'aporte', 'conjunto'];

export interface Desglose { base: number; reuso: number; apoyo: number; reclutados: number; total: number }

const baja = (s: string) => s.toLowerCase();

export function puntosPorActo(actos: Acto[]): Map<string, Desglose> {
  const porId = new Map(actos.map((a) => [a.id, a]));
  // el lugar de cada acto en su celda, por tiempo y luego por id
  const lugar = new Map<string, number>();
  const celdas = new Map<string, Acto[]>();
  for (const a of actos) if (CON_ESCASEZ.includes(a.tipo)) celdas.set(a.celda, [...(celdas.get(a.celda) ?? []), a]);
  for (const lista of celdas.values()) lista.sort((x, y) => x.t - y.t || x.id.localeCompare(y.id)).forEach((a, i) => lugar.set(a.id, i + 1));
  // a quién cita cada persona, y quiénes citan cada acto: personas distintas de su autor, sólo desde hipótesis
  const citaA = new Map<string, Set<string>>();
  for (const h of actos) if (h.tipo === 'hipotesis') for (const c of h.cita ?? []) {
    const citado = porId.get(c);
    if (citado) citaA.set(baja(h.autor), (citaA.get(baja(h.autor)) ?? new Set()).add(baja(citado.autor)));
  }
  const citan = new Map<string, Set<string>>();
  for (const h of actos) if (h.tipo === 'hipotesis') for (const c of new Set(h.cita ?? [])) {
    const citado = porId.get(c);
    if (!citado || baja(citado.autor) === baja(h.autor)) continue;
    if (citaA.get(baja(citado.autor))?.has(baja(h.autor))) continue;   // recíproco: no es reuso independiente
    citan.set(c, (citan.get(c) ?? new Set()).add(baja(h.autor)));
  }
  // reclutados: los primeros TOPE_RECLUTADOS de cada ventana de 30 días desde el primero contado
  const contados = new Set<string>();
  const porReclutador = new Map<string, Acto[]>();
  for (const a of actos) if (a.tipo === 'reclutado') porReclutador.set(baja(a.autor), [...(porReclutador.get(baja(a.autor)) ?? []), a]);
  for (const lista of porReclutador.values()) {
    lista.sort((x, y) => x.t - y.t || x.id.localeCompare(y.id));
    const tomados: number[] = [];
    for (const a of lista) if (tomados.filter((t) => a.t - t < MES).length < TOPE_RECLUTADOS) { tomados.push(a.t); contados.add(a.id); }
  }
  const out = new Map<string, Desglose>();
  for (const a of actos) {
    const escasez = CON_ESCASEZ.includes(a.tipo) ? 1 / (lugar.get(a.id) ?? 1) : 1;
    const d: Desglose = { base: 0, reuso: 0, apoyo: 0, reclutados: 0, total: 0 };
    if (a.tipo === 'reclutado') d.reclutados = contados.has(a.id) ? BASE.reclutado : 0;
    else d.base = BASE[a.tipo] * escasez;
    d.reuso = (REUSO[a.tipo] ?? 0) * Math.log2(1 + (citan.get(a.id)?.size ?? 0));
    const apoyada = a.tipo === 'clip' && a.apoya ? porId.get(a.apoya) : undefined;
    if (apoyada && apoyada.tipo === 'hipotesis' && baja(apoyada.autor) !== baja(a.autor)) d.apoyo = APOYO * escasez;
    d.total = d.base + d.reuso + d.apoyo + d.reclutados;
    out.set(a.id, d);
  }
  return out;
}

export interface FilaPuntos extends Desglose { detective: string; actos: number; netos: number; puesto: number }

/** La tabla: puntos, y entre iguales (a 1e-9), los votos netos; un empate completo comparte el puesto. */
export function tablaPorPuntos(actos: Acto[], votosNetos: Map<string, number> = new Map()): FilaPuntos[] {
  const p = puntosPorActo(actos);
  const filas = new Map<string, FilaPuntos>();
  for (const a of actos) {
    const k = baja(a.autor), d = p.get(a.id)!;
    const f = filas.get(k) ?? { detective: k, actos: 0, netos: votosNetos.get(k) ?? 0, puesto: 0, base: 0, reuso: 0, apoyo: 0, reclutados: 0, total: 0 };
    f.actos++; f.base += d.base; f.reuso += d.reuso; f.apoyo += d.apoyo; f.reclutados += d.reclutados; f.total += d.total;
    filas.set(k, f);
  }
  const orden = (a: FilaPuntos, b: FilaPuntos) => (Math.abs(b.total - a.total) > 1e-9 ? b.total - a.total : b.netos - a.netos);
  const lista = [...filas.values()].sort((a, b) => orden(a, b) || a.detective.localeCompare(b.detective));
  lista.forEach((f, i) => { f.puesto = i && orden(lista[i - 1], f) === 0 ? lista[i - 1].puesto : i + 1; });
  return lista;
}
