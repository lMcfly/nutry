/**
 * QA phase 2 — chemins d'allergènes non couverts par `allergen-safety.test.ts` :
 * restes qui suivent un remplacement, assouplissements extrêmes (catalogue piégé),
 * petit-déjeuner, frigo vide avec ingrédients allergènes cochés, liste de courses issue
 * d'un remplacement, aliments détestés (accents, pluriels, protéine principale).
 */
import { describe, expect, it } from 'vitest';
import { createSeededRng } from './shared';
import { ALLERGENS, isRecipeCompatible, dislikedIn } from './recipe';
import type { Allergen, Recipe } from './recipe';
import { applyReplacement, generateWeeklyPlan, replaceMeal } from './mealplan';
import type { WeeklyPlan } from './mealplan';
import { suggestFromFridge } from './fridge';
import { buildShoppingList } from './shopping';
import { FIXTURE_RECIPES, ing, makeProfile, makeRecipe } from './testing/fixtures';
import type { Profile } from './profile';

const byId = new Map(FIXTURE_RECIPES.map((r) => [r.id, r]));
const unsafe = (plan: WeeklyPlan, profile: Profile, recipes = byId) =>
  plan.meals.filter((m) => {
    const r = recipes.get(m.recipeId);
    return !r || !isRecipeCompatible(r, profile);
  });

describe('QA allergènes : chemins indirects', () => {
  it.each(ALLERGENS)(
    '%s : remplacements en chaîne (restes compris) puis courses, jamais d’allergène',
    (allergen: Allergen) => {
      const profile = makeProfile({ allergens: [allergen], breakfast: true, batchCooking: true });
      let plan = generateWeeklyPlan({
        profile,
        recipes: FIXTURE_RECIPES,
        startDate: '2026-11-23',
        rng: createSeededRng(allergen.length),
      });
      // Remplace chaque repas (y compris les dîners à restes et les restes eux-mêmes).
      for (const meal of plan.meals) {
        const [alt] = replaceMeal({ plan, mealId: meal.id, profile, recipes: FIXTURE_RECIPES });
        if (alt) plan = applyReplacement(plan, meal.id, alt);
        expect(unsafe(plan, profile), `${allergen} après ${meal.id}`).toEqual([]);
      }
      const list = buildShoppingList({
        plan,
        recipes: FIXTURE_RECIPES,
        householdSize: 3,
        userPortionFactor: 1,
      });
      for (const item of list.sections.flatMap((s) => s.items)) {
        for (const id of item.recipeIds) {
          const recipe = byId.get(id);
          expect(recipe?.allergens, `${item.name} via ${id}`).not.toContain(allergen);
        }
      }
    },
  );

  it('catalogue piégé : quand tout est assoupli, les filtres durs ne le sont jamais', () => {
    // Une seule recette sûre, longue et du mauvais niveau ; toutes les autres contiennent
    // l'allergène mais respectent niveau, temps et variété.
    const safe = makeRecipe({
      id: 'sure',
      level: 'experiment',
      prepMinutes: 90,
      cookMinutes: 90,
      tags: ['restes'],
    });
    const traps = Array.from({ length: 20 }, (_, i) =>
      makeRecipe({ id: `piege-${i}`, allergens: ['arachides'], mainProtein: 'aucune' }),
    );
    const breakfastTrap = makeRecipe({
      id: 'piege-matin',
      allergens: ['arachides'],
      tags: ['petit-dejeuner'],
    });
    const recipes = [safe, ...traps, breakfastTrap];
    const profile = makeProfile({ allergens: ['arachides'], breakfast: true, weekdayMinutes: 10 });
    const plan = generateWeeklyPlan({
      profile,
      recipes,
      startDate: '2026-11-23',
      rng: createSeededRng(1),
    });
    expect(new Set(plan.meals.map((m) => m.recipeId))).toEqual(new Set(['sure']));
    expect(plan.meals.some((m) => m.slot === 'petit-dejeuner')).toBe(false);
    expect(plan.notices.map((n) => n.code)).toEqual([
      'petit-dejeuner-indisponible',
      'contraintes-assouplies',
    ]);
    for (const meal of plan.meals) {
      expect(replaceMeal({ plan, mealId: meal.id, profile, recipes, count: 50 })).toEqual([]);
    }
  });

  it('frigo vide : cocher un ingrédient allergène ou détesté ne le fait jamais proposer', () => {
    const profile = makeProfile({ allergens: ['poissons', 'lait'], dislikes: ['Champignons'] });
    const allIngredients = [
      ...new Set(FIXTURE_RECIPES.flatMap((r) => r.ingredients.map((i) => i.name))),
    ];
    const suggestions = suggestFromFridge({
      constraints: profile,
      recipes: FIXTURE_RECIPES,
      available: allIngredients,
    });
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(s.recipe.allergens).not.toContain('poissons');
      expect(s.recipe.allergens).not.toContain('lait');
      expect(dislikedIn(s.recipe, profile.dislikes)).toEqual([]);
      expect(s.missing).toEqual([]);
    }
  });

  it('aliments détestés : accents, majuscules, pluriels et protéine principale', () => {
    const r: Recipe = makeRecipe({
      id: 'r',
      mainProtein: 'fruits-de-mer',
      ingredients: [ing('Crème fraîche', 10, 'cl', 'frais'), ing('œufs', 2, 'piece', 'frais')],
    });
    expect(dislikedIn(r, ['creme'])).toEqual(['creme']);
    expect(dislikedIn(r, ['ŒUF'])).toEqual(['ŒUF']);
    expect(dislikedIn(r, ['oeuf'])).toEqual(['oeuf']);
    expect(dislikedIn(r, ['fruits de mer'])).toEqual(['fruits de mer']);
    expect(dislikedIn(r, ['crème fraîche'])).toEqual(['crème fraîche']);
    // Pas de faux positif sur un fragment de mot.
    expect(dislikedIn(r, ['eu', 'mer fraîche'])).toEqual([]);
  });
});

describe('QA frigo vide : correspondance des ingrédients', () => {
  it('« pommes » ne compte pas pour « pommes de terre » (et inversement)', () => {
    const profile = makeProfile();
    const withApples = suggestFromFridge({
      constraints: profile,
      recipes: FIXTURE_RECIPES,
      available: ['pommes'],
    });
    for (const s of withApples) {
      expect(s.matched.map((i) => i.name)).not.toContain('pommes de terre');
    }
    expect(withApples.map((s) => s.recipe.id)).toContain('porridge-avoine-pomme');
    const withPotatoes = suggestFromFridge({
      constraints: profile,
      recipes: FIXTURE_RECIPES,
      available: ['pomme de terre'],
    });
    expect(withPotatoes.map((s) => s.recipe.id)).not.toContain('porridge-avoine-pomme');
    expect(withPotatoes.map((s) => s.recipe.id)).toContain('boeuf-carottes');
  });

  it('les correspondances légitimes restent : « tomates » ↔ « tomates cerises », « courge »', () => {
    const recipe = makeRecipe({
      id: 'x',
      ingredients: [
        ing('tomates cerises', 200, 'g', 'fruits-legumes'),
        ing('courge butternut', 1, 'piece', 'fruits-legumes'),
      ],
    });
    const [s] = suggestFromFridge({
      constraints: makeProfile(),
      recipes: [recipe],
      available: ['tomate', 'courge'],
    });
    expect(s?.missing).toEqual([]);
  });
});
