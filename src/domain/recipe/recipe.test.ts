import { describe, expect, it } from 'vitest';
import { FIXTURE_RECIPES, fixture, ing, makeRecipe } from '../testing/fixtures';
import {
  ALLERGENS,
  PREGNANCY_EXCLUDED_TAGS,
  auditRecipe,
  categorizeIngredient,
  checkDietCompleteness,
  checkDietConsistency,
  checkLevel,
  checkNutrition,
  checkSafetyTags,
  containsAllergen,
  declaredAllergensIn,
  dislikedIn,
  filterCompatibleRecipes,
  isBasicIngredient,
  isBreakfastRecipe,
  isPregnancyRelevant,
  isRecipeCompatible,
  matchesDiets,
  recipeMentions,
  totalMinutes,
} from './index';

const none = { diets: [], allergens: [], dislikes: [] } as const;

describe('fixtures de test', () => {
  it('couvrent les 14 allergènes et passent l’audit sans aucun signalement', () => {
    const covered = new Set(FIXTURE_RECIPES.flatMap((r) => r.allergens));
    expect([...covered].sort()).toEqual([...ALLERGENS].sort());
    for (const recipe of FIXTURE_RECIPES) expect(auditRecipe(recipe), recipe.id).toEqual([]);
    expect(() => fixture('inconnue')).toThrow();
  });
});

describe('compatibilité', () => {
  it('détecte les allergènes déclarés', () => {
    const pesto = fixture('pates-pesto-courgettes');
    expect(containsAllergen(pesto, ['lait'])).toBe(true);
    expect(containsAllergen(pesto, ['poissons', 'soja'])).toBe(false);
    expect(containsAllergen(pesto, [])).toBe(false);
    expect(declaredAllergensIn(pesto, ['gluten', 'lait', 'oeufs'])).toEqual(['gluten', 'lait']);
  });

  it('exige TOUS les régimes de la personne', () => {
    const taboule = fixture('taboule-pois-chiches');
    expect(matchesDiets(taboule, [])).toBe(true);
    expect(matchesDiets(taboule, ['vegan'])).toBe(true);
    expect(matchesDiets(taboule, ['vegetarien', 'sans-gluten'])).toBe(false);
    expect(matchesDiets(fixture('dahl-lentilles-corail'), ['vegetarien', 'sans-gluten'])).toBe(
      true,
    );
  });

  it('exclut les aliments détestés (ingrédient ou protéine principale)', () => {
    const saumon = fixture('saumon-haricots-verts');
    expect(recipeMentions(saumon, 'Saumon')).toBe(true);
    expect(recipeMentions(saumon, 'poisson')).toBe(true);
    expect(recipeMentions(fixture('tofu-brocoli-sesame'), 'tofu')).toBe(true);
    expect(dislikedIn(saumon, ['haricot vert', 'poulet'])).toEqual(['haricot vert']);
    expect(isRecipeCompatible(saumon, { ...none, dislikes: ['citron'] })).toBe(false);
    expect(isRecipeCompatible(saumon, none)).toBe(true);
  });

  it('filtre un catalogue selon les trois filtres durs', () => {
    const result = filterCompatibleRecipes(FIXTURE_RECIPES, {
      diets: ['vegan'],
      allergens: ['gluten'],
      dislikes: ['tofu'],
    });
    expect(result.map((r) => r.id).sort()).toEqual([
      'chili-sin-carne',
      'dahl-lentilles-corail',
      'gaspacho-pois-chiches',
      'salade-quinoa-lupin',
      'soupe-poireaux-haricots',
    ]);
  });

  it('expose le temps total et le petit-déjeuner', () => {
    expect(totalMinutes(fixture('tajine-agneau'))).toBe(80);
    expect(isBreakfastRecipe(fixture('porridge-avoine-pomme'))).toBe(true);
    expect(isBreakfastRecipe(fixture('chili-sin-carne'))).toBe(false);
  });
});

