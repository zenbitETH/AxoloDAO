// A generic salamander in DORSAL (top) view, outline only, drawn for this atlas (own vector, from scratch: no photograph and no image of any animal was traced). Straight, symmetric, no pose, no markings.
// The main drawing carries four measurement lines (total, snout-vent, tail, head width) and says «sin dato» for a missing one; the mini drawings are the same outline scaled, so species can be compared at the same scale.
// The shape is a schematic: it does not change with the species.
export interface Cota { id: 'total' | 'svl' | 'tail' | 'head'; label: string; value: string | null }

const CUERPO = 'M20 110C20.7 108.5 21.7 104.2 24 101C26.3 97.8 29.3 93.8 34 91C38.7 88.2 45 85.7 52 84C59 82.3 68 81 76 81C84 81 92.7 83 100 84C107.3 85 111.7 87 120 87C128.3 87 136.7 85.2 150 84C163.3 82.8 181.7 81 200 80C218.3 79 240 78 260 78C280 78 303.3 79.2 320 80C336.7 80.8 349.2 82 360 83C370.8 84 373.3 84.7 385 86C396.7 87.3 414.2 89.2 430 91C445.8 92.8 463.3 95 480 97C496.7 99 515.8 101.3 530 103C544.2 104.7 556.7 105.8 565 107C573.3 108.2 577.5 109.5 580 110C577.5 110.5 573.3 111.8 565 113C556.7 114.2 544.2 115.3 530 117C515.8 118.7 496.7 121 480 123C463.3 125 445.8 127.2 430 129C414.2 130.8 396.7 132.7 385 134C373.3 135.3 370.8 136 360 137C349.2 138 336.7 139.2 320 140C303.3 140.8 280 142 260 142C240 142 218.3 141 200 140C181.7 139 163.3 137.2 150 136C136.7 134.8 128.3 133 120 133C111.7 133 107.3 135 100 136C92.7 137 84 139 76 139C68 139 59 137.7 52 136C45 134.3 38.7 131.8 34 129C29.3 126.2 26.3 122.2 24 119C21.7 115.8 20.7 111.5 20 110Z';
const PATAS = ['M161.3 80.1C158.8 77.1 148.3 67.8 146.3 62C144.3 56.3 148.8 48.2 149.4 45.5L134.6 42.5C133.8 46.4 128.4 57.7 129.7 66C131.1 74.2 140.6 87.6 142.7 91.9Z', 'M341.7 94.3C344.9 90 359.1 76.7 360.6 68.5C362.2 60.3 352.5 48.9 350.9 45L337.1 51C338.2 53.1 345.5 59 343.4 63.5C341.2 67.9 327.5 75.4 324.3 77.7Z', 'M142.7 128.1C140.6 132.4 131.1 145.8 129.7 154C128.4 162.3 133.8 173.6 134.6 177.5L149.4 174.5C148.8 171.8 144.3 163.7 146.3 158C148.3 152.2 158.8 142.9 161.3 139.9Z', 'M324.3 142.3C327.5 144.6 341.2 152.1 343.4 156.5C345.5 161 338.2 166.9 337.1 169L350.9 175C352.5 171.1 362.2 159.7 360.6 151.5C359.1 143.3 344.9 130 341.7 125.7Z'];
const DEDOS = ['M136.9 43L132.7 29.9M140.3 43.7L140.5 31.5M143.7 44.3L148.2 33M147.1 45L156 34.6', 'M339.2 50.1L328.3 41.8M342.4 48.7L335.5 38.6M345.6 47.3L342.7 35.4M348.8 45.9L350 32.2', 'M147.1 175L156 185.4M143.7 175.7L148.2 187M140.3 176.3L140.5 188.5M136.9 177L132.7 190.1', 'M348.8 174.1L350 187.8M345.6 172.7L342.7 184.6M342.4 171.3L335.5 181.4M339.2 169.9L328.3 178.2'];

interface Props { cotas?: Cota[]; noData?: string; color?: string; schematic?: string; mini?: boolean; escala?: number; /** the species on screen: drawn thicker, in its own colour */ destacada?: boolean }

export function Silhouette(p: Props) {
  const color = p.color ?? '#f4e8c8';
  // the limbs are drawn first and filled with the panel's colour, then the body over them, so a limb comes out from behind the flank
  const dibujo = (
    <>
      <g fill="var(--sil-bg, #0a2d3a)">{PATAS.map((d) => <path d={d} />)}</g>
      <g fill="none">{DEDOS.map((d) => <path d={d} />)}</g>
      <path d={CUERPO} fill="var(--sil-bg, #0a2d3a)" />
    </>
  );
  if (p.mini) {
    // the same outline at the scale of its length, anchored at the left like the bars of a chart, so the rows of a comparison read against each other; its line stays 1.6 px (2.6 px for the species on show)
    const e = p.escala ?? 1;
    return <svg class="at-mini" viewBox="10 36 580 148" width="230" height="59" aria-hidden="true" preserveAspectRatio="xMinYMid meet"><g fill="none" stroke={color} style={{ strokeWidth: p.destacada ? '2.6px' : '1.6px' }} stroke-linejoin="round" stroke-linecap="round" transform={`translate(20 110) scale(${e}) translate(-20 -110)`}>{dibujo}</g></svg>;
  }
  const c = Object.fromEntries((p.cotas ?? []).map((k) => [k.id, k]));
  const linea = (x1: number, y1: number, x2: number, y2: number, k: Cota, rotar = false, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2 - 8) => {
    const hay = k.value !== null;
    const texto = `${k.label}: ${hay ? k.value : p.noData}`;
    // the head-width label has no room on the line: it goes in two lines above the head, ending where the line starts
    return (
      <g class="at-cota" data-cota={k.id} data-nodata={hay ? undefined : '1'}>
        <title>{texto}</title>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke-dasharray={hay ? undefined : '5 4'} />
        {rotar ? <><line x1={x1 - 5} y1={y1} x2={x1 + 5} y2={y1} /><line x1={x2 - 5} y1={y2} x2={x2 + 5} y2={y2} /></> : <><line x1={x1} y1={y1 - 6} x2={x1} y2={y1 + 6} /><line x1={x2} y1={y2 - 6} x2={x2} y2={y2 + 6} /></>}
        {rotar
          ? <text text-anchor="end"><tspan x={x1 - 6} y={y1 - 22}>{k.label}</tspan><tspan x={x1 - 6} y={y1 - 4}>{hay ? k.value : p.noData}</tspan></text>
          : <text x={cx} y={cy} text-anchor="middle">{texto}</text>}
      </g>
    );
  };
  return (
    <figure class="at-sil" data-silhouette>
      <svg viewBox="-10 -6 620 262" role="img" aria-label={(p.cotas ?? []).map((k) => `${k.label}: ${k.value ?? p.noData}`).join(', ')}>
        <g fill="none" stroke={color} stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">{dibujo}</g>
        <g class="at-cotas">
          {linea(20, 22, 580, 22, c.total, false, 300, 10)}
          {linea(20, 206, 370, 206, c.svl, false, 195, 232)}
          {linea(370, 206, 580, 206, c.tail, false, 475, 232)}
          {linea(76, 81, 76, 139, c.head, true)}
        </g>
      </svg>
      {p.schematic && <figcaption>{p.schematic}</figcaption>}
    </figure>
  );
}
