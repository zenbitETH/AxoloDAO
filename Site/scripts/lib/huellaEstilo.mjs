// The look of the two fingerprint pages (lib/huella.mjs, lib/huellaXolotlcalli.mjs): the site's water palette and type, and the motion of the
// InnovaFest v8 video (video/remotion/src/v8.tsx V8Huella, Huella, V8Coincide) ported to CSS and inline SVG. Still plain HTML: no script, and
// every animation starts from a keyframe and ends on the element's own style, so with reduced motion (or no animation at all) the final state shows.

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const n2 = (x) => Number(x.toFixed(2));

/** The fingerprint drawn from its own hex digits (v8 `Huella`): 9 concentric arcs, ring k shaped by digits 3k..3k+2, so the picture is the hash. */
export function glifo(hash, { etiqueta = null } = {}) {
  const hex = String(hash ?? '').replace(/^0x/, '');
  if (!/^[0-9a-f]{27,}$/i.test(hex)) throw new Error('the fingerprint figure needs a hex hash');
  const anillos = Array.from({ length: 9 }, (_, k) => {
    const r = 8 + k * 4.6, circ = 2 * Math.PI * r;
    const [a, b, c] = [0, 1, 2].map((j) => parseInt(hex[k * 3 + j], 16));
    const seg = circ * (0.25 + a / 40), gap = circ * (0.04 + b / 160);
    return `<circle r="${n2(r)}" stroke-dasharray="${n2(seg)} ${n2(gap)} ${n2(seg * 0.4)} ${n2(gap)}" stroke-dashoffset="${-c * 3}" transform="rotate(${c * 22 - 90})" style="--k:${k};--desde:${n2(-c * 3 - circ)}"/>`;
  }).join('');
  const a11y = etiqueta ? `role="img" aria-label="${esc(etiqueta)}"` : 'aria-hidden="true"';
  return `<svg class="anillos" viewBox="-50 -50 100 100" ${a11y}>${anillos}</svg>`;
}

const marca = '<path d="M4 11.5l4.5 4.5L18 6.5"/>';
// one line-drawn icon per step of the chain (the v8 scene's nodes), on a 48×48 grid
const ICONOS = {
  hub: '<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="12" rx="13" ry="4.5"/><path d="M11 12v8c0 2.5 5.8 4.5 13 4.5s13-2 13-4.5v-8M11 20v8c0 2.5 5.8 4.5 13 4.5s13-2 13-4.5v-8M11 28v8c0 2.5 5.8 4.5 13 4.5s13-2 13-4.5v-8"/></svg>',
  registro: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 24h10M32 24h10"/><circle cx="24" cy="24" r="7.5"/><path d="M14 10h20M14 38h20"/></svg>',
  build: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="9" y="8" width="30" height="32" rx="4"/><path d="M15 17h9M15 24h11M15 31h8"/><g transform="translate(25 11) scale(.55)">${marca}</g><g transform="translate(26 18) scale(.55)">${marca}</g><g transform="translate(25 25) scale(.55)">${marca}</g></svg>`,
  archivos: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="9" y="9" width="8" height="8" rx="1.5"/><rect x="20" y="9" width="8" height="8" rx="1.5"/><rect x="31" y="9" width="8" height="8" rx="1.5"/><rect x="9" y="20" width="8" height="8" rx="1.5"/><rect x="20" y="20" width="8" height="8" rx="1.5"/><rect x="31" y="20" width="8" height="8" rx="1.5"/><rect x="9" y="31" width="8" height="8" rx="1.5"/><rect x="20" y="31" width="8" height="8" rx="1.5"/></svg>',
  listado: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 13h4M18 13h20M10 21h4M18 21h16M10 29h4M18 29h20M10 37h4M18 37h12"/></svg>',
  sepolia: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="17" stroke-dasharray="3 3.2"/><g transform="translate(16 11)"><path d="M8 0 0 13l8 5 8-5z"/><path d="M0 15l8 11 8-11-8 5z"/></g></svg>',
  coincide: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="15"/><g transform="translate(13 13)">${marca}</g></svg>`,
};

/** The chain of the v8 fingerprint scene as an ordered list. `pasos`: [{ icono, titulo, texto, pendiente? }]; with `hash` the «huella» step draws
 *  the fingerprint itself. Seven steps lay out as the video's U on a wide screen (four across, then back) and as a column on a narrow one. */
