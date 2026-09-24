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

export interface TankSystem {
  dimensions: {
    volumeNominalL: number | null;
    volumeEffectiveL: number | null;
    heightNominalCm: number | null;
    heightEffectiveCm: number | null;
    lengthCm: number | null;
    widthCm: number | null;
  };
  tankType: string | null;
  substrate: string | null;
  filter: {
    type: string | null;
    description: string | null;
    flow: string | null;
    lastMaintenance: string | null;
  };
  cooling: {
    type: string | null;
    capacity: string | null;
    setpoint: string | null;
    lastMaintenance: string | null;
  };
  aeration: {
    type: string | null;
    airflow: string | null;
  };
}

export interface Tank {
  id: string;
  speciesCode: SpeciesCode;
  scientificName: string | null;
  displayName: string;
  volumeL: number | null;
  primary: boolean;
  accentColor: string;
  note: { es: string; en: string; pt: string } | null;
  system: TankSystem | null;
}

// Dashboard calidad de agua summary entry — curator-blessed aggregate values
// per (tank, parameter). Estado Clínico carries species-specific judgment
// beyond the catalog's min/max range.
export interface DashboardAguaEntry {
  tankId: string;
  speciesCode: SpeciesCode;
  paramKey: ParamKey;
  unit: string | null;
  rangeSafe: string | null;
  promedioHistorico: number | null;
  ultimaMedicion: number | null;
  estadoClinico: string | null;
  limiteMin: number | null;
  limiteMax: number | null;
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

// Derived water-test classification for the per-week header chip. There is no
// test-type field in the source data, so this is computed on the site from the
// calendar (isMonday) plus any emergency/incident bitácora event on the test
// date — see deriveTestType in WaterQualityDashboard.
export type TestType = 'mantenimiento' | 'control' | 'emergencia';
