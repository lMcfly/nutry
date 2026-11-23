/**
 * Quotas et cohérence du contenu embarqué (recettes et quiz), puis test d'intégration du
 * moteur de menu sur les VRAIES recettes. Voir PROMPT.md §3.3, §4 et ADR 0005 / 0006.
 */
import { describe, expect, it } from 'vitest';
import { QUIZ_CATEGORIES } from '@domain/quiz';
import {
  ALLERGENS,
  AROMATICS,
  DIETS,
  LEVELS,
  PREGNANCY_EXCLUDED_TAGS,
  PROTEIN_TYPES,
  auditRecipe,
  containsAllergen,
  isBreakfastRecipe,
  matchesDiets,
  totalMinutes,
} from '@domain/recipe';
import type { Allergen, Diet, Level } from '@domain/recipe';
import { generateWeeklyPlan } from '@domain/mealplan';
import type { Profile } from '@domain/profile';
import { SEASONS, findProduce } from '@domain/season';
import type { Season } from '@domain/season';
import { containsAnyTerm, createSeededRng } from '@domain/shared';
import type { Rng } from '@domain/shared';
import quizJson from './quiz.json';
import recipesJson from './recipes.json';
import { quizFileSchema, recipesFileSchema } from './schemas';

const recipes = recipesFileSchema.parse(recipesJson);
const quiz = quizFileSchema.parse(quizJson);
const mains = recipes.filter((r) => !isBreakfastRecipe(r));
const breakfasts = recipes.filter(isBreakfastRecipe);
const byId = new Map(recipes.map((r) => [r.id, r]));

/** Couverture minimale des régimes, PAR NIVEAU de plats principaux. */
const DIET_QUOTAS: Readonly<Partial<Record<Diet, number>>> = {
  vegetarien: 10,
  vegan: 7,
  'sans-gluten': 10,
  'sans-lactose': 10,
};
const SEASON_MONTHS: Readonly<Record<Season, readonly number[]>> = {
  printemps: [3, 4, 5],
  ete: [6, 7, 8],
  automne: [9, 10, 11],
  hiver: [12, 1, 2],
};

describe('quotas de recettes', () => {
  it.each(LEVELS)('au moins 25 plats principaux de niveau %s', (level) => {
    expect(mains.filter((r) => r.level === level).length).toBeGreaterThanOrEqual(25);
  });

  it('au moins 10 petits-déjeuners, tous de niveau simple', () => {
    expect(breakfasts.length).toBeGreaterThanOrEqual(10);
    expect(breakfasts.every((r) => r.level === 'simple')).toBe(true);
  });

  it.each(LEVELS)('couverture des régimes au niveau %s', (level) => {
    const ofLevel = mains.filter((r) => r.level === level);
    for (const [diet, min] of Object.entries(DIET_QUOTAS)) {
      const count = ofLevel.filter((r) => r.diets.includes(diet as Diet)).length;
      expect(count, `${level} / ${diet}`).toBeGreaterThanOrEqual(min);
    }
    const veganGlutenFree = ofLevel.filter(
      (r) => r.diets.includes('vegan') && r.diets.includes('sans-gluten'),
    );
    expect(veganGlutenFree.length).toBeGreaterThanOrEqual(4);
  });

  it('omnivore sur toutes les recettes, flexitarien sur toutes les végétariennes', () => {
    for (const r of recipes) {
      expect(r.diets, r.id).toContain('omnivore');
      if (r.diets.includes('vegetarien')) expect(r.diets, r.id).toContain('flexitarien');
    }
  });

  it.each(SEASONS)('au moins 30 plats principaux disponibles en %s', (season) => {
    expect(mains.filter((r) => r.seasons.includes(season)).length).toBeGreaterThanOrEqual(30);
  });

  it('aucune protéine principale ne dépasse 15 % des plats', () => {
    for (const protein of PROTEIN_TYPES) {
      const share = mains.filter((r) => r.mainProtein === protein).length / mains.length;
      expect(share, protein).toBeLessThanOrEqual(0.15);
    }
  });

  it('au moins 12 plats « restes » et 12 plats « batch »', () => {
    expect(mains.filter((r) => r.tags.includes('restes')).length).toBeGreaterThanOrEqual(12);
    expect(mains.filter((r) => r.tags.includes('batch')).length).toBeGreaterThanOrEqual(12);
  });

  it('identifiants uniques', () => {
    expect(new Set(recipes.map((r) => r.id)).size).toBe(recipes.length);
  });
});

describe('règles de niveau (sans exception)', () => {
  it.each(recipes.filter((r) => r.level === 'simple').map((r) => [r.id, r] as const))(
    'simple : %s tient en 20 min et 6 ingrédients listés',
    (_id, recipe) => {
      expect(totalMinutes(recipe)).toBeLessThanOrEqual(20);
      expect(recipe.ingredients.length).toBeLessThanOrEqual(6);
    },
  );

  it('médium : entre 20 et 45 minutes', () => {
    for (const r of recipes.filter((x) => x.level === 'medium')) {
      expect(totalMinutes(r), r.id).toBeGreaterThanOrEqual(20);
      expect(totalMinutes(r), r.id).toBeLessThanOrEqual(45);
    }
  });
});

