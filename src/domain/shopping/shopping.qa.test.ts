/**
 * QA phase 2 — liste de courses : agrégation, conversions, restes, foyer, articles
 * manuels, formatage du texte partagé.
 */
import { describe, expect, it } from 'vitest';
import { ceilTo, roundTo } from '../shared';
import { ing, makeRecipe } from '../testing/fixtures';
import { applyReplacement } from '../mealplan';
import type { PlannedMeal, WeeklyPlan } from '../mealplan';
import {
  addManualItem,
  buildShoppingList,
  formatQuantity,
  formatShoppingListText,
  roundForShopping,
  toggleChecked,
} from './index';
import type { ShoppingItem, ShoppingList } from './index';

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
const score = { total: 0, components: [], facts };
function meal(id: string, recipeId: string, extra: Partial<PlannedMeal> = {}): PlannedMeal {
  return {
    id,
    dayIndex: 0,
    date: '2026-11-23',
    slot: 'diner',
    recipeId,
    isLeftover: false,
    relaxed: [],
    score,
    ...extra,
  };
}
const plan = (meals: PlannedMeal[]): WeeklyPlan => ({
  weekStart: '2026-11-23',
  meals,
  notices: [],
});
const items = (list: ShoppingList): ShoppingItem[] => list.sections.flatMap((s) => s.items);
const find = (list: ShoppingList, name: string) => items(list).find((i) => i.name === name);

const A = makeRecipe({
  id: 'a',
  servings: 2,
  ingredients: [
    ing('riz complet', 0.3, 'kg', 'epicerie'),
    ing('lait d’avoine', 25, 'cl', 'frais'),
    ing('tomates', 2, 'piece', 'fruits-legumes'),
  ],
});
const B = makeRecipe({
  id: 'b',
  servings: 2,
  ingredients: [
    ing('Riz complet', 200, 'g', 'epicerie'),
    ing('lait d’avoine', 0.5, 'l', 'frais'),
    ing('tomate', 1, 'piece', 'fruits-legumes'),
    ing('eau', 1, 'l', 'epicerie'),
  ],
});
const C = makeRecipe({
  id: 'c',
  servings: 4,
  ingredients: [ing('pois chiches', 2, 'boite', 'epicerie')],
});
const RECIPES = [A, B, C];

