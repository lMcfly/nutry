import { describe, expect, it } from 'vitest';
import { FIXTURE_RECIPES, fixture } from '../testing/fixtures';
import type { PlannedMeal, WeeklyPlan } from '../mealplan';
import {
  formatIngredient,
  formatIngredientText,
  pluralizeFr,
  roundForRecipe,
  EMPTY_SHOPPING_STATE,
  SHOPPING_SECTIONS,
  addManualItem,
  buildShoppingList,
  formatNumberFr,
  formatQuantity,
  formatShoppingListText,
  manualKey,
  removeManualItem,
  roundForShopping,
  toBaseUnit,
  toggleChecked,
  uncheckAll,
} from './index';
import type { ShoppingList } from './index';

const facts = {
  likedTerms: [],
  seasonMatch: false,
  seasonalProduce: [],
  totalMinutes: 0,
  fitsTime: true,
  ratedPositively: false,
  batchFriendly: false,
  newProtein: false,
};
function planned(id: string, recipeId: string, extra: Partial<PlannedMeal> = {}): PlannedMeal {
  return {
    id,
    dayIndex: 0,
    date: '2026-11-23',
    slot: 'diner',
    recipeId,
    isLeftover: false,
    relaxed: [],
    score: { total: 0, components: [], facts },
    ...extra,
  };
}
const plan = (meals: PlannedMeal[]): WeeklyPlan => ({
  weekStart: '2026-11-23',
  meals,
  notices: [],
});
const items = (list: ShoppingList) => list.sections.flatMap((s) => s.items);
const item = (list: ShoppingList, name: string) => items(list).find((i) => i.name === name);

describe('unités et arrondis', () => {
  it('convertit vers l’unité de base', () => {
    expect(toBaseUnit(1.5, 'kg')).toEqual({ quantity: 1500, unit: 'g' });
    expect(toBaseUnit(20, 'cl')).toEqual({ quantity: 200, unit: 'ml' });
    expect(toBaseUnit(1, 'l')).toEqual({ quantity: 1000, unit: 'ml' });
    expect(toBaseUnit(2, 'piece')).toEqual({ quantity: 2, unit: 'piece' });
  });

  it.each([
    [123, 'g', 125, 'g'],
    [1, 'g', 5, 'g'],
    [1520, 'g', 1.55, 'kg'],
    [0.99, 'l', 990, 'ml'],
    [1.2, 'l', 1.2, 'l'],
    [1.2, 'boite', 2, 'boite'],
    [2, 'botte', 2, 'botte'],
    [0.2, 'pincee', 1, 'pincee'],
    [1.2, 'piece', 2, 'piece'],
    [0.1, 'gousse', 1, 'gousse'],
    [6.5, 'gousse', 7, 'gousse'],
    [1.2, 'tranche', 1.5, 'tranche'],
  ] as const)('%s %s → %s %s', (q, unit, expectedQ, expectedUnit) => {
    const r = roundForShopping(q, unit);
    expect(r.unit).toBe(expectedUnit);
    expect(r.quantity).toBeCloseTo(expectedQ, 10);
  });

  it('formate à la française', () => {
    expect(formatNumberFr(1.5)).toBe('1,5');
    expect(formatQuantity(300, 'g')).toBe('300 g');
    expect(formatQuantity(2, 'gousse')).toBe('2 gousses');
    expect(formatQuantity(1.5, 'gousse')).toBe('1,5 gousse');
    expect(formatQuantity(1.5, 'boite')).toBe('1,5 boîte');
    expect(formatQuantity(2.5, 'tranche')).toBe('2,5 tranches');
    expect(formatQuantity(1, 'boite')).toBe('1 boîte');
    expect(formatQuantity(3, 'piece')).toBe('3');
    expect(formatQuantity(1.5, 'cuillere-soupe')).toBe('1,5 c. à soupe');
  });
});

