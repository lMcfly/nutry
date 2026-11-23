/**
 * Test « propriété » : quelle que soit la combinaison d'allergènes, de régimes,
 * d'aliments détestés et de grossesse (ni alcool ni cru), AUCUNE fonction qui propose des recettes ne renvoie une
 * recette interdite (menu, remplacement, frigo vide).
 */
import { describe, expect, it } from 'vitest';
import { createSeededRng } from './shared';
import type { Rng } from './shared';
import {
  ALLERGENS,
  DIETS,
  PREGNANCY_EXCLUDED_TAGS,
  containsAllergen,
  dislikedIn,
  isPregnancyRelevant,
  matchesDiets,
} from './recipe';
import type { Allergen, Diet, Recipe } from './recipe';
import { generateWeeklyPlan, replaceMeal } from './mealplan';
import { suggestFromFridge } from './fridge';
import { FIXTURE_RECIPES, makeProfile, makeRecipe } from './testing/fixtures';
import type { Profile } from './profile';

const CATALOGUE: readonly Recipe[] = [
  ...FIXTURE_RECIPES,
  makeRecipe({
    id: 'tartare-saumon',
    diets: ['omnivore', 'flexitarien', 'sans-gluten', 'sans-lactose'],
    allergens: ['poissons'],
    mainProtein: 'poisson',
    tags: ['cru', 'sans-cuisson'],
  }),
];
const byId = new Map(CATALOGUE.map((r) => [r.id, r]));
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
  if (isPregnancyRelevant(profile)) {
    expect(
      recipe.tags.filter((t) => PREGNANCY_EXCLUDED_TAGS.includes(t)),
      recipe.id,
    ).toEqual([]);
  }
}

function checkAllProposals(profile: Profile, seed: number): number {
  const rng = createSeededRng(seed);
  const plan = generateWeeklyPlan({
    profile,
    recipes: CATALOGUE,
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
      recipes: CATALOGUE,
      count: 50,
    })) {
      assertSafe(alt.recipe, profile);
      checked += 1;
    }
  }
  const available = subset(
    [...new Set(CATALOGUE.flatMap((r) => r.ingredients.map((i) => i.name)))],
    0.4,
    rng,
  );
  for (const s of suggestFromFridge({
    constraints: profile,
    recipes: CATALOGUE,
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

  it.each(['femme', 'autre'] as const)(
    'grossesse ou allaitement (%s) : ni alcool ni cru',
    (sex) => {
      const profile = makeProfile({
        sex,
        pregnantOrBreastfeeding: true,
        breakfast: true,
        weekdayLevel: 'medium',
      });
      checkAllProposals(profile, 3);
      const plan = generateWeeklyPlan({
        profile,
        recipes: CATALOGUE,
        startDate: '2026-11-23',
        rng: createSeededRng(3),
      });
      expect(
        plan.meals.some((m) =>
          ['moules-marinieres', 'risotto-courge', 'tartare-saumon'].includes(m.recipeId),
        ),
      ).toBe(false);
    },
  );

  it('200 profils aléatoires (graine fixe) ne reçoivent jamais de recette interdite', () => {
    const rng = createSeededRng(2026);
    let checked = 0;
    for (let i = 0; i < 200; i += 1) {
      const profile = makeProfile({
        allergens: subset(ALLERGENS, 0.2, rng),
        diets: subset(DIETS, 0.15, rng),
        dislikes: subset(DISLIKE_POOL, 0.1, rng),
        breakfast: rng() < 0.5,
        sex: rng() < 0.5 ? 'femme' : 'homme',
        pregnantOrBreastfeeding: rng() < 0.3,
        weekdayMinutes: 10 + Math.floor(rng() * 50),
        weekdayLevel: rng() < 0.5 ? 'simple' : 'experiment',
      });
      checked += checkAllProposals(profile, i);
    }
    expect(checked).toBeGreaterThan(1000);
  });
});
