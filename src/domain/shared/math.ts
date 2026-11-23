/** Borne `value` dans [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Retire le bruit de virgule flottante d'un multiple de pas décimal
 * (`23 * 0.05` vaut 1.1500000000000001 en IEEE 754 → 1.15).
 */
function clean(value: number): number {
  return Number(value.toFixed(10));
}

/** Arrondit au multiple de `step` le plus proche (ex. `roundTo(12.3, 0.5)` → 12.5). */
export function roundTo(value: number, step: number): number {
  return clean(Math.round(value / step) * step);
}

/** Arrondit au multiple supérieur de `step`. */
export function ceilTo(value: number, step: number): number {
  return clean(Math.ceil(value / step - 1e-9) * step);
}
