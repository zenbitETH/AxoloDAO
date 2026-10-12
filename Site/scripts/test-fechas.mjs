// Las ocho reglas de fechas (lib/fechas.mjs) y la comprobación de la construcción, cada una con un
// caso plantado que debe fallar y su control que no. Una regla que no puede fallar es un fallo.
//   node scripts/test-fechas.mjs
import {
  PERIODO, etapaDe, horaHHMM, isoConDesfase, lecturasDeFecha, pendientesDelCiclo, registrosTrasMuerte,
  sinRepeticiones, discrepanciasDeMuerte, revisarFechas,
} from './lib/fechas.mjs';

let failed = 0;
const caso = (nombre, plantado, control) => {
  const ok = plantado === true && control === false;
  if (!ok) failed++;
  console.log(`  ${ok ? '✓' : '✗'} ${nombre} (plantado ${plantado}, control ${control})`);
};

console.log('regla 1: periodo de operación y custodia');
caso('antes de la primera lectura queda fuera', etapaDe('2025-03-15') === 'fuera', etapaDe('2025-09-24') === 'fuera');
caso('entre la preparación y la apertura es preapertura', etapaDe('2025-10-01') === 'preapertura', etapaDe('2025-10-24') === 'preapertura');
caso('después del cierre sólo vale como custodia marcada', etapaDe('2026-09-23') === 'fuera', etapaDe('2026-09-23', { custodia: true }) === 'fuera');
caso('la custodia también tiene límite', etapaDe('2026-10-30', { custodia: true }) === 'fuera', etapaDe(PERIODO.custodiaHasta, { custodia: true }) === 'fuera');

console.log('regla 2: nada después del día de captura más uno');
caso('dos días después de capturar queda fuera', etapaDe('2026-05-12', { capturadaEl: '2026-05-10' }) === 'fuera',
  etapaDe('2026-05-11', { capturadaEl: '2026-05-10' }) === 'fuera');

console.log('regla 3: ISO 8601 con desfase y HH:MM de 24 h');
caso('una fracción de Excel pasa a HH:MM', horaHHMM(0.6041666) === '14:30', horaHHMM(0.6041666) === null);
caso('p. m. y pm pasan a 24 h', horaHHMM('2:10 p. m.') === '14:10' && horaHHMM('07:05pm') === '19:05' && horaHHMM('12:00 a. m.') === '00:00',
  horaHHMM('2:10 p. m.') === '02:10');
caso('una hora imposible no se inventa', horaHHMM('25:10') === null && horaHHMM('13:00 pm') === null, horaHHMM('9.45') === null);
caso('fecha y hora salen con el desfase de la Ciudad de México', isoConDesfase('2026-05-05', '09:30') === '2026-05-05T09:30:00-06:00',
  isoConDesfase('2026-05-05', '9:30') !== null);

console.log('regla 4: día ≤ 12 y distinto del mes');
caso('5 de abril es ambigua y guarda la otra lectura', lecturasDeFecha('2026-04-05').conf === 'ambigua_dm' && lecturasDeFecha('2026-04-05').alternativa === '2026-05-04',
  lecturasDeFecha('2026-05-05').conf === 'ambigua_dm' || lecturasDeFecha('2026-04-13').conf === 'ambigua_dm');

console.log('regla 5: ciclo de vida con una sola muerte y llegada');
caso('dos muertes y sin llegada', pendientesDelCiclo([{ tipo: 'muerte', fecha: '2026-06-05' }, { tipo: 'muerte', fecha: '2026-06-06' }]).join() === 'sin_llegada_ni_nacimiento,mas_de_una_muerte',
  pendientesDelCiclo([{ tipo: 'llegada', fecha: '2025-10-01' }, { tipo: 'vida', fecha: '2026-01-01' }, { tipo: 'muerte', fecha: '2026-06-05' }, { tipo: 'necropsia', fecha: '2026-06-08' }]).length > 0);
caso('necropsia antes de la muerte y vida antes de llegar', pendientesDelCiclo([{ tipo: 'llegada', fecha: '2025-10-05' }, { tipo: 'vida', fecha: '2025-10-01' }, { tipo: 'necropsia', fecha: '2026-06-01' }, { tipo: 'muerte', fecha: '2026-06-05' }]).join() === 'vida_antes_de_la_llegada,necropsia_sin_muerte_previa',
  pendientesDelCiclo([{ tipo: 'nacimiento', fecha: '2025-10-05' }, { tipo: 'muerte', fecha: '2026-06-05' }]).length > 0);

