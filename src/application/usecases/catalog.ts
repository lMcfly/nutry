import type { Recipe } from '@domain/recipe';
import type { IsoDate } from '@domain/shared';
import type { AppPorts } from './context';

export interface CatalogUseCases {
  /** Une recette du catalogue par identifiant (détail recette, liens profonds). */
  readonly getRecipe: (id: string) => Promise<Recipe | undefined>;
  /** Jour calendaire LOCAL de l'appareil (`AAAA-MM-JJ`), via le port Clock. */
  readonly today: () => IsoDate;
}

export function createCatalogUseCases(ports: AppPorts): CatalogUseCases {
  return {
    getRecipe: (id) => ports.recipes.getById(id),
    today: () => ports.clock.today(),
  };
}
