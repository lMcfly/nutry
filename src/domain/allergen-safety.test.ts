/**
 * Test « propriété » : quelle que soit la combinaison d'allergènes, de régimes et
 * d'aliments détestés, AUCUNE fonction qui propose des recettes ne renvoie une
 * recette interdite (menu, remplacement, frigo vide).
 */
import { describe, expect, it } from 'vitest';
import { createSeededRng } from './shared';
import type { Rng } from './shared';
import { ALLERGENS, DIETS, containsAllergen, dislikedIn, matchesDiets } from './recipe';
import type { Allergen, Diet, Recipe } from './recipe';
import { generateWeeklyPlan, replaceMeal } from './mealplan';
import { suggestFromFridge } from './fridge';
import { FIXTURE_RECIPES, makeProfile } from './testing/fixtures';
import type { Profile } from './profile';

const byId = new Map(FIXTURE_RECIPES.map((r) => [r.id, r]));
const DISLIKE_POOL = ['saumon', 'tofu', 'champignon', 'poulet', 'courgette', 'riz', 'oignon'];

function subset<T>(items: readonly T[], probability: number, rng: Rng): T[] {
  return items.filter(() => rng() < probability);
}

function assertSafe(recipe: Recipe | undefined, profile: Profile): void {
  expect(recipe).toBeDefined();
  if (!recipe) return;
  expect(
    containsAllergen(recipe, profile.allergens),
    `${recipe.id} / ${profile.allergens.join()}`,
  ).toBe(false);
  expect(matchesDiets(recipe, profile.diets), `${recipe.id} / ${profile.diets.join()}`).toBe(true);
  expect(dislikedIn(recipe, profile.dislikes), recipe.id).toEqual([]);
}

function checkAllProposals(profile: Profile, seed: number): number {
  const rng = createSeededRng(seed);
  const plan = generateWeeklyPlan({
    profile,
    recipes: FIXTURE_RECIPES,
    startDate: '2026-11-23',
    rng,
  });
  let checked = 0;
  for (const meal of plan.meals) {
    assertSafe(byId.get(meal.recipeId), profile);
    checked += 1;
  }
  for (const meal of plan.meals.slice(0, 4)) {
    for (const alt of replaceMeal({
      plan,
      mealId: meal.id,
      profile,
      recipes: FIXTURE_RECIPES,
      count: 50,
    })) {
      assertSafe(alt.recipe, profile);
      checked += 1;
    }
  }
  const available = subset(
    [...new Set(FIXTURE_RECIPES.flatMap((r) => r.ingredients.map((i) => i.name)))],
    0.4,
    rng,
  );
  for (const s of suggestFromFridge({
    constraints: profile,
    recipes: FIXTURE_RECIPES,
    available,
  })) {
    assertSafe(s.recipe, profile);
    checked += 1;
  }
  return checked;
}

describe('sécurité alimentaire : filtres durs dans toutes les propositions', () => {
  it.each(ALLERGENS)('allergène seul : %s', (allergen: Allergen) => {
    const profile = makeProfile({ allergens: [allergen], breakfast: true });
    checkAllProposals(profile, 1);
  });

  it.each(DIETS)('régime seul : %s', (diet: Diet) => {
    checkAllProposals(makeProfile({ diets: [diet], breakfast: true }), 2);
  });

  it('200 profils aléatoires (graine fixe) ne reçoivent jamais de recette interdite', () => {
    const rng = createSeededRng(2026);
    let checked = 0;
    for (let i = 0; i < 200; i += 1) {
      const profile = makeProfile({
        allergens: subset(ALLERGENS, 0.2, rng),
        diets: subset(DIETS, 0.15, rng),
        dislikes: subset(DISLIKE_POOL, 0.1, rng),
        breakfast: rng() < 0.5,
        weekdayMinutes: 10 + Math.floor(rng() * 50),
        weekdayLevel: rng() < 0.5 ? 'simple' : 'experiment',
      });
      checked += checkAllProposals(profile, i);
    }
    expect(checked).toBeGreaterThan(1000);
  });
});