describe('catégorie d’ingrédient (portions)', () => {
  it.each([
    [ing('sel', 1, 'pincee', 'epicerie'), 'condiment'],
    [ing('huile d’olive', 20, 'ml', 'epicerie'), 'condiment'],
    [ing('moutarde', 1, 'cuillere-soupe', 'epicerie'), 'condiment'],
    [ing('courgettes', 2, 'piece', 'fruits-legumes'), 'legume'],
    [ing('pommes de terre', 500, 'g', 'fruits-legumes'), 'proteine-feculent'],
    [ing('patate douce', 500, 'g', 'fruits-legumes'), 'proteine-feculent'],
    [ing('riz complet', 120, 'g', 'epicerie'), 'proteine-feculent'],
    [ing('pavé de saumon', 2, 'piece', 'boucherie-poissonnerie'), 'proteine-feculent'],
  ] as const)('%o → %s', (ingredient, category) => {
    expect(categorizeIngredient(ingredient)).toBe(category);
  });

  it('reconnaît les basiques du placard', () => {
    expect(isBasicIngredient('Sel fin')).toBe(true);
    expect(isBasicIngredient('eau')).toBe(true);
    expect(isBasicIngredient('veau')).toBe(false);
    expect(isBasicIngredient('poivron')).toBe(false);
  });
});

describe('cohérence régime ↔ allergènes', () => {
  const vegan = makeRecipe({ id: 'v', diets: ['omnivore', 'flexitarien', 'vegetarien', 'vegan'] });

  it('accepte une recette cohérente', () => {
    expect(checkDietConsistency(vegan)).toEqual([]);
  });

  it.each(['lait', 'oeufs', 'poissons', 'crustaces', 'mollusques'] as const)(
    'vegan ⇒ pas d’allergène %s',
    (allergen) => {
      const issues = checkDietConsistency({ ...vegan, allergens: [allergen] });
      expect(issues.map((i) => i.code)).toContain('regime-allergene');
      expect(issues.every((i) => i.severity === 'erreur')).toBe(true);
    },
  );

  it.each(['oeufs', 'fromage', 'volaille', 'poisson'] as const)(
    'vegan ⇒ protéine %s refusée',
    (mainProtein) => {
      expect(checkDietConsistency({ ...vegan, mainProtein }).map((i) => i.code)).toEqual([
        'regime-proteine',
      ]);
    },
  );

  it('vegan ⇒ ni miel ni chair animale dans les ingrédients', () => {
    const honey = { ...vegan, ingredients: [ing('miel', 1, 'cuillere-soupe', 'epicerie')] };
    expect(checkDietConsistency(honey).map((i) => i.code)).toEqual(['regime-ingredient']);
  });

  it('végétarien ⇒ ni produits de la mer, ni viande, ni gélatine', () => {
    const veggie = makeRecipe({ id: 'g', diets: ['omnivore', 'flexitarien', 'vegetarien'] });
    expect(checkDietConsistency({ ...veggie, allergens: ['lait', 'oeufs'] })).toEqual([]);
    expect(checkDietConsistency({ ...veggie, allergens: ['poissons'] })[0]?.code).toBe(
      'regime-allergene',
    );
    expect(checkDietConsistency({ ...veggie, mainProtein: 'porc' })[0]?.code).toBe(
      'regime-proteine',
    );
    expect(checkDietConsistency({ ...veggie, mainProtein: 'fromage' })).toEqual([]);
    const lardons = { ...veggie, ingredients: [ing('lardons fumés', 100, 'g', 'frais')] };
    expect(checkDietConsistency(lardons)[0]?.code).toBe('regime-ingredient');
    const gelatine = {
      ...veggie,
      ingredients: [ing('feuilles de gélatine', 2, 'piece', 'epicerie')],
    };
    expect(checkDietConsistency(gelatine)[0]?.code).toBe('regime-ingredient');
  });

  it('végétarien ⇒ pas de fromage d’appellation à présure animale, sauf version végétarienne', () => {
    const veggie = makeRecipe({
      id: 'r',
      diets: ['omnivore', 'flexitarien', 'vegetarien'],
      allergens: ['lait'],
      mainProtein: 'fromage',
    });
    const withCheese = (name: string) => ({
      ...veggie,
      ingredients: [ing(name, 50, 'g', 'frais')],
    });
    for (const name of ['parmesan', 'Parmigiano Reggiano', 'comté râpé', 'pecorino', 'gruyère']) {
      const issues = checkDietConsistency(withCheese(name));
      expect(
        issues.map((i) => [i.code, i.severity]),
        name,
      ).toEqual([['regime-ingredient', 'erreur']]);
      expect(issues[0]?.message).toContain('présure animale');
    }
    for (const name of ['parmesan végétarien', 'mozzarella', 'feta', 'chèvre frais', 'paneer']) {
      expect(checkDietConsistency(withCheese(name)), name).toEqual([]);
    }
    // Hors végétarien (flexitarien, omnivore), le parmesan reste possible.
    expect(
      checkDietConsistency({ ...withCheese('parmesan'), diets: ['omnivore', 'flexitarien'] }),
    ).toEqual([]);
  });

  it('sans lactose ⇒ pas de lait (même fromage affiné) ; sans gluten ⇒ pas de gluten', () => {
    const r = makeRecipe({ id: 's', diets: ['omnivore', 'sans-lactose', 'sans-gluten'] });
    expect(checkDietConsistency({ ...r, allergens: ['lait'] })).toHaveLength(1);
    expect(checkDietConsistency({ ...r, allergens: ['gluten'] })).toHaveLength(1);
    expect(checkDietConsistency({ ...r, allergens: ['soja'] })).toEqual([]);
  });

  it('omnivore n’impose rien', () => {
    const r = makeRecipe({
      id: 'o',
      diets: ['omnivore'],
      mainProtein: 'boeuf',
      allergens: ['lait'],
    });
    expect(checkDietConsistency(r)).toEqual([]);
  });
});

