import type { Aisle, Unit } from '../recipe';

/** Article ajouté à la main dans la liste de courses. */
export interface ManualShoppingItem {
  /** Identifiant fourni par l'appelant (pas d'aléa dans le domain). */
  readonly id: string;
  readonly label: string;
  /** Absent → section « Divers ». */
  readonly aisle?: Aisle;
}

/** État persistant de la liste de courses d'une semaine. */
export interface ShoppingState {
  /** Clés (stables) des lignes cochées. */
  readonly checkedKeys: readonly string[];
  readonly manualItems: readonly ManualShoppingItem[];
}

/** Section de la liste : un rayon, ou « divers » pour les articles manuels sans rayon. */
export type ShoppingSectionKey = Aisle | 'divers';

/** Ligne de la liste de courses. */
export interface ShoppingItem {
  /** Clé stable : `nom-normalisé|unité` ou `manuel:<id>`. */
  readonly key: string;
  readonly name: string;
  /** Quantité arrondie pour l'achat (absente pour un article manuel). */
  readonly quantity?: number;
  readonly unit?: Unit;
  readonly section: ShoppingSectionKey;
  readonly checked: boolean;
  readonly manual: boolean;
  /** Recettes qui utilisent l'ingrédient. */
  readonly recipeIds: readonly string[];
}

export interface ShoppingSection {
  readonly key: ShoppingSectionKey;
  readonly label: string;
  readonly items: readonly ShoppingItem[];
}

export interface ShoppingList {
  readonly sections: readonly ShoppingSection[];
}
