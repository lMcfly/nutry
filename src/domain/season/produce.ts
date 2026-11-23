import { containsTerm } from '../shared';

export type ProduceKind = 'fruit' | 'legume';

/** Fruit ou légume du calendrier de saison. `months` : 1 = janvier … 12 = décembre. */
export interface SeasonalProduce {
  readonly name: string;
  readonly kind: ProduceKind;
  readonly months: readonly number[];
}

/** Mois de `from` à `to` inclus, en passant par décembre si besoin (`range(11, 2)` → 11, 12, 1, 2). */
const range = (from: number, to: number): number[] => {
  const months = [from];
  for (let m = from; m !== to;) {
    m = (m % 12) + 1;
    months.push(m);
  }
  return months;
};
const ALL_YEAR = range(1, 12);

/**
 * Calendrier simplifié des principaux fruits et légumes produits en France métropolitaine
 * (récolte en plein champ ou conservation traditionnelle). Sert au bonus de saisonnalité
 * du menu et à l'affichage « de saison » dans l'UI.
 */
export const SEASONAL_PRODUCE: readonly SeasonalProduce[] = [
  // Légumes
  { name: 'ail', kind: 'legume', months: range(6, 9) },
  { name: 'artichaut', kind: 'legume', months: range(5, 9) },
  { name: 'asperge', kind: 'legume', months: range(4, 6) },
  { name: 'aubergine', kind: 'legume', months: range(6, 9) },
  { name: 'betterave', kind: 'legume', months: range(7, 3) },
  { name: 'brocoli', kind: 'legume', months: range(6, 11) },
  { name: 'carotte', kind: 'legume', months: ALL_YEAR },
  { name: 'céleri', kind: 'legume', months: range(9, 3) },
  { name: 'champignon', kind: 'legume', months: ALL_YEAR },
  { name: 'chou-fleur', kind: 'legume', months: range(9, 4) },
  { name: 'chou de Bruxelles', kind: 'legume', months: range(10, 2) },
  { name: 'chou', kind: 'legume', months: range(9, 3) },
  { name: 'concombre', kind: 'legume', months: range(5, 9) },
  { name: 'courge', kind: 'legume', months: range(9, 2) },
  { name: 'courgette', kind: 'legume', months: range(6, 9) },
  { name: 'endive', kind: 'legume', months: range(10, 4) },
  { name: 'épinard', kind: 'legume', months: [3, 4, 5, 6, 9, 10, 11] },
  { name: 'fenouil', kind: 'legume', months: range(6, 10) },
  { name: 'haricot vert', kind: 'legume', months: range(6, 9) },
  { name: 'mâche', kind: 'legume', months: range(10, 3) },
  { name: 'navet', kind: 'legume', months: range(10, 3) },
  { name: 'panais', kind: 'legume', months: range(10, 3) },
  { name: 'petits pois', kind: 'legume', months: range(5, 7) },
  { name: 'poireau', kind: 'legume', months: range(9, 4) },
  { name: 'poivron', kind: 'legume', months: range(7, 10) },
  { name: 'pomme de terre', kind: 'legume', months: ALL_YEAR },
  { name: 'potiron', kind: 'legume', months: range(9, 2) },
  { name: 'radis', kind: 'legume', months: range(3, 8) },
  { name: 'salade', kind: 'legume', months: range(4, 10) },
  { name: 'tomate', kind: 'legume', months: range(6, 9) },
  // Fruits
  { name: 'abricot', kind: 'fruit', months: range(6, 8) },
  { name: 'cerise', kind: 'fruit', months: range(5, 7) },
  { name: 'châtaigne', kind: 'fruit', months: range(10, 11) },
  { name: 'clémentine', kind: 'fruit', months: range(11, 2) },
  { name: 'figue', kind: 'fruit', months: range(8, 10) },
  { name: 'fraise', kind: 'fruit', months: range(4, 7) },
  { name: 'framboise', kind: 'fruit', months: range(6, 9) },
  { name: 'kiwi', kind: 'fruit', months: range(11, 3) },
  { name: 'melon', kind: 'fruit', months: range(6, 9) },
  { name: 'myrtille', kind: 'fruit', months: range(7, 9) },
  { name: 'pêche', kind: 'fruit', months: range(6, 9) },
  { name: 'poire', kind: 'fruit', months: range(8, 3) },
  { name: 'pomme', kind: 'fruit', months: range(9, 4) },
  { name: 'prune', kind: 'fruit', months: range(7, 9) },
  { name: 'raisin', kind: 'fruit', months: range(8, 10) },
  { name: 'rhubarbe', kind: 'fruit', months: range(4, 6) },
];

/** Fruits et légumes de saison pour un mois donné (1-12). */
export function produceInSeason(month: number): readonly SeasonalProduce[] {
  return SEASONAL_PRODUCE.filter((p) => p.months.includes(month));
}

/**
 * Produit du calendrier correspondant à un nom d'ingrédient, s'il y en a un
 * (« courgettes » → courgette). Le nom le plus spécifique l'emporte
 * (« chou de Bruxelles » plutôt que « chou »).
 */
export function findProduce(ingredientName: string): SeasonalProduce | undefined {
  if (PRODUCE_CACHE.has(ingredientName)) return PRODUCE_CACHE.get(ingredientName);
  const found = BY_SPECIFICITY.find((p) => containsTerm(ingredientName, p.name));
  if (PRODUCE_CACHE.size >= 5_000) PRODUCE_CACHE.clear();
  PRODUCE_CACHE.set(ingredientName, found);
  return found;
}

/** Du nom le plus long au plus court : le plus spécifique est trouvé en premier. */
const BY_SPECIFICITY = [...SEASONAL_PRODUCE].sort((a, b) => b.name.length - a.name.length);
/** Cache interne (sans effet observable) : nom d'ingrédient → produit. */
const PRODUCE_CACHE = new Map<string, SeasonalProduce | undefined>();

/** Vrai si l'ingrédient est un fruit ou légume du calendrier, de saison au mois donné. */
export function isProduceInSeason(ingredientName: string, month: number): boolean {
  return findProduce(ingredientName)?.months.includes(month) ?? false;
}
