import {
  applyReplacement,
  buildBatchCookingPlan,
  computeWeekBalance,
  explainMeal,
  generateWeeklyPlan,
  replaceMeal,
} from '@domain/mealplan';
import type {
  BalanceGauge,
  BatchPrepGroup,
  DayIndex,
  PlannedMeal,
  ScoreBreakdown,
} from '@domain/mealplan';
import { scaleRecipeForHousehold } from '@domain/profile';
import { isRecipeCompatible, suggestsBread, totalMinutes } from '@domain/recipe';
import type { Recipe } from '@domain/recipe';
import { formatIngredient, roundForRecipe } from '@domain/shopping';
import type { IngredientDisplay } from '@domain/shopping';
import { startOfWeek } from '@domain/shared';
import type { IsoDate } from '@domain/shared';
import { dietaryFingerprint } from '@domain/userdata';
import type { RatingRecord, SavedPlan } from '@domain/userdata';
import { NO_PROFILE, indexRecipes, loadPlanningContext } from './context';
import { trainingDaysFor } from './training';
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

/** Une ligne d'ingrédient prête à afficher (quantité déjà mise à l'échelle et arrondie). */
export interface RecipeIngredientLine extends IngredientDisplay {
  /** Clé stable pour la liste. */
  readonly key: string;
}

/** Détail d'une recette, avec les quantités pour le foyer : l'UI n'a rien à calculer. */
export interface RecipeView {
  readonly recipe: Recipe;
  readonly totalMinutes: number;
  /** Personnes servies (foyer du profil ; 1 sans profil). */
  readonly householdSize: number;
  /** Repas couverts par une même cuisson : plus de 1 si les restes servent le lendemain. */
  readonly batches: number;
  /**
   * Ingrédients pour le foyer : portion de la personne (`computeUserPortionFactor`),
   * autres membres, restes ; arrondis comme en cuisine.
   */
  readonly ingredients: readonly RecipeIngredientLine[];
  /** Plat sans féculent : suggérer une tranche de pain complet. */
  readonly suggestsBread: boolean;
  /** Repas du menu de la semaine qui cuisine cette recette (absent hors menu). */
  readonly meal?: {
    readonly weekStart: IsoDate;
    readonly mealId: string;
    /** Déjà noté 👍 (favori). */
    readonly liked: boolean;
  };
}

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
  readonly getCurrentPlan: () => Promise<PlanResult>;
  /** Nouveau menu pour la semaine en cours (remplace l'actuel). */
  readonly generateWeeklyPlan: () => Promise<PlanResult>;
  /** 3 alternatives du même niveau pour un repas de la semaine en cours. */
  readonly getMealAlternatives: (mealId: string) => Promise<readonly MealAlternative[]>;
  /**
   * Remplace un repas par l'une des alternatives proposées. `unavailable` si la recette
   * n'en fait pas (ou plus) partie : on ne place jamais une recette incompatible.
   */
  readonly replaceMeal: (input: {
    readonly mealId: string;
    readonly recipeId: string;
  }) => Promise<PlanResult | { readonly status: 'unavailable' }>;
  readonly explainMeal: (mealId: string) => Promise<string | undefined>;
  /**
   * Détail d'une recette (menu de la semaine ou catalogue : frigo vide, lien profond) avec
   * ses quantités pour le foyer. `undefined` si la recette n'existe pas.
   */
  readonly getRecipeView: (recipeId: string) => Promise<RecipeView | undefined>;
  /** Préparations du dimanche (vide si l'option batch cooking est désactivée). */
  readonly getBatchCookingPlan: () => Promise<readonly BatchPrepGroup[]>;
  readonly getWeekBalance: () => Promise<readonly BalanceGauge[]>;
  readonly getPlanHistory: () => Promise<PlanHistory>;
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

function generate(
  ports: AppPorts,
  ctx: PlanningContext,
  weekStart: IsoDate,
  trainingDays: readonly DayIndex[],
): SavedPlan {
  const plan = generateWeeklyPlan({
    trainingDays,
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
  const plan = generate(ports, ctx, weekStart, await trainingDaysFor(ports));
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

/** Vue d'une recette ; `planned` : contexte et menu courant si un profil existe. */
export function toRecipeView(
  recipe: Recipe,
  planned?: { readonly ctx: PlanningContext; readonly plan: SavedPlan },
): RecipeView {
  const meal = planned?.plan.meals.find((m) => m.recipeId === recipe.id && !m.isLeftover);
  const leftovers = meal ? (planned?.plan.meals.filter((m) => m.leftoverOf === meal.id) ?? []) : [];
  const batches = 1 + leftovers.length;
  const householdSize = planned?.ctx.profile.householdSize ?? 1;
  const scaled = scaleRecipeForHousehold(recipe, {
    userFactor: planned?.ctx.portionFactor ?? 1,
    householdSize,
    batches,
  });
  const ingredients = scaled.map((ingredient): RecipeIngredientLine => {
    const rounded = roundForRecipe(ingredient.quantity, ingredient.unit);
    return {
      key: `${ingredient.name}-${ingredient.unit}`,
      ...formatIngredient(ingredient.name, rounded.quantity, rounded.unit),
    };
  });
  const rating =
    meal && planned ? ratingsByMeal(planned.plan, planned.ctx.ratings)[meal.id] : undefined;
  return {
    recipe,
    totalMinutes: totalMinutes(recipe),
    householdSize,
    batches,
    ingredients,
    suggestsBread: suggestsBread(recipe),
    ...(meal && planned
      ? {
          meal: {
            weekStart: planned.plan.weekStart,
            mealId: meal.id,
            liked: rating?.verdict === 'up',
          },
        }
      : {}),
  };
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

  const alternatives = (
    ctx: PlanningContext,
    plan: SavedPlan,
    mealId: string,
    count: number,
    trainingDays: readonly DayIndex[],
  ) =>
    replaceMeal({
      trainingDays,
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
        async (ctx, plan) =>
          alternatives(ctx, plan, mealId, 3, await trainingDaysFor(ports)).map(
            ({ recipe, score }) => ({
              recipe,
              score,
              explanation: explainMeal({ isLeftover: false, score }),
            }),
          ),
        [],
      ),

    replaceMeal: ({ mealId, recipeId }) =>
      withPlan<PlanResult | { readonly status: 'unavailable' }>(async (ctx, plan) => {
        const choice = alternatives(
          ctx,
          plan,
          mealId,
          Number.POSITIVE_INFINITY,
          await trainingDaysFor(ports),
        ).find((a) => a.recipe.id === recipeId);
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

    getRecipeView: (recipeId) =>
      serial(async () => {
        const ctx = await loadPlanningContext(ports);
        if (!ctx) {
          const recipe = await ports.recipes.getById(recipeId);
          return recipe ? toRecipeView(recipe) : undefined;
        }
        const { plan } = await ensureCurrentPlan(ports, ctx);
        const recipe = ctx.recipes.find((r) => r.id === recipeId);
        return recipe ? toRecipeView(recipe, { ctx, plan }) : undefined;
      }),

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
