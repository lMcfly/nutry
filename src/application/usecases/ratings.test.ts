import { describe, expect, it } from 'vitest';
import { createInMemoryPorts } from '../testing';
import { createUseCases } from '.';
import type { PlanResult, PlanView } from '.';
import { FIXTURE_RECIPES, makeProfile } from '@domain/testing/fixtures';

function ready(result: PlanResult): PlanView {
  if (result.status !== 'ready') throw new Error('menu attendu');
  return result;
}

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

  it('👎 « pas aimé » : la recette sort du menu suivant tant qu’une alternative existe', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const ports = createInMemoryPorts({ recipes: FIXTURE_RECIPES, seed });
      const uc = createUseCases(ports);
      await uc.saveProfile(makeProfile());
      const plan = ready(await uc.getCurrentPlan()).plan;
      const meal = plan.meals.find((m) => !m.isLeftover);
      if (!meal) throw new Error('repas attendu');
      await uc.rateMeal({
        weekStart: plan.weekStart,
        mealId: meal.id,
        verdict: 'down',
        reason: 'pas-aime',
      });
      const next = ready(await uc.generateWeeklyPlan()).plan;
      expect(
        next.meals.map((m) => m.recipeId),
        `graine ${seed}`,
      ).not.toContain(meal.recipeId);
      expect(next.meals.some((m) => m.relaxed.includes('evitee'))).toBe(false);
    }
  });

  it('👎 « pas aimé » : seule recette possible, elle reste mais c’est signalé', async () => {
    const only = FIXTURE_RECIPES.filter((r) => !r.tags.includes('petit-dejeuner')).slice(0, 1);
    const ports = createInMemoryPorts({ recipes: only });
    const uc = createUseCases(ports);
    await uc.saveProfile(makeProfile());
    const plan = ready(await uc.getCurrentPlan()).plan;
    const meal = plan.meals.find((m) => !m.isLeftover);
    if (!meal) throw new Error('repas attendu');
    await uc.rateMeal({
      weekStart: plan.weekStart,
      mealId: meal.id,
      verdict: 'down',
      reason: 'pas-aime',
    });
    const next = ready(await uc.generateWeeklyPlan()).plan;
    expect(next.meals.some((m) => m.relaxed.includes('evitee'))).toBe(true);
  });

  it('👍 : le score de la recette monte et elle entre dans le menu suivant', async () => {
    // Deux mondes identiques (même graine, mêmes actions), sauf le 👍.
    const world = async (like: boolean) => {
      const ports = createInMemoryPorts({ recipes: FIXTURE_RECIPES, seed: 11 });
      const uc = createUseCases(ports);
      await uc.saveProfile(makeProfile());
      const plan = ready(await uc.getCurrentPlan()).plan;
      const meal = plan.meals.find((m) => !m.isLeftover && m.slot === 'diner');
      if (!meal) throw new Error('repas attendu');
      const [alternative] = await uc.getMealAlternatives(meal.id);
      if (!alternative) throw new Error('alternative attendue');
      await uc.replaceMeal({ mealId: meal.id, recipeId: alternative.recipe.id });
      if (like) await uc.rateMeal({ weekStart: plan.weekStart, mealId: meal.id, verdict: 'up' });
      const next = ready(await uc.generateWeeklyPlan()).plan;
      return { recipeId: alternative.recipe.id, next };
    };
    const neutral = await world(false);
    const liked = await world(true);
    const notes = (meals: typeof liked.next.meals) =>
      meals
        .find((m) => m.recipeId === liked.recipeId && !m.isLeftover)
        ?.score.components.find((c) => c.key === 'notes')?.points ?? 0;

    expect(liked.next.meals.map((m) => m.recipeId)).toContain(liked.recipeId);
    expect(notes(liked.next.meals)).toBeGreaterThan(0);
    const likedMeal = liked.next.meals.find((m) => m.recipeId === liked.recipeId);
    expect(likedMeal?.score.facts.ratedPositively).toBe(true);
    // Sans le 👍, rien ne la favorise.
    expect(notes(neutral.next.meals)).toBe(0);
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
