import { describe, expect, it } from 'vitest';
import { createInMemoryPorts } from '../testing';
import { createUseCases } from '.';
import type { PlanResult, PlanView } from '.';
import { containsAllergen } from '@domain/recipe';
import { FIXTURE_RECIPES, makeProfile } from '@domain/testing/fixtures';
import type { Profile } from '@domain/profile';

const setup = async (profile: Profile | null = makeProfile()) => {
  const ports = createInMemoryPorts({ recipes: FIXTURE_RECIPES });
  const uc = createUseCases(ports);
  if (profile) await uc.saveProfile(profile);
  return { ports, uc };
};

function ready(result: PlanResult | { status: 'unavailable' }): PlanView {
  if (result.status !== 'ready') throw new Error(`menu attendu, reçu ${result.status}`);
  return result;
}

describe('menu de la semaine', () => {
  it('demande un profil d’abord', async () => {
    const { uc } = await setup(null);
    await expect(uc.getCurrentPlan()).resolves.toEqual({ status: 'no-profile' });
    await expect(uc.generateWeeklyPlan()).resolves.toEqual({ status: 'no-profile' });
    await expect(uc.getMealAlternatives('0-diner')).resolves.toEqual([]);
    await expect(uc.getWeekBalance()).resolves.toEqual([]);
    await expect(uc.explainMeal('0-diner')).resolves.toBeUndefined();
  });

  it('génère puis réutilise le menu de la semaine en cours', async () => {
    const { uc, ports } = await setup();
    const first = ready(await uc.getCurrentPlan());
    expect(first.origin).toBe('generated');
    expect(first.plan.weekStart).toBe('2026-11-23');
    expect(first.plan.meals).toHaveLength(14);
    expect(first.plan.generatedAt).toBe('2026-11-23T10:00:00.000Z');
    expect(Object.keys(first.explanations)).toHaveLength(14);
    for (const meal of first.plan.meals) expect(first.recipes[meal.recipeId]).toBeDefined();
    expect(first.portionFactor).toBeGreaterThan(0);
    expect(first.householdSize).toBe(1);

    ports.clock.set('2026-11-26T19:00:00.000Z');
    const again = ready(await uc.getCurrentPlan());
    expect(again.origin).toBe('stored');
    expect(again.plan).toEqual(first.plan);
  });

  it('sérialise deux appels simultanés : un seul menu généré', async () => {
    const { uc } = await setup();
    const [a, b] = await Promise.all([uc.getCurrentPlan(), uc.getCurrentPlan()]);
    expect(ready(a).plan).toEqual(ready(b).plan);
    expect(ready(b).origin).toBe('stored');
  });

  it('régénère quand les allergies changent', async () => {
    const { uc } = await setup();
    const before = ready(await uc.getCurrentPlan());
    expect(before.plan.meals.some((m) => before.recipes[m.recipeId]?.allergens.length)).toBe(true);

    await uc.saveProfile(makeProfile({ allergens: ['poissons', 'lait', 'gluten'] }));
    const after = ready(await uc.getCurrentPlan());
    expect(after.origin).toBe('regenerated');
    for (const meal of after.plan.meals) {
      const recipe = after.recipes[meal.recipeId];
      expect(recipe && containsAllergen(recipe, ['poissons', 'lait', 'gluten'])).toBe(false);
    }
  });

  it('régénère si un plat a disparu du catalogue ou n’est plus compatible', async () => {
    const { uc, ports } = await setup();
    const plan = ready(await uc.getCurrentPlan()).plan;
    const removed = plan.meals[0]?.recipeId;
    ports.recipes.recipes = FIXTURE_RECIPES.filter((r) => r.id !== removed);
    const after = ready(await uc.getCurrentPlan());
    expect(after.origin).toBe('regenerated');
    expect(after.plan.meals.map((m) => m.recipeId)).not.toContain(removed);
  });

  it('ne régénère pas pour un changement sans effet sur les filtres', async () => {
    const { uc } = await setup();
    await uc.getCurrentPlan();
    await uc.saveProfile(makeProfile({ weightKg: 70, likes: ['saumon'] }));
    expect(ready(await uc.getCurrentPlan()).origin).toBe('stored');
  });

  it('génère un nouveau menu à la demande', async () => {
    const { uc } = await setup();
    const first = ready(await uc.getCurrentPlan());
    const second = ready(await uc.generateWeeklyPlan());
    expect(second.origin).toBe('generated');
    expect(second.plan.meals.map((m) => m.recipeId)).not.toEqual(
      first.plan.meals.map((m) => m.recipeId),
    );
  });

  it('propose 3 alternatives et remplace un repas', async () => {
    const { uc } = await setup();
    const view = ready(await uc.getCurrentPlan());
    const meal = view.plan.meals.find((m) => m.slot === 'diner' && !m.isLeftover);
    if (!meal) throw new Error('dîner attendu');
    const alternatives = await uc.getMealAlternatives(meal.id);
    expect(alternatives.length).toBeGreaterThan(0);
    expect(alternatives.length).toBeLessThanOrEqual(3);
    expect(alternatives[0]?.explanation).toEqual(expect.any(String));
    const choice = alternatives[0];
    if (!choice) throw new Error('alternative attendue');

    const replaced = ready(await uc.replaceMeal({ mealId: meal.id, recipeId: choice.recipe.id }));
    const updated = replaced.plan.meals.find((m) => m.id === meal.id);
    expect(updated?.recipeId).toBe(choice.recipe.id);
    expect(replaced.plan.constraintsKey).toBe(view.plan.constraintsKey);
    expect(ready(await uc.getCurrentPlan()).plan).toEqual(replaced.plan);
  });

  it('refuse une recette qui ne fait pas partie des alternatives', async () => {
    const { uc } = await setup(makeProfile({ allergens: ['poissons'] }));
    const view = ready(await uc.getCurrentPlan());
    const mealId = view.plan.meals[0]?.id ?? '';
    await expect(uc.replaceMeal({ mealId, recipeId: 'saumon-haricots-verts' })).resolves.toEqual({
      status: 'unavailable',
    });
    await expect(uc.replaceMeal({ mealId: 'inconnu', recipeId: 'x' })).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it('explique un repas, calcule l’équilibre et les préparations du dimanche', async () => {
    const { uc } = await setup(makeProfile({ batchCooking: true }));
    const view = ready(await uc.getCurrentPlan());
    const mealId = view.plan.meals[0]?.id ?? '';
    await expect(uc.explainMeal(mealId)).resolves.toBe(view.explanations[mealId]);
    await expect(uc.explainMeal('inconnu')).resolves.toBeUndefined();
    const gauges = await uc.getWeekBalance();
    expect(gauges.map((g) => g.key)).toEqual(['vegetables', 'legumes', 'fish', 'wholeGrains']);
    const preps = await uc.getBatchCookingPlan();
    expect(preps.every((p) => p.recipe.tags.includes('batch'))).toBe(true);
  });

  it('pas de préparation du dimanche sans l’option', async () => {
    const { uc } = await setup(makeProfile({ batchCooking: false }));
    await expect(uc.getBatchCookingPlan()).resolves.toEqual([]);
  });

  it('garde l’historique des menus, du plus récent au plus ancien', async () => {
    const { uc, ports } = await setup();
    await uc.getCurrentPlan();
    ports.clock.set('2026-12-01T10:00:00.000Z');
    await uc.getCurrentPlan();
    const history = await uc.getPlanHistory();
    expect(history.plans.map((p) => p.weekStart)).toEqual(['2026-11-30', '2026-11-23']);
    for (const plan of history.plans) {
      for (const meal of plan.meals) expect(history.recipes[meal.recipeId]).toBeDefined();
    }
  });
});
