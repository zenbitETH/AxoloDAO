/** Where a value of an organization's card comes from: the chain (with its explorer page when the snapshot has one), a schema that covers it but has not been written, or the hub's own record. The words are placeholders until the founder approves them. */
/** `parcial` is the card's own: a value made of several weeks of which only some are anchored (`ancladas` of `de`). */
export interface OrigenDato { estado: 'en-cadena' | 'previsto' | 'hub' | 'parcial'; esquema?: string; uid?: string; ancladas?: number; de?: number }

const TEXTO = (o: OrigenDato) => (o.estado === 'parcial' ? `en cadena: ${o.ancladas} de ${o.de} semanas` : o.estado === 'en-cadena' ? 'en cadena' : o.estado === 'previsto' ? `previsto: ${o.esquema ?? 'esquema'}` : 'registro del hub');
const AYUDA = (o: OrigenDato) => (o.estado === 'parcial' ? `Solo ${o.ancladas} de las ${o.de} semanas detrás de este valor están ancladas en cadena; el resto aún no.` : o.estado === 'en-cadena'
  ? 'En cadena: existe y se lee hoy en un explorador público.'
  : o.estado === 'previsto' ? `Previsto: ${o.esquema ?? 'un esquema'} lo cubre, pero aún no se ha escrito en cadena.`
    : 'Registro del hub: ningún esquema lo lleva; no está en cadena.');

export function Origen(p: { o: OrigenDato; url?: string }) {
  const { o } = p;
  if (p.url) return <a class="at-og at-og-a" data-origen={o.estado} data-explorer href={p.url} target="_blank" rel="noopener noreferrer" title={AYUDA(o)}>{TEXTO(o)}</a>;
  return <span class="at-og" data-origen={o.estado} tabIndex={0} role="note" aria-label={`${TEXTO(o)}. ${AYUDA(o)}`} title={AYUDA(o)}>{TEXTO(o)}</span>;
}

const ICONO_ORIGEN: Record<string, string> = {
  'en-cadena': 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  parcial: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  previsto: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  hub: 'M5 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3',
};
/** The origin of a tile as a small icon in its corner, with the same words as the labels in a tooltip and for a screen reader. */
export function OrigenIcono(p: { o: OrigenDato }) {
  const { o } = p;
  return (
    <span class="at-og-i" data-origen={o.estado} tabIndex={0} role="img" aria-label={`${TEXTO(o)}. ${AYUDA(o)}`} title={`${TEXTO(o)}. ${AYUDA(o)}`}>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d={ICONO_ORIGEN[o.estado]} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray={o.estado === 'previsto' ? '3 3' : undefined} /></svg>
    </span>
  );
}
