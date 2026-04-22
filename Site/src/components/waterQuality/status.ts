import type { Status, Trend } from './types';

// statusOf — three-state safety classifier:
//   - 'alarm' when value falls outside the safe range (red, pulsing in UI)
//   - 'warn'  when value sits within 5% of the safe-range span from either limit
//   - 'ok'    otherwise (green check)
//
// The 5% band is computed against (max - min), so it scales sensibly across
// parameters with very different ranges. When a parameter has a degenerate
// range (e.g. NH3 with min == max == 0) the warn band collapses, and we
// classify as 'ok' below the alarm threshold and 'alarm' above it.
export function statusOf(
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
): Status {
  if (value == null) return 'ok';
  if (max != null && value > max) return 'alarm';
  if (min != null && value < min) return 'alarm';
  if (min != null && max != null) {
    const range = max - min;
    if (range > 0) {
      const band = range * 0.05;
      if (value >= max - band || value <= min + band) return 'warn';
    }
  }
  return 'ok';
}

export function trendOf(
  prev: number | null | undefined,
  curr: number | null | undefined,
  epsilon = 1e-9,
): Trend {
  if (prev == null || curr == null) return 'equal';
  const d = curr - prev;
  if (Math.abs(d) <= epsilon) return 'equal';
  return d > 0 ? 'up' : 'down';
}