describe('audit de contenu', () => {
  it('signale les régimes oubliés', () => {
    const r = makeRecipe({ id: 'x', diets: ['vegan'] });
    expect(checkDietCompleteness(r).map((i) => i.message)).toEqual([
      'le régime « omnivore » devrait figurer dans la liste',
      'le régime « vegetarien » devrait figurer dans la liste',
    ]);
    expect(
      checkDietCompleteness(makeRecipe({ id: 'y', diets: ['omnivore', 'vegetarien'] })),
    ).toHaveLength(1);
  });

  it('vérifie l’assiette et la vraisemblance nutritionnelle', () => {
    const base = makeRecipe({ id: 'n' });
    expect(checkNutrition(base)).toEqual([]);
    const codes = (r: typeof base) => checkNutrition(r).map((i) => i.code);
    expect(
      codes({ ...base, plateBalance: { vegetables: 0.5, proteins: 0.5, starches: 0.5 } }),
    ).toContain('assiette-somme');
    expect(
      codes({ ...base, plateBalance: { vegetables: 0.2, proteins: 0.4, starches: 0.4 } }),
    ).toEqual(['assiette-peu-de-legumes']);
    expect(
      codes({ ...base, nutritionPerServing: { ...base.nutritionPerServing, kcal: 900 } }),
    ).toEqual(['nutrition-incoherente']);
    const zero = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
    expect(codes({ ...base, nutritionPerServing: zero })).toEqual([
      'nutrition-incoherente',
      'nutrition-hors-plage',
      'proteines-faibles',
    ]);
    const huge = makeRecipe({ id: 'h', macros: [60, 120, 40, 10] });
    expect(codes(huge)).toEqual(['nutrition-hors-plage']);
    const breakfast = makeRecipe({ id: 'b', tags: ['petit-dejeuner'], macros: [8, 60, 7, 8] });
    expect(
      codes({ ...breakfast, plateBalance: { vegetables: 0.1, proteins: 0.2, starches: 0.7 } }),
    ).toEqual([]);
  });

  it('vérifie la cohérence du niveau', () => {
    const codes = (r: ReturnType<typeof makeRecipe>) => checkLevel(r).map((i) => i.code);
    expect(codes(makeRecipe({ id: 'a', prepMinutes: 15, cookMinutes: 10 }))).toEqual([
      'niveau-temps',
    ]);
    const many = Array.from({ length: 7 }, (_, k) =>
      ing(`légume ${k}`, 1, 'piece', 'fruits-legumes'),
    );
    expect(
      codes(
        makeRecipe({
          id: 'b',
          ingredients: [...many.slice(0, 6), ing('sel', 1, 'pincee', 'epicerie')],
        }),
      ),
    ).toEqual([]);
    expect(codes(makeRecipe({ id: 'c', ingredients: many }))).toEqual(['niveau-ingredients']);
    expect(
      codes(makeRecipe({ id: 'd', level: 'medium', prepMinutes: 30, cookMinutes: 20 })),
    ).toEqual(['niveau-temps']);
    expect(
      codes(makeRecipe({ id: 'e', level: 'experiment', prepMinutes: 60, cookMinutes: 120 })),
    ).toEqual([]);
  });
});

