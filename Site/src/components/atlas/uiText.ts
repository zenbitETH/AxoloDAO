// The words of the atlas's map-first UI (HUD, index, detail, state popover, legend, sheets) in es, en and pt.
// EVERY string here is a PROPOSAL until the founder approves it: nothing in this file is approved copy. The keys are what the components use;
// scripts/test-atlas.mjs checks that the three languages carry the same keys, so wording changes never touch the components.
import type { Locale } from '@/i18n/strings';

const esBase = {
  hud: 'Capas del mapa', 
  
  openIndex: 'Abrir el índice de especies',
  moreAbout: 'Datos de la capa', infoCapa: 'Información de la capa', offHere: 'apagada en este mapa',
  legendChip: 'Leyenda', legendRichness: 'Especies por unidad', legendPresent: 'Límite de estado con presencia', legendWeak: 'Citada, sin confirmar',
  legendOther: 'Ya no está o no es nativa', legendArea: 'Zona de localidades', 
  legendFacilities: 'Instalaciones catalogadas (municipio)',
  indexOpen: 'Índice de especies', indexClose: 'Cerrar el índice', search: 'Buscar especie…', searchAria: 'Buscar especie', filters: 'Filtros', iucnGroup: 'Estatus UICN', all: 'Todas',
  groupBy: 'Agrupar por', byCountry: 'País', byStatus: 'Estatus', byName: 'A–Z', groupMX: 'México', groupNA: 'Estados Unidos y Canadá', groupBoth: 'México, Estados Unidos y Canadá',
  noMatch: 'Ninguna especie coincide.', removeState: 'Quitar el filtro de estado', ofTotal: 'de', rangeOf: 'Países',
  detailClose: 'Cerrar el detalle', detailLabel: 'Detalle de la especie',
  tabSummary: 'Resumen', tabMeasures: 'Medidas', tabSources: 'Fuentes',
  draft: 'Borrador', draftNote: 'Texto en borrador, pendiente de aprobación.', noText: 'Sin texto todavía.', habitat: 'Hábitat',
  
  
  
  imagePending: 'Imagen pendiente', citeOnly: 'sólo citar',
  stateClose: 'Cerrar', stateSpeciesOne: 'especie', stateSpeciesMany: 'especies', stateNone: 'Sin especies registradas', stateSeeAll: 'Ver las {n} en el índice', stateFilter: 'Filtrar el índice por este estado',
  sheetGrip: 'Cambiar la altura de la hoja', tapAgain: 'Toca de nuevo para ver la ficha',
  measures: { svl: 'Longitud hocico-cloaca', total_length: 'Longitud total', tail_length: 'Longitud de la cola', head_width: 'Ancho de la cabeza', costal_grooves: 'Surcos costales', mass: 'Masa' } as Record<string, string>,
  evidence: { present: 'Presente', historical: 'Histórica', extirpated: 'Extirpada', introduced: 'Introducida', weak: 'Débil', literature: 'Bibliográfica' } as Record<string, string>,
  countries: { MX: 'México', US: 'Estados Unidos', CA: 'Canadá' } as Record<string, string>,
  // Country names with their preposition built in, so the grammar never depends on the order of words: «en» after a verb of place, «de» after a noun. English «to» is what follows «Endemic». The division word is the country's own: estado for MX and US, provincia for CA.
  countriesIn: { MX: 'en México', US: 'en los Estados Unidos', CA: 'en Canadá' } as Record<string, string>,
  countriesOf: { MX: 'de México', US: 'de los Estados Unidos', CA: 'de Canadá' } as Record<string, string>,
  divisions: { MX: 'Estados', US: 'Estados', CA: 'Provincias' } as Record<string, string>,
  removeStateCA: 'Quitar el filtro de provincia', stateFilterCA: 'Filtrar el índice por esta provincia',
  systems: { iucn: 'UICN', nom059: 'NOM-059', proy_nom059_2025: 'PROY-NOM-059-2025', esa: 'ESA', cosewic: 'COSEWIC', sara: 'SARA', natureserve: 'NatureServe' } as Record<string, string>,
  mapLabel: 'Mapa de Norteamérica por estado y provincia',
};
// -- Redesign, phase 0 (18-oct): every key below is a NEW label, proposed in Spanish only. The founder approves the list, then Coms translates;
// until then en and pt carry the Spanish string as their placeholder (D5).
const nuevo = {
  richnessToggle: 'Presencia por estado', 
  hudSpecies: 'Especies', legendLakeMarker: 'Marcador del lago: toda su distribución', legendPotential: 'Distribución potencial (no es un mapa oficial)', 
  
  rangeSource: 'Fuente del área', 
  expand: 'Ampliar la ficha', collapse: 'Reducir la ficha',
  tabFeeding: 'Alimentación',
  presenceOf: '{div} {of}', 
  gridStatus: 'Estatus', gridWhere: 'Dónde vive', gridBiology: 'Biología', gridConservation: 'Conservación',
  cellNational: 'Estatus nacional', cellCites: 'CITES', cellHabitat: 'Hábitat', cellElevation: 'Altitud', cellEndemism: 'Endemismo',
  cellLifeForm: 'Forma de vida', cellMetamorphosis: 'Metamorfosis', cellRegeneration: 'Regeneración', cellExSitu: 'En cautiverio', cellThreat: 'Amenaza principal',
  citesNone: 'No listada', citesAppendix: 'Apéndice {n}', elevFrom: 'desde', elevTo: 'hasta', valueConflict: 'Fuentes en conflicto', valueMetaPart: 'Sí, en parte de la población', valueMetaNo: 'No (sólo rara o en cautiverio)', valueDocumented: 'Documentada', legendEnvelope: 'Envolvente de registros de GBIF', legendReviewOnly: 'Sólo para revisión: no se publica todavía', legendLocality: 'Localidad (generalizada)', legendCellsArea: 'Localidades (celdas de 0.5° unidas)', legendLocalityCited: 'Localidad citada', legendGeoCA: 'Canadá y EE. UU.', legendGeoUS: 'EE. UU.', legendGeoMX: 'México', legendGeoAll: 'México, EE. UU. y Canadá', pendingFounder: 'Pendiente de la aprobación del fundador', legendLakeOutline: 'Contorno del lago: toda su distribución', valueNeotenyObligate: 'Neotenia obligada', valueNeotenyFacultative: 'Neotenia facultativa', valueMetamorphic: 'Metamórfica', valueYes: 'Sí', valueUnstudied: 'No estudiada', valueEndemicOf: 'Endémica {of}', valueInCountries: 'En {n} países',
  facilitiesOne: 'instalación catalogada', facilitiesMany: 'instalaciones catalogadas', detailSource: 'Fuente', detailPage: 'pág.', endemicOnly: 'Sólo se registra {in}', notEndemicIn: 'Se registra {in}', sampleTag: 'Muestra', maxShort: 'máx.', 
  
  feedWild: 'En estado silvestre', feedCaptive: 'En cautiverio', preyGroups: 'Grupos de presa', noFeeding: 'Sin texto de alimentación todavía.', generatedLabel: 'Ilustración generada con IA',
  dimSvl: 'LHC', dimTail: 'Cola', dimTotal: 'Total', dimHead: 'Cabeza', schematic: 'Esquema, no está a escala.', sameScale: 'A la misma escala', smallest: 'La más pequeña del género', largest: 'La más grande del género', byTotal: 'por longitud total',
  srcName: 'Nombre y autoría', srcRange: 'Área de distribución', srcData: 'Fuente de cada dato', srcRefs: 'Referencias',
  
  groupUS: 'Estados Unidos', tipGeneralized: 'ubicación generalizada (~50 km)', tipMunicipio: 'ubicación generalizada (municipio)', tipZona: 'ubicación generalizada (~50 km), {estado}', provLectura: 'leído del mapa impreso', srcPoints: 'Localidades', sourcesPoints: 'Fuentes de las localidades', tabClips: 'Clips', clipPlaceholder: 'Clip público confirmado (pendiente del dictamen)', clipCredit: '(crédito del autor)', clipSource: 'Xovi', clipDate: 'fecha', silhouetteOwn: 'Contorno propio de Zenbit', sourcesBoth: 'Fuentes', fuenteMapaSitio: 'Mapa de especies del sitio', sourcesDiffer: 'Las fuentes difieren sobre su localidad',
  notaDifiereLermaense: 'Taylor (1940) da su localidad tipo al este de Toluca; los mapas del PACE la dibujan al oeste de Toluca.',
  notaDifiereAndersoni: 'Aguilar-Miguel (2005) la restringe a la Laguna de Zacapu; los mapas del PACE la dibujan unos 0.4° al oeste.', provCorrob: 'corroborado por', presenceNoLocality: 'presencia sin localidad publicada', panelTabs: 'Secciones del panel', 
  legendCapNeoteny: 'Neotenia', legendCapMeta: 'Metamorfosis', legendCapRegen: 'Regeneración', ctlLimits: 'Límites de estado', ctlRivers: 'Ríos y lagos',
  closedAt: 'cerrado',
  verifLabels: { 'ficha-oficial': 'Fuente oficial', institucional: 'Fuente institucional', prensa: 'Nota de prensa', declarado: 'Declarado por el recinto' } as Record<string, string>,
  conservationTitle: 'Estado de conservación', nationalStatus: 'Estatus nacional', sourceShort: 'fuente', readMore: 'Leer más', readLess: 'Leer menos',
  scaleIucn: 'Estatus UICN', scaleNom: 'Estatus NOM-059', statusExtinct: 'Extinta', statusThreatened: 'Amenazada', statusLeastConcern: 'Preocupación menor', statusDD: 'Datos insuficientes', statusNE: 'No evaluada', notListed: 'No listada', draft2025: 'proyecto 2025',
  nomLabels: { E: 'Probablemente extinta en el medio silvestre', P: 'En peligro de extinción', A: 'Amenazada', Pr: 'Sujeta a protección especial' } as Record<string, string>,
  imageCredits: 'Créditos de la imagen',
  iconsCredit: 'Íconos de las instalaciones:',
  // behind a flag that is OFF (PUBLIC_ATLAS_CICLO): the full-cycle organization card. PLACEHOLDER wording until the agreement text and the IP ruling land; none of it renders while the flag is off.
  cicloTitulo: 'Primera organización registrada (texto provisional)', cicloOrgsNota: '1 organización (texto provisional, pendiente de dictamen)', cicloPiloto: 'Piloto', cicloRegistro: 'Fecha de apertura', cicloCierre: 'Fecha de cierre', cicloEstado: 'ciclo completo', cicloEns: 'Nombre ENS', cicloEnlace: 'Ver el cierre',
  capNeotenyTip: 'Neotenia: de adulta conserva sus branquias', capFacultativeTip: 'Neotenia facultativa: puede transformarse o conservar branquias',
  capMetaTip: 'Metamorfosis: pierde las branquias y sale del agua', capRegenTip: 'Regeneración de patas documentada en estudios',
  cellIucn: 'UICN', habitatCodes: 'Hábitats UICN 3.1', threatCode: 'Amenazas UICN 3.2',
};
const es = { ...esBase, ...nuevo };
// English and Portuguese of the flat keys: the communications team, the communications repository fe84e42 (19-Oct-2026), applied as given except the four country strings, whose preposition now comes from the countriesIn / countriesOf vocabularies
const enNuevo = {
  cellIucn: 'IUCN', habitatCodes: 'IUCN Habitats 3.1', threatCode: 'IUCN Threats 3.2',
  hudSpecies: 'Species', legendLakeMarker: 'Lake marker: its whole range', legendPotential: 'Potential range (not an official map)', rangeSource: 'Range source', expand: 'Expand the profile',
  collapse: 'Collapse the profile', tabFeeding: 'Diet', presenceOf: '{div} {in}', gridStatus: 'Status', gridWhere: 'Where it lives', gridBiology: 'Biology', gridConservation: 'Conservation',
  cellNational: 'National status', cellCites: 'CITES', cellHabitat: 'Habitat', cellElevation: 'Elevation', cellEndemism: 'Endemism', cellLifeForm: 'Life form',
  cellMetamorphosis: 'Metamorphosis', cellRegeneration: 'Regeneration', cellExSitu: 'In captivity', cellThreat: 'Main threat', citesNone: 'Not listed', citesAppendix: 'Appendix {n}', elevFrom: 'from',
  elevTo: 'up to', valueConflict: 'Sources disagree', valueMetaPart: 'Yes, in part of the population', valueMetaNo: 'No (only rare, or in captivity)', valueDocumented: 'Documented',
  legendEnvelope: 'Envelope of GBIF records', legendReviewOnly: 'For review only: not published yet', legendLocality: 'Locality (generalized)', legendCellsArea: 'Localities (joined 0.5° cells)', legendLocalityCited: 'Cited locality',
  legendGeoCA: 'Canada and the US', legendGeoUS: 'US', legendGeoMX: 'Mexico', legendGeoAll: 'Mexico, the US, and Canada', pendingFounder: 'Pending the founder\'s approval',
  legendLakeOutline: 'Lake outline: its whole range', valueNeotenyObligate: 'Obligate neoteny', valueNeotenyFacultative: 'Facultative neoteny', valueMetamorphic: 'Metamorphic', valueYes: 'Yes',
  valueUnstudied: 'Not studied', valueEndemicOf: 'Endemic {of}', valueInCountries: 'In {n} countries', facilitiesOne: 'cataloged facility', facilitiesMany: 'cataloged facilities',
  detailSource: 'Source', detailPage: 'p.', endemicOnly: 'Recorded only {in}', notEndemicIn: 'Recorded {in}', sampleTag: 'Sample', maxShort: 'max.',
  feedWild: 'In the wild', feedCaptive: 'In captivity', preyGroups: 'Prey groups', noFeeding: 'No diet text yet.', generatedLabel: 'AI-generated illustration',
  dimSvl: 'SVL', dimTail: 'Tail', dimTotal: 'Total', dimHead: 'Head', schematic: 'Diagram, not to scale.', sameScale: 'To the same scale', smallest: 'The smallest in the genus',
  largest: 'The largest in the genus', byTotal: 'by total length', srcName: 'Name and authority', srcRange: 'Range', srcData: 'Source of each data point', srcRefs: 'References',
  groupUS: 'United States', tipGeneralized: 'generalized location (~50 km)', tipMunicipio: 'generalized location (municipality)', tipZona: 'generalized location (~50 km), {estado}',
  provLectura: 'read from the printed map', srcPoints: 'Localities', sourcesPoints: 'Locality sources', tabClips: 'Clips', clipPlaceholder: 'Confirmed public clip (pending the ruling)',
  clipCredit: '(author credit)', clipSource: 'Xovi', clipDate: 'date', silhouetteOwn: 'Zenbit\'s own outline', sourcesBoth: 'Sources', fuenteMapaSitio: 'The site\'s species map',
  sourcesDiffer: 'Sources differ on its locality', provCorrob: 'corroborated by', presenceNoLocality: 'presence with no published locality', panelTabs: 'Panel sections', legendCapNeoteny: 'Neoteny',
  legendCapMeta: 'Metamorphosis', legendCapRegen: 'Regeneration', closedAt: 'closed', nationalStatus: 'National status', verifLabels: { 'ficha-oficial': 'Official source', institucional: 'Institutional source', prensa: 'Press note', declarado: 'Declared by the venue' } as Record<string, string>, conservationTitle: 'Conservation status', sourceShort: 'source', readMore: 'Read more', readLess: 'Read less', scaleIucn: 'IUCN status', scaleNom: 'NOM-059 status', statusExtinct: 'Extinct', statusThreatened: 'Threatened', statusLeastConcern: 'Least concern', statusDD: 'Data deficient', statusNE: 'Not evaluated', notListed: 'Not listed', draft2025: '2025 draft', nomLabels: { E: 'Probably extinct in the wild', P: 'Endangered', A: 'Threatened', Pr: 'Subject to special protection' } as Record<string, string>, imageCredits: 'Image credits', iconsCredit: 'Facility icons:', cicloTitulo: 'First registered organization (provisional text)',
  cicloOrgsNota: '1 organization (provisional text, pending the ruling)', cicloPiloto: 'Pilot', cicloRegistro: 'Opening date', cicloCierre: 'Closing date', cicloEstado: 'full cycle',
  cicloEns: 'ENS name', cicloEnlace: 'See the closing',
};
const ptNuevo: typeof enNuevo = {
  cellIucn: 'UICN', habitatCodes: 'Habitats UICN 3.1', threatCode: 'Ameaças UICN 3.2',
  hudSpecies: 'Espécies', legendLakeMarker: 'Marcador do lago: toda a sua distribuição', legendPotential: 'Distribuição potencial (não é um mapa oficial)', rangeSource: 'Fonte da área',
  expand: 'Ampliar a ficha', collapse: 'Reduzir a ficha', tabFeeding: 'Alimentação', presenceOf: '{div} {of}', gridStatus: 'Status', gridWhere: 'Onde vive', gridBiology: 'Biologia',
  gridConservation: 'Conservação', cellNational: 'Status nacional', cellCites: 'CITES', cellHabitat: 'Habitat', cellElevation: 'Altitude', cellEndemism: 'Endemismo',
  cellLifeForm: 'Forma de vida', cellMetamorphosis: 'Metamorfose', cellRegeneration: 'Regeneração', cellExSitu: 'Em cativeiro', cellThreat: 'Principal ameaça', citesNone: 'Não listada',
  citesAppendix: 'Apêndice {n}', elevFrom: 'desde', elevTo: 'até', valueConflict: 'Fontes em conflito', valueMetaPart: 'Sim, em parte da população', valueMetaNo: 'Não (só rara ou em cativeiro)',
  valueDocumented: 'Documentada', legendEnvelope: 'Envoltória dos registros do GBIF', legendReviewOnly: 'Só para revisão: ainda não publicado', legendLocality: 'Localidade (generalizada)', legendCellsArea: 'Localidades (células de 0,5° unidas)',
  legendLocalityCited: 'Localidade citada', legendGeoCA: 'Canadá e EUA', legendGeoUS: 'EUA', legendGeoMX: 'México', legendGeoAll: 'México, EUA e Canadá',
  pendingFounder: 'Aguardando a aprovação do fundador', legendLakeOutline: 'Contorno do lago: toda a sua distribuição', valueNeotenyObligate: 'Neotenia obrigatória',
  valueNeotenyFacultative: 'Neotenia facultativa', valueMetamorphic: 'Metamórfica', valueYes: 'Sim', valueUnstudied: 'Não estudada', valueEndemicOf: 'Endêmica {of}', valueInCountries: 'Em {n} países',
  facilitiesOne: 'instalação catalogada', facilitiesMany: 'instalações catalogadas', detailSource: 'Fonte', detailPage: 'p.', endemicOnly: 'Registrada só {in}',
  notEndemicIn: 'Registrada {in}', sampleTag: 'Amostra', maxShort: 'máx.', feedWild: 'Na natureza', feedCaptive: 'Em cativeiro', preyGroups: 'Grupos de presas',
  noFeeding: 'Ainda sem texto de alimentação.', generatedLabel: 'Ilustração gerada por IA', dimSvl: 'Comprimento focinho-cloaca', dimTail: 'Cauda', dimTotal: 'Total', dimHead: 'Cabeça',
  schematic: 'Esquema, fora de escala.', sameScale: 'Na mesma escala', smallest: 'A menor do gênero', largest: 'A maior do gênero', byTotal: 'por comprimento total', srcName: 'Nome e autoria',
  srcRange: 'Área de distribuição', srcData: 'Fonte de cada dado', srcRefs: 'Referências', groupUS: 'Estados Unidos', tipGeneralized: 'localização generalizada (~50 km)',
  tipMunicipio: 'localização generalizada (município)', tipZona: 'localização generalizada (~50 km), {estado}', provLectura: 'lido do mapa impresso', srcPoints: 'Localidades',
  sourcesPoints: 'Fontes das localidades', tabClips: 'Clipes', clipPlaceholder: 'Clipe público confirmado (aguardando o parecer)', clipCredit: '(crédito de autoria)', clipSource: 'Xovi',
  clipDate: 'data', silhouetteOwn: 'Contorno próprio da Zenbit', sourcesBoth: 'Fontes', fuenteMapaSitio: 'Mapa de espécies do site', sourcesDiffer: 'As fontes divergem sobre sua localidade',
  provCorrob: 'corroborado por', presenceNoLocality: 'presença sem localidade publicada', panelTabs: 'Seções do painel', legendCapNeoteny: 'Neotenia', legendCapMeta: 'Metamorfose',
  legendCapRegen: 'Regeneração', closedAt: 'fechado', nationalStatus: 'Status nacional', verifLabels: { 'ficha-oficial': 'Fonte oficial', institucional: 'Fonte institucional', prensa: 'Nota de imprensa', declarado: 'Declarado pelo recinto' } as Record<string, string>, conservationTitle: 'Estado de conservação', sourceShort: 'fonte', readMore: 'Ler mais', readLess: 'Ler menos', scaleIucn: 'Status UICN', scaleNom: 'Status NOM-059', statusExtinct: 'Extinta', statusThreatened: 'Ameaçada', statusLeastConcern: 'Menor preocupação', statusDD: 'Dados insuficientes', statusNE: 'Não avaliada', notListed: 'Não listada', draft2025: 'projeto 2025', nomLabels: { E: 'Provavelmente extinta na natureza', P: 'Em perigo de extinção', A: 'Ameaçada', Pr: 'Sujeita a proteção especial' } as Record<string, string>, imageCredits: 'Créditos da imagem', iconsCredit: 'Ícones das instalações:', cicloTitulo: 'Primeira organização registrada (texto provisório)', cicloOrgsNota: '1 organização (texto provisório, aguardando o parecer)',
  cicloPiloto: 'Piloto', cicloRegistro: 'Data de abertura', cicloCierre: 'Data de encerramento', cicloEstado: 'ciclo completo', cicloEns: 'Nome ENS', cicloEnlace: 'Ver o encerramento',
};

