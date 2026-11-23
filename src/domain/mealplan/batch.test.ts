import { describe, expect, it } from 'vitest';
import { addDays } from '../shared';
import { ing, makeRecipe } from '../testing/fixtures';
import { buildBatchCookingPlan, sauceToPrepare } from './batch';
import type { DayIndex, MealSlot, PlannedMeal, WeeklyPlan } from './mealplan.types';

const FL = 'fruits-legumes';
const EP = 'epicerie';

const chili = makeRecipe({
  id: 'chili',
  name: 'Chili sin carne',
  tags: ['batch', 'restes'],
  ingredients: [ing('riz complet', 150, 'g', EP), ing('poivrons', 2, 'piece', FL)],
});
const bowl = makeRecipe({
  id: 'bowl',
  name: 'Bowl quinoa',
  ingredients: [
    ing('quinoa', 150, 'g', EP),
    ing('carottes', 200, 'g', FL),
    ing('pois chiches cuits', 1, 'boite', EP),
    ing('salade verte', 1, 'piece', FL),
    ing('huile d’olive', 2, 'cuillere-soupe', EP),
  ],
  steps: ['Mélange l’huile, le citron et la moutarde : c’est la sauce.', 'Compose les bols.'],
});
const curry = makeRecipe({
  id: 'curry',
  name: 'Curry de lentilles',
  ingredients: [
    ing('lentilles vertes', 150, 'g', EP),
    ing('Carotte', 1, 'piece', FL),
    ing('riz arborio', 100, 'g', EP),
    ing('tomates', 200, 'g', FL),
  ],
  steps: ['Fais mariner le tofu une heure.', 'Cuisine.'],
});
const salad = makeRecipe({
  id: 'salade',
  name: 'Salade express',
  ingredients: [ing('salade verte', 1, 'piece', FL), ing('tomates', 200, 'g', FL)],
  steps: ['Mélange.'],
});
const porridge = makeRecipe({
  id: 'porridge',
  tags: ['petit-dejeuner'],
  ingredients: [ing('flocons d’avoine', 50, 'g', EP), ing('poire', 1, 'piece', FL)],
});
const RECIPES = [chili, bowl, curry, salad, porridge];

function meal(dayIndex: DayIndex, slot: MealSlot, recipeId: string, extra = {}): PlannedMeal {
  return {
    id: `${dayIndex}-${slot}`,
    dayIndex,
    date: addDays('2026-11-23', dayIndex),
    slot,
    recipeId,
    isLeftover: false,
    relaxed: [],
    score: { total: 0, components: [], facts: {} } as unknown as PlannedMeal['score'],
    ...extra,
  };
}

const plan: WeeklyPlan = {
  weekStart: '2026-11-23',
  notices: [],
  meals: [
    meal(0, 'petit-dejeuner', 'porridge'),
    meal(0, 'diner', 'chili'),
    meal(1, 'dejeuner', 'chili', { isLeftover: true, leftoverOf: '0-diner' }),
    meal(1, 'diner', 'bowl'),
    meal(2, 'diner', 'curry'),
    meal(3, 'dejeuner', 'salade'),
    meal(4, 'diner', 'bowl'),
    meal(5, 'diner', 'curry'),
    meal(6, 'dejeuner', 'chili'),
  ],
};

describe('buildBatchCookingPlan', () => {
  const groups = buildBatchCookingPlan(plan, RECIPES, true);
  const group = (kind: string) => groups.find((g) => g.kind === kind);

  it('regroupe les préparations par famille, dans l’ordre de la session', () => {
    expect(groups.map((g) => g.kind)).toEqual([
      'plat-entier',
      'cereales-legumineuses',
      'legumes',
      'sauces',
    ]);
    for (const g of groups) {
      expect(g.title).not.toBe('');
      expect(g.hint).not.toBe('');
    }
  });

  it('cuisine en entier les recettes « batch », tous les jours, sans recompter les restes', () => {
    expect(group('plat-entier')?.tasks).toEqual([
      {
        label: 'Chili sin carne',
        recipeIds: ['chili'],
        mealLabels: ['lundi – dîner', 'dimanche – déjeuner'],
      },
    ]);
  });

  it('cuit d’avance les céréales et légumineuses sèches des repas de semaine', () => {
    // Pas le riz du chili (cuit avec le plat), ni les conserves, ni le riz à risotto,
    // ni le curry du samedi (le week-end laisse le temps).
    expect(group('cereales-legumineuses')?.tasks).toEqual([
      { label: 'quinoa', recipeIds: ['bowl'], mealLabels: ['mardi – dîner', 'vendredi – dîner'] },
      { label: 'lentilles vertes', recipeIds: ['curry'], mealLabels: ['mercredi – dîner'] },
    ]);
  });

  it('coupe les légumes fermes, fusionnés d’une recette à l’autre (pas la salade ni les tomates)', () => {
    expect(group('legumes')?.tasks).toEqual([
      {
        label: 'carottes',
        recipeIds: ['bowl', 'curry'],
        mealLabels: ['mardi – dîner', 'mercredi – dîner', 'vendredi – dîner'],
      },
    ]);
  });

  it('prépare les sauces et marinades repérées dans les étapes', () => {
    expect(group('sauces')?.tasks.map((t) => [t.label, t.mealLabels])).toEqual([
      ['Sauce : Bowl quinoa', ['mardi – dîner', 'vendredi – dîner']],
      ['Marinade : Curry de lentilles', ['mercredi – dîner']],
    ]);
  });

  it('ignore le petit-déjeuner et les recettes inconnues', () => {
    const labels = groups.flatMap((g) => g.tasks.map((t) => t.label));
    expect(labels).not.toContain('flocons d’avoine');
    const withUnknown = { ...plan, meals: [...plan.meals, meal(4, 'dejeuner', 'disparue')] };
    expect(buildBatchCookingPlan(withUnknown, RECIPES, true)).toEqual(groups);
  });

  it('omet les familles vides, et tout sans l’option', () => {
    const light = { ...plan, meals: [meal(3, 'dejeuner', 'salade')] };
    expect(buildBatchCookingPlan(light, RECIPES, true)).toEqual([]);
    expect(buildBatchCookingPlan(plan, RECIPES, false)).toEqual([]);
  });
});

describe('sauceToPrepare', () => {
  it('reconnaît vinaigrette, pesto, marinade et sauce préparée à part', () => {
    const withSteps = (steps: string[]) => makeRecipe({ id: 'x', steps });
    expect(sauceToPrepare(withSteps(['Prépare la vinaigrette.']))).toBe('Vinaigrette');
    expect(sauceToPrepare(withSteps(['Mixe le basilic en pesto.']))).toBe('Pesto');
    expect(sauceToPrepare(withSteps(['Laisse la marinade une nuit.']))).toBe('Marinade');
    expect(sauceToPrepare(withSteps(['Sers avec la sauce yaourt.']))).toBe('Sauce');
    // « sauce soja » versée en fin de cuisson : rien à préparer d'avance.
    expect(sauceToPrepare(withSteps(['Arrose de sauce soja et sers.']))).toBeUndefined();
  });
});
