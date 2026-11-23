import { containsAnyTerm, normalizeText, tokenize } from '../shared';
import { hasTag } from '../recipe';
import type { Recipe, RecipeIngredient } from '../recipe';
import { mealLabel } from './labels';
import type { PlannedMeal, WeeklyPlan } from './mealplan.types';

/**
 * Familles de préparations à anticiper le dimanche, dans l'ordre de la session :
 * - `plat-entier` : recettes étiquetées `batch`, cuisinées en entier (se gardent ou se
 *   congèlent) ;
 * - `cereales-legumineuses` : céréales et légumineuses sèches à cuire d'avance ;
 * - `legumes` : légumes fermes à laver et couper ;
 * - `sauces` : sauces, vinaigrettes et marinades que les étapes préparent à part.
 */
export const BATCH_PREP_KINDS = [
  'plat-entier',
  'cereales-legumineuses',
  'legumes',
  'sauces',
] as const;
export type BatchPrepKind = (typeof BATCH_PREP_KINDS)[number];

/** Titres et conseils de conservation affichés pour chaque famille. */
export const BATCH_PREP_TEXTS: Readonly<
  Record<BatchPrepKind, { readonly title: string; readonly hint: string }>
> = {
  'plat-entier': {
    title: 'Cuisiner les plats en entier',
    hint: 'Ils se gardent 3 jours au frais, ou se congèlent en portions.',
  },
  'cereales-legumineuses': {
    title: 'Cuire céréales et légumineuses',
    hint: 'Égoutte, laisse refroidir, puis garde-les 3 jours au frais en boîte fermée.',
  },
  legumes: {
    title: 'Laver et couper les légumes',
    hint: 'Les légumes fermes se gardent coupés 2 à 3 jours dans une boîte, au frais.',
  },
  sauces: {
    title: 'Préparer sauces et marinades',
    hint: 'En bocal fermé, elles se gardent 3 jours au frais.',
  },
};

/**
 * Céréales et légumineuses SÈCHES qui gagnent à être cuites d'avance (cuisson longue).
 * Exclus : conserves (`boite`, « cuits »), riz à risotto, pâtes, semoule et nouilles
 * (cuisson courte, meilleures minute).
 */
export const COOK_AHEAD_TERMS = [
  'riz',
  'quinoa',
  'boulgour',
  'épeautre',
  'orge',
  'sarrasin',
  'millet',
  'lentille',
  'pois chiche',
  'pois cassé',
  'haricot rouge',
  'haricot blanc',
  'haricot noir',
  'flageolet',
] as const;
const COOK_AHEAD_EXCLUDED = [
  'cuit',
  'cuite',
  'arborio',
  'rond',
  'nouille',
  'vermicelle',
  'vinaigre',
  'galette',
] as const;

/** Légumes fermes qui supportent d'être coupés à l'avance (pas les salades, tomates…). */
export const FIRM_VEGETABLE_TERMS = [
  'carotte',
  'poivron',
  'chou',
  'chou-fleur',
  'brocoli',
  'courgette',
  'courge',
  'potiron',
  'poireau',
  'fenouil',
  'céleri',
  'betterave',
  'navet',
  'panais',
  'haricot vert',
  'oignon',
] as const;

/** Une étape qui prépare une sauce à part (indice dans le texte normalisé). */
const SAUCE_PATTERNS: readonly (readonly [RegExp, string])[] = [
  [/\bvinaigrette\b/, 'Vinaigrette'],
  [/\bpesto\b/, 'Pesto'],
  [/\bmariner\b|\bmarinade\b/, 'Marinade'],
  [
    /\bc est la sauce\b|\bprepare la sauce\b|\bpour la sauce\b|\ben sauce\b|\bsauce yaourt\b/,
    'Sauce',
  ],
];

/** Une préparation précise, et les repas de la semaine qu'elle sert. */
export interface BatchPrepTask {
  readonly label: string;
  /** Recettes concernées (pour un lien vers leur détail). */
  readonly recipeIds: readonly string[];
  /** Repas concernés, ex. « mardi – dîner ». */
  readonly mealLabels: readonly string[];
}

/** Préparations d'une même famille. */
export interface BatchPrepGroup {
  readonly kind: BatchPrepKind;
  readonly title: string;
  readonly hint: string;
  readonly tasks: readonly BatchPrepTask[];
}

