// Taxon names in italics wherever the home renders them: the genus «Ambystoma», and a binomial («Ambystoma mexicanum»,
// «A. mexicanum») only when its epithet is one of the atlas's 32 species, so «32 Ambystoma species» does not italicise «species».
// The text is HTML-escaped first; the result goes into set:html.
import colores from '../../public/atlas/real/colores.json';

const EPITETOS = Object.keys(colores.porEspecie);
const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const BINOMIO = new RegExp(`\\b(?:Ambystoma|A\\.)\\s(?:${EPITETOS.join('|')})\\b|\\bAmbystoma\\b`, 'g');

/** The text, escaped, with every taxon name in <i>. */
export const conTaxones = (texto: string): string => escapar(texto).replace(BINOMIO, (m) => `<i>${m}</i>`);
