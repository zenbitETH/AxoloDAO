// The public copy of the home page's two inventories: only the fields the home renders, nothing else. The inventories are generated
// in a private data repository and carry internal citations, notes and rows that are not public; a whitelist is the only safe copy,
// because a field added upstream never reaches this repository unless it is listed here.

const valor = (o) => ({ valor: o.valor });

/** The public atlas inventory: its date, the species by country, the facilities on the public map layer, the languages. */
export function atlasPublico(a) {
  return {
    fecha: a.fecha,
    especies: { valor: a.especies.valor, porPais: { MX: a.especies.porPais.MX, US: a.especies.porPais.US, CA: a.especies.porPais.CA } },
    instalaciones: valor(a.instalaciones),
    idiomas: { valor: [...a.idiomas.valor] },
  };
}

/** The public chain inventory: what is on Ethereum Sepolia today (with its explorer links), and what will be anchored, week by week. */
export function cadenaPublica(c) {
  const e = c.enSepoliaHoy;
  const s = c.seAnclara.semanas;
  const r = c.registrosPublicos;
  return {
    fecha: c.fecha,
    red: { nombre: c.red.nombre, chainId: c.red.chainId },
    enSepoliaHoy: {
      esquema: { nombre: e.esquema.nombre, uid: e.esquema.uid, enlaces: { easscan: e.esquema.enlaces.easscan, etherscan: e.esquema.enlaces.etherscan } },
      atestacion: {
        clip: e.atestacion.clip,
        uidEnCadena: e.atestacion.uidEnCadena,
        hora: e.atestacion.hora,
        enlaces: { easscan: e.atestacion.enlaces.easscan, etherscan: e.atestacion.enlaces.etherscan },
      },
    },
    clipsConfirmados: { conAtestacionEnSepolia: valor(c.clipsConfirmados.conAtestacionEnSepolia) },
    seAnclara: { semanas: { valor: s.valor, desde: s.desde, hasta: s.hasta, porSemana: s.porSemana.map((w) => ({ semana: w.semana, registrosPublicos: w.registrosPublicos })) } },
    registrosPublicos: {
      diasConRegistro: valor(r.diasConRegistro),
      semanasConRegistro: { valor: r.semanasConRegistro.valor, de: r.semanasConRegistro.de },
      tiposConRegistro: valor(r.tiposConRegistro),
    },
    areas: { conRegistro: c.areas.conRegistro },
  };
}
