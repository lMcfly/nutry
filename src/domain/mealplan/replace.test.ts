import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../shared';
import { FIXTURE_RECIPES, fixture, makeProfile } from '../testing/fixtures';
import { learnWeights } from '../preferences';
import {
  BALANCE_TARGETS,
  applyReplacement,
  computeWeekBalance,
  explainMeal,
  generateWeeklyPlan,
  joinFr,
  replaceMeal,
} from './index';
import type { PlannedMeal, ScoreBreakdown, ScoreFacts, WeeklyPlan } from './index';

const profile = makeProfile({ breakfast: true });
const plan = generateWeeklyPlan({
  profile,
  recipes: FIXTURE_RECIPES,
  startDate: '2026-11-23',
  rng: createSeededRng(11),
});
const level = (id: string) => fixture(id).level;

function meal(id: string): PlannedMeal {
  const found = plan.meals.find((m) => m.id === id);
  if (!found) throw new Error(id);
  return found;
}

describe('replaceMeal', () => {
  it('propose 3 alternatives du même niveau, absentes de la semaine, triées par score', () => {
    const target = meal('0-diner');
    const alternatives = replaceMeal({
      plan,
      mealId: target.id,
      profile,
      recipes: FIXTURE_RECIPES,
    });
    const inPlan = new Set(plan.meals.map((m) => m.recipeId));
    expect(alternatives.length).toBeGreaterThan(0);
    expect(alternatives.length).toBeLessThanOrEqual(3);
    for (const alt of alternatives) {
      expect(alt.recipe.level).toBe(level(target.recipeId));
      expect(inPlan.has(alt.recipe.id)).toBe(false);
      expect(alt.recipe.tags).not.toContain('petit-dejeuner');
    }
    const totals = alternatives.map((a) => a.score.total);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
  });

  it('respecte le nombre demandé et les avis appris', () => {
    const target = meal('5-diner');
    const all = replaceMeal({
      plan,
      mealId: target.id,
      profile,
      recipes: FIXTURE_RECIPES,
      count: 10,
    });
    const first = all[0];
    expect(first).toBeDefined();
    if (!first) return;
    const weights = learnWeights(
      [{ recipeId: first.recipe.id, verdict: 'down', ratedAt: '2026-11-01T00:00:00.000Z' }],
      FIXTURE_RECIPES,
    );
    const after = replaceMeal({
      plan,
      mealId: target.id,
      profile,
      recipes: FIXTURE_RECIPES,
      weights,
      count: 10,
    });
    expect(after.findIndex((a) => a.recipe.id === first.recipe.id)).toBeGreaterThan(0);
  });

  it('remplace un petit-déjeuner par un autre petit-déjeuner', () => {
    const lean = { ...plan, meals: plan.meals.filter((m) => m.id === '0-petit-dejeuner') };
    const alternatives = replaceMeal({
      plan: lean,
      mealId: '0-petit-dejeuner',
      profile,
      recipes: FIXTURE_RECIPES,
    });
    expect(alternatives.length).toBeGreaterThan(0);
    expect(alternatives.every((a) => a.recipe.tags.includes('petit-dejeuner'))).toBe(true);
  });

  it('renvoie une liste vide pour un repas inconnu ou un catalogue épuisé', () => {
    expect(replaceMeal({ plan, mealId: '9-diner', profile, recipes: FIXTURE_RECIPES })).toEqual([]);
    const strict = makeProfile({ diets: ['vegan'], allergens: ['gluten', 'soja', 'lupin'] });
    expect(
      replaceMeal({ plan, mealId: '0-diner', profile: strict, recipes: FIXTURE_RECIPES }).length,
    ).toBeLessThanOrEqual(3);
  });

  it('utilise le niveau demandé si la recette n’est plus au catalogue', () => {
    const target = plan.meals.find((m) => !m.isLeftover && m.requestedLevel !== undefined);
    if (!target) throw new Error('aucun repas cuisiné');
    const recipes = FIXTURE_RECIPES.filter((r) => r.id !== target.recipeId);
    const alternatives = replaceMeal({ plan, mealId: target.id, profile, recipes });
    expect(alternatives.every((a) => a.recipe.level === target.requestedLevel)).toBe(true);
  });
});

