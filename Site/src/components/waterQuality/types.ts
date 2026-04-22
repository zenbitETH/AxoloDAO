export type Locale = 'es' | 'en' | 'pt';

export type ParamKey =
  | 'temp' | 'nh3' | 'no2' | 'no3'
  | 'gh' | 'kh' | 'ph' | 'po4' | 'cond' | 'tds';

export const PARAM_KEYS: ParamKey[] = [
  'temp', 'nh3', 'no2', 'no3', 'gh', 'kh', 'ph', 'po4', 'cond', 'tds',
];

export type SpeciesCode =
  | 'andersoni' | 'mexicanum' | 'dumerilii'
  | 'control' | 'guppies' | 'na';

export interface Tank {
  id: string;
  speciesCode: SpeciesCode;
  scientificName: string | null;
  displayName: string;
  volumeL: number | null;
  primary: boolean;
  accentColor: string;
  note: { es: string; en: string; pt: string } | null;
}

export interface ParameterCatalogEntry {
  tankId: string;
  speciesCode: SpeciesCode;
  key: ParamKey;
  unit: string;
  min: number | null;
  max: number | null;
  target: number | null;
}

export interface Measurement {
  date: string;          // ISO YYYY-MM-DD
  time: string | null;
  tankId: string;
  isMonday: boolean;
  authors: { main: string | null; secondary: string | null };
  values: Record<ParamKey, number | null>;
  alarms: ParamKey[];
  note: string | null;
}

export type Status = 'ok' | 'warn' | 'alarm';
export type Trend = 'up' | 'down' | 'equal';

export type TimeWindow = 4 | 12 | 26 | 'all';
