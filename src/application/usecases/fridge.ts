import { suggestFromFridge } from '@domain/fridge';
import type { FridgeSuggestion } from '@domain/fridge';
import { isBasicIngredient } from '@domain/recipe';
import { normalizeText } from '@domain/shared';
import { NO_PROFILE } from './context';
import type { AppPorts, NoProfile } from './context';

export type FridgeResult =
  NoProfile | { readonly status: 'ready'; readonly suggestions: readonly FridgeSuggestion[] };

export interface FridgeUseCases {
  /** Ingrédients du catalogue proposés en puces (hors basiques), sans doublon, triés. */
  listFridgeIngredients(): Promise<readonly string[]>;
  /** Recettes compatibles avec le profil, triées par nombre d'ingrédients manquants. */
  suggestFromFridge(input: {
    readonly available: readonly string[];
    readonly limit?: number;
  }): Promise<FridgeResult>;
}

export function createFridgeUseCases(ports: AppPorts): FridgeUseCases {
  return {
    async listFridgeIngredients() {
      const recipes = await ports.recipes.getAll();
      const names = new Map<string, string>();
      for (const recipe of recipes) {
        for (const { name } of recipe.ingredients) {
          const key = normalizeText(name);
          if (!isBasicIngredient(name) && !names.has(key)) names.set(key, name);
        }
      }
      return [...names.values()].sort((a, b) => a.localeCompare(b, 'fr'));
    },

    async suggestFromFridge({ available, limit }) {
      const [profile, recipes] = await Promise.all([ports.profiles.get(), ports.recipes.getAll()]);
      if (!profile) return NO_PROFILE;
      return {
        status: 'ready',
        suggestions: suggestFromFridge({
          constraints: profile,
          recipes,
          available,
          ...(limit === undefined ? {} : { limit }),
        }),
      };
    },
  };
}
