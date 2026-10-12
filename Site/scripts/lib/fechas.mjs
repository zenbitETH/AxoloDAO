// Las ocho reglas de fechas de los datos del museo.
// Funciones puras: las usan los generadores (data-ajolotes, data-ops) y la comprobación de la
// construcción (check-fechas.mjs), y cada una tiene su prueba vista en rojo (test-fechas.mjs).

/** Regla 1. El periodo de operación, con su fuente, aparte de la apertura y el cierre públicos. */
export const PERIODO = {
  opsStart: '2025-09-21',      // primera lectura de agua del libro (preparación antes de abrir)
  apertura: '2025-10-24',      // apertura al público (2025-W43)
  opsEnd: '2026-09-21',        // último día abierto
  cierre: '2026-09-22',        // src/data/closure.json, closedOn
  custodiaHasta: '2026-09-23', // último dato escrito del fundador sobre un ejemplar en custodia
};

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;
const sumaDias = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/**
 * Reglas 1 y 2. Dónde cae una fecha: `preapertura` (preparación, válida), `periodo`, `custodia`
 * (después del cierre, sólo si el registro es de custodia) o `fuera` (va a cuarentena privada).
 * `capturadaEl`, si se da, también deja fuera lo que pasa del día de captura más uno.
 */
export function etapaDe(fecha, { custodia = false, capturadaEl = null, periodo = PERIODO } = {}) {
  if (typeof fecha !== 'string' || !ISO_DIA.test(fecha)) return 'fuera';
  if (capturadaEl && fecha > sumaDias(capturadaEl, 1)) return 'fuera';
  if (fecha < periodo.opsStart) return 'fuera';
  if (fecha < periodo.apertura) return 'preapertura';
  if (fecha <= periodo.opsEnd) return 'periodo';
  return custodia && fecha <= periodo.custodiaHasta ? 'custodia' : 'fuera';
}

/**
 * Regla 3. Una hora a `HH:MM` de 24 h: fracción de Excel, fecha de Excel, `H:MM[:SS]`, `H.MM`,
 * `h:mm[:ss] a. m./p. m.` y `hh:mmam/pm`. Lo que no se entiende devuelve null; nunca se inventa.
 */
