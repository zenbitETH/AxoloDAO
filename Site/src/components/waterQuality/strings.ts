import type { Locale, ParamKey, SpeciesCode } from './types';

// Local dictionary mirrors the keys in Site/src/i18n/strings.ts under the
// `wq.*` namespace, but is colocated here so the Preact island does not have
// to import the whole server-side strings module.
type Dict = Record<string, string>;

export const STRINGS: Record<Locale, Dict> = {
  es: {
    coverTitle: 'Lunes de Mantenimiento',
    coverSubtitle: 'Pruebas de Agua',
    title: 'Calidad de agua',
    subtitle: 'Pruebas semanales de las peceras del Biomuseo Xolotlcalli.',
    overview: 'Resumen',
    detail: 'Detalle',
    back: 'Volver al resumen',
    mondaysOnly: 'Solo lunes',
    allMeasurements: 'Todas las mediciones',
    windowLabel: 'Rango',
    'window.4': '4 sem',
    'window.12': '12 sem',
    'window.26': '26 sem',
    'window.all': 'Todo',
    navPrev: 'Semana anterior',
    navNext: 'Semana siguiente',
    week: 'Semana',
    prevWeek: 'Semana anterior',
    thisWeek: 'Esta semana',
    indicator: 'Indicador',
    statusOk: 'Dentro de rango',
    statusWarn: 'Cerca del límite',
    statusAlarm: 'Fuera de rango',
    historyTitle: 'Histórico',
    historyEmpty: 'Sin datos en este rango.',
    emptyWeek: 'Sin pruebas registradas esta semana.',
    safeRange: 'Rango seguro',
    loading: 'Cargando…',
    'param.temp': 'Temperatura',
    'param.nh3': 'Amoníaco (NH₃)',
    'param.no2': 'Nitritos (NO₂)',
    'param.no3': 'Nitratos (NO₃)',
    'param.gh': 'GH',
    'param.kh': 'KH',
    'param.ph': 'pH',
    'param.po4': 'Fosfatos (PO₄)',
    'param.cond': 'Conductividad',
    'param.tds': 'TDS',
    'species.andersoni': 'A. andersoni',
    'species.mexicanum': 'A. mexicanum',
    'species.dumerilii': 'A. dumerilii',
    'species.control': 'Control',
    'species.guppies': 'Guppies',
    'species.na': '—',
    'month.0': 'enero', 'month.1': 'febrero', 'month.2': 'marzo', 'month.3': 'abril',
    'month.4': 'mayo', 'month.5': 'junio', 'month.6': 'julio', 'month.7': 'agosto',
    'month.8': 'septiembre', 'month.9': 'octubre', 'month.10': 'noviembre', 'month.11': 'diciembre',
  },
  en: {
    coverTitle: 'Maintenance Monday',
    coverSubtitle: 'Water Tests',
    title: 'Water quality',
    subtitle: 'Weekly measurements from the Xolotlcalli BioMuseum tanks.',
    overview: 'Overview',
    detail: 'Detail',
    back: 'Back to overview',
    mondaysOnly: 'Mondays only',
    allMeasurements: 'All measurements',
    windowLabel: 'Window',
    'window.4': '4 wk',
    'window.12': '12 wk',
    'window.26': '26 wk',
    'window.all': 'All',
    navPrev: 'Previous week',
    navNext: 'Next week',
    week: 'Week',
    prevWeek: 'Previous week',
    thisWeek: 'This week',
    indicator: 'Indicator',
    statusOk: 'In range',
    statusWarn: 'Near limit',
    statusAlarm: 'Out of range',
    historyTitle: 'History',
    historyEmpty: 'No data in this range.',
    emptyWeek: 'No tests recorded this week.',
    safeRange: 'Safe range',
    loading: 'Loading…',
    'param.temp': 'Temperature',
    'param.nh3': 'Ammonia (NH₃)',
    'param.no2': 'Nitrites (NO₂)',
    'param.no3': 'Nitrates (NO₃)',
    'param.gh': 'GH',
    'param.kh': 'KH',
    'param.ph': 'pH',
    'param.po4': 'Phosphates (PO₄)',
    'param.cond': 'Conductivity',
    'param.tds': 'TDS',
    'species.andersoni': 'A. andersoni',
    'species.mexicanum': 'A. mexicanum',
    'species.dumerilii': 'A. dumerilii',
    'species.control': 'Control',
    'species.guppies': 'Guppies',
    'species.na': '—',
    'month.0': 'January', 'month.1': 'February', 'month.2': 'March', 'month.3': 'April',
    'month.4': 'May', 'month.5': 'June', 'month.6': 'July', 'month.7': 'August',
    'month.8': 'September', 'month.9': 'October', 'month.10': 'November', 'month.11': 'December',
  },
  pt: {
    coverTitle: 'Segunda de Manutenção',
    coverSubtitle: 'Testes de Água',
    title: 'Qualidade da água',
    subtitle: 'Medições semanais dos aquários do BioMuseu Xolotlcalli.',
    overview: 'Resumo',
    detail: 'Detalhe',
    back: 'Voltar ao resumo',
    mondaysOnly: 'Só segundas',
    allMeasurements: 'Todas as medições',
    windowLabel: 'Intervalo',
    'window.4': '4 sem',
    'window.12': '12 sem',
    'window.26': '26 sem',
    'window.all': 'Tudo',
    navPrev: 'Semana anterior',
    navNext: 'Próxima semana',
    week: 'Semana',
    prevWeek: 'Semana anterior',
    thisWeek: 'Esta semana',
    indicator: 'Indicador',
    statusOk: 'Dentro do intervalo',
    statusWarn: 'Perto do limite',
    statusAlarm: 'Fora do intervalo',
    historyTitle: 'Histórico',
    historyEmpty: 'Sem dados neste intervalo.',
    emptyWeek: 'Sem testes registrados esta semana.',
    safeRange: 'Faixa segura',
    loading: 'Carregando…',
    'param.temp': 'Temperatura',
    'param.nh3': 'Amônia (NH₃)',
    'param.no2': 'Nitritos (NO₂)',
    'param.no3': 'Nitratos (NO₃)',
    'param.gh': 'GH',
    'param.kh': 'KH',
    'param.ph': 'pH',
    'param.po4': 'Fosfatos (PO₄)',
    'param.cond': 'Condutividade',
    'param.tds': 'TDS',
    'species.andersoni': 'A. andersoni',
    'species.mexicanum': 'A. mexicanum',
    'species.dumerilii': 'A. dumerilii',
    'species.control': 'Controle',
    'species.guppies': 'Guppies',
    'species.na': '—',
    'month.0': 'janeiro', 'month.1': 'fevereiro', 'month.2': 'março', 'month.3': 'abril',
    'month.4': 'maio', 'month.5': 'junho', 'month.6': 'julho', 'month.7': 'agosto',
    'month.8': 'setembro', 'month.9': 'outubro', 'month.10': 'novembro', 'month.11': 'dezembro',
  },
};

