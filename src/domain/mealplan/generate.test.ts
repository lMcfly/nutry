import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../shared';
import { FIXTURE_RECIPES, fixture, makeProfile, makeRecipe } from '../testing/fixtures';
import type { Recipe } from '../recipe';
import { learnWeights } from '../preferences';
import type { Profile } from '../profile';
import {
  MAX_LEFTOVERS_PER_WEEK,
  dayRequirements,
  generateWeeklyPlan,
  isConsecutiveProtein,
  mealLabel,
} from './index';
import type { WeeklyPlan } from './index';

const START = '2026-11-25'; // un mercredi : le menu commence le lundi 23
const byId = new Map(FIXTURE_RECIPES.map((r) => [r.id, r]));
const recipeOf = (id: string): Recipe => {
  const recipe = byId.get(id);
  if (!recipe) throw new Error(id);
  return recipe;
};

function generate(
  profile: Profile = makeProfile(),
  seed = 1,
  recipes: readonly Recipe[] = FIXTURE_RECIPES,
) {
  return generateWeeklyPlan({ profile, recipes, startDate: START, rng: createSeededRng(seed) });
}

function mainMeals(plan: WeeklyPlan) {
  return plan.meals.filter((m) => m.slot !== 'petit-dejeuner');
}

describe('generateWeeklyPlan : structure', () => {
  const plan = generate();

  it('couvre 7 jours × déjeuner + dîner à partir du lundi', () => {
    expect(plan.weekStart).toBe('2026-11-23');
    expect(plan.meals).toHaveLength(14);
    expect(plan.meals.map((m) => m.id).slice(0, 4)).toEqual([
      '0-dejeuner',
      '0-diner',
      '1-dejeuner',
      '1-diner',
    ]);
    expect(plan.meals.at(-1)).toMatchObject({ dayIndex: 6, date: '2026-11-29', slot: 'diner' });
    expect(plan.notices).toEqual([]);
  });

  it('respecte le niveau et le temps de chaque jour', () => {
    const profile = makeProfile();
    for (const meal of plan.meals.filter((m) => !m.isLeftover)) {
      const req = dayRequirements(profile, meal.date);
      const recipe = recipeOf(meal.recipeId);
      expect(meal.requestedLevel).toBe(req.level);
      expect(recipe.level, meal.id).toBe(req.level);
      expect(recipe.prepMinutes + recipe.cookMinutes).toBeLessThanOrEqual(req.minutes);
      expect(meal.relaxed).toEqual([]);
    }
  });

  it('n’a aucun doublon hors restes et jamais deux fois la même protéine d’affilée', () => {
    const cooked = plan.meals.filter((m) => !m.isLeftover).map((m) => m.recipeId);
    expect(new Set(cooked).size).toBe(cooked.length);
    const meals = mainMeals(plan);
    meals.forEach((meal, i) => {
      const previous = meals[i - 1];
      if (!previous || meal.isLeftover) return;
      expect(
        isConsecutiveProtein(
          recipeOf(meal.recipeId).mainProtein,
          recipeOf(previous.recipeId).mainProtein,
        ),
        meal.id,
      ).toBe(false);
    });
  });

  it('fournit la ventilation du score de chaque repas cuisiné', () => {
    for (const meal of plan.meals.filter((m) => !m.isLeftover)) {
      expect(meal.score.components.map((c) => c.key)).toContain('variete');
      expect(meal.score.total).toBeCloseTo(
        meal.score.components.reduce((s, c) => s + c.points, 0),
        10,
      );
    }
  });

  it('est déterministe pour une même graine et varie selon la graine', () => {
    expect(generate(makeProfile(), 1)).toEqual(plan);
    const signatures = new Set(
      [1, 2, 3, 4, 5, 6].map((seed) =>
        generate(makeProfile(), seed)
          .meals.map((m) => m.recipeId)
          .join(),
      ),
    );
    expect(signatures.size).toBeGreaterThan(1);
  });

  it('libelle les repas en français', () => {
    expect(mealLabel({ dayIndex: 1, slot: 'diner' })).toBe('mardi – dîner');
    expect(mealLabel({ dayIndex: 6, slot: 'petit-dejeuner' })).toBe('dimanche – petit-déjeuner');
  });
});

