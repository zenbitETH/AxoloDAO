// The home page's entry to the species atlas: North America as one static SVG, drawn at build from the same snapshot the atlas reads
// (the hub when it answers in full, else the committed files). It is an image: no script, nothing to load but this file.
// What it draws is the atlas's first view: richness by state or province as a quiet base, and on top the localities of every species in its colour.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { geoConicConformal, geoPath } from 'd3-geo';
import { leerAtlas } from '@/lib/atlasLectura.mjs';
import { acento, localidadesParaMapa, presenciaPorEspecie, riqueza } from '@/lib/atlasSpecies.mjs';
import { colorDe } from '@/lib/atlasStyle.mjs';
import { ALTO, ANCHO } from '@/lib/atlasPreview.mjs';

const MARCO = [[-126, 12], [-62, 12], [-62, 54], [-126, 54], [-94, 12], [-94, 54], [-126, 33], [-62, 33]];
const FUERA = new Set(['US-AK', 'US-HI']);


/** Drops the points that land within 0.7 px of the previous one: the base geometry is finer than a home page needs. */
const delgado = (salida: any) => {
  let px: number | undefined, py = 0;
  return {
    point(x: number, y: number) { if (px === undefined || Math.hypot(x - px, y - py) >= 0.7) { salida.point(x, y); px = x; py = y; } },
    lineStart() { px = undefined; salida.lineStart(); }, lineEnd() { salida.lineEnd(); },
    polygonStart() { salida.polygonStart(); }, polygonEnd() { salida.polygonEnd(); }, sphere() { salida.sphere(); },
  };
};

/** d3-geo reads rings on the sphere: an exterior ring must run clockwise and a hole counter-clockwise, the opposite of GeoJSON's own rule, or the polygon is the rest of the world. */
const horario = (ring: number[][]) => ring.reduce((a, [x, y], i) => { const [x2, y2] = ring[(i + 1) % ring.length]; return a + (x2 - x) * (y2 + y); }, 0) > 0;
const orientar = (poly: number[][][]) => poly.map((ring, i) => (horario(ring) === (i === 0) ? ring : [...ring].reverse()));
const rebobinar = (f: any) => {
  const g = f.geometry;
  if (g?.type === 'Polygon') return { ...f, geometry: { ...g, coordinates: orientar(g.coordinates) } };
  if (g?.type === 'MultiPolygon') return { ...f, geometry: { ...g, coordinates: g.coordinates.map(orientar) } };
  return f;
};

export const GET: APIRoute = async () => {
  const tomar = (n: string) => leerAtlas(n, { publica: (import.meta.env.PUBLIC_HUB_URL ?? '') as string });
  const [snap, locFc, admin1] = await Promise.all([tomar('especies-atlas.json'), tomar('especies-localidades.geojson'), tomar('admin1.geojson')]);
  const acentos: Record<string, string> = Object.fromEntries((await getCollection('species')).map((s) => [s.data.slug, s.data.accentColor]).filter(([, c]) => c));

  const proy = geoConicConformal().parallels([25, 50]).rotate([96, 0]).center([0, 38]).precision(1);
  proy.fitExtent([[6, 6], [ANCHO - 6, ALTO - 6]], { type: 'MultiPoint', coordinates: MARCO } as any);
  proy.clipExtent([[-2, -2], [ANCHO + 2, ALTO + 2]]);   // nothing outside the picture is written: the Arctic islands would otherwise be megabytes of path
  const camino = geoPath({ stream: (s: any) => proy.stream(delgado(s)) } as any).digits(1);
  const puntos = (c: number[]) => proy(c as [number, number])!.map((v: number) => v.toFixed(1));

  const riq = riqueza(presenciaPorEspecie(snap)) as { fuerte: Record<string, number>; debil: Record<string, number> };
  const total = (iso: string) => (riq.fuerte[iso] ?? 0) + (riq.debil[iso] ?? 0);
  const unidades = admin1.features.filter((f: any) => !FUERA.has(f.properties.iso));
  const max = Math.max(...unidades.map((f: any) => total(f.properties.iso)));

  const partes: string[] = [`<rect width="${ANCHO}" height="${ALTO}" fill="#071f29"/>`, '<g stroke="#7fb6c4" stroke-width=".45" stroke-opacity=".75" fill-opacity=".8">'];
  for (const f of unidades) {
    const d = camino(rebobinar(f));
    if (d) partes.push(`<path d="${d}" fill="${colorDe(total(f.properties.iso), 0, max)}"/>`);
  }
  partes.push('</g>');
  const color = (slug: string) => acentos[slug] ?? acento(slug);
  const locales = localidadesParaMapa(locFc) as { features: any[] };
  for (const f of locales.features) {
    const c = color(f.properties.slug);
    if (f.properties.kind === 'area') partes.push(`<path d="${camino(rebobinar(f))}" fill="${c}" fill-opacity=".4"/>`);
    else if (f.properties.kind === 'outline') partes.push(`<path d="${camino(f)}" fill="none" stroke="${c}" stroke-width="1.4"/>`);
  }
  for (const f of locales.features) {
    if (f.properties.kind !== 'cell' && f.properties.kind !== 'lake') continue;
    const [x, y] = puntos(f.geometry.coordinates);
    partes.push(`<circle cx="${x}" cy="${y}" r="${f.properties.kind === 'lake' ? 4.2 : 3.6}" fill="${color(f.properties.slug)}" stroke="#071f29" stroke-width="1.2"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} ${ALTO}" width="${ANCHO}" height="${ALTO}">${partes.join('')}</svg>\n`;
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml' } });
};
