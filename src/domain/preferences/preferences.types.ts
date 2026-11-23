import type { IsoDateTime } from '../shared';

export const RATING_REASONS = ['trop-long', 'pas-aime', 'trop-copieux', 'autre'] as const;
/** Raison optionnelle d'un avis. */
export type RatingReason = (typeof RATING_REASONS)[number];

export type RatingVerdict = 'up' | 'down';

/** Avis 👍/👎 donné après un repas. */
export interface MealRating {
  readonly recipeId: string;
  readonly verdict: RatingVerdict;
  readonly reason?: RatingReason;
  readonly ratedAt: IsoDateTime;
}
