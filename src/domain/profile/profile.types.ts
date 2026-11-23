import type { Allergen, Diet, Level } from '../recipe';
import type { ActivityLevel, Goal, Sex } from './profile.constants';

/** Profil utilisateur, saisi à l'onboarding et modifiable dans l'écran Profil. */
export interface Profile {
  readonly age: number;
  readonly sex: Sex;
  readonly heightCm: number;
  readonly weightKg: number;
  /** Tour de taille (optionnel). */
  readonly waistCm?: number;
  readonly activity: ActivityLevel;
  readonly goal: Goal;
  readonly diets: readonly Diet[];
  /** Exclusion stricte : jamais proposés. */
  readonly allergens: readonly Allergen[];
  /** Ingrédients ou protéines principales aimés (bonus de score). */
  readonly likes: readonly string[];
  /** Ingrédients ou protéines principales détestés (exclusion stricte). */
  readonly dislikes: readonly string[];
  /** Nombre de personnes au foyer, utilisateur compris (≥ 1). */
  readonly householdSize: number;
  /** Temps disponible par repas, en minutes (lundi-vendredi / samedi-dimanche). */
  readonly weekdayMinutes: number;
  readonly weekendMinutes: number;
  readonly weekdayLevel: Level;
  readonly weekendLevel: Level;
  /** Inclure le petit-déjeuner dans le menu. */
  readonly breakfast: boolean;
  /** Session de préparation le dimanche. */
  readonly batchCooking: boolean;
  /** Pris en compte si le sexe est 'femme' ou 'autre'. */
  readonly pregnantOrBreastfeeding: boolean;
}
