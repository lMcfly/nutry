import { addDays, startOfWeek } from '../shared';
import type { IsoDate, Rng } from '../shared';
import { filterCompatibleRecipes, hasTag, isBreakfastRecipe, totalMinutes } from '../recipe';
import type { Level, ProteinType, Recipe } from '../recipe';
import type { Profile } from '../profile';
import type { LearnedWeights } from '../preferences';
import { DAY_INDEXES } from './mealplan.types';
import type {
  DayIndex,
  MealSlot,
  PlanNotice,
  PlannedMeal,
  RelaxedConstraint,
  ScoreBreakdown,
  WeeklyPlan,
} from './mealplan.types';
import { dayRequirements } from './schedule';
import { isConsecutiveProtein, scoreRecipe } from './scoring';
import type { ScoringContext } from './scoring';

/** Nombre maximal de déjeuners « restes » par semaine. */
export const MAX_LEFTOVERS_PER_WEEK = 3;

export const PLAN_NOTICES: Readonly<Record<PlanNotice['code'], PlanNotice>> = {
  'aucune-recette-compatible': {
    code: 'aucune-recette-compatible',
    message:
      'Aucune recette ne correspond encore à toutes tes contraintes. Ajuste tes goûts ou ton régime dans le profil, et on s’occupe du reste.',
  },
  'petit-dejeuner-indisponible': {
    code: 'petit-dejeuner-indisponible',
    message:
      'Pas encore d’idée de petit-déjeuner adaptée à ton profil : le menu se concentre sur les déjeuners et les dîners.',
  },
  'contraintes-assouplies': {
    code: 'contraintes-assouplies',
    message:
      'Quelques repas sortent un peu de tes critères (temps, niveau ou variété) faute d’alternative : tu peux les remplacer d’un tap.',
  },
};

export interface GeneratePlanInput {
  readonly profile: Profile;
  readonly recipes: readonly Recipe[];
  readonly weights?: LearnedWeights;
  /** N'importe quel jour de la semaine voulue : le menu commence le lundi. */
  readonly startDate: IsoDate;
  readonly rng: Rng;
  /** Autoriser les restes du dîner au déjeuner du lendemain (par défaut : oui). */
  readonly leftovers?: boolean;
}

interface PickRequest {
  readonly pool: readonly Recipe[];
  readonly ctx: Omit<ScoringContext, 'jitter'>;
  readonly used: ReadonlySet<string>;
  /** Variété de protéine et niveau imposés (repas principaux uniquement). */
  readonly strict: boolean;
  readonly rng: Rng;
}

interface Pick {
  readonly recipe: Recipe;
  readonly score: ScoreBreakdown;
  readonly relaxed: RelaxedConstraint[];
}

/**
 * Assouplissements successifs quand aucune recette ne respecte tout :
 * variété de protéine, puis niveau, puis doublon, et le temps en tout dernier recours
 * (on prend alors la recette la plus courte).
 */
const STAGES: readonly (readonly RelaxedConstraint[])[] = [
  [],
  ['variete-proteine'],
  ['variete-proteine', 'niveau'],
  ['variete-proteine', 'niveau', 'doublon'],
  ['variete-proteine', 'niveau', 'doublon', 'temps'],
];

function violations(recipe: Recipe, req: PickRequest): RelaxedConstraint[] {
  const v: RelaxedConstraint[] = [];
  if (req.strict && isConsecutiveProtein(recipe.mainProtein, req.ctx.previousProtein)) {
    v.push('variete-proteine');
  }
  if (req.strict && req.ctx.desiredLevel !== undefined && recipe.level !== req.ctx.desiredLevel) {
    v.push('niveau');
  }
  if (req.used.has(recipe.id)) v.push('doublon');
  if (totalMinutes(recipe) > req.ctx.availableMinutes) v.push('temps');
  return v;
}

function pickRecipe(req: PickRequest): Pick | undefined {
  // Un tirage par recette du pool, dans l'ordre du pool : déterministe pour une graine donnée.
  const scored = req.pool.map((recipe) => ({
    recipe,
    score: scoreRecipe(recipe, { ...req.ctx, jitter: req.rng() }),
    relaxed: violations(recipe, req),
  }));
  for (const allowed of STAGES) {
    const candidates = scored.filter((c) => c.relaxed.every((v) => allowed.includes(v)));
    if (candidates.length === 0) continue;
    const lastResort = allowed.includes('temps');
    candidates.sort(
      (a, b) =>
        (lastResort ? totalMinutes(a.recipe) - totalMinutes(b.recipe) : 0) ||
        b.score.total - a.score.total ||
        a.recipe.id.localeCompare(b.recipe.id),
    );
    return candidates[0];
  }
  return undefined;
}

const LEFTOVER_SCORE = (source: ScoreBreakdown): ScoreBreakdown => ({
  total: 0,
  components: [],
  facts: { ...source.facts, totalMinutes: 0, fitsTime: true, batchFriendly: false },
});

