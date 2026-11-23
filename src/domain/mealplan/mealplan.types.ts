import type { IsoDate, IsoDateTime } from '../shared';

/** PLACEHOLDER (phase 2). */
export type MealSlot = 'petit-dejeuner' | 'dejeuner' | 'diner';

/** PLACEHOLDER (phase 2) — un repas planifié. */
export interface PlannedMeal {
  /** 0 = lundi … 6 = dimanche. */
  readonly dayIndex: number;
  readonly slot: MealSlot;
  readonly recipeId: string;
}

/**
 * PLACEHOLDER (phase 2) — menu d'une semaine.
 * À compléter : restes, batch cooking, explication « Pourquoi ce plat ? »…
 */
export interface WeeklyPlan {
  /** Lundi de la semaine concernée. */
  readonly weekStart: IsoDate;
  readonly meals: readonly PlannedMeal[];
}

/** PLACEHOLDER (phase 2) — avis 👍/👎 après un repas. */
export interface MealRating {
  readonly recipeId: string;
  readonly verdict: 'up' | 'down';
  readonly reason?: string;
  readonly ratedAt: IsoDateTime;
}