describe('applyReplacement', () => {
  const recipe = fixture('gaspacho-pois-chiches');
  const score = {
    total: 1,
    components: [],
    facts: plan.meals[0]?.score.facts,
  } as unknown as ScoreBreakdown;
  const withLeftover: WeeklyPlan = {
    ...plan,
    meals: [
      { ...meal('0-diner'), id: 'src' },
      {
        ...meal('1-dejeuner'),
        id: 'lo',
        isLeftover: true,
        leftoverOf: 'src',
        recipeId: meal('0-diner').recipeId,
      },
      meal('1-diner'),
    ],
  };

  it('fait suivre les restes du repas remplacé', () => {
    const next = applyReplacement(withLeftover, 'src', { recipe, score });
    expect(next.meals.map((m) => m.recipeId)).toEqual([
      recipe.id,
      recipe.id,
      meal('1-diner').recipeId,
    ]);
    expect(next.meals[1]?.isLeftover).toBe(true);
    expect(next.meals[0]?.score).toBe(score);
  });

  it('transforme un repas « restes » remplacé en repas cuisiné', () => {
    const next = applyReplacement(withLeftover, 'lo', { recipe, score });
    expect(next.meals[1]).toMatchObject({ recipeId: recipe.id, isLeftover: false, relaxed: [] });
    expect(next.meals[1]).not.toHaveProperty('leftoverOf');
    expect(next.meals[0]?.recipeId).toBe(meal('0-diner').recipeId);
  });
});

const facts = (overrides: Partial<ScoreFacts> = {}): ScoreFacts => ({
  likedTerms: [],
  seasonMatch: false,
  seasonalProduce: [],
  totalMinutes: 15,
  fitsTime: true,
  ratedPositively: false,
  batchFriendly: false,
  newProtein: false,
  ...overrides,
});
const explain = (f: Partial<ScoreFacts>, isLeftover = false) =>
  explainMeal({ isLeftover, score: { total: 0, components: [], facts: facts(f) } });

describe('explainMeal', () => {
  it('compose une ligne chaleureuse et naturelle', () => {
    expect(explain({ seasonMatch: true, likedTerms: ['saumon'] })).toBe(
      'Avec du saumon, que tu aimes · un plat de saison · prêt en 15 min',
    );
    expect(explain({ likedTerms: ['tomate', 'Épinards'] })).toBe(
      'Avec de la tomate et des épinards, que tu aimes · prêt en 15 min',
    );
    expect(explain({ likedTerms: ['épicé'] })).toBe('Épicé, comme tu aimes · prêt en 15 min');
    expect(explain({ likedTerms: ['avocat', 'épicé'] })).toBe(
      'Avec de l’avocat, que tu aimes, et épicé · prêt en 15 min',
    );
    expect(explain({ likedTerms: ['panais'] })).toBe('Avec panais, que tu aimes · prêt en 15 min');
    expect(
      explain({
        seasonalProduce: ['poireaux', 'carottes', 'céleri'],
        ratedPositively: true,
        batchFriendly: true,
        totalMinutes: 45,
      }),
    ).toBe(
      'Tu avais aimé ce plat · poireaux et carottes de saison · se prépare à l’avance · prêt en 45 min',
    );
    expect(explain({ newProtein: true })).toBe('Pour varier les plaisirs · prêt en 15 min');
    expect(explain({})).toBe('Prêt en 15 min');
    expect(explain({ totalMinutes: 0 })).toBe('Sans cuisson');
    expect(explain({}, true)).toMatch(/^Les restes d’hier soir/);
  });

  it('énumère les aliments aimés', () => {
    expect(joinFr([])).toBe('');
    expect(joinFr(['a'])).toBe('a');
    expect(joinFr(['a', 'b', 'c'])).toBe('a, b et c');
  });

  it('explique chaque repas d’un menu généré, sans calories', () => {
    for (const m of plan.meals) expect(explainMeal(m)).not.toMatch(/kcal|calorie/i);
  });
});

