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

// Single saturated palette for both themes. The pre-hydration render reads
// well on dark and is the curators' preferred contrast on cream too, so we
// drop the dual palette to avoid the SSR→hydration color flip and the same
// flicker when returning from the Bajas view.
const SPECIES_ACCENT_LIGHT: Record<SpeciesCode, string> = {
  andersoni: '#B87333',
  mexicanum: '#2C5F7C',
  dumerilii: '#3E6B4A',
  control:   '#4A3628',
  guppies:   '#4A3628',
  na:        '#4A3628',
};
const SPECIES_ACCENT_DARK: Record<SpeciesCode, string> = SPECIES_ACCENT_LIGHT;

export function accentForTheme(
  speciesCode: SpeciesCode,
  theme: ThemeMode,
  fallback?: string,
): string {
  const map = theme === 'dark' ? SPECIES_ACCENT_DARK : SPECIES_ACCENT_LIGHT;
  return map[speciesCode] ?? fallback ?? map.na;
}
