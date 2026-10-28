export type Trama = 'rayas' | 'puntos' | 'cuadros';

/** A swatch's background: the plain colour, or the colour with the texture of its species (fine diagonal hatching, dots, cross-hatch), the same pattern the map draws on its area. */
export const fondoMuestra = (color: string, trama?: Trama) => {
  if (!trama) return color;
  const tenue = `${color}59`;
  if (trama === 'rayas') return `repeating-linear-gradient(135deg, ${color} 0 1.5px, ${tenue} 1.5px 3.2px)`;
  if (trama === 'puntos') return `radial-gradient(circle at 50% 50%, ${color} 0 1.1px, transparent 1.4px) 0 0 / 3.6px 3.6px, ${tenue}`;
  return `repeating-linear-gradient(45deg, ${color} 0 1.2px, transparent 1.2px 3.2px), repeating-linear-gradient(135deg, ${color} 0 1.2px, ${tenue} 1.2px 3.2px)`;
};

