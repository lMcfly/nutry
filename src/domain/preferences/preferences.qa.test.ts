/**
 * QA phase 2 — avis 👍/👎 : effet visible et explicable sur le menu suivant, poids bornés,
 * « trop copieux » plafonné, indépendance de l'ordre.
 */
import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../shared';
import { FIXTURE_RECIPES, fixture, makeProfile } from '../testing/fixtures';
import { explainMeal, generateWeeklyPlan, rankRecipes } from '../mealplan';
import { computePortionFactor } from '../profile';
import { LEARNING_RULES, learnWeights, ratingScore } from './index';
import type { MealRating } from './index';

const at = (n: number) => `2026-11-${String(n).padStart(2, '0')}T12:00:00.000Z`;
const up = (recipeId: string, n = 1): MealRating => ({ recipeId, verdict: 'up', ratedAt: at(n) });
const down = (recipeId: string, reason?: MealRating['reason'], n = 1): MealRating => ({
  recipeId,
  verdict: 'down',
  ...(reason ? { reason } : {}),
  ratedAt: at(n),
});
const many = (n: number, f: (i: number) => MealRating) => Array.from({ length: n }, (_, i) => f(i));

describe('QA apprentissage : poids bornés, sans dérive', () => {
  it('1 000 👎 ou 👍 restent bornés (recette ±6, protéine ±2, étiquette ±1)', () => {
    const r = fixture('poulet-roti-legumes');
    const neg = learnWeights(
      many(1000, () => down(r.id)),
      FIXTURE_RECIPES,
    );
    expect(neg.recipes.get(r.id)).toBe(-6);
    expect(neg.proteins.get('volaille')).toBe(-2);
    for (const tag of r.tags) expect(neg.tags.get(tag)).toBe(-1);
    const pos = learnWeights(
      many(1000, () => up(r.id)),
      FIXTURE_RECIPES,
    );
    expect(pos.recipes.get(r.id)).toBe(6);
    expect(pos.proteins.get('volaille')).toBe(2);
    // Score « notes » borné : 6 + 2 + 1 par étiquette, malus « long » 0.
    expect(ratingScore(r, pos).total).toBe(6 + 2 + r.tags.length);
  });

  it('« trop copieux » : ×0,95 par avis, plafonné à 0,8, et facteur final jamais sous 0,8', () => {
    const r = fixture('chili-sin-carne');
    const one = learnWeights([down(r.id, 'trop-copieux')], FIXTURE_RECIPES);
    expect(one.portionMultiplier).toBeCloseTo(0.95, 12);
    const four = learnWeights(
      many(4, () => down(r.id, 'trop-copieux')),
      FIXTURE_RECIPES,
    );
    expect(four.portionMultiplier).toBeCloseTo(0.95 ** 4, 12);
    const lots = learnWeights(
      many(500, () => up(r.id)).map((x) => ({ ...x, reason: 'trop-copieux' as const })),
      FIXTURE_RECIPES,
    );
    expect(lots.portionMultiplier).toBe(LEARNING_RULES.portionMin);
    expect(computePortionFactor(3000, lots.portionMultiplier)).toBeGreaterThanOrEqual(0.8);
    expect(computePortionFactor(1200, lots.portionMultiplier)).toBe(0.8);
  });

  it('« trop long » : malus plafonné à 3, seulement au-delà de 30 min', () => {
    const w = learnWeights(
      many(10, () => down('x', 'trop-long')),
      FIXTURE_RECIPES,
    );
    expect(w.longRecipePenalty).toBe(3);
    expect(ratingScore(fixture('tajine-agneau'), w).longPenalty).toBe(-3); // 80 min
    expect(ratingScore(fixture('saumon-haricots-verts'), w).longPenalty).toBe(0); // 17 min
  });

  it('indépendant de l’ordre des avis', () => {
    const ratings = [
      up('dahl-lentilles-corail'),
      down('dahl-lentilles-corail', 'pas-aime'),
      up('chili-sin-carne'),
      down('porc-moutarde', 'trop-long'),
      down('chili-sin-carne', 'trop-copieux'),
    ];
    const a = learnWeights(ratings, FIXTURE_RECIPES);
    const b = learnWeights([...ratings].reverse(), FIXTURE_RECIPES);
    expect([...a.recipes].sort()).toEqual([...b.recipes].sort());
    expect([...a.proteins].sort()).toEqual([...b.proteins].sort());
    expect([...a.tags].sort()).toEqual([...b.tags].sort());
    expect(a.portionMultiplier).toBe(b.portionMultiplier);
  });
});