export function horaHHMM(v) {
  if (v == null || v === '') return null;
  const deFraccion = (f) => {
    if (!Number.isFinite(f)) return null;
    const min = Math.round((f - Math.floor(f)) * 1440) % 1440;
    return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  };
  if (v instanceof Date) return Number.isNaN(+v) ? null : deFraccion((v.getUTCHours() * 60 + v.getUTCMinutes() + v.getUTCSeconds() / 60) / 1440);
  if (typeof v === 'number') return deFraccion(v);
  const m = /^(\d{1,2})[:.](\d{2})(?::(\d{2}))?\s*(?:(a|p)\.?\s*m\.?)?$/i.exec(String(v).trim());
  if (!m) return null;
  let h = Number(m[1]);
  const mn = Number(m[2]);
  if (mn > 59) return null;
  if (m[4]) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (m[4].toLowerCase() === 'p' ? 12 : 0);
  } else if (h > 23) return null;
  return `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
}

/** Regla 3. Fecha y hora como ISO 8601 con el desfase de la Ciudad de México (UTC−6, sin horario de verano desde 2022). */
export const isoConDesfase = (fecha, hora) => (ISO_DIA.test(fecha ?? '') && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora ?? '') ? `${fecha}T${hora}:00-06:00` : null);

/**
 * Regla 4. Una fecha leída como día/mes es ambigua sólo si el día es ≤ 12 y distinto del mes.
 * El orden de la hoja nunca la corrobora. Devuelve la confianza y, si la hay, la otra lectura.
 */
export function lecturasDeFecha(fecha) {
  if (typeof fecha !== 'string' || !ISO_DIA.test(fecha)) return { conf: 'sin_fecha', alternativa: null };
  const [y, m, d] = fecha.split('-').map(Number);
  if (d > 12 || d === m) return { conf: 'exacta', alternativa: null };
  return { conf: 'ambigua_dm', alternativa: `${y}-${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}` };
}

/**
 * Regla 5. El ciclo de vida de un organismo: llegada o nacimiento, vida, muerte, necropsia, en ese
 * orden, con exactamente una muerte. `eventos` es [{ tipo, fecha }]. Devuelve los pendientes.
 */
export function pendientesDelCiclo(eventos, { exigirLlegada = true } = {}) {
  const de = (t) => eventos.filter((e) => e.tipo === t).map((e) => e.fecha).sort();
  const pend = [];
  const llegada = [...de('llegada'), ...de('nacimiento')].sort()[0] ?? null;
  const muertes = de('muerte');
  if (exigirLlegada && !llegada) pend.push('sin_llegada_ni_nacimiento');
  if (muertes.length > 1) pend.push('mas_de_una_muerte');
  const muerte = muertes[0] ?? null;
  if (llegada && muerte && muerte < llegada) pend.push('muerte_antes_de_la_llegada');
  if (llegada && de('vida').some((f) => f < llegada)) pend.push('vida_antes_de_la_llegada');
  if (de('necropsia').some((f) => !muerte || f < muerte)) pend.push('necropsia_sin_muerte_previa');
  return pend;
}

/**
 * Regla 6. Los registros de un animal vivo con fecha posterior a su muerte. La fecha del laboratorio
 * manda (`muerte`); la del libro se conserva aparte y no se usa aquí.
 */
export const registrosTrasMuerte = (registros, muerte) => (muerte ? registros.filter((r) => r.fecha && r.fecha > muerte) : []);

/** Regla 7. Quita las repeticiones exactas por clave natural; conserva la primera. Devuelve [filas, quitadas]. */
export function sinRepeticiones(filas, clave = (f) => JSON.stringify(f)) {
  const vistas = new Set();
  const out = [];
  for (const f of filas) {
    const k = clave(f);
    if (vistas.has(k)) continue;
    vistas.add(k);
    out.push(f);
  }
  return [out, filas.length - out.length];
}

/**
 * Regla 8. Una fecha canónica por muerte. Recibe, por fuente, un mapa alias → lista de fechas de
 * muerte y devuelve cada discrepancia: una fuente con dos muertes del mismo animal, o dos fuentes
 * que no dan la misma fecha. Sólo compara los animales que aparecen en más de una fuente.
 */
export function discrepanciasDeMuerte(fuentes) {
  const out = [];
  const nombres = Object.keys(fuentes);
  const alias = new Set(nombres.flatMap((n) => [...fuentes[n].keys()]));
  for (const a of alias) {
    const por = nombres.filter((n) => fuentes[n].has(a)).map((n) => [n, fuentes[n].get(a)]);
    for (const [n, fs] of por) if (fs.length > 1) out.push({ alias: a, motivo: 'muerte_duplicada', fuente: n, fechas: fs });
    const unicas = new Set(por.map(([, fs]) => fs[0]));
    if (por.length > 1 && unicas.size > 1) out.push({ alias: a, motivo: 'fechas_distintas', fechas: Object.fromEntries(por.map(([n, fs]) => [n, fs[0]])) });
  }
  return out;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const LARVA_SIN_NOMBRE = /^larva de ajolote/i;

/**
 * La comprobación de la construcción: aplica las ocho reglas a lo que se publica. `bundle` es
 * src/data/ajolotes/bundle.json, `forense` bajas-forense.json, `bitacoras` las listas de la bitácora,
 * `cierre` el closedOn de closure.json y `replay`, si lo hay, un mapa alias → fechas de muerte del
 * paquete privado del replay. Devuelve los fallos; vacío es verde.
 */
export function revisarFechas({ bundle, forense, bitacoras = [], cierre, replay = null }) {
  const fallos = [];
  if (cierre !== PERIODO.cierre) fallos.push(`regla 1: el cierre de closure.json (${cierre}) no es el de PERIODO (${PERIODO.cierre})`);
  // Regla 8 (y 5: una muerte por animal en cada fuente).
  const porAlias = (pares) => pares.reduce((m, [a, f]) => m.set(a, [...(m.get(a) ?? []), f]), new Map());
  // Las larvas sin nombre comparten un nombre de hoja y son animales distintos: se comparan como grupo.
  const sinNombre = (b) => LARVA_SIN_NOMBRE.test(b.nombre.trim());
  const sitio = porAlias(bundle.bajas.filter((b) => b.fecha && !sinNombre(b)).map((b) => [b.nombre.toLowerCase(), b.fecha]));
  const fz = porAlias(forense.especimenes.filter((e) => !e.group && e.death?.date).map((e) => [e.alias.toLowerCase(), e.death.date]));
  const grupo = forense.especimenes.find((e) => e.group)?.group ?? [];
  const larvasSitio = bundle.bajas.filter(sinNombre).map((b) => b.fecha ?? '').sort().join(',');
  const larvasForense = grupo.map((g) => g.date ?? '').sort().join(',');
  if (larvasSitio !== larvasForense) fallos.push('regla 8: las fechas de las larvas sin nombre no coinciden entre sitio y forense');
  const fuentes = { sitio, forense: fz, ...(replay ? { replay } : {}) };
  for (const d of discrepanciasDeMuerte(fuentes)) {
    fallos.push(`regla 8: ${d.motivo} en ${d.fuente ?? Object.keys(d.fechas).join(', ')} (${d.fuente ? d.fechas.length : Object.values(d.fechas).join(' contra ')})`);
  }
  // Regla 4: la confianza publicada sigue la regla día ≤ 12 y distinto del mes.
  for (const b of bundle.bajas) if (b.fechaConf === 'ambigua_dm' && lecturasDeFecha(b.fecha).conf !== 'ambigua_dm') fallos.push(`regla 4: una baja del ${b.fecha} se publica ambigua y no lo es`);
  // Reglas 1, 2, 3, 6 y 7 en cada registro por ejemplar y en la bitácora.
  const listas = [...['historial', 'terapeutica', 'alimentacion'].flatMap((k) => Object.entries(bundle[k] ?? {}).map(([a, rs]) => [`${k}`, a, rs])),
    ...bitacoras.map((rs, i) => [`bitácora ${i + 1}`, null, rs])];
  const muerte = new Map([...fz].map(([a, fs]) => [a, fs[0]]));
  const cuenta = { hora: 0, repetida: 0, fuera: 0, sinMarca: 0, marcaDeMas: 0 };
  for (const [, alias, rs] of listas) {
    cuenta.repetida += sinRepeticiones(rs)[1];
    for (const r of rs) {
      if (r.hora != null && !HHMM.test(r.hora)) cuenta.hora++;
      if (etapaDe(r.fecha) === 'fuera') cuenta.fuera++;
      const nombres = alias ? [alias] : String(r.alias ?? '').split(',').map((x) => x.trim()).filter(Boolean);
      const tras = nombres.some((a) => registrosTrasMuerte([r], muerte.get(a.toLowerCase())).length);
      if (tras && !r.trasMuerte) cuenta.sinMarca++;
      if (!tras && r.trasMuerte) cuenta.marcaDeMas++;
    }
  }
  if (cuenta.hora) fallos.push(`regla 3: ${cuenta.hora} horas que no son HH:MM de 24 h`);
  if (cuenta.repetida) fallos.push(`regla 7: ${cuenta.repetida} filas repetidas tal cual`);
  if (cuenta.fuera) fallos.push(`reglas 1 y 2: ${cuenta.fuera} registros fuera del periodo de operación`);
  if (cuenta.sinMarca) fallos.push(`regla 6: ${cuenta.sinMarca} registros posteriores a la muerte sin marcar`);
  if (cuenta.marcaDeMas) fallos.push(`regla 6: ${cuenta.marcaDeMas} registros marcados tras la muerte que no lo son`);
  // Regla 1: lo publicado por forense desde el cierre es custodia, y nada pasa de la custodia.
  for (const e of forense.especimenes) {
    for (const ev of e.events ?? []) {
      const custodia = Boolean(ev.custody);
      if ((ev.date >= PERIODO.cierre) !== custodia) fallos.push(`regla 1: un evento forense del ${ev.date} ${custodia ? 'marcado' : 'sin marcar'} como custodia`);
      if (etapaDe(ev.date, { custodia }) === 'fuera' && ev.date > PERIODO.opsEnd) fallos.push(`regla 1: un evento forense del ${ev.date} pasa de la custodia`);
    }
  }
  return fallos;
}
