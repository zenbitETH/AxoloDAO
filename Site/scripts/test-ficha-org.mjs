// The card of an organization as data (src/lib/fichaOrg.mjs), on SYNTHETIC organizations shaped as the hub's OrgDetail and OrgWeeks (the hub's two JSON Schemas are vendored in scripts/fixtures/hub-org): one registered with nothing attested, and one whose registration and weeks the chain confirmed.
// Each rule is shown RED first: the same assertions run on a copy of the module with that rule broken, and must fail there.
//   node scripts/test-ficha-org.mjs
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
let fallos = 0, comprobaciones = 0;
const ok = (c, m) => { comprobaciones++; console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) fallos++; };

// ---- a small JSON-Schema checker: enough for the hub's two schemas (type, enum, const, pattern, required, properties, items, anyOf, oneOf)
function valida(sch, v, ruta = '$') {
  const err = [];
  if (sch.anyOf || sch.oneOf) { const alts = sch.anyOf ?? sch.oneOf; return alts.some((a) => valida(a, v, ruta).length === 0) ? [] : [`${ruta}: matches none of the alternatives`]; }
  if ('const' in sch && v !== sch.const) err.push(`${ruta}: not ${JSON.stringify(sch.const)}`);
  if (sch.enum && !sch.enum.includes(v)) err.push(`${ruta}: not in the enum`);
  const tipos = [].concat(sch.type ?? []);
  const tipoDe = (x) => (x === null ? 'null' : Array.isArray(x) ? 'array' : Number.isInteger(x) ? 'integer' : typeof x);
  if (tipos.length && !tipos.some((t) => t === tipoDe(v) || (t === 'number' && typeof v === 'number'))) err.push(`${ruta}: type ${tipoDe(v)} is not ${tipos.join('|')}`);
  if (sch.pattern && typeof v === 'string' && !new RegExp(sch.pattern).test(v)) err.push(`${ruta}: does not match its pattern`);
  if (sch.required && v && typeof v === 'object' && !Array.isArray(v)) for (const k of sch.required) if (!(k in v)) err.push(`${ruta}.${k}: missing`);
  if (sch.properties && v && typeof v === 'object' && !Array.isArray(v)) for (const [k, s2] of Object.entries(sch.properties)) if (k in v) err.push(...valida(s2, v[k], `${ruta}.${k}`));
  if (sch.items && Array.isArray(v)) v.forEach((x, i) => err.push(...valida(sch.items, x, `${ruta}[${i}]`)));
  return err;
}
const ESQUEMA = (n) => JSON.parse(readFileSync(join(AQUI, 'fixtures/hub-org', n), 'utf8'));
const SCH_DETAIL = ESQUEMA('org-detail.v1.schema.json'), SCH_WEEKS = ESQUEMA('org-weeks.v1.schema.json');

// ---- the synthetic organization «Acuario de Prueba», as the hub serves it
const hex = (n) => `0x${n.toString(16).padStart(64, '0')}`;
const detalle = (extra = {}) => ({
  slug: 'acuario-de-prueba', orgUid: hex(0xc1), displayName: 'Acuario de Prueba', orgType: 2, legalFigure: 1, state: 'MX-QUE',
  verification: { level: 1, method: 0, expiresAt: null }, species: ['ambystoma_mexicanum', 'ambystoma_dumerilii'], receivesVisitors: true,
  ensName: 'acuario-de-prueba.axolodao.eth', listedAt: '2026-10-14T18:00:00Z', collectives: [], publicDescription: 'Un acuario sintético.',
  sites: [{ siteUid: hex(0xb1), state: 'MX-QUE', municipalityCode: '22014', latGen: 20.59, lonGen: -100.39, gridCdeg: 10, licence: { spdx: 'CC0-1.0', commercialOk: true, attributionRequired: false },
    units: [{ unitUid: hex(0xd1), slug: 'sistema-1', kind: 'sistema', parent: null, species: 'ambystoma_mexicanum' }] }],
  historical: null, frozen: false, frozenAt: null,
  stage: { reached: 0, missing: ['first_week_captured'], inReview: [], countdown: null }, span: { fromWeek: '2026-W41', toWeek: null },
  profileSha256: hex(0x9f), registeredUid: null,
  // as the hub serves a registered organization nothing has attested yet: the registration and the profile are «previsto» under OrgRegistered@2
  origen: { registeredUid: { estado: 'previsto', esquema: 'OrgRegistered@2' }, displayName: { estado: 'previsto', esquema: 'OrgRegistered@2' } }, ...extra,
});
const sinAnclas = { org: 'acuario-de-prueba', orgUid: hex(0xc1), weeks: [] };
const semana = (week, uid, publicRecords) => ({ week, publicDailiesByType: {}, publicRecords, anchor: { sequence: 1, uid, flags: 0 }, origen: uid ? { estado: 'en-cadena', esquema: 'WeekAnchor@2', uid } : { estado: 'previsto', esquema: 'WeekAnchor@2' } });
const conAnclas = { org: 'acuario-de-prueba', orgUid: hex(0xc1), weeks: [semana('2026-W41', hex(0xa1), 40), semana('2026-W42', hex(0xa2), 55), semana('2026-W43', null, 30)] };
const todasAncladas = { org: 'acuario-de-prueba', orgUid: hex(0xc1), weeks: [semana('2026-W41', hex(0xa1), 40), semana('2026-W42', hex(0xa2), 55), semana('2026-W43', hex(0xa3), 30)] };
const detalleAnclado = detalle({ registeredUid: hex(0x7e), origen: { registeredUid: { estado: 'en-cadena', esquema: 'OrgRegistered@2', uid: hex(0x7e) }, displayName: { estado: 'en-cadena', esquema: 'OrgRegistered@2', uid: hex(0x7e) } } });
const filaEns = (extra = {}) => ({ id: 'ens', titulo: 'acuario-de-prueba.axolodao.eth', red: 'Ethereum, red principal', estado: 'Resuelve', origen: { estado: 'en-cadena', esquema: 'ENS' }, resuelve: true, ...extra });
const resuelve = { leidoEl: '2026-10-21', filas: [filaEns()] };
const noResuelve = { leidoEl: '2026-10-21', filas: [filaEns({ estado: 'No resuelve', resuelve: false, origen: { estado: 'hub' } })] };
// the old way, which is no longer read: the prose «Resuelve» with no boolean
const soloProsa = { leidoEl: '2026-10-21', filas: [filaEns({ resuelve: undefined })] };
const nombreEstado = (iso) => ({ 'MX-QUE': 'Querétaro' }[iso] ?? iso);
const FICHA = { fecha: '2026-10-21', resumen: { periodoDeOperacion: { apertura: { valor: '2025-10-24', semanaIso: '2025-W43' }, cierre: { valor: '2026-09', dia: '2026-09-22', semanaIso: '2026-W39' } }, especies: { valor: ['ambystoma_mexicanum'] }, sistemas: { valor: [{ sistema: 'am', taxon: 'ambystoma_mexicanum' }] }, semanasDeclaradas: { valor: 49, desde: '2025-W43', hasta: '2026-W39' }, registrosPublicos: { valor: 572, fechaDeCorte: '2026-09-14' } }, irc_v1: { valor: 53, etiqueta: 'calculado del libro operativo; no anclado', calculadoEl: { valor: '2026-09-30' } }, supervivencia: { valor: 37, unidad: '%', periodo: { desde: '2025-10-24', hasta: '2026-09-25' }, etiqueta: 'histórico, no anclado', nota: 'Es una proporción simple, no la métrica de supervivencia del Estándar AxoloDAO.' } };

