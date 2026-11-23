import { tokenize } from '../shared';
import { AISLES } from '../recipe';
import type { Aisle, Recipe, Unit } from '../recipe';
import { scaleRecipeForHousehold } from '../profile';
import type { WeeklyPlan } from '../mealplan';
import type {
  ManualShoppingItem,
  ShoppingItem,
  ShoppingList,
  ShoppingSection,
  ShoppingSectionKey,
  ShoppingState,
} from './shopping.types';
import { roundForShopping, toBaseUnit } from './units';

/** Ordre fixe des sections et libellés affichés. */
export const SHOPPING_SECTIONS: readonly ShoppingSectionKey[] = [...AISLES, 'divers'];

export const SECTION_LABELS: Readonly<Record<ShoppingSectionKey, string>> = {
  'fruits-legumes': 'Fruits et légumes',
  'boucherie-poissonnerie': 'Boucherie et poissonnerie',
  frais: 'Frais',
  boulangerie: 'Boulangerie',
  epicerie: 'Épicerie',
  surgeles: 'Surgelés',
  divers: 'Divers',
};

export const EMPTY_SHOPPING_STATE: ShoppingState = { checkedKeys: [], manualItems: [] };

/** L'eau du robinet n'a pas sa place dans la liste. */
const EXCLUDED_NAMES = new Set(['eau']);

export interface BuildShoppingListInput {
  readonly plan: WeeklyPlan;
  readonly recipes: readonly Recipe[];
  readonly householdSize: number;
  /** Facteur de portion de l'utilisateur (`computePortionFactor`). */
  readonly userPortionFactor: number;
  readonly state?: ShoppingState;
}

interface Accumulator {
  name: string;
  quantity: number;
  unit: Unit;
  aisle: Aisle;
  recipeIds: string[];
}

/**
 * Liste de courses de la semaine : quantités ajustées au foyer et aux portions, fusion
 * par (nom normalisé + unité de base), sections par rayon dans un ordre fixe, articles
 * manuels et cases cochées. Un plat qui fait des restes est compté une seule fois, en
 * double quantité (une fois de plus par repas de restes).
 */
export function buildShoppingList(input: BuildShoppingListInput): ShoppingList {
  const byId = new Map(input.recipes.map((r) => [r.id, r]));
  const leftoversBySource = new Map<string, number>();
  for (const meal of input.plan.meals) {
    if (meal.leftoverOf !== undefined) {
      leftoversBySource.set(meal.leftoverOf, (leftoversBySource.get(meal.leftoverOf) ?? 0) + 1);
    }
  }

  const lines = new Map<string, Accumulator>();
  for (const meal of input.plan.meals) {
    const recipe = byId.get(meal.recipeId);
    if (meal.isLeftover || !recipe) continue;
    const scaled = scaleRecipeForHousehold(recipe, {
      userFactor: input.userPortionFactor,
      householdSize: input.householdSize,
      batches: 1 + (leftoversBySource.get(meal.id) ?? 0),
    });
    for (const ingredient of scaled) {
      const normalized = tokenize(ingredient.name).join(' ');
      if (EXCLUDED_NAMES.has(normalized)) continue;
      const base = toBaseUnit(ingredient.quantity, ingredient.unit);
      const key = `${normalized}|${base.unit}`;
      const line = lines.get(key);
      if (line) {
        line.quantity += base.quantity;
        if (!line.recipeIds.includes(recipe.id)) line.recipeIds.push(recipe.id);
      } else {
        lines.set(key, {
          name: ingredient.name,
          ...base,
          aisle: ingredient.aisle,
          recipeIds: [recipe.id],
        });
      }
    }
  }

  const state = input.state ?? EMPTY_SHOPPING_STATE;
  const checked = new Set(state.checkedKeys);
  const items: ShoppingItem[] = [...lines].map(([key, line]) => ({
    key,
    name: line.name,
    ...roundForShopping(line.quantity, line.unit),
    section: line.aisle,
    checked: checked.has(key),
    manual: false,
    recipeIds: line.recipeIds,
  }));
  for (const manual of state.manualItems) {
    const key = manualKey(manual);
    items.push({
      key,
      name: manual.label,
      section: manual.aisle ?? 'divers',
      checked: checked.has(key),
      manual: true,
      recipeIds: [],
    });
  }

  const sections: ShoppingSection[] = SHOPPING_SECTIONS.map((key) => ({
    key,
    label: SECTION_LABELS[key],
    items: items
      .filter((i) => i.section === key)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  })).filter((s) => s.items.length > 0);
  return { sections };
}

export function manualKey(item: Pick<ManualShoppingItem, 'id'>): string {
  return `manuel:${item.id}`;
}

/** Coche ou décoche une ligne. */
export function toggleChecked(state: ShoppingState, key: string): ShoppingState {
  const checkedKeys = state.checkedKeys.includes(key)
    ? state.checkedKeys.filter((k) => k !== key)
    : [...state.checkedKeys, key];
  return { ...state, checkedKeys };
}

/** Ajoute un article manuel (libellé non vide ; identifiant unique fourni par l'appelant). */
export function addManualItem(state: ShoppingState, item: ManualShoppingItem): ShoppingState {
  const label = item.label.trim();
  if (label === '' || state.manualItems.some((m) => m.id === item.id)) return state;
  return { ...state, manualItems: [...state.manualItems, { ...item, label }] };
}

/** Retire un article manuel (et sa coche éventuelle). */
export function removeManualItem(state: ShoppingState, id: string): ShoppingState {
  const key = manualKey({ id });
  return {
    checkedKeys: state.checkedKeys.filter((k) => k !== key),
    manualItems: state.manualItems.filter((m) => m.id !== id),
  };
}

/** Décoche tout. */
export function uncheckAll(state: ShoppingState): ShoppingState {
  return { ...state, checkedKeys: [] };
}
