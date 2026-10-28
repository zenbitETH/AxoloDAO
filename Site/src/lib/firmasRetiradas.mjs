// Names and signing keys the site no longer presents as AxoloDAO's or Zenbit's (the bunker migration plan, 2026-10-26). A signature from a key
// that someone else also holds proves nothing, and a name that resolves to such a key is not an identity. The build drops what they signed,
// and scripts/test-firmas-retiradas.mjs refuses a dist that still serves one of them.
export const NOMBRES_RETIRADOS = ['zenbit.axolodao.eth', 'xolotlcalli.axolodao.eth'];
export const FIRMANTES_RETIRADOS = ['0xecb4c1245665e8a1f43826355aab0dd6bf336e05'];

/** Whether an address may still sign for the site: false for a retired key, and for anything that is not an address. */
export const firmaVigente = (direccion) => /^0x[0-9a-fA-F]{40}$/.test(String(direccion ?? '')) && !FIRMANTES_RETIRADOS.includes(String(direccion).toLowerCase());
/** Whether the site may show an ENS name. */
export const nombreVigente = (nombre) => !NOMBRES_RETIRADOS.includes(String(nombre ?? '').trim().toLowerCase());