describe('QA apprentissage : effet visible sur le menu suivant', () => {
  const profile = makeProfile({ weekdayLevel: 'simple', weekendLevel: 'simple' });
  const START = '2026-11-23';
  const generate = (ratings: MealRating[], seed: number) =>
    generateWeeklyPlan({
      profile,
      recipes: FIXTURE_RECIPES,
      startDate: START,
      rng: createSeededRng(seed),
      weights: learnWeights(ratings, FIXTURE_RECIPES),
    });

  it('un 👎 « pas aimé » déloge le plat de sa place, avec −3,75 points au moins', () => {
    // Le 👎 reste une préférence (score), pas un filtre : avec un petit catalogue, le plat
    // peut revenir plus tard dans la semaine (voir rapport QA).
    for (const seed of [1, 2, 3, 4, 5]) {
      const before = generate([], seed);
      const first = before.meals[0];
      if (!first) throw new Error('vide');
      const after = generate([down(first.recipeId, 'pas-aime')], seed);
      expect(after.meals[0]?.recipeId, `graine ${seed}`).not.toBe(first.recipeId);
      for (const m of after.meals.filter((x) => x.recipeId === first.recipeId && !x.isLeftover)) {
        expect(m.score.components.find((c) => c.key === 'notes')?.points).toBeLessThanOrEqual(
          -3.75,
        );
      }
    }
  });

  it('un 👍 fait entrer un plat absent dans le menu suivant et l’explique', () => {
    for (const seed of [1, 2, 3]) {
      const before = generate([], seed);
      const absent = FIXTURE_RECIPES.find(
        (r) =>
          r.level === 'simple' &&
          !r.tags.includes('petit-dejeuner') &&
          r.prepMinutes + r.cookMinutes <= 30 &&
          !before.meals.some((m) => m.recipeId === r.id),
      );
      if (!absent) continue;
      const ratings = [up(absent.id, 1), up(absent.id, 2)];
      const after = generate(ratings, seed);
      const planned = after.meals.find((m) => m.recipeId === absent.id && !m.isLeftover);
      expect(planned, `graine ${seed} : ${absent.id}`).toBeDefined();
      if (planned) expect(explainMeal(planned)).toMatch(/tu avais aimé ce plat/);
    }
  });

  it('le classement reflète la composante « notes » de façon lisible', () => {
    const ctx = {
      likes: [],
      batchCooking: false,
      date: START,
      availableMinutes: 30,
      weekend: false,
    };
    const base = rankRecipes(FIXTURE_RECIPES, ctx);
    const last = base.at(-1)?.recipe.id ?? '';
    const weights = learnWeights([up(last), up(last), up(last)], FIXTURE_RECIPES);
    const after = rankRecipes(FIXTURE_RECIPES, { ...ctx, weights });
    const before = base.find((r) => r.recipe.id === last);
    const now = after.find((r) => r.recipe.id === last);
    const notes = now?.score.components.find((c) => c.key === 'notes')?.points ?? 0;
    expect(notes).toBeGreaterThanOrEqual(6);
    expect((now?.score.total ?? 0) - (before?.score.total ?? 0)).toBeCloseTo(notes, 9);
    expect(after.findIndex((r) => r.recipe.id === last)).toBeLessThan(base.length - 1);
  });
});