export function cadena(pasos, { hash = null } = {}) {
  const INICIO = 0.3, PASO = 0.55;
  const filas = pasos.map((p, i) => {
    const sig = pasos[i + 1];
    const dir = !sig ? null : i < 3 ? 'der' : i === 3 ? 'abajo' : 'izq';
    const ocre = p.icono === 'listado' || p.icono === 'huella';
    const vars = `--k:${i};--d:${n2(INICIO + i * PASO)}s;--dn:${n2(INICIO + (i + 1) * PASO)}s`;
    const enlace = !sig ? '' : `<span class="enlace${sig.pendiente ? ' corta' : ''}${ocre ? ' ocre' : ''}" data-dir="${dir}" aria-hidden="true"></span>`;
    const icono = p.icono === 'huella' ? (hash ? glifo(hash) : ICONOS.listado) : ICONOS[p.icono];
    return `<li class="paso${p.pendiente ? ' pendiente' : ''}${p.icono === 'huella' ? ' es-huella' : ''}" style="${vars}"><span class="icono">${icono}</span>${enlace}<strong>${esc(p.titulo)}</strong><span class="nota">${esc(p.texto)}</span></li>`;
  });
  return `<ol class="cadena">\n${filas.join('\n')}\n</ol>`;
}

/** The v8 comparison: the listing's hash as computed from the served file against the one the attestation carries, swept character by
 *  character, ending in «coincide» only when they are the same string. */
export function comparacion({ calculada, atestada }) {
  const fila = (h) => `<code class="hash">${[...String(h)].map((ch, i) => `<span style="--i:${i}">${esc(ch)}</span>`).join('')}</code>`;
  const igual = String(calculada).toLowerCase() === String(atestada).toLowerCase();
  return `<div class="comparacion">
<dl>
<div><dt>Calculada del listado que sirve este sitio</dt><dd>${fila(calculada)}</dd></div>
<div><dt>Atestada en Sepolia</dt><dd>${fila(atestada)}</dd></div>
<i class="barrido" aria-hidden="true"></i>
</dl>
<p class="veredicto${igual ? '' : ' no'}"><span class="sello">${igual ? `<svg viewBox="0 0 22 22" aria-hidden="true">${marca}</svg>coincide` : 'no coincide'}</span> <span>Comparadas al construir el sitio, carácter por carácter.</span></p>
</div>`;
}

/** The head of either page: its title, the site's two typefaces, and the style below. */
export const cabeza = (titulo) => `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><meta name="color-scheme" content="dark"><title>${esc(titulo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&amp;family=Montserrat:wght@400;500;600&amp;display=swap">
<style>${ESTILO}</style>`;

/** The bar above either page: back to the site. */
export const barra = '<nav class="barra"><a href="/">AxoloDAO</a></nav>';

