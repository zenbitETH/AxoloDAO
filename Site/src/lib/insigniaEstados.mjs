// The species page's states badge (the founder, 22-oct): «1 estado» for one state, «N estados» otherwise.
/** The badge text for a species found in `n` states. */
export const insigniaEstados = (n) => `${n} ${n === 1 ? 'estado' : 'estados'}`;
