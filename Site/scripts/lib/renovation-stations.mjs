// Stations of the renovation series: the water systems measured while the museum is closed
// (from closure.json `closedOn`). Keyed by the workbook's `Ubicación` cell as it is written;
// keys and cells both go through renovationKey(), so case, spacing and accent encoding
// never decide a match. Each entry is the station's public id and label, and a label names
// a SYSTEM, never a specimen. The order is the colour order in the chart, so a new station
// goes at the end.
//
// This is an allowlist on purpose. A row dated on or after the closure whose location is not
// listed here is not published anywhere: it never joins the series from before the closure,
// and it does not become a station by accident. Adding a station is a reviewed edit here.
const STATIONS = [
  ['AA', { id: 'renovacion-aa', label: 'AA' }],
  ['AM', { id: 'renovacion-am', label: 'AM' }],
  ['AD', { id: 'renovacion-ad', label: 'AD' }],
];

export const renovationKey = raw =>
  (raw ?? '').toString().normalize('NFC').replace(/\s+/g, ' ').trim().toUpperCase();

export const RENOVATION_STATIONS = new Map(STATIONS.map(([cell, station]) => [renovationKey(cell), station]));

export const renovationStationFor = raw => RENOVATION_STATIONS.get(renovationKey(raw)) ?? null;
