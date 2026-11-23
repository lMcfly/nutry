import type { ShoppingList } from './shopping.types';
import { formatQuantity } from './units';

export interface FormatShoppingOptions {
  readonly title?: string;
  /** Inclure les articles déjà cochés (non par défaut). */
  readonly includeChecked?: boolean;
}

/**
 * Texte de la liste pour le partage (Web Share ou presse-papiers) :
 * un titre, puis chaque rayon et ses lignes « - nom : quantité ». Liste vide : un mot
 * neutre ; tout coché : un bravo.
 */
export function formatShoppingListText(
  list: ShoppingList,
  options: FormatShoppingOptions = {},
): string {
  const blocks: string[] = [options.title ?? 'Liste de courses'];
  for (const section of list.sections) {
    const items = section.items.filter((i) => (options.includeChecked ?? false) || !i.checked);
    if (items.length === 0) continue;
    const lines = items.map((i) => {
      const qty =
        i.quantity !== undefined && i.unit !== undefined
          ? ` : ${formatQuantity(i.quantity, i.unit)}`
          : '';
      return `- ${i.name}${qty}`;
    });
    blocks.push([section.label, ...lines].join('\n'));
  }
  if (blocks.length === 1) {
    const empty = list.sections.every((section) => section.items.length === 0);
    blocks.push(empty ? 'Ta liste est vide pour l’instant.' : 'Tout est dans le panier, bravo !');
  }
  return blocks.join('\n\n');
}
