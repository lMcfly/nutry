import type { Season } from '../season';
import type { Aisle, Allergen, Diet, Level, ProteinType, Unit } from './recipe.constants';

export interface RecipeIngredient {
  readonly name: string;
  readonly quantity: number;
  readonly unit: Unit;
  readonly aisle: Aisle;
}

/** Proportions de l'assiette (modèle ½ légumes, ¼ protéines, ¼ féculents). Somme = 1. */
export interface PlateBalance {
  readonly vegetables: number;
  readonly proteins: number;
  readonly starches: number;
}

export interface NutritionPerServing {
  readonly kcal: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
  readonly fiberG: number;
}

/** Recette — schéma défini dans PROMPT.md §4. */
export interface Recipe {
  readonly id: string;
  readonly name: string;
  readonly level: Level;
  readonly prepMinutes: number;
  readonly cookMinutes: number;
  readonly servings: number;
  /** Régimes compatibles. */
  readonly diets: readonly Diet[];
  /** Allergènes présents (exclusion stricte côté profil). */
  readonly allergens: readonly Allergen[];
  readonly mainProtein: ProteinType;
  readonly seasons: readonly Season[];
  readonly ingredients: readonly RecipeIngredient[];
  readonly steps: readonly string[];
  readonly plateBalance: PlateBalance;
  readonly nutritionPerServing: NutritionPerServing;
  /** Étiquettes libres : "batch", "restes", "monde", "sans cuisson"… */
  readonly tags: readonly string[];
}
