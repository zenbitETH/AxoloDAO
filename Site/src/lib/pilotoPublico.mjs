// The public copy of the pilot's three data files (scripts/build-sitio.mjs writes it into public/atlas/real/): only the fields the pilot's
// card renders. The source files are internal (requests, design notes, internal citations, rulings, repository paths); a whitelist is
// the only safe copy, because a field added upstream never reaches the served site unless it is listed here.
//
// The chain rows' caveat («Sólo movimientos en cadena; …») is rendered, so it travels under a key that says what it is: `aclaracion`.
// The public chain file carries no `nota` key at all.
// Every projection is idempotent: projecting a public copy again gives the same bytes, which is how scripts/lib/construccionSitio.mjs
// checks that the built site serves exactly the projection.

const tomar = (o, claves) => Object.fromEntries(claves.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));

/** The pilot's summary as the card renders it: dates, species, systems, weeks, public records, weekly water, coverage and the two figures. */
export function fichaPublica(f) {
  const r = f.resumen;
  return {
    fecha: f.fecha,
    resumen: {
      periodoDeOperacion: { apertura: tomar(r.periodoDeOperacion.apertura, ['valor', 'semanaIso']), cierre: tomar(r.periodoDeOperacion.cierre, ['valor', 'dia', 'semanaIso']) },
      especies: { valor: [...r.especies.valor] },
      sistemas: { valor: r.sistemas.valor.map((s) => tomar(s, ['sistema', 'taxon'])) },
      semanasDeclaradas: tomar(r.semanasDeclaradas, ['valor', 'desde', 'hasta']),
      registrosPublicos: tomar(r.registrosPublicos, ['valor', 'porTipo', 'fechaDeCorte']),
    },
    aguaSemanal: {
      sistemas: Object.fromEntries(Object.entries(f.aguaSemanal.sistemas).map(([k, s]) => [k, {
        ...tomar(s, ['taxon', 'porQue']),
        propiedades: Object.fromEntries(Object.entries(s.propiedades).map(([p, v]) => [p, {
          ...tomar(v, ['columnaDelLibro', 'unidad']),
          semanas: v.semanas.map((w) => tomar(w, ['semana', 'n', 'min', 'max', 'media', 'metodo', 'extremosSuprimidos'])),
        }])),
      }])),
    },
    cobertura: {
      semanasConRegistroPublico: tomar(f.cobertura.semanasConRegistroPublico, ['valor', 'de', 'porcentaje']),
      diasConTemperatura: tomar(f.cobertura.diasConTemperatura, ['valor', 'porSistema']),
    },
    irc_v1: { ...tomar(f.irc_v1, ['valor', 'etiqueta']), calculadoEl: tomar(f.irc_v1.calculadoEl, ['valor']) },
    supervivencia: tomar(f.supervivencia, ['valor', 'unidad', 'periodo', 'etiqueta']),
  };
}

/** The confirmed clips as the card lists them. */
export const clipsPublicos = (c) => ({
  fecha: c.fecha,
  clips: c.clips.map((x) => tomar(x, ['semana', 'semanaDe', 'especie', 'sistema', 'estado', 'autor', 'poster', 'url'])),
});

/** The onchain rows as the card shows them; a row's caveat becomes `aclaracion`. */
export const cadenaPublica = (c) => ({
  leidoEl: c.leidoEl,
  filas: c.filas.map((f) => {
    const aclaracion = f.aclaracion ?? f.nota;   // the internal file's `nota`, or a copy that already says `aclaracion` (the projection is idempotent)
    return { ...tomar(f, ['id', 'titulo', 'red', 'estado', 'descripcion', 'bloque', 'origen', 'detalle', 'enlace', 'etiqueta', 'resuelve', 'aviso', 'muestra']), ...(aclaracion ? { aclaracion } : {}) };
  }),
});
