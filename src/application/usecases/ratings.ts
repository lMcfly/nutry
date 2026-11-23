import { favoriteRecipeIds } from '@domain/preferences';
import type { RatingReason, RatingVerdict } from '@domain/preferences';
import { isRecipeCompatible } from '@domain/recipe';
import type { Recipe } from '@domain/recipe';
import type { IsoDate } from '@domain/shared';
import { mealRatingId } from '@domain/userdata';
import type { RatingRecord } from '@domain/userdata';
import { indexRecipes } from './context';
import type { AppPorts, SerialRunner } from './context';

export interface RateMealInput {
  /** Semaine du menu (lundi). */
  readonly weekStart: IsoDate;
  readonly mealId: string;
  readonly verdict: RatingVerdict;
  readonly reason?: RatingReason;
}

export interface RatingUseCases {
  /**
   * 👍/👎 sur un repas du menu. Un seul avis par plat cuisiné : noter un repas de restes
   * note le plat d'origine, et un nouvel avis remplace le précédent.
   * `undefined` si le repas n'existe pas.
   */
  rateMeal(input: RateMealInput): Promise<RatingRecord | undefined>;
  removeRating(id: string): Promise<void>;
  /** Recettes favorites (déduites des avis), encore compatibles avec le profil actuel. */
  getFavorites(): Promise<readonly Recipe[]>;
}

export function createRatingUseCases(ports: AppPorts, serial: SerialRunner): RatingUseCases {
  return {
    rateMeal: (input) =>
      serial(async () => {
        const plan = await ports.plans.getByWeek(input.weekStart);
        const meal = plan?.meals.find((m) => m.id === input.mealId);
        if (!meal) return undefined;
        const mealId = meal.leftoverOf ?? meal.id;
        const rating: RatingRecord = {
          id: mealRatingId(input.weekStart, mealId),
          recipeId: meal.recipeId,
          verdict: input.verdict,
          ...(input.reason ? { reason: input.reason } : {}),
          ratedAt: ports.clock.now().toISOString(),
          weekStart: input.weekStart,
          mealId,
        };
        await ports.ratings.save(rating);
        return rating;
      }),

    removeRating: (id) => serial(() => ports.ratings.remove(id)),

    async getFavorites() {
      const [ratings, recipes, profile] = await Promise.all([
        ports.ratings.getAll(),
        ports.recipes.getAll(),
        ports.profiles.get(),
      ]);
      const byId = indexRecipes(recipes);
      return favoriteRecipeIds(ratings)
        .map((id) => byId.get(id))
        .filter((r): r is Recipe => r !== undefined)
        .filter((r) => !profile || isRecipeCompatible(r, profile));
    },
  };
}
