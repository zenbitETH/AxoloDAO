/**
 * Las reglas del voto, sin dependencias de ejecución para que scripts/test-mesa-votos.mjs las corra con node tal cual.
 * Mismo criterio que la verificación de clips en Xovi: lo decide el servidor; la mesa sólo las usa para explicar por qué no.
 */
import type { Hipotesis, Voto } from './modelo';

const igual = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * Si un voto puede contar, y por qué no. Las reglas: sólo sobre una verificada; nunca de su autor; un voto en contra exige una
 * contrahipótesis del mismo detective que dispute esta hipótesis. La contrahipótesis puede estar pendiente: el voto se registra y
 * cuenta cuando ella se verifica (`cuenta` lo distingue).
 */
export function revisarVoto(h: Hipotesis, v: Voto, todas: Hipotesis[]): { ok: true; cuenta: boolean } | { ok: false; porque: string } {
  if (h.estado !== 'verificada') return { ok: false, porque: 'Sólo se vota una hipótesis verificada' };
  if (igual(h.autor.direccion, v.detective)) return { ok: false, porque: 'No se vota la hipótesis propia' };
  if (v.valor === 1) return v.contra ? { ok: false, porque: 'Un voto a favor no lleva contrahipótesis' } : { ok: true, cuenta: true };
  const c = todas.find((x) => x.id === v.contra);
  if (!c) return { ok: false, porque: 'Un voto en contra necesita tu contrahipótesis' };
  if (c.contra !== h.id) return { ok: false, porque: 'La contrahipótesis no disputa esta hipótesis' };
  if (!igual(c.autor.direccion, v.detective)) return { ok: false, porque: 'La contrahipótesis es de otra persona' };
  if (c.estado === 'rechazada') return { ok: false, porque: 'La contrahipótesis fue rechazada' };
  return { ok: true, cuenta: c.estado === 'verificada' };
}

/** El voto de un detective reemplaza el anterior; uno que no pasa `revisarVoto` no entra. */
export function votar(h: Hipotesis, v: Voto, todas: Hipotesis[]): Hipotesis {
  const r = revisarVoto(h, v, todas);
  if (!r.ok) throw new Error(r.porque);
  return { ...h, votos: [...h.votos.filter((x) => !igual(x.detective, v.detective)), v] };
}

/** A favor, en contra que ya cuentan, y en contra que esperan la verificación de su contrahipótesis. */
export function cuentaVotos(h: Hipotesis, todas: Hipotesis[]) {
  let a = 0, c = 0, espera = 0;
  for (const v of h.votos) { const r = revisarVoto(h, v, todas); if (!r.ok) continue; if (v.valor === 1) a++; else if (r.cuenta) c++; else espera++; }
  return { a, c, espera };
}


/**
 * La tabla de detectives (Habacuc, 29-oct): primero el desempeño, y entre quienes empatan, los votos. Desempeño hoy es una sola
 * métrica, las hipótesis verificadas de las que es autor (una enviada o rechazada no suma: contar las creadas premiaría el volumen);
 * `METRICAS` admite más, en orden. Los votos son los netos (a favor menos en contra que ya cuentan) sobre sus hipótesis verificadas,
 * y sólo de detectives con al menos una verificada propia: un voto a favor no cuesta nada, y una cartera nueva no debe mover la tabla.
 * Un empate completo comparte el puesto (1, 2, 2, 4).
 */
export const METRICAS = ['verificadas'] as const;
export interface FilaTabla { detective: string; verificadas: number; aFavor: number; enContra: number; netos: number; puesto: number }

export function tablaDetectives(todas: Hipotesis[]): FilaTabla[] {
  const verificadas = todas.filter((h) => h.estado === 'verificada' && h.autor.direccion);
  const habilitados = new Set(verificadas.map((h) => h.autor.direccion!.toLowerCase()));
  const filas = new Map<string, FilaTabla>();
  for (const h of verificadas) {
    const k = h.autor.direccion!.toLowerCase();
    const f = filas.get(k) ?? { detective: k, verificadas: 0, aFavor: 0, enContra: 0, netos: 0, puesto: 0 };
    f.verificadas++;
    for (const v of h.votos) {
      if (!habilitados.has(v.detective.toLowerCase())) continue;
      const r = revisarVoto(h, v, todas);
      if (!r.ok || !r.cuenta) continue;
      if (v.valor === 1) f.aFavor++; else f.enContra++;
    }
    f.netos = f.aFavor - f.enContra;
    filas.set(k, f);
  }
  const orden = (a: FilaTabla, b: FilaTabla) => METRICAS.reduce((d, m) => d || b[m] - a[m], 0) || b.netos - a.netos;
  const lista = [...filas.values()].sort((a, b) => orden(a, b) || a.detective.localeCompare(b.detective));
  lista.forEach((f, i) => { f.puesto = i && orden(lista[i - 1], f) === 0 ? lista[i - 1].puesto : i + 1; });
  return lista;
}

/**
 * Un clip que trae una hipótesis se verifica con ella (Habacuc, 29-oct): es público sólo cuando el clip y la hipótesis están
 * verificados; si uno se rechaza, el envío entero queda rechazado (el clip puede volver a enviarse sin la hipótesis); mientras
 * alguno siga pendiente, no se muestra nada. Un clip sin hipótesis sigue su camino de siempre.
 */
export type EstadoRevision = 'pendiente' | 'verificada' | 'rechazada';
export function estadoClip(clip: EstadoRevision, hipotesis: EstadoRevision | 'borrador' | null): EstadoRevision {
  if (hipotesis === null) return clip;
  if (clip === 'rechazada' || hipotesis === 'rechazada') return 'rechazada';
  return clip === 'verificada' && hipotesis === 'verificada' ? 'verificada' : 'pendiente';
}