describe('restes', () => {
  it('un dîner « restes » alimente le déjeuner du lendemain', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const plan = generate(makeProfile(), seed);
      const leftovers = plan.meals.filter((m) => m.isLeftover);
      expect(leftovers.length).toBeLessThanOrEqual(MAX_LEFTOVERS_PER_WEEK);
      for (const leftover of leftovers) {
        const source = plan.meals.find((m) => m.id === leftover.leftoverOf);
        expect(source?.slot).toBe('diner');
        expect(source?.dayIndex).toBe(leftover.dayIndex - 1);
        expect(leftover.slot).toBe('dejeuner');
        expect(leftover.recipeId).toBe(source?.recipeId);
        expect(recipeOf(leftover.recipeId).tags).toContain('restes');
        expect(leftover.score.facts.totalMinutes).toBe(0);
      }
      // Tout dîner « restes » non dominical est suivi de ses restes (dans la limite hebdomadaire).
      const sources = plan.meals.filter(
        (m) => m.slot === 'diner' && m.dayIndex < 6 && recipeOf(m.recipeId).tags.includes('restes'),
      );
      expect(leftovers.length).toBe(Math.min(sources.length, MAX_LEFTOVERS_PER_WEEK));
    }
  });

  it('limite à 3 restes par semaine', () => {
    const recipes = Array.from({ length: 20 }, (_, k) =>
      makeRecipe({ id: `r${k}`, tags: ['restes'], mainProtein: k % 2 ? 'legumineuses' : 'aucune' }),
    );
    const profile = makeProfile({ weekendLevel: 'simple' });
    const plan = generate(profile, 3, recipes);
    expect(plan.meals.filter((m) => m.isLeftover)).toHaveLength(3);
  });

  it('peut être désactivé', () => {
    const plan = generateWeeklyPlan({
      profile: makeProfile(),
      recipes: FIXTURE_RECIPES,
      startDate: START,
      rng: createSeededRng(1),
      leftovers: false,
    });
    expect(plan.meals.some((m) => m.isLeftover)).toBe(false);
  });
});

describe('petit-déjeuner', () => {
  it('ajoute un petit-déjeuner par jour, choisi parmi les recettes étiquetées', () => {
    const plan = generate(makeProfile({ breakfast: true }));
    const breakfasts = plan.meals.filter((m) => m.slot === 'petit-dejeuner');
    expect(plan.meals).toHaveLength(21);
    expect(breakfasts).toHaveLength(7);
    for (const b of breakfasts) {
      expect(recipeOf(b.recipeId).tags).toContain('petit-dejeuner');
      expect(b.requestedLevel).toBeUndefined();
    }
    // 3 recettes : rotation complète avant toute répétition.
    expect(new Set(breakfasts.slice(0, 3).map((b) => b.recipeId)).size).toBe(3);
    expect(
      plan.meals
        .filter((m) => m.slot !== 'petit-dejeuner')
        .every((m) => !recipeOf(m.recipeId).tags.includes('petit-dejeuner')),
    ).toBe(true);
  });

  it('se replie proprement sans recette de petit-déjeuner compatible', () => {
    const plan = generate(makeProfile({ breakfast: true, allergens: ['gluten'] }));
    expect(plan.meals.some((m) => m.slot === 'petit-dejeuner')).toBe(false);
    expect(plan.meals).toHaveLength(14);
    expect(plan.notices.map((n) => n.code)).toContain('petit-dejeuner-indisponible');
  });
});

