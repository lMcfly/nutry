import type { ShareResult } from '../ports';
import type { Aisle } from '@domain/recipe';
import {
  EMPTY_SHOPPING_STATE,
  addManualItem,
  buildShoppingList,
  formatShoppingListText,
  manualKey,
  removeManualItem,
  toggleChecked,
  uncheckAll,
} from '@domain/shopping';
import type { ShoppingList, ShoppingState } from '@domain/shopping';
import type { IsoDate } from '@domain/shared';
import { shoppingBasisKey } from '@domain/userdata';
import type { SavedPlan, ShoppingRecord } from '@domain/userdata';
import { NO_PROFILE, loadPlanningContext } from './context';
import type { AppPorts, NoProfile, PlanningContext, SerialRunner } from './context';
import { ensureCurrentPlan } from './plan';

/** Longueur maximale d'un article ajouté à la main. */
export const MANUAL_ITEM_MAX_LENGTH = 80;

export interface ShoppingView {
  readonly status: 'ready';
  readonly weekStart: IsoDate;
  readonly list: ShoppingList;
  /**
   * Vrai une fois quand le menu (ou le foyer, ou les portions) a changé depuis les
   * dernières coches : les ingrédients ont été décochés, les articles manuels gardés.
   */
  readonly reset: boolean;
}

export type ShoppingResult = NoProfile | ShoppingView;

export interface ShoppingUseCases {
  getShoppingList(): Promise<ShoppingResult>;
  toggleShoppingItem(key: string): Promise<ShoppingResult>;
  addShoppingItem(input: {
    readonly label: string;
    readonly aisle?: Aisle;
  }): Promise<ShoppingResult>;
  removeShoppingItem(id: string): Promise<ShoppingResult>;
  uncheckAllShoppingItems(): Promise<ShoppingResult>;
  /** Partage les articles restant à acheter (Web Share, sinon presse-papiers). */
  shareShoppingList(): Promise<ShareResult>;
}

interface Loaded {
  readonly ctx: PlanningContext;
  readonly plan: SavedPlan;
  readonly record: ShoppingRecord;
  readonly reset: boolean;
}

function basisOf(ctx: PlanningContext, plan: SavedPlan): string {
  return shoppingBasisKey({
    plan,
    householdSize: ctx.profile.householdSize,
    portionFactor: ctx.portionFactor,
  });
}

/** Garde les articles manuels et leurs coches ; décoche les ingrédients. */
function keepManual(state: ShoppingState): ShoppingState {
  const manualKeys = new Set(state.manualItems.map(manualKey));
  return {
    manualItems: state.manualItems,
    checkedKeys: state.checkedKeys.filter((k) => manualKeys.has(k)),
  };
}

export function createShoppingUseCases(ports: AppPorts, serial: SerialRunner): ShoppingUseCases {
  const load = async (): Promise<Loaded | undefined> => {
    const ctx = await loadPlanningContext(ports);
    if (!ctx) return undefined;
    const { plan } = await ensureCurrentPlan(ports, ctx);
    const basisKey = basisOf(ctx, plan);
    const stored = await ports.shopping.get(plan.weekStart);
    if (stored?.basisKey === basisKey) return { ctx, plan, record: stored, reset: false };
    const record: ShoppingRecord = {
      weekStart: plan.weekStart,
      basisKey,
      state: stored ? keepManual(stored.state) : EMPTY_SHOPPING_STATE,
    };
    await ports.shopping.save(record);
    return {
      ctx,
      plan,
      record,
      reset: stored !== undefined && stored.state.checkedKeys.length > 0,
    };
  };

  const toView = ({ ctx, plan, record, reset }: Loaded): ShoppingView => ({
    status: 'ready',
    weekStart: plan.weekStart,
    reset,
    list: buildShoppingList({
      plan,
      recipes: ctx.recipes,
      householdSize: ctx.profile.householdSize,
      userPortionFactor: ctx.portionFactor,
      state: record.state,
    }),
  });

  const update = (change: (state: ShoppingState) => ShoppingState): Promise<ShoppingResult> =>
    serial(async () => {
      const loaded = await load();
      if (!loaded) return NO_PROFILE;
      const record = { ...loaded.record, state: change(loaded.record.state) };
      if (record.state !== loaded.record.state) await ports.shopping.save(record);
      return toView({ ...loaded, record });
    });

  const newItemId = (): string =>
    `${ports.clock.now().getTime().toString(36)}-${Math.floor(ports.random.next() * 2 ** 32).toString(36)}`;

  return {
    getShoppingList: () =>
      serial(async () => {
        const loaded = await load();
        return loaded ? toView(loaded) : NO_PROFILE;
      }),

    toggleShoppingItem: (key) => update((state) => toggleChecked(state, key)),

    addShoppingItem: ({ label, aisle }) =>
      update((state) =>
        addManualItem(state, {
          id: newItemId(),
          label: label.trim().slice(0, MANUAL_ITEM_MAX_LENGTH),
          ...(aisle ? { aisle } : {}),
        }),
      ),

    removeShoppingItem: (id) => update((state) => removeManualItem(state, id)),

    uncheckAllShoppingItems: () => update(uncheckAll),

    async shareShoppingList() {
      const loaded = await serial(load);
      if (!loaded) return 'failed';
      return ports.sharer.share(
        formatShoppingListText(toView(loaded).list, { title: 'Ma liste de courses Nutry' }),
      );
    },
  };
}
