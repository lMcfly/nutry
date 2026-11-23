import { describe, expect, it } from 'vitest';
import { fixture, ing, makeRecipe } from '../testing/fixtures';
import { computePortionFactor, factorForCategory, scaleRecipeForHousehold } from './index';

describe('facteur de portion', () => {
  it('vaut cible / 2000, borné à [0,8 ; 1,3]', () => {
    expect(computePortionFactor(2000)).toBe(1);
    expect(computePortionFactor(2200)).toBeCloseTo(1.1, 10);
    expect(computePortionFactor(1200)).toBe(0.8);
    expect(computePortionFactor(3500)).toBe(1.3);
  });

  it('intègre l’ajustement appris sans passer sous 0,8', () => {
    expect(computePortionFactor(2000, 0.95)).toBeCloseTo(0.95, 10);
    expect(computePortionFactor(1700, 0.9)).toBe(0.8);
  });

  it('ne réduit jamais les légumes et laisse les condiments inchangés', () => {
    expect(factorForCategory('legume', 0.8)).toBe(1);
    expect(factorForCategory('legume', 1.2)).toBe(1.2);
    expect(factorForCategory('proteine-feculent', 0.8)).toBe(0.8);
    expect(factorForCategory('condiment', 1.3)).toBe(1);
  });
});

describe('quantités pour le foyer', () => {
  const recipe = makeRecipe({
    id: 'r',
    servings: 2,
    ingredients: [
      ing('riz complet', 200, 'g', 'epicerie'),
      ing('courgettes', 2, 'piece', 'fruits-legumes'),
      ing('sel', 2, 'pincee', 'epicerie'),
    ],
  });

  it('ajuste la part de l’utilisateur, les autres membres comptent pour 1', () => {
    const scaled = scaleRecipeForHousehold(recipe, { userFactor: 0.8, householdSize: 3 });
    // riz : 100 g/portion × (0,8 + 2) ; courgettes : 1 × (1 + 2) ; sel : 1 × (1 + 2)
    expect(scaled.map((i) => i.quantity)).toEqual([280, 3, 3]);
    expect(scaled[0]?.name).toBe('riz complet');
  });

  it('augmente protéines, féculents et légumes pour un grand facteur', () => {
    const scaled = scaleRecipeForHousehold(recipe, { userFactor: 1.3, householdSize: 1 });
    expect(scaled.map((i) => i.quantity)).toEqual([130, 1.3, 1]);
  });

  it('multiplie par le nombre de repas couverts (restes)', () => {
    const scaled = scaleRecipeForHousehold(fixture('chili-sin-carne'), {
      userFactor: 1,
      householdSize: 2,
      batches: 2,
    });
    // haricots rouges : 2 boîtes / 4 portions × 2 personnes × 2 repas
    expect(scaled[0]?.quantity).toBe(2);
  });

  it('traite un foyer invalide comme une personne seule', () => {
    const scaled = scaleRecipeForHousehold(recipe, { userFactor: 1, householdSize: 0 });
    expect(scaled[0]?.quantity).toBe(100);
  });
});
