// Shared by the species-chip checks (public popups and the demo card): what the index shows for a species, and the same facts read from a chip.
/** What each species row of the index looks like: the facts a chip must repeat. */
export const leerIndice = (p) => p.$$eval('.at-srow[data-species-row]', (rows) => {
  const out = {}; const cs = (e) => getComputedStyle(e);
  for (const r of rows) {
    const slug = r.dataset.speciesRow; if (out[slug]) continue;
    const sw = r.querySelector('.at-sw'), nm = r.querySelector('.at-nm'), ib = r.querySelector('.at-ib');
    out[slug] = { accent: r.dataset.accent, color: cs(r).color, fondo: `${cs(sw).backgroundImage}|${cs(sw).backgroundColor}`, trama: sw.dataset.trama, label: nm.textContent, italic: cs(nm).fontStyle, badge: ib ? `${ib.textContent}|${cs(ib).color}` : '' };
  }
  return out;
});
/** The same facts, read from the chips found under `raiz`. */
export const leerChips = (p, raiz) => p.$$eval(`${raiz} [data-species-chip], ${raiz} [data-species-label]`, (els) => els.map((r) => {
  const cs = (e) => getComputedStyle(e); const sw = r.querySelector('.at-sw'), nm = r.querySelector('.at-nm'), ib = r.querySelector('.at-ib');
  return { slug: r.dataset.speciesChip ?? r.dataset.speciesLabel, accent: r.dataset.accent ?? null, color: cs(r).color, fondo: `${cs(sw).backgroundImage}|${cs(sw).backgroundColor}`, trama: sw.dataset.trama, label: nm.textContent, italic: cs(nm).fontStyle, badge: ib ? `${ib.textContent}|${cs(ib).color}` : '', boton: r.tagName === 'BUTTON' };
}));
/** The map paints each range with `[slug, colour]` pairs of a match expression: the chip's colour must be that pair. */
export const enElMapa = (p, slug, accent) => p.evaluate(([s, a]) => { const m = document.querySelector('[data-map]').__map; return m.getStyle().layers.some((l) => JSON.stringify(l.paint ?? {}).includes(`"${s}","${a}"`)); }, [slug, accent]);
export const igualAlIndice = (c, ind) => !!ind && c.color === ind.color && c.fondo === ind.fondo && c.trama === ind.trama && c.label === ind.label && c.badge === ind.badge && c.italic === 'italic' && ind.italic === 'italic';

