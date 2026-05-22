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

// Theme-aware palette. Light theme keeps the saturated "vanilla" species
// colors curators chose on the cream surface; dark theme uses brighter
// variants for mexicanum and dumerilii so AM / AD tank cards read against
// the dark navy background. There is a brief SSR→hydration color flip on
// dark theme load (the pre-hydration React render uses the light fallback);
// it's an acceptable trade-off for legibility per the user's request.
const SPECIES_ACCENT_LIGHT: Record<SpeciesCode, string> = {
  andersoni: '#B87333',
  mexicanum: '#2C5F7C',
  dumerilii: '#3E6B4A',
  control:   '#4A3628',
  guppies:   '#4A3628',
  na:        '#4A3628',
};
const SPECIES_ACCENT_DARK: Record<SpeciesCode, string> = {
  andersoni: '#B87333',
  mexicanum: '#4A8FC5',
  dumerilii: '#5C9F70',
  control:   '#7A5B47',
  guppies:   '#7A5B47',
  na:        '#7A5B47',
};

export function accentForTheme(
  speciesCode: SpeciesCode,
  theme: ThemeMode,
  fallback?: string,
): string {
  const map = theme === 'dark' ? SPECIES_ACCENT_DARK : SPECIES_ACCENT_LIGHT;
  return map[speciesCode] ?? fallback ?? map.na;
}
