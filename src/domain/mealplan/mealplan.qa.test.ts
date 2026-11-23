/**
 * QA phase 2 — propriétés du moteur de menu vérifiées sur de nombreux profils et graines :
 * pas de doublon, pas deux protéines identiques d'affilée (restes exceptés), niveau et
 * temps respectés sauf assouplissement signalé, déterminisme, remplacement.
 */
import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../shared';
import type { Rng } from '../shared';
import { LEVELS } from '../recipe';
import type { Recipe } from '../recipe';
import type { Profile } from '../profile';
import { FIXTURE_RECIPES, makeProfile, makeRecipe } from '../testing/fixtures';
import { applyReplacement, dayRequirements, generateWeeklyPlan, replaceMeal } from './index';
import type { WeeklyPlan } from './index';

const byId = new Map(FIXTURE_RECIPES.map((r) => [r.id, r]));
const recipeOf = (id: string): Recipe => {
  const recipe = byId.get(id);
  if (!recipe) throw new Error(id);
  return recipe;
};
const mains = (plan: WeeklyPlan) => plan.meals.filter((m) => m.slot !== 'petit-dejeuner');
const pickOne = <T>(items: readonly T[], rng: Rng): T =>
  items[Math.floor(rng() * items.length)] as T;

function randomProfile(rng: Rng): Profile {
  return makeProfile({
    weekdayLevel: pickOne(LEVELS, rng),
    weekendLevel: pickOne(LEVELS, rng),
    weekdayMinutes: pickOne([10, 15, 20, 30, 45, 60], rng),
    weekendMinutes: pickOne([15, 30, 45, 60, 90], rng),
    breakfast: rng() < 0.5,
    batchCooking: rng() < 0.5,
    likes: rng() < 0.5 ? ['saumon', 'lentilles'] : [],
  });
}

const CASES = Array.from({ length: 150 }, (_, i) => i);

