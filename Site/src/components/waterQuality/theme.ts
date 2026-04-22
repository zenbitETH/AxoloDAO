import { useEffect, useState } from 'preact/hooks';
import type { SpeciesCode } from './types';

export type ThemeMode = 'light' | 'dark';

// Reactive hook for the current [data-theme] on <html>. Reads immediately on
// mount and listens for attribute changes so the island stays in sync with
// the site-wide theme toggle.
export function useTheme(): ThemeMode {
  const read = (): ThemeMode =>
    typeof document !== 'undefined' &&
    document.documentElement.dataset.theme === 'dark'
      ? 'dark'
      : 'light';

  const [theme, setTheme] = useState<ThemeMode>(read);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    setTheme(read());
    const obs = new MutationObserver(() => setTheme(read()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => obs.disconnect();
  }, []);

  return theme;
}

// Each species has two tones: a light-mode accent that reads on cream, and a
// noticeably brighter dark-mode accent that reads on the warm-charcoal
// surface. Teal and green shift the most because the light-mode tones are
// already dark — they'd vanish on a dark background.
const SPECIES_ACCENT_LIGHT: Record<SpeciesCode, string> = {
  andersoni: '#B87333',
  mexicanum: '#2C5F7C',
  dumerilii: '#3E6B4A',
  control:   '#4A3628',
  guppies:   '#4A3628',
  na:        '#4A3628',
};
const SPECIES_ACCENT_DARK: Record<SpeciesCode, string> = {
  andersoni: '#E2A066',
  mexicanum: '#7EB2D1',
  dumerilii: '#7AB58C',
  control:   '#D0C3A8',
  guppies:   '#D0C3A8',
  na:        '#D0C3A8',
};

export function accentForTheme(
  speciesCode: SpeciesCode,
  theme: ThemeMode,
  fallback?: string,
): string {
  const map = theme === 'dark' ? SPECIES_ACCENT_DARK : SPECIES_ACCENT_LIGHT;
  return map[speciesCode] ?? fallback ?? map.na;
}
