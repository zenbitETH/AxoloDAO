/**
 * Lo que la mesa calcula en el navegador: series diarias, la correlación de Spearman entre dos variables cruzadas con su
 * mejor desfase, y el conjunto de datos en formato largo para R, Python o una hoja de cálculo. Lo que no cabe aquí
 * (modelos mixtos, series de tiempo con autocorrelación) se hace con lo exportado.
 */
export const DIA = 864e5;
export const TZ = 6;
export const diaDe = (t: number) => Math.floor((t - TZ * 36e5) / DIA);
export const fechaDe = (t: number) => new Date(t - TZ * 36e5).toISOString().slice(0, 10);
export const horaDe = (t: number) => new Date(t - TZ * 36e5).toISOString().slice(11, 16);

export interface Variable { id: string; nombre: string; unidad: string; puntos: [number, number][] }

/** Promedio por día del museo; los días sin dato no existen (nunca se interpolan). */
export function diaria(v: Variable, a: number, b: number) {
  const m = new Map<number, { s: number; n: number }>();
  for (const [t, y] of v.puntos) { if (t < a || t > b || !Number.isFinite(y)) continue; const d = diaDe(t); const c = m.get(d) ?? { s: 0, n: 0 }; c.s += y; c.n++; m.set(d, c); }
  return new Map([...m].map(([d, c]) => [d, c.s / c.n]));
}

const rangos = (xs: number[]) => {
  const o = xs.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
  const r = new Array(xs.length);
  for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; const m = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = m; i = j + 1; }
  return r as number[];
};
const pearson = (x: number[], y: number[]) => {
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
};
export const spearman = (x: number[], y: number[]) => pearson(rangos(x), rangos(y));

/** Spearman de A contra B desplazada `lag` días (B después de A cuando lag > 0), con los días en que hay ambas. */
export function cruce(A: Variable, B: Variable, a: number, b: number, maxLag = 7) {
  const da = diaria(A, a, b), db = diaria(B, a - maxLag * DIA, b + maxLag * DIA);
  const prueba = (lag: number) => {
    const x: number[] = [], y: number[] = [];
    for (const [d, v] of da) { const w = db.get(d + lag); if (w != null) { x.push(v); y.push(w); } }
    return { lag, n: x.length, rho: x.length >= 4 ? spearman(x, y) : NaN, x, y };
  };
  const todos = Array.from({ length: 2 * maxLag + 1 }, (_, i) => prueba(i - maxLag));
  const cero = todos[maxLag];
  const mejor = todos.filter((r) => r.n >= 6 && Number.isFinite(r.rho)).sort((p, q) => Math.abs(q.rho) - Math.abs(p.rho))[0] ?? null;
  return { cero, mejor, todos };
}

/** Formato largo: una fila por medición, con su fuente. Lo mismo que se ve, ni más ni menos. */
/** `valor` es siempre numérico (vacío en un evento); el texto de un evento va en `nota`, para que R y pandas lean la columna como número. */
export function csvLargo(filas: { t: number; entidad: string; variable: string; valor: number | null; unidad: string; fuente: string; nota?: string }[]) {
  const q = (s: string | number | null | undefined) => { const v = String(s ?? ''); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  return ['fecha,hora,entidad,variable,valor,unidad,fuente,nota', ...filas.map((f) => [fechaDe(f.t), horaDe(f.t), f.entidad, f.variable, f.valor, f.unidad, f.fuente, f.nota].map(q).join(','))].join('\n');
}

export const scriptR = (archivo: string) => `# La Variable Incógnita · mesa de detectives (axolodao.org/xolotlcalli/mesa)
library(readr); library(dplyr); library(tidyr); library(ggplot2)
d <- read_csv("${archivo}", col_types = cols(fecha = col_date(), valor = col_double(), .default = col_character()))
eventos <- d |> filter(startsWith(variable, "evento:"))   # tratamientos, bitácora, clips, muerte: texto en la columna nota
diario <- d |> filter(!is.na(valor)) |> group_by(fecha, entidad, variable) |> summarise(valor = mean(valor, na.rm = TRUE), .groups = "drop")
ggplot(diario, aes(fecha, valor, colour = entidad)) + geom_line() + geom_point(size = 1) +
  facet_wrap(~ variable, scales = "free_y", ncol = 1) + theme_minimal()
# Cruce de dos variables con desfase: ancho por variable, luego cor(..., method = "spearman")
ancho <- diario |> unite(v, entidad, variable) |> pivot_wider(names_from = v, values_from = valor)
`;

export const scriptPy = (archivo: string) => `# La Variable Incógnita · mesa de detectives (axolodao.org/xolotlcalli/mesa)
import pandas as pd
d = pd.read_csv("${archivo}", parse_dates=["fecha"])
eventos = d[d.variable.str.startswith("evento:")]  # tratamientos, bitácora, clips, muerte: texto en la columna nota
diario = d.dropna(subset=["valor"]).groupby(["fecha", "entidad", "variable"], as_index=False)["valor"].mean()
ancho = diario.assign(v=diario.entidad + " · " + diario.variable).pivot(index="fecha", columns="v", values="valor")
print(ancho.corr(method="spearman"))
`;
