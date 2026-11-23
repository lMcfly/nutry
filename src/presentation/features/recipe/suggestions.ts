import type { Recipe } from '@domain/recipe';

/**
 * Étiquette `accompagner-pain` : comparaison de chaîne volontairement tolérante, pour ne
 * pas dépendre de la présence de la constante dans `RECIPE_TAGS`.
 */
export const BREAD_TAG = 'accompagner-pain';

export const BREAD_SUGGESTION = 'Avec une tranche de pain complet 🍞';

export function suggestsBread(recipe: Pick<Recipe, 'tags'>): boolean {
  return (recipe.tags as readonly string[]).includes(BREAD_TAG);
}