describe('QA menu : propriétés sur 150 profils × graines', () => {
  it('aucun doublon hors restes, sauf assouplissement « doublon » signalé', () => {
    const rng = createSeededRng(42);
    for (const seed of CASES) {
      const plan = generateWeeklyPlan({
        profile: randomProfile(rng),
        recipes: FIXTURE_RECIPES,
        startDate: '2026-11-23',
        rng: createSeededRng(seed),
      });
      const seen = new Set<string>();
      for (const meal of mains(plan).filter((m) => !m.isLeftover)) {
        if (seen.has(meal.recipeId))
          expect(meal.relaxed, `${seed} ${meal.id}`).toContain('doublon');
        seen.add(meal.recipeId);
      }
    }
  });

  it('jamais deux protéines identiques d’affilée (y compris dîner J → déjeuner J+1), hors restes', () => {
    const rng = createSeededRng(7);
    for (const seed of CASES) {
      const plan = generateWeeklyPlan({
        profile: randomProfile(rng),
        recipes: FIXTURE_RECIPES,
        startDate: '2026-11-23',
        rng: createSeededRng(seed),
      });
      const list = mains(plan);
      for (let i = 1; i < list.length; i += 1) {
        const prev = list[i - 1];
        const cur = list[i];
        if (!prev || !cur || cur.isLeftover) continue;
        const p = recipeOf(prev.recipeId).mainProtein;
        const c = recipeOf(cur.recipeId).mainProtein;
        if (p === c && c !== 'aucune') {
          expect(cur.relaxed, `${seed} ${prev.id} → ${cur.id} (${c})`).toContain(
            'variete-proteine',
          );
        }
      }
    }
  });

  it('niveau et temps du jour respectés sauf assouplissement signalé', () => {
    const rng = createSeededRng(99);
    for (const seed of CASES) {
      const profile = randomProfile(rng);
      const plan = generateWeeklyPlan({
        profile,
        recipes: FIXTURE_RECIPES,
        startDate: '2026-11-23',
        rng: createSeededRng(seed),
      });
      for (const meal of mains(plan).filter((m) => !m.isLeftover)) {
        const req = dayRequirements(profile, meal.date);
        const recipe = recipeOf(meal.recipeId);
        expect(meal.requestedLevel).toBe(req.level);
        if (recipe.level !== req.level) expect(meal.relaxed).toContain('niveau');
        if (recipe.prepMinutes + recipe.cookMinutes > req.minutes) {
          expect(meal.relaxed).toContain('temps');
        }
      }
      if (plan.meals.some((m) => m.relaxed.length > 0)) {
        expect(plan.notices.map((n) => n.code)).toContain('contraintes-assouplies');
      }
    }
  });

  it('restes : dîner « restes » hors dimanche, le lendemain midi, 3 au plus, même recette', () => {
    const rng = createSeededRng(5);
    for (const seed of CASES) {
      const plan = generateWeeklyPlan({
        profile: randomProfile(rng),
        recipes: FIXTURE_RECIPES,
        startDate: '2026-11-23',
        rng: createSeededRng(seed),
      });
      const leftovers = plan.meals.filter((m) => m.isLeftover);
      expect(leftovers.length).toBeLessThanOrEqual(3);
      for (const l of leftovers) {
        const source = plan.meals.find((m) => m.id === l.leftoverOf);
        expect(source).toBeDefined();
        expect(source?.slot).toBe('diner');
        expect(source?.dayIndex).toBe(l.dayIndex - 1);
        expect(l.slot).toBe('dejeuner');
        expect(l.recipeId).toBe(source?.recipeId);
        expect(recipeOf(l.recipeId).tags).toContain('restes');
      }
    }
  });

  it('déterminisme : même graine → même menu, graine différente → menu (souvent) différent', () => {
    const profile = makeProfile({ breakfast: true, batchCooking: true });
    const gen = (seed: number) =>
      generateWeeklyPlan({
        profile,
        recipes: FIXTURE_RECIPES,
        startDate: '2026-11-23',
        rng: createSeededRng(seed),
      });
    for (const seed of [1, 2, 3, 1000]) expect(gen(seed)).toEqual(gen(seed));
    const signatures = new Set(
      CASES.slice(0, 20).map((s) =>
        gen(s)
          .meals.map((m) => m.recipeId)
          .join(),
      ),
    );
    expect(signatures.size).toBeGreaterThan(1);
  });

  it('variété prioritaire sur la frontière jour J dîner → jour J+1 déjeuner (catalogue piégé)', () => {
    // Deux protéines seulement ; si le dîner du lundi est « volaille », le déjeuner du mardi
    // doit être « poisson » (et inversement), aucun reste possible.
    const recipes = [
      ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) =>
        makeRecipe({ id: `volaille-${x}`, mainProtein: 'volaille', diets: ['omnivore'] }),
      ),
      ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) =>
        makeRecipe({ id: `poisson-${x}`, mainProtein: 'poisson', diets: ['omnivore'] }),
      ),
    ];
    const plan = generateWeeklyPlan({
      profile: makeProfile({ weekendLevel: 'simple' }),
      recipes,
      startDate: '2026-11-23',
      rng: createSeededRng(3),
    });
    const proteins = plan.meals.map((m) => m.recipeId.split('-')[0]);
    for (let i = 1; i < proteins.length; i += 1) expect(proteins[i]).not.toBe(proteins[i - 1]);
    expect(plan.meals.every((m) => m.relaxed.length === 0)).toBe(true);
  });
});

describe('QA remplacement', () => {
  const profile = makeProfile();
  const plan = generateWeeklyPlan({
    profile,
    recipes: FIXTURE_RECIPES,
    startDate: '2026-11-23',
    rng: createSeededRng(11),
  });

  it('propose au plus 3 alternatives, du même niveau, absentes de la semaine', () => {
    for (const meal of plan.meals) {
      const alts = replaceMeal({ plan, mealId: meal.id, profile, recipes: FIXTURE_RECIPES });
      expect(alts.length).toBeLessThanOrEqual(3);
      const inPlan = new Set(plan.meals.map((m) => m.recipeId));
      for (const alt of alts) {
        expect(alt.recipe.level).toBe(recipeOf(meal.recipeId).level);
        expect(inPlan.has(alt.recipe.id)).toBe(false);
      }
    }
  });

  it('un id inconnu ne propose rien', () => {
    expect(replaceMeal({ plan, mealId: '9-diner', profile, recipes: FIXTURE_RECIPES })).toEqual([]);
  });

  it('applyReplacement ne mute pas le plan d’origine', () => {
    const target = plan.meals[0];
    if (!target) throw new Error('plan vide');
    const [alt] = replaceMeal({ plan, mealId: target.id, profile, recipes: FIXTURE_RECIPES });
    if (!alt) throw new Error('aucune alternative');
    const before = JSON.stringify(plan);
    const next = applyReplacement(plan, target.id, alt);
    expect(JSON.stringify(plan)).toBe(before);
    expect(next.meals[0]?.recipeId).toBe(alt.recipe.id);
  });
});