describe('assouplissements', () => {
  it('signale l’absence totale de recette compatible', () => {
    const plan = generate(makeProfile(), 1, []);
    expect(plan.meals).toEqual([]);
    expect(plan.notices.map((n) => n.code)).toEqual(['aucune-recette-compatible']);
  });

  it('relâche le niveau avant la variété de protéine', () => {
    const recipes = [
      makeRecipe({ id: 'v1', mainProtein: 'volaille' }),
      makeRecipe({ id: 'v2', mainProtein: 'volaille' }),
      makeRecipe({ id: 'm1', level: 'medium', mainProtein: 'boeuf' }),
    ];
    const profile = makeProfile({ weekendLevel: 'simple' });
    const plan = generate(profile, 1, recipes);
    const [first, second, third] = plan.meals;
    expect(first?.relaxed).toEqual([]);
    expect(second).toMatchObject({ recipeId: 'm1', relaxed: ['niveau'] });
    expect(third?.relaxed).toEqual([]);
    expect(plan.notices.map((n) => n.code)).toContain('contraintes-assouplies');
  });

  describe('recettes évitées (👎 « pas aimé »)', () => {
    const ratedAt = '2026-11-20T20:00:00.000Z';
    const dislike = (recipeId: string) =>
      ({ recipeId, verdict: 'down', reason: 'pas-aime', ratedAt }) as const;

    it('ne sont plus proposées tant qu’une alternative existe', () => {
      const weights = learnWeights([dislike('dinde-patate-douce')], FIXTURE_RECIPES);
      for (const seed of [1, 2, 3, 4]) {
        const plan = generateWeeklyPlan({
          profile: makeProfile({ likes: ['dinde'] }),
          recipes: FIXTURE_RECIPES,
          weights,
          startDate: START,
          rng: createSeededRng(seed),
        });
        expect(plan.meals.map((m) => m.recipeId)).not.toContain('dinde-patate-douce');
      }
    });

    it('sont assouplies après le niveau et avant la variété de protéine', () => {
      const recipes = [
        makeRecipe({ id: 'p1', mainProtein: 'porc' }),
        makeRecipe({ id: 'p2', mainProtein: 'porc' }),
        makeRecipe({ id: 'evitee', mainProtein: 'boeuf' }),
      ];
      const weights = learnWeights([dislike('evitee')], recipes);
      const plan = generateWeeklyPlan({
        profile: makeProfile({ weekendLevel: 'simple' }),
        recipes,
        weights,
        startDate: START,
        rng: createSeededRng(1),
      });
      const [first, second] = plan.meals;
      expect(first?.recipeId).toMatch(/^p/);
      expect(second).toMatchObject({ recipeId: 'evitee', relaxed: ['evitee'] });
    });
  });

  it('relâche le niveau puis les doublons, et le temps en dernier avec la recette la plus courte', () => {
    const recipes = [
      makeRecipe({
        id: 'long',
        level: 'medium',
        prepMinutes: 30,
        cookMinutes: 60,
        mainProtein: 'aucune',
      }),
      makeRecipe({
        id: 'moins-long',
        level: 'medium',
        prepMinutes: 20,
        cookMinutes: 30,
        mainProtein: 'aucune',
      }),
    ];
    const profile = makeProfile({
      weekdayMinutes: 20,
      weekendMinutes: 120,
      weekendLevel: 'simple',
    });
    const plan = generate(profile, 1, recipes);
    const monday = plan.meals.filter((m) => m.dayIndex === 0);
    expect(monday.map((m) => m.recipeId)).toEqual(['moins-long', 'moins-long']);
    expect(monday[0]?.relaxed).toEqual(['niveau', 'temps']);
    expect(monday[1]?.relaxed).toEqual(['niveau', 'doublon', 'temps']);
    // Le week-end, le temps suffit : seuls niveau et doublon sont relâchés.
    const saturday = plan.meals.filter((m) => m.dayIndex === 5);
    expect(saturday.every((m) => !m.relaxed.includes('temps'))).toBe(true);
  });
});

describe('profil', () => {
  it('privilégie les recettes « batch » en semaine avec l’option batch cooking', () => {
    const count = (batchCooking: boolean) =>
      [1, 2, 3, 4, 5, 6, 7, 8].reduce((sum, seed) => {
        const plan = generate(
          makeProfile({ batchCooking, weekdayLevel: 'medium', weekdayMinutes: 45 }),
          seed,
        );
        return (
          sum +
          plan.meals.filter(
            (m) => m.dayIndex < 5 && !m.isLeftover && recipeOf(m.recipeId).tags.includes('batch'),
          ).length
        );
      }, 0);
    expect(count(true)).toBeGreaterThanOrEqual(count(false));
  });

  it('place les recettes aimées en priorité', () => {
    const plan = generate(makeProfile({ likes: ['dinde'] }));
    expect(plan.meals.map((m) => m.recipeId)).toContain('dinde-patate-douce');
    expect(fixture('dinde-patate-douce').level).toBe('simple');
  });
});
