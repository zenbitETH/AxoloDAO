import type { Locale } from '@/i18n/strings';

export interface AtlasText {
  title: string; subtitle: string; metaTitle: string; metaDescription: string; layers: string; mapLabel: string; metric: string; table: string; tableNote: string; noData: string;
  source: string; licence: string; lastData: string; retrieved: string; noDownload: string; flagOff: string; flagOffKiosk: string; loading: string; failed: string;
  species: string; facility: string; state: string; value: string; legend: string; reset: string; candidates: string; registered: string; verification: string;
  inPlace: string; legalFigure: string; notStated: string; municipality: string; noMunicipality: string; facilitiesTable: string; facilitiesTableNote: string; freshness: string; orgsEmpty: string; orgsLive: string; orgsBuild: string; webgl: string; tour: string; hubNote: string; clusterNote: string;
  groupSpecies: string; groupFacilities: string; groupWater: string; groupOrganizations: string; groupContext: string;
}

export const atlasText: Record<Locale, AtlasText> = {
  es: {
    title: 'Atlas de ajolotes y achoques de México',
    // Comms' meta copy (future tense: no organization is listed yet; it moves to the present when /v1/orgs lists facilities). It names no brand: the layout adds the site name.
    metaTitle: 'Atlas abierto de recintos con ajolotes en México',
    metaDescription: 'Los recintos que cuidan ajolotes podrán aparecer aquí, cada uno con el nivel de verificación que acredite y la fuente de sus datos.',
    subtitle: 'Un mapa de datos abiertos: dónde hay especies, UMA, instalaciones catalogadas y organizaciones que se registran. Sin puntos de registros de especies.',
    layers: 'Capas', mapLabel: 'Mapa de México por estado', metric: 'Métrica', table: 'Ver los datos como tabla', tableNote: 'La misma capa, como texto.', noData: 'sin dato',
    source: 'Fuente', licence: 'Licencia', lastData: 'Último dato', retrieved: 'Consultada', noDownload: 'Sin descarga', flagOff: 'Esta capa tiene licencia CC BY-NC: se muestra sólo en este atlas gratuito y está apagada por omisión.',
    flagOffKiosk: 'Apagada en el modo quiosco.', loading: 'Cargando la capa…', failed: 'No se pudo cargar la capa.',
    species: 'Especies', facility: 'Instalación', state: 'Estado', value: 'Valor', legend: 'Leyenda', reset: 'Reiniciar vista', candidates: 'Catalogadas (candidatas)', registered: 'Registradas',
    verification: 'Verificación', inPlace: 'en', legalFigure: 'Figura legal', notStated: 'no consta', municipality: 'Municipio', noMunicipality: '(sin municipio)', facilitiesTable: 'Ver las instalaciones como tabla', facilitiesTableNote: 'Las mismas instalaciones del mapa, por municipio; ninguna dirección ni coordenada.', freshness: 'datos al', orgsEmpty: 'Todavía no hay organizaciones registradas.', orgsLive: 'Lista en vivo del registro.', orgsBuild: 'Lista de la última compilación; el registro en vivo no respondió.',
    webgl: 'Tu navegador no puede dibujar el mapa. Usa la tabla de abajo.', tour: 'Recorrido automático', hubNote: 'Capa servida por el registro de AxoloDAO.', clusterNote: 'Acércate para separar los grupos.',
    groupSpecies: 'Especies', groupFacilities: 'Instalaciones y organizaciones', groupWater: 'Agua', groupOrganizations: 'Organizaciones y colectivos', groupContext: 'Contexto',
  },
  en: {
    title: 'Atlas of the axolotls and achoques of Mexico',
    // Comms' meta copy (future tense: no organization is listed yet; it moves to the present when /v1/orgs lists facilities). It names no brand: the layout adds the site name.
    metaTitle: 'Open atlas of axolotl facilities in Mexico',
    metaDescription: 'Facilities caring for axolotls will be listed here, each with the verification level it holds and the source of its data.',
    subtitle: 'An open-data map: where the species are, UMAs, cataloged facilities and the organizations that register. No species record points.',
    layers: 'Layers', mapLabel: 'Map of Mexico by state', metric: 'Metric', table: 'See the data as a table', tableNote: 'The same layer, as text.', noData: 'no data',
    source: 'Source', licence: 'Licence', lastData: 'Last data', retrieved: 'Retrieved', noDownload: 'No download', flagOff: 'This layer is CC BY-NC: it is shown only in this free atlas and is off by default.',
    flagOffKiosk: 'Off in kiosk mode.', loading: 'Loading the layer…', failed: 'The layer could not be loaded.',
    species: 'Species', facility: 'Facility', state: 'State', value: 'Value', legend: 'Legend', reset: 'Reset view', candidates: 'Cataloged (candidates)', registered: 'Registered',
    verification: 'Verification', inPlace: 'in', legalFigure: 'Legal status', notStated: 'not stated', municipality: 'Municipality', noMunicipality: '(no municipality)', facilitiesTable: 'See the facilities as a table', facilitiesTableNote: 'The same facilities as the map, by municipality; no address or coordinate.', freshness: 'data as of', orgsEmpty: 'There are no registered organizations yet.', orgsLive: 'Live list from the registry.', orgsBuild: 'List from the last build; the live registry did not answer.',
    webgl: 'Your browser cannot draw the map. Use the table below.', tour: 'Automatic tour', hubNote: 'Layer served by the AxoloDAO registry.', clusterNote: 'Zoom in to split the clusters.',
    groupSpecies: 'Species', groupFacilities: 'Facilities and registry', groupWater: 'Water', groupOrganizations: 'Organizations and collectives', groupContext: 'Context',
  },
  pt: {
    title: 'Atlas dos axolotes e achoques do México',
    // Comms' meta copy (future tense: no organization is listed yet; it moves to the present when /v1/orgs lists facilities). It names no brand: the layout adds the site name.
    metaTitle: 'Atlas aberto de recintos com axolotes no México',
    metaDescription: 'Os recintos que cuidam de axolotes poderão aparecer aqui, cada um com o nível de verificação que comprovar e a fonte dos seus dados.',
    subtitle: 'Um mapa de dados abertos: onde estão as espécies, UMAs, instalações catalogadas e as organizações que se registram. Sem pontos de registros de espécies.',
    layers: 'Camadas', mapLabel: 'Mapa do México por estado', metric: 'Métrica', table: 'Ver os dados como tabela', tableNote: 'A mesma camada, como texto.', noData: 'sem dado',
    source: 'Fonte', licence: 'Licença', lastData: 'Último dado', retrieved: 'Consultada', noDownload: 'Sem download', flagOff: 'Esta camada é CC BY-NC: aparece apenas neste atlas gratuito e vem desligada por padrão.',
    flagOffKiosk: 'Desligada no modo quiosque.', loading: 'Carregando a camada…', failed: 'Não foi possível carregar a camada.',
    species: 'Espécies', facility: 'Instalação', state: 'Estado', value: 'Valor', legend: 'Legenda', reset: 'Reiniciar vista', candidates: 'Catalogadas (candidatas)', registered: 'Registradas',
    verification: 'Verificação', inPlace: 'em', legalFigure: 'Situação legal', notStated: 'não consta', municipality: 'Município', noMunicipality: '(sem município)', facilitiesTable: 'Ver as instalações como tabela', facilitiesTableNote: 'As mesmas instalações do mapa, por município; sem endereço nem coordenada.', freshness: 'dados em', orgsEmpty: 'Ainda não há organizações registradas.', orgsLive: 'Lista ao vivo do registro.', orgsBuild: 'Lista da última compilação; o registro ao vivo não respondeu.',
    webgl: 'Seu navegador não consegue desenhar o mapa. Use a tabela abaixo.', tour: 'Passeio automático', hubNote: 'Camada servida pelo registro da AxoloDAO.', clusterNote: 'Aproxime para separar os grupos.',
    groupSpecies: 'Espécies', groupFacilities: 'Instalações e registro', groupWater: 'Água', groupOrganizations: 'Organizações e coletivos', groupContext: 'Contexto',
  },
};