export type UiText = typeof es;

const en: UiText = {
  ...enNuevo,
  richnessToggle: 'Presence by state', ctlLimits: 'State boundaries', ctlRivers: 'Rivers and lakes',
  notaDifiereLermaense: 'Taylor (1940) places its type locality east of Toluca; the PACE maps draw it west of Toluca.', notaDifiereAndersoni: 'Aguilar-Miguel (2005) restricts it to the Laguna de Zacapu; the PACE maps draw it about 0.4° to the west.',
  capNeotenyTip: 'Neoteny: keeps its gills as an adult', capFacultativeTip: 'Facultative neoteny: may transform or keep its gills', capMetaTip: 'Metamorphosis: loses its gills and leaves the water', capRegenTip: 'Limb regeneration documented in studies', 
  hud: 'Map layers', 
  
  openIndex: 'Open the species index',
  moreAbout: 'Layer data', infoCapa: 'Layer information', offHere: 'off in this map',
  legendChip: 'Legend', legendRichness: 'Species per unit', legendPresent: 'State boundary with presence', legendWeak: 'Cited, unconfirmed',
  legendOther: 'Gone or not native', legendArea: 'Locality zone', 
  legendFacilities: 'Cataloged facilities (municipality)',
  indexOpen: 'Species index', indexClose: 'Close the index', search: 'Search species…', searchAria: 'Search species', filters: 'Filters', iucnGroup: 'IUCN status', all: 'All',
  groupBy: 'Group by', byCountry: 'Country', byStatus: 'Status', byName: 'A–Z', groupMX: 'Mexico', groupNA: 'United States and Canada', groupBoth: 'Mexico, United States and Canada',
  noMatch: 'No species match.', removeState: 'Remove the state filter', ofTotal: 'of', rangeOf: 'Countries',
  detailClose: 'Close the detail', detailLabel: 'Species detail',
  tabSummary: 'Summary', tabMeasures: 'Measurements', tabSources: 'Sources',
  draft: 'Draft', draftNote: 'Draft text, pending approval.', noText: 'No text yet.', habitat: 'Habitat',
  
  
  
  imagePending: 'Image pending', citeOnly: 'cite only',
  stateClose: 'Close', stateSpeciesOne: 'species', stateSpeciesMany: 'species', stateNone: 'No species recorded', stateSeeAll: 'See all {n} in the index', stateFilter: 'Filter the index by this state',
  sheetGrip: 'Change the height of the sheet', tapAgain: 'Tap again to open the profile',
  measures: { svl: 'Snout-vent length', total_length: 'Total length', tail_length: 'Tail length', head_width: 'Head width', costal_grooves: 'Costal grooves', mass: 'Mass' },
  evidence: { present: 'Present', historical: 'Historical', extirpated: 'Extirpated', introduced: 'Introduced', weak: 'Weak', literature: 'Literature' },
  countries: { MX: 'Mexico', US: 'United States', CA: 'Canada' },
  countriesIn: { MX: 'in Mexico', US: 'in the United States', CA: 'in Canada' },
  countriesOf: { MX: 'to Mexico', US: 'to the United States', CA: 'to Canada' },
  divisions: { MX: 'States', US: 'States', CA: 'Provinces' },
  removeStateCA: 'Remove the province filter', stateFilterCA: 'Filter the index by this province',
  systems: { iucn: 'IUCN', nom059: 'NOM-059', proy_nom059_2025: 'PROY-NOM-059-2025', esa: 'ESA', cosewic: 'COSEWIC', sara: 'SARA', natureserve: 'NatureServe' },
  mapLabel: 'Map of North America by state and province',
};

