#!/usr/bin/env node
/**
 * limpiar-datos-publicos.mjs: deja los datos publicados sin datos de personas (ver lib/limpiar-personas.mjs) y escribe las huellas de la
 * lista privada de nombres en src/data/personas-huellas.json. Es idempotente. Los generadores (data-*.mjs) escriben limpio por su cuenta;
 * esto limpia los archivos que ya estaban confirmados.
 *
 *   AXOLODAO_PERSONAS_PRIVADAS=/ruta/privada/personas.txt node scripts/limpiar-datos-publicos.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { huellasDePersonas, huellasPorRol, huellaDe, leerPersonasConRol, limpiarValor, sha256 } from './lib/limpiar-personas.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const personas = leerPersonasConRol(process.env.AXOLODAO_PERSONAS_PRIVADAS);
const { huellas, digest, fichas } = huellasDePersonas(personas.map((p) => p.nombre));
// Sólo se publica quién PUEDE salir en lo editorial (host, consentimiento): que alguien sea personal, practicante, esté en la lista de embargo o
// haya pedido que lo retiren es privado. Todo lo demás de la lista es «el equipo».
const todosLosRoles = huellasPorRol(personas);
const roles = { host: todosLosRoles.host, consentimiento: todosLosRoles.consentimiento };
const digestRoles = sha256(Object.entries(roles).map(([r, hs]) => `${r}:${hs.join(',')}`).join('\n'));

function* json(dir) {
  if (!existsSync(dir)) return;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) yield* json(p);
    else if (n.endsWith('.json') && n !== 'personas-huellas.json' && n !== 'lista-de-alias.json') yield p;
  }
}

let cambiados = 0;
for (const raiz of ['src/data', 'public/data']) {
  for (const f of json(join(SITE, raiz))) {
    const texto = readFileSync(f, 'utf8');
    const limpio = limpiarValor(JSON.parse(texto), huellas);
    const sangria = /^[\[{]\s*\n( +)\S/.exec(texto)?.[1].length ?? (texto.trim().startsWith('{"') || texto.trim().startsWith('[{') ? 0 : 2);
    const salida = `${JSON.stringify(limpio, null, sangria || undefined)}\n`;
    if (salida !== texto) { writeFileSync(f, salida); cambiados++; console.log(`  limpio ${f.slice(SITE.length + 1)}`); }
  }
}
writeFileSync(join(SITE, 'src/data/personas-huellas.json'), `${JSON.stringify({
  _nota: 'Las huellas (HMAC-SHA256 con una clave fuera del repositorio, de la ficha normalizada) de la lista privada de nombres de personal, para que la prueba de CI los busque en lo publicado. Los nombres no están en el repositorio.',
  digest, fichas, huellas: [...huellas].sort(),
  // Quién puede salir en lo editorial: los hosts y quien dio su consentimiento por escrito. Cualquier otra ficha de la lista es «el equipo».
  digestRoles, roles,
  // HMAC de una palabra fija: la prueba lo recalcula con la clave que tenga y así sabe que es la de estas huellas.
  centinela: huellaDe('centinela'),
}, null, 2)}\n`);
console.log(`${cambiados} archivo(s) limpiados; lista de personas ${digest.slice(0, 12)}… (${fichas} fichas)`);
