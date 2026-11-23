import { hasTag } from '../recipe';
import type { Recipe } from '../recipe';
import { mealLabel } from './labels';
import type { WeeklyPlan } from './mealplan.types';

/** Une préparation à anticiper pendant la session du dimanche. */
export interface BatchPrep {
  readonly recipe: Recipe;
  /** Repas concernés, ex. « mardi – dîner ». */
  readonly mealLabels: readonly string[];
}

/**
 * Préparations du dimanche : recettes étiquetées `batch` cuisinées dans la semaine
 * (les restes ne sont pas recomptés). Vide si l'option batch cooking est désactivée.
 */
export function buildBatchCookingPlan(
  plan: WeeklyPlan,
  recipes: readonly Recipe[],
  batchCooking: boolean,
): BatchPrep[] {
  if (!batchCooking) return [];
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const preps = new Map<string, { recipe: Recipe; mealLabels: string[] }>();
  for (const meal of plan.meals) {
    const recipe = byId.get(meal.recipeId);
    if (meal.isLeftover || !recipe || !hasTag(recipe, 'batch')) continue;
    const prep = preps.get(recipe.id) ?? { recipe, mealLabels: [] };
    prep.mealLabels.push(mealLabel(meal));
    preps.set(recipe.id, prep);
  }
  return [...preps.values()];
}
