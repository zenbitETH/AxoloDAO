/**
 * /xolotlcalli/mesa/datos.json: todo lo que la mesa de detectives dibuja, armado en el build desde los mismos archivos que
 * publica el sitio (src/data/ajolotes/bundle.json y public/data/…) y, de Xovi, las transmisiones y los clips verificados que su API
 * ya publica (src/data/mesa/xovi.json). Nada nuevo se publica aquí: es el mismo registro,
 * compacto y con la hora de cada fila en milisegundos (hora del museo, UTC−6, sin horario de verano).
 */
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { firmaVigente } from '@/lib/firmasRetiradas.mjs';
import { estadoClip } from '@components/mesa/votos';

const leer = (p: string) => JSON.parse(readFileSync(join(process.cwd(), p), 'utf8'));
const TZ = 6;
/** «2026-05-05» y «10:04» → milisegundos; sin hora, mediodía. */
const ms = (fecha?: string | null, hora?: string | null) => {
  if (!fecha) return null;
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, mi] = (hora && /^\d{1,2}:\d{2}/.test(hora) ? hora : '12:00').split(':').map(Number);
  return Date.UTC(y, m - 1, d, h + TZ, mi);
};
/** La estación de agua de una ubicación: las peceras AM comparten sistema; lo demás no tiene lecturas propias. */
const estacion = (u?: string | null) => {
  if (!u) return 'General';
  const s = u.replace(/\s+/g, ' ').trim();
  if (/^AM ?larvas$/i.test(s)) return 'AM Larvas';
  if (/^AM ?\d?$/i.test(s)) return 'AM';
  if (s === 'AA' || s === 'AD') return s;
  return 'General';
};
/** Los nombres de conducta del catálogo de Xovi (lib/clips/behaviors.ts), en español. */
const CONDUCTA: Record<string, string> = { gill_fungus: 'Hongo en branquias', yawn: 'Bostezo', capture_attempt: 'Intento de captura', gill_flutter: 'Aleteo de branquias',
  appendage_injury: 'Lesión en extremidad', surface_breach: 'Sube a la superficie', dominance: 'Dominancia', hiding: 'Se esconde', exploration: 'Exploración', pruritus: 'Prurito' };
/** El registro y Xovi escriben algunos nombres distinto. */
const ALIAS: Record<string, string> = { Chocoroll: 'Chocorrol', 'Sansón': 'Sanson' };
const limpio = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ''));