const pt: UiText = {
  ...ptNuevo,
  richnessToggle: 'Presença por estado', ctlLimits: 'Limites estaduais', ctlRivers: 'Rios e lagos',
  notaDifiereLermaense: 'Taylor (1940) situa sua localidade-tipo a leste de Toluca; os mapas do PACE a desenham a oeste de Toluca.', notaDifiereAndersoni: 'Aguilar-Miguel (2005) a restringe à Laguna de Zacapu; os mapas do PACE a desenham cerca de 0,4° a oeste.',
  capNeotenyTip: 'Neotenia: mantém as brânquias quando adulta', capFacultativeTip: 'Neotenia facultativa: pode se transformar ou manter brânquias', capMetaTip: 'Metamorfose: perde as brânquias e sai da água', capRegenTip: 'Regeneração de patas documentada em estudos', 
  hud: 'Camadas do mapa', 
  
  openIndex: 'Abrir o índice de espécies',
  moreAbout: 'Dados da camada', infoCapa: 'Informações da camada', offHere: 'desligada neste mapa',
  legendChip: 'Legenda', legendRichness: 'Espécies por unidade', legendPresent: 'Limite estadual com presença', legendWeak: 'Citada, sem confirmar',
  legendOther: 'Já não está ou não é nativa', legendArea: 'Zona de localidades', 
  legendFacilities: 'Instalações catalogadas (município)',
  indexOpen: 'Índice de espécies', indexClose: 'Fechar o índice', search: 'Buscar espécie…', searchAria: 'Buscar espécie', filters: 'Filtros', iucnGroup: 'Status UICN', all: 'Todas',
  groupBy: 'Agrupar por', byCountry: 'País', byStatus: 'Status', byName: 'A–Z', groupMX: 'México', groupNA: 'Estados Unidos e Canadá', groupBoth: 'México, Estados Unidos e Canadá',
  noMatch: 'Nenhuma espécie corresponde.', removeState: 'Remover o filtro de estado', ofTotal: 'de', rangeOf: 'Países',
  detailClose: 'Fechar o detalhe', detailLabel: 'Detalhe da espécie',
  tabSummary: 'Resumo', tabMeasures: 'Medidas', tabSources: 'Fontes',
  draft: 'Rascunho', draftNote: 'Texto em rascunho, aguardando aprovação.', noText: 'Ainda sem texto.', habitat: 'Habitat',
  
  
  
  imagePending: 'Imagem pendente', citeOnly: 'só citar',
  stateClose: 'Fechar', stateSpeciesOne: 'espécie', stateSpeciesMany: 'espécies', stateNone: 'Sem espécies registradas', stateSeeAll: 'Ver as {n} no índice', stateFilter: 'Filtrar o índice por este estado',
  sheetGrip: 'Mudar a altura da folha', tapAgain: 'Toque novamente para abrir a ficha',
  measures: { svl: 'Comprimento focinho-cloaca', total_length: 'Comprimento total', tail_length: 'Comprimento da cauda', head_width: 'Largura da cabeça', costal_grooves: 'Sulcos costais', mass: 'Massa' },
  evidence: { present: 'Presente', historical: 'Histórica', extirpated: 'Extirpada', introduced: 'Introduzida', weak: 'Fraca', literature: 'Bibliográfica' },
  countries: { MX: 'México', US: 'Estados Unidos', CA: 'Canadá' },
  countriesIn: { MX: 'no México', US: 'nos Estados Unidos', CA: 'no Canadá' },
  countriesOf: { MX: 'do México', US: 'dos Estados Unidos', CA: 'do Canadá' },
  divisions: { MX: 'Estados', US: 'Estados', CA: 'Províncias' },
  removeStateCA: 'Remover o filtro de província', stateFilterCA: 'Filtrar o índice por esta província',
  systems: { iucn: 'UICN', nom059: 'NOM-059', proy_nom059_2025: 'PROY-NOM-059-2025', esa: 'ESA', cosewic: 'COSEWIC', sara: 'SARA', natureserve: 'NatureServe' },
  mapLabel: 'Mapa da América do Norte por estado e província',
};

export const uiText: Record<Locale, UiText> = { es, en, pt };

const unir: Record<Locale, [string, string]> = { es: [' y ', ' y '], en: [' and ', ', and '], pt: [' e ', ' e '] };

/** A string with a country in it: {in} and {of} take the country's phrase from countriesIn / countriesOf, {div} its division word (estado, provincia). A list of countries repeats the preposition per country, as Portuguese needs («no México e nos Estados Unidos»). */
export function conPais(ui: UiText, locale: Locale, plantilla: string, paises: string[]): string {
  const frase = (v: Record<string, string>) => {
    const f = paises.map((c) => v[c] ?? c);
    return f.length < 2 ? f.join('') : f.length === 2 ? f.join(unir[locale][0]) : `${f.slice(0, -1).join(', ')}${unir[locale][1]}${f[f.length - 1]}`;
  };
  const div = paises.every((c) => ui.divisions[c] === ui.divisions[paises[0]]) ? ui.divisions[paises[0]] : ui.divisions.MX;
  return plantilla.replace('{in}', frase(ui.countriesIn)).replace('{of}', frase(ui.countriesOf)).replace('{div}', div);
}
