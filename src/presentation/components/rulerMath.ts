/** Conversions entre position de défilement de la règle graduée et valeur (testées sans mise en page). */

/** Écartement entre deux graduations, en pixels (aussi lu par la feuille de style). */
export const TICK_PX = 11;

/** Valeur d'une graduation : arrondie pour éviter les restes de calcul flottant (0,5 + 0,5…). */
export function rulerValueAt(index: number, min: number, unit: number): number {
  return Math.round((min + index * unit) * 1000) / 1000;
}

/** Graduation sous le repère pour une position de défilement (bornée à la règle). */
export function rulerIndexOfScroll(
  scrollLeft: number,
  min: number,
  max: number,
  unit: number,
): number {
  const last = Math.round((max - min) / unit);
  return Math.min(last, Math.max(0, Math.round(scrollLeft / TICK_PX)));
}

/** Valeur sous le repère pour une position de défilement. */
export function rulerValueOfScroll(
  scrollLeft: number,
  min: number,
  max: number,
  unit: number,
): number {
  return rulerValueAt(rulerIndexOfScroll(scrollLeft, min, max, unit), min, unit);
}

/** Position de défilement qui place une valeur sous le repère (la valeur est bornée à la règle). */
export function rulerScrollOfValue(value: number, min: number, max: number, unit: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  return Math.round((clamped - min) / unit) * TICK_PX;
}
