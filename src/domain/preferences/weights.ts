import { clamp } from '../shared';
import type { ProteinType, Recipe, RecipeTag } from '../recipe';
import type { MealRating } from './preferences.types';

/**
 * Poids appris à partir des avis, tous explicables :
 * - par recette (fort), par protéine principale et par étiquette (plus faible) ;
 * - `longRecipePenalty` : malus appliqué aux recettes longues après des avis « trop long » ;
 * - `portionMultiplier` : réduction de portion après des avis « trop copieux ».
 */
export interface LearnedWeights {
  readonly recipes: ReadonlyMap<string, number>;
  readonly proteins: ReadonlyMap<ProteinType, number>;
  readonly tags: ReadonlyMap<RecipeTag, number>;
  readonly longRecipePenalty: number;
  readonly portionMultiplier: number;
}

/** Barème de l'apprentissage (points ajoutés au score de menu). */
export const LEARNING_RULES = {
  up: { recipe: 2, protein: 0.5, tag: 0.25 },
  /** 👎 « pas aimé » ou « autre » : le goût est en cause. */
  downTaste: { recipe: -3, protein: -0.75, tag: -0.25 },
  /** 👎 « trop long » ou « trop copieux » : seul le plat est légèrement pénalisé. */
  downPractical: { recipe: -1, protein: 0, tag: 0 },
  bounds: { recipe: 6, protein: 2, tag: 1 },
  /** Au-delà, une recette est « longue » (préparation + cuisson, en minutes). */
  longRecipeMinutes: 30,
  longRecipePenaltyStep: 1,
  longRecipePenaltyMax: 3,
  /** « trop copieux » : −5 % par avis, multiplicateur jamais sous 0,8. */
  portionStep: 0.95,
  portionMin: 0.8,
} as const;

export const NEUTRAL_WEIGHTS: LearnedWeights = {
  recipes: new Map(),
  proteins: new Map(),
  tags: new Map(),
  longRecipePenalty: 0,
  portionMultiplier: 1,
};

function add<K>(map: Map<K, number>, key: K, delta: number): void {
  if (delta !== 0) map.set(key, (map.get(key) ?? 0) + delta);
}

function clampAll<K>(map: Map<K, number>, bound: number): ReadonlyMap<K, number> {
  return new Map([...map].map(([key, value]) => [key, clamp(value, -bound, bound)]));
}

/**
 * Déduit les poids des avis (somme puis bornage : indépendant de l'ordre).
 * Les avis sur une recette absente du catalogue ne comptent que pour la recette.
 * « trop long » et « trop copieux » s'appliquent même avec un 👍 (« bon mais trop long »).
 */
export function learnWeights(
  ratings: readonly MealRating[],
  recipes: readonly Recipe[],
): LearnedWeights {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const recipeW = new Map<string, number>();
  const proteinW = new Map<ProteinType, number>();
  const tagW = new Map<RecipeTag, number>();
  let longCount = 0;
  let copiousCount = 0;

  for (const rating of ratings) {
    const practical = rating.reason === 'trop-long' || rating.reason === 'trop-copieux';
    const rule =
      rating.verdict === 'up'
        ? LEARNING_RULES.up
        : practical
          ? LEARNING_RULES.downPractical
          : LEARNING_RULES.downTaste;
    add(recipeW, rating.recipeId, rule.recipe);
    const recipe = byId.get(rating.recipeId);
    if (recipe) {
      add(proteinW, recipe.mainProtein, rule.protein);
      for (const tag of recipe.tags) add(tagW, tag, rule.tag);
    }
    if (rating.reason === 'trop-long') longCount += 1;
    if (rating.reason === 'trop-copieux') copiousCount += 1;
  }

  const { bounds } = LEARNING_RULES;
  return {
    recipes: clampAll(recipeW, bounds.recipe),
    proteins: clampAll(proteinW, bounds.protein),
    tags: clampAll(tagW, bounds.tag),
    longRecipePenalty: Math.min(
      LEARNING_RULES.longRecipePenaltyMax,
      longCount * LEARNING_RULES.longRecipePenaltyStep,
    ),
    portionMultiplier: Math.max(
      LEARNING_RULES.portionMin,
      LEARNING_RULES.portionStep ** copiousCount,
    ),
  };
}

/** Détail des points « notes passées » d'une recette. */
export interface RatingScore {
  readonly recipe: number;
  readonly protein: number;
  readonly tags: number;
  readonly longPenalty: number;
  readonly total: number;
}

export function ratingScore(recipe: Recipe, weights: LearnedWeights): RatingScore {
  const recipePoints = weights.recipes.get(recipe.id) ?? 0;
  const protein = weights.proteins.get(recipe.mainProtein) ?? 0;
  const tags = recipe.tags.reduce((sum, tag) => sum + (weights.tags.get(tag) ?? 0), 0);
  const long = recipe.prepMinutes + recipe.cookMinutes > LEARNING_RULES.longRecipeMinutes;
  const longPenalty = long && weights.longRecipePenalty > 0 ? -weights.longRecipePenalty : 0;
  return {
    recipe: recipePoints,
    protein,
    tags,
    longPenalty,
    total: recipePoints + protein + tags + longPenalty,
  };
}

/**
 * Recettes favorites, déduites des avis : au moins un 👍 et un solde 👍 − 👎 positif.
 * Triées par solde décroissant puis par dernier 👍 le plus récent.
 */
export function favoriteRecipeIds(ratings: readonly MealRating[]): string[] {
  const stats = new Map<string, { balance: number; ups: number; lastUp: string }>();
  for (const rating of ratings) {
    const s = stats.get(rating.recipeId) ?? { balance: 0, ups: 0, lastUp: '' };
    if (rating.verdict === 'up') {
      s.balance += 1;
      s.ups += 1;
      if (rating.ratedAt > s.lastUp) s.lastUp = rating.ratedAt;
    } else {
      s.balance -= 1;
    }
    stats.set(rating.recipeId, s);
  }
  return [...stats]
    .filter(([, s]) => s.ups > 0 && s.balance > 0)
    .sort(
      ([idA, a], [idB, b]) =>
        b.balance - a.balance || b.lastUp.localeCompare(a.lastUp) || idA.localeCompare(idB),
    )
    .map(([id]) => id);
}
