import {
  applyReplacement,
  buildBatchCookingPlan,
  computeWeekBalance,
  explainMeal,
  generateWeeklyPlan,
  replaceMeal,
} from '@domain/mealplan';
import type { BalanceGauge, BatchPrep, PlannedMeal, ScoreBreakdown } from '@domain/mealplan';
import { isRecipeCompatible } from '@domain/recipe';
import type { Recipe } from '@domain/recipe';
import { startOfWeek } from '@domain/shared';
import type { IsoDate } from '@domain/shared';
import { dietaryFingerprint } from '@domain/userdata';
import type { RatingRecord, SavedPlan } from '@domain/userdata';
import { NO_PROFILE, indexRecipes, loadPlanningContext } from './context';
import type { AppPorts, NoProfile, PlanningContext, SerialRunner } from './context';

/**
 * `stored` : menu enregistré inchangé ; `generated` : premier menu de la semaine ;
 * `regenerated` : menu refait car les contraintes alimentaires du profil ont changé ou
 * qu'un plat n'est plus compatible (catalogue mis à jour, import…). L'UI peut le signaler.
 */
export type PlanOrigin = 'stored' | 'generated' | 'regenerated';

export interface PlanView {
  readonly status: 'ready';
  readonly plan: SavedPlan;
  readonly origin: PlanOrigin;
  /** Recettes du menu, par identifiant. */
  readonly recipes: Readonly<Record<string, Recipe>>;
  /** « Pourquoi ce plat ? », par identifiant de repas. */
  readonly explanations: Readonly<Record<string, string>>;
  /** Avis donné sur un repas (par identifiant de repas, restes compris). */
  readonly ratings: Readonly<Record<string, RatingRecord>>;
  /** Facteur de portion de la personne (`computeUserPortionFactor`). */
  readonly portionFactor: number;
  readonly householdSize: number;
}

export type PlanResult = NoProfile | PlanView;

export interface MealAlternative {
  readonly recipe: Recipe;
  readonly score: ScoreBreakdown;
  readonly explanation: string;
}

export interface PlanHistory {
  /** Menus enregistrés, du plus récent au plus ancien. */
  readonly plans: readonly SavedPlan[];
  /** Recettes encore présentes dans le catalogue, par identifiant. */
  readonly recipes: Readonly<Record<string, Recipe>>;
}

export interface PlanUseCases {
  /** Menu de la semaine en cours : enregistré, sinon généré ; régénéré si le profil a changé. */
  getCurrentPlan(): Promise<PlanResult>;
  /** Nouveau menu pour la semaine en cours (remplace l'actuel). */
  generateWeeklyPlan(): Promise<PlanResult>;
  /** 3 alternatives du même niveau pour un repas de la semaine en cours. */
  getMealAlternatives(mealId: string): Promise<readonly MealAlternative[]>;
  /**
   * Remplace un repas par l'une des alternatives proposées. `unavailable` si la recette
   * n'en fait pas (ou plus) partie : on ne place jamais une recette incompatible.
   */
  replaceMeal(input: {
    readonly mealId: string;
    readonly recipeId: string;
  }): Promise<PlanResult | { readonly status: 'unavailable' }>;
  explainMeal(mealId: string): Promise<string | undefined>;
  /** Préparations du dimanche (vide si l'option batch cooking est désactivée). */
  getBatchCookingPlan(): Promise<readonly BatchPrep[]>;
  getWeekBalance(): Promise<readonly BalanceGauge[]>;
  getPlanHistory(): Promise<PlanHistory>;
}

/** Tous les plats du menu existent encore et respectent les filtres durs du profil. */
function isPlanSafe(plan: SavedPlan, ctx: PlanningContext): boolean {
  const byId = indexRecipes(ctx.recipes);
  return plan.meals.every((meal) => {
    const recipe = byId.get(meal.recipeId);
    return recipe !== undefined && isRecipeCompatible(recipe, ctx.profile);
  });
}

export function currentWeekStart(ports: AppPorts): IsoDate {
  return startOfWeek(ports.clock.today());
}

function generate(ports: AppPorts, ctx: PlanningContext, weekStart: IsoDate): SavedPlan {
  const plan = generateWeeklyPlan({
    profile: ctx.profile,
    recipes: ctx.recipes,
    weights: ctx.weights,
    startDate: weekStart,
    rng: () => ports.random.next(),
  });
  return {
    ...plan,
    constraintsKey: dietaryFingerprint(ctx.profile),
    generatedAt: ports.clock.now().toISOString(),
  };
}

/**
 * Menu de la semaine en cours, garanti sûr pour le profil actuel. À appeler depuis une
 * tâche déjà sérialisée.
 */
export async function ensureCurrentPlan(
  ports: AppPorts,
  ctx: PlanningContext,
  force = false,
): Promise<{ readonly plan: SavedPlan; readonly origin: PlanOrigin }> {
  const weekStart = currentWeekStart(ports);
  const stored = await ports.plans.getByWeek(weekStart);
  const upToDate =
    stored !== undefined &&
    stored.constraintsKey === dietaryFingerprint(ctx.profile) &&
    isPlanSafe(stored, ctx);
  if (stored && upToDate && !force) return { plan: stored, origin: 'stored' };
  const plan = generate(ports, ctx, weekStart);
  await ports.plans.save(plan);
  return { plan, origin: stored && !upToDate ? 'regenerated' : 'generated' };
}