export function paramLabel(locale: Locale, k: ParamKey): string {
  return STRINGS[locale][`param.${k}`] ?? k;
}

export function speciesLabel(locale: Locale, s: SpeciesCode): string {
  return STRINGS[locale][`species.${s}`] ?? '—';
}

export function monthLabel(locale: Locale, m: number): string {
  return STRINGS[locale][`month.${m}`] ?? '';
}

export function formatWeekDate(locale: Locale, iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const day = d;
  const month = monthLabel(locale, m - 1);
  const year = y;
  if (locale === 'en') return `${month} ${day}, ${year}`;
  return `${day} de ${month} ${year}`;
}

export function formatShortDate(locale: Locale, iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const month = monthLabel(locale, m - 1).slice(0, 3);
  return `${d} ${month}`;
}

export function formatNumber(value: number | null, key: ParamKey): string {
  if (value == null) return '—';
  // Sensible decimal precision per parameter type
  if (key === 'temp' || key === 'ph') return value.toFixed(1);
  if (key === 'cond' || key === 'tds' || key === 'gh' || key === 'kh' || key === 'no3') return String(Math.round(value));
  return value.toFixed(2).replace(/\.?0+$/, '') || '0';
}

export function formatUnit(unit: string): string {
  return unit.trim().replace(/\s+/g, ' ');
}
