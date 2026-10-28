// conPais for the cases the data does not have today (a species of Canada alone) and for the group label of each country.
import { uiText, conPais } from '../../src/components/atlas/uiText.ts';
let f = 0; const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) f++; };
const eq = (loc, key, paises, esperado) => { const r = conPais(uiText[loc], loc, uiText[loc][key], paises); ok(r === esperado, `${loc} ${key} ${paises.join('+')}: «${r}»${r === esperado ? '' : ` (expected «${esperado}»)`}`); };
eq('es', 'valueEndemicOf', ['CA'], 'Endémica de Canadá'); eq('en', 'valueEndemicOf', ['CA'], 'Endemic to Canada'); eq('pt', 'valueEndemicOf', ['CA'], 'Endêmica do Canadá');
eq('es', 'endemicOnly', ['CA'], 'Sólo se registra en Canadá'); eq('en', 'endemicOnly', ['CA'], 'Recorded only in Canada'); eq('pt', 'endemicOnly', ['CA'], 'Registrada só no Canadá');
eq('es', 'valueEndemicOf', ['US'], 'Endémica de los Estados Unidos'); eq('en', 'valueEndemicOf', ['US'], 'Endemic to the United States'); eq('pt', 'valueEndemicOf', ['US'], 'Endêmica dos Estados Unidos');
eq('es', 'notEndemicIn', ['MX', 'CA'], 'Se registra en México y en Canadá'); eq('en', 'notEndemicIn', ['MX', 'CA'], 'Recorded in Mexico and in Canada'); eq('pt', 'notEndemicIn', ['MX', 'CA'], 'Registrada no México e no Canadá');
eq('es', 'presenceOf', ['CA'], 'Provincias de Canadá'); eq('en', 'presenceOf', ['CA'], 'Provinces in Canada'); eq('pt', 'presenceOf', ['CA'], 'Províncias do Canadá');
eq('pt', 'presenceOf', ['US'], 'Estados dos Estados Unidos'); eq('en', 'presenceOf', ['MX'], 'States in Mexico');
ok(Object.keys(uiText.es).every((k) => k in uiText.en && k in uiText.pt) && Object.keys(uiText.en).every((k) => k in uiText.es), 'the three languages carry the same keys');
process.exit(f ? 1 : 0);
