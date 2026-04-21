import type { Status, Trend } from './types';

export function statusOf(
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
): Status {
  if (value == null) return 'ok';
  if (min != null && value < min * 0.9) return 'alarm';
  if (max != null && value > max * 1.1) return 'alarm';
  if (min != null && value < min) return 'warn';
  if (max != null && value > max) return 'warn';
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

// The Instagram carousel uses just two bins: ok (green check) vs warn/alarm
// (yellow caution). Keep the distinction available internally but expose a
// two-state helper for the trend card.
export function indicatorTone(status: Status): 'ok' | 'alert' {
  return status === 'ok' ? 'ok' : 'alert';
}