describe('buildShoppingList', () => {
  it('agrège les ingrédients du plan, par rayon et dans l’ordre fixe', () => {
    const list = buildShoppingList({
      plan: plan([planned('a', 'saumon-haricots-verts'), planned('b', 'dinde-patate-douce')]),
      recipes: FIXTURE_RECIPES,
      householdSize: 1,
      userPortionFactor: 1,
    });
    const order = list.sections.map((s) => SHOPPING_SECTIONS.indexOf(s.key));
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    // haricots verts : 150 g + 125 g (une portion de chaque recette)
    expect(item(list, 'haricots verts')).toMatchObject({
      quantity: 275,
      unit: 'g',
      section: 'fruits-legumes',
    });
    expect(item(list, 'haricots verts')?.recipeIds).toEqual([
      'saumon-haricots-verts',
      'dinde-patate-douce',
    ]);
    // huile d'olive : 0,5 + 0,5 c. à soupe
    expect(item(list, 'huile d’olive')).toMatchObject({ quantity: 1, unit: 'cuillere-soupe' });
    const fruits = list.sections.find((s) => s.key === 'fruits-legumes')?.items.map((i) => i.name);
    expect(fruits).toEqual([...(fruits ?? [])].sort((a, b) => a.localeCompare(b, 'fr')));
  });

  it('fusionne par nom normalisé et unité de base, sans fusionner des unités différentes', () => {
    const list = buildShoppingList({
      plan: plan([
        planned('a', 'risotto-courge'),
        planned('b', 'moules-marinieres'),
        planned('c', 'boeuf-carottes'),
      ]),
      recipes: FIXTURE_RECIPES,
      householdSize: 2,
      userPortionFactor: 1,
    });
    // vin blanc : 10 cl × 2/4 ? non — risotto 10 cl / 2 portions × 2 + moules 20 cl / 2 × 2 = 300 ml
    expect(item(list, 'vin blanc')).toMatchObject({ quantity: 300, unit: 'ml' });
    // bouillon : 1 l (risotto, 2 pers.) + 50 cl × 2/4 (bœuf) = 1 250 ml → 1,25 l
    expect(item(list, 'bouillon de légumes')).toMatchObject({ quantity: 1.25, unit: 'l' });
    // pommes de terre en g (moules + bœuf) fusionnées
    expect(items(list).filter((i) => i.name === 'pommes de terre')).toHaveLength(1);
    // oignon (pièce) n'est pas confondu avec un autre article
    expect(item(list, 'oignon')).toMatchObject({ unit: 'piece' });
  });

  it('compte une seule fois un plat à restes, en double quantité', () => {
    const withLeftover = buildShoppingList({
      plan: plan([
        planned('0-diner', 'chili-sin-carne'),
        planned('1-dejeuner', 'chili-sin-carne', {
          isLeftover: true,
          leftoverOf: '0-diner',
          slot: 'dejeuner',
        }),
      ]),
      recipes: FIXTURE_RECIPES,
      householdSize: 2,
      userPortionFactor: 1,
    });
    const alone = buildShoppingList({
      plan: plan([planned('0-diner', 'chili-sin-carne')]),
      recipes: FIXTURE_RECIPES,
      householdSize: 2,
      userPortionFactor: 1,
    });
    expect(item(withLeftover, 'haricots rouges')?.quantity).toBe(2);
    expect(item(alone, 'haricots rouges')?.quantity).toBe(1);
  });

  it('ajuste au foyer et au facteur de portion, sans réduire les légumes', () => {
    const list = buildShoppingList({
      plan: plan([planned('a', 'saumon-haricots-verts')]),
      recipes: FIXTURE_RECIPES,
      householdSize: 3,
      userPortionFactor: 0.8,
    });
    // riz : 60 g × (0,8 + 2) = 168 → 170 g ; haricots : 150 × 3 = 450 g
    expect(item(list, 'riz complet')?.quantity).toBe(170);
    expect(item(list, 'haricots verts')?.quantity).toBe(450);
  });

  it('ignore l’eau et les recettes inconnues', () => {
    const list = buildShoppingList({
      plan: plan([planned('a', 'soupe-poireaux-haricots'), planned('b', 'disparue')]),
      recipes: FIXTURE_RECIPES,
      householdSize: 1,
      userPortionFactor: 1,
    });
    expect(item(list, 'eau')).toBeUndefined();
    expect(item(list, 'poireaux')).toBeDefined();
  });

  it('intègre articles manuels et cases cochées', () => {
    let state = addManualItem(EMPTY_SHOPPING_STATE, { id: 'm1', label: '  Café ' });
    state = addManualItem(state, { id: 'm2', label: 'Pommes', aisle: 'fruits-legumes' });
    state = addManualItem(state, { id: 'm2', label: 'Doublon' });
    state = addManualItem(state, { id: 'm3', label: '   ' });
    state = toggleChecked(state, manualKey({ id: 'm1' }));
    state = toggleChecked(state, 'citron|piece');
    const list = buildShoppingList({
      plan: plan([planned('a', 'saumon-haricots-verts')]),
      recipes: FIXTURE_RECIPES,
      householdSize: 1,
      userPortionFactor: 1,
      state,
    });
    expect(list.sections.at(-1)).toMatchObject({ key: 'divers', label: 'Divers' });
    expect(item(list, 'Café')).toMatchObject({ manual: true, checked: true, section: 'divers' });
    expect(item(list, 'Pommes')).toMatchObject({
      manual: true,
      checked: false,
      section: 'fruits-legumes',
    });
    expect(item(list, 'citron')?.checked).toBe(true);
    expect(state.manualItems).toHaveLength(2);

    const unchecked = toggleChecked(state, 'citron|piece');
    expect(unchecked.checkedKeys).toEqual(['manuel:m1']);
    const removed = removeManualItem(state, 'm1');
    expect(removed.manualItems.map((m) => m.id)).toEqual(['m2']);
    expect(removed.checkedKeys).toEqual(['citron|piece']);
    expect(uncheckAll(state).checkedKeys).toEqual([]);
  });
});