/** Repas du lundi au vendredi : le week-end laisse le temps de cuisiner minute. */
const isWeekday = (meal: PlannedMeal): boolean => meal.dayIndex <= 4;

function isCookAhead(ingredient: RecipeIngredient): boolean {
  return (
    ingredient.unit !== 'boite' &&
    ingredient.aisle !== 'fruits-legumes' &&
    containsAnyTerm(ingredient.name, COOK_AHEAD_TERMS) &&
    !containsAnyTerm(ingredient.name, COOK_AHEAD_EXCLUDED)
  );
}

function isFirmVegetable(ingredient: RecipeIngredient): boolean {
  return (
    ingredient.aisle === 'fruits-legumes' && containsAnyTerm(ingredient.name, FIRM_VEGETABLE_TERMS)
  );
}

/** Nom de la sauce préparée à part par les étapes, sinon `undefined`. */
export function sauceToPrepare(recipe: Recipe): string | undefined {
  for (const step of recipe.steps) {
    const text = normalizeText(step);
    const found = SAUCE_PATTERNS.find(([pattern]) => pattern.test(text));
    if (found) return found[1];
  }
  return undefined;
}

/** Accumule des tâches par clé, en gardant l'ordre de première apparition. */
class TaskCollector {
  private readonly tasks = new Map<
    string,
    { label: string; recipeIds: string[]; mealLabels: string[] }
  >();

  add(key: string, label: string, recipe: Recipe, meal: PlannedMeal): void {
    const task = this.tasks.get(key) ?? { label, recipeIds: [], mealLabels: [] };
    if (!task.recipeIds.includes(recipe.id)) task.recipeIds.push(recipe.id);
    const when = mealLabel(meal);
    if (!task.mealLabels.includes(when)) task.mealLabels.push(when);
    this.tasks.set(key, task);
  }

  list(): BatchPrepTask[] {
    return [...this.tasks.values()];
  }
}

const ingredientKey = (name: string): string => tokenize(name).join(' ');

/**
 * Préparations à anticiper pendant la session du dimanche, regroupées par famille
 * (`BATCH_PREP_KINDS`), chacune avec ses repas. Heuristique simple et explicable :
 * 1. une recette étiquetée `batch` (n'importe quel jour) se cuisine en entier ; ses
 *    ingrédients ne sont pas repris ailleurs ;
 * 2. pour les autres repas du lundi au vendredi (hors restes et petit-déjeuner) :
 *    céréales et légumineuses sèches à cuire (`COOK_AHEAD_TERMS`), légumes fermes à
 *    couper (`FIRM_VEGETABLE_TERMS`), sauces repérées dans les étapes (`sauceToPrepare`).
 * Les restes ne sont jamais recomptés. Vide si l'option batch cooking est désactivée.
 */
export function buildBatchCookingPlan(
  plan: WeeklyPlan,
  recipes: readonly Recipe[],
  batchCooking: boolean,
): BatchPrepGroup[] {
  if (!batchCooking) return [];
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const collectors: Record<BatchPrepKind, TaskCollector> = {
    'plat-entier': new TaskCollector(),
    'cereales-legumineuses': new TaskCollector(),
    legumes: new TaskCollector(),
    sauces: new TaskCollector(),
  };

  for (const meal of plan.meals) {
    const recipe = byId.get(meal.recipeId);
    if (meal.isLeftover || !recipe) continue;
    if (hasTag(recipe, 'batch')) {
      collectors['plat-entier'].add(recipe.id, recipe.name, recipe, meal);
      continue;
    }
    if (!isWeekday(meal) || meal.slot === 'petit-dejeuner') continue;
    for (const ingredient of recipe.ingredients) {
      if (isCookAhead(ingredient)) {
        const key = ingredientKey(ingredient.name);
        collectors['cereales-legumineuses'].add(key, ingredient.name, recipe, meal);
      } else if (isFirmVegetable(ingredient)) {
        const key = ingredientKey(ingredient.name);
        collectors.legumes.add(key, ingredient.name, recipe, meal);
      }
    }
    const sauce = sauceToPrepare(recipe);
    if (sauce) collectors.sauces.add(recipe.id, `${sauce} : ${recipe.name}`, recipe, meal);
  }

  return BATCH_PREP_KINDS.map((kind) => ({
    kind,
    ...BATCH_PREP_TEXTS[kind],
    tasks: collectors[kind].list(),
  })).filter((group) => group.tasks.length > 0);
}