/** Avis rattachés aux repas d'un menu ; un repas de restes reprend l'avis du plat cuisiné. */
export function ratingsByMeal(
  plan: SavedPlan,
  ratings: readonly RatingRecord[],
): Record<string, RatingRecord> {
  const byMeal = new Map<string, RatingRecord>();
  for (const r of ratings) {
    if (r.weekStart === plan.weekStart && r.mealId !== undefined) byMeal.set(r.mealId, r);
  }
  const result: Record<string, RatingRecord> = {};
  for (const meal of plan.meals) {
    const rating = byMeal.get(meal.leftoverOf ?? meal.id);
    if (rating && rating.recipeId === meal.recipeId) result[meal.id] = rating;
  }
  return result;
}

function toPlanView(plan: SavedPlan, origin: PlanOrigin, ctx: PlanningContext): PlanView {
  const byId = indexRecipes(ctx.recipes);
  const recipes: Record<string, Recipe> = {};
  const explanations: Record<string, string> = {};
  for (const meal of plan.meals) {
    const recipe = byId.get(meal.recipeId);
    if (recipe) recipes[recipe.id] = recipe;
    explanations[meal.id] = explainMeal(meal);
  }
  return {
    status: 'ready',
    plan,
    origin,
    recipes,
    explanations,
    ratings: ratingsByMeal(plan, ctx.ratings),
    portionFactor: ctx.portionFactor,
    householdSize: ctx.profile.householdSize,
  };
}

function findMeal(plan: SavedPlan, mealId: string): PlannedMeal | undefined {
  return plan.meals.find((m) => m.id === mealId);
}

export function createPlanUseCases(ports: AppPorts, serial: SerialRunner): PlanUseCases {
  /** Charge le contexte et le menu courant (sérialisé : la génération écrit). */
  const withPlan = <T>(
    task: (ctx: PlanningContext, plan: SavedPlan, origin: PlanOrigin) => Promise<T> | T,
    fallback: T,
  ): Promise<T> =>
    serial(async () => {
      const ctx = await loadPlanningContext(ports);
      if (!ctx) return fallback;
      const { plan, origin } = await ensureCurrentPlan(ports, ctx);
      return task(ctx, plan, origin);
    });

  const alternatives = (ctx: PlanningContext, plan: SavedPlan, mealId: string, count: number) =>
    replaceMeal({
      plan,
      mealId,
      profile: ctx.profile,
      recipes: ctx.recipes,
      weights: ctx.weights,
      count,
    });

  return {
    getCurrentPlan: () =>
      withPlan<PlanResult>((ctx, plan, origin) => toPlanView(plan, origin, ctx), NO_PROFILE),

    generateWeeklyPlan: () =>
      serial(async () => {
        const ctx = await loadPlanningContext(ports);
        if (!ctx) return NO_PROFILE;
        const { plan } = await ensureCurrentPlan(ports, ctx, true);
        return toPlanView(plan, 'generated', ctx);
      }),

    getMealAlternatives: (mealId) =>
      withPlan(
        (ctx, plan) =>
          alternatives(ctx, plan, mealId, 3).map(({ recipe, score }) => ({
            recipe,
            score,
            explanation: explainMeal({ isLeftover: false, score }),
          })),
        [],
      ),

    replaceMeal: ({ mealId, recipeId }) =>
      withPlan<PlanResult | { readonly status: 'unavailable' }>(async (ctx, plan) => {
        const choice = alternatives(ctx, plan, mealId, Number.POSITIVE_INFINITY).find(
          (a) => a.recipe.id === recipeId,
        );
        if (!choice) return { status: 'unavailable' };
        const next: SavedPlan = { ...plan, ...applyReplacement(plan, mealId, choice) };
        await ports.plans.save(next);
        return toPlanView(next, 'stored', ctx);
      }, NO_PROFILE),

    explainMeal: (mealId) =>
      withPlan((_ctx, plan) => {
        const meal = findMeal(plan, mealId);
        return meal ? explainMeal(meal) : undefined;
      }, undefined),

    getBatchCookingPlan: () =>
      withPlan(
        (ctx, plan) => buildBatchCookingPlan(plan, ctx.recipes, ctx.profile.batchCooking),
        [],
      ),

    getWeekBalance: () => withPlan((ctx, plan) => computeWeekBalance(plan, ctx.recipes), []),

    async getPlanHistory() {
      const [plans, catalog] = await Promise.all([ports.plans.list(), ports.recipes.getAll()]);
      const used = new Set(plans.flatMap((p) => p.meals.map((m) => m.recipeId)));
      const recipes: Record<string, Recipe> = {};
      for (const recipe of catalog) if (used.has(recipe.id)) recipes[recipe.id] = recipe;
      return { plans, recipes };
    },
  };
}
