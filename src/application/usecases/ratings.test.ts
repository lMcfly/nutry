import { describe, expect, it } from 'vitest';
import { createInMemoryPorts } from '../testing';
import { createUseCases } from '.';
import { FIXTURE_RECIPES, makeProfile } from '@domain/testing/fixtures';

const setup = async () => {
  const ports = createInMemoryPorts({ recipes: FIXTURE_RECIPES });
  const uc = createUseCases(ports);
  await uc.saveProfile(makeProfile());
  const view = await uc.getCurrentPlan();
  if (view.status !== 'ready') throw new Error('menu attendu');
  return { ports, uc, plan: view.plan };
};

describe('avis 👍/👎', () => {
  it('note un repas : un avis par repas, rattaché au menu', async () => {
    const { uc, plan, ports } = await setup();
    const meal = plan.meals.find((m) => !m.isLeftover);
    if (!meal) throw new Error('repas attendu');
    const rating = await uc.rateMeal({ weekStart: plan.weekStart, mealId: meal.id, verdict: 'up' });
    expect(rating).toMatchObject({
      id: `${plan.weekStart}:${meal.id}`,
      recipeId: meal.recipeId,
      verdict: 'up',
      ratedAt: '2026-11-23T10:00:00.000Z',
    });
    await uc.rateMeal({
      weekStart: plan.weekStart,
      mealId: meal.id,
      verdict: 'down',
      reason: 'trop-long',
    });
    expect(ports.state.ratings.size).toBe(1);

    const view = await uc.getCurrentPlan();
    if (view.status !== 'ready') throw new Error('menu attendu');
    expect(view.ratings[meal.id]).toMatchObject({ verdict: 'down', reason: 'trop-long' });
  });

  it('un repas de restes note le plat d’origine', async () => {
    const { uc, plan } = await setup();
    const leftover = plan.meals.find((m) => m.isLeftover);
    if (!leftover?.leftoverOf) return; // pas de restes avec cette graine : rien à vérifier
    const rating = await uc.rateMeal({
      weekStart: plan.weekStart,
      mealId: leftover.id,
      verdict: 'up',
    });
    expect(rating?.mealId).toBe(leftover.leftoverOf);
    const view = await uc.getCurrentPlan();
    if (view.status !== 'ready') throw new Error('menu attendu');
    expect(view.ratings[leftover.id]?.id).toBe(rating?.id);
    expect(view.ratings[leftover.leftoverOf]?.id).toBe(rating?.id);
  });

  it('ignore un repas inconnu et supprime un avis', async () => {
    const { uc, plan, ports } = await setup();
    await expect(
      uc.rateMeal({ weekStart: plan.weekStart, mealId: 'inconnu', verdict: 'up' }),
    ).resolves.toBeUndefined();
    await expect(
      uc.rateMeal({ weekStart: '2020-01-06', mealId: '0-diner', verdict: 'up' }),
    ).resolves.toBeUndefined();
    const meal = plan.meals[0];
    if (!meal) throw new Error('repas attendu');
    const rating = await uc.rateMeal({ weekStart: plan.weekStart, mealId: meal.id, verdict: 'up' });
    await uc.removeRating(rating?.id ?? '');
    expect(ports.state.ratings.size).toBe(0);
  });

  it('les avis modifient les menus suivants', async () => {
    const { uc, plan } = await setup();
    const disliked = plan.meals.filter((m) => !m.isLeftover).slice(0, 4);
    for (const meal of disliked) {
      await uc.rateMeal({ weekStart: plan.weekStart, mealId: meal.id, verdict: 'down' });
    }
    const next = await uc.generateWeeklyPlan();
    if (next.status !== 'ready') throw new Error('menu attendu');
    const ids = new Set(next.plan.meals.map((m) => m.recipeId));
    const stillThere = disliked.filter((m) => ids.has(m.recipeId)).length;
    expect(stillThere).toBeLessThan(disliked.length);
  });

  it('liste les favoris compatibles avec le profil actuel', async () => {
    const { uc, plan } = await setup();
    const meals = plan.meals.filter((m) => !m.isLeftover).slice(0, 3);
    for (const meal of meals) {
      await uc.rateMeal({ weekStart: plan.weekStart, mealId: meal.id, verdict: 'up' });
    }
    const favorites = await uc.getFavorites();
    expect(favorites.map((r) => r.id).sort()).toEqual(meals.map((m) => m.recipeId).sort());

    const first = favorites[0];
    if (!first) throw new Error('favori attendu');
    await uc.saveProfile(
      makeProfile({ dislikes: [first.mainProtein, ...first.ingredients.map((i) => i.name)] }),
    );
    expect((await uc.getFavorites()).map((r) => r.id)).not.toContain(first.id);
  });
});
