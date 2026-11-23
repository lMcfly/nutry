import { describe, expect, it } from 'vitest';
import type { Recipe } from '../../src/domain/recipe';
import { UNITS } from '../../src/domain/recipe';
import recipesJson from '../../src/infrastructure/data/recipes.json';
import { recipesFileSchema } from '../../src/infrastructure/data/schemas';
import {
  MASS_UNITS,
  computeNutritionPerServing,
  describeIssue,
  findNutritionIssues,
  indexCiqual,
  ingredientGrams,
  isIncompleteFood,
  loadNutritionSources,
  roundGrams,
  sameNutrition,
  withComputedNutrition,
} from './compute';
import type { CiqualFood, IngredientMappingFile } from './compute';

const recipes = recipesFileSchema.parse(recipesJson);
const { foods, mappings } = await loadNutritionSources();

const food = (code: string, kcal: number, p = 0, g = 0, l = 0, f = 0): CiqualFood => ({
  code,
  nom: code,
  groupe: 'test',
  kcal,
  proteinesG: p,
  glucidesG: g,
  lipidesG: l,
  fibresG: f,
});
const recipe = (ingredients: Recipe['ingredients'], servings = 2): Recipe => ({
  ...(recipes[0] as Recipe),
  id: 'test',
  servings,
  ingredients,
});

describe('pipeline nutritionnel Ciqual (données réelles)', () => {
  it('chaque ingrédient des recettes a une correspondance, un code existant et une conversion', () => {
    const issues = findNutritionIssues(recipes, mappings, foods);
    expect(issues.map(describeIssue)).toEqual([]);
  });

  it('aucune correspondance inutilisée (la table reste le reflet des recettes)', () => {
    const used = new Set(recipes.flatMap((r) => r.ingredients.map((i) => i.name)));
    expect(Object.keys(mappings).filter((name) => !used.has(name))).toEqual([]);
  });

  it('les conversions ne portent que sur des unités du vocabulaire, non massiques', () => {
    for (const [name, mapping] of Object.entries(mappings)) {
      for (const unit of Object.keys(mapping.gramsPerUnit ?? {})) {
        expect(UNITS as readonly string[], `${name} / ${unit}`).toContain(unit);
        expect(Object.keys(MASS_UNITS), `${name} / ${unit}`).not.toContain(unit);
      }
    }
  });

  it('les valeurs de recipes.json sont exactement celles du recalcul (npm run nutrition:write)', () => {
    const stale = withComputedNutrition(recipes, mappings, foods)
      .filter(
        (r, i) =>
          !sameNutrition(
            r.nutritionPerServing,
            recipes[i]?.nutritionPerServing ?? r.nutritionPerServing,
          ),
      )
      .map((r) => r.id);
    expect(stale).toEqual([]);
  });
});

describe('fonctions de calcul', () => {
  const table = indexCiqual([
    food('1', 100, 10, 5, 2, 1),
    food('2', 900, 0, 0, 100, 0),
    food('3', 0, 0, 10, 0, 0),
  ]);
  const huile = { ciqualCode: '2', gramsPerUnit: { 'cuillere-soupe': 14 } };
  const moules = { ciqualCode: '1', ediblePortion: 0.25 };
  const map: IngredientMappingFile = {
    riz: { ciqualCode: '1' },
    huile,
    moules,
    fantome: { ciqualCode: '999' },
    incomplet: { ciqualCode: '3' },
  };

  it('convertit masse, unités non massiques et part comestible', () => {
    expect(
      ingredientGrams(
        { name: 'riz', quantity: 1.5, unit: 'kg', aisle: 'epicerie' },
        { ciqualCode: '1' },
      ),
    ).toBe(1500);
    expect(
      ingredientGrams(
        { name: 'huile', quantity: 2, unit: 'cuillere-soupe', aisle: 'epicerie' },
        huile,
      ),
    ).toBe(28);
    expect(
      ingredientGrams({ name: 'moules', quantity: 2, unit: 'kg', aisle: 'frais' }, moules),
    ).toBe(500);
    expect(
      ingredientGrams({ name: 'huile', quantity: 1, unit: 'cl', aisle: 'epicerie' }, huile),
    ).toBeUndefined();
  });

  it('calcule par portion et arrondit (kcal à l’unité, grammes à 0,1 g)', () => {
    const r = recipe([
      { name: 'riz', quantity: 150, unit: 'g', aisle: 'epicerie' },
      { name: 'huile', quantity: 1, unit: 'cuillere-soupe', aisle: 'epicerie' },
    ]);
    expect(computeNutritionPerServing(r, map, table)).toEqual({
      kcal: 138,
      proteinG: 7.5,
      carbsG: 3.8,
      fatG: 8.5,
      fiberG: 0.8,
    });
    expect(roundGrams(0.1 + 0.2)).toBe(0.3);
  });

  it('signale ingrédient non mappé, code inconnu, fiche incomplète et unité sans conversion', () => {
    const r = recipe([
      { name: 'inconnu', quantity: 1, unit: 'g', aisle: 'epicerie' },
      { name: 'huile', quantity: 1, unit: 'cl', aisle: 'epicerie' },
    ]);
    const kinds = findNutritionIssues([r], map, table)
      .map((i) => i.kind)
      .sort();
    expect(kinds).toEqual([
      'code-ciqual-inconnu',
      'fiche-ciqual-incomplete',
      'ingredient-non-mappe',
      'unite-sans-conversion',
    ]);
    for (const issue of findNutritionIssues([r], map, table))
      expect(describeIssue(issue)).not.toBe('');
    expect(() => computeNutritionPerServing(r, map, table)).toThrow(/inconnu/);
  });

  it('une énergie nulle n’est acceptée que pour l’eau', () => {
    expect(isIncompleteFood(food('3', 0, 0, 10))).toBe(true);
    expect(isIncompleteFood(food('18066', 0))).toBe(false);
    expect(isIncompleteFood(food('4', 0))).toBe(false);
  });
});
