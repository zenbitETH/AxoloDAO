// A species text that quotes a published source verbatim is rendered as that quotation, byte for byte, and followed by its citation with the
// page (the IP ruling and the founder, 22-oct: the amblycephalum distribution, SEMARNAT 2018, PACE Ambystoma, p. 20). The quotation is checked
// against the attested profile row (the perfiles bundle served in /atlas/datos/huella/ when the build has it, else the atlas snapshot the
// site commits), with whitespace normalised and nothing else.   node scripts/test-cita-literal.mjs [--dist <dir>]   (after the build)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--dist');
const DIST = i > 0 ? resolve(process.argv[i + 1]) : join(SITE, 'dist');
const CITAS = [{ slug: 'amblycephalum', campo: 'distribution', cita: 'SEMARNAT (2018), PACE Ambystoma, p. 20' }];
const norm = (t) => String(t).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };

/** The quotation and the citation that follows it on a built page, or nulls. */
export function citaEnPagina(html) {
  const m = html.match(/<blockquote[^>]*data-cita-literal[^>]*>([\s\S]*?)<\/blockquote>\s*<figcaption[^>]*>\s*<cite[^>]*data-cita-fuente[^>]*>([\s\S]*?)<\/cite>/);
  return m ? { texto: norm(m[1]), cita: norm(m[2]) } : { texto: null, cita: null };
}
// self-test: a planted page with the quotation and its citation is read; one without the citation is not
ok(citaEnPagina('<blockquote data-cita-literal>Un  texto</blockquote>\n<figcaption><cite data-cita-fuente>X, p. 1</cite></figcaption>').texto === 'Un texto', 'planted: a quotation followed by its citation is read');
ok(citaEnPagina('<blockquote data-cita-literal>Un texto</blockquote><p>sin cita</p>').texto === null, 'planted: a quotation without its citation is not a quotation');

const atestada = (slug, campo) => {
  const huella = join(DIST, 'atlas/datos/huella');
  const carpeta = existsSync(huella) ? readdirSync(huella).find((d) => /-perfiles$/.test(d)) : null;
  const atlas = JSON.parse(readFileSync(join(SITE, 'src/data/atlas-snapshot/especies-atlas.json'), 'utf8'));
  const especie = atlas.especies.find((e) => e.slug === slug || e.slug?.endsWith(`_${slug}`));
  const delAtlas = especie?.profile?.campos?.[campo]?.es ?? null;
  if (!carpeta) return { texto: delAtlas, de: 'el snapshot del atlas' };
  const filas = readFileSync(join(huella, carpeta, 'taxon_profiles.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  const fila = filas.find((f) => f.field === campo && f.locale === 'es' && f.verbatim && norm(f.body) === norm(delAtlas ?? ''));
  return { texto: fila?.body ?? null, de: `el bundle atestado (${carpeta})` };
};
for (const c of CITAS) {
  const html = readFileSync(join(DIST, 'especies', c.slug, 'index.html'), 'utf8');
  const { texto, cita } = citaEnPagina(html);
  const a = atestada(c.slug, c.campo);
  ok(texto !== null && a.texto !== null && texto === norm(a.texto), `${c.slug}: the rendered quotation is the attested ${c.campo} text, from ${a.de}`);
  ok(cita === c.cita && /\bp\. \d+$/.test(cita ?? ''), `${c.slug}: the quotation is followed by «${c.cita}» (with its page)`);
}

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