describe('audit du domain', () => {
  it.each(recipes.map((r) => [r.id, r] as const))('%s : aucune erreur', (_id, recipe) => {
    const errors = auditRecipe(recipe).filter((issue) => issue.severity === 'erreur');
    expect(errors.map((e) => e.message)).toEqual([]);
  });

  it('les légumes de saison sont disponibles pendant chaque saison annoncée', () => {
    for (const recipe of recipes) {
      for (const ingredient of recipe.ingredients) {
        if (ingredient.aisle !== 'fruits-legumes') continue;
        if (containsAnyTerm(ingredient.name, AROMATICS)) continue;
        const produce = findProduce(ingredient.name);
        if (!produce) continue;
        for (const season of recipe.seasons) {
          const available = SEASON_MONTHS[season].some((m) => produce.months.includes(m));
          expect(available, `${recipe.id} : ${ingredient.name} en ${season}`).toBe(true);
        }
      }
    }
  });
});

describe('quotas du quiz', () => {
  it('au moins 300 questions, dont 15 à 25 % de culture culinaire', () => {
    expect(quiz.length).toBeGreaterThanOrEqual(300);
    const share = quiz.filter((q) => q.category === 'cuisine').length / quiz.length;
    expect(share).toBeGreaterThanOrEqual(0.15);
    expect(share).toBeLessThanOrEqual(0.25);
  });

  it('toutes les catégories sont représentées', () => {
    for (const category of QUIZ_CATEGORIES) {
      expect(
        quiz.some((q) => q.category === category),
        category,
      ).toBe(true);
    }
  });
});

// ------------------------------------------------------------------ Intégration menu

const BASE_PROFILE: Profile = {
  age: 35,
  sex: 'femme',
  heightCm: 165,
  weightKg: 62,
  activity: 'leger',
  goal: 'reequilibrer',
  diets: [],
  allergens: [],
  likes: [],
  dislikes: [],
  householdSize: 2,
  weekdayMinutes: 30,
  weekendMinutes: 120,
  weekdayLevel: 'simple',
  weekendLevel: 'medium',
  breakfast: true,
  batchCooking: false,
  pregnantOrBreastfeeding: false,
};
/** Un lundi par saison. */
const WEEKS = ['2026-03-16', '2026-07-13', '2026-10-12', '2027-01-11'] as const;

function subset<T>(items: readonly T[], probability: number, rng: Rng): T[] {
  return items.filter(() => rng() < probability);
}

describe('menu de la semaine sur les vraies recettes', () => {
  it('50 profils aléatoires (graine fixe) : jamais d’allergène, de régime ou de cru/alcool violé', () => {
    const rng = createSeededRng(2026);
    const levels: readonly Level[] = LEVELS;
    let checked = 0;
    for (let i = 0; i < 50; i += 1) {
      const profile: Profile = {
        ...BASE_PROFILE,
        allergens: subset<Allergen>(ALLERGENS, 0.2, rng),
        diets: subset<Diet>(DIETS, 0.2, rng),
        weekdayLevel: levels[Math.floor(rng() * 3)] ?? 'simple',
        weekendLevel: levels[Math.floor(rng() * 3)] ?? 'medium',
        weekdayMinutes: 15 + Math.floor(rng() * 45),
        breakfast: rng() < 0.5,
        pregnantOrBreastfeeding: rng() < 0.2,
      };
      const plan = generateWeeklyPlan({
        profile,
        recipes,
        startDate: WEEKS[i % WEEKS.length] ?? '2026-11-23',
        rng: createSeededRng(i),
      });
      for (const meal of plan.meals) {
        const recipe = byId.get(meal.recipeId);
        expect(recipe).toBeDefined();
        if (!recipe) continue;
        const context = `${recipe.id} / ${profile.allergens.join()} / ${profile.diets.join()}`;
        expect(containsAllergen(recipe, profile.allergens), context).toBe(false);
        expect(matchesDiets(recipe, profile.diets), context).toBe(true);
        if (profile.pregnantOrBreastfeeding) {
          expect(
            PREGNANCY_EXCLUDED_TAGS.some((t) => recipe.tags.includes(t)),
            context,
          ).toBe(false);
        }
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  const COMMON: readonly (readonly [string, readonly Diet[]])[] = [
    ['omnivore', ['omnivore']],
    ['végétarien', ['vegetarien']],
    ['vegan', ['vegan']],
    ['sans gluten', ['sans-gluten']],
  ];
  /** Temps par repas cohérent avec le niveau demandé (médium : jusqu'à 45 min). */
  const MINUTES: Readonly<Record<Level, number>> = { simple: 30, medium: 45, experiment: 120 };
  const SCHEDULES: readonly (readonly [Level, Level])[] = [
    ['simple', 'medium'],
    ['simple', 'experiment'],
    ['medium', 'experiment'],
  ];

  it.each(COMMON)(
    'profil courant %s : tous les créneaux remplis, sans doublon ni changement de niveau',
    (_label, diets) => {
      for (const [weekdayLevel, weekendLevel] of SCHEDULES) {
        WEEKS.forEach((startDate, seed) => {
          const profile: Profile = {
            ...BASE_PROFILE,
            diets,
            weekdayLevel,
            weekendLevel,
            weekdayMinutes: MINUTES[weekdayLevel],
            weekendMinutes: MINUTES[weekendLevel],
          };
          const plan = generateWeeklyPlan({
            profile,
            recipes,
            startDate,
            rng: createSeededRng(seed),
          });
          const context = `${diets.join()} ${weekdayLevel}/${weekendLevel} ${startDate}`;
          expect(plan.meals, context).toHaveLength(21);
          const cooked = plan.meals.filter((m) => m.slot !== 'petit-dejeuner' && !m.isLeftover);
          const ids = cooked.map((m) => m.recipeId);
          expect(new Set(ids).size, context).toBe(ids.length);
          for (const meal of plan.meals) {
            expect(meal.relaxed, `${context} ${meal.id}`).not.toContain('niveau');
            expect(meal.relaxed, `${context} ${meal.id}`).not.toContain('doublon');
          }
        });
      }
    },
  );
});
