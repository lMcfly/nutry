import { hasTag } from '@domain/recipe';
import type { Recipe } from '@domain/recipe';

export const BREAD_SUGGESTION = 'Avec une tranche de pain complet 🍞';

/** Plat sans féculent (étiquette `accompagner-pain`) : suggestion douce de pain complet. */
export function suggestsBread(recipe: Recipe): boolean {
  return hasTag(recipe, 'accompagner-pain');
}