// ---- every assertion, against a module: returns the names of those that fail
function verificar(M) {
  const falla = [];
  const t = (nombre, cond) => { if (!cond) falla.push(nombre); };
  const sinAnc = M.vistaDeHub(detalle(), sinAnclas, { nombreEstado });
  t('registered with no anchors: weeks and records are empty states, not zeros', sinAnc.semanas === null && sinAnc.registros === null);
  t('registered with no anchors: nothing is «en cadena» anywhere', JSON.stringify(sinAnc).includes('"en-cadena"') === false);
  t('registered with no anchors: the registration and the weeks rows say they are not on chain', sinAnc.cadena.find((f) => f.id === 'registro')?.estado === 'Aún no registrada en cadena' && sinAnc.cadena.find((f) => f.id === 'semanal')?.estado === 'Aún no anclado' && sinAnc.cadena.every((f) => f.origen.estado !== 'en-cadena'));
  t('registered with no anchors: name, place, period, species and systems, each with the origin the hub gives it', sinAnc.nombre.valor === 'Acuario de Prueba' && sinAnc.lugar.valor === 'Querétaro' && sinAnc.periodo.valor.desde === '2026-W41' && sinAnc.periodo.valor.hasta === null && sinAnc.especies.valor.length === 2 && sinAnc.sistemas.valor[0].codigo === 'sistema-1' && sinAnc.nombre.origen.estado === 'previsto' && sinAnc.nombre.origen.esquema === 'OrgRegistered@2' && [sinAnc.periodo, sinAnc.especies, sinAnc.sistemas].every((d) => d.origen.estado === 'hub'));
  t('no value of the card is a bare zero', !JSON.stringify([sinAnc.semanas, sinAnc.registros]).match(/:0[,}]/));
  const anc = M.vistaDeHub(detalleAnclado, conAnclas, { nombreEstado });
  t('with anchors: three weeks, two of them anchored, from W41 to W43, 125 public records', anc.semanas?.valor.n === 3 && anc.semanas.valor.ancladas === 2 && anc.semanas.valor.desde === '2026-W41' && anc.semanas.valor.hasta === '2026-W43' && anc.registros?.valor === 125);
  t('with SOME weeks anchored, the weeks and the records wear a partial mark, never a plain «en cadena»: 2 of 3 weeks, and the records say how many fall in anchored weeks (95 of 125)', anc.semanas.origen.estado === 'parcial' && anc.semanas.origen.ancladas === 2 && anc.semanas.origen.de === 3 && anc.registros.origen.estado === 'parcial' && anc.registros.ancladas === 95 && anc.registros.valor === 125);
  const tod = M.vistaDeHub(detalleAnclado, todasAncladas, { nombreEstado });
  t('with EVERY week anchored the weeks and the records are «en cadena» under WeekAnchor@2', tod.semanas.origen.estado === 'en-cadena' && tod.semanas.origen.esquema === 'WeekAnchor@2' && tod.registros.origen.estado === 'en-cadena' && tod.cadena.find((f) => f.id === 'semanal').origen.estado === 'en-cadena');
  t('with no week anchored they are «previsto»', M.vistaDeHub(detalle(), { ...conAnclas, weeks: [semana('2026-W41', null, 40)] }, { nombreEstado }).semanas.origen.estado === 'previsto');
  t('with anchors: the registration row is on chain, the weeks row counts «2 de 3 semanas ancladas» and carries the partial mark', anc.cadena.find((f) => f.id === 'registro')?.origen.estado === 'en-cadena' && anc.cadena.find((f) => f.id === 'semanal')?.estado === '2 de 3 semanas ancladas' && anc.cadena.find((f) => f.id === 'semanal').origen.estado === 'parcial');
  t('with anchors: the name\'s origin is the hub\'s own map (on chain while the profile hashes to the attested one)', anc.nombre.origen.estado === 'en-cadena' && anc.nombre.origen.esquema === 'OrgRegistered@2');
  t('a field missing from the hub\'s origen map is the hub\'s own record', M.origenDe({}, 'species').estado === 'hub' && M.origenDe(undefined, 'x').estado === 'hub');
  const frio = M.vistaDeHub(detalle({ frozen: true, frozenAt: '2026-09-22T00:00:00Z', historical: { fromWeek: '2025-W43', toWeek: '2026-W39', figures: [{ key: 'survival_simple', value: '37.0', unit: 'percent', label: 'histórico', note: 'n', source: 's' }] } }), sinAnclas, { nombreEstado });
  const VACIA = '{"irc":null,"supervivencia":null,"modo":null,"aviso":null}';
  t('the IRC and survival band is part of every card and is empty without published figures: no value, never a zero, even for a frozen organization with a historical figure', JSON.stringify(sinAnc.cifras) === VACIA && JSON.stringify(anc.cifras) === VACIA && JSON.stringify(frio.cifras) === VACIA && !/survival|37\.0/.test(JSON.stringify(frio)));
  t('a frozen organization is shown closed with its day', frio.cerrado?.fecha === '2026-09-22' && sinAnc.cerrado === null);
  const e1 = M.vistaDeHub(detalle(), sinAnclas, { nombreEstado, cadena: resuelve });
  const e2 = M.vistaDeHub(detalle(), sinAnclas, { nombreEstado });
  const e3 = M.vistaDeHub(detalle(), sinAnclas, { nombreEstado, cadena: noResuelve });
  const e4 = M.vistaDeHub(detalle({ origen: { ensName: { estado: 'en-cadena', esquema: 'ENS' } } }), sinAnclas, { nombreEstado });
  t('an ENS name is «en cadena» only when the snapshot says it resolves', e1.ens.origen.estado === 'en-cadena' && e1.ens.origen.esquema === 'ENS');
  t('a gateway name the snapshot does not resolve stays «registro del hub» (no snapshot row, or a row that says it does not resolve)', e2.ens.origen.estado === 'hub' && e3.ens.origen.estado === 'hub');
  t('the hub\'s own claim of «en cadena» for the name does not stand without the snapshot', e4.ens.origen.estado === 'hub');
  const e5 = M.vistaDeHub(detalle(), sinAnclas, { nombreEstado, cadena: soloProsa });
  t('the prose «Resuelve» with no boolean `resuelve` no longer makes a name «en cadena»', e5.ens.origen.estado === 'hub');
  const sinOrigen = { leidoEl: '2026-10-21', filas: [filaEns(), { id: 'tesoreria', titulo: 'Transferencias', red: 'OP Mainnet', estado: '12 transferencias' }, { id: 'xovi', titulo: 'Clips', red: 'Sepolia', estado: '8 firmados', origen: { estado: 'quizá' } }, { id: 'otra', titulo: 'Otra', red: 'x', estado: 'x', origen: { estado: 'en-cadena', esquema: 'ENS' } }] };
  const r1 = M.vistaDeHub(detalle(), sinAnclas, { nombreEstado, cadena: sinOrigen, tesoreria: true });
  t('a snapshot row with no origen, or one that is not en-cadena, previsto or hub, is refused: never drawn, and reported', !r1.cadena.some((f) => f.id === 'tesoreria' || f.id === 'xovi') && r1.cadena.some((f) => f.id === 'otra') && r1.cadenaRechazadas.join() === 'tesoreria,xovi');
  const r2 = M.vistaDeXolotlcalli({ ficha: FICHA, cadena: sinOrigen, tesoreria: true });
  t('the pilot\'s card refuses them too', !r2.cadena.some((f) => f.id === 'tesoreria') && r2.cadenaRechazadas.includes('tesoreria'));
  const conTes = { leidoEl: '2026-10-21', filas: [filaEns(), { id: 'tesoreria', titulo: 'Transferencias de la tesorería a 0xAAAA…AAAA (firmante)', red: 'OP Mainnet', estado: '12 transferencias', origen: { estado: 'en-cadena', esquema: 'Safe/ERC-20' } }] };
  const sT = M.vistaDeXolotlcalli({ ficha: FICHA, cadena: conTes, ciclo: { municipio: 'Querétaro', estado: 'Querétaro', ens: 'x-de-prueba.eth', cierre: '2026-09-22' } });
  const cT = M.vistaDeXolotlcalli({ ficha: FICHA, cadena: conTes, ciclo: { municipio: 'Querétaro', estado: 'Querétaro', ens: 'x-de-prueba.eth', cierre: '2026-09-22' }, tesoreria: true });
  const hT = M.vistaDeHub(detalle(), sinAnclas, { nombreEstado, cadena: conTes }), hT2 = M.vistaDeHub(detalle(), sinAnclas, { nombreEstado, cadena: conTes, tesoreria: true });
  t('the treasury row (a personal address) is in no card unless the build turns it on: not in the pilot\'s, not in an organization\'s', !sT.cadena.some((f) => f.id === 'tesoreria') && !hT.cadena.some((f) => f.id === 'tesoreria') && !/tesorer/i.test(JSON.stringify([sT, hT])));
  t('and with the flag on it is drawn, in both', cT.cadena.some((f) => f.id === 'tesoreria') && hT2.cadena.some((f) => f.id === 'tesoreria'));
  const sobre = M.vistaDeHub(detalle(), sinAnclas, { nombreEstado, cadena: { leidoEl: '2026-10-21', filas: [{ id: 'semanal', titulo: 'x', red: 'x', estado: 'x', origen: { estado: 'en-cadena' } }, { id: 'registro', titulo: 'x', red: 'x', estado: 'x', origen: { estado: 'en-cadena' } }] } });
  t('the snapshot overrides the hub for the ENS mark and for nothing else', sobre.cadena.find((f) => f.id === 'semanal').origen.estado === 'previsto' && sobre.cadena.find((f) => f.id === 'registro').origen.estado === 'previsto');
  const x = M.vistaDeXolotlcalli({ ficha: FICHA, cadena: resuelve, ciclo: { municipio: 'Querétaro', estado: 'Querétaro', ens: 'xolotlcalli.axolodao.eth (pendiente)', cierre: '2026-09-22' } });
  const cadenaStand = { leidoEl: '2026-10-21', filas: [filaEns({ etiqueta: 'identificador histórico del Piloto (2025–2026)', detalle: [{ k: 'Registro inverso', v: 'vuelve al nombre' }] }), { id: 'tesoreria', titulo: 'Transferencias de la tesorería a 0xAAAA…AAAA (firmante)', red: 'OP Mainnet', estado: '12 transferencias', origen: { estado: 'en-cadena', esquema: 'Safe/ERC-20' } },
    { id: 'xovi', titulo: 'Confirmaciones de clips en Xovi', red: 'Ethereum Sepolia', estado: '8 firmados · 1 anclado', origen: { estado: 'en-cadena', esquema: 'ClipConfirmation@1' }, enlace: { texto: 'Atestación del clip 259', url: 'https://sepolia.easscan.org/attestation/view/0x01' } },
    { id: 'semanal', titulo: 'Registro semanal', red: 'Sin red', estado: 'Aún no anclado', origen: { estado: 'previsto', esquema: 'WeekAnchor@2' } },
    { id: 'nombrada', titulo: 'Registro del Museo Xolotlcalli en cadena', red: 'x', estado: 'x', origen: { estado: 'en-cadena', esquema: 'ENS' } }] };
  const clipsFx = { fecha: '2026-10-21', clips: [{ url: 'https://y/1', autor: '0xaaaa…1111', especie: 'mexicanum' }, { url: 'https://y/2', autor: '0xbbbb…2222', especie: 'mexicanum' }, { url: 'https://y/1', autor: '0xcccc…3333', especie: 'mexicanum' }] };
  const stand = (extra = {}) => M.vistaDeXolotlcalli({ ficha: FICHA, cadena: cadenaStand, clips: clipsFx, ciclo: { municipio: 'Querétaro', estado: 'Querétaro', ens: 'xolotlcalli.axolodao.eth (pendiente)', cierre: '2026-09-22' }, perfil: 'stand', ...extra });
  const s0 = stand();
  t('stand: no ENS pill and no link to the museum\'s page; a row that names the museum and a treasury row of the old recipient-labelled kind are refused and reported', s0.ens === null && s0.pagina === null && s0.cadena.map((f) => f.id).join() === 'ens,xovi,semanal' && s0.cadenaRechazadas.join() === 'tesoreria,nombrada');
  // the axolodao.org profile: the stand's guards with the museum page back, every signed clip, and the former name only as the Fuentes citation
  const sitio = (extra = {}) => M.vistaDeXolotlcalli({ ficha: FICHA, cadena: cadenaStand, clips: clipsFx, ciclo: { municipio: 'Querétaro', estado: 'Querétaro', ens: 'xolotlcalli.axolodao.eth (pendiente)', cierre: '2026-09-22' }, perfil: 'sitio', ...extra });
  const z = sitio();
  t('sitio: the museum page link is back, every signed clip is shown (not a cleared list), and the stand\'s guards still refuse the old recipient row and the row that names the museum', z.pagina === '/xolotlcalli/' && z.clips?.clips?.length === 3 && s0.clips === null && z.cadena.map((f) => f.id).join() === 'ens,xovi,semanal' && z.cadenaRechazadas.join() === 'tesoreria,nombrada' && z.ens === null);
  t('sitio: the figures carry the IP review\'s wording with the museum\'s defined name (one constant), the date and the notice; the water heading and the source lines too', z.cifras.modo === 'piloto' && z.cifras.irc.linea.includes(`sobre los registros del ${M.NOMBRE_MUSEO}; calculado el`) && z.cifras.aviso.includes(`opinión del ${M.NOMBRE_MUSEO_BASE} ni de`) && z.tituloAgua === `Mediciones de agua del ${M.NOMBRE_MUSEO}` && ['periodo', 'especies', 'agua', 'cobertura'].every((k) => z.fuenteDe[k]?.texto && z.fuenteDe[k]?.fecha));
  const sinCita = (v) => JSON.stringify(v).split(M.CITA_ACUERDO).join('');
  t('sitio: the former name appears only as the exact Fuentes citation of the agreement (clause 8.4), never in a label, a heading or the notice; the stand has no such citation', z.fuentes.filter((f) => f.texto === M.CITA_ACUERDO).length === 1 && !new RegExp(['bio', 'museo'].join(''), 'i').test(sinCita(z)) && !s0.fuentes.some((f) => f.texto === M.CITA_ACUERDO) && z.fuentes[z.fuentes.length - 1].texto === M.ETIQUETAS_CIFRAS_PILOTO.aviso);
  t('the figure tiles carry the IP review\'s captions: the IRC\'s origin and calculation date, the survival\'s method and window, and the one footnote line; the full wording stays in the lines', z.cifras.irc.pie === 'análisis de Zenbit · 30-sep-2026' && z.cifras.supervivencia.pie === 'proporción simple, 24-oct-2025 a 25-sep-2026 · no es la métrica del Estándar' && z.cifras.notaPie === 'Cifras calculadas por Zenbit; no expresan la opinión del museo ni de quienes participaron.' && z.cifras.irc.linea.includes('calculado el 30 de septiembre de 2026') && M.fechaCortaEs('2026-09-30') === '30-sep-2026');
  t('sitio: never the demo treasury row, even with the flag asked for', !sitio({ tesoreria: true }).cadena.some((f) => f.id === 'tesoreria' && !f.descripcion));
  const ensS = s0.cadena.find((f) => f.id === 'ens');
  t('stand: the ENS row is IN with the label «identificador histórico del Piloto (2025–2026)», says it resolves, and shows no address of its holder', ensS.etiqueta === 'identificador histórico del Piloto (2025–2026)' && ensS.estado === 'Resuelve' && ensS.origen.estado === 'en-cadena' && !/0x[0-9a-f]{4}/i.test(JSON.stringify(ensS)) && !/reclam|usar/i.test(JSON.stringify(ensS)));
  const ensCon = (extra) => stand({ cadena: { leidoEl: '2026-10-21', filas: [filaEns({ etiqueta: 'identificador histórico del Piloto (2025–2026)', ...extra })] } });
  t('stand: an ENS row without the ruled label, or with a holder address or a recipient word, is refused', ensCon({}).cadena.some((f) => f.id === 'ens') && ['etiqueta'].every(() => !ensCon({ etiqueta: 'mi nombre' }).cadena.some((f) => f.id === 'ens')) && !ensCon({ detalle: [{ k: 'Dirección', v: '0xB5B5…02e' }] }).cadena.some((f) => f.id === 'ens') && !ensCon({ detalle: [{ k: 'x', v: 'a 0x' + 'b5'.repeat(20) }] }).cadena.some((f) => f.id === 'ens') && !ensCon({ nota: 'firmante' }).cadena.some((f) => f.id === 'ens'));
  const A40 = '0x' + 'ab'.repeat(20), tx = (n) => 'https://optimistic.etherscan.io/tx/0x' + n.toString(16).padStart(64, '0'), dir = `https://optimistic.etherscan.io/address/${A40}`;
  const linea = (extra = {}) => ({ k: '2026-01 · pagos operativos (directos)', sentido: 'salida', v: 'salida: 0.040 ETH', contrapartes: [{ texto: '0xabab…abab', url: dir }], enlaces: [{ texto: 'tx 1', url: tx(2) }], ...extra });
  const safe = (extra = {}, lineaExtra = {}) => ({ id: 'tesoreria', titulo: 'Tesorería de AxoloDAO (treasury.axolodao.eth)', red: 'OP Mainnet', estado: 'Cada movimiento de la tesorería, verificable en cadena', descripcion: 'Trazabilidad de movimientos en cadena', nota: 'Sólo movimientos en cadena; no incluye pagos en efectivo ni bancarios.', bloque: 1, origen: { estado: 'en-cadena', esquema: 'Safe/ERC-20' },
    detalle: [{ k: 'Categorías', v: 'Categorías asignadas por Zenbit' }, { k: '2026-01 · Aportación de Zenbit', sentido: 'entrada', v: 'entrada: 0.100 ETH · 50 USDT', contrapartes: [{ texto: 'Zenbit' }], enlaces: [{ texto: 'tx 1', url: tx(1) }] }, linea(lineaExtra)], ...extra });
  const conSafe = (fila) => stand({ cadena: { leidoEl: '2026-10-22', filas: [filaEns({ etiqueta: 'identificador histórico del Piloto (2025–2026)' }), fila] } });
  const tiene = (v) => v.cadena.some((f) => f.id === 'tesoreria');
  t('stand: the treasury row of the whole Safe (months, categories, directions, native totals, tx links, counterparties «Zenbit» or an unnamed short address with its explorer link) IS drawn', tiene(conSafe(safe())) && conSafe(safe()).cadenaRechazadas.length === 0 && conSafe(safe()).cadena.find((f) => f.id === 'tesoreria').detalle.filter((d) => d.sentido).length === 2);
  const venenos = [
    ['a category that carries a role word', safe({}, { k: '2026-01 · Pago (firmante)' })],
    ['the ruled category in another casing', safe({}, { k: '2026-01 · Aportación (Firmante)' })],
    ['the ruled category with a word added', safe({}, { k: '2026-01 · Aportación (firmante) extra' })],
    ['the ruled category with a space left over', safe({}, { k: '2026-01 · Aportación (firmante) ' })],
    ['the ruled category on a note line (no direction)', { ...safe(), detalle: [...safe().detalle, { k: 'Aportación (firmante)', v: 'x' }] }],
    ['the ruled category as a counterparty', safe({}, { contrapartes: [{ texto: 'Aportación (firmante)' }] })],
    ['«firmante» as a counterparty', safe({}, { contrapartes: [{ texto: 'firmante' }] })],
    ['«firmante» in the amount', safe({}, { v: 'salida: 0.04 ETH firmante' })],
    ['the ruled category plus a role word elsewhere on the row', safe({ nota: 'del firmante' }, { k: '2026-01 · Aportación (firmante)' })],
    ['a counterparty named by a role', safe({}, { contrapartes: [{ texto: 'Director' }] })],
    ['a counterparty named by a person', safe({}, { contrapartes: [{ texto: 'Juan Pérez' }] })],
    ['a short address outside a counterparty', safe({}, { k: '2026-01 · pago a 0xabab…abab' })],
    ['a full address in an amount', safe({}, { v: `salida: 0.04 ETH ${A40}` })],
    ['a short address whose link goes to another address', safe({}, { contrapartes: [{ texto: '0xabab…abab', url: `https://optimistic.etherscan.io/address/0x${'cd'.repeat(20)}` }] })],
    ['a counterparty link that is not https', safe({}, { contrapartes: [{ texto: '0xabab…abab', url: dir.replace('https', 'http') }] })],
    ['a transaction link that is not a 64-hex transaction', safe({}, { enlaces: [{ texto: 'tx 1', url: 'https://optimistic.etherscan.io/tx/0x1234' }] })],
    ['an extra field on a line', safe({}, { destino: 'x' })],
    ['an extra field on the row', safe({ firmante: 'x' })],
    ['the old recipient-labelled row', { id: 'tesoreria', titulo: 'Transferencias de la tesorería a 0xAAAA…AAAA (firmante)', red: 'OP Mainnet', estado: '12 transferencias', origen: { estado: 'en-cadena', esquema: 'Safe/ERC-20' } }],
    ['a recipient word in the note', safe({ nota: 'enviado al destinatario' })],
  ];
  t('stand: the exact category «Aportación (firmante)» (the ruled label for the founder\'s own signer) as the category of a month line is accepted, and the row keeps it as the file wrote it', tiene(conSafe(safe({}, { k: '2026-01 · Aportación (firmante)', sentido: 'entrada', v: 'entrada: 0.04 ETH', contrapartes: [{ texto: '0xabab…abab', url: dir }] }))) && conSafe(safe({}, { k: '2026-01 · Aportación (firmante)', sentido: 'entrada', v: 'entrada: 0.04 ETH' })).cadena.find((f) => f.id === 'tesoreria').detalle.some((d) => d.k === '2026-01 · Aportación (firmante)'));
  t('stand: a treasury row is refused (and reported) when it carries a role or a name, a short address outside a counterparty, a full address outside a counterparty\'s own link, a link that is not an explorer page, or a field beyond the schema', venenos.every(([, f]) => !tiene(conSafe(f)) && conSafe(f).cadenaRechazadas.includes('tesoreria')));
  t('amounts are read at a booth: ETH to 4 places and USD stablecoins to 2, half up, by integer arithmetic; a nonzero amount never shows as zero («<0.0001 ETH», «<0.01 USDT»); the summary lines shorten their retirado and depositado too; the exact value is untouched in the data', M.montoLegible('entrada: 0.116460951192834306 ETH') === 'entrada: 0.1165 ETH' && M.montoLegible('0.251 ETH · 250 USDT') === '0.2510 ETH · 250.00 USDT' && M.montoLegible('0.00005 ETH') === '0.0001 ETH' && M.montoLegible('0.00004 ETH') === '<0.0001 ETH' && M.montoLegible('0.004 USDC') === '<0.01 USDC' && M.montoLegible('0.995 USDT') === '1.00 USDT' && M.montoLegible('9.99999 ETH') === '10.0000 ETH' && M.montoLegible('0 ETH') === '0.0000 ETH' && M.montoLegible('+0.039069 USDT (retirado 52.774816 − depositado 52.735747)') === '+0.04 USDT (retirado 52.77 − depositado 52.74)' && M.montoLegible('0.02135695 mWETH (sin valuar)') === '0.0214 mWETH (sin valuar)' && M.montoLegible('0 mUSDT (sin valuar)') === '0.00 mUSDT (sin valuar)' && M.montoLegible('12 WETHX') === '12 WETHX' && M.montoLegible('0.1 ETH · 0.0000001 USDT').includes('<0.01 USDT') && (() => { const f = safe({}, { v: 'salida: 0.116460951192834306 ETH' }); return f.detalle.at(-1).v === 'salida: 0.116460951192834306 ETH'; })());
  t('the demo profile draws the Safe row only when its flag is on', !M.vistaDeXolotlcalli({ ficha: FICHA, cadena: { leidoEl: '2026-10-22', filas: [filaEns(), safe()] } }).cadena.some((f) => f.id === 'tesoreria') && M.vistaDeXolotlcalli({ ficha: FICHA, cadena: { leidoEl: '2026-10-22', filas: [filaEns(), safe()] }, tesoreria: true }).cadena.some((f) => f.id === 'tesoreria'));
  t('stand: any other row that carries a recipient (a label, a word, an address) is refused', !stand({ cadena: { leidoEl: '2026-10-21', filas: [{ id: 'xovi', titulo: 'Clips', red: 'x', estado: 'pagado al firmante', origen: { estado: 'en-cadena' } }] } }).cadena.some((f) => f.id === 'xovi'));
  t('stand: the pilot\'s figures carry the booth wording whatever the flag says, and the water heading is the IP review\'s', s0.cifras.modo === 'piloto' && s0.tituloAgua === 'Mediciones de agua del Museo de Ajolotes Xolotlcalli (2025–2026)');
  t('stand: no clip without the founder\'s cleared list', s0.clips === null);
  const s1 = stand({ clipsAprobados: { clips: [{ url: 'https://y/1', autor: '0xcccc…3333' }, { url: 'https://y/9', autor: '0xzzzz…9999' }] } });
  t('stand: only the clips the list names (by link and author), nothing else', s1.clips?.clips.length === 1 && s1.clips.clips[0].autor === '0xcccc…3333');
  t('stand: every item names its source and date, and Fuentes closes with the notice', ['periodo', 'especies', 'sistemas', 'semanas', 'registros', 'agua', 'cobertura'].every((k) => s0.fuenteDe[k]?.texto && s0.fuenteDe[k]?.fecha) && s0.fuentes[s0.fuentes.length - 1].texto === 'Cifras calculadas por Zenbit. No expresan la opinión del Museo de Ajolotes Xolotlcalli ni de quienes participaron en él');
  t('stand: the demo flag for the recipient-labelled row changes nothing there', stand({ tesoreria: true }).cadena.every((f) => f.id !== 'tesoreria'));
  const prep = M.prepararStand({ clips: clipsFx, aprobados: { clips: [{ url: 'https://y/2', autor: '0xbbbb…2222' }] }, cadena: cadenaStand });
  const prep0 = M.prepararStand({ clips: clipsFx, aprobados: null, cadena: cadenaStand });
  t('the stand\'s data prep serves only the cleared clips (none without the list), keeps the ENS row with its label, drops the treasury row and refuses the rows that name the museum', prep.clips.clips.length === 1 && prep.clips.clips[0].url === 'https://y/2' && prep0.clips.clips.length === 0 && prep.cadena.filas.map((f) => f.id).join() === 'ens,xovi,semanal' && !/firmante|0xAAAA|tesoreria/i.test(JSON.stringify(prep0.cadena)) && prep0.cadena.filas[0].etiqueta === 'identificador histórico del Piloto (2025–2026)');
  t('the demo profile is untouched by all of it: its ENS, its page link and its clips stay', M.vistaDeXolotlcalli({ ficha: FICHA, cadena: cadenaStand, clips: clipsFx, ciclo: { municipio: 'Querétaro', estado: 'Querétaro', ens: 'xolotlcalli.axolodao.eth (pendiente)', cierre: '2026-09-22' } }).ens !== null && M.vistaDeXolotlcalli({ ficha: FICHA, clips: clipsFx }).pagina === '/xolotlcalli/' && M.vistaDeXolotlcalli({ ficha: FICHA, clips: clipsFx }).clips.clips.length === 3);
  t('the pilot, the reference instance, carries its published IRC and survival with the demo labels (flag off)', x.cifras.modo === 'demo' && x.cifras.irc?.valor === 53 && x.cifras.supervivencia?.valor === 37 && x.cifras.aviso === null);
  const CTX = { municipio: 'Querétaro', estado: 'Querétaro', ens: 'xolotlcalli.axolodao.eth (pendiente)', cierre: '2026-09-22' };
  const bx = M.vistaDeXolotlcalli({ ficha: FICHA, cadena: resuelve, ciclo: CTX, cifrasPiloto: true });
  t('flag on: the IRC reads exactly as the IP review ruled, with the date rendered from the ficha', bx.cifras.modo === 'piloto' && bx.cifras.irc?.linea === 'IRC v1: 53 — análisis de Zenbit sobre los registros del Museo de Ajolotes Xolotlcalli (2025–2026); calculado el 30 de septiembre de 2026');
  t('flag on: the survival label is the exact one, and the notice sits under both', bx.cifras.supervivencia?.linea === 'Supervivencia: 37.0 % — proporción simple sobre los registros del 24-oct-2025 al 25-sep-2026, que incluyen tres días posteriores al cierre al público; no es la métrica del Estándar' && bx.cifras.aviso === 'Cifras calculadas por Zenbit. No expresan la opinión del Museo de Ajolotes Xolotlcalli ni de quienes participaron en él');
  const sinFecha = M.vistaDeXolotlcalli({ ficha: { ...FICHA, irc_v1: { valor: 53, etiqueta: 'x' } }, cadena: resuelve, ciclo: CTX, cifrasPiloto: true });
  t('flag on and no calculation date in the ficha: the IRC is not shown (the date is never typed here)', sinFecha.cifras.irc === null && sinFecha.cifras.supervivencia !== null);
  const conForense = { ...FICHA, irc_v1: { ...FICHA.irc_v1, etiqueta: 'análisis forense del libro' }, supervivencia: { ...FICHA.supervivencia, nota: 'estudio forense' } };
  const f1 = M.vistaDeXolotlcalli({ ficha: conForense, cadena: resuelve, ciclo: CTX }), f2 = M.vistaDeXolotlcalli({ ficha: conForense, cadena: resuelve, ciclo: CTX, cifrasPiloto: true });
  t('the word «forense» is on no label, with the flag off or on: a ficha label that carries it is not shown', !/forense/i.test(JSON.stringify([f1.cifras, f2.cifras, x.cifras, bx.cifras])) && f1.cifras.irc === null && f1.cifras.supervivencia === null);
  t('the pilot\'s weeks are «previsto» (none anchored), its name resolves on chain', x.semanas.origen.estado === 'previsto' && x.semanas.valor.ancladas === 0 && x.ens.origen.estado === 'en-cadena' && x.ens.nota === 'pendiente');
  return falla;
}

