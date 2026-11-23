import type { Recipe } from '@domain/recipe';

/** Catalogue de recettes (lecture seule, embarqué dans l'app). */
export interface RecipeRepository {
  getAll(): Promise<readonly Recipe[]>;
  getById(id: string): Promise<Recipe | undefined>;
}
