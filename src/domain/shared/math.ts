/** Borne `value` dans [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Arrondit au multiple de `step` le plus proche (ex. `roundTo(12.3, 0.5)` → 12.5). */
export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Arrondit au multiple supérieur de `step`. */
export function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step - 1e-9) * step;
}
