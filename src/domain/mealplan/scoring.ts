import { containsAnyTerm, monthOf } from '../shared';
import type { IsoDate } from '../shared';
import { hasTag, recipeMentions, totalMinutes } from '../recipe';
import type { Level, ProteinType, Recipe } from '../recipe';
import { NEUTRAL_WEIGHTS, ratingScore } from '../preferences';
import type { LearnedWeights } from '../preferences';
import { SEASONS, isProduceInSeason, seasonOf } from '../season';
import type { ScoreBreakdown, ScoreComponent } from './mealplan.types';

/** Barème du score (points). Voir docs/adr/0006-moteur-de-menu.md. */
export const SCORE_RULES = {
  likePerTerm: 2,
  likeMax: 4,
  seasonMatch: 1.5,
  seasonalProducePerItem: 0.5,
  seasonalProduceMax: 1.5,
  /** Rapidité : jusqu'à +1,5 selon la marge sur le temps disponible. */
  timeQuickMax: 1.5,
  timeOverrun: -3,
  batchWeekday: 1,
  levelMatch: 2,
  levelMismatch: -1,
  newProtein: 1,
  /** Jour de séance : léger bonus, jamais un filtre (ADR 0015, section 6). */
  trainingDay: 1,
  repeatedProteinPerOccurrence: -0.5,
  consecutiveProtein: -4,
  /** Bruit de départage, tiré de `rng` : [0 ; 0,5). */
  jitterMax: 0.5,
} as const;

/** Part minimale de féculents dans l'assiette pour le bonus « jour de séance ». */
export const TRAINING_DAY_MIN_STARCH_SHARE = 0.25;

export interface ScoringContext {
  readonly likes: readonly string[];
  readonly batchCooking: boolean;
  readonly weights?: LearnedWeights;
  readonly date: IsoDate;
  readonly availableMinutes: number;
  /** Niveau demandé ; absent (petit-déjeuner) = composante neutre. */
  readonly desiredLevel?: Level;
  /** Week-end : le bonus batch ne s'applique qu'en semaine. */
  readonly weekend: boolean;
  /** Protéine du repas précédent (variété). */
  readonly previousProtein?: ProteinType;
  /** Protéine du repas suivant, connue lors d'un remplacement (variété). */
  readonly nextProtein?: ProteinType;
  /** Occurrences de chaque protéine déjà planifiées dans la semaine. */
  readonly proteinCounts?: ReadonlyMap<ProteinType, number>;
  /**
   * Repas (déjeuner ou dîner) d'un jour de séance : léger bonus aux plats avec une protéine
   * principale et des féculents. Ne touche ni aux filtres durs, ni aux calories, ni aux portions.
   */
  readonly trainingDay?: boolean;
  /** Valeur dans [0, 1) pour départager ; absente = 0. */
  readonly jitter?: number;
}

/** Conserves, surgelés, produits secs ou transformés : jamais « de saison ». */
const PRESERVED_TERMS = [
  'boite',
  'conserve',
  'surgele',
  'surgelee',
  'seche',
  'sechee',
  'concentre',
  'concentree',
  'coulis',
  'confit',
  'confite',
  'puree',
  'jus',
  'poudre',
  'pelees',
  'concassees',
] as const;

export function isPreservedIngredient(name: string): boolean {
  return containsAnyTerm(name, PRESERVED_TERMS);
}

/** Score explicable d'une recette dans un contexte de repas. */
export function scoreRecipe(recipe: Recipe, ctx: ScoringContext): ScoreBreakdown {
  const R = SCORE_RULES;
  const likedTerms = ctx.likes.filter((term) => recipeMentions(recipe, term));
  const like = Math.min(R.likeMax, likedTerms.length * R.likePerTerm);

  const rating = ratingScore(recipe, ctx.weights ?? NEUTRAL_WEIGHTS);

  const month = monthOf(ctx.date);
  // « De saison » seulement pour une recette réellement saisonnière (pas les 4 saisons)…
  const seasonMatch =
    recipe.seasons.length < SEASONS.length && recipe.seasons.includes(seasonOf(ctx.date));
  // … ou pour un produit FRAIS du calendrier, de saison ce mois-ci (pas une conserve).
  const seasonalProduce = recipe.ingredients
    .filter((i) => !isPreservedIngredient(i.name) && isProduceInSeason(i.name, month))
    .map((i) => i.name);
  const season =
    (seasonMatch ? R.seasonMatch : 0) +
    Math.min(R.seasonalProduceMax, seasonalProduce.length * R.seasonalProducePerItem);

  const minutes = totalMinutes(recipe);
  const fitsTime = minutes <= ctx.availableMinutes;
  const batchFriendly = ctx.batchCooking && hasTag(recipe, 'batch');
  let time = fitsTime
    ? ctx.availableMinutes > 0
      ? R.timeQuickMax * (1 - minutes / ctx.availableMinutes)
      : 0
    : R.timeOverrun;
  if (batchFriendly && !ctx.weekend) time += R.batchWeekday;

  const level =
    ctx.desiredLevel === undefined
      ? 0
      : recipe.level === ctx.desiredLevel
        ? R.levelMatch
        : R.levelMismatch;

  const count = ctx.proteinCounts?.get(recipe.mainProtein) ?? 0;
  const newProtein = count === 0;
  let variety = newProtein ? R.newProtein : count * R.repeatedProteinPerOccurrence;
  if (isConsecutiveProtein(recipe.mainProtein, ctx.previousProtein))
    variety += R.consecutiveProtein;
  if (isConsecutiveProtein(recipe.mainProtein, ctx.nextProtein)) variety += R.consecutiveProtein;

  // Jour de séance : de quoi bien récupérer = une protéine principale et un quart de féculents.
  const recovery =
    ctx.trainingDay === true &&
    recipe.mainProtein !== 'aucune' &&
    recipe.plateBalance.starches >= TRAINING_DAY_MIN_STARCH_SHARE;

  const components: ScoreComponent[] = [
    { key: 'aime', points: like },
    { key: 'notes', points: rating.total },
    { key: 'saison', points: season },
    { key: 'temps', points: time },
    { key: 'niveau', points: level },
    { key: 'variete', points: variety },
  ];
  if (ctx.trainingDay === true) {
    components.push({ key: 'sport', points: recovery ? R.trainingDay : 0 });
  }
  if (ctx.jitter !== undefined)
    components.push({ key: 'hasard', points: ctx.jitter * R.jitterMax });

  return {
    total: components.reduce((sum, c) => sum + c.points, 0),
    components,
    facts: {
      likedTerms,
      seasonMatch,
      seasonalProduce,
      totalMinutes: minutes,
      fitsTime,
      ratedPositively: rating.recipe > 0,
      batchFriendly,
      newProtein,
      ...(ctx.trainingDay === true ? { trainingDay: recovery } : {}),
    },
  };
}

/** Même protéine que le repas précédent (« aucune » n'est jamais considérée comme répétée). */
export function isConsecutiveProtein(
  protein: ProteinType,
  previous: ProteinType | undefined,
): boolean {
  return protein !== 'aucune' && protein === previous;
}

export interface RankedRecipe {
  readonly recipe: Recipe;
  readonly score: ScoreBreakdown;
}

/** Classe des recettes par score décroissant (départage stable par identifiant). */
export function rankRecipes(recipes: readonly Recipe[], ctx: ScoringContext): RankedRecipe[] {
  return recipes
    .map((recipe) => ({ recipe, score: scoreRecipe(recipe, ctx) }))
    .sort((a, b) => b.score.total - a.score.total || a.recipe.id.localeCompare(b.recipe.id));
}