describe('grossesse et allaitement : ni alcool ni cru', () => {
  const tartare = makeRecipe({
    id: 'tartare-saumon',
    diets: ['omnivore', 'flexitarien'],
    allergens: ['poissons'],
    mainProtein: 'poisson',
    tags: ['cru'],
  });
  const moules = fixture('moules-marinieres');
  const pregnant = { ...none, pregnantOrBreastfeeding: true, sex: 'femme' } as const;

  it('expose les étiquettes exclues', () => {
    expect(PREGNANCY_EXCLUDED_TAGS).toEqual(['alcool', 'cru']);
  });

  it.each(['femme', 'autre'] as const)('exclut alcool et cru (%s)', (sex) => {
    const c = { ...pregnant, sex };
    expect(isPregnancyRelevant(c)).toBe(true);
    expect(isRecipeCompatible(tartare, c)).toBe(false);
    expect(isRecipeCompatible(moules, c)).toBe(false);
    expect(isRecipeCompatible(fixture('dahl-lentilles-corail'), c)).toBe(true);
  });

  it('s’applique si le sexe n’est pas renseigné, pas pour un homme ni sans grossesse', () => {
    expect(isRecipeCompatible(tartare, { ...none, pregnantOrBreastfeeding: true })).toBe(false);
    expect(isRecipeCompatible(tartare, { ...pregnant, sex: 'homme' })).toBe(true);
    expect(isRecipeCompatible(tartare, { ...pregnant, pregnantOrBreastfeeding: false })).toBe(true);
    expect(isRecipeCompatible(tartare, none)).toBe(true);
  });

  it('filtre un catalogue', () => {
    const ids = filterCompatibleRecipes([...FIXTURE_RECIPES, tartare], pregnant).map((r) => r.id);
    expect(ids).not.toContain('tartare-saumon');
    expect(ids).not.toContain('moules-marinieres');
    expect(ids).not.toContain('risotto-courge');
  });

  it('l’audit exige l’étiquette « alcool » pour un ingrédient alcoolisé', () => {
    const wine = makeRecipe({ id: 'w', ingredients: [ing('vin rouge', 20, 'cl', 'epicerie')] });
    expect(checkSafetyTags(wine).map((i) => i.code)).toEqual(['etiquette-alcool-manquante']);
    expect(checkSafetyTags({ ...wine, tags: ['alcool'] })).toEqual([]);
    const vinegar = makeRecipe({
      id: 'v',
      ingredients: [ing('vinaigre de vin', 1, 'cuillere-soupe', 'epicerie')],
    });
    expect(checkSafetyTags(vinegar)).toEqual([]);
    for (const name of ['marsala', 'mirin', 'xérès']) {
      const recipe = makeRecipe({ id: name, ingredients: [ing(name, 5, 'cl', 'epicerie')] });
      expect(
        checkSafetyTags(recipe).map((i) => i.code),
        name,
      ).toEqual(['etiquette-alcool-manquante']);
    }
    expect(
      checkSafetyTags(
        makeRecipe({
          id: 'x',
          ingredients: [ing('vinaigre balsamique', 1, 'cuillere-soupe', 'epicerie')],
        }),
      ),
    ).toEqual([]);
  });
});