export const GET: APIRoute = () => {
  const bundle = leer('src/data/ajolotes/bundle.json');
  const forense = leer('public/data/ajolotes/bajas-forense.json');
  const agua = leer('public/data/water-quality/measurements-all.json');
  const parametros = leer('src/data/water-quality/parameters.json');
  const bitacora = leer('public/data/ops/bitacora.json');
  const xovi = leer('src/data/mesa/xovi.json');
  const anclasSrc = leer('src/data/anclas-xolotlcalli.json');

  const ajolotes: Record<string, unknown>[] = [];
  const eventos: Record<string, unknown[][]> = {};
  const peso: Record<string, number[][]> = {};
  const consumo: Record<string, number[][]> = {};
  const ev = (alias: string, fila: unknown[]) => { (eventos[alias] ||= []).push(fila); };

  for (const e of bundle.ejemplares) {
    ajolotes.push(limpio({ alias: e.alias, especie: e.especie, estado: 'vivo', pecera: e.pecera, estacion: estacion(e.pecera), fenotipo: e.fenotipo, genero: e.genero, estadio: e.estadio }));
  }
  for (const b of forense.especimenes) {
    const d = Array.isArray(b.death) ? null : b.death;
    const fecha = d?.date ?? (Array.isArray(b.death) ? b.death.filter((x: { date: string | null }) => x.date).map((x: { date: string }) => x.date).sort().at(-1) : null);
    const snap = bundle.bajasSnapshots.find((s: { alias: string }) => s.alias === b.alias);
    const sp = (b.species || snap?.especie || '') as string;
    const est = b.alias.startsWith('Larva') ? 'AM Larvas' : /andersoni/i.test(sp) ? 'AA' : /mexicanum/i.test(sp) ? 'AM' : /dumerilii/i.test(sp) ? 'AD' : 'sin estación';
    ajolotes.push(limpio({ alias: b.alias, especie: b.species, estado: 'baja', estacion: est, pecera: snap?.pecera, muerte: fecha, confFecha: d?.conf ?? 'grupo', notaFecha: d?.note, fechaLibro: d?.workbook_date, vivoDespues: d?.alive_record_after,
      causa: b.cause, fuenteCausa: b.cause_source, necropsia: b.necropsy?.result ? `hecha ${b.necropsy.performed}, resultado ${b.necropsy.result}` : (b.necropsy?.status ?? 'sin registro') }));
    ev(b.alias, [ms(fecha, '23:59'), 'muerte', 'Muerte', `${b.cause ?? 'Causa sin registro'} (${b.cause_source ?? 's/f'})`, 'libro']);
  }

  // biometría, alimentación y medicina del libro; con su serie numérica para cruzar
  for (const [alias, filas] of Object.entries(bundle.historial as Record<string, Record<string, unknown>[]>)) {
    for (const r of filas) {
      const t = ms(r.fecha as string); if (t == null) continue;
      if (typeof r.peso === 'number') (peso[alias] ||= []).push([t, r.peso]);
      const medidas = ['peso', 'lt', 'lhc', 'bcs'].filter((k) => r[k] != null).map((k) => `${k} ${r[k]}`).join(' · ');
      const obs = [r.comportamiento, r.cabeza, r.cuerpo, r.extremidades, r.cola, r.notas].filter(Boolean).join(' · ');
      ev(alias, [t, 'bio', 'Biometría', [medidas, obs].filter(Boolean).join(' — '), 'libro', typeof r.peso === 'number' ? r.peso : null]);
    }
  }
  for (const [alias, filas] of Object.entries(bundle.alimentacion as Record<string, Record<string, unknown>[]>)) {
    for (const r of filas) {
      const t = ms(r.fecha as string, r.hora as string); if (t == null) continue;
      if (typeof r.consumo === 'number') (consumo[alias] ||= []).push([t, r.consumo]);
      ev(alias, [t, 'alim', 'Alimentación', [r.tipo, r.racion != null ? `ración ${r.racion} g` : null, r.consumo != null ? `consumo ${r.consumo} g` : null, r.respuesta].filter(Boolean).join(' · '), 'libro', typeof r.consumo === 'number' ? r.consumo : null]);
    }
  }
  for (const [alias, filas] of Object.entries(bundle.terapeutica as Record<string, Record<string, unknown>[]>)) {
    for (const r of filas) {
      const t = ms(r.fecha as string, r.hora as string); if (t == null) continue;
      const txt = [r.diagnostico && `diagnóstico: ${r.diagnostico}`, r.tratamiento && `tratamiento: ${r.tratamiento}`, r.dosis && `dosis ${r.dosis}`, r.via, r.pruebasLab && `laboratorio: ${r.pruebasLab}`, r.observaciones].filter(Boolean).join(' · ');
      if (!txt) continue;
      ev(alias, [t, 'med', r.tratamiento ? 'Tratamiento' : 'Revisión médica', `${txt}${r.ubicacion ? ` (${r.ubicacion})` : ''}`, 'libro']);
    }
  }
  // lo que la bitácora anota de un ajolote va con él; lo demás es respuesta del equipo sobre una estación
  const respuesta: unknown[][] = [];
  const conocidos = new Set(ajolotes.map((a) => a.alias as string));
  for (const r of bitacora) {
    const t = ms(r.fecha, r.hora); if (t == null) continue;
    const txt = [r.incidencia, r.accion, r.notas].filter(Boolean).join(' · ');
    if (!txt) continue;
    const alias = r.alias ? (ALIAS[r.alias] ?? r.alias) : null;
    if (alias && conocidos.has(alias)) ev(alias, [t, 'med', r.accion ? 'Acción del equipo' : 'Observación', `${txt}${r.ubicacion ? ` (${r.ubicacion})` : ''}`, 'bitácora']);
    // un grupo («Larvas») o un nombre fuera del padrón publicado queda como respuesta sobre su estación, con su nombre
    else respuesta.push([t, estacion(r.ubicacion), r.ubicacion ?? 'sin ubicación', r.categoria ?? 'Bitácora', alias ? `${alias}: ${txt}` : txt]);
  }
  // las bajas sin libro propio toman su relato del expediente forense (ya publicado en su pestaña Postmortem)
  for (const b of forense.especimenes) {
    if (bundle.historial[b.alias] || bundle.terapeutica[b.alias] || bundle.alimentacion[b.alias]) continue;
    for (const x of b.events) {
      if (x.lane === 5 || x.lane === 1 || x.lane === 'integrity') continue;
      ev(b.alias, [ms(x.date, x.time), x.kind === 'weigh_in' ? 'bio' : x.kind?.startsWith('feed') ? 'alim' : 'med', x.label, x.text ?? '', `${x.source}, grado ${x.grade}`]);
    }
  }
  // las transmisiones de Xovi: cada una empieza a una hora conocida; un clip verificado cae en startedAt + su segundo en el video
  const grabaciones = (xovi.grabaciones as [string, string, string[]][]).map(([v, inicio, especies]) => [Date.parse(inicio), v, especies]).sort((a, b) => (a[0] as number) - (b[0] as number));
  const inicioDe = new Map(grabaciones.map((g) => [g[1] as string, g[0] as number]));
  for (const c of xovi.clips) {
    const t0 = inicioDe.get(c.v); if (t0 == null) continue;
    // un clip que trae una hipótesis sólo es público con las dos verificadas; si la exportación no dice el estado, no se muestra
    if (c.hipotesis && estadoClip('verificada', c.hipotesisEstado ?? 'pendiente') !== 'verificada') continue;
    const alias = ALIAS[c.alias] ?? c.alias;
    ev(alias, [t0 + Math.round(c.st * 1000), 'clip', CONDUCTA[c.tag] ?? c.tag, `Clip verificado #${c.id} en ${c.station}, ${Math.round(c.en - c.st)} s.`, `Xovi, clip #${c.id}`, null, `https://www.youtube.com/watch?v=${c.v}&t=${Math.floor(c.st)}s`, c.hipotesis ?? null]);
  }
  for (const k of Object.keys(eventos)) eventos[k].sort((a, b) => (a[0] as number) - (b[0] as number));
  respuesta.sort((a, b) => (a[0] as number) - (b[0] as number));

  const lecturas = agua.map((w: { date: string; time: string; tankId: string; values: Record<string, number | null> }) => [ms(w.date, w.time), w.tankId, limpio(w.values)]);
  const rangos: Record<string, Record<string, [number, number, string]>> = {};
  for (const p of parametros) (rangos[p.tankId] ||= {})[p.key] = [p.min, p.max, p.unit];

  // las anclas semanales del registro en Sepolia (EAS), una por semana ISO desde su lunes; con un firmante retirado no se muestran, como en la portada
  const lunesIso = (sem: string) => { const [y, w] = sem.split('-W').map(Number); const e4 = Date.UTC(y, 0, 4); const lun = e4 - ((new Date(e4).getUTCDay() + 6) % 7) * 864e5; return lun + (w - 1) * 7 * 864e5 + TZ * 36e5; };
  const anclas = firmaVigente(anclasSrc.atestador) ? (anclasSrc.anclas as { semana: string; uid: string }[]).map((a) => [lunesIso(a.semana), a.semana, a.uid]) : [];

  const todas = [...lecturas.map((l: unknown[]) => l[0] as number), ...Object.values(eventos).flat().map((f) => f[0] as number)].filter((t) => t != null);
  return new Response(JSON.stringify({
    fuente: 'Registro público de axolodao.org: bundle de ajolotes, bajas-forense.json, measurements-all.json, parameters.json y bitacora.json',
    desde: Math.min(...todas), hasta: Math.max(...todas),
    ajolotes, eventos, peso, consumo, lecturas, rangos, respuesta, grabaciones, fuenteXovi: xovi.fuente, anclas, atestadorAnclas: anclasSrc.atestador,
  }), { headers: { 'content-type': 'application/json' } });
};
