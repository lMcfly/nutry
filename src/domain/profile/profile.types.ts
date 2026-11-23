import type { Allergen, Diet } from '../recipe';
import type { IsoDate } from '../shared';

/**
 * PLACEHOLDER (phase 2) — profil utilisateur minimal.
 * Sera complété (âge, sexe, mensurations, activité, objectif, goûts, temps
 * disponible, niveaux souhaités…) avec le moteur de rééquilibrage.
 */
export interface Profile {
  readonly diets: readonly Diet[];
  readonly allergens: readonly Allergen[];
  readonly householdSize: number;
}

/**
 * PLACEHOLDER (phase 2) — mesure de suivi optionnelle (au plus une par semaine).
 */
export interface ProgressEntry {
  readonly date: IsoDate;
  readonly weightKg?: number;
  readonly waistCm?: number;
}