describe('quantités lisibles', () => {
  it.each([
    ['concombre', 'concombres'],
    ['oignon rouge', 'oignons rouges'],
    ['pomme de terre', 'pommes de terre'],
    ['côtelettes d’agneau', 'côtelettes d’agneau'],
    ['poireau', 'poireaux'],
    ['yaourt nature', 'yaourts nature'],
    ['pak choï', 'pak choï'],
    ['oeufs', 'oeufs'],
  ])('pluriel de « %s » : « %s »', (name, expected) => {
    expect(pluralizeFr(name)).toBe(expected);
  });

  it('refuse un pluriel déraisonnable', () => {
    expect(pluralizeFr('steaks hachés 5 %')).toBeUndefined();
    expect(pluralizeFr('')).toBeUndefined();
  });

  it('affiche quantité et nom sans nombre nu', () => {
    expect(formatIngredient('concombre', 1.5, 'piece')).toEqual({
      amount: '1,5',
      label: 'concombre',
      amountFirst: true,
    });
    expect(formatIngredient('concombre', 2, 'piece')).toMatchObject({ label: 'concombres' });
    expect(formatIngredient('steaks hachés 5 %', 2, 'piece')).toEqual({
      amount: '× 2',
      label: 'steaks hachés 5 %',
      amountFirst: false,
    });
    expect(formatIngredient('ail', 7, 'gousse')).toEqual({
      amount: '7 gousses',
      label: 'ail',
      amountFirst: false,
    });
    expect(formatIngredientText('échalote', 3, 'piece')).toBe('3 échalotes');
    expect(formatIngredientText('ail', 7, 'gousse')).toBe('ail : 7 gousses');
    expect(formatIngredientText('steaks hachés 5 %', 2, 'piece')).toBe('steaks hachés 5 % × 2');
  });

  it('liste de courses : on achète entier ; recette : quantité exacte', () => {
    expect(roundForShopping(1.5, 'piece')).toEqual({ quantity: 2, unit: 'piece' });
    expect(roundForShopping(4.2, 'piece')).toEqual({ quantity: 5, unit: 'piece' });
    expect(roundForShopping(6.5, 'gousse')).toEqual({ quantity: 7, unit: 'gousse' });
    expect(roundForRecipe(1.5, 'piece')).toEqual({ quantity: 1.5, unit: 'piece' });
    expect(roundForRecipe(1.2, 'gousse')).toEqual({ quantity: 1.5, unit: 'gousse' });
    expect(roundForRecipe(6.5, 'gousse')).toEqual({ quantity: 7, unit: 'gousse' });
    expect(roundForRecipe(2, 'gousse')).toEqual({ quantity: 2, unit: 'gousse' });
    expect(roundForRecipe(1.2, 'boite')).toEqual({ quantity: 1.5, unit: 'boite' });
    expect(roundForRecipe(0.2, 'pincee')).toEqual({ quantity: 1, unit: 'pincee' });
    expect(roundForRecipe(123, 'g')).toEqual({ quantity: 125, unit: 'g' });
    expect(roundForRecipe(1.2, 'cuillere-soupe')).toEqual({
      quantity: 1.5,
      unit: 'cuillere-soupe',
    });
  });
});

describe('formatShoppingListText', () => {
  const state = toggleChecked(
    addManualItem(EMPTY_SHOPPING_STATE, { id: 'x', label: 'Café' }),
    'citron|piece',
  );
  const list = buildShoppingList({
    plan: plan([planned('a', 'saumon-haricots-verts')]),
    recipes: FIXTURE_RECIPES,
    householdSize: 2,
    userPortionFactor: 1,
    state,
  });

  it('produit un texte partageable, par rayon, sans les articles cochés', () => {
    expect(formatShoppingListText(list, { title: 'Courses de la semaine' })).toBe(
      [
        'Courses de la semaine',
        '',
        'Fruits et légumes',
        '- haricots verts : 300 g',
        '',
        'Boucherie et poissonnerie',
        '- 2 pavés de saumon',
        '',
        'Épicerie',
        '- huile d’olive : 1 c. à soupe',
        '- riz complet : 120 g',
        '',
        'Divers',
        '- Café',
      ].join('\n'),
    );
  });

  it('peut inclure les articles cochés', () => {
    expect(formatShoppingListText(list, { includeChecked: true })).toMatch(
      /^Liste de courses\n[\s\S]*- 1 citron\n/,
    );
  });

  it('reste neutre sur une liste vide et félicite quand tout est coché', () => {
    const empty = buildShoppingList({
      plan: plan([]),
      recipes: [fixture('dahl-lentilles-corail')],
      householdSize: 1,
      userPortionFactor: 1,
    });
    expect(formatShoppingListText(empty)).toBe(
      'Liste de courses\n\nTa liste est vide pour l’instant.',
    );
    const one = addManualItem(EMPTY_SHOPPING_STATE, { id: 'c', label: 'Café' });
    const done = buildShoppingList({
      plan: plan([]),
      recipes: [],
      householdSize: 1,
      userPortionFactor: 1,
      state: toggleChecked(one, manualKey({ id: 'c' })),
    });
    expect(formatShoppingListText(done)).toBe(
      'Liste de courses\n\nTout est dans le panier, bravo !',
    );
    expect(
      formatShoppingListText({ sections: [{ key: 'divers', label: 'Divers', items: [] }] }),
    ).toMatch(/vide/);
  });
});
