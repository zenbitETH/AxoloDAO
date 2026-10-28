// The home page's figures come from data and are formatted for each locale (lib/cifrasHome.mjs): no figure typed in a caption, the same
// rendered wording in es, en and pt.   node scripts/test-cifras-home.mjs
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cifrasDe, formatear, llenar } from '../src/lib/cifrasHome.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => JSON.parse(readFileSync(join(SITE, 'src/data/inventario', f), 'utf8'));
const cifras = cifrasDe({ cadena: leer('inventario-cadena-xolotlcalli.json'), atlas: leer('inventario-atlas.json'), taquilla: leer('taquilla-home.json') });

let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };

ok(cifras.especies === 32 && cifras.recintos === 40 && cifras.clips === 1, 'the figures come from the inventories (32 species, 40 facilities on the layer, 1 clip confirmation on Sepolia)');
ok(formatear(cifras.visitas, 'es') === '6,565' && formatear(cifras.visitas, 'en') === '6,565' && formatear(cifras.visitas, 'pt') === '6.565', 'visits per locale: 6,565 · 6,565 · 6.565');
ok(llenar('en {idiomas}.', 'es', cifras) === 'en español, inglés y portugués.', 'languages in es');
ok(llenar('in {idiomas}.', 'en', cifras) === 'in Spanish, English and Portuguese.', 'languages in en, without the serial comma of the approved caption');
ok(llenar('em {idiomas}.', 'pt', cifras) === 'em espanhol, inglês e português.', 'languages in pt');
ok(llenar('Las {especies} especies', 'es', cifras) === 'Las 32 especies', 'a title fills {especies}');
ok(llenar('{sinCifra} y {especies}', 'es', cifras) === null, 'a caption with a placeholder that has no figure is not shown (null)');
ok(llenar('{especies}', 'es', { ...cifras, especies: undefined }) === null, 'a figure the data lacks hides the caption, never prints «undefined»');
ok(formatear(1234567, 'pt') === '1.234.567' && formatear(1234567, 'es') === '1,234,567', 'thousands per locale');

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
