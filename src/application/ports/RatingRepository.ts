import type { MealRating } from '@domain/mealplan';

export interface RatingRepository {
  add(rating: MealRating): Promise<void>;
  getAll(): Promise<readonly MealRating[]>;
}