/**
 * Génère le menu de la semaine : 7 jours × déjeuner + dîner (+ petit-déjeuner en option).
 * Filtres durs : allergies, régimes, aliments détestés. Puis, par repas, la recette au
 * meilleur score respectant variété, niveau, unicité et temps (assouplis si besoin).
 * Un dîner étiqueté `restes` alimente le déjeuner du lendemain (3 fois par semaine au plus).
 */
export function generateWeeklyPlan(input: GeneratePlanInput): WeeklyPlan {
  const { profile, rng } = input;
  const weekStart = startOfWeek(input.startDate);
  const compatible = filterCompatibleRecipes(input.recipes, profile);
  const mains = compatible.filter((r) => !isBreakfastRecipe(r));
  const breakfasts = compatible.filter(isBreakfastRecipe);
  const allowLeftovers = input.leftovers ?? true;

  const notices: PlanNotice[] = [];
  if (mains.length === 0) notices.push(PLAN_NOTICES['aucune-recette-compatible']);
  if (profile.breakfast && breakfasts.length === 0) {
    notices.push(PLAN_NOTICES['petit-dejeuner-indisponible']);
  }

  const meals: PlannedMeal[] = [];
  const usedMains = new Set<string>();
  const usedBreakfasts = new Set<string>();
  const proteinCounts = new Map<ProteinType, number>();
  let previousProtein: ProteinType | undefined;
  let pendingLeftover: PlannedMeal | undefined;
  let pendingProtein: ProteinType | undefined;
  let leftoverCount = 0;

  const countProtein = (protein: ProteinType) => {
    proteinCounts.set(protein, (proteinCounts.get(protein) ?? 0) + 1);
  };

  for (const dayIndex of DAY_INDEXES) {
    const date = addDays(weekStart, dayIndex);
    const req = dayRequirements(profile, date);
    const baseCtx = {
      likes: profile.likes,
      batchCooking: profile.batchCooking,
      ...(input.weights ? { weights: input.weights } : {}),
      date,
      availableMinutes: req.minutes,
      weekend: req.weekend,
    };
    const makeMeal = (slot: MealSlot, pick: Pick, level?: Level): PlannedMeal => ({
      id: mealId(dayIndex, slot),
      dayIndex,
      date,
      slot,
      recipeId: pick.recipe.id,
      isLeftover: false,
      ...(level === undefined ? {} : { requestedLevel: level }),
      relaxed: pick.relaxed,
      score: pick.score,
    });

    if (profile.breakfast && breakfasts.length > 0) {
      const pick = pickRecipe({
        pool: breakfasts,
        ctx: baseCtx,
        used: usedBreakfasts,
        strict: false,
        rng,
      });
      if (pick) {
        meals.push(makeMeal('petit-dejeuner', pick));
        usedBreakfasts.add(pick.recipe.id);
        // Petits-déjeuners souvent routiniers : on recommence la rotation une fois épuisée.
        if (usedBreakfasts.size === breakfasts.length) usedBreakfasts.clear();
      }
    }

    for (const slot of ['dejeuner', 'diner'] as const) {
      if (slot === 'dejeuner' && pendingLeftover && pendingProtein) {
        meals.push({
          id: mealId(dayIndex, slot),
          dayIndex,
          date,
          slot,
          recipeId: pendingLeftover.recipeId,
          isLeftover: true,
          leftoverOf: pendingLeftover.id,
          relaxed: [],
          score: LEFTOVER_SCORE(pendingLeftover.score),
        });
        countProtein(pendingProtein);
        previousProtein = pendingProtein;
        pendingLeftover = undefined;
        continue;
      }
      const pick = pickRecipe({
        pool: mains,
        ctx: {
          ...baseCtx,
          desiredLevel: req.level,
          proteinCounts,
          ...(previousProtein ? { previousProtein } : {}),
        },
        used: usedMains,
        strict: true,
        rng,
      });
      if (!pick) continue;
      const meal = makeMeal(slot, pick, req.level);
      meals.push(meal);
      usedMains.add(pick.recipe.id);
      countProtein(pick.recipe.mainProtein);
      previousProtein = pick.recipe.mainProtein;
      if (
        allowLeftovers &&
        slot === 'diner' &&
        dayIndex < 6 &&
        leftoverCount < MAX_LEFTOVERS_PER_WEEK &&
        hasTag(pick.recipe, 'restes')
      ) {
        pendingLeftover = meal;
        pendingProtein = pick.recipe.mainProtein;
        leftoverCount += 1;
      }
    }
  }

  if (meals.some((m) => m.relaxed.length > 0)) notices.push(PLAN_NOTICES['contraintes-assouplies']);
  return { weekStart, meals, notices };
}

export function mealId(dayIndex: DayIndex, slot: MealSlot): string {
  return `${dayIndex}-${slot}`;
}
