import { clamp } from '../shared';
import { categorizeIngredient } from '../recipe';
import type { IngredientCategory, Recipe, RecipeIngredient } from '../recipe';
import { PORTION_FACTOR_MAX, PORTION_FACTOR_MIN, REFERENCE_KCAL } from './profile.constants';

/**
 * Facteur de portion de l'utilisateur : cible / 2 000 kcal, multiplié par l'ajustement
 * appris (« trop copieux » → −5 % par avis), borné à [0,8 ; 1,3].
 */
export function computePortionFactor(targetKcal: number, learnedMultiplier = 1): number {
  return clamp(
    (targetKcal / REFERENCE_KCAL) * learnedMultiplier,
    PORTION_FACTOR_MIN,
    PORTION_FACTOR_MAX,
  );
}

/**
 * Facteur appliqué à un ingrédient pour une personne : les légumes ne sont jamais
 * réduits (≥ 1), protéines et féculents suivent le facteur, condiments inchangés.
 */
export function factorForCategory(category: IngredientCategory, personFactor: number): number {
  switch (category) {
    case 'legume':
      return Math.max(1, personFactor);
    case 'proteine-feculent':
      return personFactor;
    case 'condiment':
      return 1;
  }
}

export interface HouseholdPortions {
  /** Facteur de portion de l'utilisateur (voir `computePortionFactor`). */
  readonly userFactor: number;
  /** Nombre de personnes, utilisateur compris ; les autres membres comptent pour 1,0. */
  readonly householdSize: number;
  /** Nombre de repas couverts par une même cuisson (2 si les restes servent le lendemain). */
  readonly batches?: number;
}

/**
 * Quantités d'une recette pour le foyer : (quantité / portions de la recette) ×
 * (facteur de l'utilisateur selon la catégorie + 1 par autre membre) × repas couverts.
 * Les quantités sont brutes (non arrondies) ; l'arrondi relève de la liste de courses.
 */
export function scaleRecipeForHousehold(
  recipe: Recipe,
  portions: HouseholdPortions,
): RecipeIngredient[] {
  const others = Math.max(0, Math.floor(portions.householdSize) - 1);
  const batches = portions.batches ?? 1;
  return recipe.ingredients.map((ingredient) => {
    const perServing = ingredient.quantity / recipe.servings;
    const userShare = factorForCategory(categorizeIngredient(ingredient), portions.userFactor);
    return { ...ingredient, quantity: perServing * (userShare + others) * batches };
  });
}
