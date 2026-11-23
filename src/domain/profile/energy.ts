import { ACTIVITY_COEFFICIENTS, ENERGY_FLOOR_KCAL, MAX_DEFICIT_RATIO } from './profile.constants';
import type { ActivityLevel, Sex } from './profile.constants';

export interface BmrInput {
  readonly age: number;
  readonly sex: Sex;
  readonly heightCm: number;
  readonly weightKg: number;
}

const SEX_CONSTANT: Readonly<Record<Sex, number>> = {
  homme: 5,
  femme: -161,
  // Moyenne des formules homme et femme.
  autre: (5 - 161) / 2,
};

/** Métabolisme de base (kcal/jour), formule de Mifflin-St Jeor. */
export function computeBmr({ age, sex, heightCm, weightKg }: BmrInput): number {
  for (const [label, value] of [
    ['L’âge', age],
    ['La taille', heightCm],
    ['Le poids', weightKg],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`${label} doit être un nombre strictement positif (reçu : ${value})`);
    }
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age + SEX_CONSTANT[sex];
}

/** Besoins journaliers (kcal) = métabolisme de base × coefficient d'activité. */
export function computeEnergyNeeds(bmr: number, activity: ActivityLevel): number {
  return bmr * ACTIVITY_COEFFICIENTS[activity];
}

/**
 * Cible en cas de perte « en douceur » : besoins − 15 % au plus, jamais sous le
 * plancher du sexe, jamais au-dessus des besoins (si les besoins sont sous le
 * plancher, la cible reste égale aux besoins : aucun déficit).
 */
export function computeGentleLossTarget(needsKcal: number, sex: Sex): number {
  const withDeficit = needsKcal * (1 - MAX_DEFICIT_RATIO);
  return Math.min(needsKcal, Math.max(ENERGY_FLOOR_KCAL[sex], withDeficit));
}
