import { describe, expect, it } from 'vitest';
import { FIXTURE_RECIPES, fixture } from '../testing/fixtures';
import { learnWeights } from '../preferences';
import type { MealRating } from '../preferences';
import { SCORE_RULES, isConsecutiveProtein, rankRecipes, scoreRecipe } from './index';
import type { ScoringContext } from './index';

const ctx: ScoringContext = {
  likes: [],
  batchCooking: false,
  date: '2026-11-23',
  availableMinutes: 30,
  weekend: false,
};
const points = (score: ReturnType<typeof scoreRecipe>, key: string) =>
  score.components.find((c) => c.key === key)?.points;

describe('scoreRecipe', () => {
  it('somme des composantes nommées', () => {
    const s = scoreRecipe(fixture('dahl-lentilles-corail'), ctx);
    expect(s.components.map((c) => c.key)).toEqual([
      'aime',
      'notes',
      'saison',
      'temps',
      'niveau',
      'variete',
    ]);
    expect(s.total).toBeCloseTo(
      s.components.reduce((sum, c) => sum + c.points, 0),
      10,
    );
  });

  it('aliments aimés : +2 par terme, plafonné à +4', () => {
    const saumon = fixture('saumon-haricots-verts');
    expect(points(scoreRecipe(saumon, { ...ctx, likes: ['saumon'] }), 'aime')).toBe(2);
    const s = scoreRecipe(saumon, { ...ctx, likes: ['saumon', 'citron', 'riz', 'poulet'] });
    expect(points(s, 'aime')).toBe(SCORE_RULES.likeMax);
    expect(s.facts.likedTerms).toEqual(['saumon', 'citron', 'riz']);
  });

  it('saison : recette de saison et produits du mois', () => {
    // 23 novembre = automne : recette de saison, mais haricots verts (juin-sept.) hors saison.
    const saumon = scoreRecipe(fixture('saumon-haricots-verts'), ctx);
    expect(saumon.facts.seasonMatch).toBe(true);
    expect(saumon.facts.seasonalProduce).toEqual([]);
    expect(points(saumon, 'saison')).toBe(1.5);
    const summer = scoreRecipe(fixture('saumon-haricots-verts'), { ...ctx, date: '2026-07-01' });
    expect(summer.facts.seasonalProduce).toEqual(['haricots verts']);
    expect(points(summer, 'saison')).toBe(2);
    const gaspacho = scoreRecipe(fixture('gaspacho-pois-chiches'), ctx);
    // Recette d'été, tomates, concombre, poivron et ail hors saison en novembre.
    expect(points(gaspacho, 'saison')).toBe(0);
  });

  it('temps : bonus de rapidité, malus de dépassement, bonus batch en semaine', () => {
    const quick = scoreRecipe(fixture('salade-quinoa-lupin'), ctx);
    expect(points(quick, 'temps')).toBeCloseTo(1.5 * (1 - 10 / 30), 10);
    const long = scoreRecipe(fixture('tajine-agneau'), ctx);
    expect(points(long, 'temps')).toBe(SCORE_RULES.timeOverrun);
    expect(long.facts.fitsTime).toBe(false);
    expect(
      points(
        scoreRecipe(fixture('gaspacho-pois-chiches'), { ...ctx, availableMinutes: 0 }),
        'temps',
      ),
    ).toBe(-3);
    expect(
      points(scoreRecipe(fixture('salade-quinoa-lupin'), { ...ctx, availableMinutes: 0 }), 'temps'),
    ).toBe(-3);
    const noTime = { ...ctx, availableMinutes: 0 };
    const instant = { ...fixture('gaspacho-pois-chiches'), prepMinutes: 0 };
    expect(points(scoreRecipe(instant, noTime), 'temps')).toBe(0);
    const batch = { ...ctx, batchCooking: true };
    const dahl = fixture('dahl-lentilles-corail');
    expect(points(scoreRecipe(dahl, batch), 'temps')).toBeCloseTo(1 + 1.5 * (1 - 20 / 30), 10);
    expect(scoreRecipe(dahl, batch).facts.batchFriendly).toBe(true);
    expect(points(scoreRecipe(dahl, { ...batch, weekend: true }), 'temps')).toBeCloseTo(0.5, 10);
  });

  it('niveau : +2 si conforme, −1 sinon, neutre sans niveau demandé', () => {
    const dahl = fixture('dahl-lentilles-corail');
    expect(points(scoreRecipe(dahl, { ...ctx, desiredLevel: 'simple' }), 'niveau')).toBe(2);
    expect(points(scoreRecipe(dahl, { ...ctx, desiredLevel: 'medium' }), 'niveau')).toBe(-1);
    expect(points(scoreRecipe(dahl, ctx), 'niveau')).toBe(0);
  });

  it('variété : nouvelle protéine, répétition et protéine consécutive', () => {
    const dahl = fixture('dahl-lentilles-corail');
    expect(points(scoreRecipe(dahl, ctx), 'variete')).toBe(1);
    const counts = new Map([['legumineuses', 2]] as const);
    expect(points(scoreRecipe(dahl, { ...ctx, proteinCounts: counts }), 'variete')).toBe(-1);
    expect(points(scoreRecipe(dahl, { ...ctx, previousProtein: 'legumineuses' }), 'variete')).toBe(
      -3,
    );
    expect(isConsecutiveProtein('aucune', 'aucune')).toBe(false);
    expect(isConsecutiveProtein('poisson', 'poisson')).toBe(true);
    expect(isConsecutiveProtein('poisson', undefined)).toBe(false);
  });

  it('ajoute une composante « hasard » bornée quand un tirage est fourni', () => {
    const s = scoreRecipe(fixture('dahl-lentilles-corail'), { ...ctx, jitter: 0.999 });
    expect(points(s, 'hasard')).toBeLessThan(SCORE_RULES.jitterMax);
  });
});