const real = await import(pathToFileURL(join(AQUI, '../src/lib/fichaOrg.mjs')).href);
console.log('\n1 · the synthetic fixtures are what the hub serves');
const malDetalle = (() => { const d = detalle(); delete d.origen; return d; })();
ok(valida(SCH_DETAIL, detalle()).length === 0 && valida(SCH_DETAIL, detalleAnclado).length === 0, `OrgDetail, registered and attested, validates against the hub's schema (${valida(SCH_DETAIL, detalle()).join('; ') || 'no errors'})`);
ok(valida(SCH_WEEKS, sinAnclas).length === 0 && valida(SCH_WEEKS, conAnclas).length === 0, `OrgWeeks, with no week and with three, validates against the hub's schema (${valida(SCH_WEEKS, conAnclas).join('; ') || 'no errors'})`);
ok(valida(SCH_DETAIL, malDetalle).length > 0 && valida(SCH_WEEKS, { ...conAnclas, weeks: [{ ...conAnclas.weeks[0], origen: { estado: 'otro' } }] }).length > 0, 'the checker goes RED on a detail with no origen and on a week with an origin that is not en-cadena, previsto or hub');

console.log('\n2 · the view model');
const f0 = verificar(real);
ok(f0.length === 0, `every rule holds on the real module${f0.length ? `: ${f0.join(' | ')}` : ''}`);