console.log('regla 6: un registro vivo después de la muerte');
const regs = [{ fecha: '2026-06-04' }, { fecha: '2026-06-11' }];
caso('el del 11 queda tras la muerte del 10', registrosTrasMuerte(regs, '2026-06-10').length === 1, registrosTrasMuerte(regs, '2026-06-12').length > 0);

console.log('regla 7: repeticiones exactas');
caso('una fila repetida tal cual se quita y una distinta se queda',
  sinRepeticiones([{ a: 1 }, { a: 1 }, { a: 2 }])[1] === 1, sinRepeticiones([{ a: 1 }, { a: 1, b: 0 }])[1] > 0);

console.log('regla 8: una fecha canónica por muerte');
const m = (o) => new Map(Object.entries(o));
caso('fuentes que no coinciden', discrepanciasDeMuerte({ s: m({ x: ['2026-07-07'] }), r: m({ x: ['2026-07-08'] }) }).length === 1,
  discrepanciasDeMuerte({ s: m({ x: ['2026-07-07'] }), r: m({ x: ['2026-07-07'] }), f: m({ y: ['2026-01-14'] }) }).length > 0);
caso('dos muertes del mismo animal en una fuente', discrepanciasDeMuerte({ r: m({ x: ['2026-07-08', '2026-07-08'] }) })[0]?.motivo === 'muerte_duplicada',
  discrepanciasDeMuerte({ r: m({ x: ['2026-07-08'] }) }).length > 0);

console.log('comprobación de la construcción');
const base = () => ({
  bundle: { bajas: [{ nombre: 'Zzuno', fecha: '2026-07-07', fechaConf: 'exacta' }, { nombre: 'Larva de ajolote', fecha: '2026-04-05' }],
    historial: { Zzuno: [{ fecha: '2026-07-01' }] }, terapeutica: {}, alimentacion: { Zzuno: [{ fecha: '2026-07-02', hora: '09:30' }] } },
  forense: { especimenes: [{ alias: 'Larvas (1)', group: [{ date: '2026-04-05' }], death: { date: '2026-04-05' }, events: [] },
    { alias: 'Zzuno', death: { date: '2026-07-07' }, events: [{ date: '2026-09-23', custody: true }] }] },
  bitacoras: [[{ fecha: '2026-07-03', hora: '10:00', alias: 'Zzuno' }]],
  cierre: '2026-09-22',
});
const rojo = (cambio) => { const d = base(); cambio(d); return revisarFechas(d).length > 0; };
caso('el sitio con la fecha del libro y forense con la del laboratorio', rojo((d) => { d.bundle.bajas[0].fecha = '2026-07-08'; }), revisarFechas(base()).length > 0);
caso('el replay con una muerte duplicada', revisarFechas({ ...base(), replay: m({ zzuno: ['2026-07-07', '2026-07-07'] }) }).length > 0,
  revisarFechas({ ...base(), replay: m({ zzuno: ['2026-07-07'] }) }).length > 0);
caso('una larva sin nombre con otra fecha que el grupo', rojo((d) => { d.bundle.bajas[1].fecha = '2026-04-06'; }), false);
caso('una hora como fracción de Excel', rojo((d) => { d.bundle.alimentacion.Zzuno[0].hora = 0.39; }), false);
caso('una fila de la bitácora repetida', rojo((d) => { d.bitacoras[0].push({ ...d.bitacoras[0][0] }); }), false);
caso('un registro de marzo de 2025', rojo((d) => { d.bundle.historial.Zzuno.push({ fecha: '2025-03-16' }); }), false);
caso('un registro tras la muerte sin marcar', rojo((d) => { d.bitacoras[0].push({ fecha: '2026-07-09', hora: null, alias: 'Zzuno' }); }),
  rojo((d) => { d.bitacoras[0].push({ fecha: '2026-07-09', hora: null, alias: 'Zzuno', trasMuerte: true }); }));
caso('un evento forense del cierre sin marca de custodia', rojo((d) => { delete d.forense.especimenes[1].events[0].custody; }), false);
caso('un evento forense de antes del cierre marcado como custodia', rojo((d) => { d.forense.especimenes[1].events.push({ date: '2026-09-20', custody: true }); }), false);
caso('una baja ambigua que no lo es', rojo((d) => { d.bundle.bajas[0].fechaConf = 'ambigua_dm'; }), false);
caso('un cierre distinto en closure.json', rojo((d) => { d.cierre = '2026-09-21'; }), false);

console.log(failed ? `\n${failed} fallos` : '\ntodas las reglas verdes y cada una vista en rojo');
process.exit(failed ? 1 : 0);
