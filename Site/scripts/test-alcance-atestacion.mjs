// The scope the hero may claim for the atlas attestation (lib/alcanceAtestacion.mjs; the hero's ruled copy, 22-oct): «atlas» only with the six
// bundles covered and none left out, «especies» with the species and the localities, nothing below that.   node scripts/test-alcance-atestacion.mjs
import { alcance } from '../src/lib/alcanceAtestacion.mjs';

let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };

const b = (id, datos = 'load:species-atlas') => ({ id, datos, manifestSha256: `0x${'0'.repeat(64)}` });
const SEIS = [b('944f8dbc53b0-genero', 'load:species-atlas, load:taxa'), b('a1d128c4bf4c-localidades'), b('735c7b3021a1-perfiles'),
  b('a1d128c4bf4c-morfometria'), b('4216080f8b97-admin1'), b('5e8591b04e51', 'load:layers, load:species-states')];
const foto = (cubre, noCubiertos = []) => ({ lectura: { resultado: 'coincide' }, cubre, noCubiertos });

ok(alcance(foto(SEIS)) === 'atlas', 'the six bundles covered, none left out: «atlas»');
ok(alcance(foto(SEIS, [b('0b63ee1244d6-localidades')])) === 'especies', 'the six covered but one bundle the site reads left out: «especies»');
ok(alcance(foto(SEIS.filter((x) => !x.id.endsWith('-admin1')))) === 'especies', 'five of six (no admin1): «especies»');
ok(alcance(foto(SEIS.filter((x) => !x.datos.includes('load:layers')))) === 'especies', 'no layers bundle: «especies»');
ok(alcance(foto(SEIS.slice(0, 2))) === 'especies', 'species and localities only: «especies»');
ok(alcance(foto([SEIS[0]])) === null, 'species without localities: nothing may be claimed');
ok(alcance(foto([])) === null && alcance(undefined) === null && alcance({}) === null, 'no coverage, or no snapshot: nothing may be claimed');
for (const raro of [undefined, null, 'ninguno', {}, 0]) {
  ok(alcance({ ...foto(SEIS), noCubiertos: raro }) === 'especies', `six covered but noCubiertos is not a list (${JSON.stringify(raro)}): at most «especies»`);
}
ok(alcance(foto([...SEIS.slice(0, 5), b('5e8591b04e51', 'load:species-states')])) === 'especies', 'the layers bundle is recognised by load:layers, not by its id');

console.log(fallas ? `\n${fallas} check(s) failed` : '\nall checks passed');
process.exit(fallas ? 1 : 0);
