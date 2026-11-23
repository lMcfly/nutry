import { WAIST_TO_HEIGHT_ALERT_THRESHOLD } from './profile.constants';

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} doit être un nombre strictement positif (reçu : ${value})`);
  }
}

/** Indice de masse corporelle : poids (kg) / taille (m)². */
export function computeBmi(weightKg: number, heightCm: number): number {
  assertPositive(weightKg, 'Le poids');
  assertPositive(heightCm, 'La taille');
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

/** Rapport tour de taille / taille (sans unité). */
export function computeWaistToHeightRatio(waistCm: number, heightCm: number): number {
  assertPositive(waistCm, 'Le tour de taille');
  assertPositive(heightCm, 'La taille');
  return waistCm / heightCm;
}

/** Vrai si le rapport tour de taille / taille atteint le seuil d'alerte (≥ 0,5). */
export function isWaistToHeightAlert(ratio: number): boolean {
  return ratio >= WAIST_TO_HEIGHT_ALERT_THRESHOLD;
}
