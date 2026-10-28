// The images of the species and their credits: pure data and checks, so the drawer and scripts/test-atlas.mjs read the same rules.
// A credit is the line the person reads under «Créditos de la imagen»: the base photo's author, its licence and its link, and that the picture is a generated illustration.

/** The credit line as text with the source's name linked: the address is not printed, the author's name (the part of the author before a parenthesis) is the link. A credit with no address (an original) is plain text. */
export function partesDeCredito(credito, autor, url) {
  let texto = String(credito);
  if (!url) return [texto];
  texto = texto.split(` (${url})`).join('').split(url).join('');
  const nombre = String(autor).replace(/\s*\(.*\)\s*$/, '');
  const i = texto.indexOf(nombre);
  if (i < 0) return [texto, ' ', { texto: 'fuente', url }];
  return [texto.slice(0, i), { texto: nombre, url }, texto.slice(i + nombre.length)].filter((x) => x !== '');
}

/** What is wrong with the images of a build. `slugs`: the atlas species; `archivos`: the files in public/species; `hero`: slug → file; `creditos`: slug → credit. Empty when every species has an image and a credit, no file lacks a credit, and a base that asks for attribution shows its author and link. */
export function validarCreditos({ slugs, archivos, hero, creditos }) {
  const mal = [];
  for (const s of slugs) {
    if (!hero[s]) mal.push(`${s}: no image`); else if (!archivos.includes(hero[s])) mal.push(`${s}: ${hero[s]} is not in public/species`);
    if (!creditos[s]) mal.push(`${s}: no credit`);
  }
  for (const f of archivos) {
    const s = Object.keys(hero).find((k) => hero[k] === f);
    if (!s) mal.push(`${f}: no species uses this file`); else if (!creditos[s]) mal.push(`${f}: its species (${s}) has no credit`);
  }
  if (archivos.includes('gen-subsalsum.jpg')) mal.push('gen-subsalsum.jpg: subsalsum is a synonym of velasci, its image is stale');
  for (const [s, c] of Object.entries(creditos)) {
    if (!c.etiqueta) mal.push(`${s}: no badge label`);
    if (/CC BY/i.test(c.licencia) && (!c.autor || !c.url || !c.credito.includes(c.autor.replace(/\s*\(.*\)\s*$/, '')) || !c.credito.includes(c.licencia) || !c.credito.includes(c.url) || !partesDeCredito(c.credito, c.autor, c.url).some((x) => x?.url === c.url))) mal.push(`${s}: a CC BY base must show its author, licence and link in the credit line`);
  }
  return mal;
}
