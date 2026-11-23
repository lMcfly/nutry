import { describe, expect, it } from 'vitest';
import { SEASONS } from '../season';
import { AISLES, ALLERGENS, DIETS, LEVELS, PROTEIN_TYPES, UNITS } from './recipe.constants';

const KEBAB_ASCII = /^[a-z]+(?:-[a-z]+)*$/;

describe('vocabulaires du domaine', () => {
  it.each([
    ['LEVELS', LEVELS],
    ['DIETS', DIETS],
    ['ALLERGENS', ALLERGENS],
    ['PROTEIN_TYPES', PROTEIN_TYPES],
    ['UNITS', UNITS],
    ['AISLES', AISLES],
    ['SEASONS', SEASONS],
  ])('%s : identifiants ASCII kebab-case et uniques', (_name, values) => {
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) expect(value).toMatch(KEBAB_ASCII);
  });

  it('liste exactement les 14 allergènes réglementaires UE', () => {
    expect(ALLERGENS).toHaveLength(14);
  });

  it('propose les 3 niveaux et les 6 régimes du cahier des charges', () => {
    expect(LEVELS).toEqual(['simple', 'medium', 'experiment']);
    expect(DIETS).toEqual([
      'omnivore',
      'flexitarien',
      'vegetarien',
      'vegan',
      'sans-gluten',
      'sans-lactose',
    ]);
  });
});
