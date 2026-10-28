import { validate } from './validate_palette.mjs';
const H = { blue:'#3987e5', orange:'#d95926', aqua:'#199e70', yellow:'#c98500', magenta:'#d55181', green:'#008300', violet:'#9085e9', red:'#e66767' };
const names = Object.keys(H);
const cell = (a,b)=>{ const {report}=validate([H[a],H[b]],{mode:'dark',surface:'#274b57'}); const c=report[2][2].match(/ΔE ([\d.]+)/)[1]; const n=report[3][2].match(/ΔE ([\d.]+)/)[1]; return `${(+c).toFixed(0)}/${(+n).toFixed(0)}`; };
console.log('pair CVD/normal ΔE (OKLab×100), dark; need >=8 / >=15');
console.log(''.padEnd(8)+names.map(n=>n.padEnd(8)).join(''));
for (const a of names) console.log(a.padEnd(8)+names.map(b=>a===b?'-'.padEnd(8):cell(a,b).padEnd(8)).join(''));
