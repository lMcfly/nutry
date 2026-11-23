import { containsTerm } from '../shared';
import type { Allergen, Diet, RecipeTag } from './recipe.constants';
import type { Recipe } from './recipe.types';

/** Contraintes alimentaires d'une personne (sous-ensemble du profil). */
export interface DietaryConstraints {
  readonly diets: readonly Diet[];
  readonly allergens: readonly Allergen[];
  /** Ingrédients ou protéines principales à exclure (saisie libre). */
  readonly dislikes: readonly string[];
  /** Grossesse ou allaitement (pris en compte si `sex` n'est pas 'homme'). */
  readonly pregnantOrBreastfeeding?: boolean;
  readonly sex?: 'homme' | 'femme' | 'autre';
}

/** Étiquettes exclues pendant la grossesse ou l'allaitement (alcool, produits crus). */
export const PREGNANCY_EXCLUDED_TAGS: readonly RecipeTag[] = ['alcool', 'cru'];

/** Grossesse / allaitement n'est pris en compte que pour 'femme' et 'autre'. */
export function isPregnancyRelevant(
  person: Pick<DietaryConstraints, 'pregnantOrBreastfeeding' | 'sex'>,
): boolean {
  return person.sex !== 'homme' && person.pregnantOrBreastfeeding === true;
}

export function hasTag(recipe: Recipe, tag: RecipeTag): boolean {
  return recipe.tags.includes(tag);
}

export function isBreakfastRecipe(recipe: Recipe): boolean {
  return hasTag(recipe, 'petit-dejeuner');
}

/** Temps total (préparation + cuisson), en minutes. */
export function totalMinutes(recipe: Recipe): number {
  return recipe.prepMinutes + recipe.cookMinutes;
}

/** Allergènes de la recette parmi ceux déclarés. */
export function declaredAllergensIn(recipe: Recipe, allergens: readonly Allergen[]): Allergen[] {
  return recipe.allergens.filter((a) => allergens.includes(a));
}

/** Vrai si la recette contient au moins un des allergènes déclarés. */
export function containsAllergen(recipe: Recipe, allergens: readonly Allergen[]): boolean {
  return declaredAllergensIn(recipe, allergens).length > 0;
}

/** La recette doit lister TOUS les régimes de la personne (aucun régime → tout convient). */
export function matchesDiets(recipe: Recipe, diets: readonly Diet[]): boolean {
  return diets.every((d) => recipe.diets.includes(d));
}

/** Vrai si `term` désigne un ingrédient ou la protéine principale de la recette. */
export function recipeMentions(recipe: Recipe, term: string): boolean {
  return (
    containsTerm(recipe.mainProtein, term) ||
    recipe.ingredients.some((ingredient) => containsTerm(ingredient.name, term))
  );
}

/** Aliments détestés présents dans la recette. */
export function dislikedIn(recipe: Recipe, dislikes: readonly string[]): string[] {
  return dislikes.filter((term) => recipeMentions(recipe, term));
}

/**
 * Filtre DUR appliqué par toutes les fonctions qui proposent une recette (menu,
 * remplacement, frigo vide) : aucun allergène déclaré, tous les régimes respectés,
 * aucun aliment détesté et, pendant la grossesse ou l'allaitement, ni alcool ni cru.
 */
export function isRecipeCompatible(recipe: Recipe, constraints: DietaryConstraints): boolean {
  return (
    !containsAllergen(recipe, constraints.allergens) &&
    matchesDiets(recipe, constraints.diets) &&
    dislikedIn(recipe, constraints.dislikes).length === 0 &&
    !(
      isPregnancyRelevant(constraints) &&
      PREGNANCY_EXCLUDED_TAGS.some((tag) => recipe.tags.includes(tag))
    )
  );
}

export function filterCompatibleRecipes(
  recipes: readonly Recipe[],
  constraints: DietaryConstraints,
): Recipe[] {
  return recipes.filter((r) => isRecipeCompatible(r, constraints));
}