console.log('\n3 · each rule, red first');
const fuente = readFileSync(join(AQUI, '../src/lib/fichaOrg.mjs'), 'utf8');
const dir = mkdtempSync(join(process.env.CLAUDE_JOB_DIR ? join(process.env.CLAUDE_JOB_DIR, 'tmp') : tmpdir(), 'ficha-org-'));
const MUTANTES = [
  ['an ENS name is «en cadena» whatever the snapshot says', "filaDe(cadena, 'ens')?.resuelve === true", 'true', /ENS name is «en cadena» only|gateway name|hub's own claim|overrides the hub|prose/],
  ['a row with no origen gets a default instead of being refused', 'filas.filter((f) => origenValido(f.origen))', 'filas.map((f) => ({ ...f, origen: f.origen ?? { estado: \'en-cadena\' } }))', /refused/],
  ['the hub\'s «en cadena» claim for a name stands without the snapshot', "origenHub?.estado === 'en-cadena' ? { estado: 'hub' } : origenHub ?? { estado: 'hub' }", "origenHub ?? { estado: 'hub' }", /hub's own claim/],
  ['an organization with no closed week gets zeros instead of an empty state', 'if (lista.length === 0) return null;', 'if (lista.length === 0) return { n: 0, desde: null, hasta: null, ancladas: 0, registros: 0 };', /zero|empty states|nothing is «en cadena»|not on chain/],
  ['survival is added to a frozen organization', '    cifras: { irc: null, supervivencia: null, modo: null, aviso: null },\n    agua: null,', "    cifras: { irc: null, supervivencia: detail.historical ? detail.historical.figures[0] : null, modo: null, aviso: null },\n    agua: null,", /band is part of every card/],
  ['the band shows zeros instead of an empty state', '    cifras: { irc: null, supervivencia: null, modo: null, aviso: null },\n    agua: null,', "    cifras: { irc: { valor: 0, etiqueta: '' }, supervivencia: { valor: 0, unidad: '%' }, modo: null, aviso: null },\n    agua: null,", /band is part of every card/],
  ['the treasury row is drawn whatever the build says', 'const cadena = tesoreria ? cadenaEntera : sinTesoreria(cadenaEntera);\n  const s = resumenDeSemanas(weeks);', 'const cadena = cadenaEntera;\n  const s = resumenDeSemanas(weeks);', /treasury row/],
  ['the SITIO profile hides the museum page like the stand', "const pagina = stand ? null : paginaEntera;", "const pagina = protegido ? null : paginaEntera;", /sitio: the museum page link/],
  ['the SITIO profile filters the clips like the stand', "const clips = stand ? clipsDelStand(clipsEntero, clipsAprobados) : clipsEntero;", "const clips = protegido ? clipsDelStand(clipsEntero, clipsAprobados) : clipsEntero;", /sitio: the museum page link/],
  ['the SITIO fuentes lose the agreement citation', "...(sitio ? [{ texto: CITA_ACUERDO }] : [])", "...[]", /sitio: the former name appears only/],
  ['the water heading goes back to the former name', "`Mediciones de agua del ${NOMBRE_MUSEO}`", "'Mediciones de agua del Bio' + 'museo Xolotlcalli (2025–2026)'", /sitio: the figures carry the IP review/],
  ['the IRC caption loses its date', "pie: ETIQUETAS_CIFRAS_PILOTO.pieIrc(fecha) }", "pie: 'análisis de Zenbit' }", /the figure tiles carry the IP review/],
  ['the exempt category is any label that mentions «firmante»', "if (String(d.k).slice(10) === CATEGORIA_FIRMANTE) d.k =", "if (/firmante/i.test(String(d.k))) d.k =", /is refused \(and reported\)/],
  ['the exempt category is no longer exempt', "if (String(d.k).slice(10) === CATEGORIA_FIRMANTE) d.k =", "if (false) d.k =", /exact category/],
  ['an amount is cut instead of rounded half up', "if (todo % 10n >= 5n) escala += 1n;", "", /booth/],
  ['a tiny nonzero amount shows as zero', "if (escala === 0n && noCero) return", "if (false) return", /booth/],
  ['the stand draws any treasury row, whatever it carries', "else if (f.id === 'tesoreria') { if (filaTesoreriaDelStand(f)) quedan.push(f); else rechazadas.push('tesoreria'); }", "else if (f.id === 'tesoreria') { quedan.push(f); }", /is refused \(and reported\)/],
  ['the treasury guard lets a role word through', "return !ROL_O_NOMBRE.test(JSON.stringify(copia)) && ", "return ", /is refused \(and reported\)/],
  ['the treasury guard does not tie a short address to its own link', "|| `${m[1].slice(0, 6)}…${m[1].slice(-4)}`.toLowerCase() !== String(c.texto).toLowerCase()", "", /is refused \(and reported\)/],
  ['the stand\'s ENS row keeps a holder address or a recipient word', "&& !DESTINATARIO.test(JSON.stringify(f)) ? f : null", "? f : null", /ENS row without|ENS row is IN/],
  ['the stand\'s ENS row needs no ruled label', "f.etiqueta === ETIQUETA_ENS_STAND && ", '', /ENS row without|ENS row is IN/],
  ['the stand shows clips nobody cleared', 'const clips = stand ? clipsDelStand(clipsEntero, clipsAprobados) : clipsEntero;', 'const clips = clipsEntero;', /clip/],
  ['the flag is ignored: the booth wording never appears', '  if (!cifrasPiloto) {', '  if (true) {', /flag on/],
  ['the IRC date is typed when the ficha has none', "irc: irc && fecha ? { valor: irc.valor, linea: ETIQUETAS_CIFRAS_PILOTO.irc(irc.valor, fecha), pie: ETIQUETAS_CIFRAS_PILOTO.pieIrc(fecha) } : null,", "irc: irc ? { valor: irc.valor, linea: ETIQUETAS_CIFRAS_PILOTO.irc(irc.valor, fecha ?? '2026-09-30'), pie: ETIQUETAS_CIFRAS_PILOTO.pieIrc(fecha ?? '2026-09-30') } : null,", /no calculation date/],
  ['a label with «forense» is shown', 'irc && sinForense(irc.etiqueta) ?', 'irc ?', /forense/],
  ['a partial value gets the full «en cadena» chip', ': s.ancladas === s.n ? ', ': true ? ', /partial mark|EVERY week|SOME weeks/],
  ['an anchor counts as confirmed whatever its origin', "w.anchor?.uid && w.origen?.estado === 'en-cadena'", 'true', /two of them anchored|counts «2 de 3/],
];
for (const [nombre, de, a, esperado] of MUTANTES) {
  ok(fuente.includes(de), `the mutation «${nombre}» applies to the source`);
  const ruta = join(dir, `m${MUTANTES.findIndex((m) => m[0] === nombre)}.mjs`);
  writeFileSync(ruta, fuente.replace(de, a));
  const M = await import(pathToFileURL(ruta).href);
  let falla = []; try { falla = verificar(M); } catch (e) { falla = [`threw: ${e.message}`]; }
  ok(falla.length > 0 && falla.some((n) => esperado.test(n)), `…and goes RED: ${falla.slice(0, 2).join(' | ') || 'it did NOT go red'}`);
}
console.log(`\n${comprobaciones - fallos}/${comprobaciones} checks passed`);
process.exit(fallos ? 1 : 0);
