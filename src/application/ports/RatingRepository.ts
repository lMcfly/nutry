import type { MealRating } from '@domain/preferences';

export interface RatingRepository {
  add(rating: MealRating): Promise<void>;
  getAll(): Promise<readonly MealRating[]>;
}
