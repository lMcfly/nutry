import { containsAnyTerm, tokenize } from '../shared';
import { AROMATICS, PULSE_TERMS, WHOLE_GRAIN_TERMS, categorizeIngredient } from '../recipe';
import type { Recipe } from '../recipe';
import { findProduce } from '../season';
import type { WeeklyPlan } from './mealplan.types';

export type BalanceGaugeKey = 'vegetables' | 'legumes' | 'fish' | 'wholeGrains';

/** Jauge de variété : `value` = min(1, count / target). Aucune donnée calorique. */
export interface BalanceGauge {
  readonly key: BalanceGaugeKey;
  readonly label: string;
  readonly count: number;
  readonly target: number;
  readonly value: number;
}

/**
 * Cibles hebdomadaires (à faire valider par un·e diététicien·ne), inspirées des
 * repères du PNNS : légumineuses et poisson au moins 2 fois par semaine, un féculent
 * complet par jour ; 10 légumes différents dans la semaine pour la variété.
 */
export const BALANCE_TARGETS: Readonly<Record<BalanceGaugeKey, number>> = {
  vegetables: 10,
  legumes: 2,
  fish: 2,
  wholeGrains: 7,
};

const LABELS: Readonly<Record<BalanceGaugeKey, string>> = {
  vegetables: 'Légumes variés',
  legumes: 'Légumineuses',
  fish: 'Poissons',
  wholeGrains: 'Céréales complètes',
};

/**
 * Indicateur d'équilibre de la semaine, compté sur les repas consommés (restes compris) :
 * - légumes : nombre de légumes DIFFÉRENTS (rayon fruits & légumes, hors aromates,
 *   pommes de terre et fruits du calendrier) ;
 * - légumineuses : repas à protéine `legumineuses` ou contenant une légumineuse ;
 * - poissons : repas à protéine `poisson` ou `fruits-de-mer` ;
 * - céréales complètes : repas contenant une céréale complète (riz complet, avoine…).
 */
export function computeWeekBalance(plan: WeeklyPlan, recipes: readonly Recipe[]): BalanceGauge[] {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const vegetables = new Set<string>();
  let legumes = 0;
  let fish = 0;
  let wholeGrains = 0;

  for (const meal of plan.meals) {
    const recipe = byId.get(meal.recipeId);
    if (!recipe) continue;
    const names = recipe.ingredients.map((i) => i.name);
    for (const ingredient of recipe.ingredients) {
      const produce = findProduce(ingredient.name);
      if (
        categorizeIngredient(ingredient) === 'legume' &&
        !containsAnyTerm(ingredient.name, AROMATICS) &&
        produce?.kind !== 'fruit'
      ) {
        vegetables.add(produce?.name ?? tokenize(ingredient.name).join(' '));
      }
    }
    if (
      recipe.mainProtein === 'legumineuses' ||
      names.some((n) => containsAnyTerm(n, PULSE_TERMS))
    ) {
      legumes += 1;
    }
    if (recipe.mainProtein === 'poisson' || recipe.mainProtein === 'fruits-de-mer') fish += 1;
    if (names.some((n) => containsAnyTerm(n, WHOLE_GRAIN_TERMS))) wholeGrains += 1;
  }

  const counts: Record<BalanceGaugeKey, number> = {
    vegetables: vegetables.size,
    legumes,
    fish,
    wholeGrains,
  };
  return (Object.keys(BALANCE_TARGETS) as BalanceGaugeKey[]).map((key) => ({
    key,
    label: LABELS[key],
    count: counts[key],
    target: BALANCE_TARGETS[key],
    value: Math.min(1, counts[key] / BALANCE_TARGETS[key]),
  }));
}
