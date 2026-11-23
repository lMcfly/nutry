import { containsTerm } from '../shared';
import { BASIC_INGREDIENTS, filterCompatibleRecipes, isBasicIngredient } from '../recipe';
import type { DietaryConstraints, Recipe, RecipeIngredient } from '../recipe';

export { BASIC_INGREDIENTS };

export interface FridgeSuggestion {
  readonly recipe: Recipe;
  /** Ingrédients manquants (hors basiques : sel, poivre, huile, eau). */
  readonly missing: readonly RecipeIngredient[];
  /** Ingrédients disponibles utilisés par la recette. */
  readonly matched: readonly RecipeIngredient[];
}

export interface FridgeInput {
  readonly constraints: DietaryConstraints;
  readonly recipes: readonly Recipe[];
  /** Ingrédients cochés par l'utilisateur (saisie libre, ex. « tomates »). */
  readonly available: readonly string[];
  readonly limit?: number;
}

/** Vrai si l'ingrédient correspond à l'un des aliments disponibles (dans un sens ou l'autre). */
function isAvailable(ingredient: RecipeIngredient, available: readonly string[]): boolean {
  return available.some(
    (a) => containsTerm(ingredient.name, a) || containsTerm(a, ingredient.name),
  );
}

/**
 * Mode « frigo vide » : recettes compatibles avec le profil (filtres durs) utilisant au
 * moins un ingrédient disponible, triées par nombre d'ingrédients manquants, puis par
 * nombre d'ingrédients utilisés, puis par nom.
 */
export function suggestFromFridge(input: FridgeInput): FridgeSuggestion[] {
  const suggestions = filterCompatibleRecipes(input.recipes, input.constraints)
    .map((recipe) => {
      const relevant = recipe.ingredients.filter((i) => !isBasicIngredient(i.name));
      return {
        recipe,
        matched: relevant.filter((i) => isAvailable(i, input.available)),
        missing: relevant.filter((i) => !isAvailable(i, input.available)),
      };
    })
    .filter((s) => s.matched.length > 0)
    .sort(
      (a, b) =>
        a.missing.length - b.missing.length ||
        b.matched.length - a.matched.length ||
        a.recipe.name.localeCompare(b.recipe.name, 'fr'),
    );
  return input.limit === undefined ? suggestions : suggestions.slice(0, input.limit);
}