export const ESTILO = `
:root{--fondo:#071F29;--panel:#0A3346;--panel2:#0E4555;--linea:rgba(127,211,206,.2);--tinta:#F6EFE0;--texto:#D7E4EA;--suave:#9FBAC4;--teal:#009C9C;--agua:#7FD3CE;--ocre:#E69F51;--r:1.6rem;--g:1.25rem;--rg:2.5rem}
*{box-sizing:border-box}
html{background:var(--fondo);-webkit-text-size-adjust:100%}
body{margin:0;font:400 1rem/1.6 Montserrat,system-ui,sans-serif;color:var(--texto);background:radial-gradient(50rem 30rem at 88% -6rem,rgba(0,156,156,.2),transparent 70%) no-repeat,var(--fondo)}
.hoja{max-width:62rem;margin:0 auto;padding:1rem 1rem 5rem}
a{color:var(--agua);text-decoration-thickness:1px;text-underline-offset:.2em}
a:hover{color:var(--tinta)}
a:focus-visible{outline:2px solid var(--ocre);outline-offset:3px;border-radius:3px}
code{font:500 .8125rem/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--suave);overflow-wrap:anywhere}
h1,h2{font-family:'Baloo 2',system-ui,sans-serif;color:var(--tinta);font-weight:700;line-height:1.1}
h1{font-size:clamp(2.1rem,5.4vw,3.5rem);font-weight:800;margin:0;letter-spacing:-.01em;text-wrap:balance}
h2{font-size:1.5rem;margin:3rem 0 .9rem}
p{max-width:44rem}
.barra{padding:.25rem 0 2rem}
.barra a{font:800 1.3rem/1 'Baloo 2',system-ui,sans-serif;color:var(--tinta);text-decoration:none}
.barra a:hover{color:var(--agua)}

.portada{display:grid;grid-template-columns:minmax(0,1fr) 11rem;gap:1.5rem 3rem;align-items:center}
.figura{margin:0;text-align:center}
.anillos{display:block;width:100%;height:auto;overflow:visible}
.anillos circle{fill:none;stroke:var(--ocre);stroke-width:2.1;stroke-linecap:round;animation:anillo .9s cubic-bezier(.2,.7,.2,1) calc(var(--o,.15s) + var(--k) * var(--paso,.09s)) both}
.figura .anillos{filter:drop-shadow(0 0 14px rgba(230,159,81,.35))}
.figura figcaption{font-size:.75rem;line-height:1.4;color:var(--suave);margin-top:.6rem}
@keyframes anillo{from{stroke-dashoffset:var(--desde);opacity:0}}

.intro{margin-top:1.75rem}
.intro > section > p{margin:.5rem 0}
.intro > section > p:first-child{display:inline-flex;align-items:center;gap:.65rem;padding:.5rem 1rem .5rem .8rem;border-radius:1rem;background:rgba(0,156,156,.16);border:1px solid rgba(127,211,206,.4);color:var(--tinta);font-weight:600;margin-top:0}
.intro > section > p:first-child::before{content:"";flex:none;width:.6rem;height:.6rem;border-radius:50%;background:var(--agua);animation:latido 2.2s ease-out 4.6s 2}
.intro.espera > section > p:first-child{background:rgba(230,159,81,.12);border-color:rgba(230,159,81,.45)}
.intro.espera > section > p:first-child::before{background:none;border:2px solid var(--ocre);animation:none}
@keyframes latido{from{box-shadow:0 0 0 0 rgba(127,211,206,.7)}to{box-shadow:0 0 0 .7rem rgba(127,211,206,0)}}
.intro > section > p:not(:first-child){font-size:.9375rem;color:var(--suave)}
.intro > section > p a{color:var(--texto)}
.lados{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin-top:1.75rem}
.lado{padding:1.1rem 1.25rem 1.2rem;border-radius:1.1rem;background:var(--panel);border:1px solid var(--linea)}
.lado h2{font-size:1.2rem;margin:0 0 .6rem}
.lado ul{margin:0;padding:0;list-style:none}
.lado li{position:relative;padding:.2rem 0 .2rem 1.35rem}
.lado li::before{content:"";position:absolute;left:.1rem;top:.72rem;width:.55rem;height:.55rem;border-radius:50%;background:var(--agua)}
.lado.fuera li::before{background:none;border:1.5px dashed var(--ocre)}
.lado p{margin:.7rem 0 0;font-size:.875rem;color:var(--suave)}
.intro > section > .lados ~ p{margin:1.25rem 0 0;padding:.1rem 0 .1rem 1rem;border-left:3px solid rgba(230,159,81,.45);font-size:.9375rem;color:var(--texto)}
.intro > section > .lados ~ p:last-child{font:600 1.15rem/1.45 'Baloo 2',system-ui,sans-serif;color:var(--tinta);border-left-color:var(--ocre)}

.cadena{list-style:none;margin:1.75rem 0 0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));column-gap:var(--g);row-gap:var(--rg)}
.paso{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:.25rem;animation:encender .6s ease-out var(--d) both}
.paso:nth-child(5){grid-area:2/4}.paso:nth-child(6){grid-area:2/3}.paso:nth-child(7){grid-area:2/2}
.paso strong{font:700 1.08rem/1.2 'Baloo 2',system-ui,sans-serif;color:var(--tinta);margin-top:.45rem}
.paso .nota{font-size:.8125rem;line-height:1.45;color:var(--suave);max-width:15rem}
.icono{position:relative;z-index:1;flex:none;width:calc(var(--r) * 2);height:calc(var(--r) * 2);border-radius:50%;display:grid;place-items:center;background:var(--panel);border:1.5px solid var(--agua);box-shadow:0 0 18px rgba(127,211,206,.25)}
.icono svg{width:62%;height:62%;fill:none;stroke:var(--agua);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.icono::after{content:"";position:absolute;inset:-2px;border-radius:50%;border:2px solid var(--agua);opacity:0;animation:onda 1s ease-out var(--d) 1}
.es-huella .icono{border-color:var(--ocre);box-shadow:0 0 18px rgba(230,159,81,.3)}
.es-huella .icono::after{border-color:var(--ocre)}
.es-huella .anillos{width:80%;height:80%}
.es-huella .anillos circle{stroke-width:3;--o:var(--d);--paso:.05s}
@keyframes encender{from{opacity:.25}}
@keyframes onda{from{opacity:.9;transform:scale(1)}to{opacity:0;transform:scale(1.55)}}
.paso.pendiente{animation:none;opacity:.55}
.pendiente .icono{border-style:dashed;border-color:var(--ocre);box-shadow:none}
.pendiente .icono svg{stroke:var(--ocre)}
.pendiente .icono::after{display:none}
.pendiente strong{color:var(--ocre)}

.enlace{position:absolute;--c:var(--agua);background:rgba(127,211,206,.16)}
.enlace.ocre{--c:var(--ocre)}
.enlace::before{content:"";position:absolute;inset:0;background:var(--c);box-shadow:0 0 8px var(--c);animation:trazo-x .45s ease-in-out calc(var(--dn) - .45s) both}
.enlace::after{content:"";position:absolute;width:.55rem;height:.55rem;border-radius:50%;background:var(--c);box-shadow:0 0 10px var(--c);opacity:0;top:50%;left:0;translate:-50% -50%;animation:viaje-der 6.6s linear calc(4.6s + var(--k) * 1.1s) infinite}
.enlace[data-dir=der],.enlace[data-dir=izq]{top:calc(var(--r) - 1px);height:2px;width:calc(100% + var(--g) - var(--r) * 2)}
.enlace[data-dir=der]{left:calc(50% + var(--r))}
.enlace[data-dir=der]::before{transform-origin:left}
.enlace[data-dir=izq]{right:calc(50% + var(--r))}
.enlace[data-dir=izq]::before{transform-origin:right}
.enlace[data-dir=izq]::after{animation-name:viaje-izq}
.enlace[data-dir=abajo]{left:calc(50% + var(--r));right:calc(var(--g) * -1);top:calc(var(--r) - 1px);height:calc(100% + var(--rg));background:none;border:2px solid rgba(127,211,206,.16);border-left:0;border-radius:0 1.25rem 1.25rem 0}
.enlace[data-dir=abajo]::before{inset:-2px -2px -2px 0;background:none;box-shadow:none;border:2px solid var(--c);border-left:0;border-radius:inherit;filter:drop-shadow(0 0 4px var(--c));animation-name:revela}
.enlace[data-dir=abajo]::after{top:0;animation-name:viaje-vuelta}
.enlace.corta{background:repeating-linear-gradient(90deg,rgba(230,159,81,.6) 0 6px,transparent 6px 12px)}
.enlace.corta[data-dir=abajo]{background:repeating-linear-gradient(180deg,rgba(230,159,81,.6) 0 6px,transparent 6px 12px)}
.enlace.corta::before,.enlace.corta::after{display:none}
@keyframes trazo-x{from{transform:scaleX(0)}}
@keyframes trazo-y{from{transform:scaleY(0)}}
@keyframes viaje-der{0%{left:0;opacity:1}16%{left:100%;opacity:1}17%,100%{left:100%;opacity:0}}
@keyframes viaje-izq{0%{left:100%;opacity:1}16%{left:0;opacity:1}17%,100%{left:0;opacity:0}}
@keyframes revela{from{clip-path:inset(0 100% 100% 0)}to{clip-path:inset(0)}}
@keyframes viaje-vuelta{0%{left:0;top:0;opacity:1}4%{left:100%;top:0}12%{left:100%;top:100%}16%{left:0;top:100%;opacity:1}17%,100%{left:0;top:100%;opacity:0}}
@keyframes viaje-abajo{0%{top:0;opacity:1}16%{top:100%;opacity:1}17%,100%{top:100%;opacity:0}}

.comparacion{margin-top:1.25rem;padding:1.4rem 1.5rem 1.5rem;border-radius:1.25rem;background:var(--panel);border:1px solid var(--linea)}
.comparacion dl{position:relative;margin:0;display:grid;gap:1rem}
.comparacion dt{font-size:.875rem;font-weight:600;color:var(--agua)}
.comparacion dd{margin:.2rem 0 0}
.hash{font-size:.95rem;letter-spacing:.02em;color:var(--agua)}
.hash span{animation:leer .2s linear calc(4.3s + var(--i) * 18ms) both}
@keyframes leer{from{color:var(--tinta)}}
.barrido{position:absolute;top:-.4rem;bottom:-.4rem;left:0;width:3px;border-radius:2px;background:var(--agua);box-shadow:0 0 16px var(--agua);opacity:0;animation:barrer 1.25s ease-in-out 4.3s 1}
@keyframes barrer{0%{left:0;opacity:.95}95%{opacity:.95}100%{left:100%;opacity:0}}
.veredicto{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem 1rem;margin:1.25rem 0 0}
.sello{display:inline-flex;align-items:center;gap:.5rem;padding:.35rem 1.1rem .35rem .8rem;border-radius:999px;background:var(--teal);color:#fff;font:700 1.35rem/1.2 'Baloo 2',system-ui,sans-serif;animation:sello .55s cubic-bezier(.3,1.6,.5,1) 5.6s both}
.sello svg{width:1.4rem;height:1.4rem;fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
.veredicto.no .sello{background:#9B3B2E}
.veredicto > span:last-child{font-size:.8125rem;color:var(--suave)}
@keyframes sello{from{transform:scale(.4);opacity:0}}

.pasos{margin:0;padding:0;list-style:none;counter-reset:p;display:grid;gap:.9rem}
.pasos li{counter-increment:p;position:relative;padding-left:2.6rem;max-width:46rem}
.pasos li::before{content:counter(p);position:absolute;left:0;top:-.05rem;width:1.8rem;height:1.8rem;border-radius:50%;display:grid;place-items:center;background:var(--panel2);color:var(--agua);font:700 .95rem/1 'Baloo 2',system-ui,sans-serif}
.pasos code{display:inline-block;margin-top:.3rem;padding:.15rem .5rem;border-radius:.4rem;background:var(--panel);color:var(--texto)}

.archivos{margin-top:3.5rem;padding-top:.5rem;border-top:1px solid var(--linea)}
.archivos > p{font-size:.9375rem}
.archivos h2{font-size:1.15rem;margin:2.2rem 0 .5rem;color:var(--agua);overflow-wrap:anywhere}
.archivos ul{margin:0;padding:0;list-style:none}
.archivos li{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:.5rem;padding:.55rem 0;border-bottom:1px solid rgba(127,211,206,.1);font-size:.9375rem}
.archivos li > a:first-child{color:var(--tinta);font-weight:500;text-decoration-color:rgba(246,239,224,.3)}
.archivos li > code{order:1;flex-basis:100%;font-size:.75rem}
.archivos li > br{display:none}
.archivos li > a + code + a{font-size:.8125rem}
.archivos li > span{font-size:.8125rem;color:var(--ocre)}
.archivos li > span a{color:var(--ocre)}

@media (max-width:46rem){
.portada{grid-template-columns:minmax(0,1fr) 6.5rem;gap:1rem;align-items:start}
.figura figcaption{display:none}
.lados{grid-template-columns:1fr}
.cadena{grid-template-columns:1fr;row-gap:1.5rem;--rg:1.5rem}
.paso{display:grid;grid-template-columns:calc(var(--r) * 2) minmax(0,1fr);column-gap:1rem;align-items:start;text-align:left}
.paso:nth-child(n){grid-area:auto}
.paso .icono{grid-row:1/span 2}
.paso strong{margin-top:.35rem}
.paso .nota{max-width:none}
.enlace[data-dir]{left:calc(var(--r) - 1px);right:auto;top:calc(var(--r) * 2);width:2px;height:calc(100% - var(--r) * 2 + var(--rg));border:0;border-radius:0;background:rgba(127,211,206,.16)}
.enlace[data-dir]::before{inset:0;border:0;border-radius:0;background:var(--c);box-shadow:0 0 8px var(--c);filter:none;transform-origin:top;animation-name:trazo-y}
.enlace[data-dir]::after{top:0;left:50%;animation-name:viaje-abajo}
.enlace.corta[data-dir]{background:repeating-linear-gradient(180deg,rgba(230,159,81,.6) 0 6px,transparent 6px 12px)}
.comparacion{padding:1.1rem 1rem 1.2rem}
.hash{font-size:.78rem}
.barrido{display:none}
}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important}}
`;
