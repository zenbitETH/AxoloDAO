// The atlas data, written once at build (one shared read, src/lib/atlasLectura.mjs): from the hub (HUB_BUILD_URL, else PUBLIC_HUB_URL) when it answers in full, else the committed files (src/lib/atlasSnapshot.mjs).
// ATLAS_HUB_LAXO=1 turns strictness off (for the tests that build against a stub hub, never for a site build).
// With a hub URL the build is STRICT: a file that falls back to the committed one, or that differs from it in any property, stops the build and names the file.
// The booth's hub key (HUB_KEY_FILE, a mode-600 file, with its header name in HUB_KEY_HEADER) is sent to the hub only and never printed.
import type { APIRoute } from 'astro';
import { ARCHIVOS } from '@/lib/atlasSnapshot.mjs';
import { leerAtlas } from '@/lib/atlasLectura.mjs';

export function getStaticPaths() {
  return ARCHIVOS.map((archivo) => ({ params: { archivo } }));
}

export const GET: APIRoute = async ({ params }) => {
  const nombre = String(params.archivo);
  const datos = await leerAtlas(nombre, { publica: (import.meta.env.PUBLIC_HUB_URL ?? '') as string });
  const tipo = nombre.endsWith('.geojson') ? 'application/geo+json' : 'application/json';
  return new Response(JSON.stringify(datos) + '\n', { headers: { 'content-type': tipo } });
};