describe('QA courses : agrégation', () => {
  it('fusionne kg + g et cl + l, singulier/pluriel et casse ; ignore l’eau', () => {
    const list = buildShoppingList({
      plan: plan([meal('0-dejeuner', 'a'), meal('0-diner', 'b')]),
      recipes: RECIPES,
      householdSize: 2,
      userPortionFactor: 1,
    });
    // riz : 300 g + 200 g ; lait : 250 ml + 500 ml ; tomates : 2 + 1
    expect(find(list, 'riz complet')).toMatchObject({ quantity: 500, unit: 'g' });
    expect(find(list, 'lait d’avoine')).toMatchObject({ quantity: 750, unit: 'ml' });
    expect(find(list, 'tomates')).toMatchObject({ quantity: 3, unit: 'piece' });
    expect(find(list, 'tomates')?.recipeIds).toEqual(['a', 'b']);
    expect(items(list).some((i) => i.name === 'eau')).toBe(false);
    expect(items(list)).toHaveLength(3);
  });

  it('foyer de 1 et de 6 : quantités proportionnelles', () => {
    const build = (householdSize: number) =>
      buildShoppingList({
        plan: plan([meal('0-diner', 'c')]),
        recipes: RECIPES,
        householdSize,
        userPortionFactor: 1,
      });
    // 2 boîtes / 4 portions = 0,5 boîte par personne → 1 (arrondi supérieur) et 3
    expect(find(build(1), 'pois chiches')?.quantity).toBe(1);
    expect(find(build(6), 'pois chiches')?.quantity).toBe(3);
  });

  it('restes : le plat est compté une fois, en double quantité', () => {
    const p = plan([
      meal('0-diner', 'b'),
      meal('1-dejeuner', 'b', {
        dayIndex: 1,
        slot: 'dejeuner',
        isLeftover: true,
        leftoverOf: '0-diner',
      }),
    ]);
    const list = buildShoppingList({
      plan: p,
      recipes: RECIPES,
      householdSize: 1,
      userPortionFactor: 1,
    });
    // 200 g / 2 portions × 1 personne × 2 repas
    expect(find(list, 'Riz complet')).toMatchObject({ quantity: 200, unit: 'g' });
  });

  it('restes après remplacement : la nouvelle recette est comptée en double, l’ancienne disparaît', () => {
    const p = plan([
      meal('0-diner', 'b'),
      meal('1-dejeuner', 'b', {
        dayIndex: 1,
        slot: 'dejeuner',
        isLeftover: true,
        leftoverOf: '0-diner',
      }),
    ]);
    const replaced = applyReplacement(p, '0-diner', { recipe: C, score });
    const list = buildShoppingList({
      plan: replaced,
      recipes: RECIPES,
      householdSize: 4,
      userPortionFactor: 1,
    });
    expect(items(list).map((i) => i.name)).toEqual(['pois chiches']);
    // 0,5 boîte × 4 personnes × 2 repas
    expect(find(list, 'pois chiches')?.quantity).toBe(4);
  });

  it('articles manuels : section Divers ou rayon, cochables, jamais fusionnés', () => {
    let state = addManualItem(
      { checkedKeys: [], manualItems: [] },
      { id: '1', label: '  tomates ' },
    );
    state = addManualItem(state, { id: '2', label: 'Éponges', aisle: 'epicerie' });
    state = addManualItem(state, { id: '3', label: '   ' });
    state = toggleChecked(state, 'manuel:2');
    const list = buildShoppingList({
      plan: plan([meal('0-diner', 'a')]),
      recipes: RECIPES,
      householdSize: 1,
      userPortionFactor: 1,
      state,
    });
    expect(list.sections.at(-1)?.key).toBe('divers');
    const manualTomatoes = items(list).find((i) => i.manual && i.name === 'tomates');
    expect(manualTomatoes).toMatchObject({ key: 'manuel:1', section: 'divers', checked: false });
    // L'article manuel « tomates » ne fusionne pas avec la ligne de la recette.
    expect(items(list).filter((i) => i.name === 'tomates')).toHaveLength(2);
    expect(find(list, 'Éponges')).toMatchObject({
      manual: true,
      section: 'epicerie',
      checked: true,
    });
    expect(items(list).filter((i) => i.manual)).toHaveLength(2);
  });
});

describe('QA courses : arrondis et texte partagé', () => {
  it.each([
    [1150, 'g', 1.15, 'kg', '1,15 kg'],
    [1450, 'g', 1.45, 'kg', '1,45 kg'],
    [2300, 'g', 2.3, 'kg', '2,3 kg'],
    [1700, 'ml', 1.7, 'l', '1,7 l'],
  ] as const)(
    '%s %s → %s %s, affiché « %s » (sans bruit de virgule flottante)',
    (qty, unit, expectedQty, expectedUnit, text) => {
      const rounded = roundForShopping(qty, unit);
      expect(rounded).toEqual({ quantity: expectedQty, unit: expectedUnit });
      expect(formatQuantity(rounded.quantity, rounded.unit)).toBe(text);
    },
  );

  it('roundTo et ceilTo renvoient des décimales propres', () => {
    expect(roundTo(1.15, 0.01)).toBe(1.15);
    expect(roundTo(4.35, 0.01)).toBe(4.35);
    expect(ceilTo(1.149, 0.05)).toBe(1.15);
    expect(ceilTo(2.26, 0.05)).toBe(2.3);
    expect(String(ceilTo(0.57, 0.01))).toBe('0.57');
  });

  it('le texte partagé ne contient jamais de nombre à rallonge', () => {
    const big = makeRecipe({
      id: 'big',
      servings: 1,
      ingredients: [ing('farine de sarrasin', 1150, 'g', 'epicerie')],
    });
    const list = buildShoppingList({
      plan: plan([meal('0-diner', 'big')]),
      recipes: [big],
      householdSize: 1,
      userPortionFactor: 1,
    });
    const text = formatShoppingListText(list);
    expect(text).toBe('Liste de courses\n\nÉpicerie\n- farine de sarrasin : 1,15 kg');
    expect(text).not.toMatch(/\d[.,]\d{3,}/);
  });
});
