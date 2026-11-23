import { describe, expect, it } from 'vitest';
import { FIXTURE_RECIPES, ing, makeRecipe } from '../testing/fixtures';
import {
  ALLERGENS,
  ALLERGEN_KEYWORDS,
  allergensInIngredient,
  auditRecipe,
  checkAllergenDeclarations,
} from './index';

describe('mots-clés d’allergènes', () => {
  it('couvre les 14 allergènes', () => {
    expect(Object.keys(ALLERGEN_KEYWORDS).sort()).toEqual([...ALLERGENS].sort());
  });

  it.each([
    ['beurre doux', ['lait']],
    ['crème fraîche épaisse', ['lait']],
    ['Mozzarella di bufala', ['lait']],
    ['comté râpé', ['lait']],
    ['lait de coco', []],
    ['lait d’amande', ['fruits-a-coque']],
    ['lait de soja', ['soja']],
    ['beurre de cacahuète', ['arachides']],
    ['farine de blé', ['gluten']],
    ['farine de riz', []],
    ['farine de sarrasin', []],
    ['pâtes complètes', ['gluten']],
    ['pâte de curry', []],
    ['pâte feuilletée', ['gluten']],
    ['chapelure', ['gluten']],
    ['sauce soja', ['gluten', 'soja']],
    ['sauce tamari', ['soja']],
    ['flocons d’avoine', ['gluten']],
    ['blé noir', []],
    ['jaunes d’œufs', ['oeufs']],
    ['mayonnaise', ['oeufs']],
    ['tofu fumé', ['soja']],
    ['germes de soja', []],
    ['tahini', ['sesame']],
    ['huile de sésame', ['sesame']],
    ['noix de cajou', ['fruits-a-coque']],
    ['noix de coco râpée', []],
    ['noix de Saint-Jacques', ['mollusques']],
    ['cacahuètes grillées', ['arachides']],
    ['moutarde à l’ancienne', ['moutarde']],
    ['cube de bouillon', ['celeri']],
    ['céleri-rave', ['celeri']],
    ['vin blanc sec', ['sulfites']],
    ['vinaigre de vin', ['sulfites']],
    ['vinaigre de cidre', []],
    ['raisins secs', ['sulfites']],
    ['filets d’anchois', ['poissons']],
    ['crevettes roses', ['crustaces']],
    ['calamars', ['mollusques']],
    ['farine de lupin', ['lupin']],
    ['courgette', []],
  ] as const)('%s → %o', (name, expected) => {
    expect(allergensInIngredient(name).sort()).toEqual([...expected].sort());
  });
});

describe('audit : allergène non déclaré', () => {
  it('signale une ERREUR pour chaque allergène révélé par un ingrédient mais non déclaré', () => {
    const recipe = makeRecipe({
      id: 'gratin',
      ingredients: [ing('crème fraîche', 20, 'cl', 'frais'), ing('chapelure', 30, 'g', 'epicerie')],
    });
    const issues = checkAllergenDeclarations(recipe);
    expect(issues.map((i) => [i.code, i.severity])).toEqual([
      ['allergene-non-declare', 'erreur'],
      ['allergene-non-declare', 'erreur'],
    ]);
    expect(issues[0]?.message).toContain('lait');
    expect(checkAllergenDeclarations({ ...recipe, allergens: ['lait', 'gluten'] })).toEqual([]);
    expect(auditRecipe(recipe).filter((i) => i.code === 'allergene-non-declare')).toHaveLength(2);
  });

  it('accepte une déclaration plus large que les mots-clés (pignons → fruits à coque)', () => {
    const pesto = makeRecipe({
      id: 'p',
      allergens: ['fruits-a-coque'],
      ingredients: [ing('pignons de pin', 20, 'g', 'epicerie')],
    });
    expect(checkAllergenDeclarations(pesto)).toEqual([]);
  });

  it('les fixtures sont toutes cohérentes', () => {
    for (const recipe of FIXTURE_RECIPES)
      expect(checkAllergenDeclarations(recipe), recipe.id).toEqual([]);
  });
});