describe('apprentissage : effet des avis sur le classement', () => {
  const pool = FIXTURE_RECIPES.filter(
    (r) => r.level === 'simple' && !r.tags.includes('petit-dejeuner'),
  );
  const rankOf = (id: string, ratings: MealRating[]) =>
    rankRecipes(pool, { ...ctx, weights: learnWeights(ratings, FIXTURE_RECIPES) }).findIndex(
      (r) => r.recipe.id === id,
    );
  const rating = (recipeId: string, verdict: 'up' | 'down'): MealRating => ({
    recipeId,
    verdict,
    ratedAt: '2026-11-20T20:00:00.000Z',
  });

  it('après un 👎, la recette et sa protéine descendent dans le classement', () => {
    const before = rankOf('saumon-haricots-verts', []);
    const after = rankOf('saumon-haricots-verts', [rating('saumon-haricots-verts', 'down')]);
    expect(after).toBeGreaterThan(before);
    // Une autre recette à base de poisson recule aussi (poids par protéine).
    const all = FIXTURE_RECIPES.filter((r) => !r.tags.includes('petit-dejeuner'));
    const fishRank = (ratings: MealRating[]) =>
      rankRecipes(all, {
        ...ctx,
        availableMinutes: 60,
        weights: learnWeights(ratings, FIXTURE_RECIPES),
      }).findIndex((r) => r.recipe.id === 'cabillaud-papillote-fenouil');
    expect(fishRank([rating('saumon-haricots-verts', 'down')])).toBeGreaterThan(fishRank([]));
  });

  it('après un 👍, la recette remonte', () => {
    const before = rankOf('pates-pesto-courgettes', []);
    const after = rankOf('pates-pesto-courgettes', [rating('pates-pesto-courgettes', 'up')]);
    expect(after).toBeLessThan(before);
  });

  it('départage les égalités par identifiant', () => {
    const a = { ...fixture('dahl-lentilles-corail'), id: 'b-dahl' };
    const b = { ...fixture('dahl-lentilles-corail'), id: 'a-dahl' };
    expect(rankRecipes([a, b], ctx).map((r) => r.recipe.id)).toEqual(['a-dahl', 'b-dahl']);
  });
});
