export const STATE_LABELS_ES: Record<string, string> = {
  AGU: 'Aguascalientes', BCN: 'Baja California', BCS: 'Baja California Sur', CAM: 'Campeche',
  CHH: 'Chihuahua', CHP: 'Chiapas', CMX: 'Ciudad de México', COA: 'Coahuila', COL: 'Colima',
  DUR: 'Durango', GRO: 'Guerrero', GUA: 'Guanajuato', HID: 'Hidalgo', JAL: 'Jalisco',
  MEX: 'Estado de México', MIC: 'Michoacán', MOR: 'Morelos', NAY: 'Nayarit', NLE: 'Nuevo León',
  OAX: 'Oaxaca', PUE: 'Puebla', QUE: 'Querétaro', ROO: 'Quintana Roo', SIN: 'Sinaloa',
  SLP: 'San Luis Potosí', SON: 'Sonora', TAB: 'Tabasco', TAM: 'Tamaulipas', TLA: 'Tlaxcala',
  VER: 'Veracruz', YUC: 'Yucatán', ZAC: 'Zacatecas',
};

export const IUCN_COLORS: Record<string, string> = {
  EX: '#666', EW: '#888', CR: '#E85D75', EN: '#D4925F', VU: '#F4E8C8', NT: '#9CCC9C',
  LC: '#009C9C', DD: '#888', NE: '#666',
};

export const IUCN_LABELS: Record<string, Record<'es' | 'en' | 'pt', string>> = {
  EX: { es: 'Extinta', en: 'Extinct', pt: 'Extinta' },
  EW: { es: 'Extinta en estado silvestre', en: 'Extinct in the wild', pt: 'Extinta na natureza' },
  CR: { es: 'En peligro crítico', en: 'Critically endangered', pt: 'Criticamente ameaçada' },
  EN: { es: 'En peligro', en: 'Endangered', pt: 'Em perigo' },
  VU: { es: 'Vulnerable', en: 'Vulnerable', pt: 'Vulnerável' },
  NT: { es: 'Casi amenazada', en: 'Near threatened', pt: 'Quase ameaçada' },
  LC: { es: 'Preocupación menor', en: 'Least concern', pt: 'Menor preocupação' },
  DD: { es: 'Datos deficientes', en: 'Data deficient', pt: 'Dados insuficientes' },
  NE: { es: 'No evaluada', en: 'Not evaluated', pt: 'Não avaliada' },
};

export const STRINGS: Record<'es' | 'en' | 'pt', Record<string, string>> = {
  es: {
    map: 'Mapa', grid: 'Especies', all: 'Todas', states: 'Estados', search: 'Buscar especie...',
    description: 'Descripción', habitat: 'Hábitat', distribution: 'Ubicación', threats: 'Amenazas', references: 'Referencias',
    feeding: 'Alimentación',
    nstates: 'estados', endemic: 'Endémica de México', protected: 'Presente en ANP', viewFull: 'Ver ficha completa', close: 'Cerrar',
    iucnFilter: 'Estatus UICN', clear: 'Limpiar', searchAria: 'Buscar especie',
    tapAgain: 'Toca de nuevo para ver la ficha',
    zoomIn: 'Acercar mapa', zoomOut: 'Alejar mapa', zoomReset: 'Restablecer zoom',
  },
  en: {
    map: 'Map', grid: 'Species', all: 'All', states: 'States', search: 'Search species...',
    description: 'Description', habitat: 'Habitat', distribution: 'Location', threats: 'Threats', references: 'References',
    feeding: 'Diet',
    nstates: 'states', endemic: 'Endemic to Mexico', protected: 'Found in ANP', viewFull: 'Open full profile', close: 'Close',
    iucnFilter: 'IUCN status', clear: 'Clear', searchAria: 'Search species',
    tapAgain: 'Tap again to open the profile',
    zoomIn: 'Zoom in', zoomOut: 'Zoom out', zoomReset: 'Reset zoom',
  },
  pt: {
    map: 'Mapa', grid: 'Espécies', all: 'Todas', states: 'Estados', search: 'Buscar espécie...',
    description: 'Descrição', habitat: 'Hábitat', distribution: 'Localização', threats: 'Ameaças', references: 'Referências',
    feeding: 'Alimentação',
    nstates: 'estados', endemic: 'Endêmica do México', protected: 'Presente em ANP', viewFull: 'Ver ficha completa', close: 'Fechar',
    iucnFilter: 'Status UICN', clear: 'Limpar', searchAria: 'Buscar espécie',
    tapAgain: 'Toque novamente para abrir a ficha',
    zoomIn: 'Aproximar mapa', zoomOut: 'Afastar mapa', zoomReset: 'Redefinir zoom',
  },
};

export const IUCN_GROUPS = [
  { key: 'endangered',      codes: ['CR', 'EN'],             color: '#E85D75',
    labels: { es: 'En peligro',        en: 'Endangered',       pt: 'Em perigo' } },
  { key: 'stable',          codes: ['VU', 'NT', 'LC'],       color: '#009C9C',
    labels: { es: 'En estado estable', en: 'Stable',           pt: 'Em estado estável' } },
  { key: 'data-deficient',  codes: ['DD', 'NE'],             color: '#D4925F',
    labels: { es: 'Poco conocidas',    en: 'Data deficient',   pt: 'Pouco conhecidas' } },
] as const;
export type IucnGroupKey = typeof IUCN_GROUPS[number]['key'];

/** The colour of the IUCN group a category belongs to (the card's badge); grey when there is none. */
export const iucnGroupColor = (code?: string): string => {
  if (!code) return '#888';
  for (const g of IUCN_GROUPS) {
    if ((g.codes as readonly string[]).includes(code)) return g.color;
  }
  return '#888';
};
