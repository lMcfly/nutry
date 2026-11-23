import { filterCompatibleRecipes, isBreakfastRecipe } from '../recipe';
import type { ProteinType, Recipe } from '../recipe';
import type { Profile } from '../profile';
import type { LearnedWeights } from '../preferences';
import type { PlannedMeal, ScoreBreakdown, WeeklyPlan } from './mealplan.types';
import { dayRequirements } from './schedule';
import { rankRecipes } from './scoring';
import type { RankedRecipe } from './scoring';

export interface ReplaceMealInput {
  readonly plan: WeeklyPlan;
  readonly mealId: string;
  readonly profile: Profile;
  readonly recipes: readonly Recipe[];
  readonly weights?: LearnedWeights;
  /** Nombre d'alternatives (3 par défaut). */
  readonly count?: number;
}

/**
 * Alternatives pour un repas : même niveau que le plat actuel, compatibles avec le
 * profil (filtres durs), absentes de la semaine, du même type (petit-déjeuner ou plat),
 * triées par score dans le contexte du repas (date, temps, protéines précédente et
 * suivante ; pour un dîner à restes, le repas suivant est celui qui suit ses restes).
 */
export function replaceMeal(input: ReplaceMealInput): RankedRecipe[] {
  const { plan, profile } = input;
  const index = plan.meals.findIndex((m) => m.id === input.mealId);
  const meal = plan.meals[index];
  if (!meal) return [];

  const byId = new Map(input.recipes.map((r) => [r.id, r]));
  const level = byId.get(meal.recipeId)?.level ?? meal.requestedLevel;
  const inPlan = new Set(plan.meals.map((m) => m.recipeId));
  const breakfast = meal.slot === 'petit-dejeuner';

  const pool = filterCompatibleRecipes(input.recipes, profile).filter(
    (r) =>
      isBreakfastRecipe(r) === breakfast &&
      !inPlan.has(r.id) &&
      (level === undefined || r.level === level),
  );

  const others = plan.meals.filter((m) => m.id !== meal.id && m.leftoverOf !== meal.id);
  const proteinOf = (m: PlannedMeal): ProteinType | undefined => byId.get(m.recipeId)?.mainProtein;
  const proteinCounts = new Map<ProteinType, number>();
  for (const m of others) {
    const protein = m.slot === 'petit-dejeuner' ? undefined : proteinOf(m);
    if (protein) proteinCounts.set(protein, (proteinCounts.get(protein) ?? 0) + 1);
  }
  const previousMain = plan.meals
    .slice(0, index)
    .filter((m) => m.slot !== 'petit-dejeuner')
    .at(-1);
  const previousProtein = breakfast || !previousMain ? undefined : proteinOf(previousMain);
  const nextMain = plan.meals
    .slice(index + 1)
    .find((m) => m.slot !== 'petit-dejeuner' && m.leftoverOf !== meal.id);
  const nextProtein = breakfast || !nextMain ? undefined : proteinOf(nextMain);
  const req = dayRequirements(profile, meal.date);

  return rankRecipes(pool, {
    likes: profile.likes,
    batchCooking: profile.batchCooking,
    ...(input.weights ? { weights: input.weights } : {}),
    date: meal.date,
    availableMinutes: req.minutes,
    weekend: req.weekend,
    ...(breakfast ? {} : { desiredLevel: req.level, proteinCounts }),
    ...(previousProtein ? { previousProtein } : {}),
    ...(nextProtein ? { nextProtein } : {}),
  }).slice(0, input.count ?? 3);
}

/**
 * Applique un remplacement choisi par l'utilisateur. Les restes qui dépendaient du
 * repas remplacé suivent le nouveau plat ; un repas « restes » remplacé redevient un
 * repas cuisiné.
 */
export function applyReplacement(
  plan: WeeklyPlan,
  mealId: string,
  replacement: { readonly recipe: Recipe; readonly score: ScoreBreakdown },
): WeeklyPlan {
  return {
    ...plan,
    meals: plan.meals.map((m): PlannedMeal => {
      if (m.id === mealId) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { leftoverOf, ...rest } = m;
        return {
          ...rest,
          recipeId: replacement.recipe.id,
          isLeftover: false,
          relaxed: [],
          score: replacement.score,
        };
      }
      return m.leftoverOf === mealId ? { ...m, recipeId: replacement.recipe.id } : m;
    }),
  };
}
