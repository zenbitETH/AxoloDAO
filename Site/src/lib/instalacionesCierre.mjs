// The line a closed facility's popup shows under its place: «cerrado · mes de año», or just «cerrado» when the row has no date. A closed row never falls through to the open-facility popup (type, legal figure).
export const lineaDeCierre = (r, etiqueta, mes) => (r.estado_fecha ? `${etiqueta} · ${mes(String(r.estado_fecha))}` : etiqueta);
