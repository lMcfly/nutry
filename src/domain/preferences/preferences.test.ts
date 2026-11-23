import { describe, expect, it } from 'vitest';
import { FIXTURE_RECIPES, fixture } from '../testing/fixtures';
import {
  LEARNING_RULES,
  NEUTRAL_WEIGHTS,
  RATING_REASONS,
  favoriteRecipeIds,
  learnWeights,
  ratingScore,
} from './index';
import type { MealRating } from './index';

const at = (day: number) => `2026-11-${String(day).padStart(2, '0')}T19:00:00.000Z`;
const rate = (
  recipeId: string,
  verdict: 'up' | 'down',
  extra: Partial<MealRating> = {},
): MealRating => ({
  recipeId,
  verdict,
  ratedAt: at(10),
  ...extra,
});

describe('apprentissage des avis', () => {
  it('liste les raisons possibles', () => {
    expect(RATING_REASONS).toEqual(['trop-long', 'pas-aime', 'trop-copieux', 'autre']);
  });

  it('est neutre sans avis', () => {
    const w = learnWeights([], FIXTURE_RECIPES);
    expect(w.recipes.size).toBe(0);
    expect(w.longRecipePenalty).toBe(0);
    expect(w.portionMultiplier).toBe(1);
    expect(ratingScore(fixture('dahl-lentilles-corail'), NEUTRAL_WEIGHTS).total).toBe(0);
  });

  it('👍 : bonus recette, protéine et étiquettes', () => {
    const w = learnWeights([rate('chili-sin-carne', 'up')], FIXTURE_RECIPES);
    expect(w.recipes.get('chili-sin-carne')).toBe(2);
    expect(w.proteins.get('legumineuses')).toBe(0.5);
    expect(w.tags.get('batch')).toBe(0.25);
    const s = ratingScore(fixture('chili-sin-carne'), w);
    expect(s).toEqual({ recipe: 2, protein: 0.5, tags: 0.75, longPenalty: 0, total: 3.25 });
  });

  it.each([undefined, 'pas-aime', 'autre'] as const)('👎 (%s) : malus de goût', (reason) => {
    const w = learnWeights(
      [rate('saumon-haricots-verts', 'down', reason ? { reason } : {})],
      FIXTURE_RECIPES,
    );
    expect(w.recipes.get('saumon-haricots-verts')).toBe(-3);
    expect(w.proteins.get('poisson')).toBe(-0.75);
    expect(w.tags.get('rapide')).toBe(-0.25);
  });

  it('« trop long » : malus léger sur le plat et pénalité des recettes longues', () => {
    const w = learnWeights(
      [rate('tajine-agneau', 'down', { reason: 'trop-long' })],
      FIXTURE_RECIPES,
    );
    expect(w.recipes.get('tajine-agneau')).toBe(-1);
    expect(w.proteins.has('agneau')).toBe(false);
    expect(w.longRecipePenalty).toBe(1);
    expect(ratingScore(fixture('boeuf-carottes'), w).longPenalty).toBe(-1);
    expect(ratingScore(fixture('dahl-lentilles-corail'), w).longPenalty).toBe(0);
  });

  it('« trop copieux » : −5 % de portion par avis, jamais sous 0,8, même avec un 👍', () => {
    const once = learnWeights(
      [rate('dahl-lentilles-corail', 'up', { reason: 'trop-copieux' })],
      FIXTURE_RECIPES,
    );
    expect(once.portionMultiplier).toBeCloseTo(0.95, 10);
    const many = Array.from({ length: 10 }, () =>
      rate('dahl-lentilles-corail', 'down', { reason: 'trop-copieux' }),
    );
    expect(learnWeights(many, FIXTURE_RECIPES).portionMultiplier).toBe(LEARNING_RULES.portionMin);
  });

  it('borne les poids et plafonne la pénalité de durée', () => {
    const many = Array.from({ length: 10 }, () =>
      rate('tajine-agneau', 'down', { reason: 'trop-long' }),
    );
    const downs = Array.from({ length: 10 }, () => rate('saumon-haricots-verts', 'down'));
    const w = learnWeights([...many, ...downs], FIXTURE_RECIPES);
    expect(w.recipes.get('tajine-agneau')).toBe(-6);
    expect(w.recipes.get('saumon-haricots-verts')).toBe(-6);
    expect(w.proteins.get('poisson')).toBe(-2);
    expect(w.tags.get('rapide')).toBe(-1);
    expect(w.longRecipePenalty).toBe(3);
  });

  it('ignore la protéine et les étiquettes d’une recette inconnue', () => {
    const w = learnWeights([rate('disparue', 'up')], FIXTURE_RECIPES);
    expect(w.recipes.get('disparue')).toBe(2);
    expect(w.proteins.size).toBe(0);
  });

  it('un 👍 après un 👎 fait remonter le plat', () => {
    const down = learnWeights([rate('dahl-lentilles-corail', 'down')], FIXTURE_RECIPES);
    const both = learnWeights(
      [rate('dahl-lentilles-corail', 'down'), rate('dahl-lentilles-corail', 'up')],
      FIXTURE_RECIPES,
    );
    const recipe = fixture('dahl-lentilles-corail');
    expect(ratingScore(recipe, both).total).toBeGreaterThan(ratingScore(recipe, down).total);
  });
});

describe('favoris déduits des 👍', () => {
  it('garde les recettes au solde positif, triées par solde puis récence', () => {
    const ratings: MealRating[] = [
      rate('a', 'up', { ratedAt: at(1) }),
      rate('b', 'up', { ratedAt: at(2) }),
      rate('b', 'up', { ratedAt: at(3) }),
      rate('c', 'up', { ratedAt: at(5) }),
      rate('d', 'up', { ratedAt: at(4) }),
      rate('d', 'down', { ratedAt: at(6) }),
      rate('e', 'down', { ratedAt: at(6) }),
      rate('f', 'up', { ratedAt: at(1) }),
    ];
    expect(favoriteRecipeIds(ratings)).toEqual(['b', 'c', 'a', 'f']);
    expect(favoriteRecipeIds([])).toEqual([]);
  });

  it('retient le 👍 le plus récent quel que soit l’ordre', () => {
    const ratings: MealRating[] = [
      rate('x', 'up', { ratedAt: at(9) }),
      rate('x', 'up', { ratedAt: at(2) }),
      rate('y', 'up', { ratedAt: at(5) }),
      rate('y', 'up', { ratedAt: at(5) }),
    ];
    expect(favoriteRecipeIds(ratings)).toEqual(['x', 'y']);
  });
});
