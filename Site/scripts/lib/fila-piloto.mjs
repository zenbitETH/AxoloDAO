// The pilot's row in the public facility layer. Public only as a CLOSED row (IP review, 21 Oct 2026, from the agreement: the Pilot ran from 24 Oct 2025 to 22 Sep 2026, and Annex 3, which lists the pilot records that may go public, is empty): its name, where it was, that it is closed and the day it closed. No facility type, legal figure, species list, exhibition flag or verification.
// The name is ONE constant, read by the importer and by the test: the IP review approved «Museo de Ajolotes Xolotlcalli (2025–2026)» on 21 Oct. It is data text in the directory row only: never a page title, a meta or og tag, structured data or an alt text.
export const FILA_PILOTO = {
  id: 'mx-qro-xolotlcalli',
  nombre: 'Museo de Ajolotes Xolotlcalli (2025–2026)',
  estado_fecha: '2026-09-22',
  conservar: ['id', 'nombre', 'iso', 'cve_ent', 'cve_mun', 'municipio', 'estado', 'nivel', 'estado_operacion', 'estado_fecha'],
};
