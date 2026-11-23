import type { Aisle } from '../recipe';

/** PLACEHOLDER (phase 2) — article ajouté à la main dans la liste de courses. */
export interface ManualShoppingItem {
  readonly id: string;
  readonly label: string;
  readonly aisle?: Aisle;
}

/** PLACEHOLDER (phase 2) — état persistant de la liste de courses d'une semaine. */
export interface ShoppingState {
  /** Clés (stables) des lignes cochées. */
  readonly checkedKeys: readonly string[];
  readonly manualItems: readonly ManualShoppingItem[];
}