describe('QA remplacement : variété avec le repas SUIVANT', () => {
  // Plan construit à la main : lundi midi (à remplacer), lundi soir « poisson » (restes),
  // mardi midi = restes du lundi soir, mardi soir « porc ».
  const facts = {
    likedTerms: [],
    seasonMatch: false,
    seasonalProduce: [],
    totalMinutes: 15,
    fitsTime: true,
    ratedPositively: false,
    batchFriendly: false,
    newProtein: false,
  };
  const score = { total: 0, components: [], facts };
  const recipes = [
    makeRecipe({ id: 'midi', mainProtein: 'boeuf', diets: ['omnivore'] }),
    makeRecipe({
      id: 'soir-poisson',
      mainProtein: 'poisson',
      diets: ['omnivore'],
      tags: ['restes'],
    }),
    makeRecipe({ id: 'mardi-porc', mainProtein: 'porc', diets: ['omnivore'] }),
    // Alternatives : même score de base ; « alt-poisson » est en plus aimée.
    makeRecipe({
      id: 'alt-poisson',
      mainProtein: 'poisson',
      diets: ['omnivore'],
      ingredients: [
        { name: 'saumon', quantity: 200, unit: 'g', aisle: 'boucherie-poissonnerie' },
        { name: 'citron', quantity: 1, unit: 'piece', aisle: 'fruits-legumes' },
      ],
    }),
    makeRecipe({
      id: 'alt-porc',
      mainProtein: 'porc',
      diets: ['omnivore'],
      ingredients: [
        { name: 'saumon fumé', quantity: 50, unit: 'g', aisle: 'frais' },
        { name: 'citron', quantity: 1, unit: 'piece', aisle: 'fruits-legumes' },
      ],
    }),
    makeRecipe({ id: 'alt-volaille', mainProtein: 'volaille', diets: ['omnivore'] }),
  ];
  const base = { relaxed: [], score, isLeftover: false, requestedLevel: 'simple' as const };
  const plan: WeeklyPlan = {
    weekStart: '2026-11-23',
    notices: [],
    meals: [
      {
        ...base,
        id: '0-dejeuner',
        dayIndex: 0,
        date: '2026-11-23',
        slot: 'dejeuner',
        recipeId: 'midi',
      },
      {
        ...base,
        id: '0-diner',
        dayIndex: 0,
        date: '2026-11-23',
        slot: 'diner',
        recipeId: 'soir-poisson',
      },
      {
        ...base,
        id: '1-dejeuner',
        dayIndex: 1,
        date: '2026-11-24',
        slot: 'dejeuner',
        recipeId: 'soir-poisson',
        isLeftover: true,
        leftoverOf: '0-diner',
      },
      {
        ...base,
        id: '1-diner',
        dayIndex: 1,
        date: '2026-11-24',
        slot: 'diner',
        recipeId: 'mardi-porc',
      },
    ],
  };
  const profile = makeProfile({ likes: ['saumon', 'citron'] });

  const rank = (alts: { recipe: Recipe }[], id: string) =>
    alts.findIndex((a) => a.recipe.id === id);
  const variety = (
    alts: { recipe: Recipe; score: { components: readonly { key: string; points: number }[] } }[],
    id: string,
  ) =>
    alts.find((a) => a.recipe.id === id)?.score.components.find((c) => c.key === 'variete')?.points;

  it('pénalise une alternative qui répète la protéine du repas suivant', () => {
    // Remplacer lundi midi : « alt-poisson » (aimée, +4) précéderait le poisson du lundi soir.
    const alts = replaceMeal({ plan, mealId: '0-dejeuner', profile, recipes, count: 10 });
    expect(variety(alts, 'alt-poisson')).toBeLessThanOrEqual(-4);
    expect(rank(alts, 'alt-poisson')).toBeGreaterThan(rank(alts, 'alt-volaille'));
  });

  it('un dîner à restes remplacé est comparé au repas qui suit ses restes', () => {
    // Remplacer lundi soir : ses restes suivront mardi midi, puis vient le porc du mardi soir.
    const alts = replaceMeal({ plan, mealId: '0-diner', profile, recipes, count: 10 });
    expect(variety(alts, 'alt-porc')).toBeLessThanOrEqual(-4);
    expect(rank(alts, 'alt-porc')).toBeGreaterThan(rank(alts, 'alt-volaille'));
  });
});