describe('indicateur d’équilibre', () => {
  it('renvoie 4 jauges bornées entre 0 et 1', () => {
    const gauges = computeWeekBalance(plan, FIXTURE_RECIPES);
    expect(gauges.map((g) => g.key)).toEqual(['vegetables', 'legumes', 'fish', 'wholeGrains']);
    for (const g of gauges) {
      expect(g.value).toBeGreaterThanOrEqual(0);
      expect(g.value).toBeLessThanOrEqual(1);
      expect(g.target).toBe(BALANCE_TARGETS[g.key]);
    }
  });

  it('compte précisément légumes distincts, légumineuses, poissons et céréales complètes', () => {
    const small: WeeklyPlan = {
      weekStart: '2026-11-23',
      notices: [],
      meals: [
        { ...meal('0-diner'), recipeId: 'saumon-haricots-verts' },
        { ...meal('1-diner'), recipeId: 'saumon-haricots-verts', isLeftover: true },
        { ...meal('2-diner'), recipeId: 'taboule-pois-chiches' },
        { ...meal('3-diner'), recipeId: 'porridge-avoine-pomme' },
        { ...meal('4-diner'), recipeId: 'inconnue' },
      ],
    };
    const g = Object.fromEntries(computeWeekBalance(small, FIXTURE_RECIPES).map((x) => [x.key, x]));
    // haricots verts, tomates, concombre (citron, menthe : aromates ; pomme : fruit)
    expect(g.vegetables?.count).toBe(3);
    expect(g.vegetables?.value).toBeCloseTo(0.3, 10);
    expect(g.legumes?.count).toBe(1);
    expect(g.fish).toMatchObject({ count: 2, value: 1 });
    // riz complet ×2, boulgour, flocons d'avoine
    expect(g.wholeGrains?.count).toBe(4);
    expect(
      computeWeekBalance({ ...small, meals: [] }, FIXTURE_RECIPES).every((x) => x.value === 0),
    ).toBe(true);
  });
});

describe('replaceMeal et recettes évitées', () => {
  it('place les recettes évitées en dernier', () => {
    const target = meal('0-diner');
    const all = replaceMeal({
      plan,
      mealId: target.id,
      profile,
      recipes: FIXTURE_RECIPES,
      count: 10,
    });
    const first = all[0];
    expect(all.length).toBeGreaterThan(1);
    if (!first) return;
    const weights = learnWeights(
      [
        {
          recipeId: first.recipe.id,
          verdict: 'down',
          reason: 'pas-aime',
          ratedAt: '2026-11-01T00:00:00.000Z',
        },
      ],
      FIXTURE_RECIPES,
    );
    const after = replaceMeal({
      plan,
      mealId: target.id,
      profile,
      recipes: FIXTURE_RECIPES,
      weights,
      count: 10,
    });
    expect(after.at(-1)?.recipe.id).toBe(first.recipe.id);
  });
});

describe('replaceMeal : jours de séance', () => {
  it('le déjeuner et le dîner d’un jour de séance gagnent le composant sport, pas le petit-déjeuner', () => {
    const target = meal('0-diner');
    const plain = replaceMeal({ plan, mealId: target.id, profile, recipes: FIXTURE_RECIPES });
    expect(plain.every((a) => !a.score.components.some((c) => c.key === 'sport'))).toBe(true);
    const training = replaceMeal({
      plan,
      mealId: target.id,
      profile,
      recipes: FIXTURE_RECIPES,
      trainingDays: [0],
    });
    expect(training.every((a) => a.score.components.some((c) => c.key === 'sport'))).toBe(true);
    const otherDay = replaceMeal({
      plan,
      mealId: target.id,
      profile,
      recipes: FIXTURE_RECIPES,
      trainingDays: [3],
    });
    expect(otherDay.every((a) => !a.score.components.some((c) => c.key === 'sport'))).toBe(true);
    const breakfast = replaceMeal({
      plan,
      mealId: '0-petit-dejeuner',
      profile,
      recipes: FIXTURE_RECIPES,
      trainingDays: [0],
    });
    expect(breakfast.every((a) => !a.score.components.some((c) => c.key === 'sport'))).toBe(true);
  });
});
